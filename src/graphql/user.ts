import { builder } from "../schema";
import type { User } from "@prisma/client";
import prisma from "../lib/prisma";
import { hashPassword } from "../utils/auth.utils";
import mcache from "memory-cache";

const UserObjectType = builder.objectRef<User>("UserObjectType");

UserObjectType.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    email: t.exposeString("email"),
  }),
});

builder.mutationField("register", (t) =>
  t.field({
    type: UserObjectType,
    args: {
      email: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
    },
    resolve: async (root, args, context) => {
      const { email, password } = args;

      const hashedPassword = await hashPassword(password);

      return prisma.user.create({ data: { email, password: hashedPassword } });
    },
  })
);

builder.queryField("users", (t) =>
  t.field({
    type: [UserObjectType],
    resolve: async () => {
      const usersFromCache = mcache.get("users");
      console.log({ usersFromCache });
      if (usersFromCache) return usersFromCache;

      const users = await prisma.user.findMany();
      mcache.put("users", users, 10 * 1000);

      return users;
    },
  })
);
