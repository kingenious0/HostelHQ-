import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { formatPhoneNumber } from '@/lib/wigal';
import { sendEmailOTP } from '@/lib/resend';

export async function POST(req: NextRequest) {
  try {
    const { email, phoneNumber } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required' },
        { status: 400 }
      );
    }

    const formattedEmail = email.trim().toLowerCase();
    const formattedPhone = phoneNumber ? formatPhoneNumber(phoneNumber) : null;

    // Generate secure 6-digit numeric OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 10 minute expiration
    const expiryMinutes = 10;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    const otpCollection = collection(db, 'otpVerifications');

    // Clean up existing unverified OTPs for this email
    try {
      const existingEmailQuery = query(
        otpCollection,
        where('email', '==', formattedEmail),
        where('verified', '==', false)
      );
      const emailDocs = await getDocs(existingEmailQuery);
      const emailDeletePromises = emailDocs.docs.map((d: any) => deleteDoc(d.ref));
      await Promise.all(emailDeletePromises);

      // Also clean up by phone number if provided
      if (formattedPhone) {
        const existingPhoneQuery = query(
          otpCollection,
          where('phoneNumber', '==', formattedPhone),
          where('verified', '==', false)
        );
        const phoneDocs = await getDocs(existingPhoneQuery);
        const phoneDeletePromises = phoneDocs.docs.map((d: any) => deleteDoc(d.ref));
        await Promise.all(phoneDeletePromises);
      }
    } catch (cleanupErr) {
      console.warn('[send-email-otp] Non-fatal cleanup warning:', cleanupErr);
    }

    // Persist OTP in Firestore for verification
    await addDoc(otpCollection, {
      email: formattedEmail,
      phoneNumber: formattedPhone,
      otp: otpCode,
      expiresAt: Timestamp.fromDate(expiresAt),
      verified: false,
      createdAt: Timestamp.now(),
      channel: 'email',
      length: 6,
    });

    // Send the email via Resend
    const result = await sendEmailOTP(formattedEmail, otpCode);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to dispatch verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${formattedEmail}`,
      expiryMinutes,
    });
  } catch (error: any) {
    console.error('[send-email-otp] Route error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
