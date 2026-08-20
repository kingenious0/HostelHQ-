import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

interface NotificationRequest {
  userId: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const body: NotificationRequest = await request.json();
    const { userId, title, body: message, url, data } = body;

    if (!userId || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, title, body' },
        { status: 400 }
      );
    }

    const appId = process.env.ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!appId || !apiKey) {
      console.error('[OneSignal] Missing environment variables');
      return NextResponse.json(
        { error: 'OneSignal not configured' },
        { status: 500 }
      );
    }

    // Send push notification via OneSignal REST API
    const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_external_user_ids: [userId],
        headings: { en: title },
        contents: { en: message },
        url: url || '/',
        data: data || {},
      }),
    });

    const oneSignalResult = await oneSignalResponse.json();

    if (!oneSignalResponse.ok) {
      console.error('[OneSignal] API error:', oneSignalResult);
      return NextResponse.json(
        { error: 'Failed to send notification', details: oneSignalResult },
        { status: 500 }
      );
    }

    console.log('[OneSignal] Notification sent:', oneSignalResult);

    // Store notification in Firestore for notification bell
    const notificationRef = await addDoc(
      collection(db, 'users', userId, 'notifications'),
      {
        title,
        body: message,
        url: url || '/',
        data: data || {},
        read: false,
        createdAt: serverTimestamp(),
      }
    );

    return NextResponse.json({
      success: true,
      notificationId: notificationRef.id,
      oneSignalId: oneSignalResult.id,
      recipients: oneSignalResult.recipients || 0,
    });
  } catch (error: any) {
    console.error('[OneSignal] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
