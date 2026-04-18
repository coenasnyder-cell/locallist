export function messageEmail(
  recipientName: string,
  senderName: string,
  messagePreview: string,
  messageUrl = "https://locallist.biz/messages.html",
): { subject: string; html: string } {
  const preview =
    messagePreview.length > 200
      ? messagePreview.slice(0, 200) + "…"
      : messagePreview;

  return {
    subject: `New message from ${senderName} on Local List`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#2563eb;padding:32px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;">Local List</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">Hi ${recipientName || "there"},</h2>
          <p style="margin:0 0 16px;color:#3f3f46;font-size:16px;line-height:1.6;">
            <strong>${senderName}</strong> sent you a message:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#f4f4f5;border-left:4px solid #2563eb;padding:16px 20px;border-radius:0 6px 6px 0;">
              <p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.6;white-space:pre-wrap;">${preview}</p>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Open the app to continue the conversation.
          </p>
          <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;line-height:1.6;">
            To view this message,
            <a href="${messageUrl}" style="color:#2563eb;text-decoration:underline;">click here</a>.
          </p>
        </td></tr>
        <tr><td style="background:#fafafa;padding:24px 40px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">
            &copy; ${new Date().getFullYear()} Local List &middot; All rights reserved
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim(),
  };
}
