import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { comparePassword } from "../utils/auth.utils";
import prisma from "../lib/prisma";
import type { User } from "@prisma/client";
import { signJwt } from "../utils/jwt.utils";
import { omit } from "lodash";

export const LocalStrategyVerification = new LocalStrategy(
  { passwordField: "password", usernameField: "email" },
  async (email, password, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email },
      });

      if (!user && (await comparePassword(password, user.password))) {
        return done(null, { message: "Invalid email or password" });
      }

      const signedUser = omit(user as User, ["password", "active"]);

      return done(null, signedUser);
    } catch (err) {
      done(null, { message: "User not found" });
    }
  }
);

export const GoogleStrategyVerification = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    callbackURL: "http://localhost:4000/auth/google/callback",
  },
  async function (accessToken, refreshToken, profile, done) {
    try {
      const user = await prisma.user.findFirst({
        where: { email: email },
      });

      if (!user && (await comparePassword(password, user.password))) {
        return done(null, { message: "Invalid email or password" });
      }

      return done(null, user as User);
    } catch (err) {
      done(null, { message: "User not found" });
    }
  }
);
