"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Footer } from "@/components/footer";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const FOOTER_HIDDEN_PATHS = [
  "/my-bookings",
  "/payments",
  "/my-roommates",
  "/bank-accounts",
  "/settings",
  "/profile",
  "/signup",
  "/login",
];

const FOOTER_HIDDEN_PREFIXES = [
  "/manager",
  "/admin",
  "/dean",
  "/coordinator",
  "/executive",
];

interface RootLayoutShellProps {
  children: React.ReactNode;
}

import { MaintenanceGuard } from "@/components/maintenance-guard";
import { ShortlistProvider } from "@/components/shortlist-context";

export function RootLayoutShell({ children }: RootLayoutShellProps) {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Settings for visibility
  const isRoomDetailsPage = /^\/hostels\/[^\/]+\/rooms\/[^\/]+$/.test(pathname);

  const hideFooter =
    FOOTER_HIDDEN_PATHS.includes(pathname) ||
    FOOTER_HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    isRoomDetailsPage;

  // Track user authentication status and synchronize session cookie for server-side authorization
  useEffect(() => {
    // Import onIdTokenChanged dynamically or from firebase/auth
    let unsubToken: (() => void) | undefined;
    import("firebase/auth").then(({ onIdTokenChanged }) => {
      unsubToken = onIdTokenChanged(auth, async (user: any) => {
        setIsLoggedIn(!!user);
        if (typeof document !== "undefined") {
          const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
          const secureFlag = isHttps ? "; Secure" : "";
          if (user) {
            try {
              const token = await user.getIdToken();
              document.cookie = `__session=${encodeURIComponent(token)}; path=/; max-age=3600; SameSite=Lax${secureFlag}`;
            } catch (tokenErr) {
              console.warn("Failed to retrieve ID token:", tokenErr);
            }
          } else {
            document.cookie = `__session=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
          }
        }
      });
    });

    return () => {
      if (unsubToken) unsubToken();
    };
  }, []);

  return (
    <MaintenanceGuard>
      <ShortlistProvider>
        <div className="flex min-h-full flex-col pb-20 md:pb-0">
          {children}
          {!hideFooter && <Footer />}
        </div>
      </ShortlistProvider>
    </MaintenanceGuard>
  );
}

