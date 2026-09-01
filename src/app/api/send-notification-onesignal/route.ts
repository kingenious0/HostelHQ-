import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { requireAuth } from '@/lib/auth-guard';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

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
    const caller = await requireAuth(request);
    const body: NotificationRequest = await request.json();
    const { userId, title, body: message, url, data } = body;

    if (!userId || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, title, body' },
        { status: 400 }
      );
    }

    const isSelf = caller.uid === userId;
    const isStaffCaller = ['admin', 'manager', 'dean', 'coordinator', 'executive'].includes(caller.role || '');

    // Transactional events that regular users/students are permitted to trigger to managers or admins
    const allowedTransactionalTypes = [
      'manager-new-booking',
      'admin-new-booking',
      'manager-visit-request',
      'admin-flagged-review',
      'admin-new-hostel',
      'booking-confirmed',
      'visit-scheduled',
      'payment-received',
      'visit_status',
    ];

    const isTransactionalEvent = Boolean(data?.type && allowedTransactionalTypes.includes(data.type));

    let isAuthorized = isSelf || isStaffCaller || isTransactionalEvent;

    // Fallback: Check if recipient is a staff member (manager, admin, dean)
    if (!isAuthorized) {
      try {
        if (isFirebaseAdminConfigured()) {
          const recipientDoc = await adminDb.collection('users').doc(userId).get();
          const recipientRole = recipientDoc.data()?.role;
          if (['admin', 'manager', 'dean', 'coordinator', 'executive'].includes(recipientRole || '')) {
            isAuthorized = true;
          }
        } else {
          const recipientDoc = await getDoc(doc(db, 'users', userId));
          const recipientRole = recipientDoc.data()?.role;
          if (['admin', 'manager', 'dean', 'coordinator', 'executive'].includes(recipientRole || '')) {
            isAuthorized = true;
          }
        }
      } catch (err) {
        console.warn('[OneSignal] Recipient role verification note:', err);
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to send notifications to this user.' },
        { status: 403 }
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
    let notificationId: string = '';
    try {
      if (isFirebaseAdminConfigured()) {
        const notifRef = await adminDb
          .collection('users')
          .doc(userId)
          .collection('notifications')
          .add({
            title,
            body: message,
            url: url || '/',
            data: data || {},
            read: false,
            createdAt: new Date().toISOString(),
          });
        notificationId = notifRef.id;
      } else {
        const notifRef = await addDoc(
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
        notificationId = notifRef.id;
      }
    } catch (fsErr) {
      console.warn('[OneSignal] Could not save notification to Firestore:', fsErr);
    }

    return NextResponse.json({
      success: true,
      notificationId,
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
