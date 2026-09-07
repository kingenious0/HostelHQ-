"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from "firebase/auth";
import { collection, onSnapshot, doc, getDoc, query, where } from "firebase/firestore";
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
  Smartphone,
  AlertCircle,
  Check,
  Star,
  ExternalLink,
  Filter,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DynamicBankAccount {
  id: string;
  type?: "bank" | "momo";
  bankName?: string;
  bankCode?: string;
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
  isVerified?: boolean;
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

interface HostelOption {
  id: string;
  name: string;
}

function StudentBankAccountsContent() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Dynamic bank accounts loaded from Firestore
  const [bankAccounts, setBankAccounts] = useState<DynamicBankAccount[]>([]);
  const [hostelOptions, setHostelOptions] = useState<HostelOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Filter state
  const initialHostelParam = searchParams.get("hostelId") || searchParams.get("hostel") || "all";
  const [selectedHostelId, setSelectedHostelId] = useState<string>(initialHostelParam);
  const [typeFilter, setTypeFilter] = useState<"all" | "bank" | "momo">("all");

  // Keep state in sync if query param changes
  useEffect(() => {
    const param = searchParams.get("hostelId") || searchParams.get("hostel");
    if (param) {
      setSelectedHostelId(param);
    }
  }, [searchParams]);

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

  // Query Firestore collection("hostels") to populate hostel selector options
  useEffect(() => {
    const unsubscribeHostels = onSnapshot(
      collection(db, "hostels"),
      (snapshot) => {
        const list: HostelOption[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          name: docSnap.data().name || "Unnamed Hostel",
        }));
        setHostelOptions(list);
      },
      (err) => {
        console.warn("Could not stream hostels collection:", err);
      }
    );
    return () => unsubscribeHostels();
  }, []);

  // Query Firestore collection("bankAccounts") dynamically in REAL TIME
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
              const isMomo = data.type === "momo" || !!data.momoNumber;
              const bankOrNetwork =
                data.bankName ||
                (isMomo ? data.momoNetwork || "Mobile Money" : "Ghana Commercial Bank");

              if (accNumber) {
                const account: DynamicBankAccount = {
                  id: docSnap.id,
                  type: isMomo ? "momo" : "bank",
                  bankName: bankOrNetwork,
                  bankCode: data.bankCode,
                  branch: data.branch || "",
                  accountNumber: String(accNumber),
                  accountName: accName || "Official Account",
                  momoNetwork: data.momoNetwork,
                  momoNumber: data.momoNumber,
                  momoName: data.momoName,
                  hostelId: data.hostelId || "",
                  hostelName: data.hostelName || "",
                  isPrimary: !!data.isPrimary,
                  isVerified: !!(data.isVerified || data.verifiedViaPaystack),
                };

                rawAccounts.push(account);
                if (account.hostelId && account.hostelId !== "all" && !account.hostelName) {
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
              (acc.hostelId && acc.hostelId !== "all" ? hostelNameMap[acc.hostelId] : "") ||
              "All Campus Hostels",
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

  // Filter accounts based on selected hostel & type
  const filteredAccounts = useMemo(() => {
    return bankAccounts.filter((acc) => {
      // Hostel filter
      if (selectedHostelId !== "all") {
        const matchesHostel =
          acc.hostelId === selectedHostelId ||
          acc.hostelId === "all" ||
          !acc.hostelId;
        if (!matchesHostel) return false;
      }

      // Type filter
      if (typeFilter !== "all") {
        if (acc.type !== typeFilter) return false;
      }

      return true;
    });
  }, [bankAccounts, selectedHostelId, typeFilter]);

  // Selected hostel name for display
  const selectedHostelName = useMemo(() => {
    if (selectedHostelId === "all") return "All Campus Hostels";
    const foundInOptions = hostelOptions.find((h) => h.id === selectedHostelId);
    if (foundInOptions) return foundInOptions.name;
    const foundInAccounts = bankAccounts.find((a) => a.hostelId === selectedHostelId);
    if (foundInAccounts?.hostelName) return foundInAccounts.hostelName;
    return "Selected Hostel";
  }, [selectedHostelId, hostelOptions, bankAccounts]);

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedCode(label);
    toast({
      title: "Copied to clipboard",
      description: `${label} copied successfully.`,
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
      {/* Title & Introduction */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-semibold text-primary border-primary/30">
            Real-Time Property Accounts
          </Badge>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">Direct Physical Deposit & MoMo</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-foreground">
          Official Hostel Bank & Payment Accounts
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Verified bank routing details (GCB, Ecobank, etc.) and Mobile Money numbers managed directly by hostel operators for wire transfers, counter deposits, and corporate sponsorships.
        </p>
      </div>

      {/* Hostel Selection & Category Strip */}
      <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Hostel Filter Dropdown */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                Select Hostel:
              </span>
            </div>
            <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
              <SelectTrigger className="w-full sm:w-[280px] h-9 text-xs rounded-xl font-medium">
                <SelectValue placeholder="Select Hostel Property" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-60">
                <SelectItem value="all">All Campus Hostels</SelectItem>
                {hostelOptions.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedHostelId !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedHostelId("all")}
                className="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground rounded-lg"
              >
                Reset Filter
              </Button>
            )}
          </div>

          {/* Type Filter Tabs */}
          <Tabs
            value={typeFilter}
            onValueChange={(v: string) => setTypeFilter(v as any)}
            className="w-auto shrink-0"
          >
            <TabsList className="h-9 p-1 rounded-xl bg-muted/60">
              <TabsTrigger value="all" className="text-xs rounded-lg px-3">
                All
              </TabsTrigger>
              <TabsTrigger value="bank" className="text-xs rounded-lg px-3">
                Banks
              </TabsTrigger>
              <TabsTrigger value="momo" className="text-xs rounded-lg px-3">
                MoMo
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>

      {/* Selected Hostel Notice Pill */}
      {selectedHostelId !== "all" && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/5 border border-primary/20 text-xs">
          <div className="flex items-center gap-2 text-foreground font-medium truncate">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span>Showing verified accounts configured for: <strong>{selectedHostelName}</strong></span>
          </div>
          <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary shrink-0">
            {filteredAccounts.length} {filteredAccounts.length === 1 ? "Account" : "Accounts"}
          </Badge>
        </div>
      )}

      {/* Dynamic Bank Accounts Loading / Empty / Populated */}
      {loadingAccounts ? (
        <Card className="border border-border/80 shadow-sm rounded-3xl p-12 text-center bg-card">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium">
              Fetching verified manager payment accounts in real time...
            </p>
          </div>
        </Card>
      ) : filteredAccounts.length === 0 ? (
        /* Empty State */
        <Card className="border border-border/80 shadow-sm rounded-3xl overflow-hidden bg-card text-card-foreground">
          <CardHeader className="border-b border-border/50 bg-muted/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">
                  {selectedHostelId !== "all"
                    ? `No Direct Bank Records for ${selectedHostelName}`
                    : "No Traditional Bank Accounts Configured"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedHostelId !== "all"
                    ? "The manager of this property has not published traditional counter deposit details yet."
                    : "No physical bank accounts or manual Mobile Money lines have been published yet."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-6 text-center sm:text-left">
            <div className="space-y-2">
              <p className="text-sm text-foreground font-medium">
                To guarantee your bed reservation without physical bank delays, use automated Paystack checkout.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Payments via MTN Mobile Money, Telecel Cash, AT Money, and Visa/Mastercard are verified instantly and issue an immediate official institutional rent receipt.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button asChild className="rounded-xl gap-2 w-full sm:w-auto font-semibold">
                <Link href="/my-bookings">
                  <Zap className="h-4 w-4" />
                  <span>Use Automated Paystack Checkout</span>
                </Link>
              </Button>
              {selectedHostelId !== "all" && (
                <Button
                  variant="outline"
                  onClick={() => setSelectedHostelId("all")}
                  className="rounded-xl gap-2 w-full sm:w-auto"
                >
                  <span>View All Hostels</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
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
                  <CardTitle className="text-lg font-bold">
                    {selectedHostelId !== "all"
                      ? `Direct Payment Accounts — ${selectedHostelName}`
                      : "Verified Property Payment Accounts"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Always include your student booking reference and full name as the transfer narration.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-[11px] font-semibold shrink-0">
                {filteredAccounts.length} {filteredAccounts.length === 1 ? "Account" : "Accounts"} Active
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            {filteredAccounts.map((account) => {
              const isBank = account.type === "bank";
              const displayBankName = account.branch
                ? `${account.bankName} — ${account.branch}`
                : account.bankName || "Official Account";
              const copyLabel = `${account.bankName || "Account"} (${account.accountNumber.slice(-4)})`;

              return (
                <div
                  key={account.id}
                  className="p-5 rounded-2xl border border-border/60 bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Header Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={isBank ? "secondary" : "outline"}
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5",
                          !isBank && "border-amber-500/30 text-amber-600 bg-amber-500/10"
                        )}
                      >
                        {isBank ? (
                          <span className="flex items-center gap-1">
                            <Landmark className="h-3 w-3" />
                            <span>Bank Account</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Smartphone className="h-3 w-3" />
                            <span>Mobile Money</span>
                          </span>
                        )}
                      </Badge>

                      {account.isPrimary && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold py-0 h-4">
                          <Star className="h-2.5 w-2.5 mr-1 fill-emerald-500" />
                          Primary Deposit
                        </Badge>
                      )}

                      {account.isVerified && (
                        <Badge variant="outline" className="text-[10px] font-medium text-emerald-600 border-emerald-500/30 bg-emerald-500/5 gap-1 py-0 h-4">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Paystack Verified</span>
                        </Badge>
                      )}
                    </div>

                    {/* Bank / Provider Name */}
                    <p className="text-base font-bold text-foreground truncate">
                      {displayBankName}
                    </p>

                    {/* Account Details Monospace Line */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-xs text-foreground font-mono">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground font-sans text-[11px]">
                          {isBank ? "Account:" : "Number:"}
                        </span>
                        <strong className="text-sm text-foreground bg-background px-2 py-0.5 rounded border border-border/50">
                          {account.accountNumber}
                        </strong>
                      </div>

                      <span className="text-muted-foreground">•</span>

                      <div>
                        <span className="text-muted-foreground font-sans text-[11px]">Holder: </span>
                        <strong>{account.accountName}</strong>
                      </div>

                      {account.hostelName && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <div className="font-sans text-[11px] text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-primary" />
                            <strong className="text-foreground">{account.hostelName}</strong>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Copy Button */}
                  <Button
                    className="rounded-xl gap-1.5 shrink-0 w-full sm:w-auto font-semibold"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(account.accountNumber, copyLabel)}
                  >
                    {copiedCode === copyLabel ? (
                      <Check className="h-4 w-4 text-emerald-600" />
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
                <CardDescription className="text-xs">Recommended for instant bed allocation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pay securely via <strong>MTN Mobile Money, Telecel Cash, AT Money, Visa, or Mastercard</strong>. Your bed
              reservation is verified instantly without physical teller delays.
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
                <CardTitle className="text-base font-bold">Bank Counter & MoMo Deposit Rules</CardTitle>
                <CardDescription className="text-xs">Required narration for manual reconciliation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              When depositing at branch counters or sending MoMo, instruct the teller to insert your{" "}
              <strong>Full Name & Booking Reference</strong> on the slip or transfer narration. Retain proof of payment.
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>Counter clearing and manager approval takes 6–24 hours</span>
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

export default function StudentBankAccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <StudentBankAccountsContent />
    </Suspense>
  );
}
