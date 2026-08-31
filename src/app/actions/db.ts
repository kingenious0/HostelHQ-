"use server";

import * as dynamoService from "@/lib/dynamodb-service";
import * as dynamoCore from "@/lib/dynamodb";
import type { Hostel, AppUser, Visit, Review, RoomType } from "@/lib/data";
import { db } from "@/lib/firebase";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
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
    if (caller.role !== "admin") {
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
    if (bookingData.studentId && caller.uid !== bookingData.studentId && caller.role !== "admin") {
      throw new Error("Unauthorized: You can only create bookings for yourself.");
    }
    bookingData.studentId = caller.uid;
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
    visitData.studentId = caller.uid;
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
    await requireRole(["admin", "dean", "coordinator", "executive"]);
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
    await requireRole(["admin", "executive", "dean", "coordinator"]);
    // Strictly aggregate metrics only — NO individual records returned
    const [hostels, bookings, complaints, verifications] = await Promise.all([
      dynamoService.listHostels(),
      dynamoCore.scanEntities<any>({ entityType: "BOOKING" }),
      dynamoService.listComplaints(),
      dynamoService.listStudentVerifications(),
    ]);

    const totalHostels = hostels.length;
    const verifiedHostels = hostels.filter((h) => h.status === "approved" || !h.status).length;
    
    // Count confirmed / completed bookings as students accommodated
    const accommodatedStudents = bookings.filter((b) => 
      b.status === "confirmed" || b.status === "completed" || b.status === "paid" || b.status === "active"
    ).length;

    const totalComplaints = complaints.length;
    const resolvedComplaints = complaints.filter((c) => c.status === "Resolved").length;
    const underReviewComplaints = complaints.filter((c) => c.status === "Under Review").length;
    const submittedComplaints = complaints.filter((c) => c.status === "Submitted").length;

    // Complaint categories aggregation
    const categoryCounts: Record<string, number> = {};
    complaints.forEach((c) => {
      const cat = c.category || "General";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const categoryBreakdown = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count,
      percentage: totalComplaints > 0 ? Math.round((count / totalComplaints) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    // Complaint directions
    const studentToHostelCount = complaints.filter((c) => c.direction === "student_to_hostel").length;
    const managerToStudentCount = complaints.filter((c) => c.direction === "manager_to_student").length;

    // Verification rate
    const totalVerifications = verifications.length;
    const approvedVerifications = verifications.filter((v) => v.status === "verified").length;
    const pendingVerifications = verifications.filter((v) => v.status === "pending").length;

    return {
      success: true,
      data: {
        summary: {
          totalHostels,
          verifiedHostels,
          accommodatedStudents,
          totalComplaints,
          resolvedComplaints,
          underReviewComplaints,
          submittedComplaints,
          resolutionRate: totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0,
          totalVerifications,
          approvedVerifications,
          pendingVerifications,
          verificationRate: totalVerifications > 0 ? Math.round((approvedVerifications / totalVerifications) * 100) : 0,
        },
        categoryBreakdown,
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

