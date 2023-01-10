import SchemaBuilder from "@pothos/core";
import { Request, Response } from "express";
import type { User } from "@prisma/client";

export const builder = new SchemaBuilder<{
  Context: {
    req: Request & { user: User };
    res: Response;
    request: globalThis.Request;
  };
  DefaultFieldNullability: true;
}>({ defaultFieldNullability: true });

builder.mutationType({});
builder.queryType({
  fields: (t) => ({ hello: t.string({ resolve: () => "world" }) }),
});

require("./graphql/user");

export const schema = builder.toSchema();
