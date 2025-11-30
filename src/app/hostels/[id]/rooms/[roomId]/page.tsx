"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import Image from "next/image";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, MapPin, Users, Bed, ShieldCheck, ArrowLeft, 
  Wifi, Car, Utensils, Tv, Wind, Droplets, Zap, Shield,
  Home, Bath, Coffee, Gamepad2, Dumbbell, Waves,
  CheckCircle, Star, Phone, Mail, Clock, Calendar
} from "lucide-react";
import { getHostel, Hostel, RoomType } from "@/lib/data";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AppUser {
  uid: string;
  email: string;
  fullName: string;
  role: "student" | "agent" | "admin";
  profileImage?: string;
}

interface RoomInventoryItem {
  id: string;
  label: string;
  type: string;
  price: number;
  occupancy: number;
  capacity: number | null;
  gender: string;
  image: string;
  totalRooms?: number | null;
  amenities?: string[];
}

// Amenity categories with icons
const AMENITY_CATEGORIES = {
  'Essential': {
    icon: Home,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'Comfort': {
    icon: Wind,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'Entertainment': {
    icon: Tv,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  },
  'Utilities': {
    icon: Zap,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  'Security': {
    icon: Shield,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'Recreation': {
    icon: Gamepad2,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200'
  }
};

// Amenity mapping with icons and categories
const AMENITY_MAPPING: Record<string, { icon: any; category: keyof typeof AMENITY_CATEGORIES; label: string }> = {
  'wifi': { icon: Wifi, category: 'Essential', label: 'Wi-Fi Internet' },
  'internet': { icon: Wifi, category: 'Essential', label: 'Internet Access' },
  'parking': { icon: Car, category: 'Essential', label: 'Parking Space' },
  'kitchen': { icon: Utensils, category: 'Essential', label: 'Shared Kitchen' },
  'private kitchen': { icon: Utensils, category: 'Comfort', label: 'Private Kitchen' },
  'tv': { icon: Tv, category: 'Entertainment', label: 'Television' },
  'tv room': { icon: Tv, category: 'Entertainment', label: 'TV Room' },
  'air conditioning': { icon: Wind, category: 'Comfort', label: 'Air Conditioning' },
  'ac': { icon: Wind, category: 'Comfort', label: 'Air Conditioning' },
  'fan': { icon: Wind, category: 'Comfort', label: 'Ceiling Fan' },
  'water': { icon: Droplets, category: 'Essential', label: 'Water Supply' },
  'hot water': { icon: Droplets, category: 'Comfort', label: 'Hot Water' },
  'electricity': { icon: Zap, category: 'Utilities', label: 'Electricity' },
  'power': { icon: Zap, category: 'Utilities', label: 'Power Supply' },
  'security': { icon: Shield, category: 'Security', label: 'Security System' },
  'cctv': { icon: Shield, category: 'Security', label: 'CCTV Surveillance' },
  'balcony': { icon: Home, category: 'Comfort', label: 'Private Balcony' },
  'balconies': { icon: Home, category: 'Comfort', label: 'Balconies' },
  'bathroom': { icon: Bath, category: 'Essential', label: 'Private Bathroom' },
  'washroom': { icon: Bath, category: 'Essential', label: 'Private Washroom' },
  'shared bathroom': { icon: Bath, category: 'Essential', label: 'Shared Bathroom' },
  'laundry': { icon: Droplets, category: 'Essential', label: 'Laundry Service' },
  'gym': { icon: Dumbbell, category: 'Recreation', label: 'Gym/Fitness' },
  'fitness': { icon: Dumbbell, category: 'Recreation', label: 'Fitness Center' },
  'pool': { icon: Waves, category: 'Recreation', label: 'Swimming Pool' },
  'swimming pool': { icon: Waves, category: 'Recreation', label: 'Swimming Pool' },
  'games': { icon: Gamepad2, category: 'Entertainment', label: 'Game Room' },
  'study room': { icon: Coffee, category: 'Essential', label: 'Study Room' },
  'library': { icon: Coffee, category: 'Essential', label: 'Library' },
  'comfortable': { icon: Home, category: 'Comfort', label: 'Comfortable Living' },
  'furnished': { icon: Home, category: 'Comfort', label: 'Fully Furnished' }
};

function getAmenityInfo(amenity: string) {
  const normalized = amenity.toLowerCase().trim();
  const found = AMENITY_MAPPING[normalized];
  if (found) return found;
  
  // Fallback for unmapped amenities
  return {
    icon: CheckCircle,
    category: 'Essential' as keyof typeof AMENITY_CATEGORIES,
    label: amenity
  };
}

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const hostelId = Array.isArray(params.id) ? params.id[0] : (params.id as string | undefined);
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : (params.roomId as string | undefined);

  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [hasCompletedVisit, setHasCompletedVisit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasSecuredHostel, setHasSecuredHostel] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!hostelId || !roomId) {
        notFound();
        return;
      }

      const data = await getHostel(hostelId);
      if (!data) {
        notFound();
        return;
      }
      setHostel(data);
      setLoading(false);
    };

    fetch();

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const d = snap.data() as any;
          setAppUser({
            uid: user.uid,
            email: user.email || "",
            fullName: d.fullName,
            role: d.role,
            profileImage: d.profileImage,
          });
        }
        if (hostelId) {
          try {
            const visitsQuery = query(
              collection(db, "visits"),
              where("studentId", "==", user.uid),
              where("hostelId", "==", hostelId)
            );
            const visitsSnapshot = await getDocs(visitsQuery);
            if (!visitsSnapshot.empty) {
              const hasCompleted = visitsSnapshot.docs.some((docSnap) => {
                const data = docSnap.data() as any;
                return data.status === "completed" && data.studentCompleted === true;
              });
              setHasCompletedVisit(hasCompleted);
            } else {
              setHasCompletedVisit(false);
            }
          } catch (e) {
            console.error("Error checking completed visit for room detail page:", e);
            setHasCompletedVisit(false);
          }

          // Check if this student already has a confirmed/secured booking in this hostel
          try {
            const bookingsQuery = query(
              collection(db, 'bookings'),
              where('studentId', '==', user.uid),
              where('hostelId', '==', hostelId),
              where('status', '==', 'confirmed')
            );
            const bookingsSnapshot = await getDocs(bookingsQuery);
            setHasSecuredHostel(!bookingsSnapshot.empty);
          } catch (error) {
            console.error('Error checking secured booking for room detail page:', error);
            setHasSecuredHostel(false);
          }
        }
      } else {
        setAppUser(null);
        setHasCompletedVisit(false);
        setHasSecuredHostel(false);
      }
    });

    return () => unsub();
  }, [hostelId, roomId]);

  const primaryImages = hostel?.images?.length ? hostel.images : ["/placeholder.jpg"];

  const room: RoomInventoryItem | null = useMemo(() => {
    if (!hostel || !roomId) return null;

    const parseCapacity = (value?: string | null): number | null => {
      if (!value) return null;
      const match = value.match(/\d+/);
      if (!match) return null;
      const parsed = parseInt(match[0], 10);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const rooms = (hostel as any)?.rooms;

    const formatLabel = (raw: any, index: number) => {
      const value = String(raw ?? '').trim();
      if (!value) return `Room ${index + 1}`;
      if (value.toLowerCase().startsWith('room ')) return value;
      return `Room ${value}`;
    };
    if (Array.isArray(rooms) && rooms.length > 0) {
      const found = rooms.find((r: any, index: number) => {
        const fallbackId = r.id ?? `room-${index}`;
        return String(fallbackId) === String(roomId);
      });
      if (found) {
        const index = rooms.indexOf(found);
        const capacity = found.capacity ?? parseCapacity(found.roomType ?? found.type);
        return {
          id: found.id ?? `room-${index}`,
          label: formatLabel(found.roomNumber ?? found.number ?? found.name, index),
          type: found.roomType ?? found.type ?? hostel.roomTypes?.[0]?.name ?? "Room",
          price: found.price ?? hostel.priceRange?.min ?? 0,
          occupancy: found.currentOccupancy ?? found.occupancy ?? found.occupants ?? 0,
          capacity: capacity ?? null,
          gender: found.gender ?? found.genderTag ?? (hostel.gender || "Mixed"),
          image: found.image ?? found.imageUrl ?? primaryImages[index % primaryImages.length],
        };
      }
    }

    const types = hostel.roomTypes ?? [];
    const byId = types.find((t) => String(t.id ?? "") === String(roomId));
    if (byId) {
      const idx = types.indexOf(byId);
      const capacity = byId.capacity ?? parseCapacity(byId.name);
      return {
        id: byId.id ?? `roomType-${idx}`,
        label: byId.name,
        type: byId.name,
        price: byId.price,
        occupancy: byId.occupancy ?? 0,
        capacity,
        gender: hostel.gender || "Mixed",
        image: primaryImages[idx % primaryImages.length],
        totalRooms: (byId as any).numberOfRooms ?? null,
        amenities: byId.roomAmenities ?? [],
      };
    }

    return null;
  }, [hostel, roomId, primaryImages]);

  // Group amenities by category - moved before early returns to fix hooks order
  const groupedAmenities = useMemo(() => {
    if (!room?.amenities || room.amenities.length === 0) return {};
    
    const groups: Record<string, Array<{ amenity: string; info: ReturnType<typeof getAmenityInfo> }>> = {};
    
    room.amenities.forEach(amenity => {
      const info = getAmenityInfo(amenity);
      if (!groups[info.category]) {
        groups[info.category] = [];
      }
      groups[info.category].push({ amenity, info });
    });
    
    return groups;
  }, [room?.amenities]);

  if (!hostelId || !roomId) {
    notFound();
  }

  if (loading || !hostel || !room) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  const handlePrimaryAction = () => {
    if (hostel.availability === 'Full' || hasSecuredHostel) {
      return;
    }
    const baseTarget = hasCompletedVisit
      ? `/hostels/${hostelId}/secure?roomTypeId=${room.id}`
      : `/hostels/${hostelId}/book?roomTypeId=${room.id}`;

    if (appUser) {
      router.push(baseTarget);
    } else {
      router.push(`/login?redirect=${encodeURIComponent(baseTarget)}`);
      toast({
        title: "Login Required",
        description: hasCompletedVisit
          ? "Please log in to secure this room."
          : "Please log in to book a visit for this room.",
      });
    }
  };

  const remainingInfo = (() => {
    if (!room.capacity || !room.totalRooms) return null;
    const totalSlots = room.capacity * room.totalRooms;
    const used = Math.max(0, Math.min(totalSlots, room.occupancy));
    const remainingSlots = Math.max(0, totalSlots - used);
    const remainingRooms = Math.round(remainingSlots / room.capacity);
    const totalRooms = room.totalRooms;
    return `${remainingRooms} of ${totalRooms} ${totalRooms === 1 ? 'room' : 'rooms'} available`;
  })();


  // Get availability status
  const getAvailabilityStatus = () => {
    if (!room.capacity || !room.totalRooms) return null;
    const totalSlots = room.capacity * room.totalRooms;
    const used = Math.max(0, Math.min(totalSlots, room.occupancy));
    const remainingSlots = Math.max(0, totalSlots - used);
    const occupancyRate = (used / totalSlots) * 100;
    
    if (occupancyRate >= 100) return { status: 'full', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (occupancyRate >= 80) return { status: 'limited', color: 'text-orange-600', bgColor: 'bg-orange-50' };
    return { status: 'available', color: 'text-green-600', bgColor: 'bg-green-50' };
  };

  const availabilityStatus = getAvailabilityStatus();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      <Header />
      <main className="flex-1 px-4 py-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to rooms
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Hero Image & Basic Info */}
              <Card className="overflow-hidden shadow-lg border-0 bg-white">
                <div className="relative h-64 md:h-80 w-full">
                  <Image
                    src={room.image}
                    alt={room.label}
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <Badge className="mb-2 bg-white/20 backdrop-blur-sm text-white border-white/30">
                          {hostel.name}
                        </Badge>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">
                          {room.label}
                        </h1>
                        <p className="text-white/90 text-sm">
                          {room.type} • {hostel.location}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-white">
                          GH₵{room.price.toLocaleString()}
                        </div>
                        <div className="text-white/80 text-sm">per year</div>
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className="absolute top-4 right-4 bg-white/90 text-gray-900"
                  >
                    {room.gender === "Male" ? "♂ Male" : room.gender === "Female" ? "♀ Female" : "⚥ Mixed"} room
                  </Badge>
                </div>
              </Card>

              {/* Room Details */}
              <Card className="shadow-lg border-0 bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-primary" />
                    Room Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {room.capacity && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                        <Bed className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-semibold text-blue-900">{room.capacity}</div>
                          <div className="text-xs text-blue-700">Beds per room</div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                      <Users className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="font-semibold text-green-900">{room.occupancy}</div>
                        <div className="text-xs text-green-700">Current occupants</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                      <MapPin className="h-5 w-5 text-purple-600" />
                      <div>
                        <div className="font-semibold text-purple-900 text-xs">{hostel.location.split(',')[0]}</div>
                        <div className="text-xs text-purple-700">Location</div>
                      </div>
                    </div>
                    {availabilityStatus && (
                      <div className={cn("flex items-center gap-2 p-3 rounded-lg", availabilityStatus.bgColor)}>
                        <CheckCircle className={cn("h-5 w-5", availabilityStatus.color)} />
                        <div>
                          <div className={cn("font-semibold text-xs capitalize", availabilityStatus.color)}>
                            {availabilityStatus.status}
                          </div>
                          <div className={cn("text-xs", availabilityStatus.color)}>Status</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {remainingInfo && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">{remainingInfo}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Amenities Section */}
              {Object.keys(groupedAmenities).length > 0 && (
                <Card className="shadow-lg border-0 bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-primary" />
                      Room Amenities & Features
                    </CardTitle>
                    <CardDescription>
                      Everything included in this room to make your stay comfortable
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {Object.entries(groupedAmenities).map(([category, amenities]) => {
                      const categoryInfo = AMENITY_CATEGORIES[category as keyof typeof AMENITY_CATEGORIES];
                      const CategoryIcon = categoryInfo.icon;
                      
                      return (
                        <div key={category}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              categoryInfo.bgColor,
                              categoryInfo.borderColor,
                              "border"
                            )}>
                              <CategoryIcon className={cn("h-4 w-4", categoryInfo.color)} />
                            </div>
                            <h4 className="font-semibold text-gray-900">{category}</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-6">
                            {amenities.map(({ amenity, info }) => {
                              const AmenityIcon = info.icon;
                              return (
                                <div key={amenity} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                  <AmenityIcon className={cn("h-4 w-4", categoryInfo.color)} />
                                  <span className="text-sm font-medium text-gray-700">{info.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Booking Card */}
              <Card className="shadow-lg border-0 bg-white sticky top-6">
                <CardHeader>
                  <CardTitle className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      GH₵{room.price.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">per academic year</div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    className="w-full h-12 text-base font-semibold"
                    onClick={handlePrimaryAction}
                    disabled={hostel.availability === 'Full' || hasSecuredHostel}
                  >
                    {hostel.availability === 'Full' ? (
                      <>
                        <ShieldCheck className="h-5 w-5 mr-2" />
                        Hostel Fully Booked
                      </>
                    ) : hasSecuredHostel ? (
                      <>
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Already Secured
                      </>
                    ) : hasCompletedVisit ? (
                      <>
                        <ShieldCheck className="h-5 w-5 mr-2" />
                        Secure This Room
                      </>
                    ) : (
                      <>
                        <Calendar className="h-5 w-5 mr-2" />
                        Book a Visit
                      </>
                    )}
                  </Button>
                  
                  <div className="text-center text-xs text-muted-foreground">
                    {hasCompletedVisit 
                      ? "Complete your room booking with secure payment"
                      : "Schedule a visit to see this room first"}
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room type:</span>
                      <span className="font-medium">{room.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gender:</span>
                      <span className="font-medium">{room.gender}</span>
                    </div>
                    {room.capacity && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span className="font-medium">{room.capacity} students</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Contact Card */}
              <Card className="shadow-lg border-0 bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">Need Help?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <Phone className="h-4 w-4 mr-2" />
                    Call Support
                  </Button>
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
