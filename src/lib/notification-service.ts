/**
 * Notification Service
 * Helper functions to send push notifications for various events
 */

interface SendNotificationParams {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push notification to a user
 */
export async function sendNotification(params: SendNotificationParams) {
  try {
    console.log('[NotificationService] Sending notification:', {
      userId: params.userId,
      title: params.title,
      url: params.url,
    });

    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    console.log('[NotificationService] Response status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('[NotificationService] API error:', error);
      throw new Error(error.error || 'Failed to send notification');
    }

    const result = await response.json();
    console.log('[NotificationService] Success:', result);
    return result;
  } catch (error) {
    console.error('[NotificationService] Error sending notification:', error);
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
    url: `/student/my-bookings`,
    tag: 'booking-confirmed',
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
    url: `/student/visits`,
    tag: 'visit-scheduled',
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
    tag: 'review-approved',
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
    tag: 'review-rejected',
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
    tag: 'payment-received',
  });
}

/**
 * Send notification to agent when new booking is made
 */
export async function notifyAgentNewBooking(agentId: string, studentName: string, hostelName: string) {
  return sendNotification({
    userId: agentId,
    title: '🔔 New Booking',
    body: `${studentName} just booked a room at ${hostelName}`,
    url: `/agent/bookings`,
    tag: 'agent-new-booking',
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
    tag: 'admin-new-hostel',
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
    tag: 'admin-flagged-review',
  });
}
