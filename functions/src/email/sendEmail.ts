import * as logger from "firebase-functions/logger";
import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ id: string }> {
  const resend = getResendClient();

  const from = options.from ?? "Local List <noreply@locallist.biz>";

  const { data, error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  });

  if (error) {
    logger.error("Resend email failed", { error, to: options.to, subject: options.subject });
    throw new Error(`Failed to send email: ${error.message}`);
  }

  logger.info("Email sent", { id: data?.id, to: options.to, subject: options.subject });
  return { id: data!.id };
}
