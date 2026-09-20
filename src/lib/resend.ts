import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const DEFAULT_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || 'HostelHQ USTED <verify@hostelhq.kingenious.xyz>';

/**
 * Sends a 6-digit OTP verification code to a student's email using Resend.
 * Styled with USTED institutional maroon (#6B1D2F) and displays a 10-minute expiry notice.
 */
export async function sendEmailOTP(
  toEmail: string,
  otpCode: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const formattedEmail = toEmail.trim().toLowerCase();
    const subject = `${otpCode} is your HostelHQ Verification Code`;

    if (!resend) {
      console.warn(
        `[Resend] RESEND_API_KEY is not set. Simulating OTP email send to ${formattedEmail}. Code: ${otpCode}`
      );
      return {
        success: true,
        data: { simulated: true, id: 'simulated_resend_id' },
      };
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
          <!-- Header Banner with USTED Institutional Maroon -->
          <tr>
            <td style="background:linear-gradient(135deg, #6B1D2F 0%, #4D121F 100%);padding:32px 28px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">HostelHQ</h1>
              <p style="margin:6px 0 0 0;color:#fbcfe8;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">AAMUSTED Student Accommodation</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:36px 32px;">
              <h2 style="margin:0 0 12px 0;color:#0f172a;font-size:18px;font-weight:700;">Verify Your Email Address</h2>
              <p style="margin:0 0 24px 0;color:#475569;font-size:14px;line-height:1.6;">
                Use the 6-digit verification code below to complete your registration on HostelHQ.
              </p>

              <!-- OTP Code Display Card -->
              <div style="background-color:#fff1f2;border:2px solid #6B1D2F;border-radius:12px;padding:20px;text-align:center;margin:28px 0;">
                <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;color:#6B1D2F;letter-spacing:8px;display:inline-block;">
                  ${otpCode}
                </span>
              </div>

              <!-- 10-Minute Expiry Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <tr>
                  <td style="color:#475569;font-size:12px;line-height:1.5;">
                    <strong style="color:#0f172a;">⏰ Expiry Notice:</strong> This code is valid for <strong>10 minutes</strong>. Never share this code with anyone.
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
                If you did not initiate this request or create an account with HostelHQ, please ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
                © ${new Date().getFullYear()} HostelHQ • Akenten Appiah-Menka University of Skills Training and Entrepreneurial Development (AAMUSTED)<br>
                Kumasi &amp; Mampong Campuses, Ghana
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: [formattedEmail],
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('[Resend] Error sending email OTP:', error);
      return { success: false, error: error.message || 'Failed to send email verification' };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[Resend] Exception sending email OTP:', err);
    return { success: false, error: err.message || 'Internal server error' };
  }
}
