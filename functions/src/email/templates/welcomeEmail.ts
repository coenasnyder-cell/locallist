export function welcomeEmail(): { subject: string; html: string } {
  return {
    subject: "Welcome to Local List!",
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;">

        <!-- Logo -->
        <tr><td align="center" style="padding:40px 40px 32px;">
          <img src="https://locallist.biz/assets/logo.png" alt="Local List — Harrison's Local Marketplace" width="200" style="display:block;" />
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:0 40px 40px;">

          <h1 style="margin:0 0 20px;color:#18181b;font-size:24px;font-weight:bold;">Welcome to Local List!</h1>

          <p style="margin:0 0 20px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Your go-to place to buy, sell, and stay connected locally.
          </p>

          <p style="margin:0 0 16px;color:#18181b;font-size:16px;font-weight:bold;line-height:1.6;">
            Here&rsquo;s what you can do on Local List:
          </p>

          <ul style="margin:0 0 24px;padding-left:20px;color:#3f3f46;font-size:16px;line-height:2;">
            <li>Find local deals and save money</li>
            <li>Discover events happening nearby</li>
            <li>Browse jobs and opportunities</li>
            <li>Connect with local businesses and services</li>
            <li>Help reunite lost pets or find a new companion</li>
          </ul>

          <p style="margin:0 0 20px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Local List is built to make buying, selling, and connecting simple, local, and useful.
          </p>

          <p style="margin:0 0 8px;color:#3f3f46;font-size:16px;line-height:1.6;">
            &#x1F449; Get started now:
          </p>

          <p style="margin:0 0 24px;">
            <a href="https://locallist.biz" style="color:#2563eb;font-size:16px;line-height:1.6;text-decoration:underline;">Explore your community or create your first listing today.</a>
          </p>

          <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;line-height:1.6;">
            If you have any questions or need help, just email us at
            <a href="mailto:support@locallist.biz" style="color:#2563eb;text-decoration:underline;">support@locallist.biz</a> &mdash; we&rsquo;re here to help.
          </p>

          <p style="margin:0 0 4px;color:#3f3f46;font-size:16px;line-height:1.6;">Sincerely,</p>
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
