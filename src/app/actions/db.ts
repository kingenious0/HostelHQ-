"use server";

import * as dynamoService from "@/lib/dynamodb-service";
import * as dynamoCore from "@/lib/dynamodb";
import type { Hostel, AppUser, Agent, Visit, Review, RoomType } from "@/lib/data";

// ============================================================================
// Hostel Server Actions
// ============================================================================

export async function fetchHostelsAction(options: {
  featured?: boolean;
  search?: string;
  location?: string;
  agentId?: string;
} = {}) {
  try {
    const hostels = await dynamoService.listHostels({
      featuredOnly: options.featured,
      search: options.search,
      location: options.location,
      agentId: options.agentId,
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
// User & Agent Server Actions
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

export async function fetchUsersByRoleAction(role: "student" | "agent" | "admin") {
  try {
    const users = await dynamoService.listUsersByRole(role);
    return { success: true, data: users };
  } catch (error: any) {
    console.error("fetchUsersByRoleAction error:", error);
    return { success: false, error: error.message || "Failed to fetch users" };
  }
}

export async function saveUserAction(user: AppUser | Agent) {
  try {
    const saved = await dynamoService.saveUser(user);
    return { success: true, data: saved };
  } catch (error: any) {
    console.error("saveUserAction error:", error);
    return { success: false, error: error.message || "Failed to save user" };
  }
}

export async function updateAgentLocationAction(agentId: string, location: { lat: number; lng: number }) {
  try {
    await dynamoService.updateUserLocation(agentId, location);
    return { success: true };
  } catch (error: any) {
    console.error("updateAgentLocationAction error:", error);
    return { success: false, error: error.message || "Failed to update agent location" };
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

export async function fetchVisitsByAgentAction(agentId: string) {
  try {
    const visits = await dynamoService.listVisitsByAgent(agentId);
    return { success: true, data: visits };
  } catch (error: any) {
    console.error("fetchVisitsByAgentAction error:", error);
    return { success: false, error: error.message || "Failed to fetch agent visits" };
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
