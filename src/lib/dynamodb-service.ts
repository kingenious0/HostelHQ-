import {
  getItem,
  putItem,
  updateItem,
  deleteItem,
  scanEntities,
  batchWrite,
} from "./dynamodb";
import type { Hostel, RoomType, Review, Agent, AppUser, Visit } from "./data";

// ============================================================================
// ID & Key Helpers
// ============================================================================
export const formatKey = {
  hostel: (id: string) => ({ id: `HOSTEL#${id}`, entityType: "HOSTEL" }),
  pendingHostel: (id: string) => ({ id: `PENDING_HOSTEL#${id}`, entityType: "PENDING_HOSTEL" }),
  room: (hostelId: string, roomId: string) => ({ id: `ROOM#${hostelId}#${roomId}`, entityType: "ROOM" }),
  pendingRoom: (hostelId: string, roomId: string) => ({ id: `ROOM#${hostelId}#${roomId}`, entityType: "PENDING_ROOM" }),
  student: (id: string) => ({ id: `STUDENT#${id}`, entityType: "STUDENT" }),
  agent: (id: string) => ({ id: `AGENT#${id}`, entityType: "AGENT" }),
  admin: (id: string) => ({ id: `ADMIN#${id}`, entityType: "ADMIN" }),
  user: (id: string, role: string = "user") => {
    const r = role.toUpperCase();
    return { id: `${r}#${id}`, entityType: r };
  },
  pendingUser: (id: string) => ({ id: `PENDING_USER#${id}`, entityType: "PENDING_USER" }),
  booking: (id: string) => ({ id: `BOOKING#${id}`, entityType: "BOOKING" }),
  visit: (id: string) => ({ id: `VISIT#${id}`, entityType: "VISIT" }),
  review: (id: string) => ({ id: `REVIEW#${id}`, entityType: "REVIEW" }),
};

// ============================================================================
// 1. HOSTEL & ROOM OPERATIONS
// ============================================================================

export async function getHostelById(hostelId: string): Promise<Hostel | null> {
  const { id, entityType } = formatKey.hostel(hostelId);
  const hostelDoc = await getItem<any>(id, entityType);

  if (!hostelDoc) {
    return null;
  }

  // Fetch rooms for this hostel
  const rooms = await getRoomsByHostelId(hostelId);

  // Fetch approved reviews for this hostel
  const reviews = await getApprovedReviewsByHostelId(hostelId);

  const prices = rooms.map((r) => r.price).filter((p) => typeof p === "number");
  const priceRange = {
    min: prices.length > 0 ? Math.min(...prices) : 0,
    max: prices.length > 0 ? Math.max(...prices) : 0,
  };

  const totalRating = reviews.reduce((acc, rev) => acc + (rev.rating || 0), 0);
  const averageRating = reviews.length > 0 ? totalRating / reviews.length : (hostelDoc.rating || 0);

  return {
    ...hostelDoc,
    id: hostelDoc.originalId || hostelId,
    roomTypes: rooms,
    reviews,
    priceRange: hostelDoc.priceRange || priceRange,
    rating: averageRating,
  } as Hostel;
}

export async function listHostels(options: {
  featuredOnly?: boolean;
  search?: string;
  location?: string;
  agentId?: string;
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

  if (options.agentId) {
    names["#agentId"] = "agentId";
    values[":agentId"] = options.agentId;
    conditions.push("#agentId = :agentId");
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
    const realId = h.originalId || h.id.replace("HOSTEL#", "");
    const hostelRooms = allRooms
      .filter((r) => r.parentId === realId || r.hostelId === realId)
      .map((r) => ({
        id: r.originalId || r.id.split("#")[2] || r.id,
        name: r.name,
        price: r.price,
        availability: r.availability || "Available",
        beds: r.beds,
        bathrooms: r.bathrooms,
      })) as RoomType[];

    const hostelReviews = allReviews
      .filter((rev) => rev.hostelId === realId)
      .map((rev) => ({
        id: rev.originalId || rev.id.replace("REVIEW#", ""),
        studentId: rev.studentId,
        studentName: rev.studentName || "Anonymous",
        rating: rev.rating || 5,
        comment: rev.comment || "",
        createdAt: rev.createdAt || new Date().toISOString(),
        status: rev.status || "approved",
      })) as Review[];

    const prices = hostelRooms.map((r) => r.price).filter((p) => typeof p === "number");
    const priceRange = {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
    };

    const totalRating = hostelReviews.reduce((acc, rev) => acc + (rev.rating || 0), 0);
    const averageRating = hostelReviews.length > 0 ? totalRating / hostelReviews.length : (h.rating || 0);

    return {
      ...h,
      id: realId,
      roomTypes: hostelRooms,
      reviews: hostelReviews,
      priceRange: h.priceRange || priceRange,
      rating: averageRating,
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
  const rooms = await scanEntities<any>({
    entityType: "ROOM",
    filterExpression: "#parentId = :hostelId OR #hostelId = :hostelId",
    expressionAttributeNames: {
      "#parentId": "parentId",
      "#hostelId": "hostelId",
    },
    expressionAttributeValues: {
      ":hostelId": hostelId,
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
  hostelData: Omit<Hostel, "reviews"> & { id?: string },
  isPending: boolean = false
): Promise<Hostel> {
  const hostelId = hostelData.id || `hostel_${Date.now()}`;
  const key = isPending ? formatKey.pendingHostel(hostelId) : formatKey.hostel(hostelId);

  const { roomTypes = [], ...mainHostelData } = hostelData;

  const itemToSave = {
    ...mainHostelData,
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
    roomTypes,
    reviews: [],
  } as unknown as Hostel;
}

export async function updateHostel(
  hostelId: string,
  updates: Partial<Hostel>,
  isPending: boolean = false
): Promise<Hostel | null> {
  const key = isPending ? formatKey.pendingHostel(hostelId) : formatKey.hostel(hostelId);
  const updated = await updateItem<any>(key.id, key.entityType, updates);
  if (!updated) return null;
  return { ...updated, id: hostelId } as Hostel;
}

export async function deleteHostel(hostelId: string, isPending: boolean = false): Promise<boolean> {
  const key = isPending ? formatKey.pendingHostel(hostelId) : formatKey.hostel(hostelId);
  await deleteItem(key.id, key.entityType);

  // Also delete associated rooms
  const rooms = await getRoomsByHostelId(hostelId);
  if (rooms.length > 0) {
    const deleteKeys = rooms.map((r) =>
      isPending ? formatKey.pendingRoom(hostelId, r.id!) : formatKey.room(hostelId, r.id!)
    );
    await batchWrite({ deleteKeys });
  }

  return true;
}

// ============================================================================
// 2. USER & AGENT OPERATIONS
// ============================================================================

export async function getUserById(userId: string): Promise<AppUser | Agent | null> {
  // Check student, agent, admin, and user keys
  const candidateKeys = [
    formatKey.student(userId),
    formatKey.agent(userId),
    formatKey.admin(userId),
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
    filterExpression: "#originalId = :uid OR #id = :studentKey OR #id = :agentKey OR #id = :adminKey",
    expressionAttributeNames: {
      "#originalId": "originalId",
      "#id": "id",
    },
    expressionAttributeValues: {
      ":uid": userId,
      ":studentKey": `STUDENT#${userId}`,
      ":agentKey": `AGENT#${userId}`,
      ":adminKey": `ADMIN#${userId}`,
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

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const key = formatKey.agent(agentId);
  const agentDoc = await getItem<any>(key.id, key.entityType);

  if (agentDoc && agentDoc.role === "agent") {
    return {
      ...agentDoc,
      id: agentDoc.originalId || agentId,
    } as Agent;
  }

  // Try generic getUserById in case of key variation
  const user = await getUserById(agentId);
  if (user && user.role === "agent") {
    return user as Agent;
  }

  return null;
}

export async function listUsersByRole(role: "student" | "agent" | "admin"): Promise<AppUser[]> {
  const entityType = role.toUpperCase();
  const users = await scanEntities<any>({
    entityType,
  });

  return users.map((u) => ({
    ...u,
    id: u.originalId || u.id.replace(`${entityType}#`, ""),
  }));
}

export async function saveUser(user: AppUser | Agent): Promise<AppUser | Agent> {
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

export async function updateUserLocation(agentId: string, location: { lat: number; lng: number }): Promise<void> {
  const key = formatKey.agent(agentId);
  await updateItem(key.id, key.entityType, { location });
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

export async function listVisitsByAgent(agentId: string): Promise<Visit[]> {
  const visits = await scanEntities<any>({
    entityType: "VISIT",
    filterExpression: "#agentId = :agentId",
    expressionAttributeNames: { "#agentId": "agentId" },
    expressionAttributeValues: { ":agentId": agentId },
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
