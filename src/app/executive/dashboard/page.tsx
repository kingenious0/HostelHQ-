"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { fetchExecutiveMetricsAction } from "@/app/actions/db";
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

// Initial zero-state aggregates
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

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [metrics, setMetrics] = useState<ExecutiveMetricsData>(EMPTY_METRICS_DATA);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

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
              description: "This executive dashboard is restricted to the Pro-Vice-Chancellor and Vice-Chancellor.",
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

  // Load Executive Metrics
  const loadMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetchExecutiveMetricsAction();
      if (res.success && res.data) {
        setMetrics(res.data);
      } else {
        setMetrics(EMPTY_METRICS_DATA);
      }
    } catch (err) {
      console.error("Failed to load executive metrics:", err);
      setMetrics(EMPTY_METRICS_DATA);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    if (!loadingAuth && (userRole === "pro_vc" || userRole === "vc" || userRole === "admin")) {
      loadMetrics();
    }
  }, [loadingAuth, userRole]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Low-Profile Utility Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Housing Oversight Executive Dashboard
              </h1>
              <Badge variant="outline" className="text-xs font-semibold text-amber-700 bg-amber-50 border-amber-200">
                <Landmark className="h-3 w-3 mr-1" />
                {isVC ? "Office of the Vice-Chancellor" : "Executive Directorate"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              High-level strategic intelligence on campus housing capacity, occupancy, and residential welfare.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadMetrics}
            disabled={loadingMetrics}
            className="h-9 px-3 text-xs font-semibold self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loadingMetrics ? "animate-spin" : ""}`} />
            Refresh Analytics
          </Button>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border border-border/60 shadow-xs bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Total Registered Hostels
              </CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-foreground">{summary.totalHostels}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 inline" />
                {summary.verifiedHostels} accredited under charter
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Students Accommodated
              </CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-blue-700">{summary.accommodatedStudents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Confirmed residential placements
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Disputes & Complaints
              </CardTitle>
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-foreground">{summary.totalComplaints}</div>
              {summary.totalComplaints === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Zero active disputes recorded
                </p>
              ) : (
                <p className="text-xs text-emerald-600 font-semibold mt-1">
                  {summary.resolutionRate}% resolved by Dean's Office
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-xs bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Verification Rate
              </CardTitle>
              <Award className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">{summary.verificationRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.approvedVerifications} verified student resident IDs
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Executive Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Chart Card 1: Leading Complaint Categories */}
          <Card className="border border-border/60 shadow-xs bg-white">
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
                  <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">No grievances recorded</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Dispute trends will automatically populate here as student or hostel reports are submitted.
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
                    <Progress
                      value={item.percentage}
                      className="h-2 rounded-full bg-slate-100"
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Chart Card 2: Dispute Direction & Resolution Health */}
          <Card className="border border-border/60 shadow-xs bg-white">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-indigo-600" />
                  Dispute Origin & Resolution Status
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Resident-initiated reports vs management-initiated policy notices.
                </CardDescription>
              </div>
            </div>
            <CardContent className="p-4 space-y-5">
              {/* Origin Split */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-border/60 rounded-xl p-3 text-center">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground">Student → Hostel</p>
                  <p className="text-2xl font-extrabold text-foreground mt-1">
                    {directionBreakdown.studentToHostel}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Facilities, utilities & fees
                  </p>
                </div>

                <div className="bg-slate-50 border border-border/60 rounded-xl p-3 text-center">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground">Manager → Student</p>
                  <p className="text-2xl font-extrabold text-foreground mt-1">
                    {directionBreakdown.managerToStudent}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Conduct & quiet hours
                  </p>
                </div>
              </div>

              {/* Status Breakdown Bar */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Resolution Efficiency</span>
                  {summary.totalComplaints === 0 ? (
                    <span className="text-muted-foreground font-semibold">No Disputes</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">{summary.resolutionRate}% Closed</span>
                  )}
                </div>

                {summary.totalComplaints === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-slate-50/50 p-4 text-center space-y-1">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">No active grievances</p>
                    <p className="text-[11px] text-muted-foreground">All hostels operating without unresolved complaints.</p>
                  </div>
                ) : (
                  <>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 flex overflow-hidden">
                      <div
                        style={{ width: `${summary.resolutionRate}%` }}
                        className="bg-emerald-500 h-full"
                        title={`Resolved: ${summary.resolvedComplaints}`}
                      />
                      <div
                        style={{ width: `${100 - summary.resolutionRate}%` }}
                        className="bg-amber-400 h-full"
                        title={`Under Review / Submitted: ${summary.underReviewComplaints + summary.submittedComplaints}`}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                        {summary.resolvedComplaints} Resolved
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                        {summary.underReviewComplaints + summary.submittedComplaints} In Active Review
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Institutional Governance Notice */}
        <Card className="border border-border/60 bg-slate-50/60 p-4 sm:p-5 rounded-xl">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-foreground">
                Data Governance & Student Privacy Compliance
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                In strict compliance with university policy, this executive console displays aggregate analytical totals. Individual resident medical records, admission documents, and dispute transcripts are kept under the statutory jurisdiction of the Dean of Students.
              </p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
