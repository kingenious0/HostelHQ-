import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
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

    // Normalize phone to match storage format (try both 233 and local format)
    let cleaned = phoneNumber.replace(/\D/g, '');
    let searchNumbers = [cleaned];

    if (cleaned.startsWith('0') && cleaned.length === 10) {
      const local = cleaned.substring(1);
      searchNumbers.push(local);
      searchNumbers.push('233' + local);
    } else if (cleaned.startsWith('233') && cleaned.length === 12) {
      const local = cleaned.substring(3);
      searchNumbers.push(local);
      searchNumbers.push('0' + local);
    } else if (cleaned.length === 9) {
      searchNumbers.push('0' + cleaned);
      searchNumbers.push('233' + cleaned);
    }

    // Find user by phone number - try all possible formats in both field and document ID
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phoneNumber', 'in', searchNumbers));
    let snap = await getDocs(q);

    let userData: any = null;
    let userId: string = '';

    if (!snap.empty) {
      userData = snap.docs[0].data();
      userId = snap.docs[0].id;
    } else {
      // If not found as a field, try checking if the phone number is the document ID
      for (const num of searchNumbers) {
        const docRef = doc(db, 'users', num);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          userData = docSnap.data();
          userId = docSnap.id;
          break;
        }
      }
    }

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'No account found with this phone number' },
        { status: 404 }
      );
    }

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
