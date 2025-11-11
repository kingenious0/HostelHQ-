import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { verifyOTP, formatPhoneNumber } from '@/lib/wigal';

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, otp } = await req.json();

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { success: false, error: 'Phone number and OTP are required' },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Verify OTP via Wigal FROG API
    const verifyResult = await verifyOTP(formattedPhone, otp);

    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, error: verifyResult.error || 'Invalid or expired OTP. Please try again.' },
        { status: 400 }
      );
    }

    // Update Firestore record to mark as verified (if exists)
    const otpCollection = collection(db, 'otpVerifications');
    const otpQuery = query(
      otpCollection,
      where('phoneNumber', '==', formattedPhone),
      where('verified', '==', false)
    );
    const otpDocs = await getDocs(otpQuery);

    // Update all unverified records for this phone number
    const updatePromises = otpDocs.docs.map(doc => 
      updateDoc(doc.ref, {
        verified: true,
        verifiedAt: Timestamp.now(),
      })
    );
    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error: any) {
    console.error('Error in verify-otp route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

