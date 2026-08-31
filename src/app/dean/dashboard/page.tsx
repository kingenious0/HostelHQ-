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
} from "lucide-react";

// Mock Fallback Complaints if DB is fresh
const INITIAL_MOCK_COMPLAINTS: Complaint[] = [
  {
    id: "comp_101",
    direction: "student_to_hostel",
    status: "Submitted",
    category: "Sanitation & Water",
    subject: "Continuous Water Shortage in Block B",
    description: "Water has not flowed on the 2nd floor for 4 days. Students have to carry buckets from the ground floor pump before attending 8 AM lectures.",
    studentId: "stu_kofi_01",
    studentName: "Kofi Mensah",
    studentEmail: "k.mensah@st.aamusted.edu.gh",
    studentPhone: "+233 24 555 0192",
    hostelId: "hostel_doku_01",
    hostelName: "Doku Kaakyire Hostel",
    managerId: "mgr_kwame_99",
    managerName: "Kwame Boateng",
    managerPhone: "+233 50 123 4567",
    roomId: "room_b204",
    roomNumber: "B-204",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "comp_102",
    direction: "manager_to_student",
    status: "Under Review",
    category: "Conduct & Policy",
    subject: "Repeated Noise Disturbance After Curfew",
    description: "Occupant in Room A-102 continues playing high-volume sound systems past the university housing 10:00 PM quiet hours despite two written warnings.",
    studentId: "stu_ama_02",
    studentName: "Ama Serwaa",
    studentEmail: "a.serwaa@st.aamusted.edu.gh",
    studentPhone: "+233 20 888 4411",
    hostelId: "hostel_doku_01",
    hostelName: "Doku Kaakyire Hostel",
    managerId: "mgr_kwame_99",
    managerName: "Kwame Boateng",
    managerPhone: "+233 50 123 4567",
    roomId: "room_a102",
    roomNumber: "A-102",
    createdAt: new Date(Date.now() - 3600000 * 26).toISOString(),
  },
  {
    id: "comp_103",
    direction: "student_to_hostel",
    status: "Resolved",
    category: "Pricing & Overcharging",
    subject: "Unauthorized Electricity Utility Surcharge",
    description: "Management requested an additional GH₵ 250 fee per student for meter recharge, which violates the approved all-inclusive tenancy agreement.",
    studentId: "stu_emmanuel_03",
    studentName: "Emmanuel Osei",
    studentEmail: "e.osei@st.aamusted.edu.gh",
    studentPhone: "+233 27 999 3322",
    hostelId: "hostel_frontline_02",
    hostelName: "Frontline Executive Lodge",
    managerId: "mgr_akwasi_88",
    managerName: "Akwasi Owusu",
    managerPhone: "+233 54 888 1122",
    roomId: "room_c12",
    roomNumber: "C-12",
    resolutionNotes: "Dean of Students intervened. Management acknowledged the clause and refunded the collected utility surcharges back to affected students.",
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    resolvedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    resolvedBy: "Prof. S. Donkor (Dean of Students)",
  },
];

// Mock Fallback Student Verifications if DB is fresh
const INITIAL_MOCK_VERIFICATIONS: StudentVerification[] = [
  {
    id: "verif_201",
    userId: "user_stu_301",
    fullName: "Akosua Frimpong",
    email: "a.frimpong@st.aamusted.edu.gh",
    phone: "+233 24 112 3344",
    studentIdNumber: "AAM/2024/7741",
    institution: "AAMUSTED - Kumasi Campus",
    admissionLetterUrl: "https://images.unsplash.com/photo-1584697964190-71c45f479a37?w=800&auto=format&fit=crop&q=80",
    studentIdCardUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80",
    status: "pending",
    submittedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: "verif_202",
    userId: "user_stu_302",
    fullName: "David Nana Kwame",
    email: "d.kwame@st.aamusted.edu.gh",
    phone: "+233 55 443 2211",
    studentIdNumber: "AAM/2023/1189",
    institution: "AAMUSTED - Kumasi Campus",
    admissionLetterUrl: "https://images.unsplash.com/photo-1584697964190-71c45f479a37?w=800&auto=format&fit=crop&q=80",
    studentIdCardUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80",
    status: "pending",
    submittedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
];

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

  // Student Verifications State
  const [verifications, setVerifications] = useState<StudentVerification[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<StudentVerification | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  // Placements State
  const [hostels, setHostels] = useState<any[]>([]);
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

      if (compRes.success && compRes.data && compRes.data.length > 0) {
        setComplaints(compRes.data);
      } else {
        setComplaints(INITIAL_MOCK_COMPLAINTS);
      }

      if (verifRes.success && verifRes.data && verifRes.data.length > 0) {
        setVerifications(verifRes.data);
      } else {
        setVerifications(INITIAL_MOCK_VERIFICATIONS);
      }

      if (hostelRes.success && hostelRes.data) {
        setHostels(hostelRes.data);
      }
    } catch (err) {
      console.error("Failed to load dean data:", err);
      setComplaints(INITIAL_MOCK_COMPLAINTS);
      setVerifications(INITIAL_MOCK_VERIFICATIONS);
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

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Authenticating Dean credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Executive Banner */}
        <div className="mb-8 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-5 sm:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-blue-200 border border-white/20">
              <Shield className="h-3.5 w-3.5" />
              Student Affairs • Welfare & Housing
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Dean of Students Housing Console
            </h1>
            <p className="text-sm text-blue-100/80 max-w-2xl">
              Arbitrate student-hostel disputes, verify student admission credentials, and oversee residential welfare.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              disabled={loadingData}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? "animate-spin" : ""}`} />
              Refresh Feed
            </Button>
          </div>
        </div>

        {/* Operational Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Active Disputes
              </CardTitle>
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-black text-foreground">
                {submittedComplaintsCount + underReviewComplaintsCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {submittedComplaintsCount} awaiting review • {underReviewComplaintsCount} in investigation
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Verification Queue
              </CardTitle>
              <UserCheck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-black text-foreground">{pendingVerificationsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Pending admission letter & ID inspections
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Resolved Disputes
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">
                {complaints.filter((c) => c.status === "Resolved").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Settled with formal dean intervention</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Accredited Hostels
              </CardTitle>
              <Building className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-black text-foreground">{hostels.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Under official university zoning</p>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Tabs */}
        <Tabs defaultValue="complaints" className="space-y-6">
          <div className="overflow-x-auto pb-1">
            <TabsList className="bg-slate-200/80 p-1 rounded-xl flex whitespace-nowrap min-w-max">
              <TabsTrigger value="complaints" className="rounded-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Two-Way Complaints Inbox
                {submittedComplaintsCount > 0 && (
                  <Badge variant="destructive" className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full">
                    {submittedComplaintsCount}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="verifications" className="rounded-lg font-semibold flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Student Verification Queue
                {pendingVerificationsCount > 0 && (
                  <Badge className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-blue-600">
                    {pendingVerificationsCount}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="placements" className="rounded-lg font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Placements & Density
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: TWO-WAY COMPLAINTS INBOX */}
          <TabsContent value="complaints" className="space-y-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold">Dispute Resolution Inbox</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Full-context disputes auto-linked with verified tenancy agreements and resident records.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Search Input */}
                    <div className="relative flex-1 sm:w-64 min-w-[200px]">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search student, hostel, issue..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-xs"
                      />
                    </div>

                    {/* Direction Filter */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-border/40 text-xs overflow-x-auto">
                      <Button
                        size="sm"
                        variant={directionFilter === "all" ? "default" : "ghost"}
                        onClick={() => setDirectionFilter("all")}
                        className="h-7 text-xs px-2.5 shrink-0"
                      >
                        All
                      </Button>
                      <Button
                        size="sm"
                        variant={directionFilter === "student_to_hostel" ? "default" : "ghost"}
                        onClick={() => setDirectionFilter("student_to_hostel")}
                        className="h-7 text-xs px-2.5 shrink-0"
                      >
                        Student → Hostel
                      </Button>
                      <Button
                        size="sm"
                        variant={directionFilter === "manager_to_student" ? "default" : "ghost"}
                        onClick={() => setDirectionFilter("manager_to_student")}
                        className="h-7 text-xs px-2.5 shrink-0"
                      >
                        Manager → Student
                      </Button>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-border/40 text-xs overflow-x-auto">
                      <Button
                        size="sm"
                        variant={statusFilter === "all" ? "default" : "ghost"}
                        onClick={() => setStatusFilter("all")}
                        className="h-7 text-xs px-2.5 shrink-0"
                      >
                        All
                      </Button>
                      <Button
                        size="sm"
                        variant={statusFilter === "Submitted" ? "default" : "ghost"}
                        onClick={() => setStatusFilter("Submitted")}
                        className="h-7 text-xs px-2.5 shrink-0"
                      >
                        Submitted
                      </Button>
                      <Button
                        size="sm"
                        variant={statusFilter === "Under Review" ? "default" : "ghost"}
                        onClick={() => setStatusFilter("Under Review")}
                        className="h-7 text-xs px-2.5 shrink-0"
                      >
                        Reviewing
                      </Button>
                      <Button
                        size="sm"
                        variant={statusFilter === "Resolved" ? "default" : "ghost"}
                        onClick={() => setStatusFilter("Resolved")}
                        className="h-7 text-xs px-2.5 shrink-0"
                      >
                        Resolved
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {filteredComplaints.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-foreground">No active complaints found</p>
                    <p className="text-xs">There are no reports matching the selected filters.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-100/60">
                          <TableRow>
                            <TableHead className="w-28">Direction</TableHead>
                            <TableHead>Subject & Category</TableHead>
                            <TableHead>Student Context</TableHead>
                            <TableHead>Hostel / Manager</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredComplaints.map((complaint) => (
                            <TableRow key={complaint.id} className="hover:bg-slate-50/80 transition-colors">
                              <TableCell>
                                {complaint.direction === "student_to_hostel" ? (
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-semibold flex items-center gap-1 w-fit">
                                    <GraduationCap className="h-3 w-3" />
                                    Stu → Hostel
                                  </Badge>
                                ) : (
                                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] font-semibold flex items-center gap-1 w-fit">
                                    <Building className="h-3 w-3" />
                                    Mgr → Student
                                  </Badge>
                                )}
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  {new Date(complaint.createdAt).toLocaleDateString()}
                                </div>
                              </TableCell>

                              <TableCell className="max-w-xs">
                                <p className="font-semibold text-foreground text-sm line-clamp-1">
                                  {complaint.subject}
                                </p>
                                <Badge variant="outline" className="text-[10px] font-normal mt-0.5">
                                  {complaint.category}
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {complaint.description}
                                </p>
                              </TableCell>

                              <TableCell>
                                <p className="font-semibold text-foreground text-xs">{complaint.studentName}</p>
                                <p className="text-[11px] text-muted-foreground">{complaint.studentEmail}</p>
                                <p className="text-[11px] text-muted-foreground font-mono">{complaint.studentPhone}</p>
                              </TableCell>

                              <TableCell>
                                <p className="font-semibold text-foreground text-xs">{complaint.hostelName}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  Room: <span className="font-medium text-foreground">{complaint.roomNumber || "N/A"}</span>
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Mgr: {complaint.managerName || "Assigned"} ({complaint.managerPhone || "On file"})
                                </p>
                              </TableCell>

                              <TableCell>
                                {complaint.status === "Submitted" && (
                                  <Badge variant="destructive" className="text-[11px] flex items-center gap-1 w-fit">
                                    <Clock className="h-3 w-3" /> Submitted
                                  </Badge>
                                )}
                                {complaint.status === "Under Review" && (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] flex items-center gap-1 w-fit">
                                    <AlertTriangle className="h-3 w-3" /> Under Review
                                  </Badge>
                                )}
                                {complaint.status === "Resolved" && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] flex items-center gap-1 w-fit">
                                    <CheckCircle2 className="h-3 w-3" /> Resolved
                                  </Badge>
                                )}
                              </TableCell>

                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedComplaint(complaint);
                                    setResolutionNotes(complaint.resolutionNotes || "");
                                  }}
                                  className="h-8 text-xs font-semibold"
                                >
                                  Investigate
                                </Button>
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
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {complaint.direction === "student_to_hostel" ? (
                                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold flex items-center gap-1">
                                  <GraduationCap className="h-3 w-3" /> Stu → Hostel
                                </Badge>
                              ) : (
                                <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-semibold flex items-center gap-1">
                                  <Building className="h-3 w-3" /> Mgr → Student
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {complaint.category}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(complaint.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div>
                            <p className="font-bold text-foreground text-sm">{complaint.subject}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{complaint.description}</p>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Student:</span>
                              <span className="font-medium text-foreground">{complaint.studentName} ({complaint.studentPhone || "No phone"})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Hostel:</span>
                              <span className="font-medium text-foreground">{complaint.hostelName} (Room {complaint.roomNumber || "N/A"})</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div>
                              {complaint.status === "Submitted" && (
                                <Badge variant="destructive" className="text-[11px] flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Submitted
                                </Badge>
                              )}
                              {complaint.status === "Under Review" && (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Under Review
                                </Badge>
                              )}
                              {complaint.status === "Resolved" && (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Resolved
                                </Badge>
                              )}
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedComplaint(complaint);
                                setResolutionNotes(complaint.resolutionNotes || "");
                              }}
                              className="h-8 text-xs font-semibold"
                            >
                              Investigate
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

          {/* TAB 2: STUDENT VERIFICATION QUEUE */}
          <TabsContent value="verifications" className="space-y-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Institutional Credential Verification</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Manual inspection of admission letters and student ID cards to grant protected resident access.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {verifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                    <UserCheck className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-foreground">Zero pending verifications</p>
                    <p className="text-xs">All uploaded student admission documents have been processed.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-100/60">
                          <TableRow>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Institution & ID Number</TableHead>
                            <TableHead>Admission Letter</TableHead>
                            <TableHead>Student ID Card</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {verifications.map((item) => (
                            <TableRow key={item.id} className="hover:bg-slate-50/80 transition-colors">
                              <TableCell>
                                <p className="font-semibold text-foreground text-sm">{item.fullName}</p>
                                <p className="text-xs text-muted-foreground">{item.email}</p>
                                <p className="text-xs text-muted-foreground font-mono">{item.phone}</p>
                              </TableCell>

                              <TableCell>
                                <p className="font-semibold text-foreground text-xs">
                                  {item.institution || "AAMUSTED"}
                                </p>
                                <Badge variant="outline" className="font-mono text-[11px] mt-0.5">
                                  {item.studentIdNumber}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                {item.admissionLetterUrl ? (
                                  <a
                                    href={item.admissionLetterUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                                  >
                                    <Eye className="h-3.5 w-3.5" /> View Letter
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not provided</span>
                                )}
                              </TableCell>

                              <TableCell>
                                {item.studentIdCardUrl ? (
                                  <a
                                    href={item.studentIdCardUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                                  >
                                    <Eye className="h-3.5 w-3.5" /> View ID Card
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not provided</span>
                                )}
                              </TableCell>

                              <TableCell>
                                {item.status === "pending" && (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px]">
                                    Pending Review
                                  </Badge>
                                )}
                                {item.status === "verified" && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px]">
                                    Verified
                                  </Badge>
                                )}
                                {item.status === "rejected" && (
                                  <Badge variant="destructive" className="text-[11px]">
                                    Rejected
                                  </Badge>
                                )}
                              </TableCell>

                              <TableCell className="text-right">
                                {item.status === "pending" ? (
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleVerifyStudent(item.id, "verified")}
                                      disabled={actionLoading}
                                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedVerification(item);
                                        setRejectDialogOpen(true);
                                      }}
                                      disabled={actionLoading}
                                      className="h-8 text-xs text-destructive hover:bg-destructive/10"
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {item.reviewedAt ? `Reviewed ${new Date(item.reviewedAt).toLocaleDateString()}` : "Completed"}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Stacked Card View */}
                    <div className="block md:hidden divide-y divide-border/60">
                      {verifications.map((item) => (
                        <div key={item.id} className="p-4 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-bold text-foreground text-sm">{item.fullName}</p>
                              <p className="text-xs text-muted-foreground">{item.email} • {item.phone}</p>
                            </div>
                            <Badge variant="outline" className="font-mono text-[11px]">
                              {item.studentIdNumber}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-4 text-xs">
                            {item.admissionLetterUrl ? (
                              <a
                                href={item.admissionLetterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary font-semibold hover:underline"
                              >
                                <Eye className="h-3.5 w-3.5" /> View Letter
                              </a>
                            ) : (
                              <span className="text-muted-foreground">No Letter</span>
                            )}
                            {item.studentIdCardUrl ? (
                              <a
                                href={item.studentIdCardUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary font-semibold hover:underline"
                              >
                                <Eye className="h-3.5 w-3.5" /> View ID Card
                              </a>
                            ) : (
                              <span className="text-muted-foreground">No ID Card</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div>
                              {item.status === "pending" && (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px]">
                                  Pending Review
                                </Badge>
                              )}
                              {item.status === "verified" && (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px]">
                                  Verified
                                </Badge>
                              )}
                              {item.status === "rejected" && (
                                <Badge variant="destructive" className="text-[11px]">
                                  Rejected
                                </Badge>
                              )}
                            </div>

                            {item.status === "pending" ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleVerifyStudent(item.id, "verified")}
                                  disabled={actionLoading}
                                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedVerification(item);
                                    setRejectDialogOpen(true);
                                  }}
                                  disabled={actionLoading}
                                  className="h-8 text-xs text-destructive hover:bg-destructive/10"
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {item.reviewedAt ? `Reviewed ${new Date(item.reviewedAt).toLocaleDateString()}` : "Completed"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: PLACEMENTS OVERVIEW */}
          <TabsContent value="placements" className="space-y-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Hostel Placements & Occupancy Density</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Real-time bed allocation and resident distribution across registered accommodations.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-100/60">
                      <TableRow>
                        <TableHead>Hostel Name</TableHead>
                        <TableHead>Campus Zone</TableHead>
                        <TableHead>Room Types</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hostels.map((h) => (
                        <TableRow key={h.id} className="hover:bg-slate-50/80 transition-colors">
                          <TableCell>
                            <p className="font-semibold text-foreground text-sm">{h.name}</p>
                            <p className="text-xs text-muted-foreground">{h.location}</p>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs font-medium text-foreground">{h.institution || "AAMUSTED"}</span>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {h.roomTypes && h.roomTypes.length > 0 ? (
                                h.roomTypes.map((rt: any, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-[10px]">
                                    {rt.name} (GH₵{rt.price?.toLocaleString()})
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">Standard Inventory</span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              className={`text-[10px] ${
                                h.availability === "Available"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : h.availability === "Limited"
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : "bg-rose-100 text-rose-800 border-rose-300"
                              }`}
                            >
                              {h.availability || "Available"}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                              ★ {h.rating ? h.rating.toFixed(1) : "4.5"}
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
                          <p className="font-bold text-foreground text-sm">{h.name}</p>
                          <p className="text-xs text-muted-foreground">{h.location} • {h.institution || "AAMUSTED"}</p>
                        </div>
                        <Badge
                          className={`text-[10px] ${
                            h.availability === "Available"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : h.availability === "Limited"
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-rose-100 text-rose-800 border-rose-300"
                          }`}
                        >
                          {h.availability || "Available"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex flex-wrap gap-1">
                          {h.roomTypes && h.roomTypes.length > 0 ? (
                            h.roomTypes.map((rt: any, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-[10px]">
                                {rt.name} (GH₵{rt.price?.toLocaleString()})
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Standard Inventory</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs font-bold text-foreground shrink-0">
                          ★ {h.rating ? h.rating.toFixed(1) : "4.5"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIALOG: COMPLAINT DETAIL & STATUS UPDATE */}
        <Dialog open={!!selectedComplaint} onOpenChange={(open) => !open && setSelectedComplaint(null)}>
          <DialogContent className="max-w-2xl">
            {selectedComplaint && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {selectedComplaint.category}
                    </Badge>
                    <Badge
                      className={
                        selectedComplaint.status === "Resolved"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : selectedComplaint.status === "Under Review"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-rose-100 text-rose-800 border-rose-300"
                      }
                    >
                      {selectedComplaint.status}
                    </Badge>
                  </div>
                  <DialogTitle className="text-xl font-bold">{selectedComplaint.subject}</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Lodged on {new Date(selectedComplaint.createdAt).toLocaleString()} • Ref: #{selectedComplaint.id}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Context Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-border/60">
                    <div>
                      <p className="text-muted-foreground uppercase font-bold text-[10px]">Student Record</p>
                      <p className="font-semibold text-foreground text-sm mt-0.5">{selectedComplaint.studentName}</p>
                      <p className="text-muted-foreground">{selectedComplaint.studentEmail}</p>
                      <p className="font-mono text-muted-foreground">{selectedComplaint.studentPhone}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground uppercase font-bold text-[10px]">Hostel & Manager Context</p>
                      <p className="font-semibold text-foreground text-sm mt-0.5">{selectedComplaint.hostelName}</p>
                      <p className="text-muted-foreground">
                        Room Number: <span className="font-medium text-foreground">{selectedComplaint.roomNumber || "N/A"}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Manager: {selectedComplaint.managerName || "On file"} ({selectedComplaint.managerPhone || "N/A"})
                      </p>
                    </div>
                  </div>

                  {/* Complaint Description */}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Detailed Narrative of Grievance
                    </p>
                    <div className="bg-white p-3 rounded-lg border border-border/60 text-sm text-foreground leading-relaxed">
                      {selectedComplaint.description}
                    </div>
                  </div>

                  {/* Resolution Notes Input */}
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                      Dean Directorate Resolution Findings & Directives
                    </label>
                    <Textarea
                      placeholder="Document arbitrated settlement, agreed timelines, or warnings issued..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      rows={3}
                      className="text-xs"
                    />
                  </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                  {selectedComplaint.status === "Submitted" && (
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateComplaintStatus(selectedComplaint.id, "Under Review", resolutionNotes)}
                      disabled={actionLoading}
                      className="border-amber-500 text-amber-700 hover:bg-amber-50 text-xs font-semibold"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Move to Under Review
                    </Button>
                  )}

                  {selectedComplaint.status !== "Resolved" && (
                    <Button
                      onClick={() => handleUpdateComplaintStatus(selectedComplaint.id, "Resolved", resolutionNotes)}
                      disabled={actionLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Dispute Resolved
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    onClick={() => setSelectedComplaint(null)}
                    className="text-xs"
                  >
                    Close
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

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
      </main>
    </div>
  );
}
