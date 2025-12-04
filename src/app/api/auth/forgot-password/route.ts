import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { generateAndSendOTP, formatPhoneNumber } from '@/lib/wigal';

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Normalize phone to match storage format (233XXXXXXXXX)
    let normalizedPhone = phoneNumber.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0') && normalizedPhone.length === 10) {
      normalizedPhone = '233' + normalizedPhone.substring(1);
    }

    // Find user by phone number
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phoneNumber', '==', normalizedPhone));
    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json(
        { success: false, error: 'No account found with this phone number' },
        { status: 404 }
      );
    }

    const userData = snap.docs[0].data();
    const userId = snap.docs[0].id;

    // Send OTP via Wigal
    const otpResult = await generateAndSendOTP(formattedPhone, {
      length: 6,
      expiry: 10,
      type: 'NUMERIC',
      messageTemplate: 'Your HostelHQ password reset code is: %OTPCODE%. This code expires in %EXPIRY% minutes. Do not share this code.',
    });

    if (!otpResult.success) {
      return NextResponse.json(
        { success: false, error: otpResult.error || 'Failed to send OTP' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      userId: userId,
      authEmail: userData.authEmail || userData.email,
    });
  } catch (error: any) {
    console.error('Error in forgot-password route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
