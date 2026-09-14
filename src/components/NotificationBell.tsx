"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Loader2, ExternalLink, Sparkles } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  playNotificationSound,
  InAppNotification,
  markNotificationAsRead,
  fetchUserNotifications,
} from "@/lib/notifications";

export function NotificationBell() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const initialLoadDone = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u: any) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Subscribe to persistent in-app notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Query notifications collection where userId == user.uid
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid)
    );

    // Dual-database fetch to merge DynamoDB items
    fetchUserNotifications(user.uid)
      .then((items) => {
        if (items && items.length > 0) {
          setNotifications((prev) => {
            const map = new Map<string, InAppNotification>();
            for (const x of [...prev, ...items]) {
              if (x.id) map.set(x.id, x);
            }
            const sorted = Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            return sorted;
          });
        }
      })
      .catch((e) => console.warn("Initial dual notifications bell fetch note:", e));

    const unsub = onSnapshot(
      q,
      (snap: any) => {
        const list: InAppNotification[] = snap.docs.map((d: any) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId || user.uid,
            title: data.title || "Notification",
            message: data.message || data.body || "",
            type: data.type || "system",
            linkUrl: data.linkUrl || data.url || "/dashboard",
            isRead: Boolean(data.isRead || data.read),
            createdAt: data.createdAt || new Date().toISOString(),
          };
        });

        // Client-side sort descending by createdAt
        list.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Chime if new unread notification arrives
        if (initialLoadDone.current) {
          const hasNewUnread = list.some(
            (n) => !knownIdsRef.current.has(n.id) && !n.isRead
          );
          if (hasNewUnread) {
            playNotificationSound();
          }
        } else {
          initialLoadDone.current = true;
        }

        knownIdsRef.current = new Set(list.map((n) => n.id));
        setNotifications(list);
        setLoading(false);
      },
      (err: any) => {
        console.error("Error loading notifications in bell", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (!user) {
    return null;
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-[44px] min-w-[44px] rounded-full"
          aria-label="Notifications"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 max-h-[420px] overflow-y-auto rounded-2xl p-2 shadow-2xl border-border/60">
        <DropdownMenuLabel className="flex items-center justify-between py-2 px-3">
          <span className="font-semibold text-sm">Notifications</span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-full font-semibold">
                {unreadCount} new
              </Badge>
            )}
            <Link
              href="/notifications"
              onClick={() => setMenuOpen(false)}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium ml-1"
            >
              View Hub <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center px-4 space-y-2">
            <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">You're all caught up!</p>
            <p className="text-xs text-muted-foreground">No alerts right now.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.slice(0, 5).map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl cursor-pointer whitespace-normal transition-colors ${
                  !n.isRead ? "bg-primary/[0.06] hover:bg-primary/[0.1] font-medium" : "hover:bg-muted/60"
                }`}
                onClick={async () => {
                  setMenuOpen(false);
                  if (!n.isRead) {
                    try {
                      await markNotificationAsRead(n.id, true);
                    } catch (e) {
                      console.error("Failed to mark single notification read", e);
                    }
                  }
                  if (n.linkUrl) {
                    router.push(n.linkUrl);
                  }
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold leading-snug line-clamp-1">{n.title}</span>
                  {!n.isRead && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{n.message}</p>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        <div className="p-1">
          <Button
            variant="ghost"
            className="w-full text-xs min-h-[40px] text-primary hover:text-primary justify-center font-medium rounded-xl"
            asChild
            onClick={() => setMenuOpen(false)}
          >
            <Link href="/notifications">
              Open Full Notification Center
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
