import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';

export const dynamic = 'force-dynamic';

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload: NotificationPayload = await request.json();
    
    const { userId, title, body, url, icon, tag } = payload;

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, title, body' },
        { status: 400 }
      );
    }

    // Persist notification in Firestore so the app can show a history / unread badge
    const notificationRef = await adminDb
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .add({
        title,
        body,
        url: url || '/',
        icon: icon || null,
        tag: tag || 'hostelhq-notification',
        createdAt: new Date().toISOString(),
        read: false,
      });

    // Get all FCM tokens for this user
    const tokensSnapshot = await adminDb
      .collection('users')
      .doc(userId)
      .collection('fcmTokens')
      .get();

    const tokens = tokensSnapshot.empty
      ? []
      : tokensSnapshot.docs.map(d => d.data().token as string);

    let successCount = 0;
    let failureCount = 0;

    if (tokens.length > 0) {
      // Prepare the message to send via FCM
      const message = {
        notification: {
          title,
          body,
          ...(icon && { icon }),
        },
        data: {
          url: url || '/',
          tag: tag || 'hostelhq-notification',
          notificationId: notificationRef.id,
        },
        tokens,
      };

      const messaging = getMessaging();
      const response = await messaging.sendEachForMulticast(message);
      successCount = response.successCount;
      failureCount = response.failureCount;

      console.log(`Successfully sent ${response.successCount} notifications to user ${userId}`);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const tokensToDelete: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
            if (
              resp.error?.code === 'messaging/invalid-registration-token' ||
              resp.error?.code === 'messaging/registration-token-not-registered'
            ) {
              tokensToDelete.push(tokens[idx]);
            }
          }
        });

        if (tokensToDelete.length > 0) {
          await Promise.all(
            tokensToDelete.map(token =>
              adminDb
                .collection('users')
                .doc(userId)
                .collection('fcmTokens')
                .doc(token)
                .delete()
            )
          );
          console.log(`Deleted ${tokensToDelete.length} invalid tokens`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      notificationId: notificationRef.id,
    });
  } catch (error: any) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}

// Helper function to send notifications (can be imported and used elsewhere)
export async function sendPushNotification(payload: NotificationPayload) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send notification: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling send-notification API:', error);
    throw error;
  }
}
