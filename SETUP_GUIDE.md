# HostelHQ Setup Guide

## Making the My Bookings Page Functional

The My Bookings page is currently showing "No confirmed bookings" because several configuration issues need to be resolved. Here's what needs to be done:

## 1. Environment Configuration

Create a `.env.local` file in the project root with the following variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Ably Configuration
ABLY_SERVER_KEY=your_ably_server_key

# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Paystack Configuration
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYSTACK_SECRET_KEY=your_paystack_secret_key

# Google Maps API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Mapbox API Key
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
```

## 2. Firebase Setup

1. **Create a Firebase Project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication and Firestore Database

2. **Configure Authentication:**
   - Enable Email/Password authentication
   - Add your domain to authorized domains

3. **Set up Firestore Database:**
   - Create the database in production mode
   - Set up the following collections structure:
     ```
     users/{userId}
     hostels/{hostelId}
     bookings/{bookingId}
     visits/{visitId}
     reviews/{reviewId}
     ```

4. **Get Firebase Configuration:**
   - Go to Project Settings > General > Your apps
   - Add a web app and copy the configuration values

## 3. Database Structure

The My Bookings page expects bookings to be stored in Firestore with this structure:

```javascript
// Collection: bookings
{
  studentId: "user_uid",
  studentDetails: {
    fullName: "Student Name",
    email: "student@email.com"
  },
  hostelId: "hostel_id",
  paymentReference: "payment_ref",
  bookingDate: Timestamp,
  status: "confirmed" | "pending" | "cancelled",
  roomNumber: "Room 101",
  roomType: "Standard"
}
```

## 4. Testing the Booking Flow

To test the complete booking flow:

1. **Create a test user account**
2. **Add some hostels to the database**
3. **Go through the booking process:**
   - Visit `/hostels/[id]/book`
   - Complete payment (or use test mode)
   - Check if booking appears in My Bookings

## 5. Common Issues Fixed

✅ **Avatar Import Error:** Fixed missing Avatar component imports
✅ **SearchParams Error:** Fixed async/await issue in home page
✅ **Ably Configuration:** Cleaned up Ably client initialization

## 6. Next Steps

1. Set up Firebase project and add credentials to `.env.local`
2. Create test data in Firestore
3. Test the complete booking flow
4. Verify bookings appear in My Bookings page

## 7. Debugging Tips

- Check browser console for Firebase connection errors
- Verify environment variables are loaded correctly
- Check Firestore security rules allow read/write access
- Ensure user authentication is working properly

The My Bookings page should now display bookings once you have:
- Proper Firebase configuration
- Test data in the database
- Completed booking transactions
