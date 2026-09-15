"use client";

import { useEffect, useRef } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { playNotificationChime } from "@/utils/sound";
import { useToast } from "@/hooks/use-toast";

export interface UseLiveNotificationsOptions {
  enableSound?: boolean;
  enableToast?: boolean;
}

export function useLiveNotifications(
  userId: string | null | undefined,
  options: UseLiveNotificationsOptions = {}
) {
  const { enableSound = true, enableToast = true } = options;
  const { toast } = useToast();
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (!userId) {
      initialLoadRef.current = true;
      return;
    }

    initialLoadRef.current = true;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("isRead", "==", false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot: any) => {
        // Skip sound and toast firing on the very first initial snapshot load
        if (initialLoadRef.current) {
          initialLoadRef.current = false;
          return;
        }

        // Check if a brand new unread notification document was added
        snapshot.docChanges().forEach((change: any) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const title = data.title || "New Notification";
            const message = data.message || data.body || "";

            if (enableSound) {
              playNotificationChime();
            }

            if (enableToast) {
              toast({
                title: `🔔 ${title}`,
                description: message,
              });
            }
          }
        });
      },
      (err: any) => {
        console.warn("useLiveNotifications listener note:", err);
      }
    );

    return () => unsubscribe();
  }, [userId, enableSound, enableToast, toast]);
}
