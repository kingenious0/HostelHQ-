/**
 * OneSignal Notification Service
 * Send push notifications using OneSignal REST API
 */

import { auth } from '@/lib/firebase';

interface SendNotificationParams {
  userId: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, any>;
}

/**
 * Send a push notification via OneSignal
 */
export async function sendNotification(params: SendNotificationParams) {
  try {
    console.log('[OneSignal] Sending notification:', {
      userId: params.userId,
      title: params.title,
      url: params.url,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined' && auth?.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }
      } catch (tokenErr) {
        console.warn('[OneSignal] Could not attach ID token to request headers:', tokenErr);
      }
    }

    const response = await fetch('/api/send-notification-onesignal', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    console.log('[OneSignal] Response status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('[OneSignal] API error:', error);
      throw new Error(error.error || 'Failed to send notification');
    }

    const result = await response.json();
    console.log('[OneSignal] Success:', result);
    return result;
  } catch (error) {
    console.error('[OneSignal] Error sending notification:', error);
    throw error;
  }
}

/**
 * Send notification when a booking is confirmed
 */
export async function notifyBookingConfirmed(userId: string, hostelName: string, bookingId: string) {
  return sendNotification({
    userId,
    title: '🎉 Booking Confirmed!',
    body: `Your booking at ${hostelName} has been confirmed. Check your bookings for details.`,
    url: `/my-bookings`,
    data: { type: 'booking-confirmed', bookingId },
  });
}

/**
 * Send notification when a visit is scheduled
 */
export async function notifyVisitScheduled(userId: string, hostelName: string, visitDate: string) {
  return sendNotification({
    userId,
    title: '📅 Visit Scheduled',
    body: `Your visit to ${hostelName} is scheduled for ${visitDate}. Don't forget!`,
    url: `/my-bookings`,
    data: { type: 'visit-scheduled' },
  });
}

/**
 * Send notification when a review is approved
 */
export async function notifyReviewApproved(userId: string, hostelName: string) {
  return sendNotification({
    userId,
    title: '✅ Review Approved',
    body: `Your review for ${hostelName} has been approved and is now live!`,
    url: `/hostels`,
    data: { type: 'review-approved' },
  });
}

/**
 * Send notification when a review is rejected
 */
export async function notifyReviewRejected(userId: string, hostelName: string) {
  return sendNotification({
    userId,
    title: '❌ Review Not Approved',
    body: `Your review for ${hostelName} was not approved. Please contact support if you have questions.`,
    url: `/student/dashboard`,
    data: { type: 'review-rejected' },
  });
}

/**
 * Send notification when payment is received
 */
export async function notifyPaymentReceived(userId: string, amount: number, hostelName: string) {
  return sendNotification({
    userId,
    title: '💰 Payment Received',
    body: `Your payment of GHS${amount.toLocaleString()} for ${hostelName} has been received.`,
    url: `/payments`,
    data: { type: 'payment-received' },
  });
}

/**
 * Send notification to manager when a room is secured in their hostel
 */
export async function notifyManagerNewBooking(managerId: string, hostelName: string, bookingId: string) {
  return sendNotification({
    userId: managerId,
    title: '🔔 New Room Secured',
    body: `A student just secured a room at ${hostelName}.`,
    url: `/manager/dashboard`,
    data: { type: 'manager-new-booking', bookingId },
  });
}

/**
 * Send notification to admin when a new booking is made on any hostel
 */
export async function notifyAdminNewBooking(adminId: string, hostelName: string, bookingId: string) {
  return sendNotification({
    userId: adminId,
    title: '🔔 New Hostel Booking',
    body: `A student just secured a room at ${hostelName}.`,
    url: `/admin/dashboard`,
    data: { type: 'admin-new-booking', bookingId },
  });
}

/**
 * Send notification to manager when a student requests a visit
 */
export async function notifyManagerVisitRequest(managerId: string, studentName: string, hostelName: string, visitId: string) {
  return sendNotification({
    userId: managerId,
    title: '👀 New Visit Request',
    body: `${studentName} requested an in-person tour of ${hostelName}.`,
    url: `/manager/dashboard`,
    data: { type: 'manager-visit-request', visitId },
  });
}

/**
 * Send notification to admin when new hostel is submitted
 */
export async function notifyAdminNewHostel(adminId: string, hostelName: string, submitterName: string) {
  return sendNotification({
    userId: adminId,
    title: '🏢 New Hostel Submission',
    body: `${submitterName} submitted ${hostelName} for approval`,
    url: `/admin/dashboard`,
    data: { type: 'admin-new-hostel' },
  });
}

/**
 * Send notification to admin when review is flagged
 */
export async function notifyAdminFlaggedReview(adminId: string, studentName: string, hostelName: string) {
  return sendNotification({
    userId: adminId,
    title: '⚠️ Review Flagged',
    body: `A review by ${studentName} for ${hostelName} has been flagged for profanity`,
    url: `/admin/reviews`,
    data: { type: 'admin-flagged-review' },
  });
}
