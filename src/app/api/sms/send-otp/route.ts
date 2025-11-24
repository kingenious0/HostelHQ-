import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
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

    const formattedPhone = formatPhoneNumber(phoneNumber);

    // 🔧 DEVELOPMENT MODE: Bypass SMS in localhost
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.env.NEXT_PUBLIC_DEV_MODE === 'true';
    
    if (isDevelopment) {
      console.log('🔧 DEVELOPMENT MODE: Simulating OTP send');
      console.log('📱 Phone:', formattedPhone);
      console.log('🔑 Use OTP: 123456 (dev mode)');
      
      // Store a dev OTP in Firestore
      const otpCollection = collection(db, 'otpVerifications');
      
      // Delete existing OTPs for this phone
      const existingOTPQuery = query(
        otpCollection,
        where('phoneNumber', '==', formattedPhone),
        where('verified', '==', false)
      );
      const existingOTPs = await getDocs(existingOTPQuery);
      const deletePromises = existingOTPs.docs.map((doc: any) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Store dev OTP (always 123456 in dev mode)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      
      await addDoc(otpCollection, {
        phoneNumber: formattedPhone,
        otp: '123456', // Dev mode OTP
        expiresAt: Timestamp.fromDate(expiresAt),
        verified: false,
        createdAt: Timestamp.now(),
        length: 6,
        isDev: true,
      });
      
      return NextResponse.json({
        success: true,
        message: 'OTP sent successfully (DEV MODE - Use: 123456)',
        devMode: true,
      });
    }

    // 🚀 PRODUCTION MODE: Use real SMS API
    // Debug: Log environment variable status (without exposing values)
    const apiKeyValue = process.env.WIGAL_API_KEY || process.env.FROG_SMS_API_KEY;
    const usernameValue = process.env.WIGAL_USERNAME || process.env.FROG_SMS_USERNAME;
    const hasApiKey = !!apiKeyValue;
    const hasUsername = !!usernameValue;
    const apiKeyLength = apiKeyValue?.length || 0;
    const usernameLength = usernameValue?.length || 0;
    
    console.log('Environment Check in send-otp route:', {
      hasApiKey,
      hasUsername,
      apiKeyLength,
      usernameLength,
      apiUrl: process.env.WIGAL_API_URL || process.env.FROG_SMS_API_URL,
      senderId: process.env.WIGAL_SENDER_ID || process.env.FROG_SMS_SENDER_ID,
    });

    if (!hasApiKey || !hasUsername) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Wigal API credentials are not configured. Please check your .env.local file.',
          hint: `Missing: ${!hasApiKey ? 'WIGAL_API_KEY/FROG_SMS_API_KEY' : ''} ${!hasUsername ? 'WIGAL_USERNAME/FROG_SMS_USERNAME' : ''}`.trim(),
          debug: {
            hasApiKey,
            hasUsername,
            nodeEnv: process.env.NODE_ENV,
          }
        },
        { status: 500 }
      );
    }

    // Check for existing unexpired OTP
    const otpCollection = collection(db, 'otpVerifications');
    const existingOTPQuery = query(
      otpCollection,
      where('phoneNumber', '==', formattedPhone),
      where('verified', '==', false)
    );
    const existingOTPs = await getDocs(existingOTPQuery);

    // Delete existing unexpired OTPs for this phone number
    const deletePromises = existingOTPs.docs.map((doc: any) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Generate and send OTP via Wigal FROG API
    const expiryMinutes = 10;
    const otpLength = 6;
    const messageTemplate = `Your HostelHQ verification code is: %OTPCODE%. This code expires in %EXPIRY% minutes.`;

    const otpResult = await generateAndSendOTP(formattedPhone, {
      length: otpLength,
      expiry: expiryMinutes,
      type: 'NUMERIC',
      messageTemplate: messageTemplate,
    });

    if (!otpResult.success) {
      console.error('OTP generation failed:', otpResult.error);
      // Return appropriate status code based on error type
      const statusCode = otpResult.error?.includes('Authentication') || 
                        otpResult.error?.includes('credentials') ? 401 : 500;
      return NextResponse.json(
        { 
          success: false, 
          error: otpResult.error || 'Failed to send OTP',
          // Include helpful message for common issues
          hint: !(process.env.WIGAL_API_KEY || process.env.FROG_SMS_API_KEY) || !(process.env.WIGAL_USERNAME || process.env.FROG_SMS_USERNAME)
            ? 'Wigal API credentials are not configured. Please check your environment variables.'
            : undefined
        },
        { status: statusCode }
      );
    }

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    // Store OTP verification record in Firestore for tracking
    // Note: The actual OTP is managed by Wigal FROG API, but we store a record for tracking
    await addDoc(otpCollection, {
      phoneNumber: formattedPhone,
      expiresAt: Timestamp.fromDate(expiresAt),
      verified: false,
      createdAt: Timestamp.now(),
      length: otpLength,
    });

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error: any) {
    console.error('Error in send-otp route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

