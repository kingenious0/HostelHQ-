import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import * as dynamoService from "@/lib/dynamodb-service";
import * as dynamoCore from "@/lib/dynamodb";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications?userId=xyz
 * Reads notifications for a user from both DynamoDB and Firestore, returning a deduplicated, sorted list.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId") || caller.uid;

    const isStaff = ["admin", "executive", "dean", "coordinator"].includes(caller.role || "");
    if (targetUserId !== caller.uid && !isStaff) {
      return NextResponse.json(
        { error: "Forbidden: You can only read your own notifications" },
        { status: 403 }
      );
    }

    // 1. Fetch from DynamoDB
    let dynamoData: any[] = [];
    if (dynamoCore.isDynamoConfigured()) {
      try {
        dynamoData = await dynamoService.listNotificationsByUserId(targetUserId);
      } catch (dErr) {
        console.warn("DynamoDB GET notifications note:", dErr);
      }
    }

    // 2. Fetch from Firestore
    let firestoreData: any[] = [];
    try {
      const notifsRef = collection(db, "notifications");
      const q = query(notifsRef, where("userId", "==", targetUserId));
      const snap = await getDocs(q);
      firestoreData = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    } catch (fsErr) {
      console.warn("Firestore GET notifications note:", fsErr);
    }

    // Merge and deduplicate by notification ID
    const map = new Map<string, any>();
    for (const item of [...dynamoData, ...firestoreData]) {
      const id = item.id || item.originalId;
      if (!id) continue;
      if (!map.has(id)) {
        map.set(id, item);
      } else {
        const existing = map.get(id);
        map.set(id, {
          ...existing,
          ...item,
          isRead: existing.isRead || item.isRead,
        });
      }
    }

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Dual-writes notification to both Firebase Firestore and AWS DynamoDB.
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await requireAuth(request);
    const body = await request.json();

    const notifId = body.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
      ...body,
      id: notifId,
      userId: body.userId || caller.uid,
      title: body.title || "HostelHQ Notification",
      message: body.message || "",
      type: body.type || "system",
      linkUrl: body.linkUrl || "/dashboard",
      isRead: Boolean(body.isRead ?? false),
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Dual-write: Firestore
    try {
      await setDoc(doc(db, "notifications", notifId), payload, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore POST /api/notifications note:", fsErr);
    }

    // 2. Dual-write: DynamoDB
    let saved = payload;
    if (dynamoCore.isDynamoConfigured()) {
      try {
        saved = await dynamoService.saveNotification(payload);
      } catch (dErr) {
        console.warn("DynamoDB POST /api/notifications note:", dErr);
      }
    }

    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    console.error("POST /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save notification" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Marks notification as read/unread in both Firestore and DynamoDB.
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const { id, isRead = true } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
    }

    const cleanId = String(id).replace(/^NOTIFICATION#/i, "");

    // 1. Dual-update: Firestore
    try {
      await updateDoc(doc(db, "notifications", cleanId), {
        isRead: Boolean(isRead),
        updatedAt: new Date().toISOString(),
      });
    } catch (fsErr) {
      console.warn("Firestore PATCH /api/notifications note:", fsErr);
    }

    // 2. Dual-update: DynamoDB
    if (dynamoCore.isDynamoConfigured()) {
      try {
        await dynamoService.updateNotificationReadStatus(cleanId, Boolean(isRead));
      } catch (dErr) {
        console.warn("DynamoDB PATCH /api/notifications note:", dErr);
      }
    }

    return NextResponse.json({ success: true, id: cleanId, isRead });
  } catch (error: any) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update notification" },
      { status: 500 }
    );
  }
}
