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

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: {
    search?: string;
    location?: string;
    institution?: string;
    roomType?: string;
    gender?: string;
    page?: string;
  };
};

export default async function Home({ searchParams }: HomeProps) {
  const brandSnapshot = await getDocs(collection(db, "brandPartners"));
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
  const currentPage = Number(resolvedSearchParams?.page) || 1;
  const itemsPerPage = 12;

  const allHostels = await getHostels({
    institution: institutionQuery || undefined,
    roomType: roomTypeQuery || undefined,
    gender: genderQuery || undefined,
  });

  const filteredHostels = allHostels.filter((h) => {
    const matchesSearch = !searchQuery || (h.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = !locationQuery || (h.location ?? "").toLowerCase().includes(locationQuery.toLowerCase());
    return matchesSearch && matchesLocation;
  });

  const totalPages = Math.ceil(filteredHostels.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedHostels = filteredHostels.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 bg-background">
        <Hero />

        <section className="container mx-auto -mt-16 px-4 sm:px-6 lg:px-10 relative z-10">
          <div className="glass-premium rounded-[2.5rem] p-2">
            <div className="p-4 sm:p-8">
              <h2 className="sr-only">Find a hostel</h2>
              <SearchForm />
            </div>
          </div>
        </section>

        <section id="all-hostels" className="container mx-auto px-4 pb-16 pt-12 sm:px-6 lg:px-10">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
            <div>
              <p className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-1">
                {filteredHostels.length} {filteredHostels.length === 1 ? "hostel" : "hostels"} available
              </p>
              <h2 className="text-3xl font-headline font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-2">
                {searchQuery || locationQuery || institutionQuery || roomTypeQuery || genderQuery
                  ? <span className="text-gradient">Search results</span>
                  : <>Authentic stays only. <span className="text-gradient">No cap</span></>}
              </h2>
            </div>
          </header>

          {paginatedHostels.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedHostels.map((hostel) => (
                <HostelCard key={hostel.id} hostel={hostel as any} selectedRoomType={roomTypeQuery || undefined} />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-dashed border-muted-foreground/40 bg-card p-10 text-center">
              <h3 className="text-xl font-semibold text-foreground">No hostels found</h3>
              <p className="mt-2 text-muted-foreground">
                Try adjusting your filters or contact our team for personalised recommendations.
              </p>
              <Button asChild className="mt-4">
                <Link href="/contact">Talk to support</Link>
              </Button>
            </div>
          )}

          {paginatedHostels.length > 0 && totalPages > 1 && (
            <div className="mt-10 flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={`/?${new URLSearchParams({
                    ...resolvedSearchParams,
                    page: pageNumber.toString(),
                  }).toString()}`}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border transition",
                    pageNumber === currentPage
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary"
                  )}
                >
                  {pageNumber}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="bg-muted/30 border-y border-border/40 overflow-hidden">
          <div className="container mx-auto px-4 py-16 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.3em] mb-10">Our Trusted Partners</p>
            <div className="flex flex-wrap items-center justify-center gap-10 opacity-60 hover:opacity-100 transition-opacity duration-500">
              {(brands.length ? brands : [
                { id: "frog", name: "Frog.wigal", logoUrl: "/brands/frog-wigal.svg" },
                { id: "hubtel", name: "Hubtel", logoUrl: "/brands/hubtel.svg" },
                { id: "paystack", name: "Paystack", logoUrl: "/brands/paystack.svg" },
              ]).map((brand: { id: string; name: string; logoUrl: string }) => (
                <div key={brand.id} className="flex flex-col items-center gap-2">
                  <div className="h-10 w-32 relative grayscale">
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

        <section className="container mx-auto px-4 pb-20 pt-10 sm:px-6 lg:px-10">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "24/7 student help",
                description: "We answer WhatsApp, calls, and email to keep bookings moving quickly.",
              },
              {
                title: "Verified landlords",
                description: "Every property manager is audited for pricing transparency and safety.",
              },
              {
                title: "Secure payments",
                description: "We support mobile money, bank transfers, and escrow for peace of mind.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary/80">{item.title}</p>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
