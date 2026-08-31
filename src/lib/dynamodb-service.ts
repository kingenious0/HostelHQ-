import {
  getItem,
  putItem,
  updateItem,
  deleteItem,
  scanEntities,
  batchWrite,
} from "./dynamodb";
import type { Hostel, RoomType, Review, AppUser, Visit, Complaint, StudentVerification, ComplaintStatus } from "./data";

// ============================================================================
// ID & Key Helpers
// ============================================================================
export const cleanHostelId = (id?: string): string => {
  if (!id) return "";
  return id
    .replace(/^HOSTEL#/i, "")
    .replace(/^PENDING_HOSTEL#/i, "")
    .replace(/^HOSTEL#/i, "")
    .replace(/^PENDING_HOSTEL#/i, "")
    .trim();
};

export const formatKey = {
  hostel: (id: string) => ({ id: `HOSTEL#${cleanHostelId(id)}`, entityType: "HOSTEL" }),
  pendingHostel: (id: string) => ({ id: `PENDING_HOSTEL#${cleanHostelId(id)}`, entityType: "PENDING_HOSTEL" }),
  room: (hostelId: string, roomId: string) => ({ id: `ROOM#${cleanHostelId(hostelId)}#${roomId}`, entityType: "ROOM" }),
  pendingRoom: (hostelId: string, roomId: string) => ({ id: `ROOM#${cleanHostelId(hostelId)}#${roomId}`, entityType: "PENDING_ROOM" }),
  student: (id: string) => ({ id: `STUDENT#${id}`, entityType: "STUDENT" }),
  admin: (id: string) => ({ id: `ADMIN#${id}`, entityType: "ADMIN" }),
  manager: (id: string) => ({ id: `MANAGER#${id}`, entityType: "MANAGER" }),
  dean: (id: string) => ({ id: `DEAN#${id}`, entityType: "DEAN" }),
  hostelCoordinator: (id: string) => ({ id: `COORDINATOR#${id}`, entityType: "COORDINATOR" }),
  proVc: (id: string) => ({ id: `PRO_VC#${id}`, entityType: "PRO_VC" }),
  vc: (id: string) => ({ id: `VC#${id}`, entityType: "VC" }),
  user: (id: string, role: string = "user") => {
    const r = role.toUpperCase();
    return { id: `${r}#${id}`, entityType: r };
  },
  pendingUser: (id: string) => ({ id: `PENDING_USER#${id}`, entityType: "PENDING_USER" }),
  booking: (id: string) => ({ id: `BOOKING#${id}`, entityType: "BOOKING" }),
  visit: (id: string) => ({ id: `VISIT#${id}`, entityType: "VISIT" }),
  review: (id: string) => ({ id: `REVIEW#${id}`, entityType: "REVIEW" }),
  complaint: (id: string) => ({ id: `COMPLAINT#${id}`, entityType: "COMPLAINT" }),
  studentVerification: (id: string) => ({ id: `STUDENT_VERIFICATION#${id}`, entityType: "STUDENT_VERIFICATION" }),
};

// ============================================================================
// 1. HOSTEL & ROOM OPERATIONS
// ============================================================================

export async function getHostelById(hostelId: string): Promise<Hostel | null> {
  const cleanId = cleanHostelId(hostelId);
  const { id, entityType } = formatKey.hostel(cleanId);
  let hostelDoc = await getItem<any>(id, entityType);

  // Robust fallback: if hostel was previously saved with compound key
  if (!hostelDoc) {
    hostelDoc = await getItem<any>(`HOSTEL#PENDING_HOSTEL#${cleanId}`, entityType);
  }

  if (!hostelDoc) {
    return null;
  }

  // Fetch rooms for this hostel
  let rooms = await getRoomsByHostelId(cleanId);
  if (rooms.length === 0 && Array.isArray(hostelDoc.roomTypes) && hostelDoc.roomTypes.length > 0) {
    rooms = hostelDoc.roomTypes;
  }

  // Fetch approved reviews for this hostel
  const reviews = await getApprovedReviewsByHostelId(cleanId);

  const prices = rooms.map((r) => r.price).filter((p) => typeof p === "number" && !isNaN(p));
  const priceRange = {
    min: prices.length > 0 ? Math.min(...prices) : (typeof hostelDoc.priceRange?.min === "number" ? hostelDoc.priceRange.min : 0),
    max: prices.length > 0 ? Math.max(...prices) : (typeof hostelDoc.priceRange?.max === "number" ? hostelDoc.priceRange.max : 0),
  };

  const totalRating = reviews.reduce((acc, rev) => acc + (rev.rating || 0), 0);
  const averageRating = reviews.length > 0 ? totalRating / reviews.length : (hostelDoc.rating || 0);

  const hostelLat = typeof hostelDoc.lat === "number" 
    ? hostelDoc.lat 
    : (typeof hostelDoc.coordinates?.lat === "number" ? hostelDoc.coordinates.lat : 6.6998);
  const hostelLng = typeof hostelDoc.lng === "number" 
    ? hostelDoc.lng 
    : (typeof hostelDoc.coordinates?.lng === "number" ? hostelDoc.coordinates.lng : -1.6841);

  return {
    ...hostelDoc,
    id: hostelDoc.originalId || hostelId,
    roomTypes: rooms,
    reviews,
    priceRange: hostelDoc.priceRange || priceRange,
    rating: averageRating,
    lat: hostelLat,
    lng: hostelLng,
  } as Hostel;
}

export async function listHostels(options: {
  featuredOnly?: boolean;
  search?: string;
  location?: string;
} = {}): Promise<Hostel[]> {
  let filterExpression: string | undefined;
  const names: Record<string, string> = {};
  const values: Record<string, any> = {};
  const conditions: string[] = [];

  if (options.featuredOnly) {
    names["#isFeatured"] = "isFeatured";
    values[":featured"] = true;
    conditions.push("#isFeatured = :featured");
  }

  if (conditions.length > 0) {
    filterExpression = conditions.join(" AND ");
  }

  // Scan for HOSTEL entityType
  const rawHostels = await scanEntities<any>({
    entityType: "HOSTEL",
    filterExpression,
    expressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
    expressionAttributeValues: Object.keys(values).length > 0 ? values : undefined,
  });

  // Fetch all rooms and reviews to enrich hostels
  const allRooms = await scanEntities<any>({ entityType: "ROOM" });
  const allReviews = await scanEntities<any>({
    entityType: "REVIEW",
    filterExpression: "#status = :approved",
    expressionAttributeNames: { "#status": "status" },
    expressionAttributeValues: { ":approved": "approved" },
  });

  let enrichedHostels: Hostel[] = rawHostels.map((h) => {
    const realId = cleanHostelId(h.originalId || h.id);
    const hostelRooms = allRooms
      .filter((r) => {
        const cleanParent = cleanHostelId(r.parentId || r.hostelId);
        return cleanParent === realId;
      })
      .map((r) => ({
        id: r.originalId || r.id.split("#")[2] || r.id,
        name: r.name,
        price: r.price,
        availability: r.availability || "Available",
        beds: r.beds,
        bathrooms: r.bathrooms,
      })) as RoomType[];

    const finalRooms = hostelRooms.length > 0 ? hostelRooms : (Array.isArray(h.roomTypes) ? h.roomTypes : []);

    const hostelReviews = allReviews
      .filter((rev) => cleanHostelId(rev.hostelId) === realId)
      .map((rev) => ({
        id: rev.originalId || rev.id.replace("REVIEW#", ""),
        studentId: rev.studentId,
        studentName: rev.studentName || "Anonymous",
        rating: rev.rating || 5,
        comment: rev.comment || "",
        createdAt: rev.createdAt || new Date().toISOString(),
        status: rev.status || "approved",
      })) as Review[];

    const prices = finalRooms.map((r: any) => r.price).filter((p: any) => typeof p === "number" && !isNaN(p));
    const priceRange = {
      min: prices.length > 0 ? Math.min(...prices) : (typeof h.priceRange?.min === "number" ? h.priceRange.min : 0),
      max: prices.length > 0 ? Math.max(...prices) : (typeof h.priceRange?.max === "number" ? h.priceRange.max : 0),
    };

    const totalRating = hostelReviews.reduce((acc, rev) => acc + (rev.rating || 0), 0);
    const averageRating = hostelReviews.length > 0 ? totalRating / hostelReviews.length : (h.rating || 0);

    const hostelLat = typeof h.lat === "number" 
      ? h.lat 
      : (typeof h.coordinates?.lat === "number" ? h.coordinates.lat : 6.6998);
    const hostelLng = typeof h.lng === "number" 
      ? h.lng 
      : (typeof h.coordinates?.lng === "number" ? h.coordinates.lng : -1.6841);

    const availability = (h.availability as Hostel["availability"]) || 
      (finalRooms.some((r: any) => r.availability === "Available" || r.availability === "Limited") ? "Available" : "Available");

    const roomTypeTags = h.roomTypeTags || finalRooms.map((r: any) => r.name).filter(Boolean);

    return {
      ...h,
      id: realId,
      originalId: realId,
      roomTypes: finalRooms,
      roomTypeTags,
      availability,
      reviews: hostelReviews,
      priceRange: h.priceRange || priceRange,
      rating: averageRating,
      lat: hostelLat,
      lng: hostelLng,
    } as Hostel;
  });

  // Client-side search filters if requested
  if (options.search) {
    const q = options.search.toLowerCase();
    enrichedHostels = enrichedHostels.filter(
      (h) => h.name?.toLowerCase().includes(q) || h.description?.toLowerCase().includes(q)
    );
  }

  if (options.location) {
    const loc = options.location.toLowerCase();
    enrichedHostels = enrichedHostels.filter((h) => h.location?.toLowerCase().includes(loc));
  }

  return enrichedHostels;
}

export async function getRoomsByHostelId(hostelId: string): Promise<RoomType[]> {
  const cleanId = cleanHostelId(hostelId);
  const rooms = await scanEntities<any>({
    entityType: "ROOM",
    filterExpression: "#parentId = :hostelId OR #hostelId = :hostelId OR #parentId = :legacyHostelId OR #hostelId = :legacyHostelId",
    expressionAttributeNames: {
      "#parentId": "parentId",
      "#hostelId": "hostelId",
    },
    expressionAttributeValues: {
      ":hostelId": cleanId,
      ":legacyHostelId": `PENDING_HOSTEL#${cleanId}`,
    },
  });

  return rooms.map((r) => ({
    id: r.originalId || r.id.split("#")[2] || r.id,
    name: r.name,
    price: r.price,
    availability: r.availability || "Available",
    beds: r.beds,
    bathrooms: r.bathrooms,
  }));
}

export async function saveHostel(
  hostelData: Omit<Hostel, "reviews"> & { id?: string; originalId?: string },
  isPending: boolean = false
): Promise<Hostel> {
  const rawId = hostelData.id || hostelData.originalId || `hostel_${Date.now()}`;
  const hostelId = cleanHostelId(rawId);
  const key = isPending ? formatKey.pendingHostel(hostelId) : formatKey.hostel(hostelId);

  const { roomTypes = [], ...mainHostelData } = hostelData;

  const itemToSave = {
    ...mainHostelData,
    roomTypes,
    id: key.id,
    entityType: key.entityType,
    originalId: hostelId,
    createdAt: mainHostelData.createdAt || new Date().toISOString(),
  };

  await putItem(itemToSave);

  // Save room types
  if (roomTypes.length > 0) {
    const roomPuts = roomTypes.map((rt: RoomType, idx: number) => {
      const roomId = rt.id || `room_${idx}_${Date.now()}`;
      const roomKey = isPending
        ? formatKey.pendingRoom(hostelId, roomId)
        : formatKey.room(hostelId, roomId);

      return {
        ...rt,
        id: roomKey.id,
        entityType: roomKey.entityType,
        originalId: roomId,
        parentId: hostelId,
        hostelId,
        hostelName: hostelData.name,
      };
    });

    await batchWrite({ putItems: roomPuts });
  }

  return {
    ...itemToSave,
    id: hostelId,
    originalId: hostelId,
    roomTypes,
    reviews: [],
  } as unknown as Hostel;
}

export async function updateHostel(
  hostelId: string,
  updates: Partial<Hostel>,
  isPending: boolean = false
): Promise<Hostel | null> {
  const cleanId = cleanHostelId(hostelId);
  const key = isPending ? formatKey.pendingHostel(cleanId) : formatKey.hostel(cleanId);
  const updated = await updateItem<any>(key.id, key.entityType, updates);
  if (!updated) return null;
  return { ...updated, id: cleanId, originalId: cleanId } as Hostel;
}

export async function deleteHostel(hostelId: string, isPending: boolean = false): Promise<boolean> {
  const cleanId = cleanHostelId(hostelId);
  const key = isPending ? formatKey.pendingHostel(cleanId) : formatKey.hostel(cleanId);
  await deleteItem(key.id, key.entityType);

  // Also delete associated rooms
  const targetEntityType = isPending ? "PENDING_ROOM" : "ROOM";
  try {
    const rooms = await scanEntities<any>({
      entityType: targetEntityType,
      filterExpression: "#parentId = :hostelId OR #hostelId = :hostelId",
      expressionAttributeNames: {
        "#parentId": "parentId",
        "#hostelId": "hostelId",
      },
      expressionAttributeValues: {
        ":hostelId": cleanId,
      },
    });
    if (rooms.length > 0) {
      const deleteKeys = rooms.map((r) => ({
        id: r.id,
        entityType: r.entityType || targetEntityType,
      }));
      await batchWrite({ deleteKeys });
    }
  } catch (err) {
    console.warn("Room cleanup during hostel delete warning:", err);
  }

  return true;
}

// ============================================================================
// 2. USER OPERATIONS
// ============================================================================

export async function getUserById(userId: string): Promise<AppUser | null> {
  // Check student, admin, manager, dean, coordinator, pro_vc, vc, and user keys
  const candidateKeys = [
    formatKey.student(userId),
    formatKey.admin(userId),
    formatKey.manager(userId),
    formatKey.dean(userId),
    formatKey.hostelCoordinator(userId),
    formatKey.proVc(userId),
    formatKey.vc(userId),
    formatKey.user(userId, "USER"),
  ];

  for (const key of candidateKeys) {
    const userDoc = await getItem<any>(key.id, key.entityType);
    if (userDoc) {
      return {
        ...userDoc,
        id: userDoc.originalId || userId,
      };
    }
  }

  // Fallback scan if role is unknown
  const scanned = await scanEntities<any>({
    filterExpression: "#originalId = :uid OR #id = :studentKey OR #id = :adminKey OR #id = :managerKey",
    expressionAttributeNames: {
      "#originalId": "originalId",
      "#id": "id",
    },
    expressionAttributeValues: {
      ":uid": userId,
      ":studentKey": `STUDENT#${userId}`,
      ":adminKey": `ADMIN#${userId}`,
      ":managerKey": `MANAGER#${userId}`,
    },
    limit: 1,
  });

  if (scanned.length > 0) {
    return {
      ...scanned[0],
      id: scanned[0].originalId || userId,
    };
  }

  return null;
}

export async function listUsersByRole(role: "student" | "hostel_manager" | "manager" | "admin" | "dean" | "pro_vc" | "vc" | "hostel_coordinator"): Promise<AppUser[]> {
  const entityType = role.toUpperCase();
  const users = await scanEntities<any>({
    entityType,
  });

  return users.map((u) => ({
    ...u,
    id: u.originalId || u.id.replace(`${entityType}#`, ""),
  }));
}

export async function saveUser(user: AppUser): Promise<AppUser> {
  const role = user.role || "student";
  const key = formatKey.user(user.id, role);

  const itemToSave = {
    ...user,
    id: key.id,
    entityType: key.entityType,
    originalId: user.id,
    createdAt: (user as any).createdAt || new Date().toISOString(),
  };

  await putItem(itemToSave);
  return user;
}


// ============================================================================
// 3. BOOKING OPERATIONS
// ============================================================================

export async function getBookingById(bookingId: string): Promise<any | null> {
  const key = formatKey.booking(bookingId);
  const booking = await getItem<any>(key.id, key.entityType);
  if (!booking) return null;
  return { ...booking, id: booking.originalId || bookingId };
}

export async function listBookingsByStudent(studentId: string): Promise<any[]> {
  const bookings = await scanEntities<any>({
    entityType: "BOOKING",
    filterExpression: "#studentId = :studentId",
    expressionAttributeNames: { "#studentId": "studentId" },
    expressionAttributeValues: { ":studentId": studentId },
  });

  return bookings.map((b) => ({ ...b, id: b.originalId || b.id.replace("BOOKING#", "") }));
}

export async function listBookingsByHostel(hostelId: string): Promise<any[]> {
  const bookings = await scanEntities<any>({
    entityType: "BOOKING",
    filterExpression: "#hostelId = :hostelId",
    expressionAttributeNames: { "#hostelId": "hostelId" },
    expressionAttributeValues: { ":hostelId": hostelId },
  });

  return bookings.map((b) => ({ ...b, id: b.originalId || b.id.replace("BOOKING#", "") }));
}

export async function saveBooking(bookingData: any): Promise<any> {
  const bookingId = bookingData.id || `booking_${Date.now()}`;
  const key = formatKey.booking(bookingId);

  const itemToSave = {
    ...bookingData,
    id: key.id,
    entityType: key.entityType,
    originalId: bookingId,
    createdAt: bookingData.createdAt || new Date().toISOString(),
  };

  await putItem(itemToSave);
  return { ...itemToSave, id: bookingId };
}

export async function updateBookingStatus(bookingId: string, status: string): Promise<any> {
  const key = formatKey.booking(bookingId);
  return updateItem(key.id, key.entityType, { status });
}

// ============================================================================
// 4. VISIT OPERATIONS
// ============================================================================

export async function getVisitById(visitId: string): Promise<Visit | null> {
  const key = formatKey.visit(visitId);
  const visit = await getItem<any>(key.id, key.entityType);
  if (!visit) return null;
  return { ...visit, id: visit.originalId || visitId } as Visit;
}

export async function listVisitsByStudent(studentId: string): Promise<Visit[]> {
  const visits = await scanEntities<any>({
    entityType: "VISIT",
    filterExpression: "#studentId = :studentId",
    expressionAttributeNames: { "#studentId": "studentId" },
    expressionAttributeValues: { ":studentId": studentId },
  });

  return visits.map((v) => ({ ...v, id: v.originalId || v.id.replace("VISIT#", "") })) as Visit[];
}

export async function listVisitsByHostel(hostelId: string): Promise<Visit[]> {
  const visits = await scanEntities<any>({
    entityType: "VISIT",
    filterExpression: "#hostelId = :hostelId",
    expressionAttributeNames: { "#hostelId": "hostelId" },
    expressionAttributeValues: { ":hostelId": hostelId },
  });

  return visits.map((v) => ({ ...v, id: v.originalId || v.id.replace("VISIT#", "") })) as Visit[];
}

export async function listVisitsByManager(managerId: string): Promise<Visit[]> {
  const visits = await scanEntities<any>({
    entityType: "VISIT",
    filterExpression: "#managerId = :managerId",
    expressionAttributeNames: { "#managerId": "managerId" },
    expressionAttributeValues: { ":managerId": managerId },
  });

  return visits.map((v) => ({ ...v, id: v.originalId || v.id.replace("VISIT#", "") })) as Visit[];
}

export async function saveVisit(visitData: any): Promise<Visit> {
  const visitId = visitData.id || `visit_${Date.now()}`;
  const key = formatKey.visit(visitId);

  const itemToSave = {
    ...visitData,
    id: key.id,
    entityType: key.entityType,
    originalId: visitId,
    createdAt: visitData.createdAt || new Date().toISOString(),
  };

  await putItem(itemToSave);
  return { ...itemToSave, id: visitId } as Visit;
}

export async function updateVisitStatus(visitId: string, status: string): Promise<any> {
  const key = formatKey.visit(visitId);
  return updateItem(key.id, key.entityType, { status });
}

// ============================================================================
// 5. REVIEW OPERATIONS
// ============================================================================

export async function getApprovedReviewsByHostelId(hostelId: string): Promise<Review[]> {
  const reviews = await scanEntities<any>({
    entityType: "REVIEW",
    filterExpression: "#hostelId = :hostelId AND #status = :status",
    expressionAttributeNames: {
      "#hostelId": "hostelId",
      "#status": "status",
    },
    expressionAttributeValues: {
      ":hostelId": hostelId,
      ":status": "approved",
    },
  });

  return reviews.map((r) => ({
    id: r.originalId || r.id.replace("REVIEW#", ""),
    studentId: r.studentId,
    studentName: r.studentName || "Anonymous",
    rating: r.rating || 5,
    comment: r.comment || "",
    createdAt: r.createdAt || new Date().toISOString(),
    status: r.status || "approved",
  }));
}

export async function listPendingReviews(): Promise<Review[]> {
  const reviews = await scanEntities<any>({
    entityType: "REVIEW",
    filterExpression: "#status = :status",
    expressionAttributeNames: { "#status": "status" },
    expressionAttributeValues: { ":status": "pending" },
  });

  return reviews.map((r) => ({
    id: r.originalId || r.id.replace("REVIEW#", ""),
    studentId: r.studentId,
    studentName: r.studentName || "Anonymous",
    rating: r.rating || 5,
    comment: r.comment || "",
    createdAt: r.createdAt || new Date().toISOString(),
    status: "pending",
  }));
}

export async function saveReview(reviewData: any): Promise<Review> {
  const reviewId = reviewData.id || `review_${Date.now()}`;
  const key = formatKey.review(reviewId);

  const itemToSave = {
    ...reviewData,
    id: key.id,
    entityType: key.entityType,
    originalId: reviewId,
    status: reviewData.status || "pending",
    createdAt: reviewData.createdAt || new Date().toISOString(),
  };

  await putItem(itemToSave);
  return { ...itemToSave, id: reviewId } as Review;
}

export async function updateReviewStatus(reviewId: string, status: "approved" | "pending"): Promise<any> {
  const key = formatKey.review(reviewId);
  return updateItem(key.id, key.entityType, { status });
}

// ============================================================================
// 6. PENDING HOSTEL OPERATIONS (COORDINATOR DASHBOARD)
// ============================================================================

export async function listPendingHostels(): Promise<Hostel[]> {
  const pending = await scanEntities<any>({
    entityType: "PENDING_HOSTEL",
  });
  return pending.map((h) => ({
    ...h,
    id: cleanHostelId(h.originalId || h.id),
    originalId: cleanHostelId(h.originalId || h.id),
    status: h.status || "pending",
  })) as Hostel[];
}

export async function approvePendingHostel(hostelId: string, approvedBy?: string): Promise<Hostel | null> {
  const cleanId = cleanHostelId(hostelId);
  const pendingKey = formatKey.pendingHostel(cleanId);
  const pendingData = await getItem<any>(pendingKey.id, pendingKey.entityType);
  if (!pendingData) return null;

  const liveHostel = {
    ...pendingData,
    id: cleanId,
    originalId: cleanId,
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedBy: approvedBy || "Hostel Coordinator",
  };
  await saveHostel(liveHostel, false);
  await deleteHostel(cleanId, true);
  return { ...liveHostel, id: cleanId, originalId: cleanId } as Hostel;
}

export async function rejectPendingHostel(hostelId: string, reason?: string): Promise<boolean> {
  const cleanId = cleanHostelId(hostelId);
  const pendingKey = formatKey.pendingHostel(cleanId);
  await updateItem(pendingKey.id, pendingKey.entityType, {
    status: "rejected",
    rejectionReason: reason || "Requirements not met",
    rejectedAt: new Date().toISOString(),
  });
  return true;
}

// ============================================================================
// 7. COMPLAINT OPERATIONS (DEAN & EXECUTIVE DASHBOARDS)
// ============================================================================

export async function listComplaints(filter?: { status?: string; direction?: string }): Promise<Complaint[]> {
  const complaints = await scanEntities<any>({
    entityType: "COMPLAINT",
  });
  let list = complaints.map((c) => ({
    ...c,
    id: c.originalId || c.id.replace("COMPLAINT#", ""),
  })) as Complaint[];

  if (filter?.status) {
    list = list.filter((c) => c.status === filter.status);
  }
  if (filter?.direction) {
    list = list.filter((c) => c.direction === filter.direction);
  }
  return list;
}

export async function saveComplaint(complaintData: Partial<Complaint>): Promise<Complaint> {
  const complaintId = complaintData.id || `complaint_${Date.now()}`;
  const key = formatKey.complaint(complaintId);
  const itemToSave = {
    ...complaintData,
    id: key.id,
    entityType: key.entityType,
    originalId: complaintId,
    status: complaintData.status || "Submitted",
    createdAt: complaintData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putItem(itemToSave);
  return { ...itemToSave, id: complaintId } as Complaint;
}

export async function updateComplaintStatus(
  complaintId: string,
  status: ComplaintStatus,
  resolutionNotes?: string,
  resolvedBy?: string
): Promise<any> {
  const key = formatKey.complaint(complaintId);
  const updates: Record<string, any> = {
    status,
    updatedAt: new Date().toISOString(),
  };
  if (resolutionNotes) updates.resolutionNotes = resolutionNotes;
  if (status === "Resolved") {
    updates.resolvedAt = new Date().toISOString();
    if (resolvedBy) updates.resolvedBy = resolvedBy;
  }
  return updateItem(key.id, key.entityType, updates);
}

// ============================================================================
// 8. STUDENT VERIFICATION OPERATIONS (DEAN DASHBOARD)
// ============================================================================

export async function listStudentVerifications(status?: string): Promise<StudentVerification[]> {
  const verifications = await scanEntities<any>({
    entityType: "STUDENT_VERIFICATION",
  });
  let list = verifications.map((v) => ({
    ...v,
    id: v.originalId || v.id.replace("STUDENT_VERIFICATION#", ""),
  })) as StudentVerification[];

  if (status) {
    list = list.filter((v) => v.status === status);
  }
  return list;
}

export async function saveStudentVerification(data: Partial<StudentVerification>): Promise<StudentVerification> {
  const id = data.id || `verif_${Date.now()}`;
  const key = formatKey.studentVerification(id);
  const itemToSave = {
    ...data,
    id: key.id,
    entityType: key.entityType,
    originalId: id,
    status: data.status || "pending",
    submittedAt: data.submittedAt || new Date().toISOString(),
  };
  await putItem(itemToSave);
  return { ...itemToSave, id } as StudentVerification;
}

export async function updateStudentVerificationStatus(
  verificationId: string,
  status: "verified" | "rejected",
  reason?: string,
  reviewedBy?: string
): Promise<any> {
  const key = formatKey.studentVerification(verificationId);
  const updates: Record<string, any> = {
    status,
    reviewedAt: new Date().toISOString(),
  };
  if (reason) updates.rejectionReason = reason;
  if (reviewedBy) updates.reviewedBy = reviewedBy;
  return updateItem(key.id, key.entityType, updates);
}

// ============================================================================
// 9. ROOM PENDING PRICE HOOK (COORDINATOR DATA HOOK)
// ============================================================================

export async function updateRoomPendingPrice(
  hostelId: string,
  roomId: string,
  pendingPrice: number
): Promise<any> {
  const key = formatKey.room(hostelId, roomId);
  return updateItem(key.id, key.entityType, {
    pendingPrice,
    pendingPriceRequestedAt: new Date().toISOString(),
  });
}

