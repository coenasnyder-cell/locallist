export function listingRejectedEmail(
  recipientName: string,
  listingTitle: string,
  rejectionReason: string,
  includesFeaturedReviewNote = false,
): { subject: string; html: string } {
  const safeRecipientName = recipientName || "there";
  const safeListingTitle = listingTitle || "your listing";
  const safeReason = rejectionReason || "It did not meet our marketplace guidelines.";

  return {
    subject: "Your Local List listing needs changes",
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;">
        <tr><td align="center" style="padding:40px 40px 32px;">
          <img src="https://locallist.biz/assets/logo.png" alt="Local List" width="200" style="display:block;" />
        </td></tr>
        <tr><td style="padding:0 40px 40px;">
          <h1 style="margin:0 0 20px;color:#18181b;font-size:24px;font-weight:bold;">Your listing was removed</h1>
          <p style="margin:0 0 16px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Hi ${safeRecipientName},
          </p>
          <p style="margin:0 0 20px;color:#3f3f46;font-size:16px;line-height:1.6;">
            We reviewed <strong>${safeListingTitle}</strong> and removed it from Local List.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px 20px;border-radius:0 6px 6px 0;">
              <p style="margin:0 0 8px;color:#7f1d1d;font-size:14px;font-weight:bold;">Reason</p>
              <p style="margin:0;color:#7f1d1d;font-size:15px;line-height:1.6;">${safeReason}</p>
            </td></tr>
          </table>
          <p style="margin:0 0 20px;color:#3f3f46;font-size:16px;line-height:1.6;">
            You can update the listing and resubmit it from your profile when you are ready.
          </p>
          ${includesFeaturedReviewNote ? `
          <p style="margin:0 0 20px;color:#3f3f46;font-size:16px;line-height:1.6;">
            If you also requested featured placement, our team will review the purchase separately and follow up if any next steps are needed.
          </p>
          ` : ""}
          <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;line-height:1.6;">
            If you think this was a mistake, contact us at
            <a href="mailto:support@locallist.biz" style="color:#2563eb;text-decoration:underline;">support@locallist.biz</a>.
          </p>
          <p style="margin:0 0 4px;color:#3f3f46;font-size:16px;line-height:1.6;">Thank you,</p>
          <p style="margin:0 0 4px;color:#3f3f46;font-size:16px;line-height:1.6;">The Team At Local List</p>
          <p style="margin:0;">
            <a href="https://locallist.biz" style="color:#2563eb;font-size:16px;text-decoration:underline;">locallist.biz</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim(),
  };
}
