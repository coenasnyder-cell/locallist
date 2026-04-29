export function accountDisabledEmail(
  recipientName: string,
  disabledReason: string,
): { subject: string; html: string } {
  const safeRecipientName = recipientName || "there";
  const safeReason = disabledReason || "A violation of our marketplace or safety policies was recorded on your account.";

  return {
    subject: "Your Local List account has been disabled",
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
          <h1 style="margin:0 0 20px;color:#18181b;font-size:24px;font-weight:bold;">Your account has been disabled</h1>
          <p style="margin:0 0 16px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Hi ${safeRecipientName},
          </p>
          <p style="margin:0 0 20px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Your Local List account has been disabled by our moderation team. This means you may temporarily lose access to posting, messaging, or other marketplace features while we review the account.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px 20px;border-radius:0 6px 6px 0;">
              <p style="margin:0 0 8px;color:#7f1d1d;font-size:14px;font-weight:bold;">Reason</p>
              <p style="margin:0;color:#7f1d1d;font-size:15px;line-height:1.6;">${safeReason}</p>
            </td></tr>
          </table>
          <p style="margin:0 0 20px;color:#3f3f46;font-size:16px;line-height:1.6;">
            If you do not agree with this action, believe it was a mistake, or want to request a review, please contact support at
            <a href="mailto:support@locallist.biz" style="color:#2563eb;text-decoration:underline;">support@locallist.biz</a>.
          </p>
          <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Please include the email address on your account and any details that may help us review your case.
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
