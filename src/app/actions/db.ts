"use server";

import * as dynamoService from "@/lib/dynamodb-service";
import * as dynamoCore from "@/lib/dynamodb";
import type { Hostel, AppUser, Visit, Review, RoomType } from "@/lib/data";
import { db } from "@/lib/firebase";
import { adminDb, isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";

// ============================================================================
// Hostel Server Actions
// ============================================================================

export async function fetchHostelsAction(options: {
  featured?: boolean;
  search?: string;
  location?: string;
} = {}) {
  try {
    const hostels = await dynamoService.listHostels({
      featuredOnly: options.featured,
      search: options.search,
      location: options.location,
    });
    return { success: true, data: hostels };
  } catch (error: any) {
    console.error("fetchHostelsAction error:", error);
    return { success: false, error: error.message || "Failed to fetch hostels" };
  }
}

export async function fetchHostelByIdAction(hostelId: string) {
  try {
    const hostel = await dynamoService.getHostelById(hostelId);
    return { success: true, data: hostel };
  } catch (error: any) {
    console.error("fetchHostelByIdAction error:", error);
    return { success: false, error: error.message || "Failed to fetch hostel" };
  }
}

export async function saveHostelAction(hostelData: Omit<Hostel, "reviews"> & { id?: string }, isPending: boolean = false) {
  try {
    const caller = await requireRole(["manager", "admin"]);
    if (caller.role === "manager") {
      (hostelData as any).managerId = caller.uid;
    }
    const saved = await dynamoService.saveHostel(hostelData, isPending);
    return { success: true, data: saved };
  } catch (error: any) {
    console.error("saveHostelAction error:", error);
    return { success: false, error: error.message || "Failed to save hostel" };
  }
}

export async function updateHostelAction(hostelId: string, updates: Partial<Hostel>, isPending: boolean = false) {
  try {
    const caller = await requireAuth();
    const isExecutiveOrAdmin = ["admin", "executive", "pro_vc", "vc", "dean", "coordinator"].includes(caller.role);
    if (!isExecutiveOrAdmin) {
      const existing = await dynamoService.getHostelById(hostelId);
      if (!existing || existing.managerId !== caller.uid) {
        throw new Error("Unauthorized: You do not have permission to update this hostel.");
      }
    }
    const updated = await dynamoService.updateHostel(hostelId, updates, isPending);
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("updateHostelAction error:", error);
    return { success: false, error: error.message || "Failed to update hostel" };
  }
}

export async function deleteHostelAction(hostelId: string, isPending: boolean = false) {
  try {
    const caller = await requireAuth();
    if (caller.role !== "admin") {
      const existing = await dynamoService.getHostelById(hostelId);
      if (!existing || existing.managerId !== caller.uid) {
        throw new Error("Unauthorized: You do not have permission to delete this hostel.");
      }
    }
    await dynamoService.deleteHostel(hostelId, isPending);
    return { success: true };
  } catch (error: any) {
    console.error("deleteHostelAction error:", error);
    return { success: false, error: error.message || "Failed to delete hostel" };
  }
}

/**
 * Dynamic Occupancy Aggregation Pipeline
 * Calculates real-time confirmed/active tenant bookings for a specific hostel ID.
 */
export async function fetchHostelOccupancyAction(hostelId: string): Promise<{
  success: boolean;
  occupancy: number;
  error?: string;
}> {
  try {
    if (!hostelId) {
      return { success: false, error: "Hostel ID is required", occupancy: 0 };
    }

    let totalOccupancy = 0;

    // 1. Primary Query: Firebase Admin Firestore
    if (isFirebaseAdminConfigured()) {
      try {
        const bookingsSnapshot = await adminDb
          .collection("bookings")
          .where("hostelId", "==", hostelId)
          .where("status", "in", ["confirmed", "active", "completed"])
          .get();

        totalOccupancy = bookingsSnapshot.size;
        return { success: true, occupancy: totalOccupancy };
      } catch (err: any) {
        console.warn("adminDb IN query failed, trying flexible filter:", err);
        try {
          const snapshot = await adminDb
            .collection("bookings")
            .where("hostelId", "==", hostelId)
            .get();

          totalOccupancy = snapshot.docs.filter((docSnap) => {
            const data = docSnap.data();
            const status = (data.status || "").toLowerCase();
            return ["confirmed", "active", "completed"].includes(status) || data.paymentStatus === "successful";
          }).length;

          return { success: true, occupancy: totalOccupancy };
        } catch (subErr) {
          console.warn("adminDb fallback query note:", subErr);
        }
      }
    }

    // 2. Secondary Query: Client SDK Firestore
    try {
      const q = query(
        collection(db, "bookings"),
        where("hostelId", "==", hostelId),
        where("status", "in", ["confirmed", "active", "completed"])
      );
      const snap = await getDocs(q);
      totalOccupancy = snap.size;
      return { success: true, occupancy: totalOccupancy };
    } catch (fsErr) {
      console.warn("Firestore client bookings query fallback note:", fsErr);
    }

    // 3. Tertiary Query: DynamoDB if configured
    if (dynamoCore.isDynamoConfigured()) {
      try {
        const dBookings = await dynamoService.listBookingsByHostel(hostelId);
        totalOccupancy = (dBookings || []).filter((b: any) => {
          const status = (b.status || "").toLowerCase();
          return ["confirmed", "active", "completed"].includes(status) || b.paymentStatus === "successful";
        }).length;
        return { success: true, occupancy: totalOccupancy };
      } catch (dErr) {
        console.warn("DynamoDB bookings query note:", dErr);
      }
    }

    return { success: true, occupancy: totalOccupancy };
  } catch (error: any) {
    console.error("fetchHostelOccupancyAction error:", error);
    return { success: false, error: error.message || "Failed to calculate occupancy", occupancy: 0 };
  }
}

/**
 * Bulk Occupancy Aggregation Pipeline
 * Calculates real-time confirmed/active tenant bookings across all hostels.
 */
export async function fetchHostelOccupanciesAction(hostelIds?: string[]): Promise<{
  success: boolean;
  occupancies: Record<string, number>;
  error?: string;
}> {
  try {
    const occupancies: Record<string, number> = {};
    if (hostelIds && hostelIds.length > 0) {
      hostelIds.forEach((id) => (occupancies[id] = 0));
    }

    let processed = false;

    // 1. Firebase Admin
    if (isFirebaseAdminConfigured()) {
      try {
        const bookingsSnapshot = await adminDb
          .collection("bookings")
          .where("status", "in", ["confirmed", "active", "completed"])
          .get();

        bookingsSnapshot.docs.forEach((docSnap: any) => {
          const data = docSnap.data();
          const hId = data.hostelId;
          if (hId && (!hostelIds || hostelIds.includes(hId))) {
            const beds = Number(data.assignedBeds || data.bedsCount || data.bedCount) || 1;
            occupancies[hId] = (occupancies[hId] || 0) + beds;
          }
        });
        processed = true;
      } catch (adminErr) {
        console.warn("adminDb bulk occupancy fetch note:", adminErr);
      }
    }

    // 2. Client Firestore
    if (!processed) {
      try {
        const q = query(
          collection(db, "bookings"),
          where("status", "in", ["confirmed", "active", "completed"])
        );
        const snap = await getDocs(q);
        snap.docs.forEach((d: any) => {
          const data = d.data();
          const hId = data.hostelId;
          if (hId && (!hostelIds || hostelIds.includes(hId))) {
            const beds = Number(data.assignedBeds || data.bedsCount || data.bedCount) || 1;
            occupancies[hId] = (occupancies[hId] || 0) + beds;
          }
        });
        processed = true;
      } catch (fsErr) {
        console.warn("Firestore client bulk bookings query note:", fsErr);
      }
    }

    // 3. DynamoDB
    if (!processed && dynamoCore.isDynamoConfigured()) {
      try {
        const allBookings = await dynamoCore.scanEntities<any>({ entityType: "BOOKING" });
        (allBookings || []).forEach((b: any) => {
          const hId = b.hostelId;
          const status = (b.status || "").toLowerCase();
          const isValid = ["confirmed", "active", "completed"].includes(status) || b.paymentStatus === "successful";
          if (isValid && hId && (!hostelIds || hostelIds.includes(hId))) {
            const beds = Number(b.assignedBeds || b.bedsCount || b.bedCount) || 1;
            occupancies[hId] = (occupancies[hId] || 0) + beds;
          }
        });
        processed = true;
      } catch (dErr) {
        console.warn("DynamoDB bulk bookings note:", dErr);
      }
    }

    return { success: true, occupancies };
  } catch (error: any) {
    console.error("fetchHostelOccupanciesAction error:", error);
    return { success: false, error: error.message || "Failed to fetch occupancies", occupancies: {} };
  }
}

// ============================================================================
// User Server Actions
// ============================================================================

export async function fetchUserAction(userId: string) {
  try {
    const user = await dynamoService.getUserById(userId);
    return { success: true, data: user };
  } catch (error: any) {
    console.error("fetchUserAction error:", error);
    return { success: false, error: error.message || "Failed to fetch user" };
  }
}

export async function fetchUsersByRoleAction(role: string) {
  try {
    await requireRole(["admin", "dean", "coordinator", "executive"]);
    const users = await dynamoService.listUsersByRole(role as any);
    return { success: true, data: users };
  } catch (error: any) {
    console.error("fetchUsersByRoleAction error:", error);
    return { success: false, error: error.message || "Failed to fetch users" };
  }
}

export async function saveUserAction(user: AppUser) {
  try {
    const caller = await requireAuth();
    if (caller.uid !== user.id && caller.role !== "admin") {
      throw new Error("Unauthorized: You can only update your own user profile.");
    }
    // Prevent non-admins from self-escalating roles
    if (caller.role !== "admin" && user.role && user.role !== caller.role) {
      user.role = caller.role as any;
    }
    const saved = await dynamoService.saveUser(user);
    return { success: true, data: saved };
  } catch (error: any) {
    console.error("saveUserAction error:", error);
    return { success: false, error: error.message || "Failed to save user" };
  }
}

// ============================================================================
// Booking Server Actions
// ============================================================================

export async function fetchBookingByIdAction(bookingId: string) {
  try {
    const booking = await dynamoService.getBookingById(bookingId);
    return { success: true, data: booking };
  } catch (error: any) {
    console.error("fetchBookingByIdAction error:", error);
    return { success: false, error: error.message || "Failed to fetch booking" };
  }
}

export async function fetchBookingsByStudentAction(studentId: string) {
  try {
    const caller = await requireAuth();
    if (caller.uid !== studentId && !["admin", "manager", "dean", "coordinator"].includes(caller.role || "")) {
      throw new Error("Unauthorized: You can only view your own bookings.");
    }
    const bookings = await dynamoService.listBookingsByStudent(studentId);
    return { success: true, data: bookings };
  } catch (error: any) {
    console.error("fetchBookingsByStudentAction error:", error);
    return { success: false, error: error.message || "Failed to fetch student bookings" };
  }
}

export async function fetchBookingsByHostelAction(hostelId: string) {
  try {
    const caller = await requireRole(["manager", "admin", "dean", "coordinator", "executive"]);
    if (caller.role === "manager") {
      const hostel = await dynamoService.getHostelById(hostelId);
      if (hostel && hostel.managerId && hostel.managerId !== caller.uid) {
        throw new Error("Unauthorized: You can only view bookings for your own hostels.");
      }
    }
    const bookings = await dynamoService.listBookingsByHostel(hostelId);
    return { success: true, data: bookings };
  } catch (error: any) {
    console.error("fetchBookingsByHostelAction error:", error);
    return { success: false, error: error.message || "Failed to fetch hostel bookings" };
  }
}

export async function createBookingAction(bookingData: any) {
  try {
    const caller = await requireAuth();
    if (caller.role !== 'student') {
      throw new Error("Forbidden: Only students can book hostels.");
    }
    if (bookingData.studentId && caller.uid !== bookingData.studentId && caller.role !== "admin") {
      throw new Error("Unauthorized: You can only create bookings for yourself.");
    }
    bookingData.studentId = caller.uid;

    if (bookingData.hostelId) {
      const hostel = await dynamoService.getHostelById(bookingData.hostelId);
      if (hostel) {
        if (hostel.availability === 'Full' || hostel.status === 'sold-out') {
          throw new Error("Booking rejected: This hostel has reached 100% capacity and is fully booked.");
        }
        if (bookingData.roomTypeId && hostel.roomTypes && hostel.roomTypes.length > 0) {
          const roomType = hostel.roomTypes.find((rt) => String(rt.id) === String(bookingData.roomTypeId));
          if (roomType) {
            const capacity = Number(roomType.capacity) || 1;
            const numRooms = Number(roomType.numberOfRooms) || 1;
            const totalCap = Number(roomType.totalCapacity) || (capacity * numRooms);
            const occ = Number(roomType.occupancy) || 0;
            if (
              roomType.status === 'sold-out' ||
              roomType.availability === 'Full' ||
              (totalCap > 0 && occ >= totalCap)
            ) {
              throw new Error("Booking rejected: This room type has reached 100% capacity and is sold out.");
            }
          }
        }
      }
    }

    const booking = await dynamoService.saveBooking(bookingData);
    return { success: true, data: booking };
  } catch (error: any) {
    console.error("createBookingAction error:", error);
    return { success: false, error: error.message || "Failed to create booking" };
  }
}

export async function updateBookingStatusAction(bookingId: string, status: string) {
  try {
    const caller = await requireAuth();
    const existing = await dynamoService.getBookingById(bookingId);
    if (!existing) {
      throw new Error("Booking not found");
    }
    if (
      caller.role !== "admin" &&
      caller.uid !== existing.studentId &&
      !["manager", "dean", "coordinator"].includes(caller.role || "")
    ) {
      throw new Error("Unauthorized: You cannot modify this booking.");
    }
    const updated = await dynamoService.updateBookingStatus(bookingId, status);
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("updateBookingStatusAction error:", error);
    return { success: false, error: error.message || "Failed to update booking status" };
  }
}

// ============================================================================
// Visit Server Actions
// ============================================================================

export async function fetchVisitByIdAction(visitId: string) {
  try {
    const visit = await dynamoService.getVisitById(visitId);
    return { success: true, data: visit };
  } catch (error: any) {
    console.error("fetchVisitByIdAction error:", error);
    return { success: false, error: error.message || "Failed to fetch visit" };
  }
}

export async function fetchVisitsByStudentAction(studentId: string) {
  try {
    const caller = await requireAuth();
    if (caller.uid !== studentId && caller.role !== "admin") {
      throw new Error("Unauthorized: You can only view your own visits.");
    }
    const visits = await dynamoService.listVisitsByStudent(studentId);
    return { success: true, data: visits };
  } catch (error: any) {
    console.error("fetchVisitsByStudentAction error:", error);
    return { success: false, error: error.message || "Failed to fetch student visits" };
  }
}

export async function fetchVisitsByManagerAction(managerId: string) {
  try {
    const caller = await requireAuth();
    if (caller.uid !== managerId && caller.role !== "admin") {
      throw new Error("Unauthorized: You can only view visits for your hostels.");
    }
    const visits = await dynamoService.listVisitsByManager(managerId);
    return { success: true, data: visits };
  } catch (error: any) {
    console.error("fetchVisitsByManagerAction error:", error);
    return { success: false, error: error.message || "Failed to fetch manager visits" };
  }
}

export async function fetchVisitsByHostelAction(hostelId: string) {
  try {
    const caller = await requireRole(["manager", "admin", "dean", "coordinator"]);
    if (caller.role === "manager") {
      const hostel = await dynamoService.getHostelById(hostelId);
      if (hostel && hostel.managerId && hostel.managerId !== caller.uid) {
        throw new Error("Unauthorized: You can only view visits for your own hostel.");
      }
    }
    const visits = await dynamoService.listVisitsByHostel(hostelId);
    return { success: true, data: visits };
  } catch (error: any) {
    console.error("fetchVisitsByHostelAction error:", error);
    return { success: false, error: error.message || "Failed to fetch hostel visits" };
  }
}

export async function createVisitAction(visitData: any) {
  try {
    const caller = await requireAuth();
    if (caller.role !== 'student') {
      return {
        success: false,
        error: "Forbidden: Only students can request visits."
      };
    }
    visitData.studentId = caller.uid;

    if (visitData.hostelId) {
      const hostel = await dynamoService.getHostelById(visitData.hostelId);
      if (hostel) {
        if (hostel.availability === 'Full' || hostel.status === 'sold-out') {
          return {
            success: false,
            error: "Physical visits are locked: This property has reached 100% capacity and is fully booked."
          };
        }
        if (visitData.roomTypeId && hostel.roomTypes && hostel.roomTypes.length > 0) {
          const roomType = hostel.roomTypes.find((rt) => String(rt.id) === String(visitData.roomTypeId));
          if (roomType) {
            const capacity = Number(roomType.capacity) || 1;
            const numRooms = Number(roomType.numberOfRooms) || 1;
            const totalCap = Number(roomType.totalCapacity) || (capacity * numRooms);
            const occ = Number(roomType.occupancy) || 0;
            if (
              roomType.status === 'sold-out' ||
              roomType.availability === 'Full' ||
              (totalCap > 0 && occ >= totalCap)
            ) {
              return {
                success: false,
                error: "Physical visits are locked: The requested room type is at 100% capacity and sold out."
              };
            }
          }
        }
      }
    }

    const visit = await dynamoService.saveVisit(visitData);
    return { success: true, data: visit };
  } catch (error: any) {
    console.error("createVisitAction error:", error);
    return { success: false, error: error.message || "Failed to create visit" };
  }
}

export async function updateVisitStatusAction(visitId: string, status: string) {
  try {
    await requireRole(["manager", "admin"]);
    const updated = await dynamoService.updateVisitStatus(visitId, status);
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("updateVisitStatusAction error:", error);
    return { success: false, error: error.message || "Failed to update visit status" };
  }
}

// ============================================================================
// Review Server Actions
// ============================================================================

export async function fetchReviewsByHostelAction(hostelId: string) {
  try {
    const reviews = await dynamoService.getApprovedReviewsByHostelId(hostelId);
    return { success: true, data: reviews };
  } catch (error: any) {
    console.error("fetchReviewsByHostelAction error:", error);
    return { success: false, error: error.message || "Failed to fetch reviews" };
  }
}

export async function fetchPendingReviewsAction() {
  try {
    await requireRole(["admin"]);
    const reviews = await dynamoService.listPendingReviews();
    return { success: true, data: reviews };
  } catch (error: any) {
    console.error("fetchPendingReviewsAction error:", error);
    return { success: false, error: error.message || "Failed to fetch pending reviews" };
  }
}

export async function createReviewAction(reviewData: any) {
  try {
    const caller = await requireAuth();
    if (caller.role !== 'student') {
      return {
        success: false,
        error: "Forbidden: Only students can submit reviews."
      };
    }
    reviewData.userId = caller.uid;
    reviewData.status = "pending"; // force pending verification
    const review = await dynamoService.saveReview(reviewData);
    return { success: true, data: review };
  } catch (error: any) {
    console.error("createReviewAction error:", error);
    return { success: false, error: error.message || "Failed to submit review" };
  }
}

export async function updateReviewStatusAction(reviewId: string, status: "approved" | "pending") {
  try {
    await requireRole(["admin"]);
    const updated = await dynamoService.updateReviewStatus(reviewId, status);
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("updateReviewStatusAction error:", error);
    return { success: false, error: error.message || "Failed to update review status" };
  }
}

// ============================================================================
// Administrative Server Actions (Dean, Coordinator, Executive)
// ============================================================================

export async function fetchPendingHostelsAction() {
  try {
    await requireRole(["admin", "dean", "coordinator", "executive", "pro_vc", "vc"]);
    const data = await dynamoService.listPendingHostels();
    return { success: true, data };
  } catch (error: any) {
    console.error("fetchPendingHostelsAction error:", error);
    return { success: false, error: error.message || "Failed to fetch pending hostels" };
  }
}

export async function approvePendingHostelAction(hostelId: string, approvedBy?: string) {
  try {
    const caller = await requireRole(["admin", "dean", "coordinator"]);
    const reviewer = approvedBy || caller.displayName || caller.email || caller.uid;
    const data = await dynamoService.approvePendingHostel(hostelId, reviewer);
    return { success: true, data };
  } catch (error: any) {
    console.error("approvePendingHostelAction error:", error);
    return { success: false, error: error.message || "Failed to approve hostel" };
  }
}

export async function rejectPendingHostelAction(hostelId: string, reason?: string) {
  try {
    await requireRole(["admin", "dean", "coordinator"]);
    const data = await dynamoService.rejectPendingHostel(hostelId, reason);
    return { success: true, data };
  } catch (error: any) {
    console.error("rejectPendingHostelAction error:", error);
    return { success: false, error: error.message || "Failed to reject hostel" };
  }
}

export async function fetchComplaintsAction(filter?: {
  status?: string;
  direction?: string;
  hostelId?: string;
  managerId?: string;
}) {
  try {
    const caller = await requireAuth();
    let data: any[] = [];
    if (dynamoCore.isDynamoConfigured()) {
      try {
        data = await dynamoService.listComplaints(filter);
      } catch (dynamoErr) {
        console.warn("dynamoService.listComplaints error, falling back to Firestore:", dynamoErr);
      }
    }

    // If DynamoDB is not configured or returned no records, fall back to Firestore
    if (!data || data.length === 0) {
      try {
        const compCol = collection(db, "complaints");
        const snap = await getDocs(compCol);
        data = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      } catch (fsErr) {
        console.warn("Firestore fetch complaints fallback note:", fsErr);
      }
    }

    // Role-based filtering to prevent data leakage between users
    if (caller.role === "student") {
      data = data.filter((c: any) => c.submittedBy === caller.uid || c.studentId === caller.uid);
    } else if (caller.role === "manager") {
      data = data.filter((c: any) => c.managerId === caller.uid || c.submittedBy === caller.uid);
    }

    // Apply explicit filters if needed
    if (filter?.status) {
      data = data.filter((c: any) => c.status === filter.status);
    }
    if (filter?.direction) {
      data = data.filter((c: any) => c.direction === filter.direction);
    }
    if (filter?.hostelId) {
      data = data.filter((c: any) => c.hostelId === filter.hostelId);
    }
    if (filter?.managerId) {
      data = data.filter((c: any) => c.managerId === filter.managerId);
    }

    // Sort descending by createdAt
    data.sort((a: any, b: any) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("fetchComplaintsAction error:", error);
    return { success: false, data: [], error: error.message || "Failed to fetch complaints" };
  }
}

export async function submitComplaintAction(complaintData: any) {
  try {
    const caller = await requireAuth();
    const complaintId = complaintData.id || `complaint_${Date.now()}`;
    const payload = {
      ...complaintData,
      id: complaintId,
      submittedBy: caller.uid, // enforce authenticated caller as author
      status: complaintData.status || "Submitted",
      createdAt: complaintData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Dual-write to Firestore
    try {
      await setDoc(doc(db, "complaints", complaintId), payload, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore complaints write note:", fsErr);
    }

    // 2. Dual-write to DynamoDB if configured
    let saved = payload;
    if (dynamoCore.isDynamoConfigured()) {
      try {
        saved = await dynamoService.saveComplaint(payload);
      } catch (dynamoErr) {
        console.warn("DynamoDB saveComplaint note:", dynamoErr);
      }
    }

    return { success: true, data: saved };
  } catch (error: any) {
    console.error("submitComplaintAction error:", error);
    return { success: false, error: error.message || "Failed to submit complaint" };
  }
}

export async function updateComplaintStatusAction(
  complaintId: string,
  status: any,
  notes?: string,
  resolvedBy?: string
) {
  try {
    const caller = await requireRole(["manager", "dean", "coordinator", "admin"]);
    const reviewer = resolvedBy || caller.displayName || caller.email || caller.uid;
    const updates: Record<string, any> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (notes) updates.resolutionNotes = notes;
    if (status === "Resolved") {
      updates.resolvedAt = new Date().toISOString();
      updates.resolvedBy = reviewer;
    }

    // 1. Dual-write to Firestore
    try {
      await updateDoc(doc(db, "complaints", complaintId), updates);
    } catch (fsErr) {
      console.warn("Firestore update complaint note:", fsErr);
    }

    // 2. Dual-write to DynamoDB if configured
    if (dynamoCore.isDynamoConfigured()) {
      try {
        await dynamoService.updateComplaintStatus(complaintId, status, notes, reviewer);
      } catch (dynamoErr) {
        console.warn("DynamoDB updateComplaintStatus note:", dynamoErr);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("updateComplaintStatusAction error:", error);
    return { success: false, error: error.message || "Failed to update complaint status" };
  }
}

export async function fetchStudentVerificationsAction(status?: string) {
  try {
    await requireRole(["admin", "dean", "coordinator"]);
    let data: any[] = [];
    if (dynamoCore.isDynamoConfigured()) {
      try {
        data = await dynamoService.listStudentVerifications(status);
      } catch (dynamoErr) {
        console.warn("dynamoService.listStudentVerifications error, falling back to Firestore:", dynamoErr);
      }
    }

    // If DynamoDB is not configured or returned no records, fall back to Firestore
    if (!data || data.length === 0) {
      try {
        const verifCol = collection(db, "studentVerifications");
        try {
          const q = status
            ? query(verifCol, where("status", "==", status))
            : query(verifCol, orderBy("submittedAt", "desc"));
          const snap = await getDocs(q);
          data = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        } catch {
          // In case index for orderBy isn't ready
          const snap = await getDocs(verifCol);
          data = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          if (status) {
            data = data.filter((v: any) => v.status === status);
          }
        }
      } catch (fsErr) {
        console.warn("Firestore fetch studentVerifications fallback note:", fsErr);
      }
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("fetchStudentVerificationsAction error:", error);
    return { success: false, data: [], error: error.message || "Failed to fetch student verifications" };
  }
}

export async function submitStudentVerificationAction(data: any) {
  try {
    const caller = await requireAuth();
    const verifId = data.id || `verif_${Date.now()}`;
    const payload = {
      ...data,
      id: verifId,
      userId: caller.uid, // enforce authenticated user ID
      status: "pending", // enforce pending status on submission
      submittedAt: data.submittedAt || new Date().toISOString(),
    };

    // 1. Dual-write to Firestore
    try {
      await setDoc(doc(db, "studentVerifications", verifId), payload, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore studentVerifications write note:", fsErr);
    }

    // 2. Dual-write to DynamoDB if configured
    let saved = payload;
    if (dynamoCore.isDynamoConfigured()) {
      try {
        saved = await dynamoService.saveStudentVerification(payload);
      } catch (dynamoErr) {
        console.warn("DynamoDB saveStudentVerification error:", dynamoErr);
      }
    }

    return { success: true, data: saved };
  } catch (error: any) {
    console.error("submitStudentVerificationAction error:", error);
    return { success: false, error: error.message || "Failed to submit student verification" };
  }
}

export async function updateStudentVerificationStatusAction(
  verificationId: string,
  status: "verified" | "rejected",
  reason?: string,
  reviewedBy?: string,
  studentPhoneNumber?: string,
  studentName?: string
) {
  try {
    const caller = await requireRole(["admin", "dean", "coordinator"]);
    const reviewer = reviewedBy || caller.displayName || caller.email || caller.uid;
    const updates: Record<string, any> = {
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewer,
    };
    if (reason) updates.rejectionReason = reason;

    // Dual-write: Firestore
    try {
      await updateDoc(doc(db, "studentVerifications", verificationId), updates);
    } catch (fsErr) {
      console.warn("Firestore updateStudentVerificationStatus error:", fsErr);
    }

    // Dual-write: DynamoDB
    let data = null;
    if (dynamoCore.isDynamoConfigured()) {
      try {
        data = await dynamoService.updateStudentVerificationStatus(verificationId, status, reason, reviewer);
      } catch (dynamoErr) {
        console.warn("DynamoDB updateStudentVerificationStatus error:", dynamoErr);
      }
    }

    // Dispatch SMS notification to student
    if (studentPhoneNumber) {
      try {
        const { sendSMS } = await import("@/lib/wigal");
        const greeting = studentName ? `Hi ${studentName},` : "Dear Student,";
        const smsMessage =
          status === "verified"
            ? `${greeting} Your student verification on HostelHQ has been APPROVED by the Administration. You can now log in and book accredited hostels.`
            : `${greeting} Your student verification on HostelHQ was not approved by the Administration.${reason ? ` Reason: ${reason}.` : ""} Please log in to review and re-upload your credentials.`;
        await sendSMS(studentPhoneNumber, smsMessage);
      } catch (smsErr) {
        console.warn("SMS dispatch error during student verification update:", smsErr);
      }
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("updateStudentVerificationStatusAction error:", error);
    return { success: false, error: error.message || "Failed to update verification status" };
  }
}


export async function updateRoomPendingPriceAction(
  hostelId: string,
  roomId: string,
  pendingPrice: number
) {
  try {
    const caller = await requireRole(["manager", "admin"]);
    if (caller.role === "manager") {
      const hostel = await dynamoService.getHostelById(hostelId);
      if (!hostel || hostel.managerId !== caller.uid) {
        throw new Error("Unauthorized: You can only update room prices for your own hostels.");
      }
    }
    const data = await dynamoService.updateRoomPendingPrice(hostelId, roomId, pendingPrice);
    return { success: true, data };
  } catch (error: any) {
    console.error("updateRoomPendingPriceAction error:", error);
    return { success: false, error: error.message || "Failed to set room pending price" };
  }
}

export async function fetchExecutiveMetricsAction() {
  try {
    await requireRole(["admin", "executive", "pro_vc", "vc", "dean", "coordinator"]);
    
    // 1. Fetch Hostels (DynamoDB with Firestore fallback)
    let hostels: any[] = [];
    if (dynamoCore.isDynamoConfigured()) {
      try {
        hostels = await dynamoService.listHostels();
      } catch (err) {
        console.warn("dynamoService.listHostels note in exec metrics:", err);
      }
    }
    if (!hostels || hostels.length === 0) {
      try {
        const snap = await getDocs(collection(db, "hostels"));
        hostels = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      } catch (fsErr) {
        console.warn("Firestore hostels fallback in exec metrics:", fsErr);
      }
    }

    // 2. Fetch Pending Hostels
    let pendingHostels: any[] = [];
    if (dynamoCore.isDynamoConfigured()) {
      try {
        pendingHostels = await dynamoService.listPendingHostels();
      } catch (err) {
        console.warn("dynamoService.listPendingHostels note in exec metrics:", err);
      }
    }
    const pendingReviews = (pendingHostels?.length || 0) + hostels.filter((h: any) => h.status === "pending" || h.accreditationStatus === "pending").length;

    // 3. Fetch Bookings
    let bookings: any[] = [];
    if (dynamoCore.isDynamoConfigured()) {
      try {
        bookings = await dynamoCore.scanEntities<any>({ entityType: "BOOKING" });
      } catch (err) {
        console.warn("dynamo bookings scan note in exec metrics:", err);
      }
    }
    if (!bookings || bookings.length === 0) {
      try {
        const snap = await getDocs(collection(db, "bookings"));
        bookings = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      } catch (fsErr) {
        console.warn("Firestore bookings fallback in exec metrics:", fsErr);
      }
    }

    // 4. Fetch Complaints
    let complaints: any[] = [];
    if (dynamoCore.isDynamoConfigured()) {
      try {
        complaints = await dynamoService.listComplaints();
      } catch (err) {
        console.warn("dynamoService.listComplaints note in exec metrics:", err);
      }
    }
    if (!complaints || complaints.length === 0) {
      try {
        const snap = await getDocs(collection(db, "complaints"));
        complaints = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      } catch (fsErr) {
        console.warn("Firestore complaints fallback in exec metrics:", fsErr);
      }
    }

    // 5. Fetch Student Verifications
    let verifications: any[] = [];
    if (dynamoCore.isDynamoConfigured()) {
      try {
        verifications = await dynamoService.listStudentVerifications();
      } catch (err) {
        console.warn("dynamo verifications note in exec metrics:", err);
      }
    }
    if (!verifications || verifications.length === 0) {
      try {
        const snap = await getDocs(query(collection(db, "users"), where("verificationStatus", "in", ["verified", "pending"])));
        verifications = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      } catch (fsErr) {
        console.warn("Firestore users verifications fallback in exec metrics:", fsErr);
      }
    }

    const totalHostels = hostels.length;
    const verifiedHostels = hostels.filter((h: any) => (h.status === "approved" || h.verified) && h.status !== "revoked").length;
    const activeSanctions = hostels.filter((h: any) => 
      h.sanctionStatus === "sanctioned" || 
      h.accreditationStatus === "Executive Sanction" || 
      h.accreditationStatus === "sanctioned" || 
      h.status === "revoked" ||
      h.sanctionStatus === "revoked"
    ).length;

    // Sum off-campus beds strictly from roomTypes
    const totalOffCampusBeds = hostels.filter((h: any) => h.verified && h.status !== "revoked").reduce((acc: number, h: any) => {
      const roomCapacity = (h.roomTypes || []).reduce((rAcc: number, rt: any) => {
        return rAcc + (rt.numberOfRooms || 1) * (rt.capacity || 1);
      }, 0);
      return acc + roomCapacity;
    }, 0);

    const accommodatedStudents = bookings.filter((b: any) => 
      b.status === "confirmed" || b.status === "completed" || b.status === "paid" || b.status === "active"
    ).length;

    const totalComplaints = complaints.length;
    const resolvedComplaints = complaints.filter((c: any) => c.status === "Resolved" || c.status === "closed").length;
    const underReviewComplaints = complaints.filter((c: any) => c.status === "Under Review" || c.status === "arbitration").length;
    const submittedComplaints = complaints.filter((c: any) => c.status === "Submitted" || c.status === "pending").length;

    // Complaint categories aggregation with standard category normalization
    const categoryCounts: Record<string, number> = {};
    const zoneCounts: Record<string, number> = {
      "Ayeduase": 0,
      "Kotei": 0,
      "Amassoma": 0,
      "Campus Environs": 0,
    };

    const hostelLocationMap: Record<string, string> = {};
    hostels.forEach((h: any) => {
      if (h.id && h.location) {
        hostelLocationMap[h.id] = h.location;
        const cleanId = String(h.id).replace(/^HOSTEL#/i, "").trim();
        hostelLocationMap[cleanId] = h.location;
      }
    });

    complaints.forEach((c: any) => {
      let cat = c.category || "General Inquiries";
      if (/maintenance|repair|water|sanitation|facility|utility/i.test(cat)) {
        cat = "Facilities & Utilities";
      } else if (/price|tariff|overcharg|fee|rent/i.test(cat)) {
        cat = "Rent & Tariff Overpricing";
      } else if (/security|safety|theft|break/i.test(cat)) {
        cat = "Security & Access";
      } else if (/noise|disturbance|conduct|policy|quiet/i.test(cat)) {
        cat = "Conduct & Quiet Hours";
      }
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      const loc = (c.hostelId ? hostelLocationMap[c.hostelId] : "") || c.hostelName || c.location || "";
      if (/ayeduase/i.test(loc)) zoneCounts["Ayeduase"] = (zoneCounts["Ayeduase"] || 0) + 1;
      else if (/kotei/i.test(loc)) zoneCounts["Kotei"] = (zoneCounts["Kotei"] || 0) + 1;
      else if (/amassoma/i.test(loc)) zoneCounts["Amassoma"] = (zoneCounts["Amassoma"] || 0) + 1;
      else zoneCounts["Campus Environs"] = (zoneCounts["Campus Environs"] || 0) + 1;
    });

    const categoryBreakdown = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count,
      percentage: totalComplaints > 0 ? Math.round((count / totalComplaints) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    const zoneBreakdown = Object.entries(zoneCounts).map(([zone, count]) => ({
      zone,
      count,
      percentage: totalComplaints > 0 ? Math.round((count / totalComplaints) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    // Complaint directions
    const studentToHostelCount = complaints.filter((c: any) => c.direction === "student_to_hostel" || (!c.direction && c.studentId)).length;
    const managerToStudentCount = complaints.filter((c: any) => c.direction === "manager_to_student" || (!c.direction && !c.studentId && c.managerId)).length;

    // Verification rate
    const totalVerifications = verifications.length;
    const approvedVerifications = verifications.filter((v: any) => v.status === "verified" || v.verificationStatus === "verified").length;
    const pendingVerifications = verifications.filter((v: any) => v.status === "pending" || v.verificationStatus === "pending").length;

    return {
      success: true,
      data: {
        summary: {
          totalHostels,
          verifiedHostels,
          pendingReviews,
          activeSanctions,
          totalOffCampusBeds,
          accommodatedStudents,
          totalComplaints,
          resolvedComplaints,
          underReviewComplaints,
          submittedComplaints,
          resolutionRate: totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 100,
          totalVerifications,
          approvedVerifications,
          pendingVerifications,
          verificationRate: totalVerifications > 0 ? Math.round((approvedVerifications / totalVerifications) * 100) : 0,
        },
        categoryBreakdown,
        zoneBreakdown,
        directionBreakdown: {
          studentToHostel: studentToHostelCount,
          managerToStudent: managerToStudentCount,
        },
      },
    };
  } catch (error: any) {
    console.error("fetchExecutiveMetricsAction error:", error);
    return { success: false, error: error.message || "Failed to fetch executive metrics" };
  }
}

// ============================================================================
// Visit Management Server Actions
// ============================================================================

/**
 * Server Action for Hostel Managers to decline a student visit request
 */
export async function declineVisitRequestAction(payload: {
  visitId: string;
  reason?: string;
}) {
  try {
    const caller = await requireRole(["manager", "admin"]);
    const { visitId, reason } = payload;
    if (!visitId) {
      return { success: false, error: "Visit ID is required" };
    }

    const visitRef = doc(db, "visits", visitId);
    const visitSnap = await getDoc(visitRef);
    if (!visitSnap.exists()) {
      return { success: false, error: "Visit request not found" };
    }
    const visitData = visitSnap.data();

    // Verify manager authorization if caller is manager
    if (caller.role === "manager" && visitData.managerId && visitData.managerId !== caller.uid) {
      const hostelSnap = await getDoc(doc(db, "hostels", visitData.hostelId));
      if (hostelSnap.exists() && hostelSnap.data().managerId !== caller.uid) {
        return { success: false, error: "Unauthorized to decline this visit request" };
      }
    }

    const declineReasonText = reason?.trim() || "Hostel manager declined the inspection request";

    await updateDoc(visitRef, {
      status: "declined",
      declineReason: declineReasonText,
      updatedAt: new Date().toISOString(),
      declinedBy: caller.uid,
    });

    // Notify student via in-app notification
    if (visitData.studentId) {
      try {
        await addDoc(collection(db, "users", visitData.studentId, "notifications"), {
          title: "Visit Request Declined",
          message: `Your visit request for ${visitData.hostelName || "the hostel"} was declined: ${declineReasonText}`,
          type: "visit_status",
          data: { visitId, status: "declined", reason: declineReasonText },
          read: false,
          createdAt: new Date().toISOString(),
        });
      } catch (notifErr) {
        console.warn("Could not save in-app notification for declined visit:", notifErr);
      }
    }

    return { success: true, message: "Visit request declined successfully" };
  } catch (error: any) {
    console.error("declineVisitRequestAction error:", error);
    return { success: false, error: error.message || "Failed to decline visit request" };
  }
}

/**
 * Server Action for Students to mark their completed hostel room inspection
 */
export async function completeVisitByStudentAction(visitId: string) {
  try {
    const caller = await requireAuth();
    if (!visitId) {
      return { success: false, error: "Visit ID is required" };
    }

    const visitRef = doc(db, "visits", visitId);
    const visitSnap = await getDoc(visitRef);
    if (!visitSnap.exists()) {
      return { success: false, error: "Visit record not found" };
    }

    const visitData = visitSnap.data();
    if (visitData.studentId && visitData.studentId !== caller.uid && caller.role !== "admin") {
      return { success: false, error: "Forbidden: You can only complete your own visits" };
    }

    await updateDoc(visitRef, {
      status: "completed",
      studentCompleted: true,
      completedBy: "student",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { success: true, message: "Visit marked as completed successfully" };
  } catch (error: any) {
    console.error("completeVisitByStudentAction error:", error);
    return { success: false, error: error.message || "Failed to complete visit" };
  }
}


