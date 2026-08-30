import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/header";
import { HostelCard } from "@/components/hostel-card";
import { getHostels } from "@/lib/data";
import { SearchForm } from "@/components/search-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Hero } from "@/components/hero";
import { PersistentFilterBar } from "@/components/persistent-filter-bar";
import { ShortlistProvider } from "@/components/shortlist-context";
import { HostelCompareDrawer } from "@/components/hostel-compare-drawer";
import { ShieldCheck, Sparkles, Building, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<{
    search?: string;
    location?: string;
    institution?: string;
    roomType?: string;
    gender?: string;
    minPrice?: string;
    maxPrice?: string;
    distance?: string;
    page?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const brandSnapshot = await getDocs(collection(db, "brandPartners")).catch(() => ({ docs: [] }));
  const brands = brandSnapshot.docs.map((brandDoc: any) => ({
    id: brandDoc.id,
    ...(brandDoc.data() as { name: string; logoUrl: string }),
  }));

  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams?.search || "";
  const locationQuery = resolvedSearchParams?.location || "";
  const institutionQuery = resolvedSearchParams?.institution || "";
  const roomTypeQuery = resolvedSearchParams?.roomType || "";
  const genderQuery = resolvedSearchParams?.gender || "";
  const minPriceQuery = Number(resolvedSearchParams?.minPrice) || 0;
  const maxPriceQuery = Number(resolvedSearchParams?.maxPrice) || 0;
  const distanceQuery = Number(resolvedSearchParams?.distance) || 0;
  const currentPage = Number(resolvedSearchParams?.page) || 1;
  const itemsPerPage = 12;

  const allHostels = await getHostels({
    institution: institutionQuery || undefined,
    roomType: roomTypeQuery || undefined,
    gender: genderQuery || undefined,
  });

  const filteredHostels = allHostels.filter((h) => {
    // Text search
    const matchesSearch =
      !searchQuery ||
      (h.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.location ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    // Location query
    const matchesLocation =
      !locationQuery || (h.location ?? "").toLowerCase().includes(locationQuery.toLowerCase());

    // Price filtering
    const minPrice = h.priceRange?.min || (h.roomTypes?.[0]?.price ?? 0);
    const maxPrice = h.priceRange?.max || minPrice;

    const matchesMinPrice = minPriceQuery === 0 || maxPrice >= minPriceQuery;
    const matchesMaxPrice = maxPriceQuery === 0 || minPrice <= maxPriceQuery;

    // Distance filtering (e.g. "10 mins", "5 mins walk")
    let matchesDistance = true;
    if (distanceQuery > 0 && h.distanceToUniversity) {
      const match = h.distanceToUniversity.match(/\d+/);
      if (match) {
        const mins = parseInt(match[0], 10);
        matchesDistance = mins <= distanceQuery;
      }
    }

    return matchesSearch && matchesLocation && matchesMinPrice && matchesMaxPrice && matchesDistance;
  });

  const totalPages = Math.ceil(filteredHostels.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedHostels = filteredHostels.slice(startIndex, startIndex + itemsPerPage);

  return (
    <ShortlistProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />
        <main className="flex-1 bg-background pb-24">
          {/* Student.com-style Hero with 3-step 'How It Works' strip */}
          <Hero />

          {/* Primary Quick Search Bar */}
          <section className="container mx-auto -mt-10 px-4 sm:px-6 lg:px-10 relative z-20">
            <div className="rounded-[2.5rem] p-1.5 sm:p-2 bg-card/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl">
              <h2 className="sr-only">Find a hostel</h2>
              <SearchForm />
            </div>
          </section>

          {/* HousingAnywhere-style Persistent Filter Bar */}
          <section className="mt-8">
            <PersistentFilterBar totalCount={filteredHostels.length} />
          </section>

          {/* Listing Grid Section */}
          <section id="all-hostels" className="container mx-auto px-4 pb-16 pt-8 sm:px-6 lg:px-10">
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span>{filteredHostels.length} Verified {filteredHostels.length === 1 ? "Hostel" : "Hostels"} Available</span>
                </div>
                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-headline font-extrabold tracking-tight text-foreground">
                  {searchQuery || locationQuery || institutionQuery || roomTypeQuery || genderQuery || minPriceQuery || maxPriceQuery
                    ? "Search & Filter Results"
                    : "University-Approved Accommodation"}
                </h2>
              </div>

              {/* Trust Tagline */}
              <div className="text-xs text-muted-foreground hidden sm:block text-right">
                <span className="font-bold text-foreground">100% Direct to Manager</span>
                <p>Audited prices, zero middleman markup fees</p>
              </div>
            </header>

            {/* Mobile-first grid: single-column on mobile, responsive scale-up */}
            {paginatedHostels.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedHostels.map((hostel) => (
                  <HostelCard
                    key={hostel.id}
                    hostel={hostel as any}
                    selectedRoomType={roomTypeQuery || undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center max-w-lg mx-auto my-8">
                <Building className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-xl font-headline font-bold text-foreground">No hostels match your filters</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Try clearing some filters or search for another campus area.
                </p>
                <Button asChild className="mt-5 rounded-2xl h-11 px-6 font-bold bg-primary text-white">
                  <Link href="/#all-hostels">Reset All Filters</Link>
                </Button>
              </div>
            )}

            {/* Pagination Controls */}
            {paginatedHostels.length > 0 && totalPages > 1 && (
              <div className="mt-12 flex justify-center items-center gap-2">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <Link
                    key={pageNumber}
                    href={`/?${new URLSearchParams({
                      ...(resolvedSearchParams || {}),
                      page: pageNumber.toString(),
                    }).toString()}#all-hostels`}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold transition-all",
                      pageNumber === currentPage
                        ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                        : "border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
                    )}
                  >
                    {pageNumber}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Institutional Trust Badges Strip */}
          <section className="container mx-auto px-4 py-10 sm:px-6 lg:px-10">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "University Approved",
                  description: "Every property is audited and sanctioned under university welfare guidelines.",
                },
                {
                  title: "Direct to Manager",
                  description: "Connect directly with hostel management without unauthorized middleman markups.",
                },
                {
                  title: "Tenancy Protection",
                  description: "Legally backed agreements and direct escalation channels to the Dean of Students.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {item.title}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Trusted Partners / Infrastructure */}
          <section className="bg-muted/20 border-t border-border/40 overflow-hidden py-12">
            <div className="container mx-auto px-4 text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.25em] mb-8">
                Secured With Trusted Infrastructure
              </p>
              <div className="flex flex-wrap items-center justify-center gap-10 opacity-70 hover:opacity-100 transition-opacity">
                {(brands.length ? brands : [
                  { id: "frog", name: "Frog.wigal", logoUrl: "/brands/frog-wigal.svg" },
                  { id: "hubtel", name: "Hubtel", logoUrl: "/brands/hubtel.svg" },
                  { id: "paystack", name: "Paystack", logoUrl: "/brands/paystack.svg" },
                ]).map((brand: { id: string; name: string; logoUrl: string }) => (
                  <div key={brand.id} className="flex flex-col items-center">
                    <div className="h-8 w-28 relative grayscale">
                      <Image
                        src={brand.logoUrl}
                        alt={`${brand.name} logo`}
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Amber Student-Style Compare Drawer */}
          <HostelCompareDrawer />
        </main>
      </div>
    </ShortlistProvider>
  );
}
