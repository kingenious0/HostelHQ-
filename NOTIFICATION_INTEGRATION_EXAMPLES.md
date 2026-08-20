# 🔔 Notification Integration Examples

Quick copy-paste examples for integrating push notifications into HostelHQ.

---

## 📍 Where to Add Notifications

### 1. **Booking Confirmation** 
**File:** `src/app/hostels/[id]/secure/page.tsx`

```typescript
import { notifyBookingConfirmed } from '@/lib/notification-service';

// After successful booking (around line 200-250)
try {
  // ... existing booking code ...
  
  // Send push notification
  await notifyBookingConfirmed(
    currentUser.uid,
    hostelData.name,
    bookingRef.id
  ).catch(err => console.error('Failed to send notification:', err));
  
  toast({
    title: "Booking Confirmed!",
    description: "Your room has been secured successfully.",
  });
} catch (error) {
  // ... error handling ...
}
```

---

### 2. **Review Approval (Admin)**
**File:** `src/app/admin/reviews/page.tsx`

```typescript
import { notifyReviewApproved } from '@/lib/notification-service';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const handleApprove = async (review: Review) => {
  if (!currentUser) return;
  setProcessingId(review.id);
  toast({ title: "Approving review..." });

  try {
    await updateDoc(doc(db, "reviews", review.id), {
      status: "approved",
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser.uid,
    });

    // Get hostel name
    const hostelDoc = await getDoc(doc(db, "hostels", review.hostelId));
    const hostelName = hostelDoc.exists() ? hostelDoc.data().name : "the hostel";

    // Send notification to student
    await notifyReviewApproved(
      review.studentId,
      hostelName
    ).catch(err => console.error('Failed to send notification:', err));

    toast({
      title: "Review Approved",
      description: "The review is now live on the hostel page.",
    });
  } catch (error) {
    console.error("Error approving review:", error);
    toast({
      title: "Approval failed",
      description: "Could not approve this review. Please try again.",
      variant: "destructive",
    });
  } finally {
    setProcessingId(null);
  }
};
```

---

### 3. **Flagged Review Alert (Admin)**
**File:** `src/app/hostels/[id]/book/rating/page.tsx`

```typescript
import { notifyAdminFlaggedReview } from '@/lib/notification-service';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Inside handleSubmit, after saving flagged review
if (hasBadWords) {
  // Get all admin users
  const adminsQuery = query(
    collection(db, 'users'),
    where('role', '==', 'admin')
  );
  const adminsSnapshot = await getDocs(adminsQuery);
  
  // Get hostel name
  const hostelDoc = await getDoc(doc(db, 'hostels', hostelId));
  const hostelName = hostelDoc.exists() ? hostelDoc.data().name : 'Unknown Hostel';
  
  // Notify all admins
  const notificationPromises = adminsSnapshot.docs.map(adminDoc => 
    notifyAdminFlaggedReview(
      adminDoc.id,
      currentUser.displayName || 'A student',
      hostelName
    ).catch(err => console.error('Failed to notify admin:', err))
  );
  
  await Promise.all(notificationPromises);
  
  toast({
    title: "Review Submitted for Review",
    description: "Your review contains content that requires admin approval.",
  });
}
```

---

### 4. **Payment Received**
**File:** `src/app/api/payment-webhook/route.ts` (or wherever you handle payment confirmations)

```typescript
import { notifyPaymentReceived } from '@/lib/notification-service';

// After payment is confirmed
export async function POST(request: NextRequest) {
  try {
    const paymentData = await request.json();
    
    // ... verify payment ...
    
    if (paymentData.status === 'success') {
      // Get booking details
      const bookingDoc = await getDoc(doc(adminDb, 'bookings', paymentData.bookingId));
      const booking = bookingDoc.data();
      
      // Get hostel name
      const hostelDoc = await getDoc(doc(adminDb, 'hostels', booking.hostelId));
      const hostelName = hostelDoc.data()?.name || 'your hostel';
      
      // Send notification
      await notifyPaymentReceived(
        booking.studentId,
        paymentData.amount,
        hostelName
      ).catch(err => console.error('Failed to send notification:', err));
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Payment webhook error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

---

### 5. **Visit Scheduled**
**File:** `src/app/hostels/[id]/book/page.tsx` (or wherever visits are booked)

```typescript
import { notifyVisitScheduled } from '@/lib/notification-service';
import { format } from 'date-fns';

// After visit is scheduled
const handleScheduleVisit = async () => {
  try {
    // ... create visit in Firestore ...
    
    const visitRef = await addDoc(collection(db, 'visits'), {
      hostelId,
      studentId: currentUser.uid,
      visitDate: selectedDate,
      // ... other fields ...
    });
    
    // Format date for notification
    const formattedDate = format(new Date(selectedDate), 'MMMM d, yyyy');
    
    // Send notification
    await notifyVisitScheduled(
      currentUser.uid,
      hostelData.name,
      formattedDate
    ).catch(err => console.error('Failed to send notification:', err));
    
    toast({
      title: "Visit Scheduled!",
      description: `Your visit is set for ${formattedDate}`,
    });
  } catch (error) {
    console.error('Error scheduling visit:', error);
  }
};
```

---

### 6. **New Booking Alert (Agent)**
**File:** `src/app/hostels/[id]/secure/page.tsx`

```typescript
import { notifyAgentNewBooking } from '@/lib/notification-service';

// After booking is created
try {
  // ... create booking ...
  
  // Get agent ID from hostel
  const hostelDoc = await getDoc(doc(db, 'hostels', hostelId));
  const agentId = hostelDoc.data()?.agentId;
  
  if (agentId) {
    await notifyAgentNewBooking(
      agentId,
      currentUser.displayName || 'A student',
      hostelData.name
    ).catch(err => console.error('Failed to notify agent:', err));
  }
} catch (error) {
  console.error('Booking error:', error);
}
```

---

### 7. **New Hostel Submission (Admin)**
**File:** `src/app/manager/dashboard/page.tsx` or `src/app/agent/upload/page.tsx`

```typescript
import { notifyAdminNewHostel } from '@/lib/notification-service';
import { collection, query, where, getDocs } from 'firebase/firestore';

// After hostel is submitted
const handleSubmitHostel = async () => {
  try {
    // ... submit hostel to pendingHostels ...
    
    // Get all admins
    const adminsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'admin')
    );
    const adminsSnapshot = await getDocs(adminsQuery);
    
    // Notify all admins
    const notificationPromises = adminsSnapshot.docs.map(adminDoc =>
      notifyAdminNewHostel(
        adminDoc.id,
        hostelData.name,
        currentUser.displayName || 'A manager'
      ).catch(err => console.error('Failed to notify admin:', err))
    );
    
    await Promise.all(notificationPromises);
    
    toast({
      title: "Hostel Submitted!",
      description: "Your hostel is pending admin approval.",
    });
  } catch (error) {
    console.error('Submit error:', error);
  }
};
```

---

## 🎯 Best Practices

1. **Always use `.catch()`** on notification calls to prevent blocking the main flow
2. **Don't await** if notification failure shouldn't stop the process
3. **Log errors** for debugging but don't show to users
4. **Batch notifications** when sending to multiple users (use `Promise.all()`)
5. **Check user exists** before sending notifications

---

## 🧪 Testing

### Test Single Notification
```typescript
import { sendNotification } from '@/lib/notification-service';

// In browser console or test file
await sendNotification({
  userId: "YOUR_USER_ID_HERE",
  title: "Test Notification",
  body: "This is a test message",
  url: "/",
  tag: "test"
});
```

### Check if User Has Notifications Enabled
```typescript
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const checkUserTokens = async (userId: string) => {
  const tokensSnapshot = await getDocs(
    collection(db, 'users', userId, 'fcmTokens')
  );
  console.log(`User has ${tokensSnapshot.size} device(s) with notifications enabled`);
  tokensSnapshot.forEach(doc => {
    console.log('Token:', doc.id);
    console.log('Data:', doc.data());
  });
};
```

---

## 🔧 Troubleshooting

### Notification Not Received?
1. Check browser console for errors
2. Verify VAPID key is set in `.env.local`
3. Check if user has enabled notifications (FCM token exists in Firestore)
4. Check Firebase Console → Cloud Messaging → Reports for delivery status

### Permission Denied?
- User must manually enable in browser settings
- Guide them to: `chrome://settings/content/notifications`

---

**Remember:** Notifications are a nice-to-have feature. Always ensure the core functionality works even if notifications fail! 🎯
