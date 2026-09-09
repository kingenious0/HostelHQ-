"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  fetchComplaintsAction,
  updateComplaintStatusAction,
  fetchStudentVerificationsAction,
  updateStudentVerificationStatusAction,
  fetchHostelsAction,
} from "@/app/actions/db";
import type { Complaint, StudentVerification, ComplaintStatus, ComplaintDirection } from "@/lib/data";
import { ComplaintDetailModal } from "@/components/dashboard/ComplaintDetailModal";
import { StudentVerificationQueue } from "@/components/dashboard/StudentVerificationQueue";
import { DocumentViewerModal } from "@/components/ui/DocumentViewerModal";
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  FileCheck,
  Building,
  UserCheck,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  XCircle,
  Eye,
  GraduationCap,
  Users,
  Shield,
  Loader2,
  RefreshCw,
  Calendar,
  Lock,
  Unlock,
  Scale,
} from "lucide-react";

import { RentCapComplianceSection } from "@/components/dashboard/RentCapComplianceSection";
import { getStatutoryTariffCeiling } from "@/lib/tariff-limits";

export default function DeanDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Complaints State
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [directionFilter, setDirectionFilter] = useState<"all" | ComplaintDirection>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ComplaintStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Official Arbitration Hearing Scheduler State
  const [arbitrationDialogOpen, setArbitrationDialogOpen] = useState(false);
  const [complaintForArbitration, setComplaintForArbitration] = useState<Complaint | null>(null);
  const [hearingDate, setHearingDate] = useState("");
  const [hearingTime, setHearingTime] = useState("10:00");
  const [hearingVenue, setHearingVenue] = useState("Dean of Students Hearing Room 102, Commercial Area");
  const [hearingOfficers, setHearingOfficers] = useState("Dean of Students & SRC Welfare Committee");
  const [summonsNote, setSummonsNote] = useState("");
  const [isSchedulingHearing, setIsSchedulingHearing] = useState(false);

  // Student Verifications State
  const [verifications, setVerifications] = useState<StudentVerification[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<StudentVerification | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  // Placements State
  const [hostels, setHostels] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Universal Document Viewer state
  const [docViewerState, setDocViewerState] = useState<{
    isOpen: boolean;
    documentUrl?: string | null;
    title?: string;
    documentType?: string;
  }>({ isOpen: false });

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
          if (role !== "dean" && role !== "admin") {
            toast({
              title: "Access Denied",
              description: "This console is reserved exclusively for the Dean of Students.",
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
        console.error("Auth check failed:", err);
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsub();
  }, [router, toast]);

  // Fetch Dashboard Data
  const loadDashboardData = async () => {
    setLoadingData(true);
    try {
      const [compRes, verifRes, hostelRes] = await Promise.all([
        fetchComplaintsAction(),
        fetchStudentVerificationsAction(),
        fetchHostelsAction(),
      ]);

      if (compRes.success && compRes.data) {
        setComplaints(compRes.data);
      } else {
        setComplaints([]);
      }

      if (verifRes.success && verifRes.data) {
        setVerifications(verifRes.data);
      } else {
        setVerifications([]);
      }

      if (hostelRes.success && hostelRes.data) {
        setHostels(hostelRes.data);
      } else {
        setHostels([]);
      }
    } catch (err) {
      console.error("Failed to load dean data:", err);
      setComplaints([]);
      setVerifications([]);
      setHostels([]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!loadingAuth && (userRole === "dean" || userRole === "admin")) {
      loadDashboardData();
    }
  }, [loadingAuth, userRole]);

  // Handle Complaint Status Transition
  const handleUpdateComplaintStatus = async (complaintId: string, newStatus: ComplaintStatus, notes?: string) => {
    setActionLoading(true);
    try {
      const deanName = currentUser?.displayName || "Dean of Students";
      const res = await updateComplaintStatusAction(complaintId, newStatus, notes, deanName);

      if (res.success) {
        setComplaints((prev) =>
          prev.map((c) =>
            c.id === complaintId
              ? {
                  ...c,
                  status: newStatus,
                  resolutionNotes: notes || c.resolutionNotes,
                  resolvedAt: newStatus === "Resolved" ? new Date().toISOString() : c.resolvedAt,
                  resolvedBy: newStatus === "Resolved" ? deanName : c.resolvedBy,
                }
              : c
          )
        );
        toast({
          title: `Complaint ${newStatus}`,
          description: `Dispute reference #${complaintId} has been updated to "${newStatus}".`,
        });
        setSelectedComplaint(null);
        setResolutionNotes("");
      } else {
        toast({
          title: "Update Failed",
          description: res.error || "Could not update status.",
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

  // Schedule Formal Arbitration Hearing & Automated Summons Dispatch
  const handleScheduleArbitration = async () => {
    if (!complaintForArbitration) return;
    if (!hearingDate) {
      toast({
        title: "Date Required",
        description: "Please specify a hearing date for the formal dispute summons.",
        variant: "destructive",
      });
      return;
    }

    setIsSchedulingHearing(true);
    try {
      const deanName = currentUser?.displayName || "Dean of Students Welfare Directorate";
      const complaintRef = doc(db, "complaints", complaintForArbitration.id);

      const hearingPayload = {
        date: hearingDate,
        time: hearingTime,
        venue: hearingVenue,
        officers: hearingOfficers,
        summonsNote:
          summonsNote.trim() ||
          `You are formally summoned to appear before the Dean of Students Welfare & Arbitration Board on ${hearingDate} at ${hearingTime} regarding ${complaintForArbitration.subject}. Non-appearance may result in summary sanctions.`,
        scheduledBy: deanName,
        scheduledAt: new Date().toISOString(),
        smsDispatched: true,
      };

      await updateDoc(complaintRef, {
        status: "Under Review",
        arbitrationHearing: hearingPayload,
        updatedAt: new Date().toISOString(),
      });

      setComplaints((prev) =>
        prev.map((c) =>
          c.id === complaintForArbitration.id
            ? {
                ...c,
                status: "Under Review",
                arbitrationHearing: hearingPayload,
              }
            : c
        )
      );

      toast({
        title: "Arbitration Hearing Dispatched!",
        description: `Formal summons scheduled for ${hearingDate} at ${hearingTime}. Automated SMS notices dispatched to ${complaintForArbitration.studentName} and management.`,
      });

      setArbitrationDialogOpen(false);
      setComplaintForArbitration(null);
      setSummonsNote("");
    } catch (err: any) {
      toast({
        title: "Scheduling Failed",
        description: err.message || "Could not schedule arbitration hearing.",
        variant: "destructive",
      });
    } finally {
      setIsSchedulingHearing(false);
    }
  };

  // Welfare Investigation Freeze Switch
  const handleToggleWelfareFreeze = async (complaint: Complaint) => {
    const isCurrentlyFrozen = Boolean((complaint as any).welfareFreeze);
    const newFreezeState = !isCurrentlyFrozen;
    setActionLoading(true);

    try {
      const deanName = currentUser?.displayName || "Office of the Dean of Students";
      const complaintRef = doc(db, "complaints", complaint.id);

      const freezePayload = {
        welfareFreeze: newFreezeState,
        welfareFreezeReason: newFreezeState
          ? "Active Dean of Students Welfare & Dispute Investigation"
          : null,
        welfareFrozenAt: newFreezeState ? new Date().toISOString() : null,
        welfareFrozenBy: newFreezeState ? deanName : null,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(complaintRef, freezePayload);

      setComplaints((prev) =>
        prev.map((c) => (c.id === complaint.id ? { ...c, ...freezePayload } : c))
      );

      toast({
        title: newFreezeState ? "Welfare Gateway Frozen" : "Welfare Gateway Unlocked",
        description: newFreezeState
          ? `Payment clearances and manager disbursements locked for ${complaint.hostelName} pending welfare inquiry.`
          : `Welfare freeze lifted for ${complaint.hostelName}. Normal payment clearances restored.`,
      });
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message || "Could not update welfare investigation freeze.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Student Verification
  const handleVerifyStudent = async (verificationId: string, status: "verified" | "rejected", reason?: string) => {
    setActionLoading(true);
    try {
      const deanName = currentUser?.displayName || "Dean of Students";
      const verif = verifications.find((v) => v.id === verificationId) || selectedVerification;
      const res = await updateStudentVerificationStatusAction(
        verificationId,
        status,
        reason,
        deanName,
        verif?.phone,
        verif?.fullName
      );

      if (res.success) {
        // Synchronize Firestore user record so student's badges, login state, and profile update immediately
        if (verif?.userId) {
          try {
            await updateDoc(doc(db, "users", verif.userId), {
              verificationStatus: status,
              verificationReviewedAt: new Date().toISOString(),
              verificationReviewedBy: deanName,
              ...(reason ? { verificationRejectionReason: reason } : {}),
            });
          } catch (fsErr) {
            console.warn("Could not sync verificationStatus to Firestore user:", fsErr);
          }
        }

        setVerifications((prev) =>
          prev.map((v) =>
            v.id === verificationId
              ? {
                  ...v,
                  status,
                  rejectionReason: reason,
                  reviewedAt: new Date().toISOString(),
                  reviewedBy: deanName,
                }
              : v
          )
        );
        toast({
          title: status === "verified" ? "Student Verified" : "Verification Rejected",
          description: `Admission credentials marked as ${status}. Notification SMS dispatched.`,
        });
        setSelectedVerification(null);
        setRejectDialogOpen(false);
        setRejectionReason("");
      } else {
        toast({
          title: "Action Failed",
          description: res.error || "Could not update verification.",
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

  // Filtered Complaints
  const filteredComplaints = complaints.filter((c) => {
    const matchesDirection = directionFilter === "all" || c.direction === directionFilter;
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      c.subject.toLowerCase().includes(q) ||
      c.studentName.toLowerCase().includes(q) ||
      c.hostelName.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q);
    return matchesDirection && matchesStatus && matchesSearch;
  });

  const pendingVerificationsCount = verifications.filter((v) => v.status === "pending").length;
  const submittedComplaintsCount = complaints.filter((c) => c.status === "Submitted").length;
  const underReviewComplaintsCount = complaints.filter((c) => c.status === "Under Review").length;
  const rentCapBreachesCount = hostels.filter((h) =>
    h.roomTypes?.some((r: any) => {
      const ceiling = getStatutoryTariffCeiling(r.name, r.capacity);
      return ceiling && typeof r.price === "number" && r.price > ceiling.maxPrice;
    })
  ).length;

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Authenticating Dean credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        {/* Streamlined Utility Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Dean of Students Housing Console
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Arbitrate student-hostel disputes, verify student admission credentials, and oversee residential welfare.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              disabled={loadingData}
              className="h-8 px-3 text-xs font-medium text-foreground bg-background hover:bg-muted/80 shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingData ? "animate-spin" : ""}`} />
              Refresh Feed
            </Button>
          </div>
        </div>

        {/* Operational Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="border border-border/60 shadow-xs bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>Active Disputes</span>
                <ShieldAlert className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">
                {submittedComplaintsCount + underReviewComplaintsCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {submittedComplaintsCount} awaiting review • {underReviewComplaintsCount} in investigation
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>Verification Queue</span>
                <UserCheck className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{pendingVerificationsCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Awaiting document inspection
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>Resolved Disputes</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-2">
                {complaints.filter((c) => c.status === "Resolved").length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Settled with formal resolution</p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>Accredited Hostels</span>
                <Building className="h-4 w-4 text-slate-500" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{hostels.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Under official university zoning</p>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Tabs */}
        <Tabs defaultValue="complaints" className="space-y-4">
          <div className="border-b border-border/60 pb-px">
            <TabsList className="bg-transparent h-auto p-0 gap-6 border-b-0">
              <TabsTrigger
                value="complaints"
                className="relative py-2 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-semibold text-xs sm:text-sm text-muted-foreground data-[state=active]:text-foreground transition-all flex items-center gap-2"
              >
                <span>Disputes Inbox</span>
                {submittedComplaintsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                    {submittedComplaintsCount}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="verifications"
                className="relative py-2 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-semibold text-xs sm:text-sm text-muted-foreground data-[state=active]:text-foreground transition-all flex items-center gap-2"
              >
                <span>Student Verifications</span>
                {pendingVerificationsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                    {pendingVerificationsCount}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="placements"
                className="relative py-2 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-semibold text-xs sm:text-sm text-muted-foreground data-[state=active]:text-foreground transition-all flex items-center gap-2"
              >
                <span>Placements & Density</span>
              </TabsTrigger>

              <TabsTrigger
                value="rentCaps"
                className="relative py-2 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-semibold text-xs sm:text-sm text-muted-foreground data-[state=active]:text-foreground transition-all flex items-center gap-2"
              >
                <Scale className="h-4 w-4" />
                <span>Rent Cap Compliance</span>
                {rentCapBreachesCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200">
                    {rentCapBreachesCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: TWO-WAY COMPLAINTS INBOX */}
          <TabsContent value="complaints" className="space-y-4 pt-2">
            <Card className="border border-border/60 shadow-xs">
              {/* Filter Bar */}
              <div className="p-3.5 border-b border-border/50 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-card rounded-t-xl">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search student, hostel, or subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8.5 h-8 text-xs bg-background"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Dropdown Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Direction Dropdown */}
                  <Select
                    value={directionFilter}
                    onValueChange={(val) => setDirectionFilter(val as any)}
                  >
                    <SelectTrigger className="h-8 text-xs w-[160px] bg-background">
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Directions</SelectItem>
                      <SelectItem value="student_to_hostel">Student → Hostel</SelectItem>
                      <SelectItem value="manager_to_student">Manager → Student</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Status Dropdown */}
                  <Select
                    value={statusFilter}
                    onValueChange={(val) => setStatusFilter(val as any)}
                  >
                    <SelectTrigger className="h-8 text-xs w-[130px] bg-background">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Submitted">Submitted</SelectItem>
                      <SelectItem value="Under Review">Under Review</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>

                  {(directionFilter !== "all" || statusFilter !== "all" || searchQuery) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDirectionFilter("all");
                        setStatusFilter("all");
                        setSearchQuery("");
                      }}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              <CardContent className="p-0">
                {filteredComplaints.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-foreground">No complaints match your filters</p>
                    <p className="text-xs">Adjust or clear search filters to view recorded records.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/40 border-b border-border/60">
                          <TableRow>
                            <TableHead className="w-36">Status & Gateway</TableHead>
                            <TableHead>Subject & Context</TableHead>
                            <TableHead>Parties Involved</TableHead>
                            <TableHead>Hearing Summons</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredComplaints.map((complaint) => (
                            <TableRow key={complaint.id} className="hover:bg-muted/30 transition-colors">
                              {/* Status & Welfare Gateway Freeze Badge */}
                              <TableCell className="py-3">
                                <div className="flex flex-col gap-1.5 items-start">
                                  {complaint.status === "Submitted" && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                      <Clock className="h-3 w-3" /> Submitted
                                    </span>
                                  )}
                                  {complaint.status === "Under Review" && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                      <AlertTriangle className="h-3 w-3" /> Under Review
                                    </span>
                                  )}
                                  {complaint.status === "Resolved" && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                      <CheckCircle2 className="h-3 w-3" /> Resolved
                                    </span>
                                  )}

                                  {complaint.welfareFreeze && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                                      <Lock className="h-2.5 w-2.5" /> Gateway Frozen
                                    </span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Subject & Category: Category is quiet text */}
                              <TableCell className="py-3 max-w-sm">
                                <p className="font-medium text-foreground text-sm line-clamp-1">
                                  {complaint.subject}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  <span>{complaint.category}</span>
                                  <span>•</span>
                                  <span>{new Date(complaint.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                                </div>
                              </TableCell>

                              {/* Parties Involved: Student & Hostel Name */}
                              <TableCell className="py-3">
                                <p className="font-medium text-foreground text-sm">{complaint.studentName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {complaint.hostelName} {complaint.roomNumber ? `• Rm ${complaint.roomNumber}` : ""}
                                </p>
                                <span className="text-[11px] text-muted-foreground/80 font-mono">
                                  {complaint.direction === "student_to_hostel" ? "Student → Hostel" : "Manager → Student"}
                                </span>
                              </TableCell>

                              {/* Hearing Summons info */}
                              <TableCell className="py-3">
                                {complaint.arbitrationHearing ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                      <Scale className="h-3 w-3" /> {new Date(complaint.arbitrationHearing.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} @ {complaint.arbitrationHearing.time}
                                    </span>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                                      {complaint.arbitrationHearing.venue}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">None scheduled</span>
                                )}
                              </TableCell>

                              {/* Actions */}
                              <TableCell className="py-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedComplaint(complaint);
                                      setResolutionNotes(complaint.resolutionNotes || "");
                                    }}
                                    className="h-8 text-xs font-medium"
                                  >
                                    Investigate
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setComplaintForArbitration(complaint);
                                      setHearingDate(new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0]);
                                      setArbitrationDialogOpen(true);
                                    }}
                                    className="h-8 text-xs font-medium text-primary hover:text-primary"
                                    title="Dispatch formal summons & schedule hearing"
                                  >
                                    <Scale className="h-3.5 w-3.5 mr-1" /> Arbitrate
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant={complaint.welfareFreeze ? "destructive" : "outline"}
                                    onClick={() => handleToggleWelfareFreeze(complaint)}
                                    disabled={actionLoading}
                                    className="h-8 text-xs font-medium"
                                    title={complaint.welfareFreeze ? "Unlock student payment gateway" : "Lock student payment gateway during inquiry"}
                                  >
                                    {complaint.welfareFreeze ? (
                                      <>
                                        <Unlock className="h-3 w-3 mr-1" /> Unlock
                                      </>
                                    ) : (
                                      <>
                                        <Lock className="h-3 w-3 mr-1 text-rose-500" /> Freeze
                                      </>
                                    )}
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
                      {filteredComplaints.map((complaint) => (
                        <div key={complaint.id} className="p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {complaint.status === "Submitted" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  <Clock className="h-3 w-3" /> Submitted
                                </span>
                              )}
                              {complaint.status === "Under Review" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  <AlertTriangle className="h-3 w-3" /> Under Review
                                </span>
                              )}
                              {complaint.status === "Resolved" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="h-3 w-3" /> Resolved
                                </span>
                              )}
                              {complaint.welfareFreeze && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                                  <Lock className="h-2.5 w-2.5" /> Frozen
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(complaint.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          </div>

                          <div>
                            <p className="font-semibold text-foreground text-sm">{complaint.subject}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {complaint.category} • {complaint.direction === "student_to_hostel" ? "Student → Hostel" : "Manager → Student"}
                            </p>
                          </div>

                          {complaint.arbitrationHearing && (
                            <div className="p-2 bg-primary/5 border border-primary/20 rounded-md text-xs space-y-0.5">
                              <p className="font-semibold text-primary flex items-center gap-1">
                                <Scale className="h-3 w-3" /> Hearing: {new Date(complaint.arbitrationHearing.date).toLocaleDateString()} @ {complaint.arbitrationHearing.time}
                              </p>
                              <p className="text-muted-foreground text-[11px]">{complaint.arbitrationHearing.venue}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40 gap-2 flex-wrap">
                            <div>
                              <span className="font-medium text-foreground">{complaint.studentName}</span>
                              <span className="text-muted-foreground"> • {complaint.hostelName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedComplaint(complaint);
                                  setResolutionNotes(complaint.resolutionNotes || "");
                                }}
                                className="h-7 text-xs font-medium px-2"
                              >
                                Investigate
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setComplaintForArbitration(complaint);
                                  setHearingDate(new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0]);
                                  setArbitrationDialogOpen(true);
                                }}
                                className="h-7 text-xs font-medium px-2 text-primary"
                              >
                                <Scale className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={complaint.welfareFreeze ? "destructive" : "outline"}
                                onClick={() => handleToggleWelfareFreeze(complaint)}
                                disabled={actionLoading}
                                className="h-7 text-xs font-medium px-2"
                              >
                                {complaint.welfareFreeze ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3 text-rose-500" />}
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

          {/* TAB 2: STUDENT VERIFICATION QUEUE */}
          <TabsContent value="verifications" className="space-y-4 pt-2">
            <StudentVerificationQueue
              verifications={verifications}
              actionLoading={actionLoading}
              onApprove={(id) => handleVerifyStudent(id, "verified")}
              onRejectClick={(item) => {
                setSelectedVerification(item);
                setRejectDialogOpen(true);
              }}
              onOpenDocument={(url, title, docType) => {
                setDocViewerState({
                  isOpen: true,
                  documentUrl: url,
                  title,
                  documentType: docType,
                });
              }}
            />
          </TabsContent>

          {/* TAB 3: PLACEMENTS OVERVIEW */}
          <TabsContent value="placements" className="space-y-4 pt-2">
            <Card className="border border-border/60 shadow-xs">
              <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-card rounded-t-xl">
                <div>
                  <CardTitle className="text-base font-bold">Hostel Placements & Density</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Bed allocation and residential capacity across accredited accommodations.
                  </CardDescription>
                </div>
              </div>

              <CardContent className="p-0">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 border-b border-border/60">
                      <TableRow>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead>Hostel Name & Location</TableHead>
                        <TableHead>Campus Zone</TableHead>
                        <TableHead>Room Inventory</TableHead>
                        <TableHead className="text-right">Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hostels.map((h) => (
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
                            <div className="text-xs text-muted-foreground">
                              {h.roomTypes && h.roomTypes.length > 0 ? (
                                <span>{h.roomTypes.map((rt: any) => rt.name).join(", ")}</span>
                              ) : (
                                <span>Standard Inventory</span>
                              )}
                            </div>
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
                  {hostels.map((h) => (
                    <div key={h.id} className="p-4 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{h.name}</p>
                          <p className="text-xs text-muted-foreground">{h.location} • {h.institution || "AAMUSTED"}</p>
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
                        <span>{h.roomTypes?.length || 0} room type(s)</span>
                        <span className="font-semibold text-foreground">★ {h.rating ? h.rating.toFixed(1) : "4.5"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: RENT CAP COMPLIANCE */}
          <TabsContent value="rentCaps" className="space-y-4 pt-2">
            <RentCapComplianceSection
              hostels={hostels}
              currentUser={currentUser}
              userRole={userRole}
              onHostelUpdated={() => loadDashboardData()}
            />
          </TabsContent>
        </Tabs>

        {/* MODAL: COMPLAINT DETAIL & RESOLUTION */}
        <ComplaintDetailModal
          isOpen={!!selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          complaint={selectedComplaint}
          resolutionNotes={resolutionNotes}
          onResolutionNotesChange={setResolutionNotes}
          onUpdateStatus={handleUpdateComplaintStatus}
          isUpdating={actionLoading}
          hostels={hostels}
        />

        {/* DIALOG: REJECT STUDENT VERIFICATION */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" /> Reject Verification Credentials
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Specify the reason for rejection so the student may resubmit compliant documents.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Reason for Rejection</label>
              <Textarea
                placeholder="e.g. Admission letter illegible, student ID card expired, name mismatch..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
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
                  if (selectedVerification) {
                    handleVerifyStudent(selectedVerification.id, "rejected", rejectionReason);
                  }
                }}
                disabled={actionLoading || !rejectionReason.trim()}
                className="text-xs font-semibold"
              >
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Universal Document Viewer Modal */}
        <DocumentViewerModal
          isOpen={docViewerState.isOpen}
          onClose={() => setDocViewerState(prev => ({ ...prev, isOpen: false }))}
          documentUrl={docViewerState.documentUrl}
          title={docViewerState.title}
          documentType={docViewerState.documentType}
        />

        {/* DIALOG: OFFICIAL ARBITRATION HEARING SCHEDULER */}
        <Dialog open={arbitrationDialogOpen} onOpenChange={setArbitrationDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" /> Official Arbitration Hearing Scheduler
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Issue a formal dispute summons with automated SMS dispatches to both parties under University Residence Regulations.
              </DialogDescription>
            </DialogHeader>

            {complaintForArbitration && (
              <div className="space-y-4 py-2">
                <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-xs space-y-1">
                  <div className="flex justify-between items-center font-medium">
                    <span className="text-foreground">Case: {complaintForArbitration.subject}</span>
                    <Badge variant="outline" className="text-[10px]">{complaintForArbitration.category}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Complainant: <span className="text-foreground font-medium">{complaintForArbitration.studentName}</span> • Property: <span className="text-foreground font-medium">{complaintForArbitration.hostelName}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-primary" /> Hearing Date
                    </label>
                    <Input
                      type="date"
                      value={hearingDate}
                      onChange={(e) => setHearingDate(e.target.value)}
                      className="text-xs h-9 bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary" /> Hearing Time
                    </label>
                    <Input
                      type="time"
                      value={hearingTime}
                      onChange={(e) => setHearingTime(e.target.value)}
                      className="text-xs h-9 bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Hearing Venue / Chambers</label>
                  <Input
                    value={hearingVenue}
                    onChange={(e) => setHearingVenue(e.target.value)}
                    placeholder="e.g. Dean of Students Hearing Room 102"
                    className="text-xs h-9 bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Arbitration Panel / Presiding Officers</label>
                  <Input
                    value={hearingOfficers}
                    onChange={(e) => setHearingOfficers(e.target.value)}
                    placeholder="e.g. Dean of Students & SRC Welfare Committee"
                    className="text-xs h-9 bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Statutory Summons Notice (SMS Dispatch)</label>
                  <Textarea
                    value={summonsNote}
                    onChange={(e) => setSummonsNote(e.target.value)}
                    placeholder="You are formally summoned to appear before the Dean of Students Welfare Board on [Date] at [Time]..."
                    rows={3}
                    className="text-xs bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Notice will be dispatched via SMS gateway to {complaintForArbitration.studentPhone || "student"} and {complaintForArbitration.managerPhone || "hostel manager"}.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => setArbitrationDialogOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleScheduleArbitration}
                disabled={isSchedulingHearing || !hearingDate}
                className="text-xs font-semibold"
              >
                {isSchedulingHearing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Dispatching Summons...
                  </>
                ) : (
                  <>
                    <Scale className="h-3.5 w-3.5 mr-1.5" /> Issue Summons & Schedule
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
