"use client";

import React, { useState, useEffect, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { initOneSignal, subscribeToNotifications, setExternalUserId, isNotificationEnabled } from "@/lib/onesignal";

export const NotificationToggle = forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof Button>>((props, ref) => {
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

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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

  // If no user, render a hidden button to satisfy Radix requirements in asChild
  if (!user) {
    return <button ref={ref} className="hidden" aria-hidden="true" />;
  }

  return (
    <Button
      {...props}
      ref={ref}
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={loading || enabled}
      className="w-full justify-start h-8 px-2"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading Notifications...
        </>
      ) : enabled ? (
        <>
          <Bell className="mr-2 h-4 w-4 text-green-500" />
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
});

NotificationToggle.displayName = "NotificationToggle";
