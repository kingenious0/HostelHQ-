import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAdminAuth, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, phoneNumber, studentIdNumber } = body;

    // 1. Check Email
    if (email && typeof email === 'string' && email.trim()) {
      const cleanEmail = email.toLowerCase().trim();

      // Check Firebase Admin Auth if configured
      if (isFirebaseAdminConfigured()) {
        try {
          const adminAuth = getAdminAuth();
          if (adminAuth) {
            const userRecord = await adminAuth.getUserByEmail(cleanEmail);
            if (userRecord) {
              return NextResponse.json({
                exists: true,
                field: 'email',
                message: 'This email is already registered. Please sign in instead.',
              });
            }
          }
        } catch (authErr: any) {
          // 'auth/user-not-found' means email does not exist in Firebase Auth, which is expected
          if (authErr.code !== 'auth/user-not-found') {
            console.warn('[check-exists] Firebase Admin Auth error:', authErr);
          }
        }
      }

      // Check Firestore users collection by email
      try {
        const emailSnap = await getDocs(
          query(collection(db, 'users'), where('email', '==', cleanEmail))
        );
        if (!emailSnap.empty) {
          return NextResponse.json({
            exists: true,
            field: 'email',
            message: 'This email is already registered. Please sign in instead.',
          });
        }

        // Check institutionalEmail field
        const instEmailSnap = await getDocs(
          query(collection(db, 'users'), where('institutionalEmail', '==', cleanEmail))
        );
        if (!instEmailSnap.empty) {
          return NextResponse.json({
            exists: true,
            field: 'email',
            message: 'This email is already registered. Please sign in instead.',
          });
        }
      } catch (fsErr) {
        console.warn('[check-exists] Firestore email check error:', fsErr);
      }
    }

    // 2. Check Phone Number (Sandbox Dev Bypass support)
    const IS_DEV_MODE = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ALLOW_DUPLICATE_PHONE === "true";

    if (!IS_DEV_MODE && phoneNumber && typeof phoneNumber === 'string' && phoneNumber.trim()) {
      const cleanPhone = phoneNumber.trim();

      // Check Firebase Admin Auth for phone if configured
      if (isFirebaseAdminConfigured()) {
        try {
          const adminAuth = getAdminAuth();
          if (adminAuth) {
            const userRecord = await adminAuth.getUserByPhoneNumber(cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`);
            if (userRecord) {
              return NextResponse.json({
                exists: true,
                field: 'phoneNumber',
                message: 'This phone number is already registered. Please sign in instead.',
              });
            }
          }
        } catch (phoneAuthErr: any) {
          if (phoneAuthErr.code !== 'auth/user-not-found') {
            // expected if not found
          }
        }
      }

      // Check Firestore users collection by phoneNumber
      try {
        const phoneSnap = await getDocs(
          query(collection(db, 'users'), where('phoneNumber', '==', cleanPhone))
        );
        if (!phoneSnap.empty) {
          return NextResponse.json({
            exists: true,
            field: 'phoneNumber',
            message: 'This phone number is already registered. Please sign in instead.',
          });
        }

        // Also check 'phone' field
        const pSnap = await getDocs(
          query(collection(db, 'users'), where('phone', '==', cleanPhone))
        );
        if (!pSnap.empty) {
          return NextResponse.json({
            exists: true,
            field: 'phoneNumber',
            message: 'This phone number is already registered. Please sign in instead.',
          });
        }
      } catch (fsPhoneErr) {
        console.warn('[check-exists] Firestore phone check error:', fsPhoneErr);
      }
    }

    // 3. Check Student ID / Index Number
    if (studentIdNumber && typeof studentIdNumber === 'string' && studentIdNumber.trim()) {
      const cleanId = studentIdNumber.trim();
      try {
        const idSnap = await getDocs(
          query(collection(db, 'users'), where('studentIndexNumber', '==', cleanId))
        );
        if (!idSnap.empty) {
          return NextResponse.json({
            exists: true,
            field: 'studentIdNumber',
            message: 'This student index / applicant number is already registered.',
          });
        }

        const verifSnap = await getDocs(
          query(collection(db, 'studentVerifications'), where('studentIdNumber', '==', cleanId))
        );
        if (!verifSnap.empty) {
          return NextResponse.json({
            exists: true,
            field: 'studentIdNumber',
            message: 'This student index / applicant number is already registered.',
          });
        }
      } catch (idErr) {
        console.warn('[check-exists] Student ID check error:', idErr);
      }
    }

    // Account identifiers do not exist
    return NextResponse.json({ exists: false });
  } catch (error: any) {
    console.error('[check-exists] Handler error:', error);
    return NextResponse.json(
      { exists: false, error: error.message || 'Internal check failed' },
      { status: 200 } // Return 200 so UI is not completely blocked on transient network errors
    );
  }
}
