
"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { getHostel, Hostel, RoomType, Review } from '@/lib/data';
import { notFound, useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { Wifi, ParkingSquare, Utensils, Droplets, Snowflake, Dumbbell, Star, MapPin, BookOpen, Lock, DoorOpen, Clock, Bed, Bath, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableRow, TableHead, TableHeader } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';


const amenityIcons: { [key: string]: React.ReactNode } = {
  'wifi': <Wifi className="h-5 w-5" />,
  'parking': <ParkingSquare className="h-5 w-5" />,
  'kitchen': <Utensils className="h-5 w-5" />,
  'laundry': <Droplets className="h-5 w-5" />,
  'ac': <Snowflake className="h-5 w-5" />,
  'gym': <Dumbbell className="h-5 w-5" />,
  'study area': <BookOpen className="h-5 w-5" />,
};

const availabilityInfo: Record<Hostel['availability'], { text: string, icon: React.ReactNode, className: string }> = {
    'Available': { text: 'Rooms Available', icon: <DoorOpen />, className: 'bg-green-100 text-green-800 border-green-200'},
    'Limited': { text: 'Limited Rooms', icon: <Clock />, className: 'bg-yellow-100 text-yellow-800 border-yellow-200'},
    'Full': { text: 'Hostel Full', icon: <Lock />, className: 'bg-red-100 text-red-800 border-red-200'},
};

type AppUser = {
  uid: string;
  email: string;
  fullName: string;
  role: 'student' | 'agent' | 'admin';
}

function FullHostelDetails({ hostel, currentUser }: { hostel: Hostel, currentUser: AppUser | null }) {
    const router = useRouter();
    const { toast } = useToast();
    const currentAvailability = availabilityInfo[hostel.availability || 'Full'];

    const getRoomAvailabilityVariant = (availability: RoomType['availability']) => {
        switch(availability) {
            case 'Available': return 'default';
            case 'Limited': return 'secondary';
            case 'Full': return 'destructive';
            default: return 'outline';
        }
    }

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
                
                 <div className="mt-8">
                    <h3 className="text-xl font-semibold font-headline mb-4">Description</h3>
                    <p className="mt-2 text-foreground/80 leading-relaxed">{hostel.description}</p>
                </div>
                
                 <div className="mt-8">
                    <h3 className="text-xl font-semibold font-headline mb-4">Amenities</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {hostel.amenities.map((amenity: string) => (
                        <div key={amenity} className="flex items-center gap-3">
                           <div className="p-2 bg-secondary rounded-md">
                             {amenityIcons[amenity.toLowerCase().replace(' ', '-')] || <div className="h-5 w-5" />}
                           </div>
                           <span className="text-sm font-medium capitalize">{amenity}</span>
                        </div>
                        ))}
                    </div>
                </div>
                
                <div className="mt-8">
                    <h3 className="text-xl font-semibold font-headline mb-4">Reviews ({hostel.reviews.length})</h3>
                    {hostel.reviews.length > 0 ? (
                        <div className="space-y-6">
                            {hostel.reviews.map(review => (
                                <div key={review.id} className="flex gap-4">
                                     <Avatar>
                                        <AvatarFallback>{review.studentName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold">{review.studentName}</p>
                                            <span className="text-xs text-muted-foreground">{format(new Date(review.createdAt), 'PP')}</span>
                                        </div>
                                        <div className="flex items-center mt-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`} />
                                            ))}
                                        </div>
                                        <p className="text-sm text-foreground/80 mt-2">{review.comment}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No reviews yet for this hostel.</p>
                    )}
                </div>

            </div>
            <div className="flex flex-col">
                <Badge 
                    variant="outline"
                    className={cn("text-base p-2 capitalize flex items-center gap-2 w-fit mb-4", currentAvailability.className)}
                >
                    {currentAvailability.icon} {currentAvailability.text}
                </Badge>
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
                    <span className="ml-3 text-lg text-muted-foreground">({hostel.reviews.length} reviews)</span>
                </div>
                
                <Card className="mt-8 shadow-md">
                    <CardHeader>
                        <CardTitle>Room Types & Pricing</CardTitle>
                        <CardDescription>Select a room and book a visit to proceed.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Room Type</TableHead>
                                    <TableHead>Availability</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {hostel.roomTypes?.map((room) => (
                                <TableRow key={room.id}>
                                    <TableCell>
                                        <p className="font-medium">{room.name}</p>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                            {room.beds && <span className="flex items-center gap-1"><Bed className="h-3 w-3"/> {room.beds} Beds</span>}
                                            {room.bathrooms && <span className="flex items-center gap-1"><Bath className="h-3 w-3"/> {room.bathrooms}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getRoomAvailabilityVariant(room.availability)}>{room.availability}</Badge>
                                    </TableCell>
                                    <TableCell className="font-semibold">
                                        GH₵{room.price.toLocaleString()}
                                        <span className="text-xs text-muted-foreground font-normal">/year</span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            size="sm"
                                            disabled={room.availability === 'Full'}
                                            onClick={() => router.push(`/hostels/${hostel.id}/book?roomTypeId=${room.id}`)}
                                        >
                                            Book Visit
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}

function LimitedHostelDetails({ hostel }: { hostel: Hostel }) {
    const { toast } = useToast();
    const router = useRouter();
    const handleApply = () => {
        toast({
            title: "Please Log In",
            description: "You need to be logged in as a student to apply for a hostel. Please use the menu in the top right.",
            variant: "destructive",
        })
        router.push('/login');
    };
    
    const renderPrice = () => {
        if (!hostel.priceRange || hostel.priceRange.min === 0) {
            return <span className="text-4xl font-bold text-primary">GH₵{hostel.price?.toLocaleString() || 'N/A'}</span>
        }
        if (hostel.priceRange.min === hostel.priceRange.max) {
        return <span className="text-4xl font-bold text-primary">GH₵{hostel.priceRange.min.toLocaleString()}</span>;
        }
        return (
        <span className="text-4xl font-bold text-primary">
            GH₵{hostel.priceRange.min.toLocaleString()} - {hostel.priceRange.max.toLocaleString()}
        </span>
        );
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
                 <div className="flex items-center text-muted-foreground mt-2">
                    <MapPin className="h-5 w-5 mr-2" />
                    <span>{hostel.location}</span>
                </div>
                <p className="mt-6 text-lg text-foreground/80">{hostel.description}</p>
                
                <div className="mt-8 flex items-baseline gap-4">
                    {renderPrice()}
                    <span className="text-lg text-muted-foreground">/year</span>
                </div>

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
                            <li>Available Amenities & Room Types</li>
                            <li>Live Availability Status</li>
                            <li>Book a Guided or Self-Guided Visit</li>
                        </ul>
                    </CardContent>
                </Card>

                <Button size="lg" className="w-full mt-6 bg-accent hover:bg-accent/90 text-accent-foreground text-lg" onClick={handleApply}>
                    Log In to Book
                </Button>
            </div>
        </div>
    );
}


export default function HostelDetailPage() {
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [loading, setLoading] = useState(true);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const routeParams = useParams();
  const id = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;

  useEffect(() => {
      const fetchHostelData = async () => {
          if (id) {
            const hostelData = await getHostel(id);
            if (hostelData) {
                setHostel(hostelData);
            } else {
                notFound();
            }
          }
          setLoading(false);
      };
      fetchHostelData();

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                setAppUser({
                    uid: user.uid,
                    email: user.email!,
                    fullName: userData.fullName,
                    role: userData.role
                });
            } else {
                // If user not in 'users', check 'pendingUsers'
                const pendingUserDocRef = doc(db, "pendingUsers", user.uid);
                const pendingUserDocSnap = await getDoc(pendingUserDocRef);
                if (pendingUserDocSnap.exists()) {
                    const userData = pendingUserDocSnap.data();
                     setAppUser({
                        uid: user.uid,
                        email: user.email!,
                        fullName: userData.fullName,
                        role: userData.role
                    });
                } else {
                    setAppUser(null);
                }
            }
          } else {
              setAppUser(null);
          }
          setAuthChecked(true);
      });
      return () => unsubscribe();
  }, [id]);


  if (loading || !authChecked) {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </main>
        </div>
    )
  }

  if (!hostel) {
    notFound();
  }

  const isStudent = appUser?.role === 'student';

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-12">
        {isStudent ? <FullHostelDetails hostel={hostel} currentUser={appUser} /> : <LimitedHostelDetails hostel={hostel} />}
      </main>
    </div>
  );
}
