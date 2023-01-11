import SchemaBuilder from '@pothos/core'
import { Request, Response } from 'express'
import type { User } from '@prisma/client'
import { createPubSub } from '@graphql-yoga/node'

export const pubsub = createPubSub()

export const builder = new SchemaBuilder<{
  Context: {
    req: Request & { user: User }
    res: Response
    request: globalThis.Request
  }
  DefaultFieldNullability: true
}>({ defaultFieldNullability: true })

builder.mutationType({})
builder.queryType({
  fields: (t) => ({
    hello: t.string({
      resolve: () => {
        pubsub.publish('word', `${Math.random()}`)
        return 'world'
      },
    }),
  }),
})
builder.subscriptionType({})

const values = []

builder.subscriptionField('helloSubs', (t) =>
  t.stringList({
    subscribe: () => pubsub.subscribe('word'),
    resolve: (value) => {
      values.push(value)

      return values
    },
  })
)

require('./graphql/user')

export const schema = builder.toSchema()
