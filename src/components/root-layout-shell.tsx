"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Footer } from "@/components/footer";

const FOOTER_HIDDEN_PATHS = [
  "/my-bookings",
  "/payments",
  "/my-roommates",
  "/bank-accounts",
  "/settings",
  "/profile",
  "/signup",
];

const FOOTER_HIDDEN_PREFIXES = [
  "/manager",
  "/admin",
  "/agent",
];

interface RootLayoutShellProps {
  children: React.ReactNode;
}

export function RootLayoutShell({ children }: RootLayoutShellProps) {
  const pathname = usePathname();
  const hideFooter =
    FOOTER_HIDDEN_PATHS.includes(pathname) ||
    FOOTER_HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  return (
    <div className="flex min-h-full flex-col">
      {children}
      {!hideFooter && <Footer />}
    </div>
  );
}
