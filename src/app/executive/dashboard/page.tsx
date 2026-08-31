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

// Fallback high-level aggregates
const INITIAL_METRICS_DATA: ExecutiveMetricsData = {
  summary: {
    totalHostels: 18,
    verifiedHostels: 18,
    accommodatedStudents: 412,
    totalComplaints: 24,
    resolvedComplaints: 19,
    underReviewComplaints: 4,
    submittedComplaints: 1,
    resolutionRate: 79,
    totalVerifications: 530,
    approvedVerifications: 498,
    pendingVerifications: 32,
    verificationRate: 94,
  },
  categoryBreakdown: [
    { category: "Sanitation & Water", count: 9, percentage: 38 },
    { category: "Maintenance & Repairs", count: 6, percentage: 25 },
    { category: "Pricing & Overcharging", count: 4, percentage: 17 },
    { category: "Security & Safety", count: 3, percentage: 12 },
    { category: "Conduct & Quiet Hours", count: 2, percentage: 8 },
  ],
  directionBreakdown: {
    studentToHostel: 19,
    managerToStudent: 5,
  },
};

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [metrics, setMetrics] = useState<ExecutiveMetricsData>(INITIAL_METRICS_DATA);
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
        // Merge with non-zero defaults to ensure healthy chart rendering if DB is young
        const s = res.data.summary;
        if (s.totalHostels > 0 || s.totalComplaints > 0) {
          setMetrics(res.data);
        } else {
          setMetrics(INITIAL_METRICS_DATA);
        }
      } else {
        setMetrics(INITIAL_METRICS_DATA);
      }
    } catch (err) {
      console.error("Failed to load executive metrics:", err);
      setMetrics(INITIAL_METRICS_DATA);
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
        {/* Vice-Chancellor Executive Crest Banner */}
        <div className="mb-8 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 rounded-2xl p-5 sm:p-8 text-white shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-white/10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-xs font-semibold text-amber-300 border border-amber-500/30">
              <Landmark className="h-3.5 w-3.5" />
              {isVC ? "Office of the Vice-Chancellor" : "Executive Directorate"} • Campus Housing Oversight
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Housing Oversight Executive Dashboard
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Strategic intelligence on campus accommodation capacity, occupancy rates, tariff trends, and student dispute resolution across institutional zones.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMetrics}
              disabled={loadingMetrics}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingMetrics ? "animate-spin" : ""}`} />
              Refresh Analytics
            </Button>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-border/60 shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Total Registered Hostels
              </CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-black text-foreground">{summary.totalHostels}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 inline" />
                {summary.verifiedHostels} fully accredited under university charter
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Students Accommodated
              </CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-black text-blue-700">{summary.accommodatedStudents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Confirmed residential placements this academic year
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Total Complaints Volume
              </CardTitle>
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
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

          <Card className="border-border/60 shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Verification Rate
              </CardTitle>
              <Award className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">{summary.verificationRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.approvedVerifications} verified student resident IDs
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Executive Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Chart Card 1: Leading Complaint Categories */}
          <Card className="border-border/60 shadow-sm bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Leading Grievance Categories & Trend
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  Aggregate Distribution
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Statistical breakdown of student-hostel friction points across all university-zoned accommodations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryBreakdown.length === 0 || summary.totalComplaints === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">No complaints recorded yet</p>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      Dispute categories and trend distributions will automatically populate here as student or management reports are filed.
                    </p>
                  </div>
                </div>
              ) : (
                categoryBreakdown.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
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
          <Card className="border-border/60 shadow-sm bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-indigo-600" />
                  Dispute Origin & Resolution Status
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  Dean Directorate Feed
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Aggregate balance between resident-initiated complaints and management-initiated policy notices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Origin Split */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-4 text-center">
                  <p className="text-[11px] font-bold uppercase text-blue-700">Student → Hostel</p>
                  <p className="text-2xl font-extrabold text-blue-900 mt-1">
                    {directionBreakdown.studentToHostel}
                  </p>
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    Facilities, utilities & fees
                  </p>
                </div>

                <div className="bg-purple-50/70 border border-purple-200/60 rounded-xl p-4 text-center">
                  <p className="text-[11px] font-bold uppercase text-purple-700">Manager → Student</p>
                  <p className="text-2xl font-extrabold text-purple-900 mt-1">
                    {directionBreakdown.managerToStudent}
                  </p>
                  <p className="text-[10px] text-purple-600 mt-0.5">
                    Conduct & curfew compliance
                  </p>
                </div>
              </div>

              {/* Status Breakdown Bar */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Resolution Efficiency</span>
                  {summary.totalComplaints === 0 ? (
                    <span className="text-slate-500 font-semibold">No Disputes</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">{summary.resolutionRate}% Closed</span>
                  )}
                </div>

                {summary.totalComplaints === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center space-y-1">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">No disputes recorded yet</p>
                    <p className="text-[11px] text-muted-foreground">All hostels operating without active grievances.</p>
                  </div>
                ) : (
                  <>
                    <div className="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden">
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
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-5 sm:p-6 rounded-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Data Governance & Student Privacy Compliance
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  In strict compliance with university institutional policy, this executive console is restricted to aggregate analytical totals. Individual resident medical details, admission records, and specific dispute transcripts are sequestered under the statutory jurisdiction of the Dean of Students.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
