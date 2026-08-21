import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { adminAuth } from '@/lib/firebase-admin';
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

    // 🔧 DEVELOPMENT MODE: Check for dev OTP ONLY in localhost (NODE_ENV === 'development')
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const otpCollection = collection(db, 'otpVerifications');
    const otpQuery = query(
      otpCollection,
      where('phoneNumber', '==', formattedPhone),
      where('verified', '==', false)
    );
    const otpDocs = await getDocs(otpQuery);

    let isVerified = false;

    if (isDevelopment) {
      console.log('🔧 DEVELOPMENT MODE: Verifying OTP');
      console.log('📱 Phone:', formattedPhone);
      console.log('🔑 Entered OTP:', otp);
      
      const devOtpDoc = otpDocs.docs.find((doc: any) => doc.data().isDev === true);
      
      if (devOtpDoc) {
        const storedOtp = devOtpDoc.data().otp;
        if (otp === storedOtp || otp === '123456') {
          await updateDoc(devOtpDoc.ref, {
            verified: true,
            verifiedAt: Timestamp.now(),
          });
          isVerified = true;
        } else {
          return NextResponse.json(
            { success: false, error: 'Invalid OTP. Use 123456 in dev mode.' },
            { status: 400 }
          );
        }
      } else if (otp === '123456') {
        isVerified = true;
      }
    }

    if (!isVerified) {
      // 🚀 PRODUCTION MODE: Verify OTP via Wigal FROG API
      const verifyResult = await verifyOTP(formattedPhone, otp);

      if (!verifyResult.success) {
        return NextResponse.json(
          { success: false, error: verifyResult.error || 'Invalid or expired OTP. Please try again.' },
          { status: 400 }
        );
      }
      isVerified = true;
    }

    // Update all unverified records for this phone number
    const updatePromises = otpDocs.docs.map((doc: any) => 
      updateDoc(doc.ref, {
        verified: true,
        verifiedAt: Timestamp.now(),
      })
    );
    await Promise.all(updatePromises);

    // Find corresponding user in Firestore if they exist
    let customToken: string | null = null;
    let userProfile: any = null;

    try {
      const usersRef = collection(db, 'users');
      const userQ = query(usersRef, where('phoneNumber', '==', formattedPhone));
      const userSnap = await getDocs(userQ);

      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();
        userProfile = {
          uid: userDoc.id,
          email: userData.email,
          role: userData.role || 'student',
          fullName: userData.fullName || userData.firstName || 'User',
        };

        // Create Firebase custom auth token
        customToken = await adminAuth.createCustomToken(userDoc.id, {
          role: userData.role || 'student',
        });
      }
    } catch (authError) {
      console.error('Error generating custom token in verify-otp:', authError);
    }

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      customToken,
      user: userProfile,
    });
  } catch (error: any) {
    console.error('Error in verify-otp route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
