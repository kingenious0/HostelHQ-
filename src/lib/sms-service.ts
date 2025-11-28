import { db } from './firebase';
import { doc, getDoc, collection, getDocs, setDoc, query, where } from 'firebase/firestore';
import { sendSMS } from './wigal';

// Admin phone numbers (you can make this configurable)
const ADMIN_PHONE_NUMBERS = [
  '+233XXXXXXXXXX', // Replace with actual admin phone numbers
  // Add more admin numbers as needed
];

interface SMSNotificationData {
  to: string[];
  message: string;
  type: 'hostel_submission' | 'hostel_approval' | 'hostel_rejection' | 'urgent';
}

/**
 * Send SMS notification to admins about hostel submissions
 */
export async function sendAdminSMSNotification(data: SMSNotificationData) {
  try {
    console.log('📱 Sending SMS Notification via Wigal FROG:', {
      recipients: data.to,
      message: data.message,
      type: data.type,
      timestamp: new Date().toISOString()
    });

    // Send SMS using existing Wigal FROG system
    const results = [];
    for (const phoneNumber of data.to) {
      const result = await sendSMS(phoneNumber, data.message, `ADMIN${Date.now()}`);
      results.push({
        phone: phoneNumber,
        success: result.success,
        error: result.error
      });
    }

    // Store notification in database for tracking
    const notificationRef = doc(collection(db, 'sms_notifications'));
    await setDoc(notificationRef, {
      ...data,
      sentAt: new Date().toISOString(),
      status: 'sent',
      recipients: data.to,
      results: results
    });

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    if (failureCount === 0) {
      return { success: true, message: `SMS sent successfully to ${successCount} admin(s)` };
    } else if (successCount > 0) {
      return { success: true, message: `SMS sent to ${successCount} admin(s), failed to send to ${failureCount} admin(s)` };
    } else {
      return { success: false, error: 'Failed to send SMS to any admin' };
    }
  } catch (error) {
    console.error('Error sending SMS notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all admin users for SMS notifications
 */
export async function getAdminUsers() {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'admin'));
    const querySnapshot = await getDocs(q);
    
    const admins = [];
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.phone) {
        admins.push({
          id: doc.id,
          fullName: userData.fullName,
          email: userData.email,
          phone: userData.phone
        });
      }
    });
    
    return admins;
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return [];
  }
}

/**
 * Notify admins when a new hostel is submitted for approval
 */
export async function notifyAdminsOfNewHostelSubmission(hostelName: string, submittedBy: string) {
  const message = `🏠 HOSTELHQ: New hostel submission alert!
  
Hostel: ${hostelName}
Submitted by: ${submittedBy}
Action required: Please review and approve/reject in admin dashboard.

Login: https://hostel-hq.vercel.app/admin/dashboard`;

  const admins = await getAdminUsers();
  const adminPhones = admins.map(admin => admin.phone).filter(Boolean);

  if (adminPhones.length === 0) {
    console.warn('No admin phone numbers found for SMS notifications');
    return { success: false, message: 'No admin phone numbers available' };
  }

  return await sendAdminSMSNotification({
    to: adminPhones,
    message,
    type: 'hostel_submission'
  });
}

/**
 * Notify hostel creator about approval status
 */
export async function notifyCreatorOfHostelStatus(
  hostelName: string, 
  creatorPhone: string, 
  status: 'approved' | 'rejected',
  reason?: string
) {
  const statusText = status === 'approved' ? '✅ APPROVED' : '❌ REJECTED';
  const actionText = status === 'approved' ? 'is now live on the platform' : 'was not approved';
  
  let message = `🏠 HOSTELHQ: Your hostel status update
  
Hostel: ${hostelName}
Status: ${statusText}
Your hostel ${actionText}`;

  if (status === 'rejected' && reason) {
    message += `\n\nReason: ${reason}`;
  }

  if (status === 'approved') {
    message += `\n\nStudents can now book visits and secure rooms at your hostel!`;
  }

  return await sendAdminSMSNotification({
    to: [creatorPhone],
    message,
    type: status === 'approved' ? 'hostel_approval' : 'hostel_rejection'
  });
}
