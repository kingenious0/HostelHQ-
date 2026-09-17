import { db } from "./firebase";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export interface InAppNotification {
  id: string;
  userId: string; // recipient user ID (student or manager)
  title: string;
  message: string;
  type: "dispute" | "booking" | "payout" | "system";
  linkUrl?: string; // e.g. "/student/dashboard" or "/manager/dashboard"
  isRead: boolean;
  createdAt: string;
}

/**
 * Normalizes a phone number to standard Ghanaian 233 format
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.trim().replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // 024XXXXXXX (10 digits) -> 23324XXXXXXX
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "233" + cleaned.substring(1);
  }

  // 24XXXXXXX (9 digits) -> 23324XXXXXXX
  if (cleaned.length === 9) {
    return "233" + cleaned;
  }

  // Already 233XXXXXXXXX
  if (cleaned.startsWith("233")) {
    return cleaned;
  }

  return cleaned;
}

import { playNotificationChime } from "@/utils/sound";
export { playNotificationChime };

/**
 * Lightweight, zero-dependency audio alert using Web Audio API
 * Plays a pleasant rising two-note chime (E5 -> G5)
 */
export function playNotificationSound(): void {
  playNotificationChime();
}

/**
 * Client & server helper to dispatch SMS via the FrogWigal gateway endpoint
 */
export async function sendSmsNotification({
  recipientPhone,
  message,
}: {
  recipientPhone: string;
  message: string;
}): Promise<any> {
  const formattedPhone = normalizePhoneNumber(recipientPhone);

  try {
    const res = await fetch("/api/notifications/sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipientPhone: formattedPhone,
        message,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`[SMS Service Note]: ${errorText}`);
      return { success: false, error: errorText };
    }

    const data = await res.json();
    if (!data.success) {
      console.warn(`[SMS Gateway Note]: ${data.error || "Delivery pending or unconfirmed"}`);
    }
    return data;
  } catch (err: any) {
    console.warn(`SMS dispatch encountered notice: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Writes persistent in-app notification to BOTH Firestore notifications collection
 * and AWS DynamoDB (dual-database synchronization).
 */
export async function dispatchInAppNotification({
  userId,
  title,
  message,
  type = "system",
  linkUrl = "/dashboard",
  id,
}: {
  userId: string;
  title: string;
  message: string;
  type: "dispute" | "booking" | "payout" | "system";
  linkUrl?: string;
  id?: string;
}): Promise<string | null> {
  if (!userId) {
    console.warn("dispatchInAppNotification: userId is required");
    return null;
  }

  const notifId = id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const notifData: InAppNotification = {
    id: notifId,
    userId,
    title,
    message,
    type,
    linkUrl,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  // 1. Dual-write to Firebase Firestore
  try {
    await setDoc(doc(db, "notifications", notifId), notifData, { merge: true });
  } catch (fsErr) {
    console.warn("Firestore in-app notification write note:", fsErr);
  }

  // 2. Dual-write to AWS DynamoDB
  try {
    if (typeof window === "undefined") {
      const { saveNotification } = await import("./dynamodb-service");
      await saveNotification(notifData);
    } else {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifData),
      });
    }
  } catch (dynErr) {
    console.warn("DynamoDB notification write note:", dynErr);
  }

  return notifId;
}

/**
 * Fetches notifications for a user by merging records from both DynamoDB and Firestore
 */
export async function fetchUserNotifications(userId: string): Promise<InAppNotification[]> {
  if (!userId) return [];

  let dynamoItems: InAppNotification[] = [];
  let firestoreItems: InAppNotification[] = [];

  // 1. Fetch from DynamoDB API
  try {
    const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        dynamoItems = json.data;
      }
    }
  } catch (err) {
    console.warn("DynamoDB fetchUserNotifications note:", err);
  }

  // 2. Fetch from Firestore
  try {
    const notifsRef = collection(db, "notifications");
    const q = query(notifsRef, where("userId", "==", userId));
    const snap = await getDocs(q);
    firestoreItems = snap.docs.map((d: any) => ({
      id: d.id,
      ...(d.data() as Omit<InAppNotification, "id">),
    }));
  } catch (err) {
    console.warn("Firestore fetchUserNotifications note:", err);
  }

  // 3. Deduplicate and merge by ID
  const map = new Map<string, InAppNotification>();
  for (const item of [...dynamoItems, ...firestoreItems]) {
    const key = item.id;
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        ...item,
        isRead: existing.isRead || item.isRead,
      });
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return merged;
}

/**
 * Marks notification as read in BOTH Firestore and DynamoDB
 */
export async function markNotificationAsRead(id: string, isRead: boolean = true): Promise<void> {
  const cleanId = id.replace(/^NOTIFICATION#/i, "");

  // 1. Dual-update in Firestore
  try {
    await updateDoc(doc(db, "notifications", cleanId), {
      isRead,
      updatedAt: new Date().toISOString(),
    });
  } catch (fsErr) {
    console.warn("Firestore markNotificationAsRead note:", fsErr);
  }

  // 2. Dual-update in DynamoDB
  try {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cleanId, isRead }),
    });
  } catch (dynErr) {
    console.warn("DynamoDB markNotificationAsRead note:", dynErr);
  }
}

/**
 * Dispatches formal Dean Summons:
 * - Role-specific FrogWigal SMS templates to student & manager
 * - Persistent in-app notifications in Firestore notifications collection
 */
export async function dispatchDeanSummons({
  studentPhone,
  studentId,
  managerPhone,
  managerId,
  hostelName,
  hearingDate,
  venue,
  summonsNote,
}: {
  studentPhone: string;
  studentId: string;
  managerPhone: string;
  managerId: string;
  hostelName: string;
  hearingDate: string;
  venue: string;
  summonsNote?: string;
}): Promise<void> {
  // 1. Student Message
  const studentSms =
    summonsNote?.trim() ||
    `[HostelHQ] Dean of Students: Your reported dispute regarding ${hostelName} has been scheduled for a meeting. Date: ${hearingDate}. Venue: ${venue}. Check your dashboard.`;

  // 2. Manager Message (with consequence warning)
  const managerSms =
    summonsNote?.trim() ||
    `[HostelHQ] Dean of Students Notice: A formal student complaint has been logged against ${hostelName}. Mandatory meeting: ${hearingDate} at ${venue}. Failure to attend will lead to listing suspension.`;

  // Dispatch via FrogWigal SMS Gateway (concurrently)
  const smsPromises: Promise<any>[] = [];
  if (studentPhone) {
    smsPromises.push(sendSmsNotification({ recipientPhone: studentPhone, message: studentSms }));
  }
  if (managerPhone) {
    smsPromises.push(sendSmsNotification({ recipientPhone: managerPhone, message: managerSms }));
  }

  // Dispatch In-App Notifications (concurrently)
  const inAppPromises: Promise<any>[] = [];
  if (studentId) {
    inAppPromises.push(
      dispatchInAppNotification({
        userId: studentId,
        title: "Dean's Meeting Scheduled",
        message: `A meeting regarding ${hostelName} is scheduled for ${hearingDate} at ${venue}. Check your dashboard.`,
        type: "dispute",
        linkUrl: "/dashboard",
      })
    );
  }
  if (managerId) {
    inAppPromises.push(
      dispatchInAppNotification({
        userId: managerId,
        title: "Mandatory Dean's Notice: Complaint Hearing",
        message: `A formal hearing regarding ${hostelName} has been scheduled for ${hearingDate} at ${venue}. Mandatory attendance to avoid listing suspension.`,
        type: "dispute",
        linkUrl: "/manager/dashboard",
      })
    );
  }

  await Promise.allSettled([...smsPromises, ...inAppPromises]);
}
