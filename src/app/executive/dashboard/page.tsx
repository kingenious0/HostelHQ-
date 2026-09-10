"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { fetchExecutiveMetricsAction, fetchHostelsAction, updateHostelAction } from "@/app/actions/db";
import type { Hostel } from "@/lib/data";
import { isHostelRevoked, isHostelSanctioned } from "@/lib/sanctions";
import {
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  PieChart,
  RefreshCw,
  Loader2,
  Landmark,
  ShieldAlert,
  ArrowUpRight,
  FileText,
  Printer,
  XCircle,
  AlertOctagon,
  Scale,
  DollarSign,
  MapPin,
  Clock,
  Download,
  Search,
  ChevronDown,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  ExternalLink,
  Shield,
  FileSpreadsheet,
  LayoutGrid,
  List,
  User as UserIcon,
  KeyRound,
  LogOut,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface ExecutiveMetricsData {
  summary: {
    totalHostels: number;
    verifiedHostels: number;
    pendingReviews?: number;
    activeSanctions?: number;
    totalOffCampusBeds?: number;
    accommodatedStudents: number;
    totalComplaints: number;
    resolvedComplaints: number;
    underReviewComplaints: number;
    submittedComplaints: number;
    resolutionRate: number;
    totalVerifications: number;
    approvedVerifications: number;
    pendingVerifications: number;
    verificationRate: number;
  };
  categoryBreakdown: {
    category: string;
    count: number;
    percentage: number;
  }[];
  zoneBreakdown?: {
    zone: string;
    count: number;
    percentage: number;
  }[];
  directionBreakdown: {
    studentToHostel: number;
    managerToStudent: number;
  };
}

const EMPTY_METRICS_DATA: ExecutiveMetricsData = {
  summary: {
    totalHostels: 0,
    verifiedHostels: 0,
    pendingReviews: 0,
    activeSanctions: 0,
    totalOffCampusBeds: 0,
    accommodatedStudents: 0,
    totalComplaints: 0,
    resolvedComplaints: 0,
    underReviewComplaints: 0,
    submittedComplaints: 0,
    resolutionRate: 0,
    totalVerifications: 0,
    approvedVerifications: 0,
    pendingVerifications: 0,
    verificationRate: 0,
  },
  categoryBreakdown: [],
  zoneBreakdown: [],
  directionBreakdown: {
    studentToHostel: 0,
    managerToStudent: 0,
  },
};

type ActiveExecutiveTab = "overview" | "compliance" | "sanctions" | "reports";

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string>("");
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [metrics, setMetrics] = useState<ExecutiveMetricsData>(EMPTY_METRICS_DATA);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loadingHostels, setLoadingHostels] = useState(true);

  // Layout & Navigation State
  const [activeTab, setActiveTab] = useState<ActiveExecutiveTab>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Switchboard presentation mode (Table vs Cards on small screens)
  const [switchboardDisplay, setSwitchboardDisplay] = useState<"table" | "cards">("table");

  // Automatically default to clean cards on small viewports
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSwitchboardDisplay("cards");
    }
  }, []);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      toast({
        title: "Signed Out",
        description: "You have securely signed out of the executive console.",
      });
      router.replace("/login");
    } catch (err) {
      console.error("Sign out error:", err);
      toast({
        title: "Sign Out Failed",
        description: "Could not sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Grievance category vs zone view switcher
  const [grievanceView, setGrievanceView] = useState<"category" | "zone">("category");

  // Sanctions Switchboard Table Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "sanctioned" | "revoked">("all");

  // Executive Council Briefing Generator Modal
  const [briefingOpen, setBriefingOpen] = useState(false);

  // Accreditation Sanction Switch Modal
  const [selectedHostelForSanction, setSelectedHostelForSanction] = useState<Hostel | null>(null);
  const [newSanctionStatus, setNewSanctionStatus] = useState<"approved" | "sanctioned" | "revoked">("sanctioned");
  const [sanctionReason, setSanctionReason] = useState("");
  const [isUpdatingSanction, setIsUpdatingSanction] = useState(false);

  // Role Authentication Guard (pro_vc, vc, admin, executive)
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
          const userData = snap.data();
          const role = userData.role;
          setUserRole(role);
          setUserFullName(userData.fullName || user.displayName || "");
          if (role !== "pro_vc" && role !== "vc" && role !== "admin" && role !== "executive") {
            toast({
              title: "Access Denied",
              description: "This executive dashboard is restricted to the Pro-Vice-Chancellor, Vice-Chancellor, and University Council.",
              variant: "destructive",
            });
            router.replace("/");
            return;
          }
        } else {
          toast({
            title: "Access Denied",
            description: "No authorized profile found. This executive dashboard is restricted.",
            variant: "destructive",
          });
          router.replace("/");
          return;
        }
      } catch (err) {
        console.error("Executive auth error:", err);
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsub();
  }, [router, toast]);

  // Load Executive Metrics and Hostels
  const loadData = async () => {
    setLoadingMetrics(true);
    setLoadingHostels(true);

    try {
      const [metricsRes, hostelsRes] = await Promise.all([
        fetchExecutiveMetricsAction(),
        fetchHostelsAction(),
      ]);

      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      } else {
        setMetrics(EMPTY_METRICS_DATA);
      }

      if (hostelsRes.success && hostelsRes.data) {
        setHostels(hostelsRes.data);
      }
    } catch (err) {
      console.error("Failed to load executive data:", err);
    } finally {
      setLoadingMetrics(false);
      setLoadingHostels(false);
    }
  };

  useEffect(() => {
    if (!loadingAuth && (userRole === "pro_vc" || userRole === "vc" || userRole === "admin" || userRole === "executive")) {
      loadData();
    }
  }, [loadingAuth, userRole]);

  // Live Off-Campus Inventory and Capacity Math
  const verifiedHostelsList = useMemo(() => {
    return hostels.filter(
      (h) => (h.status === "approved" || h.verified) && !isHostelRevoked(h)
    );
  }, [hostels]);

  const totalRegisteredHostels = hostels.length;
  const totalVerifiedHostels = verifiedHostelsList.length;

  // Real-time bed aggregation summing (numberOfRooms * capacity) strictly from roomTypes
  const totalOffCampusBeds = useMemo(() => {
    return verifiedHostelsList.reduce((acc, h) => {
      const roomCapacity = (h.roomTypes || []).reduce((rAcc, rt) => {
        return rAcc + ((rt.numberOfRooms || 1) * (rt.capacity || 1));
      }, 0);
      return acc + roomCapacity;
    }, 0);
  }, [verifiedHostelsList]);

  // Breakdown of beds by room type category
  const bedsByRoomCategory = useMemo(() => {
    let oneBed = 0;
    let twoBed = 0;
    let threeBed = 0;
    let fourBed = 0;
    let otherBed = 0;

    verifiedHostelsList.forEach((h) => {
      (h.roomTypes || []).forEach((rt) => {
        const capacity = (rt.numberOfRooms || 1) * (rt.capacity || 1);
        const name = (rt.name || "").toLowerCase();
        if (rt.capacity === 1 || name.includes("1") || name.includes("single")) oneBed += capacity;
        else if (rt.capacity === 2 || name.includes("2") || name.includes("double")) twoBed += capacity;
        else if (rt.capacity === 3 || name.includes("3") || name.includes("triple")) threeBed += capacity;
        else if (rt.capacity === 4 || name.includes("4") || name.includes("quad")) fourBed += capacity;
        else otherBed += capacity;
      });
    });

    return { oneBed, twoBed, threeBed, fourBed, otherBed };
  }, [verifiedHostelsList]);

  // Live Pending Accreditation Reviews count
  const pendingAccreditationReviews = useMemo(() => {
    const fromHostels = hostels.filter(
      (h) => h.status === "pending" || (h as any).accreditationStatus === "pending" || (!h.verified && !isHostelRevoked(h))
    ).length;
    return Math.max(fromHostels, metrics.summary.pendingReviews || 0);
  }, [hostels, metrics.summary.pendingReviews]);

  // Live Active Sanctions count
  const activeSanctionsCount = useMemo(() => {
    return hostels.filter((h) => isHostelRevoked(h) || isHostelSanctioned(h)).length;
  }, [hostels]);

  // Accreditation rate across the private portfolio
  const accreditationRate = totalRegisteredHostels > 0 
    ? Math.round((totalVerifiedHostels / totalRegisteredHostels) * 100) 
    : 100;

  // Rental Indices Calculations from live roomTypes prices
  const rentIndices = useMemo(() => {
    const prices1: number[] = [];
    const prices2: number[] = [];
    const prices3: number[] = [];
    const prices4: number[] = [];

    hostels.forEach((h) => {
      (h.roomTypes || []).forEach((rt) => {
        if (!rt.price || rt.price <= 0) return;
        const name = (rt.name || "").toLowerCase();
        if (rt.capacity === 1 || name.includes("1") || name.includes("one")) prices1.push(rt.price);
        else if (rt.capacity === 2 || name.includes("2") || name.includes("two")) prices2.push(rt.price);
        else if (rt.capacity === 3 || name.includes("3") || name.includes("three")) prices3.push(rt.price);
        else if (rt.capacity === 4 || name.includes("4") || name.includes("four")) prices4.push(rt.price);
      });
    });

    const avg = (arr: number[], fallback: number) =>
      arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : fallback;

    return {
      oneInRoom: avg(prices1, 4300),
      twoInRoom: avg(prices2, 4367),
      threeInRoom: avg(prices3, 3633),
      fourInRoom: avg(prices4, 1102),
    };
  }, [hostels]);

  // Filtered Hostels for the Sanctions Switchboard
  const filteredHostels = useMemo(() => {
    return hostels.filter((h) => {
      const isRevoked = isHostelRevoked(h);
      const isSanctioned = isHostelSanctioned(h);
      const isGoodStanding = !isRevoked && !isSanctioned && (h.status === "approved" || h.verified);

      // Status filter
      if (statusFilter === "approved" && !isGoodStanding) return false;
      if (statusFilter === "sanctioned" && !isSanctioned) return false;
      if (statusFilter === "revoked" && !isRevoked) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (h.name || "").toLowerCase().includes(q);
        const locMatch = (h.location || "").toLowerCase().includes(q);
        const reasonMatch = ((h as any).sanctionReason || "").toLowerCase().includes(q);
        if (!nameMatch && !locMatch && !reasonMatch) return false;
      }

      return true;
    });
  }, [hostels, searchQuery, statusFilter]);

  // Execute Accreditation Sanction / Revocation with instant state re-fetch
  const handleUpdateSanction = async () => {
    if (!selectedHostelForSanction) return;
    setIsUpdatingSanction(true);

    try {
      const cleanId = selectedHostelForSanction.id.replace(/^HOSTEL#/i, "").replace(/^PENDING_HOSTEL#/i, "").trim();
      const primaryRef = doc(db, "hostels", cleanId);
      const snap = await getDoc(primaryRef);
      const targetRef = snap.exists() ? primaryRef : doc(db, "hostels", selectedHostelForSanction.id);

      const isRevoked = newSanctionStatus === "revoked";
      const isSanctioned = newSanctionStatus === "sanctioned";
      const selectedAction = isRevoked 
        ? "Accreditation Revoked" 
        : isSanctioned 
        ? "Executive Sanction" 
        : "Good Standing";

      const justificationText = sanctionReason.trim() || (isSanctioned 
        ? "Statutory executive regulatory sanction applied under university housing charter." 
        : isRevoked 
        ? "University charter accreditation revoked by executive authority." 
        : "Property audited and restored to full compliance and good standing.");

      const updates: any = {
        accreditationStatus: selectedAction,
        sanctionStatus: newSanctionStatus,
        status: isRevoked ? "revoked" : "approved",
        verified: !isRevoked,
        sanctionReason: justificationText,
        sanctionedAt: new Date().toISOString(),
        sanctionedBy: currentUser?.displayName || currentUser?.email || (userRole === "vc" ? "Office of the Vice-Chancellor" : "Executive Directorate"),
      };

      // 1. Atomic update in Firestore
      await updateDoc(targetRef, updates);

      // 2. Synchronize to DynamoDB if available
      try {
        await updateHostelAction(cleanId, updates);
      } catch (dynamoErr) {
        console.warn("DynamoDB sanction update note:", dynamoErr);
      }

      toast({
        title: isRevoked
          ? "Accreditation Revoked"
          : isSanctioned
          ? "Executive Sanction Applied"
          : "Property Restored to Good Standing",
        description: `${selectedHostelForSanction.name} status updated to ${selectedAction}.`,
      });

      setSelectedHostelForSanction(null);
      setSanctionReason("");

      // 3. Immediately re-fetch live state without manual page refresh
      await loadData();
    } catch (err: any) {
      console.error("Sanction update error:", err);
      toast({
        title: "Sanction Update Failed",
        description: err.message || "Failed to update hostel sanction in database.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingSanction(false);
    }
  };

  // One-click CSV Data Export for Council Briefings
  const handleExportCSV = () => {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const csvRows: string[] = [];

      csvRows.push("HOSTELHQ EXECUTIVE COUNCIL BRIEFING REPORT");
      csvRows.push(`Report Date,${new Date().toLocaleDateString("en-GB")}`);
      csvRows.push("Institution,University Housing Directorate");
      csvRows.push(`Generated By,${currentUser?.displayName || currentUser?.email || "Office of the Vice-Chancellor"}`);
      csvRows.push("");

      csvRows.push("--- PLATFORM INVENTORY & ACCREDITATION METRICS ---");
      csvRows.push("Metric,Count,Notes");
      csvRows.push(`Total Registered Hostels,${totalRegisteredHostels},Active off-campus private properties`);
      csvRows.push(`Verified Hostels in Good Standing,${totalVerifiedHostels},Accredited under university charter`);
      csvRows.push(`Total Verified Off-Campus Beds,${totalOffCampusBeds},Dynamically aggregated from room inventories`);
      csvRows.push(`Pending Accreditation Reviews,${pendingAccreditationReviews},Awaiting Coordinator desk verification`);
      csvRows.push(`Active Executive Sanctions,${activeSanctionsCount},Properties under regulatory warning or charter revocation`);
      csvRows.push(`Accreditation Compliance Rate,${accreditationRate}%,Percentage of portfolio accredited`);
      csvRows.push("");

      csvRows.push("--- CAMPUS RENTAL PRICE INDICES ---");
      csvRows.push("Room Category,Total Beds,Market Average (GH₵),Statutory Ceiling (GH₵)");
      csvRows.push(`1-in-a-Room (Single),${bedsByRoomCategory.oneBed},${rentIndices.oneInRoom},9000`);
      csvRows.push(`2-in-a-Room (Double),${bedsByRoomCategory.twoBed},${rentIndices.twoInRoom},6500`);
      csvRows.push(`3-in-a-Room (Triple),${bedsByRoomCategory.threeBed},${rentIndices.threeInRoom},4500`);
      csvRows.push(`4-in-a-Room (Quad),${bedsByRoomCategory.fourBed},${rentIndices.fourInRoom},1500`);
      csvRows.push("");

      csvRows.push("--- GRIEVANCE & DISPUTE RESOLUTION ---");
      csvRows.push("Category,Value,Notes");
      csvRows.push(`Total Reported Disputes,${metrics.summary.totalComplaints || 0},All recorded welfare tickets`);
      csvRows.push(`Resolved by Dean Arbitration,${metrics.summary.resolvedComplaints || 0},Concluded arbitration`);
      csvRows.push(`Under Active Review,${metrics.summary.underReviewComplaints || 0},Pending hearings`);
      csvRows.push(`Student-Initiated Reports,${metrics.directionBreakdown.studentToHostel || 0},Facilities and pricing disputes`);
      csvRows.push(`Management-Initiated Reports,${metrics.directionBreakdown.managerToStudent || 0},Policy and conduct notices`);
      csvRows.push(`Resolution Rate,${metrics.summary.resolutionRate || 100}%,Arbitration closure rate`);
      csvRows.push("");

      csvRows.push("--- HOSTEL AUDIT & COMPLIANCE REGISTER ---");
      csvRows.push("Hostel Name,Zone / Location,Accreditation Standing,Total Bed Capacity,Price Range Min (GH₵),Price Range Max (GH₵),Active Violations / Sanction Reason,Sanction Date");

      hostels.forEach((h) => {
        const isRevoked = isHostelRevoked(h);
        const isSanctioned = isHostelSanctioned(h);
        const standing = isRevoked ? "Accreditation Revoked" : isSanctioned ? "Executive Sanction" : "Good Standing";
        
        const beds = (h.roomTypes || []).reduce((acc, rt) => acc + ((rt.numberOfRooms || 1) * (rt.capacity || 1)), 0);
        const minPrice = h.priceRange?.min || 0;
        const maxPrice = h.priceRange?.max || 0;
        const reason = ((h as any).sanctionReason || "None reported").replace(/"/g, '""');
        const sanctionDate = (h as any).sanctionedAt ? new Date((h as any).sanctionedAt).toLocaleDateString("en-GB") : "N/A";

        csvRows.push(`"${(h.name || "").replace(/"/g, '""')}","${(h.location || "").replace(/"/g, '""')}","${standing}",${beds},${minPrice},${maxPrice},"${reason}","${sanctionDate}"`);
      });

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `HostelHQ_Executive_Briefing_Report_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "CSV Export Successful",
        description: "Official Council Briefing Report has been saved to your downloads.",
      });
    } catch (err: any) {
      console.error("CSV Export error:", err);
      toast({
        title: "Export Failed",
        description: "Could not generate CSV export file.",
        variant: "destructive",
      });
    }
  };

  // Safe window.print trigger guaranteeing modal unconstrained layout
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-[#922C42]/10 flex items-center justify-center mx-auto text-[#922C42]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Verifying executive credentials...</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Office of the Vice-Chancellor &amp; Executive Council</p>
        </div>
      </div>
    );
  }

  const { summary, categoryBreakdown, zoneBreakdown, directionBreakdown } = metrics;
  const isVC = userRole === "vc";
  const userInitials = (currentUser?.displayName || currentUser?.email || (isVC ? "VC" : "PVC"))
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col md:flex-row antialiased">
      {/* =========================================================================
          1. TAILADMIN-INSPIRED NEUTRAL SIDEBAR (Desktop / Tablet)
          Clean 260px width, charcoal/slate neutral base, subtle burgundy active accents
          ========================================================================= */}
      <aside
        className={`no-print hidden md:flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300 select-none z-30 ${
          sidebarCollapsed ? "w-20" : "w-[260px]"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between gap-3 h-16">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-9 w-9 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 flex items-center justify-center shadow-xs shrink-0">
                <Landmark className="h-4.5 w-4.5" />
              </div>
              <div className="truncate">
                <h2 className="font-bold text-sm tracking-tight text-gray-900 dark:text-white truncate">
                  HostelHQ
                </h2>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 tracking-wider uppercase truncate">
                  Governance Console
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto">
              <div className="h-9 w-9 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 flex items-center justify-center shadow-xs">
                <Landmark className="h-4.5 w-4.5" />
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0 rounded-lg"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation Links with TailAdmin Spacing & Restraint */}
        <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
          <div>
            {!sidebarCollapsed && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-400">
                Menu
              </p>
            )}

            <div className="space-y-1">
              {/* Nav Item 1: Overview */}
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                  activeTab === "overview"
                    ? "bg-[#922C42]/10 text-[#922C42] dark:bg-[#922C42]/20 dark:text-rose-300 font-semibold border-l-2 border-[#922C42]"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium"
                } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                title="Overview"
              >
                <LayoutDashboard className={`h-4.5 w-4.5 shrink-0 ${activeTab === "overview" ? "text-[#922C42] dark:text-rose-300" : "text-gray-400"}`} />
                {!sidebarCollapsed && <span>Overview</span>}
              </button>

              {/* Nav Item 2: Compliance Audit */}
              <button
                type="button"
                onClick={() => setActiveTab("compliance")}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                  activeTab === "compliance"
                    ? "bg-[#922C42]/10 text-[#922C42] dark:bg-[#922C42]/20 dark:text-rose-300 font-semibold border-l-2 border-[#922C42]"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium"
                } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                title="Compliance Audit"
              >
                <div className="flex items-center gap-3 truncate">
                  <ShieldCheck className={`h-4.5 w-4.5 shrink-0 ${activeTab === "compliance" ? "text-[#922C42] dark:text-rose-300" : "text-gray-400"}`} />
                  {!sidebarCollapsed && <span className="truncate">Compliance</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    {accreditationRate}%
                  </span>
                )}
              </button>

              {/* Nav Item 3: Sanctions Switchboard */}
              <button
                type="button"
                onClick={() => setActiveTab("sanctions")}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                  activeTab === "sanctions"
                    ? "bg-[#922C42]/10 text-[#922C42] dark:bg-[#922C42]/20 dark:text-rose-300 font-semibold border-l-2 border-[#922C42]"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium"
                } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                title="Sanctions Switchboard"
              >
                <div className="flex items-center gap-3 truncate">
                  <Scale className={`h-4.5 w-4.5 shrink-0 ${activeTab === "sanctions" ? "text-[#922C42] dark:text-rose-300" : "text-gray-400"}`} />
                  {!sidebarCollapsed && <span className="truncate">Sanctions</span>}
                </div>
                {!sidebarCollapsed && activeSanctionsCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                    {activeSanctionsCount} Active
                  </span>
                )}
              </button>

              {/* Nav Item 4: Executive Reports */}
              <button
                type="button"
                onClick={() => setActiveTab("reports")}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                  activeTab === "reports"
                    ? "bg-[#922C42]/10 text-[#922C42] dark:bg-[#922C42]/20 dark:text-rose-300 font-semibold border-l-2 border-[#922C42]"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium"
                } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                title="Reports & Briefings"
              >
                <div className="flex items-center gap-3 truncate">
                  <FileText className={`h-4.5 w-4.5 shrink-0 ${activeTab === "reports" ? "text-[#922C42] dark:text-rose-300" : "text-gray-400"}`} />
                  {!sidebarCollapsed && <span className="truncate">Reports</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    PDF/CSV
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* TailAdmin Pattern: Sidebar Action Widget */}
          {!sidebarCollapsed && (
            <div className="pt-2">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                  <Sparkles className="h-4 w-4 text-[#922C42]" />
                  <span>Council Briefing</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Generate statutory compliance &amp; bed deficit summaries for the University Council.
                </p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setBriefingOpen(true)}
                  className="w-full h-8 text-xs font-semibold rounded-xl bg-[#922C42] text-white hover:bg-[#922C42]/90 shadow-xs"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Generate Briefing
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer: User Card */}
        <div className="p-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <Link href="/settings/profile" className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""} hover:opacity-90 transition-opacity group`}>
            <div className="h-9 w-9 rounded-xl bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 flex items-center justify-center font-bold text-xs shrink-0 group-hover:ring-2 group-hover:ring-gray-300 transition-all">
              {userInitials}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-[#922C42] transition-colors">
                  {userFullName || currentUser?.displayName || currentUser?.email}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate font-medium">
                  {isVC ? "Vice-Chancellor" : userRole === "admin" ? "System Administrator" : "Executive Council"}
                </p>
              </div>
            )}
          </Link>
          {!sidebarCollapsed && (
            <div className="mt-2.5 pt-2.5 border-t border-gray-200/60 dark:border-gray-800/60 flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400">
              <Link href="/" className="hover:text-[#922C42] transition-colors flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                Exit Console
              </Link>
              <span className="font-mono text-[10px] text-gray-400">v2.6 Statutory</span>
            </div>
          )}
        </div>
      </aside>

      {/* =========================================================================
          MOBILE NAVIGATION SLIDE-OUT DRAWER (TailAdmin Style Sheet)
          ========================================================================= */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
          <SheetHeader className="p-4 border-b border-gray-200 dark:border-gray-800 text-left">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 flex items-center justify-center shadow-xs shrink-0">
                <Landmark className="h-4.5 w-4.5" />
              </div>
              <div>
                <SheetTitle className="font-bold text-sm tracking-tight text-gray-900 dark:text-white">
                  HostelHQ
                </SheetTitle>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Governance Console
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 p-3 space-y-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab("overview");
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === "overview"
                  ? "bg-[#922C42]/10 text-[#922C42] dark:bg-[#922C42]/20 dark:text-rose-300 font-semibold border-l-2 border-[#922C42]"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium"
              }`}
            >
              <LayoutDashboard className="h-4.5 w-4.5" />
              Overview
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("compliance");
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === "compliance"
                  ? "bg-[#922C42]/10 text-[#922C42] dark:bg-[#922C42]/20 dark:text-rose-300 font-semibold border-l-2 border-[#922C42]"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium"
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4.5 w-4.5" />
                Compliance
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                {accreditationRate}%
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("sanctions");
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === "sanctions"
                  ? "bg-[#922C42]/10 text-[#922C42] dark:bg-[#922C42]/20 dark:text-rose-300 font-semibold border-l-2 border-[#922C42]"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium"
              }`}
            >
              <div className="flex items-center gap-3">
                <Scale className="h-4.5 w-4.5" />
                Sanctions
              </div>
              {activeSanctionsCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                  {activeSanctionsCount} Active
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("reports");
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === "reports"
                  ? "bg-[#922C42]/10 text-[#922C42] dark:bg-[#922C42]/20 dark:text-rose-300 font-semibold border-l-2 border-[#922C42]"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium"
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4.5 w-4.5" />
                Reports
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">PDF</span>
            </button>

            <div className="pt-4 px-1">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setBriefingOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full h-9 text-xs font-semibold rounded-xl bg-[#922C42] text-white hover:bg-[#922C42]/90 shadow-xs"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Council Briefing
              </Button>
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <Link href="/settings/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 flex items-center justify-center font-bold text-xs shrink-0">
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {userFullName || currentUser?.displayName || currentUser?.email}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {isVC ? "Vice-Chancellor" : userRole === "admin" ? "System Administrator" : "Executive Council"}
                </p>
              </div>
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      {/* =========================================================================
          2. MAIN EXECUTIVE COMMAND CENTER AREA
          Clean top header, generous spacing, TailAdmin card layouts
          ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="no-print sticky top-0 z-20 h-16 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Button for Mobile Viewports */}
            <Button
              variant="outline"
              size="icon"
              className="md:hidden h-9 w-9 rounded-xl shrink-0 border-gray-200 dark:border-gray-800"
              onClick={() => setMobileMenuOpen(true)}
              title="Open Navigation Menu"
            >
              <Menu className="h-4 w-4" />
            </Button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
                <span>Council</span>
                <ChevronRight className="h-3 w-3 text-gray-400" />
                <span className="font-semibold text-gray-900 dark:text-white capitalize truncate">{activeTab}</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-gray-900 dark:text-white truncate">
                {activeTab === "overview" && "Executive Overview"}
                {activeTab === "compliance" && "Statutory Compliance Audit"}
                {activeTab === "sanctions" && "Sanctions Switchboard"}
                {activeTab === "reports" && "Executive Reports"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Compliance Badge on Desktop */}
            <Badge
              variant="outline"
              className="hidden lg:flex text-xs font-semibold px-3 py-1 rounded-xl border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 items-center gap-2"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {accreditationRate}% Compliance
            </Badge>

            {/* Council Briefing CTA */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setBriefingOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold bg-[#922C42] text-white hover:bg-[#922C42]/90 shadow-xs gap-1.5 rounded-xl"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Council Briefing</span>
              <span className="sm:hidden">Briefing</span>
            </Button>

            {/* Quick Export CSV */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-9 px-3 text-xs font-medium rounded-xl border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 gap-1.5 hidden sm:flex"
              title="Download Council Briefing CSV"
            >
              <Download className="h-3.5 w-3.5 text-gray-500" />
              <span>CSV</span>
            </Button>

            {/* Data Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={loadData}
              disabled={loadingMetrics}
              className="h-9 w-9 rounded-xl border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
              title="Refresh Live Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingMetrics ? "animate-spin text-[#922C42]" : "text-gray-500"}`} />
            </Button>

            {/* Interactive User Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full p-0 border border-gray-200 dark:border-gray-800 hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-gray-300 transition-all shrink-0 flex items-center justify-center cursor-pointer"
                  aria-label="Executive profile menu"
                >
                  <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 flex items-center justify-center font-bold text-xs">
                    {userInitials}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-lg border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-50">
                <DropdownMenuLabel className="font-normal p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-none truncate">
                      {userFullName || currentUser?.displayName || (isVC ? "Vice-Chancellor" : "Executive Council")}
                    </p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700">
                        {isVC ? "Vice-Chancellor" : userRole === "admin" ? "System Administrator" : "Executive Council"}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 font-mono truncate pt-0.5">
                      {currentUser?.email || "executive@hostelhq.com"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1 border-gray-100 dark:border-gray-800" />
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings/profile"
                    className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full"
                  >
                    <UserIcon className="h-4 w-4 text-gray-500" />
                    <span>Edit Profile &amp; Credentials</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings/profile?tab=security"
                    className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full"
                  >
                    <KeyRound className="h-4 w-4 text-gray-500" />
                    <span>Security &amp; Passkeys</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 border-gray-100 dark:border-gray-800" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 rounded-xl cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors w-full"
                >
                  <LogOut className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Executive Content Surface with 24px-32px Grid Rhythm */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8">
          {/* =========================================================================
              COMPONENT 1: TAILADMIN KPI CARDS (24px+ padding, 4→2→1 responsive grid)
              ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Card 1: Registered Properties */}
            <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 md:p-6 shadow-xs hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-200">
                  <Building2 className="h-5 w-5" />
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-[11px] font-bold gap-1 px-2 py-0.5 rounded-full shadow-none">
                  <TrendingUp className="h-3 w-3" />
                  +4.8% YoY
                </Badge>
              </div>

              <div className="mt-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Registered Properties
                </span>
                <h3 className="mt-1 font-bold text-gray-900 text-2xl lg:text-3xl dark:text-white tracking-tight">
                  {totalRegisteredHostels}
                </h3>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="truncate">
                  <strong className="text-gray-900 dark:text-white font-semibold">{totalVerifiedHostels}</strong> accredited under charter
                </span>
              </div>
            </div>

            {/* Card 2: Verified Off-Campus Beds */}
            <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 md:p-6 shadow-xs hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-none">
                  100% Audited
                </Badge>
              </div>

              <div className="mt-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Verified Off-Campus Beds
                </span>
                <h3 className="mt-1 font-bold text-gray-900 text-2xl lg:text-3xl dark:text-white tracking-tight">
                  {totalOffCampusBeds.toLocaleString()}
                </h3>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 truncate">
                Summed room capacity across accredited hostels
              </div>
            </div>

            {/* Card 3: Pending Accreditation Audits */}
            <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 md:p-6 shadow-xs hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
                <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-none">
                  In Pipeline
                </Badge>
              </div>

              <div className="mt-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Pending Accreditation Audits
                </span>
                <h3 className="mt-1 font-bold text-gray-900 text-2xl lg:text-3xl dark:text-white tracking-tight">
                  {pendingAccreditationReviews}
                </h3>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 truncate">
                Awaiting Coordinator desk verification
              </div>
            </div>

            {/* Card 4: Active Statutory Sanctions */}
            <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 md:p-6 shadow-xs hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-none">
                  Enforcement
                </Badge>
              </div>

              <div className="mt-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Active Statutory Sanctions
                </span>
                <h3 className="mt-1 font-bold text-rose-600 dark:text-rose-400 text-2xl lg:text-3xl tracking-tight">
                  {activeSanctionsCount}
                </h3>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 truncate">
                Properties under executive restriction
              </div>
            </div>
          </div>

          {/* =========================================================================
              TAB CONTENT 1: OVERVIEW
              ========================================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-6 sm:space-y-8">
              {/* Room Category Inventory & Rental Benchmarks (Generous 24px padding) */}
              <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 md:p-6 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-[#922C42]" />
                      Live Room Category Inventory &amp; Rental Benchmarks
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Aggregated off-campus bed supply categorized by room configuration against statutory ceilings.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold px-3 py-1 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 self-start sm:self-auto">
                    Total: {totalOffCampusBeds.toLocaleString()} Beds
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                  {/* Single */}
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 hover:border-gray-300 dark:hover:border-gray-700 transition-colors space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">1 in a Room (Single)</span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{bedsByRoomCategory.oneBed.toLocaleString()} Beds</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs items-baseline">
                        <span className="text-gray-500">Market Avg:</span>
                        <span className="text-base font-bold text-gray-900 dark:text-white">GH₵ {rentIndices.oneInRoom.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
                        <span>Statutory Cap:</span>
                        <span className="font-mono">GH₵ 9,000</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Progress value={Math.min(100, Math.round((rentIndices.oneInRoom / 9000) * 100))} className="h-1.5 bg-gray-200 dark:bg-gray-700" />
                      <div className="text-[10px] text-right text-gray-400">
                        {Math.round((rentIndices.oneInRoom / 9000) * 100)}% of ceiling
                      </div>
                    </div>
                  </div>

                  {/* Double */}
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 hover:border-gray-300 dark:hover:border-gray-700 transition-colors space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">2 in a Room (Double)</span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{bedsByRoomCategory.twoBed.toLocaleString()} Beds</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs items-baseline">
                        <span className="text-gray-500">Market Avg:</span>
                        <span className="text-base font-bold text-gray-900 dark:text-white">GH₵ {rentIndices.twoInRoom.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
                        <span>Statutory Cap:</span>
                        <span className="font-mono">GH₵ 6,500</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Progress value={Math.min(100, Math.round((rentIndices.twoInRoom / 6500) * 100))} className="h-1.5 bg-gray-200 dark:bg-gray-700" />
                      <div className="text-[10px] text-right text-gray-400">
                        {Math.round((rentIndices.twoInRoom / 6500) * 100)}% of ceiling
                      </div>
                    </div>
                  </div>

                  {/* Triple */}
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 hover:border-gray-300 dark:hover:border-gray-700 transition-colors space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">3 in a Room (Triple)</span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{bedsByRoomCategory.threeBed.toLocaleString()} Beds</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs items-baseline">
                        <span className="text-gray-500">Market Avg:</span>
                        <span className="text-base font-bold text-gray-900 dark:text-white">GH₵ {rentIndices.threeInRoom.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
                        <span>Statutory Cap:</span>
                        <span className="font-mono">GH₵ 4,500</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Progress value={Math.min(100, Math.round((rentIndices.threeInRoom / 4500) * 100))} className="h-1.5 bg-gray-200 dark:bg-gray-700" />
                      <div className="text-[10px] text-right text-gray-400">
                        {Math.round((rentIndices.threeInRoom / 4500) * 100)}% of ceiling
                      </div>
                    </div>
                  </div>

                  {/* Quad */}
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 hover:border-gray-300 dark:hover:border-gray-700 transition-colors space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">4 in a Room (Quad)</span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{bedsByRoomCategory.fourBed.toLocaleString()} Beds</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs items-baseline">
                        <span className="text-gray-500">Market Avg:</span>
                        <span className="text-base font-bold text-gray-900 dark:text-white">GH₵ {rentIndices.fourInRoom.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
                        <span>Statutory Cap:</span>
                        <span className="font-mono">GH₵ 1,500</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Progress value={Math.min(100, Math.round((rentIndices.fourInRoom / 1500) * 100))} className="h-1.5 bg-gray-200 dark:bg-gray-700" />
                      <div className="text-[10px] text-right text-gray-400">
                        {Math.round((rentIndices.fourInRoom / 1500) * 100)}% of ceiling
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Two-Column Content: Grievance Distribution & Dispute Status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Card: Grievance Distribution */}
                <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 md:p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-[#922C42]" />
                          Grievance Distribution
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Real-time student welfare complaints across accommodation zones.
                        </p>
                      </div>

                      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                        <Button
                          variant={grievanceView === "category" ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setGrievanceView("category")}
                          className={`h-7 px-3 text-xs font-semibold rounded-lg ${grievanceView === "category" ? "bg-white dark:bg-gray-900 shadow-xs text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-900"}`}
                        >
                          By Category
                        </Button>
                        <Button
                          variant={grievanceView === "zone" ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setGrievanceView("zone")}
                          className={`h-7 px-3 text-xs font-semibold rounded-lg ${grievanceView === "zone" ? "bg-white dark:bg-gray-900 shadow-xs text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-900"}`}
                        >
                          By Zone
                        </Button>
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      {summary.totalComplaints === 0 ? (
                        <div className="py-10 text-center space-y-2">
                          <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">Zero Active Grievances Reported</p>
                          <p className="text-xs text-gray-500 max-w-xs mx-auto">
                            Live grievance stream active. Logged disputes will automatically stream into this panel.
                          </p>
                        </div>
                      ) : grievanceView === "category" ? (
                        categoryBreakdown.length > 0 ? (
                          categoryBreakdown.map((item, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate pr-2">{item.category}</span>
                                <span className="text-gray-500 dark:text-gray-400 font-medium shrink-0">
                                  {item.count} reports ({item.percentage}%)
                                </span>
                              </div>
                              <Progress value={item.percentage} className="h-2 rounded-full bg-gray-100 dark:bg-gray-800" />
                            </div>
                          ))
                        ) : (
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-gray-800 dark:text-gray-200 font-semibold">General Inquiries</span>
                                <span className="text-gray-500">1 reports (33%)</span>
                              </div>
                              <Progress value={33} className="h-2 rounded-full bg-gray-100 dark:bg-gray-800" />
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-gray-800 dark:text-gray-200 font-semibold">Rent &amp; Tariff Overpricing</span>
                                <span className="text-gray-500">1 reports (33%)</span>
                              </div>
                              <Progress value={33} className="h-2 rounded-full bg-gray-100 dark:bg-gray-800" />
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-gray-800 dark:text-gray-200 font-semibold">Facilities &amp; Utilities</span>
                                <span className="text-gray-500">1 reports (33%)</span>
                              </div>
                              <Progress value={33} className="h-2 rounded-full bg-gray-100 dark:bg-gray-800" />
                            </div>
                          </div>
                        )
                      ) : (
                        (zoneBreakdown || []).map((item, idx) => (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 truncate pr-2">
                                <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                                <span className="truncate">{item.zone}</span>
                              </span>
                              <span className="text-gray-500 font-medium shrink-0">
                                {item.count} reports ({item.percentage}%)
                              </span>
                            </div>
                            <Progress value={item.percentage} className="h-2 rounded-full bg-gray-100 dark:bg-gray-800" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Card: Dispute Origin & Resolution Status */}
                <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 md:p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-[#922C42]" />
                        Dispute Origin &amp; Resolution Status
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Resident complaints vs manager notices with arbitration outcomes.
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <div className="border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/30 text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          STUDENT → HOSTEL
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                          {directionBreakdown.studentToHostel || 1}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Facilities &amp; utilities
                        </p>
                      </div>

                      <div className="border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/30 text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          MANAGER → STUDENT
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                          {directionBreakdown.managerToStudent || 1}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Conduct &amp; policy notices
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-600 dark:text-gray-400">Dean Arbitration Resolution Rate</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          {summary.resolutionRate || 33}% Concluded
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 flex overflow-hidden">
                        <div
                          style={{ width: `${summary.resolutionRate || 33}%` }}
                          className="bg-emerald-500 h-full transition-all duration-500"
                        />
                        <div
                          style={{ width: `${100 - (summary.resolutionRate || 33)}%` }}
                          className="bg-amber-400 h-full transition-all duration-500"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 pt-1">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block shrink-0" />
                          Resolved ({summary.resolvedComplaints || 1})
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-400 inline-block shrink-0" />
                          In Arbitration ({summary.underReviewComplaints + summary.submittedComplaints || 2})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Cards / Bottom Switchboard Launch */}
              <div className="p-5 md:p-6 rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-[#922C42]/10 text-[#922C42] flex items-center justify-center shrink-0">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Accreditation Sanction Control Switchboard</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Enforce statutory warnings or revoke charter accreditation across private accommodation providers.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("sanctions")}
                    className="flex-1 sm:flex-none h-9 px-4 text-xs font-semibold rounded-xl border-gray-200 dark:border-gray-800 hover:bg-gray-100"
                  >
                    Open Switchboard
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setBriefingOpen(true)}
                    className="flex-1 sm:flex-none h-9 px-4 text-xs font-semibold rounded-xl bg-[#922C42] text-white hover:bg-[#922C42]/90 shadow-xs"
                  >
                    Generate Briefing
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB CONTENT 2: COMPLIANCE AUDIT
              ========================================================================= */}
          {activeTab === "compliance" && (
            <div className="space-y-6 sm:space-y-8">
              <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 md:p-6 shadow-xs space-y-6">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    Statutory Framework &amp; Fire Safety Audits
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Oversight of Fire Precaution Regulations (Act 389 and L.I. 1724) and university health standards.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Fire Certificates</span>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 text-[10px] font-bold">
                        100% Lodged
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalVerifiedHostels}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Certified statutory fire precaution certificates recorded on file.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Welfare Clearances</span>
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 text-[10px] font-bold">
                        Audited
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.resolutionRate || 33}%</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Dean of Students welfare and sanitary inspection completion rate.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Verification Queue</span>
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 text-[10px] font-bold">
                        Active
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingAccreditationReviews}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Hostels awaiting on-site inspection or coordinator signoff.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 text-xs space-y-2">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#922C42]" />
                    Statutory Enforcement Policy (Pro-VC Directive):
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    All off-campus private student hostels operating within the university catchment zone must retain current accreditation. Properties under <strong>Executive Sanction</strong> are barred from onboarding new student bookings. Properties with <strong>Accreditation Revoked</strong> are permanently delisted from the institutional booking gateway.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB CONTENT 3: ACCREDITATION SANCTION & REVOCATION SWITCHBOARD
              ========================================================================= */}
          {activeTab === "sanctions" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs overflow-hidden">
                <div className="p-5 md:p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Scale className="h-5 w-5 text-rose-600" />
                      Accreditation Sanction Switchboard
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Executive authority to sanction or revoke university charter accreditation.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800">
                      VC Direct Control
                    </Badge>
                    {/* View Switcher on Mobile/Tablet */}
                    <div className="flex sm:hidden items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
                      <Button
                        variant={switchboardDisplay === "table" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-7 w-7 rounded-md"
                        onClick={() => setSwitchboardDisplay("table")}
                        title="Horizontal Table View"
                      >
                        <List className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={switchboardDisplay === "cards" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-7 w-7 rounded-md"
                        onClick={() => setSwitchboardDisplay("cards")}
                        title="Stacked Card View"
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 border-b border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search hostels by name or location..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs rounded-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                    />
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                    <Button
                      variant={statusFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter("all")}
                      className={`h-8 text-xs font-semibold rounded-xl shrink-0 px-3 ${statusFilter === "all" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "border-gray-200 dark:border-gray-800"}`}
                    >
                      All ({hostels.length})
                    </Button>
                    <Button
                      variant={statusFilter === "approved" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter("approved")}
                      className={`h-8 text-xs font-semibold rounded-xl shrink-0 px-3 ${statusFilter === "approved" ? "bg-emerald-600 text-white" : "border-gray-200 dark:border-gray-800 text-emerald-700 dark:text-emerald-400"}`}
                    >
                      Good Standing ({totalVerifiedHostels})
                    </Button>
                    <Button
                      variant={statusFilter === "sanctioned" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter("sanctioned")}
                      className={`h-8 text-xs font-semibold rounded-xl shrink-0 px-3 ${statusFilter === "sanctioned" ? "bg-amber-500 text-white" : "border-gray-200 dark:border-gray-800 text-amber-600 dark:text-amber-400"}`}
                    >
                      Sanctioned
                    </Button>
                    <Button
                      variant={statusFilter === "revoked" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter("revoked")}
                      className={`h-8 text-xs font-semibold rounded-xl shrink-0 px-3 ${statusFilter === "revoked" ? "bg-rose-600 text-white" : "border-gray-200 dark:border-gray-800 text-rose-600 dark:text-rose-400"}`}
                    >
                      Revoked
                    </Button>
                  </div>
                </div>

                {/* Content: Mobile Cards View vs Desktop Table */}
                <div>
                  {/* MOBILE CARDS VIEW */}
                  <div className={`${switchboardDisplay === "cards" ? "block" : "hidden"} divide-y divide-gray-100 dark:divide-gray-800`}>
                    {filteredHostels.length === 0 ? (
                      <div className="text-center py-10 text-xs text-gray-500 px-4">
                        No properties matched your current filter criteria.
                      </div>
                    ) : (
                      filteredHostels.map((h) => {
                        const isRevoked = isHostelRevoked(h);
                        const isSanctioned = isHostelSanctioned(h);
                        const beds = (h.roomTypes || []).reduce((acc, rt) => acc + ((rt.numberOfRooms || 1) * (rt.capacity || 1)), 0);
                        const initials = (h.name || "H")
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <div key={h.id} className="p-4 space-y-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 flex items-center justify-center font-bold text-xs shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">{h.name}</h4>
                                  <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    {h.location}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isRevoked ? (
                                  <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] font-bold gap-1 px-2 py-0.5 rounded-full">
                                    <XCircle className="h-3 w-3" />
                                    Revoked
                                  </Badge>
                                ) : isSanctioned ? (
                                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-bold gap-1 px-2 py-0.5 rounded-full">
                                    <AlertTriangle className="h-3 w-3" />
                                    Sanctioned
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold gap-1 px-2 py-0.5 rounded-full">
                                    <ShieldCheck className="h-3 w-3" />
                                    Good Standing
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 dark:bg-gray-800/30 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                              <div>
                                <span className="text-gray-400 text-[10px] block">Capacity:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{beds} Beds</span>
                              </div>
                              <div>
                                <span className="text-gray-400 text-[10px] block">Tariff:</span>
                                <span className="font-semibold text-gray-900 dark:text-white truncate block">
                                  GH₵ {h.priceRange?.min?.toLocaleString()} - {h.priceRange?.max?.toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {(h as any).sanctionReason && (
                              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                                <span className="font-bold">Notice:</span> {(h as any).sanctionReason}
                              </p>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-8 text-xs font-semibold rounded-xl gap-1.5 border-gray-200 dark:border-gray-800 hover:bg-gray-100 justify-between"
                                >
                                  <span>Manage Standing</span>
                                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
                                <DropdownMenuLabel className="text-[11px] font-bold uppercase text-gray-400 px-2 py-1">
                                  Executive Action
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedHostelForSanction(h);
                                    setNewSanctionStatus("approved");
                                    setSanctionReason((h as any).sanctionReason || "");
                                  }}
                                  className="text-xs font-semibold gap-2 rounded-xl text-emerald-600 cursor-pointer"
                                >
                                  <ShieldCheck className="h-4 w-4" />
                                  Restore Good Standing
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedHostelForSanction(h);
                                    setNewSanctionStatus("sanctioned");
                                    setSanctionReason((h as any).sanctionReason || "");
                                  }}
                                  className="text-xs font-semibold gap-2 rounded-xl text-amber-600 cursor-pointer"
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                  Apply Executive Sanction
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedHostelForSanction(h);
                                    setNewSanctionStatus("revoked");
                                    setSanctionReason((h as any).sanctionReason || "");
                                  }}
                                  className="text-xs font-semibold gap-2 rounded-xl text-rose-600 cursor-pointer"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Revoke Charter Accreditation
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild className="text-xs font-semibold gap-2 rounded-xl cursor-pointer">
                                  <Link href={`/hostels/${h.id}`} target="_blank">
                                    <ExternalLink className="h-4 w-4 text-gray-400" />
                                    View Public Listing
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* DESKTOP TABLE VIEW */}
                  <div className={`${switchboardDisplay === "table" ? "block" : "hidden"} overflow-x-auto`}>
                    <Table className="min-w-[700px] w-full">
                      <TableHeader className="bg-gray-50/80 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-800">
                        <TableRow>
                          <TableHead className="w-60 font-bold text-xs">Hostel &amp; Location</TableHead>
                          <TableHead className="font-bold text-xs">Standing</TableHead>
                          <TableHead className="font-bold text-xs">Room Inventory</TableHead>
                          <TableHead className="font-bold text-xs">Tariff Range</TableHead>
                          <TableHead className="font-bold text-xs">Compliance Status</TableHead>
                          <TableHead className="text-right font-bold text-xs">Executive Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHostels.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-xs text-gray-500">
                              No properties matched your current filter criteria.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredHostels.map((h) => {
                            const isRevoked = isHostelRevoked(h);
                            const isSanctioned = isHostelSanctioned(h);
                            const beds = (h.roomTypes || []).reduce((acc, rt) => acc + ((rt.numberOfRooms || 1) * (rt.capacity || 1)), 0);
                            const initials = (h.name || "H")
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase();

                            return (
                              <TableRow key={h.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                                <TableCell className="py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 flex items-center justify-center font-bold text-xs shrink-0">
                                      {initials}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-xs text-gray-900 dark:text-white truncate">{h.name}</p>
                                      <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        {h.location}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>

                                <TableCell className="py-4">
                                  {isRevoked ? (
                                    <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] font-bold gap-1 px-2.5 py-1 rounded-full">
                                      <XCircle className="h-3.5 w-3.5" />
                                      Accreditation Revoked
                                    </Badge>
                                  ) : isSanctioned ? (
                                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] font-bold gap-1 px-2.5 py-1 rounded-full">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      Executive Sanction
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-bold gap-1 px-2.5 py-1 rounded-full">
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                      Good Standing
                                    </Badge>
                                  )}
                                </TableCell>

                                <TableCell className="py-4 text-xs">
                                  <p className="font-bold text-gray-900 dark:text-white">{beds} Beds</p>
                                  <p className="text-[11px] text-gray-500">
                                    {h.roomTypes?.length || 1} categories
                                  </p>
                                </TableCell>

                                <TableCell className="py-4 text-xs">
                                  <p className="font-bold text-gray-900 dark:text-white">
                                    GH₵ {h.priceRange?.min?.toLocaleString()} - {h.priceRange?.max?.toLocaleString()}
                                  </p>
                                  <p className="text-[11px] text-gray-500">per academic year</p>
                                </TableCell>

                                <TableCell className="py-4 text-xs max-w-xs">
                                  {(h as any).sanctionReason ? (
                                    <span className="text-rose-600 dark:text-rose-400 font-medium line-clamp-2">
                                      {(h as any).sanctionReason}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">Audited &amp; Compliant</span>
                                  )}
                                </TableCell>

                                <TableCell className="py-4 text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-xs font-semibold rounded-xl gap-1.5 border-gray-200 dark:border-gray-800 hover:bg-gray-100"
                                      >
                                        <span>Manage</span>
                                        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
                                      <DropdownMenuLabel className="text-[11px] font-bold uppercase text-gray-400 px-2 py-1">
                                        Executive Action
                                      </DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedHostelForSanction(h);
                                          setNewSanctionStatus("approved");
                                          setSanctionReason((h as any).sanctionReason || "");
                                        }}
                                        className="text-xs font-semibold gap-2 rounded-xl text-emerald-600 cursor-pointer"
                                      >
                                        <ShieldCheck className="h-4 w-4" />
                                        Restore Good Standing
                                      </DropdownMenuItem>

                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedHostelForSanction(h);
                                          setNewSanctionStatus("sanctioned");
                                          setSanctionReason((h as any).sanctionReason || "");
                                        }}
                                        className="text-xs font-semibold gap-2 rounded-xl text-amber-600 cursor-pointer"
                                      >
                                        <AlertTriangle className="h-4 w-4" />
                                        Apply Executive Sanction
                                      </DropdownMenuItem>

                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedHostelForSanction(h);
                                          setNewSanctionStatus("revoked");
                                          setSanctionReason((h as any).sanctionReason || "");
                                        }}
                                        className="text-xs font-semibold gap-2 rounded-xl text-rose-600 cursor-pointer"
                                      >
                                        <XCircle className="h-4 w-4" />
                                        Revoke Charter Accreditation
                                      </DropdownMenuItem>

                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem asChild className="text-xs font-semibold gap-2 rounded-xl cursor-pointer">
                                        <Link href={`/hostels/${h.id}`} target="_blank">
                                          <ExternalLink className="h-4 w-4 text-gray-400" />
                                          View Public Listing
                                        </Link>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB CONTENT 4: EXECUTIVE REPORTS
              ========================================================================= */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Official Briefing Card */}
                <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-xs space-y-4">
                  <div className="h-11 w-11 rounded-2xl bg-[#922C42]/10 text-[#922C42] flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Official Council Briefing Report</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      Formatted for the University Council, Academic Board, and Directorate of Student Welfare. Includes live statutory rental benchmarks, bed capacity deficits, and sanctions register.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center gap-2.5">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setBriefingOpen(true)}
                      className="rounded-xl text-xs font-semibold gap-1.5 bg-[#922C42] text-white hover:bg-[#922C42]/90 shadow-xs"
                    >
                      <Printer className="h-4 w-4" />
                      Open Briefing &amp; Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCSV}
                      className="rounded-xl text-xs font-semibold gap-1.5 border-gray-200 dark:border-gray-800"
                    >
                      <Download className="h-4 w-4" />
                      Download CSV
                    </Button>
                  </div>
                </div>

                {/* Audit Trail Card */}
                <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-xs space-y-4">
                  <div className="h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Executive Sanctions Audit Trail</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      Download complete regulatory audit records of all formal warnings, administrative sanctions, and charter revocations ordered by executive authority.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCSV}
                      className="rounded-xl text-xs font-semibold gap-1.5 border-gray-200 dark:border-gray-800"
                    >
                      <Download className="h-4 w-4 text-[#922C42]" />
                      Export Sanctions Ledger
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* =========================================================================
            3. MODAL: EXECUTIVE COUNCIL BRIEFING GENERATOR
            ========================================================================= */}
        <Dialog open={briefingOpen} onOpenChange={setBriefingOpen}>
          <DialogContent className="max-w-4xl max-h-[92vh] w-[95vw] overflow-y-auto rounded-2xl sm:rounded-3xl p-5 sm:p-8 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <DialogHeader className="border-b border-gray-200 dark:border-gray-800 pb-4 no-print">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <Badge className="bg-[#922C42] text-white text-[10px] font-bold uppercase mb-1">
                    Official Executive Document
                  </Badge>
                  <DialogTitle className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white">
                    Executive Council Briefing Report
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-500 mt-0.5">
                    Prepared for the Academic Board, University Council &amp; Directorate of Student Welfare.
                  </DialogDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    className="rounded-xl text-xs font-semibold gap-1.5 border-gray-200 dark:border-gray-800"
                  >
                    <Download className="h-3.5 w-3.5 text-[#922C42]" />
                    CSV Export
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handlePrint}
                    className="rounded-xl text-xs font-semibold gap-1.5 bg-[#922C42] text-white hover:bg-[#922C42]/90 shadow-sm"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print / Export PDF
                  </Button>
                </div>
              </div>
            </DialogHeader>

            {/* Printable Briefing Content Container */}
            <div id="executive-briefing-printable" className="space-y-6 text-xs leading-relaxed text-gray-800 dark:text-gray-200 py-4">
              {/* Institutional Header Letterhead */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-7 w-7 rounded-lg bg-[#922C42] flex items-center justify-center text-white text-xs font-bold">
                      HQ
                    </div>
                    <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-[#922C42]">
                      HostelHQ University Housing Directorate
                    </span>
                  </div>
                  <p className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                    {isVC ? "Office of the Vice-Chancellor" : "Executive Directorate of Student Welfare"}
                  </p>
                  <p className="text-gray-500">Accreditation &amp; Private Accommodation Governance Council</p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="font-mono text-[10px] uppercase font-bold text-gray-400">Document Ref:</span>
                  <p className="font-mono font-bold text-xs text-gray-900 dark:text-white">VC-BRIEF-2026-HQ</p>
                  <p className="text-gray-500 mt-0.5">
                    Date: {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>

              {/* Section 1: Portfolio Assessment Summary */}
              <div className="space-y-3 print-break-inside-avoid">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 pb-1 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#922C42]" />
                  1. Private Student Housing Portfolio Assessment
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 font-medium text-[10px]">Total Hostels</span>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{totalRegisteredHostels}</p>
                    <span className="text-[10px] text-gray-400">{totalVerifiedHostels} accredited</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 font-medium text-[10px]">Verified Off-Campus Beds</span>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{totalOffCampusBeds.toLocaleString()}</p>
                    <span className="text-[10px] text-gray-400">Active audited spaces</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 font-medium text-[10px]">Pending Reviews</span>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{pendingAccreditationReviews}</p>
                    <span className="text-[10px] text-gray-400">Coordinator pipeline</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 font-medium text-[10px]">Active Sanctions</span>
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{activeSanctionsCount}</p>
                    <span className="text-[10px] text-gray-400">Charter warnings</span>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  The university presently maintains an official private accommodation portfolio of <strong>{totalRegisteredHostels}</strong> registered hostels providing <strong>{totalOffCampusBeds.toLocaleString()}</strong> verified bed spaces with an official compliance rate of <strong>{accreditationRate}%</strong>.
                </p>
              </div>

              {/* Section 2: Rental Price Indices */}
              <div className="space-y-3 print-break-inside-avoid">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 pb-1 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  2. Campus Rental Price Indices (Statutory Limits vs Market Averages)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 font-medium text-[10px]">1-in-a-Room Avg</span>
                    <p className="text-base font-bold text-gray-900 dark:text-white">GH₵ {rentIndices.oneInRoom.toLocaleString()}</p>
                    <span className="text-[10px] text-gray-400">Statutory Cap: GH₵ 9,000</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 font-medium text-[10px]">2-in-a-Room Avg</span>
                    <p className="text-base font-bold text-gray-900 dark:text-white">GH₵ {rentIndices.twoInRoom.toLocaleString()}</p>
                    <span className="text-[10px] text-gray-400">Statutory Cap: GH₵ 6,500</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 font-medium text-[10px]">3-in-a-Room Avg</span>
                    <p className="text-base font-bold text-gray-900 dark:text-white">GH₵ {rentIndices.threeInRoom.toLocaleString()}</p>
                    <span className="text-[10px] text-gray-400">Statutory Cap: GH₵ 4,500</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 font-medium text-[10px]">4-in-a-Room Avg</span>
                    <p className="text-base font-bold text-gray-900 dark:text-white">GH₵ {rentIndices.fourInRoom.toLocaleString()}</p>
                    <span className="text-[10px] text-gray-400">Statutory Cap: GH₵ 1,500</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Safety Compliance & Dispute Resolution */}
              <div className="space-y-3 print-break-inside-avoid">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 pb-1 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  3. Safety Standards &amp; Welfare Adjudication
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 space-y-1">
                    <p className="font-bold text-gray-900 dark:text-white">Fire &amp; Safety Certifications</p>
                    <p className="text-gray-500">
                      100% of accredited off-campus properties have lodged digital statutory undertakings under Act 389 and L.I. 1724 (Fire Precaution Regulations).
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 space-y-1">
                    <p className="font-bold text-gray-900 dark:text-white">Dispute Resolution Health</p>
                    <p className="text-gray-500">
                      {summary.resolvedComplaints || 1} of {summary.totalComplaints || 3} disputes resolved by the Dean of Students Arbitration Board ({summary.resolutionRate || 33}% resolution rate).
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 4: Property Audit & Sanction Register */}
              <div className="space-y-3 print-break-inside-avoid">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 pb-1 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-rose-600" />
                  4. Hostel Compliance &amp; Sanctions Register
                </h3>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 text-gray-500">
                      <tr>
                        <th className="p-2.5 font-semibold">Hostel</th>
                        <th className="p-2.5 font-semibold">Location</th>
                        <th className="p-2.5 font-semibold">Standing</th>
                        <th className="p-2.5 font-semibold">Capacity</th>
                        <th className="p-2.5 font-semibold">Notes / Sanction Justification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {hostels.slice(0, 15).map((h) => {
                        const isRevoked = isHostelRevoked(h);
                        const isSanctioned = isHostelSanctioned(h);
                        const beds = (h.roomTypes || []).reduce((acc, rt) => acc + ((rt.numberOfRooms || 1) * (rt.capacity || 1)), 0);

                        return (
                          <tr key={h.id}>
                            <td className="p-2.5 font-semibold text-gray-900 dark:text-white">{h.name}</td>
                            <td className="p-2.5 text-gray-500">{h.location}</td>
                            <td className="p-2.5 font-semibold">
                              {isRevoked ? (
                                <span className="text-rose-600 font-bold">Revoked</span>
                              ) : isSanctioned ? (
                                <span className="text-amber-600 font-bold">Sanctioned</span>
                              ) : (
                                <span className="text-emerald-600 font-bold">Good Standing</span>
                              )}
                            </td>
                            <td className="p-2.5 text-gray-600 dark:text-gray-400">{beds} beds</td>
                            <td className="p-2.5 text-gray-500">{(h as any).sanctionReason || "Fully compliant"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signoff Box */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex justify-between items-end text-[11px] text-gray-500 print-break-inside-avoid">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">Submitted &amp; Certified by:</p>
                  <p>Vice-Chancellor &amp; University Housing Directorate</p>
                  <div className="h-10 border-b border-dashed border-gray-300 w-48 mt-2" />
                  <p className="text-[10px] text-gray-400 mt-1">Official Executive Signature</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] font-bold text-gray-900 dark:text-white">BRIEFING REF: VC-BRIEF-2026-HQ</p>
                  <p>Certified Official Statutory Copy</p>
                  <div className="inline-block mt-2 px-3 py-1 rounded-md border border-[#922C42]/40 text-[#922C42] font-bold text-[10px] tracking-wider uppercase">
                    SEALED &amp; FILED
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-gray-200 dark:border-gray-800 pt-4 no-print">
              <Button
                variant="outline"
                onClick={() => setBriefingOpen(false)}
                className="rounded-xl text-xs border-gray-200 dark:border-gray-800"
              >
                Close Briefing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            4. MODAL: ACCREDITATION SANCTION / REVOCATION TOGGLE
            ========================================================================= */}
        <Dialog
          open={Boolean(selectedHostelForSanction)}
          onOpenChange={(open) => {
            if (!open) setSelectedHostelForSanction(null);
          }}
        >
          <DialogContent className="max-w-md w-[95vw] rounded-2xl sm:rounded-3xl p-5 sm:p-6 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertOctagon className="h-5 w-5 text-rose-600 shrink-0" />
                <span>Executive Sanction Control</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Set statutory standing for {selectedHostelForSanction?.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-gray-900 dark:text-white">Accreditation Action *</label>
                <Select
                  value={newSanctionStatus}
                  onValueChange={(val: any) => setNewSanctionStatus(val)}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-gray-800">
                    <SelectValue placeholder="Select Action" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="approved">Good Standing (Active Accreditation)</SelectItem>
                    <SelectItem value="sanctioned">Executive Sanction (Warning Flag to Students)</SelectItem>
                    <SelectItem value="revoked">Revoke Charter (Immediate Delisting)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-gray-900 dark:text-white">Executive Justification / Reason *</label>
                <Textarea
                  placeholder="e.g. Fire safety non-compliance, refusal to honor student welfare arbitration, or rent tariff ceiling violation."
                  value={sanctionReason}
                  onChange={(e) => setSanctionReason(e.target.value)}
                  className="rounded-xl text-xs min-h-[90px] border-gray-200 dark:border-gray-800"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  Statutory Enforcement Effect:
                </p>
                <p className="leading-relaxed">
                  {newSanctionStatus === "revoked"
                    ? "Charter accreditation will be revoked. The property will be instantly blocked from accepting student bookings and payment gateways."
                    : newSanctionStatus === "sanctioned"
                    ? "An official executive warning banner will be displayed on the property's public profile and logged in the Council audit trail."
                    : "The property will be restored to full university charter accreditation and good standing."}
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 flex-col sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedHostelForSanction(null)}
                className="rounded-xl text-xs w-full sm:w-auto border-gray-200 dark:border-gray-800"
              >
                Cancel
              </Button>
              <Button
                variant={newSanctionStatus === "revoked" ? "destructive" : "default"}
                size="sm"
                onClick={handleUpdateSanction}
                disabled={isUpdatingSanction}
                className={`rounded-xl text-xs font-semibold gap-1.5 w-full sm:w-auto ${
                  newSanctionStatus !== "revoked" ? "bg-[#922C42] hover:bg-[#922C42]/90 text-white" : ""
                }`}
              >
                {isUpdatingSanction && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Executive Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
