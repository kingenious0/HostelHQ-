import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { sendSMS } from '@/lib/wigal';
import { dynamoCore, dynamoService } from '@/lib/dynamodb-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userId,
      fullName,
      email,
      phoneNumber,
      studentIdNumber,
      isFresher,
      faculty,
      departmentOrProgram,
      documentUrl,
      documentType,
    } = body;

    if (!userId || !studentIdNumber || !documentUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required verification fields (userId, studentIdNumber, documentUrl)' },
        { status: 400 }
      );
    }

    const cleanIdNumber = studentIdNumber.toString().trim();
    const isFresherBool = Boolean(isFresher);

    // 1. Structural Regex Format Check
    // Universal format: 7 to 12 alphanumeric characters for all USTED students
    const universalRegex = /^[a-zA-Z0-9\-_]{7,12}$/;
    const isValidFormat = universalRegex.test(cleanIdNumber);

    // 2. Anti-Fraud Duplicate Identifier Detection
    // Query existing verified student verifications or users
    let isDuplicate = false;
    let duplicateUserId = '';

    try {
      const verifSnap = await getDocs(
        query(
          collection(db, 'studentVerifications'),
          where('studentIdNumber', '==', cleanIdNumber)
        )
      );

      for (const docSnap of verifSnap.docs) {
        const vData = docSnap.data();
        if (vData.userId && vData.userId !== userId && (vData.status === 'verified' || vData.status === 'approved')) {
          isDuplicate = true;
          duplicateUserId = vData.userId;
          break;
        }
      }

      if (!isDuplicate) {
        const userSnap = await getDocs(
          query(
            collection(db, 'users'),
            where('studentIndexNumber', '==', cleanIdNumber)
          )
        );
        for (const docSnap of userSnap.docs) {
          if (docSnap.id !== userId && docSnap.data().verificationStatus === 'verified') {
            isDuplicate = true;
            duplicateUserId = docSnap.id;
            break;
          }
        }
      }
    } catch (dbErr) {
      console.warn('[Verify Engine] Anti-fraud check warning:', dbErr);
    }

    const verifId = `verif_${userId}`;
    const timestamp = new Date().toISOString();

    // 3. Decision Matrix: Auto-Approve or Flag for Dean/Admin Queue
    if (isValidFormat && !isDuplicate) {
      // ✅ APPROVED by Automated Rule Engine
      const userUpdates = {
        verificationStatus: 'verified',
        isVerified: true,
        autoApproved: true,
        isStudentIdVerified: true,
        studentIndexNumber: cleanIdNumber,
        studentId: cleanIdNumber,
        faculty: faculty || '',
        department: departmentOrProgram || '',
        verificationDocUrl: documentUrl,
        verificationDocType: documentType || 'student_id',
        isFresher: isFresherBool,
        verifiedAt: timestamp,
        updatedAt: timestamp,
      };

      await setDoc(doc(db, 'users', userId), userUpdates, { merge: true });

      const verifPayload = {
        id: verifId,
        userId,
        fullName: fullName || '',
        email: email || '',
        phone: phoneNumber || '',
        studentIdNumber: cleanIdNumber,
        isFresher: isFresherBool,
        faculty: faculty || '',
        departmentOrProgram: departmentOrProgram || '',
        institution: 'University of Skills Training and Entrepreneurial Development (USTED)',
        studentIdCardUrl: documentType === 'student_id' ? documentUrl : '',
        admissionLetterUrl: documentType === 'admission_letter' ? documentUrl : '',
        documentUrl,
        documentType: documentType || 'student_id',
        status: 'verified',
        autoVerified: true,
        submittedAt: timestamp,
        reviewedAt: timestamp,
        reviewedBy: 'USTED Automated Verification Engine',
      };

      await setDoc(doc(db, 'studentVerifications', verifId), verifPayload, { merge: true });

      // Dual-write to DynamoDB (Non-blocking fire-and-forget)
      if (dynamoCore.isDynamoConfigured()) {
        Promise.all([
          dynamoService.saveStudentVerification(verifPayload),
          dynamoService.updateUser(userId, userUpdates),
        ]).catch((dynErr) => {
          console.warn('[Verify Engine] DynamoDB sync note:', dynErr);
        });
      }

      // Dispatch Approval SMS to student (Non-blocking fire-and-forget)
      if (phoneNumber) {
        const idLabel = isFresherBool ? 'Applicant Number' : 'Index Number';
        const smsMessage = `HOSTELHQ: USTED Student Verification Approved\n\nStudent Name: ${fullName || 'Student'}\n${idLabel}: ${cleanIdNumber}\nStatus: Verified\n\nYour account is active for instant booking. Explore approved hostels: https://hostel-hq.vercel.app/my-bookings`;
        sendSMS(phoneNumber, smsMessage).catch((smsErr) => {
          console.warn('[Verify Engine] Approval SMS dispatch note:', smsErr);
        });
      }

      return NextResponse.json({
        success: true,
        status: 'verified',
        autoApproved: true,
        message: 'Account verified successfully via USTED automated engine.',
      });
    } else {
      // ⚠️ FLAGGED for Manual Dean/Admin Spot Inspection
      const flagReason = isDuplicate
        ? 'Duplicate student identifier detected across verified database.'
        : `Identifier format failed USTED pattern requirements (7-12 characters required).`;

      const userUpdates = {
        verificationStatus: 'pending',
        isVerified: false,
        autoApproved: false,
        flaggedException: true,
        flagReason,
        studentIndexNumber: cleanIdNumber,
        studentId: cleanIdNumber,
        faculty: faculty || '',
        department: departmentOrProgram || '',
        verificationDocUrl: documentUrl,
        verificationDocType: documentType || 'student_id',
        isFresher: isFresherBool,
        updatedAt: timestamp,
      };

      await setDoc(doc(db, 'users', userId), userUpdates, { merge: true });

      const verifPayload = {
        id: verifId,
        userId,
        fullName: fullName || '',
        email: email || '',
        phone: phoneNumber || '',
        studentIdNumber: cleanIdNumber,
        isFresher: isFresherBool,
        faculty: faculty || '',
        departmentOrProgram: departmentOrProgram || '',
        institution: 'University of Skills Training and Entrepreneurial Development (USTED)',
        studentIdCardUrl: documentType === 'student_id' ? documentUrl : '',
        admissionLetterUrl: documentType === 'admission_letter' ? documentUrl : '',
        documentUrl,
        documentType: documentType || 'student_id',
        status: 'pending',
        autoVerified: false,
        flaggedException: true,
        flagReason,
        submittedAt: timestamp,
      };

      await setDoc(doc(db, 'studentVerifications', verifId), verifPayload, { merge: true });

      // Dual-write to DynamoDB (Non-blocking)
      if (dynamoCore.isDynamoConfigured()) {
        Promise.all([
          dynamoService.saveStudentVerification(verifPayload),
          dynamoService.updateUser(userId, userUpdates),
        ]).catch((dynErr) => {
          console.warn('[Verify Engine] DynamoDB exception queue note:', dynErr);
        });
      }

      // Notify student of pending review (Non-blocking)
      if (phoneNumber) {
        const smsMessage = `HostelHQ: Your registration and credentials have been received! The Dean of Students is reviewing your submission. You will receive an SMS once verified.`;
        sendSMS(phoneNumber, smsMessage).catch((smsErr) => {
          console.warn('[Verify Engine] Flagged SMS dispatch note:', smsErr);
        });
      }

      return NextResponse.json({
        success: true,
        status: 'pending',
        autoApproved: false,
        flaggedException: true,
        reason: flagReason,
        message: 'Submission queued for Dean of Students review.',
      });
    }
  } catch (err: any) {
    console.error('[Verify Engine] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal verification engine failure' },
      { status: 500 }
    );
  }
}
