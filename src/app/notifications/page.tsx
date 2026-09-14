"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  InAppNotification,
  playNotificationSound,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bell,
  CheckCheck,
  Scale,
  Calendar,
  CreditCard,
  Info,
  ArrowRight,
  Loader2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "dispute" | "booking" | "payout" | "system">("all");
  const [actionLoading, setActionLoading] = useState(false);

  // Track known notification IDs to trigger audio chime only on genuinely NEW arrivals
  const initialLoadDone = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // Listen for auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser: any) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore snapshot for user's notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot: any) => {
        const notifList: InAppNotification[] = snapshot.docs.map((d: any) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId || user.uid,
            title: data.title || "Notification",
            message: data.message || "",
            type: data.type || "system",
            linkUrl: data.linkUrl || "/dashboard",
            isRead: Boolean(data.isRead),
            createdAt: data.createdAt || new Date().toISOString(),
          };
        });

        // Sort descending by createdAt in client to eliminate missing index friction
        notifList.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Check for new incoming unread notifications to play chime
        if (initialLoadDone.current) {
          const hasNewUnread = notifList.some(
            (n) => !knownIdsRef.current.has(n.id) && !n.isRead
          );
          if (hasNewUnread) {
            playNotificationSound();
          }
        } else {
          initialLoadDone.current = true;
        }

        // Update known IDs
        knownIdsRef.current = new Set(notifList.map((n) => n.id));
        setNotifications(notifList);
        setLoading(false);
      },
      (error: any) => {
        console.error("Error loading live notifications:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "all") return true;
    return n.type === activeTab;
  });

  const handleNotificationClick = async (notif: InAppNotification) => {
    try {
      if (!notif.isRead) {
        const notifRef = doc(db, "notifications", notif.id);
        await updateDoc(notifRef, { isRead: true });
      }
    } catch (err) {
      console.warn("Could not mark notification read:", err);
    }

    if (notif.linkUrl) {
      router.push(notif.linkUrl);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    setActionLoading(true);
    try {
      const batch = writeBatch(db);
      const unreadList = notifications.filter((n) => !n.isRead);
      for (const item of unreadList) {
        const ref = doc(db, "notifications", item.id);
        batch.update(ref, { isRead: true });
      }
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const getTypeBadge = (type: InAppNotification["type"]) => {
    switch (type) {
      case "dispute":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-xs">
            <Scale className="h-3 w-3" /> Dispute Notice
          </Badge>
        );
      case "booking":
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1 text-xs">
            <Calendar className="h-3 w-3" /> Booking Update
          </Badge>
        );
      case "payout":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs">
            <CreditCard className="h-3 w-3" /> Payout Notice
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 text-xs">
            <Info className="h-3 w-3" /> System Update
          </Badge>
        );
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return "recently";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Notifications Hub
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Real-time alerts, hearing summons, bookings, and platform updates
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <Badge variant="destructive" className="px-2.5 py-1 text-xs font-semibold rounded-full">
                {unreadCount} unread {unreadCount === 1 ? "alert" : "alerts"}
              </Badge>
            )}
            <Button
              variant="outline"
              size="default"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || actionLoading}
              className="min-h-[44px] py-2.5 px-4 font-medium transition-all shadow-sm"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-2 text-primary" />
              )}
              Mark all as read
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-border/40 pb-4">
          {(
            [
              { key: "all", label: "All Alerts", count: notifications.length },
              { key: "dispute", label: "Disputes & Hearings", count: notifications.filter((n) => n.type === "dispute").length },
              { key: "booking", label: "Bookings", count: notifications.filter((n) => n.type === "booking").length },
              { key: "payout", label: "Payouts", count: notifications.filter((n) => n.type === "payout").length },
              { key: "system", label: "System", count: notifications.filter((n) => n.type === "system").length },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-muted-foreground/15 text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notifications List Content */}
        <div className="mt-6">
          {loadingAuth || loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium">Syncing notification channel...</p>
            </div>
          ) : !user ? (
            <Card className="rounded-2xl border-dashed py-12 text-center">
              <CardContent className="space-y-4">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <h2 className="text-xl font-semibold">Please log in</h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Sign in with your student, manager, or administrator account to view your notifications.
                </p>
                <Button
                  onClick={() => router.push("/login")}
                  className="min-h-[44px] py-2.5 px-6 rounded-xl font-medium"
                >
                  Log In
                </Button>
              </CardContent>
            </Card>
          ) : filteredNotifications.length === 0 ? (
            /* Empty State: Section 3 requirement */
            <Card className="rounded-2xl border-dashed border-border/80 bg-card/60 backdrop-blur-sm py-16 text-center">
              <CardContent className="space-y-4 max-w-md mx-auto">
                <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight">
                  You're all caught up!
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No notifications to show right now. When you receive updates about disputes, hearing summons, bookings, or payouts, they will appear right here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group relative rounded-2xl p-4 sm:p-5 border transition-all duration-200 cursor-pointer ${
                    !notif.isRead
                      ? "bg-primary/[0.04] dark:bg-primary/[0.08] border-primary/40 shadow-sm hover:border-primary/70"
                      : "bg-card border-border/60 hover:border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Unread indicator / type icon */}
                    <div className="mt-1 flex-shrink-0 relative">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                          notif.type === "dispute"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : notif.type === "booking"
                            ? "bg-primary/10 text-primary"
                            : notif.type === "payout"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {notif.type === "dispute" ? (
                          <Scale className="h-5 w-5" />
                        ) : notif.type === "booking" ? (
                          <Calendar className="h-5 w-5" />
                        ) : notif.type === "payout" ? (
                          <CreditCard className="h-5 w-5" />
                        ) : (
                          <Bell className="h-5 w-5" />
                        )}
                      </div>
                      {!notif.isRead && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getTypeBadge(notif.type)}
                          <h4 className="text-base font-semibold text-foreground tracking-tight">
                            {notif.title}
                          </h4>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(notif.createdAt)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-foreground/90 leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:underline">
                          View details <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                        </span>
                        {!notif.isRead && (
                          <span className="text-[11px] text-muted-foreground font-normal">
                            • Click to mark read & navigate
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
