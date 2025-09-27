import { Header } from '@/components/header';
import { hostels } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Wifi, ParkingSquare, Utensils, Droplets, Snowflake, Dumbbell, Star, MapPin, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

const amenityIcons = {
  wifi: <Wifi className="h-5 w-5" />,
  parking: <ParkingSquare className="h-5 w-5" />,
  kitchen: <Utensils className="h-5 w-5" />,
  laundry: <Droplets className="h-5 w-5" />,
  ac: <Snowflake className="h-5 w-5" />,
  gym: <Dumbbell className="h-5 w-5" />,
  'study-area': <BookOpen className="h-5 w-5" />,
};

export default function HostelDetailPage({ params }: { params: { id: string } }) {
  const hostel = hostels.find((h) => h.id === params.id);

  if (!hostel) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-12">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div>
            <Carousel className="w-full rounded-lg overflow-hidden shadow-lg">
              <CarouselContent>
                {hostel.images.map((img, index) => (
                  <CarouselItem key={index}>
                    <div className="relative h-96 w-full">
                      <Image src={img} alt={`${hostel.name} image ${index + 1}`} fill style={{ objectFit: 'cover' }} data-ai-hint="hostel interior" />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-4" />
              <CarouselNext className="right-4" />
            </Carousel>
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl font-bold font-headline">{hostel.name}</h1>
            <div className="flex items-center text-muted-foreground mt-2">
              <MapPin className="h-5 w-5 mr-2" />
              <span>{hostel.location}</span>
            </div>
            <div className="flex items-center mt-4">
              <div className="flex items-center text-yellow-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`h-6 w-6 ${i < Math.round(hostel.rating) ? 'fill-current' : ''}`} />
                ))}
              </div>
              <span className="ml-3 text-lg text-muted-foreground">({hostel.reviews} reviews)</span>
            </div>
            <p className="mt-6 text-lg text-foreground/80">{hostel.description}</p>
            <div className="mt-8">
              <h3 className="text-xl font-semibold font-headline mb-4">Amenities</h3>
              <div className="flex flex-wrap gap-4">
                {hostel.amenities.map((amenity) => (
                  <Badge key={amenity} variant="outline" className="text-base p-2 capitalize flex items-center gap-2">
                     {amenityIcons[amenity as keyof typeof amenityIcons]} {amenity.replace('-', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="mt-8 flex items-baseline gap-4">
                <span className="text-4xl font-bold text-primary">GH₵{hostel.price}</span>
                <span className="text-lg text-muted-foreground">/ month</span>
            </div>
            <Link href={`/hostels/${hostel.id}/book`} className="mt-6">
                <Button size="lg" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg">Book a Visit</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
