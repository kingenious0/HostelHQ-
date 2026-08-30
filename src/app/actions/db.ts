"use server";

import * as dynamoService from "@/lib/dynamodb-service";
import * as dynamoCore from "@/lib/dynamodb";
import type { Hostel, AppUser, Visit, Review, RoomType } from "@/lib/data";

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
    const saved = await dynamoService.saveHostel(hostelData, isPending);
    return { success: true, data: saved };
  } catch (error: any) {
    console.error("saveHostelAction error:", error);
    return { success: false, error: error.message || "Failed to save hostel" };
  }
}

export async function updateHostelAction(hostelId: string, updates: Partial<Hostel>, isPending: boolean = false) {
  try {
    const updated = await dynamoService.updateHostel(hostelId, updates, isPending);
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("updateHostelAction error:", error);
    return { success: false, error: error.message || "Failed to update hostel" };
  }
}

export async function deleteHostelAction(hostelId: string, isPending: boolean = false) {
  try {
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
    const users = await dynamoService.listUsersByRole(role);
    return { success: true, data: users };
  } catch (error: any) {
    console.error("fetchUsersByRoleAction error:", error);
    return { success: false, error: error.message || "Failed to fetch users" };
  }
}

export async function saveUserAction(user: AppUser) {
  try {
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
    const bookings = await dynamoService.listBookingsByStudent(studentId);
    return { success: true, data: bookings };
  } catch (error: any) {
    console.error("fetchBookingsByStudentAction error:", error);
    return { success: false, error: error.message || "Failed to fetch student bookings" };
  }
}

export async function fetchBookingsByHostelAction(hostelId: string) {
  try {
    const bookings = await dynamoService.listBookingsByHostel(hostelId);
    return { success: true, data: bookings };
  } catch (error: any) {
    console.error("fetchBookingsByHostelAction error:", error);
    return { success: false, error: error.message || "Failed to fetch hostel bookings" };
  }
}

export async function createBookingAction(bookingData: any) {
  try {
    const booking = await dynamoService.saveBooking(bookingData);
    return { success: true, data: booking };
  } catch (error: any) {
    console.error("createBookingAction error:", error);
    return { success: false, error: error.message || "Failed to create booking" };
  }
}

export async function updateBookingStatusAction(bookingId: string, status: string) {
  try {
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
    const visits = await dynamoService.listVisitsByStudent(studentId);
    return { success: true, data: visits };
  } catch (error: any) {
    console.error("fetchVisitsByStudentAction error:", error);
    return { success: false, error: error.message || "Failed to fetch student visits" };
  }
}

export async function fetchVisitsByManagerAction(managerId: string) {
  try {
    const visits = await dynamoService.listVisitsByManager(managerId);
    return { success: true, data: visits };
  } catch (error: any) {
    console.error("fetchVisitsByManagerAction error:", error);
    return { success: false, error: error.message || "Failed to fetch manager visits" };
  }
}

export async function fetchVisitsByHostelAction(hostelId: string) {
  try {
    const visits = await dynamoService.listVisitsByHostel(hostelId);
    return { success: true, data: visits };
  } catch (error: any) {
    console.error("fetchVisitsByHostelAction error:", error);
    return { success: false, error: error.message || "Failed to fetch hostel visits" };
  }
}

export async function createVisitAction(visitData: any) {
  try {
    const visit = await dynamoService.saveVisit(visitData);
    return { success: true, data: visit };
  } catch (error: any) {
    console.error("createVisitAction error:", error);
    return { success: false, error: error.message || "Failed to create visit" };
  }
}

export async function updateVisitStatusAction(visitId: string, status: string) {
  try {
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
    const reviews = await dynamoService.listPendingReviews();
    return { success: true, data: reviews };
  } catch (error: any) {
    console.error("fetchPendingReviewsAction error:", error);
    return { success: false, error: error.message || "Failed to fetch pending reviews" };
  }
}

export async function createReviewAction(reviewData: any) {
  try {
    const review = await dynamoService.saveReview(reviewData);
    return { success: true, data: review };
  } catch (error: any) {
    console.error("createReviewAction error:", error);
    return { success: false, error: error.message || "Failed to submit review" };
  }
}

export async function updateReviewStatusAction(reviewId: string, status: "approved" | "pending") {
  try {
    const updated = await dynamoService.updateReviewStatus(reviewId, status);
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("updateReviewStatusAction error:", error);
    return { success: false, error: error.message || "Failed to update review status" };
  }
}

// ============================================================================
// Generic Low-Level Server Action (for flexible queries)
// ============================================================================

export async function executeDynamoQueryAction(params: {
  operation: "get" | "put" | "update" | "delete" | "scan";
  id?: string;
  entityType?: string;
  item?: Record<string, any>;
  updates?: Record<string, any>;
  filterExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, any>;
}) {
  try {
    switch (params.operation) {
      case "get":
        if (!params.id || !params.entityType) throw new Error("Missing id or entityType for get");
        return { success: true, data: await dynamoCore.getItem(params.id, params.entityType) };

      case "put":
        if (!params.item) throw new Error("Missing item for put");
        return { success: true, data: await dynamoCore.putItem(params.item) };

      case "update":
        if (!params.id || !params.entityType || !params.updates)
          throw new Error("Missing parameters for update");
        return {
          success: true,
          data: await dynamoCore.updateItem(params.id, params.entityType, params.updates),
        };

      case "delete":
        if (!params.id || !params.entityType) throw new Error("Missing id or entityType for delete");
        return { success: true, data: await dynamoCore.deleteItem(params.id, params.entityType) };

      case "scan":
        return {
          success: true,
          data: await dynamoCore.scanEntities({
            entityType: params.entityType,
            filterExpression: params.filterExpression,
            expressionAttributeNames: params.expressionAttributeNames,
            expressionAttributeValues: params.expressionAttributeValues,
          }),
        };

      default:
        throw new Error(`Unsupported operation: ${params.operation}`);
    }
  } catch (error: any) {
    console.error(`executeDynamoQueryAction (${params.operation}) error:`, error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Administrative Server Actions (Dean, Coordinator, Executive)
// ============================================================================

export async function fetchPendingHostelsAction() {
  try {
    const data = await dynamoService.listPendingHostels();
    return { success: true, data };
  } catch (error: any) {
    console.error("fetchPendingHostelsAction error:", error);
    return { success: false, error: error.message || "Failed to fetch pending hostels" };
  }
}

export async function approvePendingHostelAction(hostelId: string, approvedBy?: string) {
  try {
    const data = await dynamoService.approvePendingHostel(hostelId, approvedBy);
    return { success: true, data };
  } catch (error: any) {
    console.error("approvePendingHostelAction error:", error);
    return { success: false, error: error.message || "Failed to approve hostel" };
  }
}

export async function rejectPendingHostelAction(hostelId: string, reason?: string) {
  try {
    const data = await dynamoService.rejectPendingHostel(hostelId, reason);
    return { success: true, data };
  } catch (error: any) {
    console.error("rejectPendingHostelAction error:", error);
    return { success: false, error: error.message || "Failed to reject hostel" };
  }
}

export async function fetchComplaintsAction(filter?: { status?: string; direction?: string }) {
  try {
    const data = await dynamoService.listComplaints(filter);
    return { success: true, data };
  } catch (error: any) {
    console.error("fetchComplaintsAction error:", error);
    return { success: false, error: error.message || "Failed to fetch complaints" };
  }
}

export async function submitComplaintAction(complaintData: any) {
  try {
    const data = await dynamoService.saveComplaint(complaintData);
    return { success: true, data };
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
    const data = await dynamoService.updateComplaintStatus(complaintId, status, notes, resolvedBy);
    return { success: true, data };
  } catch (error: any) {
    console.error("updateComplaintStatusAction error:", error);
    return { success: false, error: error.message || "Failed to update complaint status" };
  }
}

export async function fetchStudentVerificationsAction(status?: string) {
  try {
    const data = await dynamoService.listStudentVerifications(status);
    return { success: true, data };
  } catch (error: any) {
    console.error("fetchStudentVerificationsAction error:", error);
    return { success: false, error: error.message || "Failed to fetch student verifications" };
  }
}

export async function submitStudentVerificationAction(data: any) {
  try {
    const saved = await dynamoService.saveStudentVerification(data);
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
    const data = await dynamoService.updateStudentVerificationStatus(verificationId, status, reason, reviewedBy);

    // Dispatch SMS notification to student
    if (studentPhoneNumber) {
      try {
        const { sendSMS } = await import("@/lib/wigal");
        const greeting = studentName ? `Hi ${studentName},` : "Dear Student,";
        const smsMessage =
          status === "verified"
            ? `${greeting} Your student verification on HostelHQ has been APPROVED by the Dean of Students. You can now log in and book accredited hostels.`
            : `${greeting} Your student verification on HostelHQ was not approved by the Dean of Students.${reason ? ` Reason: ${reason}.` : ""} Please log in to review and re-upload your credentials.`;
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
    const data = await dynamoService.updateRoomPendingPrice(hostelId, roomId, pendingPrice);
    return { success: true, data };
  } catch (error: any) {
    console.error("updateRoomPendingPriceAction error:", error);
    return { success: false, error: error.message || "Failed to set room pending price" };
  }
}

export async function fetchExecutiveMetricsAction() {
  try {
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
          resolutionRate: totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 100,
          totalVerifications,
          approvedVerifications,
          pendingVerifications,
          verificationRate: totalVerifications > 0 ? Math.round((approvedVerifications / totalVerifications) * 100) : 100,
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

