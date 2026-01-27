"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Footer } from "@/components/footer";
import { AIAssistant } from "@/components/AIAssistant";
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
  "/agent",
];

interface RootLayoutShellProps {
  children: React.ReactNode;
}

export function RootLayoutShell({ children }: RootLayoutShellProps) {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Settings for visibility
  const isRoomDetailsPage = /^\/hostels\/[^\/]+\/rooms\/[^\/]+$/.test(pathname);
  const isHostelDetailPage = /^\/hostels\/[^\/]+$/.test(pathname);
  const CHATBOT_VISIBLE_PATHS = ["/faq", "/help-center", "/contact"];

  const hideFooter =
    FOOTER_HIDDEN_PATHS.includes(pathname) ||
    FOOTER_HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    isRoomDetailsPage;

  const showChatbot = CHATBOT_VISIBLE_PATHS.includes(pathname) || isHostelDetailPage;

  // Track user authentication status for AI context
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  // Extract context from current path
  const userContext = React.useMemo(() => {
    const hostelMatch = pathname.match(/^\/hostels\/([^\/]+)/);
    const roomMatch = pathname.match(/^\/hostels\/[^\/]+\/rooms\/([^\/]+)/);

    return {
      isLoggedIn,
      hostelId: hostelMatch?.[1],
      roomId: roomMatch?.[1],
    };
  }, [pathname, isLoggedIn]);

  return (
    <div className="flex min-h-full flex-col">
      {children}
      {!hideFooter && <Footer />}
      {showChatbot && <AIAssistant userContext={userContext} />}
    </div>
  );
}
