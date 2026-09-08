import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-guard';
import { createBookingAction } from '@/app/actions/db';

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (caller.role !== 'student') {
      return NextResponse.json(
        { error: '403 Forbidden: Only students can book hostels' },
        { status: 403 }
      );
    }

    const body = await req.json();
    body.studentId = caller.uid;

    const result = await createBookingAction(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create booking' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err: any) {
    console.error('Error in /api/bookings:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
