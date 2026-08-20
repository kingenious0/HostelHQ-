
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/header';
import { getHostel, Hostel, RoomType, Review } from '@/lib/data';
import { notFound, useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { Wifi, ParkingSquare, Utensils, Droplets, Snowflake, Dumbbell, Star, MapPin, BookOpen, Lock, DoorOpen, Clock, Bed, Bath, User, ShieldCheck, Ticket, FileText, Share2, MessageCircle, Twitter, Facebook, Copy, Check, ArrowRight, Users as UsersIcon, Smartphone, CreditCard, CheckCircle2, ChevronDown, ChevronUp, Eye, X } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

function HostelDetailPageContent({ hostel, currentUser }: { hostel: Hostel, currentUser: AppUser | null }) {
    const router = useRouter();
    const { toast } = useToast();
    const currentAvailability = availabilityInfo[hostel.availability || 'Full'];
    const [existingVisit, setExistingVisit] = useState<Visit | null | undefined>(undefined);
    const [existingBooking, setExistingBooking] = useState<ExistingBooking | null | undefined>(undefined);
    const [shareUrl, setShareUrl] = useState('');
    const [shareCopied, setShareCopied] = useState(false);
    const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
    const [descriptionExpanded, setDescriptionExpanded] = useState(false);
    const [selectedRating, setSelectedRating] = useState('5');
    const [draftReview, setDraftReview] = useState('');

    // Extract city and region from location
    const locationParts = hostel.location?.split(',').map(s => s.trim()) || [];
    const city = locationParts[0] || hostel.location || '';
    const region = locationParts[1] || '';

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setShareUrl(window.location.href);
        }
    }, []);

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
                where('status', 'in', ['confirmed', 'pending'])
            );
            const bookingsSnapshot = await getDocs(bookingsQuery);
            if (!bookingsSnapshot.empty) {
                const booking = bookingsSnapshot.docs[0];
                setExistingBooking({
                    id: booking.id,
                    status: booking.data().status,
                    roomTypeId: booking.data().roomTypeId,
                });
            } else {
                setExistingBooking(null);
            }
        };

        const checkExistingVisit = async () => {
            const visitsQuery = query(
                collection(db, 'visits'),
                where('studentId', '==', currentUser.uid),
                where('hostelId', '==', hostel.id),
                orderBy('createdAt', 'desc'),
                limit(1)
            );
            const visitsSnapshot = await getDocs(visitsQuery);
            if (!visitsSnapshot.empty) {
                const visit = visitsSnapshot.docs[0];
                setExistingVisit({
                    id: visit.id,
                    status: visit.data().status,
                    studentCompleted: visit.data().studentCompleted,
                });
            } else {
                setExistingVisit(null);
            }
        };

        checkExistingBooking();
        checkExistingVisit();
    }, [currentUser, hostel.id]);

    const reviewStats = useMemo(() => {
        const reviews = (hostel.reviews as Review[]) || [];
        const breakdown = [5, 4, 3, 2, 1].map(star => {
            const count = reviews.filter(r => r.rating === star).length;
            const total = reviews.length || 1;
            return {
                star,
                count,
                percentage: Math.round((count / total) * 100),
            };
        });
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        const total = reviews.length;
        return {
            total,
            average: total > 0 ? sum / total : 0,
            breakdown,
        };
    }, [hostel.reviews, hostel.rating, hostel.numberOfReviews]);

    const reviewAverage = reviewStats.total > 0 ? reviewStats.average : hostel.rating || 0;
    const totalReviews = reviewStats.total > 0 ? reviewStats.total : hostel.numberOfReviews || 0;
    const roundedAverage = Math.round(reviewAverage);

    const primaryImages = hostel.images?.length ? hostel.images : ['/placeholder.jpg'];

    type SharePlatform = 'whatsapp' | 'twitter' | 'facebook' | 'copy';

    const handleShare = (platform: SharePlatform) => {
        if (!shareUrl) return;
        const encodedUrl = encodeURIComponent(shareUrl);
        const message = encodeURIComponent(`Check out ${hostel.name} on HostelHQ`);

        if (platform === 'copy') {
            if (typeof navigator !== 'undefined' && navigator?.clipboard) {
                navigator.clipboard
                    .writeText(shareUrl)
                    .then(() => setShareCopied(true))
                    .catch(() => toast({ title: 'Unable to copy link', variant: 'destructive' }));
            }
            return;
        }

        let url = '';
        switch (platform) {
            case 'whatsapp':
                url = `https://wa.me/?text=${message}%20${encodedUrl}`;
                break;
            case 'twitter':
                url = `https://twitter.com/intent/tweet?text=${message}&url=${encodedUrl}`;
                break;
            case 'facebook':
                url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
                break;
        }

        if (url && typeof window !== 'undefined') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const handleReviewCTA = () => {
        if (currentUser) {
            router.push(`/hostels/${hostel.id}/book/rating`);
        } else {
            router.push('/login?redirect=' + encodeURIComponent(`/hostels/${hostel.id}/book/rating`));
        }
    };

    const handleViewAllRooms = () => {
        router.push(`/hostels/${hostel.id}/rooms`);
    };

    const getRoomAvailabilityVariant = (availability: RoomType['availability']) => {
        switch(availability) {
            case 'Available': return 'default';
            case 'Limited': return 'secondary';
            case 'Full': return 'destructive';
            default: return 'outline';
        }
    }

    // Get payment methods from hostel data or default
    const paymentMethods = (hostel as any).paymentMethods || ['Mobile Money', 'Visa & Mastercard', 'Bank Transfer'];
    const services = (hostel as any).services || ['24/7 Support', 'Room Cleaning', 'Maintenance'];

    // Get lowest price
    const lowestPrice = hostel.priceRange?.min || hostel.price || 0;

    return (
        <div className="space-y-8">
            {/* 1. Visual and Contextual Overview Section */}
            <section>
                <div className="relative h-[400px] sm:h-[500px] lg:h-[600px] w-full overflow-hidden rounded-2xl bg-slate-100">
                    <Carousel className="w-full h-full" autoPlay autoPlayInterval={4500}>
                        <CarouselContent className="h-full">
                            {primaryImages.map((img: string, index: number) => (
                                <CarouselItem key={index} className="h-full">
                                    <div className="relative h-full w-full">
                                        <Image
                                            src={img}
                                            alt={`${hostel.name} image ${index + 1}`}
                                            fill
                                            className="object-cover"
                                            priority={index === 0}
                                        />
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        <CarouselPrevious className="left-4 hidden md:flex" />
                        <CarouselNext className="right-4 hidden md:flex" />
                    </Carousel>
                    <div className="absolute bottom-4 right-4">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white/90 backdrop-blur-sm hover:bg-white"
                            onClick={() => setGalleryDialogOpen(true)}
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            View all
                        </Button>
                    </div>
                </div>

                <div className="mt-6">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-headline text-slate-900">{hostel.name}</h1>
                    <div className="flex items-center text-slate-600 mt-2">
                        <MapPin className="h-5 w-5 mr-2" />
                        <span className="text-lg">{city}{region && `, ${region}`}</span>
                    </div>
                </div>
            </section>

            <div className="grid lg:grid-cols-[1fr_400px] gap-8">
                {/* Main Content */}
                <div className="space-y-8">
                    {/* 2. Core Information & Description Section */}
                    <section>
                        <h2 className="text-2xl font-bold font-headline mb-4">About This Hostel</h2>
                        <div className="space-y-4">
                            <p className={cn(
                                "text-slate-700 leading-relaxed",
                                !descriptionExpanded && "line-clamp-4"
                            )}>
                                {hostel.description || 'No description available.'}
                            </p>
                            {hostel.description && hostel.description.length > 200 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                                    className="text-primary"
                                >
                                    {descriptionExpanded ? (
                                        <>
                                            <ChevronUp className="h-4 w-4 mr-1" />
                                            See less
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="h-4 w-4 mr-1" />
                                            See more
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>

                        {/* Key Highlights */}
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {hostel.securityAndSafety?.slice(0, 4).map((feature, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                                    <ShieldCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                    <span className="text-sm font-medium text-slate-700">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 3. Amenity and Service Features Section */}
                    <section>
                        <div className="space-y-6">
                            {/* Amenities */}
                            <div>
                                <h3 className="text-xl font-bold font-headline mb-4">Amenities</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {hostel.amenities.map((amenity: string) => (
                                        <div key={amenity} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                                            <div className="flex-shrink-0 text-primary">
                                                {amenityIcons[amenity.toLowerCase().replace(' ', '-')] || <CheckCircle2 className="h-5 w-5" />}
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 capitalize">{amenity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            {/* Services */}
                            <div>
                                <h3 className="text-xl font-bold font-headline mb-4">Services</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {services.map((service: string) => (
                                        <div key={service} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                            <span className="text-sm font-medium text-slate-700">{service}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            {/* Payment Methods */}
                            <div>
                                <h3 className="text-xl font-bold font-headline mb-4">Payment Methods</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {paymentMethods.map((method: string) => (
                                        <div key={method} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                            <span className="text-sm font-medium text-slate-700">{method}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 5. Customer Review Section */}
                    <section>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold font-headline">Customer Reviews</h2>
                                    <p className="text-sm text-slate-600 mt-1">Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}</p>
                                </div>
                            </div>

                            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
                                {/* Rating Summary */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-3xl font-bold">
                                            {reviewAverage.toFixed(1)}
                                        </CardTitle>
                                        <div className="flex items-center gap-1 text-yellow-400 mt-2">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className={cn(
                                                        "h-5 w-5",
                                                        i < roundedAverage ? 'fill-current text-current' : 'text-slate-300'
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {/* Star Distribution */}
                                        <div className="space-y-3">
                                            {reviewStats.breakdown.map((row) => (
                                                <div key={row.star} className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1 text-sm font-medium text-slate-600 min-w-[60px]">
                                                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                        {row.star}
                                                    </div>
                                                    <Progress value={row.percentage} className="h-2 flex-1" />
                                                    <span className="w-12 text-right text-xs text-slate-600">{row.percentage}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Review Form */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Share Your Experience</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <Select value={selectedRating} onValueChange={setSelectedRating}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select rating" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[5,4,3,2,1].map(value => (
                                                    <SelectItem key={value} value={value.toString()}>
                                                        {value} Star{value === 1 ? '' : 's'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Textarea
                                            value={draftReview}
                                            onChange={(e) => setDraftReview(e.target.value)}
                                            placeholder="Share your experience staying here..."
                                            className="min-h-[100px]"
                                        />
                                        <Button onClick={handleReviewCTA} className="w-full">
                                            {currentUser ? 'Post Review' : 'Login to post review'}
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Review List */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Latest Reviews</h3>
                                {hostel.reviews && (hostel.reviews as Review[]).length > 0 ? (
                                    <div className="space-y-4">
                                        {(hostel.reviews as Review[]).map((review) => (
                                            <div key={review.id} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
                                                <Avatar>
                                                    {review.userProfileImage ? (
                                                        <AvatarImage src={review.userProfileImage} alt={review.studentName} />
                                                    ) : (
                                                        <AvatarFallback>{review.studentName.charAt(0)}</AvatarFallback>
                                                    )}
                                                </Avatar>
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-semibold">{review.studentName}</p>
                                                        <span className="text-xs text-slate-500">
                                                            {format(new Date(review.createdAt), 'PP')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star
                                                                key={`${review.id}-${i}`}
                                                                className={cn(
                                                                    "h-4 w-4",
                                                                    i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'
                                                                )}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="text-sm leading-relaxed text-slate-700">{review.comment}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-600">
                                        No reviews yet. Be the first to share your experience staying at {hostel.name}.
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>
                </div>

                {/* 4. Pricing and Call-to-Action (Sidebar) */}
                <aside className="lg:sticky lg:top-24 h-fit">
                    <Card className="border-2 border-primary/20 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold text-primary">Price starts at</CardTitle>
                            <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-4xl font-bold text-primary">
                                    GH₵{lowestPrice.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-yellow-400 mt-2">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={`sidebar-rating-${i}`}
                                        className={cn(
                                            "h-4 w-4",
                                            i < roundedAverage ? 'fill-current text-current' : 'text-slate-300'
                                        )}
                                    />
                                ))}
                                <span className="ml-2 text-sm text-slate-600">{reviewAverage.toFixed(1)} / 5.0</span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button
                                size="lg"
                                className="w-full bg-primary text-white hover:bg-primary/90"
                                onClick={handleViewAllRooms}
                            >
                                View all Room Options
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                            <div className="text-xs text-slate-500 text-center">
                                All information is publicly available. Login required for booking.
                            </div>
                        </CardContent>
                    </Card>
                </aside>
            </div>

            {/* Gallery Dialog */}
            <Dialog open={galleryDialogOpen} onOpenChange={setGalleryDialogOpen}>
                <DialogContent className="max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>All Photos</DialogTitle>
                        <DialogDescription>Browse all images of {hostel.name}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh]">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {primaryImages.map((img, index) => (
                                <div key={index} className="relative h-48 rounded-lg overflow-hidden">
                                    <Image
                                        src={img}
                                        alt={`${hostel.name} photo ${index + 1}`}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

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
                    profileImage: userData.profileImage,
                });
            } else {
                const pendingUserDocRef = doc(db, "pendingUsers", user.uid);
                const pendingUserDocSnap = await getDoc(pendingUserDocRef);
                if (pendingUserDocSnap.exists()) {
                    const userData = pendingUserDocSnap.data();
                     setAppUser({
                        uid: user.uid,
                        email: user.email!,
                        fullName: userData.fullName,
                        role: userData.role,
                        profileImage: userData.profileImage,
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

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-12">
        <HostelDetailPageContent hostel={hostel} currentUser={appUser} />
      </main>
    </div>
  );
}

