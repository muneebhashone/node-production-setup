import * as dotenv from 'dotenv'
dotenv.config()

import { createServer } from 'node:http'
import express, { Request, Response, NextFunction } from 'express'
import { createYoga } from 'graphql-yoga'
import { schema } from './schema'
import MongoStore from 'connect-mongo'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import helmet from 'helmet'
import passport from 'passport'
import {
  LocalStrategyVerification,
  GoogleStrategyVerification,
} from './passport-strategies/passport'
import { decode, signJwt } from './utils/jwt.utils'
import { trim } from 'lodash'
import { useResponseCache } from '@graphql-yoga/plugin-response-cache'
import { useGraphQlJit } from '@envelop/graphql-jit'
import { WebSocketServer } from 'ws'
import { useServer } from 'graphql-ws/lib/use/ws'

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(compression())
app.use(helmet())

const yoga = createYoga<{ req: Request; res: Response }>({
  schema,
  context: async ({ request, req, res }) => {
    try {
      const token =
        req.cookies?.token || trim(req.headers.authorization, 'Bearer ')

      const user = req.isAuthenticated() ? decode(token) : null

      console.log({ user })

      return { request, user }
    } catch (err) {
      return { request, user: null }
    }
  },
  plugins: [
    useResponseCache({
      session: () => null,
      // by default cache all operations for 2 seconds
      ttl: 0,
    }),
    useGraphQlJit(),
  ],
  graphiql: {
    subscriptionsProtocol: 'WS',
  },
})

// return serverGraphql(req, res);

const sessionStore = new MongoStore({
  mongoUrl: process.env.DATABASE_URL as string,
  collectionName: 'sessions',
})

app.use(
  session({
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
    secret: process.env.SESSION_SECRET as string,
    // @ts-ignore
    store: sessionStore,
  })
)

app.use(passport.initialize())
app.use(passport.session())

app.post(
  '/login',
  (req, res, next) =>
    passport.authenticate('local', { failureRedirect: '/login' })(
      req,
      res,
      next
    ),
  (req, res) => {
    const signedToken = signJwt(req.user)
    res.cookie('token', signedToken, { maxAge: 1000 * 60 * 60 * 24 })
    res.setHeader('Authorization', `Bearer ${signedToken}`)
    return res.json({ token: signedToken })
  }
)

app.get('/logout', (req, res) => {
  return req.logOut({ keepSessionInfo: false }, function (err) {
    if (err) {
      console.log(err)
    }

    res.json({ success: true })
  })
})

app.get(
  '/test-auth',
  (req, res, next) => {
    console.log({ user: req.user })
    next()
  },
  (req, res) => {
    return res.send('done')
  }
)

app.get(
  '/auth/sign-in-with-google',
  passport.authenticate('sign-in-with-google', {
    scope: ['profile'],
  })
)

app.get(
  '/auth/google/callback',
  passport.authenticate('google'),
  function (req, res) {
    res.redirect('/')
  }
)

app.use('/graphql', yoga)

passport.use(LocalStrategyVerification)
passport.use('sign-in-with-google', GoogleStrategyVerification)

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((user, done) => {
  done(null, user)
})

// Pass it into a server to hook into request handlers.
const server = createServer(app)

const wsServer = new WebSocketServer({
  server: server,
  path: yoga.graphqlEndpoint,
})

useServer(
  {
    execute: (args: any) => args.rootValue.execute(args),
    subscribe: (args: any) => args.rootValue.subscribe(args),
    onSubscribe: async (ctx, msg) => {
      const { schema, execute, subscribe, contextFactory, parse, validate } =
        yoga.getEnveloped({
          ...ctx,
          req: ctx.extra.request,
          socket: ctx.extra.socket,
          params: msg.payload,
        })

      const args = {
        schema,
        operationName: msg.payload.operationName,
        document: parse(msg.payload.query),
        variableValues: msg.payload.variables,
        contextValue: await contextFactory(),
        rootValue: {
          execute,
          subscribe,
        },
      }

      const errors = validate(args.schema, args.document)
      if (errors.length) return errors
      return args
    },
  },
  wsServer
)

// Start the server and you're done!
server.listen(process.env.PORT, () => {
  console.info(
    `Server is running on http://localhost:${process.env.PORT}/graphql`
  )
})
