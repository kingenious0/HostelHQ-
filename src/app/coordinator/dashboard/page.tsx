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
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  fetchPendingHostelsAction,
  approvePendingHostelAction,
  rejectPendingHostelAction,
  fetchHostelsAction,
  updateRoomPendingPriceAction,
  updateHostelAction,
} from "@/app/actions/db";
import type { Hostel, RoomType } from "@/lib/data";
import { HostelInspectionModal } from "@/components/dashboard/HostelInspectionModal";
import { getHostelPhotos, getHostelVideos } from "@/lib/media-helpers";
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
  AlertTriangle,
  Scale,
  ShieldCheck,
  Gavel,
} from "lucide-react";

import { RentCapComplianceSection } from "@/components/dashboard/RentCapComplianceSection";
import {
  STATUTORY_TARIFF_CEILINGS,
  getStatutoryTariffCeiling,
  TariffLimits,
  DEFAULT_TARIFF_LIMITS,
} from "@/lib/tariff-limits";

interface TariffViolation {
  hostelId: string;
  hostelName: string;
  institution?: string;
  location?: string;
  roomTypeName: string;
  roomIndex: number;
  postedPrice: number;
  statutoryCap: number;
  excess: number;
  status: "pending" | "approved";
  hostel: Hostel;
}

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
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
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

  // Load Data Manual Refresh / Fallback
  const loadData = async () => {
    setLoadingData(true);
    try {
      const pendingHostelsQuery = query(
        collection(db, "hostels"),
        where("status", "in", ["pending", "pending_review", "pending_accreditation"])
      );
      const [pendSnap, approvedRes] = await Promise.all([
        getDocs(pendingHostelsQuery),
        fetchHostelsAction(),
      ]);

      const pendList = pendSnap.docs.map((d) => {
        const data = d.data();
        const resolvedPhotos = getHostelPhotos(data);
        const resolvedVideos = getHostelVideos(data);
        return {
          ...data,
          id: d.id,
          images: resolvedPhotos,
          photos: resolvedPhotos,
          galleryUrls: resolvedPhotos,
          videos: resolvedVideos,
        } as Hostel;
      });
      setPendingHostels(pendList);

      if (approvedRes.success && approvedRes.data) {
        setApprovedHostels(approvedRes.data);
      }
    } catch (err) {
      console.error("Error loading coordinator data:", err);
      const pendRes = await fetchPendingHostelsAction();
      if (pendRes.success && pendRes.data) {
        setPendingHostels(pendRes.data);
      }
    } finally {
      setLoadingData(false);
    }
  };

  // Real-time synchronization across Admin and Coordinator queues
  useEffect(() => {
    if (loadingAuth || (userRole !== "hostel_coordinator" && userRole !== "admin")) {
      return;
    }

    setLoadingData(true);

    const pendingHostelsQuery = query(
      collection(db, "hostels"),
      where("status", "in", ["pending", "pending_review", "pending_accreditation"])
    );

    const unsubPending = onSnapshot(
      pendingHostelsQuery,
      (snapshot) => {
        const hostelsData = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const resolvedPhotos = getHostelPhotos(data);
          const resolvedVideos = getHostelVideos(data);
          return {
            ...data,
            id: docSnap.id,
            name: data.name || "Unnamed Property",
            location: data.location || data.address || "Location Pending",
            images: resolvedPhotos,
            photos: resolvedPhotos,
            galleryUrls: resolvedPhotos,
            videos: resolvedVideos,
            roomTypes: data.roomTypes || [],
            amenities: data.amenities || [],
          } as Hostel;
        });
        setPendingHostels(hostelsData);
        setLoadingData(false);
      },
      (err) => {
        console.warn("Coordinator pending hostels snapshot error, falling back to manual load:", err);
        loadData();
      }
    );

    const unsubApproved = onSnapshot(
      collection(db, "hostels"),
      (snapshot) => {
        const allHostels = snapshot.docs.map((d) => {
          const data = d.data();
          const resolvedPhotos = getHostelPhotos(data);
          const resolvedVideos = getHostelVideos(data);
          return {
            ...data,
            id: d.id,
            images: resolvedPhotos,
            photos: resolvedPhotos,
            galleryUrls: resolvedPhotos,
            videos: resolvedVideos,
          } as Hostel;
        });

        const liveHostels = allHostels.filter(
          (h) =>
            h.status === "approved" ||
            h.status === "accredited" ||
            h.status === "live" ||
            (h.verified &&
              h.status !== "declined" &&
              h.status !== "rejected" &&
              h.status !== "pending" &&
              h.status !== "pending_review" &&
              h.status !== "pending_accreditation")
        );
        setApprovedHostels(liveHostels);
      },
      (err) => {
        console.warn("Coordinator approved hostels snapshot error:", err);
      }
    );

    return () => {
      unsubPending();
      unsubApproved();
    };
  }, [loadingAuth, userRole]);

  const openHostelReviewDialog = async (hostel: any) => {
    let fullHostelData = { ...hostel };
    try {
      const cleanId = hostel.id.replace(/^HOSTEL#/i, "").replace(/^PENDING_HOSTEL#/i, "").trim();
      const hostelRef = doc(db, "hostels", cleanId);
      const roomTypesRef = collection(hostelRef, "roomTypes");

      const [hostelSnap, roomTypesSnap] = await Promise.all([
        getDoc(hostelRef),
        getDocs(roomTypesRef),
      ]);

      if (hostelSnap.exists()) {
        const fetchedRoomTypes = roomTypesSnap.docs.map(d => ({ ...d.data(), id: d.id })) as RoomType[];
        fullHostelData = {
          ...fullHostelData,
          ...hostelSnap.data(),
          id: cleanId,
          roomTypes: fetchedRoomTypes.length > 0 ? fetchedRoomTypes : (hostelSnap.data().roomTypes || fullHostelData.roomTypes || []),
        };
      }
    } catch (err) {
      console.warn("Could not query room types subcollection:", err);
    }

    setSelectedHostel(fullHostelData);
    setIsInspectionModalOpen(true);
  };

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

  // Statutory Desk Review Pipeline: 1-Year Provisional Accreditation Pass under Act 389
  const handleGrantProvisionalPass = async (hostel: Hostel) => {
    setActionLoading(true);
    try {
      const coordName = currentUser?.displayName || "University Hostel Coordinator";
      const targetId = hostel.id.replace(/^HOSTEL#/i, "").replace(/^PENDING_HOSTEL#/i, "").trim();
      const hostelRef = doc(db, "hostels", targetId);
      const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      const provisionalPayload = {
        ...hostel,
        id: targetId,
        status: "approved",
        verified: true,
        provisionalAccreditation: true,
        provisionalExpiry: expiry,
        accreditationType: "1-Year Provisional Desk Pass (Act 389)",
        deskReviewedBy: coordName,
        deskReviewedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: coordName,
      };

      await setDoc(hostelRef, provisionalPayload, { merge: true });

      // Update matching requests in hostelRequests
      try {
        const reqsQuery = query(collection(db, "hostelRequests"), where("hostelId", "==", targetId));
        const reqsSnap = await getDocs(reqsQuery);
        for (const reqDoc of reqsSnap.docs) {
          await updateDoc(reqDoc.ref, {
            status: "approved",
            provisionalAccreditation: true,
            provisionalExpiry: expiry,
            approvedAt: new Date().toISOString(),
            approvedBy: coordName,
          });
        }
      } catch (reqErr) {
        console.warn("Could not sync hostelRequests during provisional pass:", reqErr);
      }

      setPendingHostels((prev) => prev.filter((h) => h.id !== hostel.id));
      setApprovedHostels((prev) => [provisionalPayload as any, ...prev]);

      toast({
        title: "1-Year Provisional Pass Granted",
        description: `"${hostel.name}" received instant statutory desk accreditation under Act 389. Valid through ${new Date(expiry).toLocaleDateString()}.`,
      });
      setSelectedHostel(null);
    } catch (err: any) {
      toast({
        title: "Provisional Pass Failed",
        description: err.message || "Failed to grant provisional pass",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Rent Cap Compliance: Suspend listing exceeding statutory campus rent cap
  const handleSuspendListing = async (v: TariffViolation) => {
    setActionLoading(true);
    try {
      const coordName = currentUser?.displayName || "University Hostel Coordinator";
      const targetId = v.hostelId.replace(/^HOSTEL#/i, "").replace(/^PENDING_HOSTEL#/i, "").trim();
      const hostelRef = doc(db, "hostels", targetId);
      const suspensionReason = `Room tariff (GH₵${v.postedPrice.toLocaleString()}) exceeds approved cap (GH₵${v.statutoryCap.toLocaleString()})`;

      // 1. Delist Room/Hostel in Firestore
      await updateDoc(hostelRef, {
        status: "suspended_overpriced",
        isPublished: false,
        suspensionReason,
        suspendedAt: new Date().toISOString(),
        suspendedBy: coordName,
      });

      // 2. Delist in DynamoDB
      await updateHostelAction(targetId, {
        status: "suspended_overpriced" as any,
        isPublished: false,
        suspensionReason,
      });

      // 3. In-App Manager Notification into notifications
      const managerRecipientId = v.hostel.managerId || v.hostel.contactPhone || "";
      if (managerRecipientId) {
        try {
          await addDoc(collection(db, "notifications"), {
            recipientId: managerRecipientId,
            title: "Listing Suspended: Rent Cap Exceeded",
            message: `Your ${v.roomTypeName} rate of GH₵${v.postedPrice.toLocaleString()} at "${v.hostelName}" exceeds the campus ceiling of GH₵${v.statutoryCap.toLocaleString()}. Your listing is currently hidden from students. Lower your tariff to restore visibility.`,
            type: "rent_cap_breach",
            createdAt: new Date().toISOString(),
            read: false,
          });
        } catch (notifErr) {
          console.warn("In-app notification write warning:", notifErr);
        }
      }

      // 4. SMS Dispatch Trigger
      try {
        const { sendRentCapBreachSMSAction } = await import("@/app/actions/sms");
        await sendRentCapBreachSMSAction({
          hostelId: targetId,
          hostelName: v.hostelName,
          managerPhone: v.hostel.managerPhone || v.hostel.contactPhone,
          roomTypeName: v.roomTypeName,
          postedRate: v.postedPrice,
          statutoryCap: v.statutoryCap,
        });
      } catch (smsErr) {
        console.warn("SMS breach alert warning:", smsErr);
      }

      const updatedHostel = {
        ...v.hostel,
        status: "suspended_overpriced" as any,
        isPublished: false,
        suspensionReason,
      };

      if (v.status === "pending") {
        setPendingHostels((prev) => prev.map((h) => (h.id === v.hostelId ? updatedHostel : h)));
      } else {
        setApprovedHostels((prev) => prev.map((h) => (h.id === v.hostelId ? updatedHostel : h)));
      }

      toast({
        title: "Listing Suspended: Rent Cap Exceeded",
        description: `"${v.hostelName}" delisted from student search. In-app and SMS notice dispatched to manager.`,
      });
    } catch (err: any) {
      toast({
        title: "Suspension Failed",
        description: err.message || "Could not suspend property listing.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate Rent Cap Breaches across all hostels
  const tariffViolations: TariffViolation[] = [];

  [...pendingHostels, ...approvedHostels].forEach((h) => {
    (h.roomTypes || []).forEach((rt, idx) => {
      const ceiling = getStatutoryTariffCeiling(rt.name, rt.capacity);
      if (ceiling && typeof rt.price === "number" && rt.price > ceiling.maxPrice) {
        tariffViolations.push({
          hostelId: h.id,
          hostelName: h.name,
          institution: h.institution,
          location: h.location,
          roomTypeName: rt.name,
          roomIndex: idx,
          postedPrice: rt.price,
          statutoryCap: ceiling.maxPrice,
          excess: rt.price - ceiling.maxPrice,
          status: h.status === "approved" ? "approved" : "pending",
          hostel: h,
        });
      }
    });
  });

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Authenticating Coordinator credentials...</p>
        </div>
      </div>
    );
  }

  // Count of pending listings with digital Act 389 undertakings
  const deskReviewHostels = pendingHostels.filter((h) => Boolean((h as any).statutoryUndertaking));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Low-Profile Utility Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Hostel Accreditation & Operations
              </h1>
              <Badge variant="outline" className="text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                Coordinator Console
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Statutory desk reviews under Act 389, campus rent tariff enforcement, and student housing directory governance.
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
            Refresh Feed
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border border-border/60 shadow-xs bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Registration Queue
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-amber-600">{pendingHostels.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting coordinator review</p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Statutory Desk Passes
              </CardTitle>
              <Scale className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-foreground">
                {deskReviewHostels.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Act 389 attested ready for pass</p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Rent Cap Compliance
              </CardTitle>
              <AlertTriangle className={`h-4 w-4 ${tariffViolations.length > 0 ? "text-rose-500" : "text-emerald-500"}`} />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-2xl sm:text-3xl font-black ${tariffViolations.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"}`}>
                {tariffViolations.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {tariffViolations.length > 0 ? "Exceeding statutory campus rent caps" : "All listings comply with caps"}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-card">
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
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                    {pendingHostels.length}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="deskReview"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-3 text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground flex items-center gap-2"
              >
                <Scale className="h-4 w-4 text-primary" />
                Statutory Desk Review (Act 389)
                {deskReviewHostels.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary">
                    {deskReviewHostels.length}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="tariffEnforcer"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-3 text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground flex items-center gap-2"
              >
                <AlertTriangle className={`h-4 w-4 ${tariffViolations.length > 0 ? "text-rose-500" : "text-muted-foreground"}`} />
                Rent Cap Compliance
                {tariffViolations.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200">
                    {tariffViolations.length}
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
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200">
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
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
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
                        <TableHeader className="bg-muted/40 border-b border-border/60">
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
                            <TableRow key={hostel.id} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="py-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
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
                                <div className="space-y-1">
                                  {hostel.roomTypes && hostel.roomTypes.length > 0 ? (
                                    hostel.roomTypes.map((rt, idx) => {
                                      const ceiling = getStatutoryTariffCeiling(rt.name, rt.capacity);
                                      const isExcess = ceiling && typeof rt.price === "number" && rt.price > ceiling.maxPrice;

                                      return (
                                        <div key={idx} className="text-xs flex items-center gap-1.5 flex-wrap">
                                          <span className="font-medium text-foreground">{rt.name}:</span>
                                          <span className={`font-semibold font-mono ${isExcess ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-600"}`}>
                                            GH₵{rt.price?.toLocaleString()}
                                          </span>
                                          {isExcess && (
                                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-500/15 px-1.5 py-0.2 rounded border border-rose-500/25">
                                              +GH₵{(rt.price - ceiling.maxPrice).toLocaleString()} over cap
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })
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
                                    onClick={() => handleGrantProvisionalPass(hostel)}
                                    disabled={actionLoading}
                                    className="h-8 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 border-primary/30"
                                    title="Issue 1-Year Provisional Pass under Act 389"
                                  >
                                    <Scale className="h-3.5 w-3.5 mr-1" /> Desk Pass
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openHostelReviewDialog(hostel)}
                                    className="h-8 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10"
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Review Filing
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
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                              Pending
                            </span>
                          </div>

                          <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 p-2.5 rounded-lg border border-border/60">
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

                          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">
                              {hostel.submittedAt ? new Date(hostel.submittedAt).toLocaleDateString() : "Recently"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGrantProvisionalPass(hostel)}
                                disabled={actionLoading}
                                className="h-7 text-xs px-2 text-primary border-primary/30"
                              >
                                <Scale className="h-3 w-3 mr-1" /> Desk Pass
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openHostelReviewDialog(hostel)}
                                className="h-7 text-xs px-2.5 font-semibold border-primary/30 text-primary hover:bg-primary/10"
                              >
                                <ShieldCheck className="h-3 w-3 mr-1" /> Review Filing
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

          {/* TAB: STATUTORY DESK REVIEW PIPELINE (ACT 389) */}
          <TabsContent value="deskReview" className="space-y-4 pt-2">
            <Card className="border border-border/60 shadow-xs bg-card">
              <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20 rounded-t-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-primary" /> Statutory Desk Review Pipeline
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/30">
                      Act 389 / L.I. 1724
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Fast-track 1-Year Provisional Accreditation passes based on sworn statutory undertakings with Ghana Card anti-spoof validation. Bypasses physical inspection bottlenecks during peak admission intake.
                  </CardDescription>
                </div>
              </div>

              <CardContent className="p-0">
                {pendingHostels.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-sm space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-foreground">Zero pending statutory desk filings</p>
                    <p className="text-xs">All submitted accommodations have completed statutory review.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40 border-b border-border/60">
                        <TableRow>
                          <TableHead className="w-40">Statutory Status</TableHead>
                          <TableHead>Hostel & Declarant</TableHead>
                          <TableHead>Legal Undertaking Warranties</TableHead>
                          <TableHead>Campus Zoning Tariffs</TableHead>
                          <TableHead className="text-right">Desk Pass Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingHostels.map((hostel) => {
                          const undertaking = (hostel as any).statutoryUndertaking;
                          const hasViolation = (hostel.roomTypes || []).some((rt) => {
                            const c = getStatutoryTariffCeiling(rt.name);
                            return c && rt.price > c.maxPrice;
                          });

                          return (
                            <TableRow key={hostel.id} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="py-3">
                                <div className="space-y-1">
                                  {undertaking ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                      <ShieldCheck className="h-3 w-3" /> Act 389 Attested
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                      <Clock className="h-3 w-3" /> Standard Filing
                                    </span>
                                  )}
                                  <p className="text-[10px] text-muted-foreground font-mono">
                                    {undertaking?.timestamp ? new Date(undertaking.timestamp).toLocaleDateString() : "Digital Submission"}
                                  </p>
                                </div>
                              </TableCell>

                              <TableCell className="py-3">
                                <p className="font-semibold text-foreground text-sm">{hostel.name}</p>
                                <p className="text-xs text-muted-foreground">{hostel.location} • {hostel.institution || "AAMUSTED"}</p>
                                {undertaking ? (
                                  <p className="text-xs text-foreground/80 font-mono mt-0.5">
                                    Declarant: <span className="font-semibold">{undertaking.declaredBy}</span> ({undertaking.declarantGhanaCard})
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Manager: {hostel.createdBy?.fullName || "Private Manager"}
                                  </p>
                                )}
                              </TableCell>

                              <TableCell className="py-3">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap gap-1">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/60">
                                      ✓ Act 389
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/60">
                                      ✓ Fire & Egress
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/60">
                                      ✓ L.I. 1724
                                    </span>
                                    {undertaking?.perjuryAcknowledged && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
                                        Perjury Acknowledged
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">Digital Solemn Declaration verified without paper bottleneck</p>
                                </div>
                              </TableCell>

                              <TableCell className="py-3">
                                {hasViolation ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                    <AlertTriangle className="h-3 w-3" /> Tariff Cap Exceeded
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <CheckCircle2 className="h-3 w-3" /> Tariffs Compliant
                                  </span>
                                )}
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {hostel.roomTypes?.length || 0} room configuration(s)
                                </div>
                              </TableCell>

                              <TableCell className="py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => handleGrantProvisionalPass(hostel)}
                                    disabled={actionLoading}
                                    className="h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                                  >
                                    <Scale className="h-3.5 w-3.5 mr-1" /> Grant 1-Yr Pass
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openHostelReviewDialog(hostel)}
                                    className="h-8 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10"
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Review Filing
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: RENT CAP COMPLIANCE */}
          <TabsContent value="tariffEnforcer" className="space-y-4 pt-2">
            <RentCapComplianceSection
              hostels={[...pendingHostels, ...approvedHostels]}
              currentUser={currentUser}
              userRole={userRole}
              onHostelUpdated={() => loadData()}
            />
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

                          <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60 text-xs space-y-0.5">
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
                    <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
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
                        <TableHeader className="bg-muted/40 border-b border-border/60">
                          <TableRow>
                            <TableHead className="w-32">Status</TableHead>
                            <TableHead>Hostel Name & Location</TableHead>
                            <TableHead>Campus Zone</TableHead>
                            <TableHead>Tariff Status</TableHead>
                            <TableHead>Price Range</TableHead>
                            <TableHead className="text-right">Rating</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredApproved.map((h) => {
                            const hasTariffViolation = h.roomTypes?.some((r) => {
                              const ceiling = getStatutoryTariffCeiling(r.name, r.capacity);
                              return ceiling && typeof r.price === "number" && r.price > ceiling.maxPrice;
                            });
                            const isProvisional = (h as any).provisionalAccreditation;

                            return (
                              <TableRow key={h.id} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="py-3">
                                  <div className="flex flex-col gap-1 items-start">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                        h.availability === "Available"
                                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                          : h.availability === "Limited"
                                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                          : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                      }`}
                                    >
                                      {h.availability || "Available"}
                                    </span>
                                    {isProvisional && (
                                      <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30">
                                        Act 389 Desk Pass
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>

                                <TableCell className="py-3">
                                  <p className="font-medium text-foreground text-sm">{h.name}</p>
                                  <p className="text-xs text-muted-foreground">{h.location}</p>
                                </TableCell>

                                <TableCell className="py-3">
                                  <span className="text-xs font-medium text-foreground">{h.institution || "AAMUSTED"}</span>
                                </TableCell>

                                <TableCell className="py-3">
                                  {hasTariffViolation ? (
                                    <Badge variant="destructive" className="text-[10px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30">
                                      Ceiling Exceeded
                                    </Badge>
                                  ) : (
                                    <span className="text-[11px] text-emerald-600 font-medium">
                                      Compliant
                                    </span>
                                  )}
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
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card Stack */}
                    <div className="block md:hidden divide-y divide-border/60">
                      {filteredApproved.map((h) => {
                        const hasTariffViolation = h.roomTypes?.some((r) => {
                          const ceiling = getStatutoryTariffCeiling(r.name, r.capacity);
                          return ceiling && typeof r.price === "number" && r.price > ceiling.maxPrice;
                        });
                        const isProvisional = (h as any).provisionalAccreditation;

                        return (
                          <div key={h.id} className="p-4 space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <p className="font-semibold text-foreground text-sm">{h.name}</p>
                                <p className="text-xs text-muted-foreground">{h.institution || "AAMUSTED"} • {h.location}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    h.availability === "Available"
                                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                      : h.availability === "Limited"
                                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                      : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                  }`}
                                >
                                  {h.availability || "Available"}
                                </span>
                                {isProvisional && (
                                  <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30">
                                    Act 389 Desk Pass
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {hasTariffViolation && (
                              <div className="pt-0.5">
                                <Badge variant="destructive" className="text-[10px] bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30">
                                  Tariff Ceiling Exceeded
                                </Badge>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-xs pt-1 text-muted-foreground">
                              <span className="font-mono font-semibold text-foreground">
                                GH₵{h.priceRange?.min?.toLocaleString()} – GH₵{h.priceRange?.max?.toLocaleString()}
                              </span>
                              <span className="font-semibold text-foreground">
                                ★ {h.rating ? h.rating.toFixed(1) : "4.5"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* UNIFIED INSPECTION & AUDIT MODAL */}
        <HostelInspectionModal
          hostel={selectedHostel}
          isOpen={isInspectionModalOpen}
          onClose={() => {
            setIsInspectionModalOpen(false);
            setSelectedHostel(null);
          }}
          currentUser={currentUser}
          onDecisionComplete={(updatedHostel, action) => {
            setPendingHostels((prev) =>
              prev.filter((h) => h.id !== updatedHostel?.id && h.id !== selectedHostel?.id)
            );
            if (action === "approve" && updatedHostel) {
              setApprovedHostels((prev) => [
                updatedHostel,
                ...prev.filter((h) => h.id !== updatedHostel.id),
              ]);
            }
          }}
        />
      </main>
    </div>
  );
}
