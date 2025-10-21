
import { Header } from '@/components/header';
import { HostelCard } from '@/components/hostel-card';
import { getHostels } from '@/lib/data';
import { SearchForm } from '@/components/search-form';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

type HomeProps = {
  searchParams?: {
    search?: string;
    location?: string;
  };
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams?.search || '';
  const locationQuery = resolvedSearchParams?.location || '';

  const allHostels = await getHostels({ search: searchQuery, location: locationQuery });
  const featuredHostels = await getHostels({ featured: true });

  const hostelsToShow = searchQuery || locationQuery ? allHostels : allHostels.filter(h => !h.isFeatured);
  const showFeatured = !searchQuery && !locationQuery;


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
            {searchQuery || locationQuery ? `Search Results (${hostelsToShow.length})` : 'All Hostels'}
          </h2>
          {hostelsToShow.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {hostelsToShow.map((hostel) => (
                <HostelCard key={hostel.id} hostel={hostel} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-lg text-muted-foreground">No hostels found matching your criteria.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
