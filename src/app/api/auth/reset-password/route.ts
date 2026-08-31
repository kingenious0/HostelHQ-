import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { verifyPasswordResetToken } from '@/lib/auth-tokens';

export async function POST(req: NextRequest) {
  try {
    const { userId, newPassword, resetToken } = await req.json();

    if (!userId || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'User ID and new password are required' },
        { status: 400 }
      );
    }

    if (!resetToken) {
      return NextResponse.json(
        { success: false, error: 'Authorization error: Password reset token is missing' },
        { status: 401 }
      );
    }

    // Cryptographically verify that the resetToken is valid, unexpired, and issued for this user
    const tokenVerification = verifyPasswordResetToken(resetToken, userId);
    if (!tokenVerification.valid) {
      return NextResponse.json(
        { success: false, error: tokenVerification.error || 'Invalid or expired password reset token. Please request a new OTP.' },
        { status: 403 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Update password using Firebase Admin SDK
    await adminAuth.updateUser(userId, {
      password: newPassword,
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    console.error('Error in reset-password route:', error);
    
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset password' },
      { status: 500 }
    );
  }
}
