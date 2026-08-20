import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const aggregateReviews = functions.firestore
  .document('reviews/{reviewId}')
  .onCreate(async (snapshot, context) => {
    const reviewData = snapshot.data();
    const hostelId = reviewData.hostelId;
    const newRating = reviewData.rating;

    if (!hostelId || typeof newRating !== 'number') {
      console.log("Missing hostelId or rating, skipping aggregation.");
      return null;
    }

    const hostelRef = db.collection('hostels').doc(hostelId);

    try {
      const reviewsQuerySnapshot = await db.collection('reviews')
        .where('hostelId', '==', hostelId)
        .get();

      let totalRating = 0;
      reviewsQuerySnapshot.forEach(doc => {
        totalRating += doc.data().rating;
      });

      const numberOfReviews = reviewsQuerySnapshot.size;
      const averageRating = numberOfReviews > 0 ? totalRating / numberOfReviews : 0;

      await hostelRef.update({
        rating: averageRating,
        numberOfReviews: numberOfReviews,
      });

      console.log(`Aggregated ratings for hostel ${hostelId}: Average ${averageRating}, ${numberOfReviews} reviews.`);
      return null;
    } catch (error) {
      console.error("Error aggregating reviews:", error);
      return null;
    }
  });
