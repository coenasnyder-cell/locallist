export function premiumSubscriptionEmail(): { subject: string; html: string } {
  return {
    subject: "Welcome to Premium — your business tools are live!",
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

          <h1 style="margin:0 0 20px;color:#18181b;font-size:24px;font-weight:bold;">You&rsquo;re now a Premium Business &#x1F31F;</h1>

          <p style="margin:0 0 20px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Your $10/month Premium subscription is active. Thank you for investing in your business on Local List!
          </p>

          <p style="margin:0 0 16px;color:#18181b;font-size:16px;font-weight:bold;line-height:1.6;">
            Here&rsquo;s what&rsquo;s included with Premium:
          </p>

          <ul style="margin:0 0 24px;padding-left:20px;color:#3f3f46;font-size:16px;line-height:2;">
            <li>Priority placement in search &amp; browse results</li>
            <li>Premium badge on your business profile</li>
            <li>Enhanced business profile customization</li>
            <li>Advanced analytics &amp; insights</li>
          </ul>

          <p style="margin:0 0 20px;color:#3f3f46;font-size:16px;line-height:1.6;">
            To get the most out of your upgrade, make sure your public Business Profile is up to date. Add your hours, photos, description, and contact info so customers can find and reach you easily.
          </p>

          <!-- CTA Button -->
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td align="center" style="background:#2563eb;border-radius:6px;">
              <a href="https://locallist.biz" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">
                Update Your Business Profile
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Your subscription renews automatically each month. You can manage or cancel it anytime from your profile settings.
          </p>

          <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Questions? Email us at
            <a href="mailto:support@locallist.biz" style="color:#2563eb;text-decoration:underline;">support@locallist.biz</a> &mdash; we&rsquo;re here to help.
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
