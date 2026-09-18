import Link from "next/link";
import { Header } from "@/components/header";
import { PaginatedHostelDirectory } from "@/components/PaginatedHostelDirectory";
import { fetchLiveHostelOccupancyMetrics } from "@/services/occupancyService";
import { getHostels } from "@/lib/data";
import { Users, Bed, Building2, Search, ArrowRight, ShieldCheck } from "lucide-react";
import { ShortlistProvider } from "@/components/shortlist-context";

export const dynamic = "force-dynamic";

interface StudentHostelsPageProps {
  searchParams?: Promise<{
    search?: string;
    location?: string;
  }>;
}

export default async function StudentHostelsPage({ searchParams }: StudentHostelsPageProps) {
  const resolvedParams = await searchParams;
  const searchQuery = (resolvedParams?.search || "").toLowerCase();
  const locationQuery = (resolvedParams?.location || "").toLowerCase();

  // Fetch full hostel data & real-time occupancy metrics live from Firestore / DynamoDB
  const [allHostels, occupancyMetrics] = await Promise.all([
    getHostels(),
    fetchLiveHostelOccupancyMetrics(),
  ]);

  // Create lookup map for real-time placement stats
  const occupancyMap = new Map<string, any>();
  for (const detail of occupancyMetrics.hostelDetails) {
    occupancyMap.set(detail.id, detail);
  }

  // Merge live occupancy details into hostel objects
  const enrichedHostels = allHostels.map((h) => {
    const cleanId = (h.originalId || h.id || "").replace(/^HOSTEL#/i, "").trim();
    const liveStats = occupancyMap.get(cleanId);
    return {
      ...h,
      activeStudentsHoused: liveStats?.activeStudentsHoused ?? h.occupiedBeds ?? 0,
      totalBeds: liveStats?.totalBeds ?? h.totalBeds ?? 0,
      availableBeds: liveStats?.availableBeds ?? 0,
      occupancyRate: liveStats?.occupancyRate ?? 0,
    };
  });

  const filteredHostels = enrichedHostels.filter((h) => {
    const matchesSearch =
      !searchQuery ||
      (h.name || "").toLowerCase().includes(searchQuery) ||
      (h.location || "").toLowerCase().includes(searchQuery);
    const matchesLocation =
      !locationQuery || (h.location || "").toLowerCase().includes(locationQuery);
    return matchesSearch && matchesLocation;
  });

  return (
    <ShortlistProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Banner */}
          <div className="mb-8 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3 border border-blue-400/30">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Verified AAMUSTED Student Accommodation Feed</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">
                Student Housing Discovery & Real-Time Availability
              </h1>
              <p className="text-sm sm:text-base text-blue-100 max-w-2xl">
                Browse verified campus-zoned hostels with live student placement counts and exact remaining bed spaces queried in real-time.
              </p>

              {/* Real-time Aggregate Stat Badges */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 max-w-xl">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                  <div className="flex items-center gap-1.5 text-blue-200 text-xs font-medium">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Properties</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold mt-1">
                    {occupancyMetrics.hostelDetails.length}
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                  <div className="flex items-center gap-1.5 text-blue-200 text-xs font-medium">
                    <Users className="h-3.5 w-3.5" />
                    <span>Students Housed</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold mt-1 text-emerald-400">
                    {occupancyMetrics.totalOccupiedBeds}
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1.5 text-blue-200 text-xs font-medium">
                    <Bed className="h-3.5 w-3.5" />
                    <span>Open Beds</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold mt-1 text-amber-300">
                    {Math.max(
                      0,
                      occupancyMetrics.totalRegisteredBeds - occupancyMetrics.totalOccupiedBeds
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="mb-6 flex flex-col sm:flex-row items-center gap-3">
            <form method="GET" action="/student/hostels" className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                defaultValue={searchQuery}
                placeholder="Search hostel name or location (e.g. Tanoso, Main Campus, KSTS)..."
                className="w-full pl-10 pr-4 py-2.5 bg-card rounded-2xl border border-border text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </form>
          </div>

          {/* Paginated Hostels Grid with Mobile Horizontal Scroll Filters & Pagination Bar */}
          <PaginatedHostelDirectory hostels={filteredHostels as any} />
        </main>
      </div>
    </ShortlistProvider>
  );
}
