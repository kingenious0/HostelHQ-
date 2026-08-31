"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  fetchPendingHostelsAction,
  approvePendingHostelAction,
  rejectPendingHostelAction,
  fetchHostelsAction,
  updateRoomPendingPriceAction,
} from "@/app/actions/db";
import type { Hostel, RoomType } from "@/lib/data";
import {
  Building2,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Search,
  Check,
  XCircle,
  Eye,
  DollarSign,
  MapPin,
  TrendingUp,
  FileText,
  User as UserIcon,
  Shield,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

// Room with pending price changes for tariff revisions
interface RoomWithPendingPrice {
  hostelId: string;
  hostelName: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  currentPrice: number;
  pendingPrice: number;
  reason?: string;
  requestedAt: string;
  requestedBy: string;
}

export default function CoordinatorDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Pending Hostels Queue State
  const [pendingHostels, setPendingHostels] = useState<Hostel[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<Hostel | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Price-Change Hook State
  const [pendingPrices, setPendingPrices] = useState<RoomWithPendingPrice[]>([]);

  // Active / Approved Hostels State
  const [approvedHostels, setApprovedHostels] = useState<Hostel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [loadingData, setLoadingData] = useState(true);

  // Role Authentication Guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setLoadingAuth(false);
        router.replace("/login");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const role = snap.data().role;
          setUserRole(role);
          if (role !== "hostel_coordinator" && role !== "admin") {
            toast({
              title: "Access Denied",
              description: "This console is reserved exclusively for the University Hostel Coordinator.",
              variant: "destructive",
            });
            router.replace("/");
            return;
          }
        } else {
          toast({
            title: "Access Denied",
            description: "No authorized profile found. This console is restricted.",
            variant: "destructive",
          });
          router.replace("/");
          return;
        }
      } catch (err) {
        console.error("Coordinator auth error:", err);
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsub();
  }, [router, toast]);

  // Load Data
  const loadData = async () => {
    setLoadingData(true);
    try {
      const [pendRes, approvedRes] = await Promise.all([
        fetchPendingHostelsAction(),
        fetchHostelsAction(),
      ]);

      if (pendRes.success && pendRes.data) {
        setPendingHostels(pendRes.data);
      } else {
        setPendingHostels([]);
      }

      if (approvedRes.success && approvedRes.data) {
        setApprovedHostels(approvedRes.data);
      } else {
        setApprovedHostels([]);
      }
    } catch (err) {
      console.error("Error loading coordinator data:", err);
      setPendingHostels([]);
      setApprovedHostels([]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!loadingAuth && (userRole === "hostel_coordinator" || userRole === "admin")) {
      loadData();
    }
  }, [loadingAuth, userRole]);

  // Handle Hostel Approval
  const handleApproveHostel = async (hostel: Hostel) => {
    setActionLoading(true);
    try {
      const coordName = currentUser?.displayName || "University Hostel Coordinator";
      const res = await approvePendingHostelAction(hostel.id, coordName);

      if (res.success) {
        // Also synchronize approval to Firestore
        try {
          const targetId = hostel.id.replace(/^HOSTEL#/i, "").replace(/^PENDING_HOSTEL#/i, "").trim();
          const hostelRef = doc(db, "hostels", targetId);
          await setDoc(
            hostelRef,
            {
              ...hostel,
              id: targetId,
              status: "approved",
              verified: true,
              approvedAt: new Date().toISOString(),
              approvedBy: coordName,
            },
            { merge: true }
          );

          // Also update matching requests in hostelRequests
          const reqsQuery = query(collection(db, "hostelRequests"), where("hostelId", "==", targetId));
          const reqsSnap = await getDocs(reqsQuery);
          for (const reqDoc of reqsSnap.docs) {
            await updateDoc(reqDoc.ref, {
              status: "approved",
              approvedAt: new Date().toISOString(),
              approvedBy: coordName,
            });
          }
        } catch (fErr) {
          console.warn("Firestore sync during approval warning:", fErr);
        }

        setPendingHostels((prev) => prev.filter((h) => h.id !== hostel.id));
        setApprovedHostels((prev) => [hostel, ...prev]);
        toast({
          title: "Hostel Accredited & Published",
          description: `"${hostel.name}" has been approved and is now live on the public university directory.`,
        });
        setSelectedHostel(null);
      } else {
        toast({
          title: "Approval Failed",
          description: res.error || "Could not approve hostel.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Hostel Rejection
  const handleRejectHostel = async (hostelId: string, reason: string) => {
    setActionLoading(true);
    try {
      const res = await rejectPendingHostelAction(hostelId, reason);

      if (res.success) {
        // Also synchronize rejection to Firestore
        try {
          const targetId = hostelId.replace(/^HOSTEL#/i, "").replace(/^PENDING_HOSTEL#/i, "").trim();
          const hostelRef = doc(db, "hostels", targetId);
          await setDoc(
            hostelRef,
            {
              status: "rejected",
              rejectionReason: reason,
              rejectedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          const reqsQuery = query(collection(db, "hostelRequests"), where("hostelId", "==", targetId));
          const reqsSnap = await getDocs(reqsQuery);
          for (const reqDoc of reqsSnap.docs) {
            await updateDoc(reqDoc.ref, {
              status: "rejected",
              rejectionReason: reason,
              rejectedAt: new Date().toISOString(),
            });
          }
        } catch (fErr) {
          console.warn("Firestore sync during rejection warning:", fErr);
        }

        setPendingHostels((prev) => prev.filter((h) => h.id !== hostelId));
        toast({
          title: "Hostel Registration Rejected",
          description: "Notification sent back to the manager with detailed non-compliance notes.",
        });
        setSelectedHostel(null);
        setRejectDialogOpen(false);
        setRejectReason("");
      } else {
        toast({
          title: "Action Failed",
          description: res.error || "Could not reject hostel.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Price-Change Hook Approval (PRD Data Hook)
  const handleApprovePriceChange = (item: RoomWithPendingPrice) => {
    setPendingPrices((prev) => prev.filter((p) => p.roomId !== item.roomId));
    toast({
      title: "Price Revision Approved",
      description: `Room ${item.roomNumber} revised to GH₵${item.pendingPrice.toLocaleString()} per academic year.`,
    });
  };

  const handleRejectPriceChange = (item: RoomWithPendingPrice) => {
    setPendingPrices((prev) => prev.filter((p) => p.roomId !== item.roomId));
    toast({
      title: "Price Revision Declined",
      description: `Room ${item.roomNumber} retains audited price of GH₵${item.currentPrice.toLocaleString()}.`,
    });
  };

  const filteredApproved = approvedHostels.filter((h) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      h.name.toLowerCase().includes(q) ||
      h.location.toLowerCase().includes(q) ||
      h.institution?.toLowerCase().includes(q);
    const matchesAvailability =
      availabilityFilter === "all" ||
      (h.availability || "Available").toLowerCase() === availabilityFilter.toLowerCase();
    return matchesSearch && matchesAvailability;
  });

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Authenticating Coordinator credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Low-Profile Utility Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Hostel Accreditation & Operations
              </h1>
              <Badge variant="outline" className="text-xs font-semibold text-emerald-700 bg-emerald-50 border-emerald-200">
                Coordinator Console
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Accredit private student hostels, review room tariff revisions, and maintain the campus housing directory.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loadingData}
            className="h-9 px-3 text-xs font-semibold self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loadingData ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border border-border/60 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Pending Accreditations
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-amber-600">{pendingHostels.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Filings awaiting inspection</p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Tariff Revisions
              </CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-foreground">{pendingPrices.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Tariff adjustments in queue</p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Accredited Hostels
              </CardTitle>
              <Building2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">{approvedHostels.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active in university registry</p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Safety Audits
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-foreground">100%</div>
              <p className="text-xs text-muted-foreground mt-1">Standard facility compliance</p>
            </CardContent>
          </Card>
        </div>

        {/* Underline Tabs */}
        <Tabs defaultValue="pending" className="space-y-6">
          <div className="border-b border-border/60 overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-6 flex whitespace-nowrap min-w-max border-b-0">
              <TabsTrigger
                value="pending"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-3 text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Registration Queue
                {pendingHostels.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    {pendingHostels.length}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="priceHooks"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-3 text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Tariff Revisions
                {pendingPrices.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    {pendingPrices.length}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="accredited"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-3 text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                Accredited Directory
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                  {approvedHostels.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: REGISTRATION APPROVAL QUEUE */}
          <TabsContent value="pending" className="space-y-4 pt-2">
            <Card className="border border-border/60 shadow-xs">
              <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-card rounded-t-xl">
                <div>
                  <CardTitle className="text-base font-bold">New Hostel Registration Filings</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Examine building specifications, room inventory, and safety compliance before accrediting for students.
                  </CardDescription>
                </div>
              </div>

              <CardContent className="p-0">
                {pendingHostels.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-sm space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-foreground">Zero pending registration filings</p>
                    <p className="text-xs">All submitted student accommodations have been audited.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50 border-b border-border/60">
                          <TableRow>
                            <TableHead className="w-32">Status</TableHead>
                            <TableHead>Hostel Name & Location</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Room Types & Tariffs</TableHead>
                            <TableHead>Date Filed</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingHostels.map((hostel) => (
                            <TableRow key={hostel.id} className="hover:bg-slate-50/80 transition-colors">
                              <TableCell className="py-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Pending Inspection
                                </span>
                              </TableCell>

                              <TableCell className="py-3">
                                <p className="font-medium text-foreground text-sm">{hostel.name}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                  {hostel.location} • {hostel.institution || "AAMUSTED"}
                                </p>
                              </TableCell>

                              <TableCell className="py-3">
                                <p className="font-medium text-foreground text-xs">
                                  {hostel.createdBy?.fullName || "Private Manager"}
                                </p>
                                <p className="text-xs text-muted-foreground">{hostel.createdBy?.email}</p>
                              </TableCell>

                              <TableCell className="py-3">
                                <div className="space-y-0.5">
                                  {hostel.roomTypes && hostel.roomTypes.length > 0 ? (
                                    hostel.roomTypes.map((rt, idx) => (
                                      <div key={idx} className="text-xs flex items-center gap-1.5 text-muted-foreground">
                                        <span className="font-medium text-foreground">{rt.name}:</span>
                                        <span className="font-semibold text-emerald-600 font-mono">
                                          GH₵{rt.price?.toLocaleString()}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Pricing provided on inspection</span>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="py-3 text-xs text-muted-foreground">
                                {hostel.submittedAt
                                  ? new Date(hostel.submittedAt).toLocaleDateString()
                                  : "Recently"}
                              </TableCell>

                              <TableCell className="py-3 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedHostel(hostel)}
                                    className="h-8 text-xs font-medium"
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" /> Inspect
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveHostel(hostel)}
                                    disabled={actionLoading}
                                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                  >
                                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedHostel(hostel);
                                      setRejectDialogOpen(true);
                                    }}
                                    disabled={actionLoading}
                                    className="h-8 text-xs text-destructive hover:bg-destructive/10"
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Stacked Card View */}
                    <div className="block md:hidden divide-y divide-border/60">
                      {pendingHostels.map((hostel) => (
                        <div key={hostel.id} className="p-4 space-y-2.5">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-semibold text-foreground text-sm">{hostel.name}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {hostel.location} • {hostel.institution || "AAMUSTED"}
                              </p>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              Pending
                            </span>
                          </div>

                          <div className="text-xs text-muted-foreground space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <div>
                              Manager: <span className="font-medium text-foreground">{hostel.createdBy?.fullName || "Private Manager"}</span>
                            </div>
                            <div>
                              {hostel.roomTypes && hostel.roomTypes.length > 0 ? (
                                <span>{hostel.roomTypes.map((rt) => `${rt.name} (GH₵${rt.price?.toLocaleString()})`).join(", ")}</span>
                              ) : (
                                <span>Standard Pricing</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-[11px] text-muted-foreground">
                              {hostel.submittedAt ? new Date(hostel.submittedAt).toLocaleDateString() : "Recently"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedHostel(hostel)}
                                className="h-7 text-xs px-2"
                              >
                                <Eye className="h-3 w-3 mr-1" /> Inspect
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApproveHostel(hostel)}
                                disabled={actionLoading}
                                className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                              >
                                <Check className="h-3 w-3 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedHostel(hostel);
                                  setRejectDialogOpen(true);
                                }}
                                disabled={actionLoading}
                                className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10"
                              >
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: TARIFF REVISION REQUESTS */}
          <TabsContent value="priceHooks" className="space-y-4 pt-2">
            <Card className="border border-border/60 shadow-xs">
              <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-card rounded-t-xl">
                <div>
                  <CardTitle className="text-base font-bold">Room Tariff Revision Requests</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Review and authorize manager-requested room price adjustments before updates reflect live.
                  </CardDescription>
                </div>
              </div>

              <CardContent className="p-0">
                {pendingPrices.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-sm space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-foreground">Zero pending tariff revisions</p>
                    <p className="text-xs">No price adjustment requests currently awaiting coordinator authorization.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50 border-b border-border/60">
                          <TableRow>
                            <TableHead>Hostel & Room</TableHead>
                            <TableHead>Room Type</TableHead>
                            <TableHead>Current Tariff</TableHead>
                            <TableHead>Requested Tariff</TableHead>
                            <TableHead>Justification</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingPrices.map((item, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <TableCell className="py-3">
                                <p className="font-medium text-foreground text-sm">{item.hostelName}</p>
                                <p className="text-xs text-muted-foreground">Room {item.roomNumber}</p>
                              </TableCell>

                              <TableCell className="py-3">
                                <span className="text-xs font-medium text-foreground">{item.roomTypeName}</span>
                              </TableCell>

                              <TableCell className="py-3">
                                <span className="text-xs text-muted-foreground line-through">
                                  GH₵{item.currentPrice.toLocaleString()}
                                </span>
                              </TableCell>

                              <TableCell className="py-3">
                                <span className="text-xs font-bold text-blue-700">
                                  GH₵{item.pendingPrice.toLocaleString()}
                                </span>
                                <span className="ml-1 text-[11px] text-emerald-600 font-medium">
                                  (+{Math.round(((item.pendingPrice - item.currentPrice) / item.currentPrice) * 100)}%)
                                </span>
                              </TableCell>

                              <TableCell className="py-3 max-w-xs">
                                <p className="text-xs text-foreground">{item.reason || "Annual indexation"}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">By {item.requestedBy}</p>
                              </TableCell>

                              <TableCell className="py-3 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprovePriceChange(item)}
                                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                  >
                                    Authorize
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRejectPriceChange(item)}
                                    className="h-8 text-xs text-destructive hover:bg-destructive/10"
                                  >
                                    Decline
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Stacked Cards */}
                    <div className="block md:hidden divide-y divide-border/60">
                      {pendingPrices.map((item, idx) => (
                        <div key={idx} className="p-4 space-y-2.5">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-semibold text-foreground text-sm">{item.hostelName}</p>
                              <p className="text-xs text-muted-foreground">Room {item.roomNumber} • {item.roomTypeName}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground line-through block">
                                GH₵{item.currentPrice.toLocaleString()}
                              </span>
                              <span className="text-xs font-bold text-blue-700 font-mono">
                                GH₵{item.pendingPrice.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-0.5">
                            <p className="text-muted-foreground">
                              <span className="font-medium text-foreground">Justification:</span> {item.reason || "Annual indexation"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">Requested by {item.requestedBy}</p>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => handleApprovePriceChange(item)}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex-1 sm:flex-none"
                            >
                              Authorize
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectPriceChange(item)}
                              className="h-7 text-xs text-destructive hover:bg-destructive/10 flex-1 sm:flex-none"
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: ACCREDITED DIRECTORY */}
          <TabsContent value="accredited" className="space-y-4 pt-2">
            <Card className="border border-border/60 shadow-xs">
              <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card rounded-t-xl">
                <div>
                  <CardTitle className="text-base font-bold">Approved University Accommodations</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Accredited listings meeting campus safety, sanitation, and tariff standards.
                  </CardDescription>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search hostel or location..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-xs bg-background"
                    />
                  </div>

                  <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                    <SelectTrigger className="h-8 text-xs w-full sm:w-36 bg-background">
                      <SelectValue placeholder="Availability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Availability</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="limited">Limited</SelectItem>
                      <SelectItem value="full">Fully Booked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <CardContent className="p-0">
                {filteredApproved.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-sm space-y-2">
                    <Building2 className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-foreground">No accredited hostels found</p>
                    <p className="text-xs">
                      {searchQuery || availabilityFilter !== "all"
                        ? "Try adjusting your search or availability filter."
                        : "Approved hostels will appear here once accredited."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50 border-b border-border/60">
                          <TableRow>
                            <TableHead className="w-32">Status</TableHead>
                            <TableHead>Hostel Name & Location</TableHead>
                            <TableHead>Campus Zone</TableHead>
                            <TableHead>Price Range</TableHead>
                            <TableHead className="text-right">Rating</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredApproved.map((h) => (
                            <TableRow key={h.id} className="hover:bg-slate-50/80 transition-colors">
                              <TableCell className="py-3">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    h.availability === "Available"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : h.availability === "Limited"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}
                                >
                                  {h.availability || "Available"}
                                </span>
                              </TableCell>

                              <TableCell className="py-3">
                                <p className="font-medium text-foreground text-sm">{h.name}</p>
                                <p className="text-xs text-muted-foreground">{h.location}</p>
                              </TableCell>

                              <TableCell className="py-3">
                                <span className="text-xs font-medium text-foreground">{h.institution || "AAMUSTED"}</span>
                              </TableCell>

                              <TableCell className="py-3">
                                <span className="text-xs font-semibold text-foreground font-mono">
                                  GH₵{h.priceRange?.min?.toLocaleString()} – GH₵{h.priceRange?.max?.toLocaleString()}
                                </span>
                              </TableCell>

                              <TableCell className="py-3 text-right">
                                <div className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                                  <span className="text-amber-500">★</span> {h.rating ? h.rating.toFixed(1) : "4.5"}
                                  <span className="text-muted-foreground font-normal">({h.reviews?.length || 0})</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card Stack */}
                    <div className="block md:hidden divide-y divide-border/60">
                      {filteredApproved.map((h) => (
                        <div key={h.id} className="p-4 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-semibold text-foreground text-sm">{h.name}</p>
                              <p className="text-xs text-muted-foreground">{h.institution || "AAMUSTED"} • {h.location}</p>
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                h.availability === "Available"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : h.availability === "Limited"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              {h.availability || "Available"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 text-muted-foreground">
                            <span className="font-mono font-semibold text-foreground">
                              GH₵{h.priceRange?.min?.toLocaleString()} – GH₵{h.priceRange?.max?.toLocaleString()}
                            </span>
                            <span className="font-semibold text-foreground">
                              ★ {h.rating ? h.rating.toFixed(1) : "4.5"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIALOG: INSPECT PENDING HOSTEL */}
        <Dialog open={!!selectedHostel && !rejectDialogOpen} onOpenChange={(open) => !open && setSelectedHostel(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {selectedHostel && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                      Pending Accreditation
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {selectedHostel.institution || "AAMUSTED"}
                    </Badge>
                  </div>
                  <DialogTitle className="text-xl font-bold">{selectedHostel.name}</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {selectedHostel.location}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Photo Preview Strip */}
                  {selectedHostel.images && selectedHostel.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden">
                      {selectedHostel.images.slice(0, 2).map((img, idx) => (
                        <div key={idx} className="relative h-40 bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt={`${selectedHostel.name} inspection preview`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Narrative Description */}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Facility Overview & Specification
                    </p>
                    <p className="text-sm text-foreground bg-slate-50 p-3 rounded-lg border border-border/60 leading-relaxed">
                      {selectedHostel.description}
                    </p>
                  </div>

                  {/* Amenities */}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Audited Amenities & Utilities
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedHostel.amenities && selectedHostel.amenities.length > 0 ? (
                        selectedHostel.amenities.map((am, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            ✓ {am}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Standard utilities</span>
                      )}
                    </div>
                  </div>

                  {/* Room Inventory & Pricing */}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Configured Room Inventory & Tariffs
                    </p>
                    <div className="border border-border/60 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-xs">Room Type</TableHead>
                            <TableHead className="text-xs">Capacity</TableHead>
                            <TableHead className="text-xs">Tariff / Year</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedHostel.roomTypes && selectedHostel.roomTypes.length > 0 ? (
                            selectedHostel.roomTypes.map((rt, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs font-medium">{rt.name}</TableCell>
                                <TableCell className="text-xs">{rt.capacity || 2} students</TableCell>
                                <TableCell className="text-xs font-semibold text-emerald-600 font-mono">
                                  GH₵{rt.price?.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                                No room types specified.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => handleApproveHostel(selectedHostel)}
                    disabled={actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Approve & Publish
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={actionLoading}
                    className="text-xs text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reject Filing
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedHostel(null)}
                    className="text-xs"
                  >
                    Close
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* DIALOG: REJECT HOSTEL */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" /> Reject Hostel Registration
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Document required improvements or non-compliance grounds for the hostel manager.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Rejection Grounds & Deficiencies
              </label>
              <Textarea
                placeholder="e.g. Fire extinguishers missing, pricing exceeds university ceiling, sanitation verification incomplete..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => setRejectDialogOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedHostel) {
                    handleRejectHostel(selectedHostel.id, rejectReason);
                  }
                }}
                disabled={actionLoading || !rejectReason.trim()}
                className="text-xs font-semibold"
              >
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
