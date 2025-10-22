
import { Header } from '@/components/header';
import { HostelCard } from '@/components/hostel-card';
import { getHostels } from '@/lib/data';
import { SearchForm } from '@/components/search-form';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

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
  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams?.search || '';
  const locationQuery = resolvedSearchParams?.location || '';
  const institutionQuery = resolvedSearchParams?.institution || '';
  const roomTypeQuery = resolvedSearchParams?.roomType || '';
  const genderQuery = resolvedSearchParams?.gender || '';
  const currentPage = Number(resolvedSearchParams?.page) || 1;
  const itemsPerPage = 8; // Define how many hostels per page

  const allHostels = await getHostels({
    search: searchQuery,
    location: locationQuery,
    institution: institutionQuery,
    roomType: roomTypeQuery,
    gender: genderQuery,
  });
  const featuredHostels = await getHostels({ featured: true });

  const filteredHostels = allHostels.filter(h => {
    const matchesSearch = !searchQuery || (h.name ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = !locationQuery || (h.location ?? '').toLowerCase().includes(locationQuery.toLowerCase());
    const matchesInstitution = !institutionQuery || (h.institution ?? '').toLowerCase().includes(institutionQuery.toLowerCase());
    const matchesRoomType = !roomTypeQuery || (h.roomTypes ?? []).includes(roomTypeQuery);
    const matchesGender = !genderQuery || (h.gender ?? '') === genderQuery;
    return matchesSearch && matchesLocation && matchesInstitution && matchesRoomType && matchesGender;
  });

  const totalPages = Math.ceil(filteredHostels.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedHostels = filteredHostels.slice(startIndex, endIndex);

  const hostelsToShow = searchQuery || locationQuery || institutionQuery || roomTypeQuery || genderQuery ? paginatedHostels : paginatedHostels;
  const showFeatured = !searchQuery && !locationQuery && !institutionQuery && !roomTypeQuery && !genderQuery && currentPage === 1;


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1">
        <section className="relative h-[450px] bg-gradient-to-br from-primary via-primary/70 to-accent/60">
            <div className="absolute inset-0 bg-black/50" />
            <Image 
                src="https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=2796&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Modern student accommodations"
                fill
                className="object-cover"
                data-ai-hint="student accommodation building"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white p-4">
                <h1 className="text-4xl md:text-5xl font-bold font-headline">Find Your Perfect Student Home</h1>
                <p className="mt-2 text-lg md:text-xl max-w-2xl">
                    Discover the best student hostels in Ghana. Comfortable, affordable, and close to campus.
                </p>
                <div className="mt-8 w-full max-w-3xl">
                   <SearchForm />
                </div>
            </div>
        </section>

        {showFeatured && featuredHostels.length > 0 && (
          <section className="container mx-auto px-4 md:px-6 py-16">
            <h2 className="text-3xl font-bold mb-8 text-center font-headline">Featured Hostels</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {featuredHostels.map((hostel) => (
                <HostelCard key={hostel.id} hostel={hostel} />
              ))}
            </div>
          </section>
        )}

        <section className="container mx-auto px-4 md:px-6 py-16 bg-gray-50/50 rounded-xl">
           <h2 className="text-3xl font-bold mb-8 text-center font-headline">
            {(searchQuery || locationQuery || institutionQuery || roomTypeQuery || genderQuery) ? `Search Results (${filteredHostels.length})` : 'All Hostels'}
          </h2>
          {paginatedHostels.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {paginatedHostels.map((hostel) => (
                <HostelCard key={hostel.id} hostel={hostel} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-lg text-muted-foreground">No hostels found matching your criteria.</p>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8 space-x-2">
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              {[...Array(totalPages)].map((_, index) => (
                <Button
                  key={index + 1}
                  variant={currentPage === index + 1 ? "default" : "outline"}
                  onClick={() => handlePageChange(index + 1)}
                >
                  {index + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function handlePageChange(page: number) {
  const params = new URLSearchParams(window.location.search);
  params.set('page', page.toString());
  window.history.pushState(null, '', `/?${params.toString()}`);
}
