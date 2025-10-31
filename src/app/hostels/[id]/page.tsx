

"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { getHostel, Hostel, RoomType, Review } from '@/lib/data';
import { notFound, useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { Wifi, ParkingSquare, Utensils, Droplets, Snowflake, Dumbbell, Star, MapPin, BookOpen, Lock, DoorOpen, Clock, Bed, Bath, User, ShieldCheck, Ticket, FileText } from 'lucide-react';
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
import { collection, query, where, getDocs, limit, doc, getDoc, orderBy } from 'firebase/firestore';
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

interface AppUser {
  uid: string;
  email: string;
  fullName: string;
  role: 'student' | 'agent' | 'admin';
  profileImage?: string;
}

type Visit = {
  id: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  studentCompleted?: boolean;
}

type ExistingBooking = {
  id: string;
  status: string;
  roomTypeId?: string;
}

function FullHostelDetails({ hostel, currentUser }: { hostel: Hostel, currentUser: AppUser | null }) {
    const router = useRouter();
    const { toast } = useToast();
    const currentAvailability = availabilityInfo[hostel.availability || 'Full'];
    const [existingVisit, setExistingVisit] = useState<Visit | null | undefined>(undefined); // undefined: loading, null: not found
    const [existingBooking, setExistingBooking] = useState<ExistingBooking | null | undefined>(undefined); // undefined: loading, null: not found

    useEffect(() => {
        if (!currentUser || !hostel.id) {
            setExistingVisit(null);
            setExistingBooking(null);
            return;
        }

        const checkExistingBooking = async () => {
            const bookingsQuery = query(
                collection(db, 'bookings'),
                where('studentId', '==', currentUser.uid),
                where('hostelId', '==', hostel.id),
                where('status', '==', 'confirmed')
            );

            const bookingSnapshot = await getDocs(bookingsQuery);
            if (!bookingSnapshot.empty) {
                const booking = bookingSnapshot.docs[0];
                setExistingBooking({
                    id: booking.id,
                    status: booking.data().status,
                    roomTypeId: booking.data().roomTypeId
                });
            } else {
                setExistingBooking(null);
            }
        };

        const checkExistingVisit = async () => {
            const visitsQuery = query(
                collection(db, 'visits'),
                where('studentId', '==', currentUser.uid),
                where('hostelId', '==', hostel.id)
            );

            const visitSnapshot = await getDocs(visitsQuery);
            if (!visitSnapshot.empty) {
                // Find a visit that is completed AND the student has marked as completed
                const completedVisit = visitSnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        status: doc.data().status,
                        studentCompleted: doc.data().studentCompleted
                    } as Visit))
                    .find(visit => visit.status === 'completed' && visit.studentCompleted === true);
                
                // If no completed visit, find any non-cancelled visit
                const activeOrCompletedVisit = completedVisit || visitSnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        status: doc.data().status,
                        studentCompleted: doc.data().studentCompleted
                    } as Visit))
                    .find(visit => visit.status !== 'cancelled');
                
                setExistingVisit(activeOrCompletedVisit || null);
            } else {
                setExistingVisit(null);
            }
        };

        // Check booking first (takes priority), then visit
        checkExistingBooking();
        checkExistingVisit();
    }, [currentUser, hostel.id]);


    const getRoomAvailabilityVariant = (availability: RoomType['availability']) => {
        switch(availability) {
            case 'Available': return 'default';
            case 'Limited': return 'secondary';
            case 'Full': return 'destructive';
            default: return 'outline';
        }
    }
    
    const getVisitButton = (room: RoomType) => {
        // First check if hostel is already secured
        if (existingBooking !== undefined && existingBooking !== null) {
            // Check if this room type matches the secured room
            const isSecuredRoom = existingBooking.roomTypeId === room.id;
            return (
                <Button 
                    size="sm"
                    disabled
                    className="bg-green-600 hover:bg-green-600 text-white cursor-not-allowed"
                >
                    <ShieldCheck className="mr-2 h-4 w-4"/>
                    {isSecuredRoom ? 'Hostel Secured' : 'Room Secured'}
                </Button>
            );
        }

        if (existingVisit === undefined) {
             return <Button variant="outline" size="sm" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Checking...</Button>;
        }

        if (existingVisit) {
            // Only show Secure Room if visit is completed AND student has marked it complete
            if (existingVisit.status === 'completed' && existingVisit.studentCompleted === true) {
                return (
                    <Button 
                        size="sm"
                        disabled={room.availability === 'Full'}
                        onClick={() => router.push(`/hostels/${hostel.id}/secure?roomTypeId=${room.id}`)}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                        <ShieldCheck className="mr-2 h-4 w-4"/>
                        Secure Room
                    </Button>
                );
            }
            // If visit exists but not completed, show Track Visit
            if (existingVisit.status !== 'cancelled') {
                return (
                    <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/hostels/${hostel.id}/book/tracking?visitId=${existingVisit.id}`)}
                    >
                        <Ticket className="mr-2 h-4 w-4"/>
                        Track Visit
                    </Button>
                );
            }
        }

        return (
            <Button 
                variant="outline"
                size="sm"
                disabled={room.availability === 'Full'}
                onClick={() => router.push(`/hostels/${hostel.id}/book?roomTypeId=${room.id}`)}
            >
                Book Visit
            </Button>
        );
    }
    
    const renderPrice = () => {
        const priceStyle = "text-4xl font-bold";
        if (!hostel.priceRange || hostel.priceRange.min === 0) {
            return <span className={priceStyle}>GH₵{hostel.price?.toLocaleString() || 'N/A'}</span>
        }
        if (hostel.priceRange.min === hostel.priceRange.max) {
            return <span className={priceStyle}>GH₵{hostel.priceRange.min.toLocaleString()}</span>;
        }
        return (
            <span className="text-3xl font-bold">
                GH₵{hostel.priceRange.min.toLocaleString()} - {hostel.priceRange.max.toLocaleString()}
            </span>
        );
    };
    
    const getPrimaryCTA = () => {
        // First check if hostel is already secured (takes priority)
        if (existingBooking !== undefined && existingBooking !== null) {
            return (
                <div className="space-y-3 mt-6">
                    <Button 
                        size="lg" 
                        className="w-full h-14 bg-green-600 hover:bg-green-600 text-white cursor-not-allowed" 
                        disabled
                    >
                        <ShieldCheck className="mr-2 h-5 w-5"/>
                        Hostel Secured
                    </Button>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            className="flex-1" 
                            onClick={() => router.push(`/invoice/${existingBooking.id}`)}
                        >
                            <FileText className="mr-2 h-4 w-4"/>
                            View Invoice
                        </Button>
                        <Button 
                            variant="outline" 
                            className="flex-1" 
                            onClick={() => router.push(`/agreement/${existingBooking.id}`)}
                        >
                            <FileText className="mr-2 h-4 w-4"/>
                            View Agreement
                        </Button>
                    </div>
                </div>
            );
        }

        if (existingVisit === undefined) {
             return <Button size="lg" className="w-full mt-6 h-14" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Checking Status...</Button>;
        }

        if (existingVisit && existingVisit.status !== 'completed' && existingVisit.status !== 'cancelled') {
            return (
                 <Button size="lg" className="w-full mt-6 h-14 bg-primary text-primary-foreground" onClick={() => router.push(`/hostels/${hostel.id}/book/tracking?visitId=${existingVisit.id}`)}>
                    <Ticket className="mr-2 h-5 w-5"/>
                    Track Your Visit
                </Button>
            );
        }
        
        // Show Secure Hostel ONLY if visit is completed AND student has marked it complete
        if (existingVisit?.status === 'completed' && existingVisit?.studentCompleted === true) {
            return (
                <Button size="lg" className="w-full mt-6 h-14 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => router.push(`/hostels/${hostel.id}/secure`)}>
                    <ShieldCheck className="mr-2 h-5 w-5"/>
                    Secure This Hostel
                </Button>
            );
        }
        
        return (
             <Button size="lg" className="w-full mt-6 h-14 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => router.push(`/hostels/${hostel.id}/book`)}>
                Book a Visit
            </Button>
        );
    };

    return (
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-12">
            <div className="order-2 lg:order-1">
                <Carousel className="w-full rounded-lg overflow-hidden shadow-lg">
                    <CarouselContent>
                        {hostel.images.map((img: string, index: number) => (
                            <CarouselItem key={index}>
                                <div className="relative h-64 sm:h-80 lg:h-96 w-full">
                                <Image src={img} alt={`${hostel.name} image ${index + 1}`} fill style={{ objectFit: 'cover' }} data-ai-hint="hostel interior" />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-2 sm:left-4" />
                    <CarouselNext className="right-2 sm:right-4" />
                </Carousel>
                
                 <div className="mt-8 space-y-6">
                    <div>
                        <h3 className="text-xl font-semibold font-headline mb-4">Description</h3>
                        <p className="mt-2 text-foreground/80 leading-relaxed">{hostel.description}</p>
                         {hostel.distanceToUniversity && <p className="mt-2 text-sm text-muted-foreground">Distance to AAMUSTED University: {hostel.distanceToUniversity}</p>}
                    </div>

                    <Separator />
                    
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold font-headline flex items-center gap-2"><FileText className="h-5 w-5 text-muted-foreground"/>Student Bills</h3>
                        {hostel.billsIncluded && hostel.billsIncluded.length > 0 && (
                            <div>
                                <p className="font-medium">Hostel Bills included:</p>
                                <p className="text-muted-foreground">{hostel.billsIncluded.join(', ')}.</p>
                            </div>
                        )}
                         {hostel.billsExcluded && hostel.billsExcluded.length > 0 && (
                            <div>
                                <p className="font-medium">Hostel Bills Excludes:</p>
                                <p className="text-muted-foreground">{hostel.billsExcluded.join(', ')}.</p>
                            </div>
                        )}
                    </div>
                    
                    <Separator />

                    <div className="space-y-4">
                         <h3 className="text-xl font-semibold font-headline flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-muted-foreground"/>Security & Safety</h3>
                         {hostel.securityAndSafety && hostel.securityAndSafety.length > 0 && (
                            <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                {hostel.securityAndSafety.map(item => <li key={item}>{item}</li>)}
                            </ul>
                        )}
                    </div>

                    <Separator />

                    <div>
                        <h3 className="text-xl font-semibold font-headline mb-4">Amenities</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

                    <Separator />
                    
                    <div>
                        <h3 className="text-xl font-semibold font-headline mb-4">Reviews ({hostel.numberOfReviews})</h3>
                        {hostel.reviews.length > 0 ? (
                            <div className="space-y-6">
                                {hostel.reviews.map(review => (
                                    <div key={review.id} className="flex gap-4">
                                         <Avatar>
                                            {review.userProfileImage ? (
                                              <AvatarImage src={review.userProfileImage} alt={review.studentName} />
                                            ) : (
                                              <AvatarFallback>{review.studentName.charAt(0)}</AvatarFallback>
                                            )}
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
            </div>
            <div className="flex flex-col order-1 lg:order-2">
                <Badge 
                    variant="outline"
                    className={cn("text-sm sm:text-base p-2 capitalize flex items-center gap-2 w-fit mb-4", currentAvailability.className)}
                >
                    {currentAvailability.icon} {currentAvailability.text}
                </Badge>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-headline">{hostel.name}</h1>
                <div className="flex items-center text-muted-foreground mt-2">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    <span className="text-sm sm:text-base">{hostel.location}</span>
                </div>
                <div className="flex items-center mt-4">
                    <div className="flex items-center text-yellow-500">
                        {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 ${i < Math.round(hostel.rating) ? 'fill-current' : ''}`} />
                        ))}
                    </div>
                    <span className="ml-2 sm:ml-3 text-sm sm:text-base lg:text-lg text-muted-foreground">({hostel.numberOfReviews} reviews)</span>
                </div>
                
                 <div className="mt-6 sm:mt-8 flex items-baseline gap-2">
                    {renderPrice()}
                    <span className="text-sm sm:text-base text-muted-foreground">/year</span>
                </div>

                {getPrimaryCTA()}

                <Card className="mt-6 sm:mt-8 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg sm:text-xl">Room Types & Pricing</CardTitle>
                        <CardDescription className="text-sm">Select a room to book a visit or secure it for the year.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs sm:text-sm">Room Type</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Availability</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Price/Year</TableHead>
                                        <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {hostel.roomTypes?.map((room) => (
                                    <TableRow key={room.id}>
                                        <TableCell>
                                            <p className="font-medium text-sm sm:text-base">{room.name}</p>
                                            <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground mt-1">
                                                {room.beds && <span className="flex items-center gap-1"><Bed className="h-3 w-3"/> {room.beds} Beds</span>}
                                                {room.bathrooms && <span className="flex items-center gap-1"><Bath className="h-3 w-3"/> {room.bathrooms}</span>}
                                            </div>

                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={getRoomAvailabilityVariant(room.availability)} className="text-xs">{room.availability}</Badge>
                                        </TableCell>
                                        <TableCell className="font-semibold text-sm sm:text-base">
                                            GH₵{room.price.toLocaleString()}
                                        </TableCell>
                                    <TableCell className="text-right">
                                        {getVisitButton(room)}
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}

function LimitedHostelDetails({ hostel }: { hostel: Hostel }) {
    const router = useRouter();
    const { toast } = useToast();
    
    const handleLoginRedirect = () => {
        toast({
            title: "Please Log In",
            description: "You need to be logged in as a student to secure a hostel.",
            variant: "default",
        });
        router.push('/login');
    };
    
    const renderPrice = () => {
        if (!hostel.priceRange || hostel.priceRange.min === 0) {
            return <span className="text-4xl font-bold text-destructive">GH₵{hostel.price?.toLocaleString() || 'N/A'}</span>
        }
        if (hostel.priceRange.min === hostel.priceRange.max) {
            return <span className="text-4xl font-bold text-destructive">GH₵{hostel.priceRange.min.toLocaleString()}</span>;
        }
        return (
            <span className="text-4xl font-bold text-destructive">
                GH₵{hostel.priceRange.min.toLocaleString()} - {hostel.priceRange.max.toLocaleString()}
            </span>
        );
    };

    return (
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div>
                 <Carousel className="w-full rounded-lg overflow-hidden shadow-lg">
                    <CarouselContent>
                        {hostel.images.map((img: string, index: number) => (
                            <CarouselItem key={index}>
                                <div className="relative h-96 w-full">
                                <Image src={img} alt={`${hostel.name} image ${index + 1}`} fill style={{ objectFit: 'cover' }} data-ai-hint="hostel exterior" />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-4"/>
                    <CarouselNext className="right-4"/>
                </Carousel>
                <div className="mt-8">
                    <h3 className="text-xl font-semibold font-headline mb-4">Description</h3>
                    <p className="mt-2 text-foreground/80 leading-relaxed line-clamp-5">{hostel.description}</p>
                </div>
            </div>
            <div className="flex flex-col">
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
                    <span className="ml-3 text-lg text-muted-foreground">({hostel.numberOfReviews} reviews)</span>
                </div>

                <div className="mt-8">
                    <h3 className="text-lg font-semibold font-headline mb-3">Amenities</h3>
                    <div className="flex flex-wrap gap-3">
                        {hostel.amenities.slice(0, 4).map((amenity: string) => (
                            <Badge key={amenity} variant="outline" className="text-sm p-2 flex items-center gap-2">
                                {amenityIcons[amenity.toLowerCase().replace(' ', '-')] || <div className="h-5 w-5" />}
                                <span className="font-medium capitalize">{amenity}</span>
                            </Badge>
                        ))}
                    </div>
                </div>
                
                <div className="mt-8 flex items-baseline gap-2">
                    {renderPrice()}
                    <span className="text-base text-muted-foreground">/year</span>
                </div>

                <Button size="lg" className="w-full mt-6 bg-yellow-500 hover:bg-yellow-600 text-yellow-950 text-lg h-14" onClick={handleLoginRedirect}>
                    Apply to Secure Hostel
                </Button>

                <Card className="mt-8 bg-muted/30">
                    <CardHeader>
                        <CardTitle className="flex items-center"><Lock className="mr-2 h-5 w-5 text-muted-foreground"/> Log in for full details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            Create a free student account to see all photos, room types, and book a visit.
                        </p>
                    </CardContent>
                </Card>
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
                    role: userData.role,
                    profileImage: userData.profileImage, // Fetch profile image
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
                        role: userData.role,
                        profileImage: userData.profileImage, // Fetch profile image
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
