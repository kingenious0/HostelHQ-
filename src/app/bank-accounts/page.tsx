"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarInset,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Building2,
  Copy,
  CheckCircle2,
  ShieldCheck,
  Landmark,
  Calendar,
  CreditCard,
  Users,
  Banknote,
  Settings,
  LogOut,
  AlertTriangle,
  ArrowRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppUser {
  uid: string;
  email: string;
  fullName: string;
  role: string;
  profileImage?: string;
  phone?: string;
}

export default function StudentBankAccountsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Track auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
      if (!user) {
        setAppUser(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Fetch student profile details if logged in
  useEffect(() => {
    if (!currentUser) return;

    const userDocRef = doc(db, "users", currentUser.uid);
    const unsubscribeUserProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data() as AppUser;
        setAppUser({
          uid: currentUser.uid,
          email: currentUser.email || "",
          fullName: userData.fullName || currentUser.displayName || "",
          role: userData.role || "student",
          profileImage: userData.profileImage || currentUser.photoURL || "",
          phone: userData.phone || "",
        });
      } else {
        setAppUser(null);
      }
    });

    return () => unsubscribeUserProfile();
  }, [currentUser]);

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedCode(label);
    toast({
      title: "Copied to clipboard",
      description: `${label} has been copied successfully.`,
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const navItems = [
    { label: "My Bookings", href: "/my-bookings", icon: Calendar },
    { label: "Payments", href: "/payments", icon: CreditCard },
    { label: "My Roommates", href: "/my-roommates", icon: Users },
    { label: "Bank Accounts", href: "/bank-accounts", icon: Banknote },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  // Core Content Card Components
  const PageContent = () => (
    <div className="container mx-auto max-w-4xl py-6 sm:py-10 px-4 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-foreground">
          Official Hostel Bank Accounts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verified traditional bank routing details for direct counter deposits, wire transfers, and corporate sponsorships.
        </p>
      </div>

      {/* Traditional Bank Accounts Card */}
      <Card className="border border-border/80 shadow-sm rounded-3xl overflow-hidden bg-card text-card-foreground">
        <CardHeader className="border-b border-border/50 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Standard Bank Deposit Protocol</CardTitle>
              <CardDescription className="text-xs">
                Always include your student booking reference as the transfer narration.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Ghana Commercial Bank (GCB) */}
          <div className="p-4 rounded-2xl border border-border/60 bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Institution / Bank</span>
              <p className="text-sm font-semibold text-foreground">Ghana Commercial Bank (GCB) — KNUST Branch</p>
              <div className="flex items-center gap-3 pt-1 text-xs text-foreground font-mono">
                <span>
                  Account No: <strong>1151000048291</strong>
                </span>
                <span className="text-muted-foreground">•</span>
                <span>
                  Name: <strong>Kingenious Hostel Ltd</strong>
                </span>
              </div>
            </div>
            <Button
              className="rounded-xl gap-1.5 shrink-0"
              size="sm"
              variant="outline"
              onClick={() => handleCopy("1151000048291", "Account Number")}
            >
              {copiedCode === "Account Number" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span>{copiedCode === "Account Number" ? "Copied" : "Copy Account"}</span>
            </Button>
          </div>

          {/* Ecobank Ghana */}
          <div className="p-4 rounded-2xl border border-border/60 bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Institution / Bank</span>
              <p className="text-sm font-semibold text-foreground">Ecobank Ghana — Ayeduase Branch</p>
              <div className="flex items-center gap-3 pt-1 text-xs text-foreground font-mono">
                <span>
                  Account No: <strong>1441002938471</strong>
                </span>
                <span className="text-muted-foreground">•</span>
                <span>
                  Name: <strong>HostelHQ Escrow Trust</strong>
                </span>
              </div>
            </div>
            <Button
              className="rounded-xl gap-1.5 shrink-0"
              size="sm"
              variant="outline"
              onClick={() => handleCopy("1441002938471", "Ecobank Account")}
            >
              {copiedCode === "Ecobank Account" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span>{copiedCode === "Ecobank Account" ? "Copied" : "Copy Account"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Automated Settlement vs Manual Deposit Guidance */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Paystack Automated Clearance */}
        <Card className="border border-border/80 shadow-sm rounded-3xl overflow-hidden bg-card text-card-foreground">
          <CardHeader className="border-b border-border/50 bg-muted/40 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Instant Paystack Settlement</CardTitle>
                <CardDescription className="text-xs">Recommended for fast bed reservation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pay securely via <strong>MTN Mobile Money, Telecel Cash, AT Money, Visa, or Mastercard</strong>. Your bed
              allocation and official tenancy receipt are confirmed in real time.
            </p>
            <Button asChild size="sm" className="w-full rounded-xl gap-2 font-semibold">
              <Link href="/my-bookings">
                <span>Go to My Bookings</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Counter Deposit & Wire Verification */}
        <Card className="border border-border/80 shadow-sm rounded-3xl overflow-hidden bg-card text-card-foreground">
          <CardHeader className="border-b border-border/50 bg-muted/40 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Counter Deposit Verification</CardTitle>
                <CardDescription className="text-xs">Direct teller deposit requirements</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              When depositing at GCB or Ecobank branches, request the teller to insert your{" "}
              <strong>Student Name & Booking Reference ID</strong> on the deposit slip. Retain the stamped duplicate copy
              for verification.
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>Direct Bank Wire &counter clearing takes 12–24 hours</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert className="rounded-3xl border-border/60 bg-muted/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-xs font-bold uppercase tracking-wider text-foreground">Anti-Fraud Advisory</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground mt-0.5">
          Only make payments to the verified institutional accounts listed above. HostelHQ and partnered halls will
          never request payments to personal third-party accounts.
        </AlertDescription>
      </Alert>
    </div>
  );

  // If user is authenticated as a student/member, wrap in dashboard SidebarProvider
  if (!loadingAuth && currentUser) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <Sidebar collapsible="icon" className="border-r border-border/50 bg-card/50 backdrop-blur-xl">
            <SidebarHeader className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-primary/10">
                  {appUser?.profileImage ? (
                    <AvatarImage src={appUser.profileImage} />
                  ) : (
                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                      {appUser?.fullName?.charAt(0) || "U"}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
                  <span className="font-bold text-sm truncate">{appUser?.fullName || "Student"}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{appUser?.email}</span>
                </div>
              </div>
            </SidebarHeader>
            <SidebarSeparator className="opacity-50" />
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-2">
                  Account
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navItems.map((item) => {
                      const isActive = pathname === item.href || (item.href === "/bank-accounts" && pathname === "/bank/accounts");
                      return (
                        <SidebarMenuItem key={item.label}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={cn(
                              "transition-all duration-200",
                              isActive
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "hover:bg-primary/5 hover:text-primary"
                            )}
                          >
                            <Link href={item.href} className="flex items-center gap-3 py-6">
                              <item.icon className="h-4 w-4" />
                              <span className="font-medium">{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={async () => {
                          await firebaseSignOut(auth);
                          router.push("/login");
                        }}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <LogOut className="h-4 w-4" />
                        <span className="font-medium">Sign Out</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarRail />
          </Sidebar>

          <SidebarInset className="flex flex-col min-w-0">
            <Header />
            <main className="flex-1 overflow-x-hidden pt-4 pb-24 md:pb-8">
              <PageContent />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  // Standalone Layout (Public / Unauthenticated / Direct Link Access)
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 overflow-x-hidden pt-4 pb-16">
        <PageContent />
      </main>
    </div>
  );
}
