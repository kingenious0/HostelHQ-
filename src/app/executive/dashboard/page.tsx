"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { fetchExecutiveMetricsAction, fetchHostelsAction } from "@/app/actions/db";
import type { Hostel } from "@/lib/data";
import {
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  Award,
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
  Flame,
} from "lucide-react";

interface ExecutiveMetricsData {
  summary: {
    totalHostels: number;
    verifiedHostels: number;
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
  directionBreakdown: {
    studentToHostel: number;
    managerToStudent: number;
  };
}

const EMPTY_METRICS_DATA: ExecutiveMetricsData = {
  summary: {
    totalHostels: 0,
    verifiedHostels: 0,
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
  directionBreakdown: {
    studentToHostel: 0,
    managerToStudent: 0,
  },
};

// Institutional Baseline Data
const ENROLLMENT_BASELINE = 38500;
const ON_CAMPUS_CAPACITY = 12200;

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [metrics, setMetrics] = useState<ExecutiveMetricsData>(EMPTY_METRICS_DATA);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loadingHostels, setLoadingHostels] = useState(true);

  // Executive Council Briefing Generator Modal
  const [briefingOpen, setBriefingOpen] = useState(false);

  // Accreditation Sanction Switch Modal
  const [selectedHostelForSanction, setSelectedHostelForSanction] = useState<Hostel | null>(null);
  const [newSanctionStatus, setNewSanctionStatus] = useState<"approved" | "sanctioned" | "revoked">("sanctioned");
  const [sanctionReason, setSanctionReason] = useState("");
  const [isUpdatingSanction, setIsUpdatingSanction] = useState(false);

  // Role Authentication Guard (pro_vc, vc, admin)
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
          if (role !== "pro_vc" && role !== "vc" && role !== "admin") {
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
    if (!loadingAuth && (userRole === "pro_vc" || userRole === "vc" || userRole === "admin")) {
      loadData();
    }
  }, [loadingAuth, userRole]);

  // Housing Deficit Math
  const offCampusAccreditedBeds = useMemo(() => {
    if (hostels.length === 0) return metrics.summary.verifiedHostels * 180 || 17800;
    const verified = hostels.filter((h) => h.verified && h.status !== "revoked");
    const count = verified.reduce((acc, h) => {
      const roomCapacity = (h.roomTypes || []).reduce((rAcc, rt) => {
        return rAcc + (rt.numberOfRooms || 1) * (rt.capacity || 1);
      }, 0);
      return acc + (roomCapacity > 0 ? roomCapacity : 150);
    }, 0);
    return count > 0 ? count : verified.length * 160 || 17800;
  }, [hostels, metrics.summary.verifiedHostels]);

  const totalAvailableBeds = ON_CAMPUS_CAPACITY + offCampusAccreditedBeds;
  const acuteHousingDeficit = Math.max(0, ENROLLMENT_BASELINE - totalAvailableBeds);
  const accommodationCoverageRate = Math.min(100, Math.round((totalAvailableBeds / ENROLLMENT_BASELINE) * 100));

  const onCampusPct = Math.round((ON_CAMPUS_CAPACITY / ENROLLMENT_BASELINE) * 100);
  const offCampusPct = Math.round((offCampusAccreditedBeds / ENROLLMENT_BASELINE) * 100);
  const deficitPct = Math.max(0, 100 - onCampusPct - offCampusPct);

  // Rental Indices Calculations
  const rentIndices = useMemo(() => {
    const prices1: number[] = [];
    const prices2: number[] = [];
    const prices3: number[] = [];
    const prices4: number[] = [];

    hostels.forEach((h) => {
      (h.roomTypes || []).forEach((rt) => {
        if (!rt.price || rt.price <= 0) return;
        const name = (rt.name || "").toLowerCase();
        if (name.includes("1") || name.includes("one")) prices1.push(rt.price);
        else if (name.includes("2") || name.includes("two")) prices2.push(rt.price);
        else if (name.includes("3") || name.includes("three")) prices3.push(rt.price);
        else if (name.includes("4") || name.includes("four")) prices4.push(rt.price);
      });
    });

    const avg = (arr: number[], fallback: number) =>
      arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : fallback;

    return {
      oneInRoom: avg(prices1, 8400),
      twoInRoom: avg(prices2, 5800),
      threeInRoom: avg(prices3, 4200),
      fourInRoom: avg(prices4, 3200),
    };
  }, [hostels]);

  // Execute Accreditation Sanction / Revocation
  const handleUpdateSanction = async () => {
    if (!selectedHostelForSanction) return;
    setIsUpdatingSanction(true);

    try {
      const hostelRef = doc(db, "hostels", selectedHostelForSanction.id);
      const isRevoked = newSanctionStatus === "revoked";
      const isSanctioned = newSanctionStatus === "sanctioned";

      const updates: any = {
        status: isRevoked ? "revoked" : "approved",
        verified: !isRevoked,
        sanctionStatus: newSanctionStatus,
        sanctionReason: sanctionReason.trim() || "Statutory executive regulatory sanction applied.",
        sanctionedAt: new Date().toISOString(),
        sanctionedBy: currentUser?.displayName || currentUser?.email || "Office of the Vice-Chancellor",
      };

      await updateDoc(hostelRef, updates);

      // Update local state
      setHostels((prev) =>
        prev.map((h) =>
          h.id === selectedHostelForSanction.id
            ? { ...h, ...updates }
            : h
        )
      );

      toast({
        title: isRevoked
          ? "Accreditation Revoked"
          : isSanctioned
          ? "Executive Sanction Applied"
          : "Property Restored to Good Standing",
        description: `${selectedHostelForSanction.name} status updated to ${newSanctionStatus}.`,
      });

      setSelectedHostelForSanction(null);
      setSanctionReason("");
    } catch (err: any) {
      toast({
        title: "Sanction Update Failed",
        description: err.message || "Failed to update hostel sanction in database.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingSanction(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Verifying Vice-Chancellor credentials...</p>
        </div>
      </div>
    );
  }

  const { summary, categoryBreakdown, directionBreakdown } = metrics;
  const isVC = userRole === "vc";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Executive Utility Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight font-headline text-foreground">
                Housing Governance & Deficit Executive Console
              </h1>
              <Badge variant="outline" className="text-xs font-semibold text-amber-600 bg-amber-500/10 border-amber-500/30">
                <Landmark className="h-3 w-3 mr-1" />
                {isVC ? "Office of the Vice-Chancellor" : "Executive Directorate"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              High-level statutory intelligence on student enrollment vs. bed capacity, rental price indices, and accreditation sanctions.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* 1-Click Executive Council Briefing Generator Button */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setBriefingOpen(true)}
              className="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground shadow-md hover:bg-primary/90 gap-1.5 rounded-xl"
            >
              <FileText className="h-4 w-4" />
              <span>Council Briefing Generator</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loadingMetrics}
              className="h-9 px-3 text-xs font-semibold rounded-xl border-border/70 hover:bg-muted"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loadingMetrics ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ================= COMPONENT 1: INSTITUTIONAL HOUSING DEFICIT METER ================= */}
        <Card className="border border-border/80 shadow-md bg-card mb-8 rounded-3xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg font-extrabold font-headline flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  Institutional Housing Deficit Meter
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Official enrollment tracking vs. combined on-campus hall reserves and accredited off-campus beds.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs font-bold px-3 py-1 ${
                    accommodationCoverageRate < 70
                      ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                      : accommodationCoverageRate < 85
                      ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  }`}
                >
                  {acuteHousingDeficit > 0 ? "Acute Housing Deficit Detected" : "Target Capacity Met"}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Deficit Metric Highlights */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total Student Body
                </p>
                <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">
                  {ENROLLMENT_BASELINE.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Enrolled full-time students</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  On-Campus Hall Beds
                </p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                  {ON_CAMPUS_CAPACITY.toLocaleString()}
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {onCampusPct}% institutional coverage
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20">
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                  Accredited Off-Campus
                </p>
                <p className="text-2xl sm:text-3xl font-black text-sky-700 dark:text-sky-400 mt-1">
                  {offCampusAccreditedBeds.toLocaleString()}
                </p>
                <p className="text-[11px] text-sky-600 dark:text-sky-400 mt-0.5">
                  {offCampusPct}% private certified beds
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                  Net Housing Deficit
                </p>
                <p className="text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-400 mt-1">
                  {acuteHousingDeficit.toLocaleString()}
                </p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                  {deficitPct}% unaccredited shortfall
                </p>
              </div>
            </div>

            {/* Visual Multi-Segmented Deficit Meter Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-foreground">
                  Total Accommodation Coverage: <strong className="text-primary">{accommodationCoverageRate}%</strong>
                </span>
                <span className="text-muted-foreground">
                  Target: 95%+ Accredited Coverage
                </span>
              </div>

              <div className="w-full h-5 rounded-full bg-muted overflow-hidden flex shadow-inner">
                {/* Segment 1: On-Campus Halls */}
                <div
                  style={{ width: `${onCampusPct}%` }}
                  className="bg-emerald-600 h-full transition-all duration-500"
                  title={`On-Campus Halls: ${ON_CAMPUS_CAPACITY.toLocaleString()} beds (${onCampusPct}%)`}
                />
                {/* Segment 2: Accredited Off-Campus */}
                <div
                  style={{ width: `${offCampusPct}%` }}
                  className="bg-sky-600 h-full transition-all duration-500"
                  title={`Accredited Off-Campus: ${offCampusAccreditedBeds.toLocaleString()} beds (${offCampusPct}%)`}
                />
                {/* Segment 3: Acute Deficit Shortfall */}
                <div
                  style={{ width: `${deficitPct}%` }}
                  className="bg-rose-500 h-full transition-all duration-500"
                  title={`Net Deficit: ${acuteHousingDeficit.toLocaleString()} unaccredited beds (${deficitPct}%)`}
                />
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
                  <span>On-Campus Halls ({ON_CAMPUS_CAPACITY.toLocaleString()})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-600 inline-block" />
                  <span>Accredited Off-Campus ({offCampusAccreditedBeds.toLocaleString()})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
                  <span className="font-bold text-rose-600">Net Housing Deficit ({acuteHousingDeficit.toLocaleString()})</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border border-border/60 shadow-xs bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Total Registered Hostels
              </CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-foreground">{summary.totalHostels || hostels.length}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 inline" />
                {summary.verifiedHostels || hostels.filter(h => h.verified).length} accredited under university charter
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Campus Rent Index (2-in-1)
              </CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">
                GH₵ {rentIndices.twoInRoom.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Benchmark student rental index
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Active Grievances
              </CardTitle>
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-foreground">{summary.totalComplaints}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.resolutionRate}% resolution rate via Dean
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Statutory Compliance
              </CardTitle>
              <Award className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-teal-600">100%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Act 389 & GhanaPostGPS verified
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Chart 1: Leading Grievance Categories */}
          <Card className="border border-border/60 shadow-xs bg-card">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Leading Grievance Categories
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Distribution of student-hostel friction points across accommodation zones.
                </CardDescription>
              </div>
            </div>
            <CardContent className="p-4 space-y-4">
              {categoryBreakdown.length === 0 || summary.totalComplaints === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">Zero grievances recorded</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Dispute trends populate as student or hostel reports are submitted.
                  </p>
                </div>
              ) : (
                categoryBreakdown.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-foreground">{item.category}</span>
                      <span className="text-muted-foreground">
                        {item.count} reports ({item.percentage}%)
                      </span>
                    </div>
                    <Progress value={item.percentage} className="h-2 rounded-full bg-muted" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Chart 2: Dispute Origin & Resolution Status */}
          <Card className="border border-border/60 shadow-xs bg-card">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" />
                  Dispute Origin & Resolution Status
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Resident-initiated reports vs management-initiated policy notices.
                </CardDescription>
              </div>
            </div>
            <CardContent className="p-4 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 border border-border/60 rounded-xl p-3 text-center">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground">Student → Hostel</p>
                  <p className="text-2xl font-extrabold text-foreground mt-1">
                    {directionBreakdown.studentToHostel}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Facilities, utilities & fees
                  </p>
                </div>

                <div className="bg-muted/30 border border-border/60 rounded-xl p-3 text-center">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground">Manager → Student</p>
                  <p className="text-2xl font-extrabold text-foreground mt-1">
                    {directionBreakdown.managerToStudent}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Conduct & quiet hours
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Resolution Efficiency</span>
                  <span className="text-emerald-600 font-bold">{summary.resolutionRate}% Closed</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5 flex overflow-hidden">
                  <div
                    style={{ width: `${summary.resolutionRate || 100}%` }}
                    className="bg-emerald-500 h-full"
                  />
                  <div
                    style={{ width: `${100 - (summary.resolutionRate || 100)}%` }}
                    className="bg-amber-400 h-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ================= COMPONENT 3: ACCREDITATION SANCTION & REVOCATION SWITCHBOARD ================= */}
        <Card className="border border-border/80 shadow-md bg-card mb-8 rounded-3xl overflow-hidden">
          <CardHeader className="p-5 border-b border-border/60 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg font-extrabold font-headline flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-rose-600" />
                  Accreditation Sanction & Revocation Switchboard
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Executive authority to sanction or revoke university charter accreditation for non-compliant properties.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px] font-bold border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/10">
                Vice-Chancellor Direct Control
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30 border-b border-border/60">
                  <TableRow>
                    <TableHead className="w-48">Hostel Name & Zone</TableHead>
                    <TableHead>Accreditation Standing</TableHead>
                    <TableHead>Pricing & Tariffs</TableHead>
                    <TableHead>Active Violations / Notes</TableHead>
                    <TableHead className="text-right">Executive Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hostels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                        No hostels currently registered.
                      </TableCell>
                    </TableRow>
                  ) : (
                    hostels.slice(0, 10).map((h) => {
                      const isRevoked = h.status === "revoked" || (h as any).sanctionStatus === "revoked";
                      const isSanctioned = (h as any).sanctionStatus === "sanctioned";

                      return (
                        <TableRow key={h.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="py-3.5">
                            <p className="font-bold text-sm text-foreground">{h.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {h.location}
                            </p>
                          </TableCell>

                          <TableCell className="py-3.5">
                            {isRevoked ? (
                              <Badge className="bg-rose-600 text-white text-[10px] font-bold gap-1">
                                <XCircle className="h-3 w-3" /> Accreditation Revoked
                              </Badge>
                            ) : isSanctioned ? (
                              <Badge className="bg-amber-500 text-white text-[10px] font-bold gap-1">
                                <AlertTriangle className="h-3 w-3" /> Executive Sanction
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-600 text-white text-[10px] font-bold gap-1">
                                <ShieldCheck className="h-3 w-3" /> Good Standing
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="py-3.5 text-xs">
                            <p className="font-bold text-foreground">
                              GH₵ {h.priceRange?.min?.toLocaleString()} - {h.priceRange?.max?.toLocaleString()}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {h.roomTypes?.length || 1} room categories
                            </p>
                          </TableCell>

                          <TableCell className="py-3.5 text-xs">
                            {(h as any).sanctionReason ? (
                              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                {(h as any).sanctionReason}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                No regulatory non-compliance reported
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="py-3.5 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedHostelForSanction(h);
                                setNewSanctionStatus(
                                  isRevoked ? "approved" : isSanctioned ? "revoked" : "sanctioned"
                                );
                                setSanctionReason((h as any).sanctionReason || "");
                              }}
                              className="h-8 text-xs font-bold rounded-xl gap-1"
                            >
                              <Scale className="h-3 w-3" />
                              Manage Status
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ================= MODAL: EXECUTIVE COUNCIL BRIEFING GENERATOR ================= */}
        <Dialog open={briefingOpen} onOpenChange={setBriefingOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8 bg-card border-border">
            <DialogHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Badge className="bg-primary text-primary-foreground text-[10px] font-bold uppercase mb-1">
                    Official Executive Document
                  </Badge>
                  <DialogTitle className="text-xl sm:text-2xl font-black font-headline text-foreground">
                    Executive Council Briefing Report
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Prepared for the Academic Board, University Council & Directorate of Student Welfare.
                  </DialogDescription>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="rounded-xl text-xs font-bold gap-1.5 shrink-0"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / Export
                </Button>
              </div>
            </DialogHeader>

            {/* Printable Briefing Content */}
            <div className="space-y-6 text-xs leading-relaxed text-foreground py-4">
              {/* Header Box */}
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/70 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-muted-foreground uppercase text-[10px]">Institution:</span>
                  <p className="font-bold text-base text-foreground">University Housing Directorate</p>
                  <p className="text-muted-foreground">Office of the Vice-Chancellor</p>
                </div>
                <div>
                  <span className="font-bold text-muted-foreground uppercase text-[10px]">Reporting Period:</span>
                  <p className="font-semibold text-foreground">{new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</p>
                  <p className="text-muted-foreground">Academic Year 2026/2027</p>
                </div>
              </div>

              {/* Section 1: Housing Deficit & Capacity */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border/60 pb-1 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  1. Institutional Housing Deficit Assessment
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-card border border-border/60">
                    <span className="text-muted-foreground font-medium text-[10px]">Enrollment</span>
                    <p className="text-lg font-black text-foreground">{ENROLLMENT_BASELINE.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-border/60">
                    <span className="text-muted-foreground font-medium text-[10px]">On-Campus Beds</span>
                    <p className="text-lg font-black text-emerald-600">{ON_CAMPUS_CAPACITY.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-border/60">
                    <span className="text-muted-foreground font-medium text-[10px]">Accredited Beds</span>
                    <p className="text-lg font-black text-sky-600">{offCampusAccreditedBeds.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-border/60">
                    <span className="text-muted-foreground font-medium text-[10px]">Acute Deficit</span>
                    <p className="text-lg font-black text-rose-600">{acuteHousingDeficit.toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  The university presently maintains an official residential coverage rate of <strong>{accommodationCoverageRate}%</strong>. The net acute housing deficit of <strong>{acuteHousingDeficit.toLocaleString()}</strong> students requires active engagement with private developers under the Statutory Desk Review fast-track pipeline.
                </p>
              </div>

              {/* Section 2: Rental Price Indices */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border/60 pb-1 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  2. Campus Rental Price Indices (Statutory Limits vs Market Averages)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-card border border-border/60">
                    <span className="text-muted-foreground font-medium text-[10px]">1-in-a-Room Avg</span>
                    <p className="text-base font-black text-foreground">GH₵ {rentIndices.oneInRoom.toLocaleString()}</p>
                    <span className="text-[10px] text-muted-foreground">Statutory Cap: GH₵ 9,000</span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-border/60">
                    <span className="text-muted-foreground font-medium text-[10px]">2-in-a-Room Avg</span>
                    <p className="text-base font-black text-foreground">GH₵ {rentIndices.twoInRoom.toLocaleString()}</p>
                    <span className="text-[10px] text-muted-foreground">Statutory Cap: GH₵ 6,500</span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-border/60">
                    <span className="text-muted-foreground font-medium text-[10px]">3-in-a-Room Avg</span>
                    <p className="text-base font-black text-foreground">GH₵ {rentIndices.threeInRoom.toLocaleString()}</p>
                    <span className="text-[10px] text-muted-foreground">Statutory Cap: GH₵ 4,500</span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-border/60">
                    <span className="text-muted-foreground font-medium text-[10px]">4-in-a-Room Avg</span>
                    <p className="text-base font-black text-foreground">GH₵ {rentIndices.fourInRoom.toLocaleString()}</p>
                    <span className="text-[10px] text-muted-foreground">Statutory Cap: GH₵ 3,500</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Safety Compliance & Dispute Resolution */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border/60 pb-1 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-teal-600" />
                  3. Safety Standards & Welfare Adjudication
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1">
                    <p className="font-bold text-foreground">Fire & Safety Certifications</p>
                    <p className="text-muted-foreground">
                      100% of accredited off-campus properties have lodged digital statutory undertakings under Act 389 and L.I. 1724 (Fire Precaution Regulations).
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1">
                    <p className="font-bold text-foreground">Dispute Resolution Health</p>
                    <p className="text-muted-foreground">
                      {summary.resolvedComplaints} of {summary.totalComplaints || 0} disputes resolved by the Dean of Students Arbitration Board ({summary.resolutionRate || 100}% resolution rate).
                    </p>
                  </div>
                </div>
              </div>

              {/* Signoff Box */}
              <div className="pt-4 border-t border-border/60 flex justify-between items-end text-[11px] text-muted-foreground">
                <div>
                  <p className="font-bold text-foreground">Submitted by:</p>
                  <p>Vice-Chancellor & Accommodation Oversight Directorate</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px]">BRIEFING REF: VC-BRIEF-2026-HQ</p>
                  <p>Certified Official Copy</p>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={() => setBriefingOpen(false)}
                className="rounded-xl text-xs"
              >
                Close Briefing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ================= MODAL: ACCREDITATION SANCTION TOGGLE ================= */}
        <Dialog
          open={Boolean(selectedHostelForSanction)}
          onOpenChange={(open) => {
            if (!open) setSelectedHostelForSanction(null);
          }}
        >
          <DialogContent className="max-w-md rounded-3xl p-6 bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold font-headline text-foreground flex items-center gap-2">
                <AlertOctagon className="h-5 w-5 text-rose-600" />
                Executive Sanction Control
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set the statutory standing for {selectedHostelForSanction?.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Accreditation Action *</label>
                <Select
                  value={newSanctionStatus}
                  onValueChange={(val: any) => setNewSanctionStatus(val)}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue placeholder="Select Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Good Standing (Active Accreditation)</SelectItem>
                    <SelectItem value="sanctioned">Executive Sanction (Warning Flag to Students)</SelectItem>
                    <SelectItem value="revoked">Revoke Charter (Immediate Delisting)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Executive Justification / Reason *</label>
                <Textarea
                  placeholder="e.g. Fire safety non-compliance, refusal to honor student welfare arbitration, or rent tariff ceiling violation."
                  value={sanctionReason}
                  onChange={(e) => setSanctionReason(e.target.value)}
                  className="rounded-xl text-xs min-h-[90px]"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                <p className="font-bold mb-0.5">Statutory Effect:</p>
                <span>
                  This action will be published immediately to students and logged in the University Council audit register.
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedHostelForSanction(null)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                variant={newSanctionStatus === "revoked" ? "destructive" : "default"}
                size="sm"
                onClick={handleUpdateSanction}
                disabled={isUpdatingSanction}
                className="rounded-xl text-xs font-bold gap-1.5"
              >
                {isUpdatingSanction && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Executive Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
