import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import { Resend } from "resend";

let resendClient: Resend | null = null;

export type UnsubscribeType = "messages" | "digests";

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
  uid?: string;
  unsubscribeType?: UnsubscribeType;
  respectPreferences?: boolean;
}

type UserEmailPreferences = {
  notifications?: {
    messages?: boolean;
    digests?: boolean;
  };
  messageNotification?: boolean;
  digestNotification?: boolean;
  emailNotifications?: boolean;
};

async function getUserPreferences(uid: string): Promise<UserEmailPreferences | null> {
  const userSnap = await getFirestore().collection("users").doc(uid).get();
  if (!userSnap.exists) {
    logger.warn("User not found for email send", { uid });
    return null;
  }

  return userSnap.data() as UserEmailPreferences;
}

function isUnsubscribed(preferences: UserEmailPreferences | null, type: UnsubscribeType): boolean {
  if (!preferences) return false;

  const notifications = preferences.notifications || {};

  if (type === "messages") {
    if (typeof notifications.messages === "boolean") {
      return notifications.messages === false;
    }

    return preferences.messageNotification === false || preferences.emailNotifications === false;
  }

  if (typeof notifications.digests === "boolean") {
    return notifications.digests === false;
  }

  return preferences.digestNotification === false;
}

function appendUnsubscribeFooter(html: string, uid: string, type: UnsubscribeType): string {
  const unsubscribeUrl = `https://locallist.biz/unsubscribe?uid=${encodeURIComponent(uid)}&type=${encodeURIComponent(type)}`;
  const footerText = type === "messages"
    ? `Want fewer emails?
    <a href="${unsubscribeUrl}" style="color:#2563eb;text-decoration:underline;">Stop message emails</a>.`
    : `Want fewer emails?
    <a href="${unsubscribeUrl}" style="color:#2563eb;text-decoration:underline;">Manage email preferences</a>. Transactional emails may still be sent when required.`;
  const footer = `
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e4e4e7;">
  <p style="margin:0;color:#71717a;font-size:12px;line-height:1.6;">
    ${footerText}
  </p>
</div>`.trim();

  return html.includes("</body>")
    ? html.replace("</body>", `${footer}\n</body>`)
    : `${html}\n${footer}`;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ id: string }> {
  const resend = getResendClient();

  const from = options.from ?? "Local List <noreply@locallist.biz>";
  const shouldRespectPreferences = options.respectPreferences ?? true;
  let html = options.html;

  if (options.uid) {
    const preferences = await getUserPreferences(options.uid);

    if (options.unsubscribeType && shouldRespectPreferences && isUnsubscribed(preferences, options.unsubscribeType)) {
      logger.info("Skipping unsubscribed email", {
        uid: options.uid,
        unsubscribeType: options.unsubscribeType,
        subject: options.subject,
      });
      return { id: "skipped-unsubscribed" };
    }

    if (options.unsubscribeType) {
      html = appendUnsubscribeFooter(html, options.uid, options.unsubscribeType);
    }
  }

  const { data, error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  });

  if (error) {
    logger.error("Resend email failed", { error, to: options.to, subject: options.subject });
    throw new Error(`Failed to send email: ${error.message}`);
  }

  logger.info("Email sent", { id: data?.id, to: options.to, subject: options.subject });
  return { id: data!.id };
}
