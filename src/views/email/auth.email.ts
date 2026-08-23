import { APP_NAME } from "./layout.js";
import { sendEmail } from "./send.js";

// Must track resetPasswordTokenExpiresIn / the verification TTL in lib/auth.ts.
const LINK_TTL_LABEL = "1 hour";

interface VerificationEmailInput {
  email: string;
  userName: string;
  verifyUrl: string;
}

interface PasswordResetEmailInput {
  email: string;
  userName: string;
  resetUrl: string;
}

export const sendVerificationEmail = async ({
  email,
  userName,
  verifyUrl,
}: VerificationEmailInput) =>
  sendEmail({
    to: email,
    subject: `Confirm your ${APP_NAME} email address`,
    content: {
      preheader: `Confirm your email to finish setting up ${APP_NAME}.`,
      heading: "Confirm your email",
      paragraphs: [
        `Hi ${userName},`,
        `Your ${APP_NAME} account is almost ready. Confirm this address to activate it and start taking payments.`,
      ],
      action: { label: "Confirm email address", url: verifyUrl },
      footnote: `This link expires in ${LINK_TTL_LABEL}. If you didn't create a ${APP_NAME} account, you can ignore this email.`,
    },
  });

export const sendPasswordResetEmail = async ({
  email,
  userName,
  resetUrl,
}: PasswordResetEmailInput) =>
  sendEmail({
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    content: {
      preheader: `Use this link to choose a new ${APP_NAME} password.`,
      heading: "Reset your password",
      paragraphs: [
        `Hi ${userName},`,
        "We received a request to reset your password. Choose a new one using the link below.",
      ],
      action: { label: "Choose a new password", url: resetUrl },
      footnote: `This link expires in ${LINK_TTL_LABEL} and can only be used once. If you didn't request a reset, ignore this email — your password won't change.`,
    },
  });
