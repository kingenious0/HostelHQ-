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
      <main className="flex-1 bg-slate-50">
        <section className="container mx-auto px-4 pb-16 pt-10 sm:px-6 lg:px-10">
          <div className="rounded-3xl bg-white shadow-xl ring-1 ring-slate-100">
            <div className="grid gap-8 p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-12">
              <div className="flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80">Modern hostel booking</p>
                <h1 className="mt-4 text-4xl font-headline font-bold text-slate-900 sm:text-5xl">
                  Book verified hostels in minutes
                </h1>
                <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
                  Compare hostels, check real-time availability, and reserve beds confidently with our team guiding every step.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="w-full rounded-full sm:w-auto">
                    <Link href="#all-hostels">Browse hostels</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="w-full rounded-full border-slate-200 text-slate-900 hover:bg-slate-50 sm:w-auto"
                  >
                    <Link href="/contact">Talk to support</Link>
                  </Button>
                </div>
              </div>
              <div className="relative h-64 overflow-hidden rounded-2xl bg-slate-100 sm:h-72 lg:h-auto">
                <Image
                  src="https://images.unsplash.com/photo-1444418776041-9c7e33cc5a9c?q=80&w=2000&auto=format&fit=crop"
                  alt="Students inspecting a modern hostel"
                  fill
                  priority
                  className="object-cover"
                />
                <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Currently securing</p>
                  <p className="text-base font-semibold text-slate-900">KNUST • Ayeduase - 2 bed ensuite</p>
                  <p className="text-sm text-slate-600">$ 4800 / annum • flexible payment plans</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto -mt-12 px-4 sm:px-6 lg:px-10">
          <div className="rounded-3xl border border-border/60 bg-white p-6 shadow-2xl sm:p-8">
            <h2 className="sr-only">Find a hostel</h2>
            <SearchForm />
          </div>
        </section>

        <section id="all-hostels" className="container mx-auto px-4 pb-16 pt-12 sm:px-6 lg:px-10">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">
                {filteredHostels.length} {filteredHostels.length === 1 ? "hostel" : "hostels"} curated for students
              </p>
              <h2 className="text-3xl font-headline font-semibold text-slate-900">
                {searchQuery || locationQuery || institutionQuery || roomTypeQuery || genderQuery
                  ? "Search results"
                  : "All verified hostels"}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full border border-slate-200 px-3 py-1">Trusted landlords</span>
              <span className="rounded-full border border-slate-200 px-3 py-1">Digital agreements</span>
              <span className="rounded-full border border-slate-200 px-3 py-1">Campus transfers</span>
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

        <section className="bg-white">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-8 px-4 py-12 sm:px-6 lg:px-10">
            {(brands.length ? brands : [
              { id: "frog", name: "Frog.wigal", logoUrl: "/brands/frog-wigal.svg" },
              { id: "hubtel", name: "Hubtel", logoUrl: "/brands/hubtel.svg" },
              { id: "paystack", name: "Paystack", logoUrl: "/brands/paystack.svg" },
            ]).map((brand: { id: string; name: string; logoUrl: string }) => (
              <div key={brand.id} className="flex flex-col items-center gap-3 text-center">
                <Image
                  src={brand.logoUrl}
                  alt={`${brand.name} logo`}
                  width={160}
                  height={60}
                  className="h-12 w-40 object-contain"
                />
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">{brand.name}</span>
              </div>
            ))}
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
