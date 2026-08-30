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

export function RootLayoutShell({ children }: RootLayoutShellProps) {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Settings for visibility
  const isRoomDetailsPage = /^\/hostels\/[^\/]+\/rooms\/[^\/]+$/.test(pathname);

  const hideFooter =
    FOOTER_HIDDEN_PATHS.includes(pathname) ||
    FOOTER_HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    isRoomDetailsPage;

  // Track user authentication status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  return (
    <MaintenanceGuard>
      <div className="flex min-h-full flex-col pb-20 md:pb-0">
        {children}
        {!hideFooter && <Footer />}
      </div>
    </MaintenanceGuard>
  );
}

