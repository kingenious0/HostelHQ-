
"use client";

import { useState, useEffect, use } from 'react';
import { Header } from '@/components/header';
import { getHostel, Hostel } from '@/lib/data';
import { notFound, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Wifi, ParkingSquare, Utensils, Droplets, Snowflake, Dumbbell, Star, MapPin, BookOpen, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

const amenityIcons = {
  wifi: <Wifi className="h-5 w-5" />,
  parking: <ParkingSquare className="h-5 w-5" />,
  kitchen: <Utensils className="h-5 w-5" />,
  laundry: <Droplets className="h-5 w-5" />,
  ac: <Snowflake className="h-5 w-5" />,
  gym: <Dumbbell className="h-5 w-5" />,
  'study-area': <BookOpen className="h-5 w-5" />,
};

function FullHostelDetails({ hostel, currentUser }: { hostel: Hostel, currentUser: User | null }) {
    const router = useRouter();

    const handleApply = () => {
        // This is where we'd check if a visit has been completed.
        // For now, we assume if logged in, they can secure the hostel.
        if (currentUser) {
            router.push(`/hostels/${hostel.id}/secure`);
        } else {
            // This case should ideally not be hit if logic is correct, but as a fallback
            router.push(`/hostels/${hostel.id}/book`);
        }
    };

    return (
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div>
                <Carousel className="w-full rounded-lg overflow-hidden shadow-lg">
                    <CarouselContent>
                        {hostel.images.map((img: string, index: number) => (
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
                        {hostel.amenities.map((amenity: string) => (
                        <Badge key={amenity} variant="outline" className="text-base p-2 capitalize flex items-center gap-2">
                            {amenityIcons[amenity.toLowerCase().replace(' ', '-') as keyof typeof amenityIcons]} {amenity}
                        </Badge>
                        ))}
                    </div>
                </div>
                <div className="mt-8 flex items-baseline gap-4">
                    <span className="text-4xl font-bold text-primary">GH₵{hostel.price.toLocaleString()}</span>
                    <span className="text-lg text-muted-foreground">/year</span>
                </div>
                <Button size="lg" className="w-full mt-6 bg-accent hover:bg-accent/90 text-accent-foreground text-lg" onClick={handleApply}>
                    Apply to Secure Hostel
                </Button>
            </div>
        </div>
    );
}

function LimitedHostelDetails({ hostel }: { hostel: Hostel }) {
    const { toast } = useToast();
    const handleApply = () => {
        toast({
            title: "Please Log In",
            description: "You need to be logged in as a student to apply for a hostel. Please use the menu in the top right.",
            variant: "destructive",
        })
    };

    return (
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div>
                 <Carousel className="w-full rounded-lg overflow-hidden shadow-lg">
                    <CarouselContent>
                        {hostel.images.slice(0, 2).map((img: string, index: number) => (
                            <CarouselItem key={index}>
                                <div className="relative h-96 w-full">
                                <Image src={img} alt={`${hostel.name} image ${index + 1}`} fill style={{ objectFit: 'cover' }} data-ai-hint="hostel exterior" />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                </Carousel>
            </div>
            <div className="flex flex-col justify-center">
                 <h1 className="text-4xl font-bold font-headline">{hostel.name}</h1>
                <p className="mt-6 text-lg text-foreground/80">{hostel.description}</p>
                
                <Card className="mt-8 bg-muted/30">
                    <CardHeader>
                        <CardTitle className="flex items-center"><Lock className="mr-2 h-5 w-5 text-muted-foreground"/> More Details Available</CardTitle>
                        <CardDescription>
                            Log in as a student to see all amenities, pricing, room details, and more photos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="text-muted-foreground list-disc pl-5 space-y-1">
                            <li>Full Photo Gallery</li>
                            <li>Available Amenities</li>
                            <li>Pricing and Room Options</li>
                            <li>Contact Information</li>
                        </ul>
                    </CardContent>
                </Card>

                <Button size="lg" className="w-full mt-6 bg-accent hover:bg-accent/90 text-accent-foreground text-lg" onClick={handleApply}>
                    Apply to Secure Hostel
                </Button>
            </div>
        </div>
    );
}


export default function HostelDetailPage({ params }: { params: { id: string } }) {
  const { id } = use(params);
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
      const fetchHostelData = async () => {
          const hostelData = await getHostel(id);
          if (hostelData) {
              setHostel(hostelData);
          } else {
              notFound();
          }
          setLoading(false);
      };
      fetchHostelData();

      const unsubscribe = onAuthStateChanged(auth, user => {
          setCurrentUser(user);
      });
      return () => unsubscribe();
  }, [id]);


  if (loading) {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            </main>
        </div>
    )
  }

  if (!hostel) {
    notFound();
  }

  const isStudent = currentUser && currentUser.email?.includes('student');

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-12">
        {isStudent ? <FullHostelDetails hostel={hostel} currentUser={currentUser} /> : <LimitedHostelDetails hostel={hostel} />}
      </main>
    </div>
  );
}
