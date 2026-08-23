import { resend } from "../../config/resend.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/error.js";
import { renderEmail, renderEmailText, type EmailContent } from "./layout.js";

interface SendEmailInput {
  to: string;
  subject: string;
  content: EmailContent;
}

export const sendEmail = async ({ to, subject, content }: SendEmailInput) => {
  // Resend resolves with { data, error } instead of rejecting — an unchecked
  // call silently drops the mail and leaves the user stranded mid-flow.
  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html: renderEmail(content),
    text: renderEmailText(content),
  });

  if (error) {
    throw new AppError(
      `Failed to send email: ${error.message}`,
      502,
      "EMAIL_SEND_FAILED",
    );
  }

  return data;
};
