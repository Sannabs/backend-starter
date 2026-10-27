import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../views/email/auth.email.js";

const isProd = env.NODE_ENV === "production";
const RESET_TOKEN_TTL_SECONDS = 3600;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
    sendResetPassword: async ({ user, token }) => {
      await sendPasswordResetEmail({
        email: user.email,
        userName: user.name || user.email,
        resetUrl: `${env.CLIENT_URL}/reset-password/${token}`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, token }) => {
      await sendVerificationEmail({
        email: user.email,
        userName: user.name || user.email,
        verifyUrl: `${env.CLIENT_URL}/verify-email/${token}`,
      });
    },
  },
  trustedOrigins: [env.BETTER_AUTH_URL, env.CLIENT_URL],
  advanced: {
    disableCSRFCheck: !isProd,
    useSecureCookies: isProd,
    trustedProxyHeaders: true,
    ...(isProd &&
      env.COOKIE_DOMAIN && {
        crossSubDomainCookies: {
          enabled: true,
          domain: env.COOKIE_DOMAIN,
        },
      }),
  },
});
