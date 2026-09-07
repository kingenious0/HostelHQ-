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
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
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
  Loader2,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DynamicBankAccount {
  id: string;
  type?: "bank" | "momo";
  bankName?: string;
  branch?: string;
  accountNumber: string;
  accountName: string;
  momoNetwork?: string;
  momoNumber?: string;
  momoName?: string;
  hostelId?: string;
  hostelName?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  status?: string;
}

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

  // Dynamic bank accounts loaded from Firestore
  const [bankAccounts, setBankAccounts] = useState<DynamicBankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

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

  // Query Firestore collection("bankAccounts") dynamically
  useEffect(() => {
    setLoadingAccounts(true);
    const unsubscribeAccounts = onSnapshot(
      collection(db, "bankAccounts"),
      async (snapshot) => {
        try {
          const rawAccounts: DynamicBankAccount[] = [];
          const hostelIdSet = new Set<string>();

          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            // Ignore explicitly inactive accounts
            if (data.isActive !== false && data.status !== "inactive") {
              const accNumber = data.accountNumber || data.momoNumber || "";
              const accName = data.accountName || data.momoName || "";
              const bankOrNetwork =
                data.bankName ||
                (data.type === "momo" ? data.momoNetwork : "") ||
                (data.type === "bank" ? "Standard Bank" : "Mobile Money");

              if (accNumber) {
                const account: DynamicBankAccount = {
                  id: docSnap.id,
                  type: data.type || "bank",
                  bankName: bankOrNetwork,
                  branch: data.branch || "",
                  accountNumber: String(accNumber),
                  accountName: accName || "Official Account",
                  hostelId: data.hostelId || "",
                  hostelName: data.hostelName || "",
                  isPrimary: !!data.isPrimary,
                };

                rawAccounts.push(account);
                if (account.hostelId && !account.hostelName) {
                  hostelIdSet.add(account.hostelId);
                }
              }
            }
          });

          // Resolve hostel names asynchronously if missing
          const hostelNameMap: Record<string, string> = {};
          if (hostelIdSet.size > 0) {
            await Promise.all(
              Array.from(hostelIdSet).map(async (hId) => {
                try {
                  const hSnap = await getDoc(doc(db, "hostels", hId));
                  if (hSnap.exists()) {
                    hostelNameMap[hId] = hSnap.data().name || "";
                  }
                } catch {
                  // Fail gracefully
                }
              })
            );
          }

          const enriched = rawAccounts.map((acc) => ({
            ...acc,
            hostelName:
              acc.hostelName ||
              (acc.hostelId ? hostelNameMap[acc.hostelId] : "") ||
              "HostelHQ Central Escrow",
          }));

          setBankAccounts(enriched);
        } catch (err) {
          console.error("Error fetching bankAccounts from Firestore:", err);
          setBankAccounts([]);
        } finally {
          setLoadingAccounts(false);
        }
      },
      (error) => {
        console.error("Firestore onSnapshot error on bankAccounts:", error);
        setLoadingAccounts(false);
      }
    );

    return () => unsubscribeAccounts();
  }, []);

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

      {/* Dynamic Bank Accounts Loading / Empty / Populated */}
      {loadingAccounts ? (
        <Card className="border border-border/80 shadow-sm rounded-3xl p-12 text-center bg-card">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium">
              Querying verified institutional bank accounts...
            </p>
          </div>
        </Card>
      ) : bankAccounts.length === 0 ? (
        /* Clean Empty State: No documents exist in Firestore */
        <Card className="border border-border/80 shadow-sm rounded-3xl overflow-hidden bg-card text-card-foreground">
          <CardHeader className="border-b border-border/50 bg-muted/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">No Traditional Bank Accounts Configured</CardTitle>
                <CardDescription className="text-xs">
                  Manual counter deposit routing is currently inactive for this campus.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-6 text-center sm:text-left">
            <div className="space-y-2">
              <p className="text-sm text-foreground font-medium">
                No active bank or counter deposit accounts have been configured by the hostel administration yet.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                To guarantee your bed reservation without physical bank teller delays, please use automated Paystack
                checkout. Payments via MTN Mobile Money, Telecel Cash, AT Money, and Visa/Mastercard are verified
                instantly.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button asChild className="rounded-xl gap-2 w-full sm:w-auto font-semibold">
                <Link href="/my-bookings">
                  <Zap className="h-4 w-4" />
                  <span>Use Automated Paystack Checkout</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl gap-2 w-full sm:w-auto">
                <Link href="/hostels">
                  <span>Explore Verified Hostels</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Populated Dynamic Bank Accounts */
        <Card className="border border-border/80 shadow-sm rounded-3xl overflow-hidden bg-card text-card-foreground">
          <CardHeader className="border-b border-border/50 bg-muted/40">
            <div className="flex items-center justify-between gap-3">
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
              <Badge variant="outline" className="text-[11px] font-semibold">
                {bankAccounts.length} {bankAccounts.length === 1 ? "Account" : "Accounts"} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {bankAccounts.map((account) => {
              const displayBankName = account.branch
                ? `${account.bankName} — ${account.branch}`
                : account.bankName || "Official Bank Account";
              const copyLabel = `${account.bankName || "Account"} (${account.accountNumber.slice(-4)})`;

              return (
                <div
                  key={account.id}
                  className="p-4 rounded-2xl border border-border/60 bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {account.type === "momo" ? "Mobile Money Account" : "Institution / Bank"}
                      </span>
                      {account.isPrimary && (
                        <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px] font-bold py-0 h-4">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{displayBankName}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-foreground font-mono">
                      <span>
                        Account No: <strong>{account.accountNumber}</strong>
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span>
                        Name: <strong>{account.accountName}</strong>
                      </span>
                      {account.hostelName && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground font-sans text-[11px]">
                            Hostel: <strong className="text-foreground">{account.hostelName}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    className="rounded-xl gap-1.5 shrink-0 w-full sm:w-auto"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(account.accountNumber, copyLabel)}
                  >
                    {copiedCode === copyLabel ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span>{copiedCode === copyLabel ? "Copied" : "Copy Account"}</span>
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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
              When depositing at branch counters, request the teller to insert your{" "}
              <strong>Student Name & Booking Reference ID</strong> on the deposit slip. Retain the stamped duplicate copy
              for verification.
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>Direct Bank Wire & counter clearing takes 12–24 hours</span>
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
                      const isActive =
                        pathname === item.href ||
                        (item.href === "/bank-accounts" && pathname === "/bank/accounts");
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
