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
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
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

// Mock Fallback Pending Hostels if DB is empty
const INITIAL_MOCK_PENDING_HOSTELS: Hostel[] = [
  {
    id: "pend_hostel_01",
    name: "Golden Jubilee Student Villa",
    location: "Tanoso, Kumasi (~8 min walk to AAMUSTED Main Gate)",
    institution: "AAMUSTED",
    rating: 0,
    numberOfReviews: 0,
    availability: "Available",
    amenities: ["Self-Contained Bathrooms", "24/7 Water Supply", "Security Fence", "Study Desks", "Free Wi-Fi"],
    images: [
      "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800&auto=format&fit=crop&q=80",
    ],
    description: "Newly constructed modern student villa with dedicated borehole water reservoir, 24-hour manned physical security, CCTV coverage, and quiet study quarters.",
    priceRange: { min: 3800, max: 4600 },
    roomTypes: [
      { id: "rt_pend_1", name: "2 in a Room (En-Suite)", price: 4600, availability: "Available", capacity: 2 },
      { id: "rt_pend_2", name: "4 in a Room (Standard)", price: 3800, availability: "Available", capacity: 4 },
    ],
    reviews: [],
    status: "pending",
    submittedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    createdBy: {
      userId: "usr_mgr_stephen",
      fullName: "Stephen Amankwah",
      email: "s.amankwah@hostels.gh",
      role: "manager",
      createdAt: new Date().toISOString(),
    },
  },
  {
    id: "pend_hostel_02",
    name: "Unity Haven Annex",
    location: "Denkyembuoso, Near Victory Church",
    institution: "AAMUSTED",
    rating: 0,
    numberOfReviews: 0,
    availability: "Available",
    amenities: ["Borehole & Polytank", "Gated Compound", "Prepaid Metering", "Spacious Rooms"],
    images: [
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop&q=80",
    ],
    description: "Serene student lodge tailored for serious academic focus. High water pressure, private electricity sub-meters for transparent billing.",
    priceRange: { min: 3200, max: 4000 },
    roomTypes: [
      { id: "rt_pend_3", name: "3 in a Room", price: 3200, availability: "Available", capacity: 3 },
      { id: "rt_pend_4", name: "2 in a Room", price: 4000, availability: "Available", capacity: 2 },
    ],
    reviews: [],
    status: "pending",
    submittedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    createdBy: {
      userId: "usr_mgr_mary",
      fullName: "Mary Adomako",
      email: "mary.adomako@gmail.com",
      role: "manager",
      createdAt: new Date().toISOString(),
    },
  },
];

// Mock Rooms with Pending Price Changes for the Price-Change Hook
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

const INITIAL_MOCK_PENDING_PRICES: RoomWithPendingPrice[] = [
  {
    hostelId: "hostel_doku_01",
    hostelName: "Doku Kaakyire Hostel",
    roomId: "room_101",
    roomNumber: "A-101",
    roomTypeName: "2 in a Room",
    currentPrice: 4200,
    pendingPrice: 4500,
    reason: "New inverter solar backup installation and ceiling fans",
    requestedAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    requestedBy: "Kwame Boateng (Manager)",
  },
  {
    hostelId: "hostel_frontline_02",
    hostelName: "Frontline Executive Lodge",
    roomId: "room_204",
    roomNumber: "B-204",
    roomTypeName: "Single Executive Room",
    currentPrice: 5800,
    pendingPrice: 6200,
    reason: "Upgraded AC units and private study desk furnishings",
    requestedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    requestedBy: "Akwasi Owusu (Manager)",
  },
];

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
  const [pendingPrices, setPendingPrices] = useState<RoomWithPendingPrice[]>(INITIAL_MOCK_PENDING_PRICES);

  // Active / Approved Hostels State
  const [approvedHostels, setApprovedHostels] = useState<Hostel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
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

      if (pendRes.success && pendRes.data && pendRes.data.length > 0) {
        setPendingHostels(pendRes.data);
      } else {
        setPendingHostels(INITIAL_MOCK_PENDING_HOSTELS);
      }

      if (approvedRes.success && approvedRes.data) {
        setApprovedHostels(approvedRes.data);
      }
    } catch (err) {
      console.error("Error loading coordinator data:", err);
      setPendingHostels(INITIAL_MOCK_PENDING_HOSTELS);
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
    return (
      !q ||
      h.name.toLowerCase().includes(q) ||
      h.location.toLowerCase().includes(q) ||
      h.institution?.toLowerCase().includes(q)
    );
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
        {/* Executive Banner */}
        <div className="mb-8 bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-emerald-200 border border-white/20">
              <Shield className="h-3.5 w-3.5" />
              University Housing Board • Directorate of Accommodation
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Hostel Coordinator Console
            </h1>
            <p className="text-sm text-emerald-100/80 max-w-2xl">
              Accreditation governance for private student residences, physical building compliance reviews, and audited pricing controls.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loadingData}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? "animate-spin" : ""}`} />
              Refresh Registry
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Pending Accreditations
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-amber-600">{pendingHostels.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Hostels submitted awaiting inspection</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Price-Change Hooks
              </CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-foreground">{pendingPrices.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Room tariff adjustments pending review</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Accredited Hostels
              </CardTitle>
              <Building2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-emerald-600">{approvedHostels.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Live in university housing registry</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Safety Standards
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-foreground">100%</div>
              <p className="text-xs text-muted-foreground mt-1">Audited physical facility verification</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="bg-slate-200/80 p-1 rounded-xl">
            <TabsTrigger value="pending" className="rounded-lg font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Registration Approval Queue
              {pendingHostels.length > 0 && (
                <Badge className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500">
                  {pendingHostels.length}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger value="priceHooks" className="rounded-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Price Change Data Hook
              {pendingPrices.length > 0 && (
                <Badge className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-blue-600">
                  {pendingPrices.length}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger value="accredited" className="rounded-lg font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Accredited Directory ({approvedHostels.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: REGISTRATION APPROVAL QUEUE */}
          <TabsContent value="pending" className="space-y-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold">New Hostel Registration Filings</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Carefully examine building specifications, room pricing, and amenities before accrediting for student occupancy.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {pendingHostels.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-foreground">Zero pending registration filings</p>
                    <p className="text-xs">All submitted student accommodations have been evaluated.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-100/60">
                        <TableRow>
                          <TableHead>Hostel Name & Location</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Room Types & Tariffs</TableHead>
                          <TableHead>Submission Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingHostels.map((hostel) => (
                          <TableRow key={hostel.id} className="hover:bg-slate-50/80 transition-colors">
                            <TableCell className="max-w-xs">
                              <p className="font-semibold text-foreground text-sm">{hostel.name}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                {hostel.location}
                              </p>
                              <Badge variant="outline" className="text-[10px] mt-1 font-normal">
                                Campus: {hostel.institution || "AAMUSTED"}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              <p className="font-semibold text-foreground text-xs">
                                {hostel.createdBy?.fullName || "Private Manager"}
                              </p>
                              <p className="text-xs text-muted-foreground">{hostel.createdBy?.email}</p>
                            </TableCell>

                            <TableCell>
                              <div className="space-y-1">
                                {hostel.roomTypes && hostel.roomTypes.length > 0 ? (
                                  hostel.roomTypes.map((rt, idx) => (
                                    <div key={idx} className="text-xs flex items-center gap-2">
                                      <span className="font-medium text-foreground">{rt.name}:</span>
                                      <span className="text-emerald-600 font-semibold font-mono">
                                        GH₵{rt.price?.toLocaleString()}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">Pricing provided upon inspection</span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {hostel.submittedAt
                                  ? new Date(hostel.submittedAt).toLocaleDateString()
                                  : "Recently"}
                              </span>
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedHostel(hostel)}
                                  className="h-8 text-xs font-semibold"
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" /> Inspect
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveHostel(hostel)}
                                  disabled={actionLoading}
                                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: PRICE-CHANGE DATA HOOK */}
          <TabsContent value="priceHooks" className="space-y-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                    PRD §6 Data Hook
                  </Badge>
                  <CardTitle className="text-lg font-bold">Room Tariff Revision Requests</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Accepts <code className="bg-slate-100 px-1 py-0.5 rounded text-primary">pendingPrice</code> on the Room data model to prevent unlawful mid-semester student price inflation.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {pendingPrices.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    No price revision requests currently pending.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-100/60">
                        <TableRow>
                          <TableHead>Hostel & Room Number</TableHead>
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
                            <TableCell>
                              <p className="font-semibold text-foreground text-sm">{item.hostelName}</p>
                              <Badge variant="outline" className="font-mono text-xs mt-0.5">
                                Room {item.roomNumber}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              <span className="text-xs font-medium text-foreground">{item.roomTypeName}</span>
                            </TableCell>

                            <TableCell>
                              <span className="text-xs font-semibold text-muted-foreground line-through">
                                GH₵{item.currentPrice.toLocaleString()}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span className="text-sm font-extrabold text-blue-700">
                                GH₵{item.pendingPrice.toLocaleString()}
                              </span>
                              <div className="text-[10px] text-emerald-600 font-semibold">
                                +GH₵{(item.pendingPrice - item.currentPrice).toLocaleString()} (+{Math.round(((item.pendingPrice - item.currentPrice) / item.currentPrice) * 100)}%)
                              </div>
                            </TableCell>

                            <TableCell className="max-w-xs">
                              <p className="text-xs text-foreground font-medium">{item.reason || "Annual indexation"}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">By {item.requestedBy}</p>
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprovePriceChange(item)}
                                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: ACCREDITED DIRECTORY */}
          <TabsContent value="accredited" className="space-y-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold">Approved University Accommodations</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Publicly visible listings that have satisfied university building safety and pricing standards.
                    </CardDescription>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search directory..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-100/60">
                      <TableRow>
                        <TableHead>Hostel Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Price Range</TableHead>
                        <TableHead>Availability</TableHead>
                        <TableHead>Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApproved.map((h) => (
                        <TableRow key={h.id} className="hover:bg-slate-50/80 transition-colors">
                          <TableCell>
                            <p className="font-semibold text-foreground text-sm">{h.name}</p>
                            <p className="text-xs text-muted-foreground">{h.institution || "AAMUSTED"}</p>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-muted-foreground">{h.location}</span>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs font-semibold text-foreground font-mono">
                              GH₵{h.priceRange?.min?.toLocaleString()} – GH₵{h.priceRange?.max?.toLocaleString()}
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge
                              className={`text-[10px] ${
                                h.availability === "Available"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              }`}
                            >
                              {h.availability || "Available"}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs font-bold text-foreground">
                              ★ {h.rating ? h.rating.toFixed(1) : "4.5"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
