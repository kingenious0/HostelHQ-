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
        {/* Hero Section with glassmorphism overlay */}
        <section className="relative w-full overflow-hidden bg-slate-900">
          <div className="absolute inset-0">
            <Image
              src="https://images.pexels.com/photos/5927532/pexels-photo-5927532.jpeg?auto=compress&cs=tinysrgb&w=2000"
              alt="Students relaxing in a modern hostel room"
              fill
              priority
              className="object-cover brightness-[0.55]"
            />
          </div>

          <div className="relative container mx-auto flex min-h-[420px] flex-col items-center justify-center px-4 pt-24 pb-20 sm:px-6 lg:px-10">
            <div className="max-w-3xl rounded-3xl border border-white/15 bg-white/10 px-6 py-7 text-center shadow-[0_18px_45px_rgba(15,23,42,0.55)] backdrop-blur-xl sm:px-10 sm:py-10">
              <p className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/15 px-4 py-1 text-xs font-medium uppercase tracking-[0.35em] text-slate-50/90">
                Make off‑campus living easier
              </p>
              <h1 className="mt-5 text-3xl font-headline font-extrabold text-slate-50 sm:text-4xl lg:text-5xl">
                Find verified hostels fast, easy & secure.
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-100/85 sm:text-base">
                Compare real student hostels, check availability, and secure your bed online in a few clicks.
                HostelHQ keeps payments, agreements and landlord communication all in one safe place.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" className="w-full rounded-full bg-primary text-primary-foreground sm:w-auto">
                  <Link href="#all-hostels">Get started . browse hostels</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full rounded-full border-white/40 bg-white/10 text-slate-50 hover:bg-white/20 sm:w-auto"
                >
                  <Link href="/contact">Talk to a student advisor</Link>
                </Button>
              </div>
              <p className="mt-3 text-xs text-slate-100/70">
                No extra agent fees. Just transparent prices and support before, during and after movein.
              </p>
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
