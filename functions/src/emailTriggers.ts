import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { featuredListingEmail, messageEmail, premiumSubscriptionEmail, sendEmail, welcomeEmail } from "./email/index.js";

/**
 * Sends a welcome email when a new user document is created.
 */
export const onUserCreated = onDocumentCreated(
  {
    document: "users/{userId}",
    secrets: ["RESEND_API_KEY"],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const userData = snapshot.data();
    const email: string | undefined = userData.email;

    if (!email) {
      logger.warn("New user has no email — skipping welcome email", {
        userId: event.params.userId,
      });
      return;
    }

    try {
      const template = welcomeEmail();
      await sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
      });
      logger.info("Welcome email sent", { userId: event.params.userId, email });
    } catch (error) {
      logger.error("Failed to send welcome email", {
        userId: event.params.userId,
        error,
      });
    }
  }
);

/**
 * Sends a message notification email when a new message is created in a thread.
 */
export const onMessageCreated = onDocumentCreated(
  {
    document: "threads/{threadId}/messages/{messageId}",
    secrets: ["RESEND_API_KEY"],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const messageData = snapshot.data();
    const senderId: string | undefined = messageData.senderId;
    const text: string = messageData.text || messageData.content || "";

    if (!senderId || !text) {
      logger.warn("Message missing senderId or text — skipping notification", {
        threadId: event.params.threadId,
        messageId: event.params.messageId,
      });
      return;
    }

    const db = getFirestore();

    try {
      // Load the thread to find the recipient
      const threadSnap = await db
        .collection("threads")
        .doc(event.params.threadId)
        .get();

      if (!threadSnap.exists) {
        logger.warn("Thread not found", { threadId: event.params.threadId });
        return;
      }

      const threadData = threadSnap.data()!;
      const participants: string[] = threadData.participants || [];

      // Recipient = the other participant(s) in the thread
      const recipientIds = participants.filter((id) => id !== senderId);

      if (recipientIds.length === 0) {
        logger.info("No recipients for message notification", {
          threadId: event.params.threadId,
        });
        return;
      }

      // Fetch sender info
      const senderSnap = await db.collection("users").doc(senderId).get();
      const senderData = senderSnap.exists ? senderSnap.data() : undefined;
      const senderName =
        senderData?.displayName || senderData?.name || "Someone";

      // Send notification to each recipient
      for (const recipientId of recipientIds) {
        const recipientSnap = await db.collection("users").doc(recipientId).get();
        if (!recipientSnap.exists) continue;

        const recipientData = recipientSnap.data()!;
        const recipientEmail: string | undefined = recipientData.email;
        const recipientName =
          recipientData.displayName || recipientData.name || "there";

        if (!recipientEmail) {
          logger.warn("Recipient has no email — skipping", { recipientId });
          continue;
        }

        // Respect notification preferences if they exist
        if (recipientData.emailNotifications === false) {
          logger.info("Recipient opted out of email notifications", {
            recipientId,
          });
          continue;
        }

        const threadUrl = `https://locallist.biz/messages.html?threadId=${encodeURIComponent(event.params.threadId)}`;
        const template = messageEmail(recipientName, senderName, text, threadUrl);

        try {
          await sendEmail({
            to: recipientEmail,
            subject: template.subject,
            html: template.html,
          });
          logger.info("Message notification email sent", {
            recipientId,
            threadId: event.params.threadId,
          });
        } catch (error) {
          logger.error("Failed to send message notification email", {
            recipientId,
            threadId: event.params.threadId,
            error,
          });
        }
      }
    } catch (error) {
      logger.error("Error in onMessageCreated trigger", {
        threadId: event.params.threadId,
        messageId: event.params.messageId,
        error,
      });
    }
  }
);

/**
 * Sends a notification email to support when a public contact message is created.
 */
export const onPublicMessageCreated = onDocumentCreated(
  {
    document: "publicMessages/{messageId}",
    secrets: ["RESEND_API_KEY"],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const email = data.publicMessageEmail;
    const name = data.publicSenderName || "Public User";
    const message = data.publicMessageText;

    try {
      await sendEmail({
        to: "support@locallist.biz", // Update this to your support email address
        subject: `New Public Contact: ${name}`,
        html: `
          <h3>New Support Message from Public Form</h3>
          <p><strong>From:</strong> ${name} (${email})</p>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">${message}</p>
        `,
      });
      logger.info("Public contact email sent to support", { messageId: event.params.messageId, email });
    } catch (error) {
      logger.error("Failed to send public contact email", {
        messageId: event.params.messageId,
        error,
      });
    }
  }
);

/**
 * Sends a featured listing confirmation email when a featurePurchases document is created.
 */
export const onFeaturePurchaseCreated = onDocumentCreated(
  {
    document: "featurePurchases/{purchaseId}",
    secrets: ["RESEND_API_KEY"],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const purchaseData = snapshot.data();
    const userId: string | undefined = purchaseData.userId || null;

    if (!userId) {
      logger.warn("Feature purchase has no userId — skipping confirmation email", {
        purchaseId: event.params.purchaseId,
      });
      return;
    }

    const db = getFirestore();

    try {
      const userSnap = await db.collection("users").doc(userId).get();
      if (!userSnap.exists) {
        logger.warn("User not found for feature purchase email", { userId });
        return;
      }

      const userData = userSnap.data()!;
      const email: string | undefined = userData.email;

      if (!email) {
        logger.warn("User has no email — skipping feature confirmation", { userId });
        return;
      }

      // Resolve the listing/service title
      const isService = purchaseData.itemType === "service";
      const targetId: string | undefined =
        isService ? purchaseData.serviceId : purchaseData.listingId;
      let title = "your item";
      const durationDays: number = isService ? 30 : 7;

      if (targetId) {
        const collection = isService ? "services" : "listings";
        const itemSnap = await db.collection(collection).doc(targetId).get();
        if (itemSnap.exists) {
          const itemData = itemSnap.data()!;
          title = itemData.title || itemData.serviceTitle || title;
        }
      }

      const template = featuredListingEmail(title, durationDays);
      await sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
      });

      logger.info("Featured listing confirmation email sent", {
        purchaseId: event.params.purchaseId,
        userId,
        email,
      });
    } catch (error) {
      logger.error("Failed to send featured listing confirmation email", {
        purchaseId: event.params.purchaseId,
        userId,
        error,
      });
    }
  }
);

/**
 * Sends a premium subscription confirmation email when a premiumPurchases document is created.
 */
export const onPremiumPurchaseCreated = onDocumentCreated(
  {
    document: "premiumPurchases/{purchaseId}",
    secrets: ["RESEND_API_KEY"],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const purchaseData = snapshot.data();
    const userId: string | undefined = purchaseData.userId || null;

    if (!userId) {
      logger.warn("Premium purchase has no userId — skipping confirmation email", {
        purchaseId: event.params.purchaseId,
      });
      return;
    }

    const db = getFirestore();

    try {
      const userSnap = await db.collection("users").doc(userId).get();
      if (!userSnap.exists) {
        logger.warn("User found for premium purchase email", { userId });
        return;
      }

      const userData = userSnap.data()!;
      const email: string | undefined = userData.email;

      if (!email) {
        logger.warn("User has no email — skipping premium confirmation", { userId });
        return;
      }

      const template = premiumSubscriptionEmail();
      await sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
      });

      logger.info("Premium subscription confirmation email sent", {
        purchaseId: event.params.purchaseId,
        userId,
        email,
      });
    } catch (error) {
      logger.error("Failed to send premium subscription confirmation email", {
        purchaseId: event.params.purchaseId,
        userId,
        error,
      });
    }
  }
);
