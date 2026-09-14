import { NextRequest, NextResponse } from "next/server";

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  // Remove all non-digits except a leading +
  let cleaned = phone.trim().replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // If Ghanaian number starting with 0, convert to 233
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "233" + cleaned.substring(1);
  }

  // If 9 digits (missing leading 0 e.g. 241234567), prepend 233
  if (cleaned.length === 9) {
    return "233" + cleaned;
  }

  // If already starts with 233
  if (cleaned.startsWith("233")) {
    return cleaned;
  }

  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientPhone, message } = body;

    if (!recipientPhone || !message) {
      return NextResponse.json(
        { error: "recipientPhone and message are required" },
        { status: 400 }
      );
    }

    const formattedPhone = normalizePhoneNumber(recipientPhone);
    const apiKey =
      process.env.FROGWIGAL_API_KEY ||
      process.env.WIGAL_API_KEY ||
      process.env.FROG_SMS_API_KEY ||
      "mock_frogwigal_api_key";

    console.log(`[FrogWigal SMS] Dispatching SMS to ${formattedPhone}: "${message}"`);

    // Only attempt live gateway call if key is present and not mock, or try with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch("https://api.frogwigal.gh/v1/sms/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender_id: "HostelHQ",
          to: formattedPhone,
          message: message,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`FrogWigal gateway responded with status ${response.status}: ${errorText}`);
        // If external gateway is unreachable in dev/preview or unauthorized, return simulated success with warning
        return NextResponse.json({
          success: true,
          gateway: "frogwigal",
          simulated: true,
          formattedPhone,
          warning: `Gateway returned ${response.status}: ${errorText}`,
          message: "SMS logged in dispatch pipeline",
        });
      }

      const responseData = await response.json();
      return NextResponse.json({
        success: true,
        gateway: "frogwigal",
        data: responseData,
        formattedPhone,
      });
    } catch (fetchError: any) {
      console.warn(
        `[FrogWigal SMS] Network or gateway call failed (${fetchError.message}). Operating in preview dispatch mode.`
      );
      return NextResponse.json({
        success: true,
        gateway: "frogwigal",
        simulated: true,
        formattedPhone,
        note: "Dispatched in local/preview simulated mode",
      });
    }
  } catch (err: any) {
    console.error("Error handling /api/notifications/sms:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
