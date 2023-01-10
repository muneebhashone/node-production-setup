import { builder } from "../schema";
import type { User } from "@prisma/client";
import prisma from "../lib/prisma";
import { hashPassword } from "../utils/auth.utils";

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
