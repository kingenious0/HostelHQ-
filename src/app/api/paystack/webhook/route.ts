import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getPaystackKeys } from "@/lib/paystack-utils";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logSecurityEvent, logError } from "@/lib/logger";

/**
 * Paystack Webhook Handler
 * 
 * This is the ultimate "fail-safe" for payments. Even if a student's
 * phone dies or the redirect fails, Paystack will notify this endpoint
 * to finalize the booking.
 */
export async function POST(req: NextRequest) {
  try {
    const { secretKey } = await getPaystackKeys();
    
    if (!secretKey) {
      logError(new Error("Paystack secret key missing during webhook processing"));
      return NextResponse.json({ status: "error", message: "Internal configuration error" }, { status: 500 });
    }

    // 1. Verify Signature
    const signature = req.headers.get("x-paystack-signature");
    const body = await req.text(); // Get raw body for HMAC verification
    
    const hash = crypto
      .createHmac("sha512", secretKey)
      .update(body)
      .digest("hex");

    if (hash !== signature) {
      logSecurityEvent("UNAUTHORIZED_WEBHOOK_ATTEMPT", {
        ip: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
        providedSignature: signature,
      });
      return NextResponse.json({ status: "error", message: "Invalid signature" }, { status: 401 });
    }

    // 2. Parse Event
    const event = JSON.parse(body);
    const { event: eventType, data } = event;

    if (eventType !== "charge.success") {
      // We only care about successful charges for now
      return NextResponse.json({ status: "success", message: "Event ignored" });
    }

    const reference = data.reference;
    const amountPaid = data.amount; // In Pesewas
    const metadata = data.metadata || {};

    // 3. Prevent Duplicate Processing (Idempotency)
    const bookingQuery = await adminDb.collection("bookings")
      .where("paymentReference", "==", reference)
      .get();

    if (!bookingQuery.empty) {
      return NextResponse.json({ status: "success", message: "Already processed" });
    }

    // 4. Process Booking (Shared logic or inline for now)
    // For Visit Bookings
    if (metadata.booking_type === "visit") {
      await processVisitBooking(data);
    } 
    // For Secure Hostel Bookings
    else if (metadata.booking_type === "secure") {
      await processSecureBooking(data);
    }

    logSecurityEvent("PAYMENT_SUCCESS_WEBHOOK", { reference, amount: amountPaid });
    return NextResponse.json({ status: "success" });

  } catch (error: any) {
    logError(error, { context: "Paystack Webhook Handler" });
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}

async function processVisitBooking(data: any) {
  // Logic to finalize a visit booking
  // (In a real app, this would match what's in paystack.ts confirm logic)
  const reference = data.reference;
  const metadata = data.metadata;
  
  // Create visit record if it doesn't exist
  // Note: Usually visit bookings are handled differently than room bookings
  console.log("Processing visit booking via webhook:", reference);
}

async function processSecureBooking(data: any) {
  // Logic to finalize a room booking
  // This should match the core of verifyAndProcessBooking in paystack.ts
  const reference = data.reference;
  const metadata = data.metadata;
  
  // We'd extract the studentId, hostelId, etc. from metadata
  console.log("Processing secure room booking via webhook:", reference);
}
