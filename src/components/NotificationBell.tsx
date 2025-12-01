"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  limit,
  updateDoc,
  query,
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

interface AppNotification {
  id: string;
  title: string;
  body: string;
  url?: string;
  createdAt?: string;
  read: boolean;
}

export function NotificationBell() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Subscribe to notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AppNotification[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data.title || "Notification",
            body: data.body || "",
            url: data.url || "/",
            createdAt: data.createdAt,
            read: !!data.read,
          };
        });
        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading notifications", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Mark all as read when menu opens
  useEffect(() => {
    if (!menuOpen || !user) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    // Fire and forget marking as read
    (async () => {
      try {
        await Promise.all(
          unread.map((n) =>
            updateDoc(doc(db, "users", user.uid, "notifications", n.id), {
              read: true,
            })
          )
        );
      } catch (e) {
        console.error("Failed to mark notifications as read", e);
      }
    })();
  }, [menuOpen, notifications, user]);

  if (!user) {
    return null;
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[360px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {unreadCount} new
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={`flex flex-col items-start gap-1 whitespace-normal ${
                !n.read ? "bg-muted/60" : ""
              }`}
              onClick={() => {
                if (!user) return;
                // Mark this one as read (best-effort)
                if (!n.read) {
                  updateDoc(
                    doc(db, "users", user.uid, "notifications", n.id),
                    { read: true }
                  ).catch((e) =>
                    console.error("Failed to mark single notification read", e)
                  );
                }
                if (n.url) {
                  router.push(n.url);
                }
              }}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium leading-snug">{n.title}</span>
                {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{n.body}</p>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
