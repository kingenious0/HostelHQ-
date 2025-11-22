import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, email, phone, topic, message } = body as {
      fullName?: string;
      email?: string;
      phone?: string;
      topic?: string;
      message?: string;
    };

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const textLines = [
      'New contact message from HostelHQ Ghana contact page:',
      '',
      `Name: ${fullName || 'N/A'}`,
      `Email: ${email || 'N/A'}`,
      `Phone: ${phone || 'N/A'}`,
      `Topic: ${topic || 'N/A'}`,
      '',
      'Message:',
      message || 'N/A',
    ];

    const safeFullName = fullName || 'N/A';
    const safeEmail = email || 'N/A';
    const safePhone = phone || 'N/A';
    const safeTopic = topic || 'N/A';
    const safeMessage = message || 'N/A';

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f5f3f7; padding: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);">
          <thead>
            <tr>
              <td style="background: linear-gradient(135deg, #7b1c1c, #9b1c1c); padding: 20px 24px; color: #fefefe;">
                <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.18em; opacity: 0.85; margin-bottom: 4px;">HostelHQ Ghana</div>
                <div style="font-size: 22px; font-weight: 700;">New contact form message</div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 20px 24px 4px; font-size: 14px; color: #111827;">
                <p style="margin: 0 0 8px;">You just received a new enquiry from the HostelHQ contact page.</p>
                <p style="margin: 0 0 16px; color: #4b5563;">Use the details below to follow up with the student or partner.</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 24px 4px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; font-size: 14px; color: #111827;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; width: 120px; color: #6b7280;">Full name</td>
                    <td style="padding: 8px 0;">${safeFullName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #6b7280;">Email</td>
                    <td style="padding: 8px 0;"><a href="mailto:${safeEmail}" style="color: #7b1c1c; text-decoration: none;">${safeEmail}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #6b7280;">Phone</td>
                    <td style="padding: 8px 0;"><a href="tel:${safePhone}" style="color: #7b1c1c; text-decoration: none;">${safePhone}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #6b7280;">Topic</td>
                    <td style="padding: 8px 0;">${safeTopic}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 24px 4px;">
                <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; margin-bottom: 8px;">Message</div>
                <div style="font-size: 14px; line-height: 1.6; color: #111827; white-space: pre-wrap; background: #f9fafb; border-radius: 12px; padding: 12px 14px; border: 1px solid #e5e7eb;">
                  ${safeMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 24px 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
                <p style="margin: 8px 0 0;">This email was sent automatically from the HostelHQ Ghana contact form. You can reply directly to the email address above or continue the conversation via WhatsApp.</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: 'hostelhqghana@gmail.com',
      subject: topic ? `[HostelHQ Contact] ${topic}` : '[HostelHQ Contact] New message',
      text: textLines.join('\n'),
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error sending contact email:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
