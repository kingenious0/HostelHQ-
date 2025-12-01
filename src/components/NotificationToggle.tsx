"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { initOneSignal, subscribeToNotifications, setExternalUserId, isNotificationEnabled } from "@/lib/onesignal";

export function NotificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Initialize OneSignal and check status
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        await initOneSignal();
        const isEnabled = await isNotificationEnabled();
        setEnabled(isEnabled);
        
        // Link OneSignal to Firebase user ID
        if (isEnabled) {
          await setExternalUserId(user.uid);
        }
      } catch (error) {
        console.error('[NotificationToggle] Init error:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleToggle = async () => {
    if (!user) {
      alert("Please log in to enable notifications");
      return;
    }

    setLoading(true);
    try {
      const playerId = await subscribeToNotifications();
      if (playerId) {
        await setExternalUserId(user.uid);
        setEnabled(true);
        alert("Notifications enabled! 🎉");
      } else {
        alert("Failed to enable notifications. Please check your browser settings.");
      }
    } catch (error) {
      console.error("[NotificationToggle] Error:", error);
      alert("Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={loading || enabled}
      className="w-full justify-start"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : enabled ? (
        <>
          <Bell className="mr-2 h-4 w-4" />
          Notifications Enabled
        </>
      ) : (
        <>
          <BellOff className="mr-2 h-4 w-4" />
          Enable Notifications
        </>
      )}
    </Button>
  );
}
