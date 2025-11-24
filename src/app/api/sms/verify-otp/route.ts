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

    // 🔧 DEVELOPMENT MODE: Check for dev OTP
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.env.NEXT_PUBLIC_DEV_MODE === 'true';
    
    const otpCollection = collection(db, 'otpVerifications');
    const otpQuery = query(
      otpCollection,
      where('phoneNumber', '==', formattedPhone),
      where('verified', '==', false)
    );
    const otpDocs = await getDocs(otpQuery);

    if (isDevelopment) {
      console.log('🔧 DEVELOPMENT MODE: Verifying OTP');
      console.log('📱 Phone:', formattedPhone);
      console.log('🔑 Entered OTP:', otp);
      
      // Check if dev OTP exists in Firestore
      const devOtpDoc = otpDocs.docs.find((doc: any) => doc.data().isDev === true);
      
      if (devOtpDoc) {
        const storedOtp = devOtpDoc.data().otp;
        console.log('✅ Found dev OTP:', storedOtp);
        
        if (otp === storedOtp) {
          // Mark as verified
          await updateDoc(devOtpDoc.ref, {
            verified: true,
            verifiedAt: Timestamp.now(),
          });
          
          return NextResponse.json({
            success: true,
            message: 'OTP verified successfully (DEV MODE)',
            devMode: true,
          });
        } else {
          return NextResponse.json(
            { success: false, error: 'Invalid OTP. Use 123456 in dev mode.' },
            { status: 400 }
          );
        }
      }
    }

    // 🚀 PRODUCTION MODE: Verify OTP via Wigal FROG API
    const verifyResult = await verifyOTP(formattedPhone, otp);

    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, error: verifyResult.error || 'Invalid or expired OTP. Please try again.' },
        { status: 400 }
      );
    }

    // Update all unverified records for this phone number
    const updatePromises = otpDocs.docs.map((doc: any) => 
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

