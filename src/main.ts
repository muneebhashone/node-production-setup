import * as dotenv from "dotenv";
dotenv.config();

import { createServer } from "node:http";
import express, { Request, Response } from "express";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema";
import MongoStore from "connect-mongo";
import session from "express-session";
import cookieParser from "cookie-parser";
import passport from "passport";
import {
  LocalStrategyVerification,
  GoogleStrategyVerification,
} from "./passport-strategies/passport";
import { decode, signJwt } from "./utils/jwt.utils";
import { trim } from "lodash";
const app = express();

const yoga = (req: Request, res: Response) => {
  const serverGraphql = createYoga({
    schema,
    context: ({ request }) => {
      const token =
        req.cookies.token || trim(req.headers.authorization, "Bearer ");

      const user = req.isAuthenticated() ? decode(token) : null;

      console.log({ user });

      return { request, user };
    },
  });

  return serverGraphql(req, res);
};

const sessionStore = new MongoStore({
  mongoUrl: process.env.DATABASE_URL as string,
  collectionName: "sessions",
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

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
);

app.use(passport.initialize());
app.use(passport.session());

app.post(
  "/login",
  (req, res, next) =>
    passport.authenticate("local", { failureRedirect: "/login" })(
      req,
      res,
      next
    ),
  (req, res) => {
    const signedToken = signJwt(req.user);
    res.cookie("token", signedToken, { maxAge: 1000 * 60 * 60 * 24 });
    res.setHeader("Authorization", `Bearer ${signedToken}`);
    return res.json({ token: signedToken });
  }
);

app.get("/logout", (req, res) => {
  return req.logOut({ keepSessionInfo: false }, function (err) {
    if (err) {
      console.log(err);
    }

    res.json({ success: true });
  });
});

app.get(
  "/test-auth",
  (req, res, next) => {
    console.log({ user: req.user });
    next();
  },
  (req, res) => {
    return res.send("done");
  }
);

app.get(
  "/auth/google",
  passport.authenticate("sign-in-with-google", {
    scope: ["profile"],
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google"),
  function (req, res) {
    res.redirect("/");
  }
);

app.use("/graphql", yoga);

passport.use(LocalStrategyVerification);
passport.use("sign-in-with-google", GoogleStrategyVerification);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Pass it into a server to hook into request handlers.
const server = createServer(app);

// Start the server and you're done!
server.listen(process.env.PORT, () => {
  console.info(
    `Server is running on http://localhost:${process.env.PORT}/graphql`
  );
});
