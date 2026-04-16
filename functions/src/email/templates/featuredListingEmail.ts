export function featuredListingEmail(
  listingTitle: string,
  durationDays: number,
): { subject: string; html: string } {
  const amount = durationDays >= 30 ? "$10" : "$5";
  const itemLabel = durationDays >= 30 ? "service" : "listing";

  return {
    subject: "Your listing is now featured ⭐",
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
          <img src="https://app.locallist.biz/assets/logo.png" alt="Local List — Harrison's Local Marketplace" width="200" style="display:block;" />
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:0 40px 40px;">

          <h1 style="margin:0 0 20px;color:#18181b;font-size:24px;font-weight:bold;">Your listing is now featured &#x2B50;</h1>

          <p style="margin:0 0 20px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Your payment of <strong>${amount}</strong> has been received. Your ${itemLabel} <strong>${listingTitle}</strong> is now featured on Local List!
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px 20px;border-radius:0 6px 6px 0;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 8px;color:#18181b;font-size:14px;font-weight:bold;">Item</td>
                  <td style="padding:0 0 8px 24px;color:#3f3f46;font-size:14px;">${listingTitle}</td>
                </tr>
                <tr>
                  <td style="padding:0 0 8px;color:#18181b;font-size:14px;font-weight:bold;">Duration</td>
                  <td style="padding:0 0 8px 24px;color:#3f3f46;font-size:14px;">${durationDays} days</td>
                </tr>
                <tr>
                  <td style="padding:0;color:#18181b;font-size:14px;font-weight:bold;">Amount</td>
                  <td style="padding:0 0 0 24px;color:#3f3f46;font-size:14px;">${amount}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <p style="margin:0 0 20px;color:#3f3f46;font-size:16px;line-height:1.6;">
            Featured ${itemLabel}s get priority placement so more people in your community can discover them. If your ${itemLabel} is pending approval, featured status will activate as soon as it&rsquo;s approved.
          </p>

          <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;line-height:1.6;">
            If you have any questions about your purchase, email us at
            <a href="mailto:support@locallist.biz" style="color:#2563eb;text-decoration:underline;">support@locallist.biz</a> &mdash; we&rsquo;re happy to help.
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
