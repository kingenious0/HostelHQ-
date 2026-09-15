import { NextRequest, NextResponse } from "next/server";
import { sendSMS, formatPhoneNumber } from "@/lib/wigal";

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  return formatPhoneNumber(phone);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientPhone, message } = body;

    if (!recipientPhone || !message) {
      return NextResponse.json(
        { success: false, error: "recipientPhone and message are required" },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhoneNumber(recipientPhone);
    console.log(`[FrogWigal SMS] Dispatching official SMS to ${formattedPhone}: "${message}"`);

    // Call official Wigal FROG API gateway via library
    const result = await sendSMS(formattedPhone, message);

    if (!result.success) {
      console.warn(
        `[FrogWigal SMS] Gateway delivery failed for ${formattedPhone}: ${result.error}`
      );
      return NextResponse.json(
        {
          success: false,
          gateway: "frogwigal",
          formattedPhone,
          error: result.error || "Failed to dispatch SMS via Wigal Frog gateway",
        },
        { status: 502 }
      );
    }

    console.log(`[FrogWigal SMS] Successfully delivered SMS to ${formattedPhone}`);
    return NextResponse.json({
      success: true,
      gateway: "frogwigal",
      formattedPhone,
      message: result.message || "SMS dispatched successfully via FrogWigal",
    });
  } catch (err: any) {
    console.error("Error handling /api/notifications/sms:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
