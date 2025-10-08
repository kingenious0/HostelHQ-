
import { Header } from '@/components/header';
import { HostelCard } from '@/components/hostel-card';
import { getHostels } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const hostels = await getHostels();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1">
        <section className="relative h-[450px] bg-gradient-to-br from-primary via-primary/70 to-accent/60">
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white p-4">
                <h1 className="text-4xl md:text-5xl font-bold font-headline">Find Your Perfect Student Home</h1>
                <p className="mt-2 text-lg md:text-xl max-w-2xl">
                    Discover the best student hostels in Ghana. Comfortable, affordable, and close to campus.
                </p>
                <div className="mt-8 w-full max-w-3xl">
                    <Card className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-2xl">
                        <CardContent className="p-2">
                            <form className="flex flex-col md:flex-row items-center gap-4">
                                <div className="relative w-full">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <Input placeholder="Search hostel name..." className="pl-12 h-14 text-base rounded-lg"/>
                                </div>
                                <div className="relative w-full">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <Input placeholder="Enter location" className="pl-12 h-14 text-base rounded-lg" />
                                </div>
                                <Button size="lg" className="w-full md:w-auto h-14 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg text-lg">
                                    Search
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16">
          <h2 className="text-3xl font-bold mb-8 text-center font-headline">Featured Hostels</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {hostels.map((hostel) => (
              <HostelCard key={hostel.id} hostel={hostel} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
