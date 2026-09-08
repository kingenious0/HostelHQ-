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
  CheckCircle, Star, Phone, Mail, Clock, Calendar, Eye,
  Camera, Film, Video, Play, DoorOpen, Lock, AlertTriangle, Ban
} from "lucide-react";
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import { getHostel, Hostel, RoomType } from "@/lib/data";
import { isHostelSoldOut, isRoomTypeSoldOut } from "@/lib/room-capacity";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SanctionBanner } from "@/components/hostels/SanctionBanner";
import { isHostelRevoked, isHostelSanctioned, isHostelRestricted, SANCTION_MESSAGES } from "@/lib/sanctions";

interface AppUser {
  uid: string;
  email: string;
  fullName: string;
  role: "student" | "hostel_manager" | "admin";
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
  images?: string[];
  videos?: string[];
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
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200'
  },
  'Entertainment': {
    icon: Tv,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  },
  'Utilities': {
    icon: Zap,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200'
  },
  'Security': {
    icon: Shield,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200'
  },
  'Recreation': {
    icon: Gamepad2,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200'
  }
};

// Comprehensive Amenity mapping with icons and categories for room types
const AMENITY_MAPPING: Record<string, { icon: any; category: keyof typeof AMENITY_CATEGORIES; label: string }> = {
  'wifi': { icon: Wifi, category: 'Essential', label: 'Wi-Fi Internet' },
  'internet': { icon: Wifi, category: 'Essential', label: 'High-Speed Internet Access' },
  'parking': { icon: Car, category: 'Essential', label: 'Parking Space' },
  'kitchen': { icon: Utensils, category: 'Essential', label: 'Shared Kitchen Facility' },
  'shared kitchen': { icon: Utensils, category: 'Essential', label: 'Shared Kitchen Facility' },
  'private kitchen': { icon: Utensils, category: 'Comfort', label: 'Private In-Room Kitchenette' },
  'tv': { icon: Tv, category: 'Entertainment', label: 'Television Set' },
  'tv room': { icon: Tv, category: 'Entertainment', label: 'TV & Common Lounge' },
  'air conditioning': { icon: Wind, category: 'Comfort', label: 'Air Conditioning (AC)' },
  'ac': { icon: Wind, category: 'Comfort', label: 'Air Conditioning (AC)' },
  'fan': { icon: Wind, category: 'Comfort', label: 'Ceiling Fan' },
  'ceiling fan': { icon: Wind, category: 'Comfort', label: 'Ceiling Fan' },
  'water': { icon: Droplets, category: 'Utilities', label: 'Continuous Water Supply' },
  'hot water': { icon: Droplets, category: 'Comfort', label: 'Hot Water Heater' },
  'electricity': { icon: Zap, category: 'Utilities', label: 'Prepaid Meter Electricity' },
  'power': { icon: Zap, category: 'Utilities', label: 'Reliable Power Supply' },
  'security': { icon: Shield, category: 'Security', label: 'Security Guard & Protection' },
  'cctv': { icon: Shield, category: 'Security', label: 'CCTV Corridor Surveillance' },
  'security alarm': { icon: Shield, category: 'Security', label: 'Security Alarm System' },
  'controlled access gate': { icon: Shield, category: 'Security', label: 'Controlled Access Gate' },
  'controlled access gate (24-hour)': { icon: Shield, category: 'Security', label: '24-Hour Controlled Access Gate' },
  'entire building fenced': { icon: Shield, category: 'Security', label: 'Entire Building Securely Fenced' },
  'maintenance team (24-hour on call)': { icon: Shield, category: 'Security', label: '24-Hour Maintenance Team on Call' },
  'balcony': { icon: Home, category: 'Comfort', label: 'Private Balcony' },
  'balconies': { icon: Home, category: 'Comfort', label: 'Private Balcony' },
  'bathroom': { icon: Bath, category: 'Essential', label: 'Private Bathroom' },
  'washroom': { icon: Bath, category: 'Essential', label: 'Private Washroom' },
  'private washroom': { icon: Bath, category: 'Essential', label: 'Private In-Room Washroom' },
  'shared bathroom': { icon: Bath, category: 'Essential', label: 'Shared Corridor Washroom' },
  'shared washroom': { icon: Bath, category: 'Essential', label: 'Shared Clean Washroom' },
  'mattress': { icon: Bed, category: 'Essential', label: 'Comfortable Student Mattress' },
  'bed': { icon: Bed, category: 'Essential', label: 'Single Student Bed' },
  'single bed': { icon: Bed, category: 'Essential', label: 'Single Student Bed' },
  'wardrobe': { icon: Home, category: 'Comfort', label: 'Clothes Wardrobe / Closet' },
  'furniture (table, chair)': { icon: Coffee, category: 'Comfort', label: 'Study Table & Ergonomic Chair' },
  'furniture': { icon: Coffee, category: 'Comfort', label: 'Study Table & Chair' },
  'table': { icon: Coffee, category: 'Comfort', label: 'Study Table' },
  'desk': { icon: Coffee, category: 'Comfort', label: 'Study Desk' },
  'laundry': { icon: Droplets, category: 'Essential', label: 'Laundry Space / Facilities' },
  'gym': { icon: Dumbbell, category: 'Recreation', label: 'Gym & Fitness Equipment' },
  'fitness': { icon: Dumbbell, category: 'Recreation', label: 'Fitness Center' },
  'pool': { icon: Waves, category: 'Recreation', label: 'Swimming Pool' },
  'swimming pool': { icon: Waves, category: 'Recreation', label: 'Swimming Pool' },
  'games': { icon: Gamepad2, category: 'Entertainment', label: 'Recreational Game Room' },
  'study room': { icon: Coffee, category: 'Essential', label: 'Quiet Study Room' },
  'library': { icon: Coffee, category: 'Essential', label: 'Quiet Reading Library' },
  'comfortable': { icon: Home, category: 'Comfort', label: 'Spacious & Comfortable Living' },
  'furnished': { icon: Home, category: 'Comfort', label: 'Fully Furnished Room' },
  'refuse': { icon: Droplets, category: 'Utilities', label: 'Refuse & Sanitation Disposal' }
};

function getAmenityInfo(amenity: string) {
  const normalized = amenity.toLowerCase().trim();
  const found = AMENITY_MAPPING[normalized];
  if (found) return found;
  
  // Fuzzy checks for common keywords
  if (normalized.includes('washroom') || normalized.includes('bath') || normalized.includes('toilet')) {
    return {
      icon: Bath,
      category: 'Essential' as keyof typeof AMENITY_CATEGORIES,
      label: amenity
    };
  }
  if (normalized.includes('bed') || normalized.includes('mattress')) {
    return {
      icon: Bed,
      category: 'Essential' as keyof typeof AMENITY_CATEGORIES,
      label: amenity
    };
  }
  if (normalized.includes('fan') || normalized.includes('ac') || normalized.includes('conditioning') || normalized.includes('balcony') || normalized.includes('wardrobe') || normalized.includes('chair') || normalized.includes('table') || normalized.includes('desk')) {
    return {
      icon: Wind,
      category: 'Comfort' as keyof typeof AMENITY_CATEGORIES,
      label: amenity
    };
  }
  if (normalized.includes('security') || normalized.includes('cctv') || normalized.includes('gate') || normalized.includes('fence') || normalized.includes('alarm')) {
    return {
      icon: Shield,
      category: 'Security' as keyof typeof AMENITY_CATEGORIES,
      label: amenity
    };
  }
  if (normalized.includes('water') || normalized.includes('electricity') || normalized.includes('meter') || normalized.includes('refuse') || normalized.includes('bill') || normalized.includes('power')) {
    return {
      icon: Zap,
      category: 'Utilities' as keyof typeof AMENITY_CATEGORIES,
      label: amenity
    };
  }

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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
      // Check live Firestore document for immediate sanction status
      try {
        const liveDoc = await getDoc(doc(db, 'hostels', hostelId));
        if (liveDoc.exists()) {
          const liveData = liveDoc.data();
          data.accreditationStatus = liveData.accreditationStatus || (data as any).accreditationStatus;
          (data as any).sanctionStatus = liveData.sanctionStatus || (data as any).sanctionStatus;
          data.status = liveData.status || data.status;
        }
      } catch (err) {
        console.error('Error fetching live hostel status in room page:', err);
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
        const typeName = found.roomType ?? found.type ?? hostel.roomTypes?.[0]?.name ?? "Room";
        const matchingType = hostel.roomTypes?.find(
          (rt) => String(rt.id ?? '') === String(found.roomTypeId ?? '') ||
                  rt.name?.toLowerCase().trim() === String(typeName).toLowerCase().trim()
        );
        const capacity = found.capacity ?? matchingType?.capacity ?? parseCapacity(typeName);

        // Inherit amenities from physical room, or parent roomType
        let rawAmenities = (found.amenities && Array.isArray(found.amenities) && found.amenities.length > 0)
          ? found.amenities
          : (found.roomAmenities && Array.isArray(found.roomAmenities) && found.roomAmenities.length > 0)
          ? found.roomAmenities
          : (matchingType?.roomAmenities && Array.isArray(matchingType.roomAmenities) && matchingType.roomAmenities.length > 0)
          ? matchingType.roomAmenities
          : [];

        // If still empty, provide robust student housing baseline
        if (rawAmenities.length === 0) {
          rawAmenities = [
            capacity && capacity > 1 ? 'Shared Washroom' : 'Private Washroom',
            'Mattress',
            'Single Bed',
            'Wardrobe',
            'Ceiling Fan',
            'Furniture (Table, Chair)'
          ];
        }

        const roomPhotos = (found.images && found.images.length > 0)
          ? found.images
          : (matchingType?.images && matchingType.images.length > 0)
          ? matchingType.images
          : [];
        const roomVideos = (found.videos && found.videos.length > 0)
          ? found.videos
          : (matchingType?.videos && matchingType.videos.length > 0)
          ? matchingType.videos
          : [];

        return {
          id: found.id ?? `room-${index}`,
          label: formatLabel(found.roomNumber ?? found.number ?? found.name, index),
          type: typeName,
          price: found.price ?? matchingType?.price ?? hostel.priceRange?.min ?? 0,
          occupancy: found.currentOccupancy ?? found.occupancy ?? found.occupants ?? 0,
          capacity: capacity ?? null,
          gender: found.gender ?? found.genderTag ?? (hostel.gender || "Mixed"),
          image: roomPhotos[0] || (found.image ?? found.imageUrl ?? primaryImages[index % primaryImages.length]),
          images: roomPhotos,
          videos: roomVideos,
          totalRooms: (matchingType as any)?.numberOfRooms ?? null,
          amenities: rawAmenities,
        };
      }
    }

    const types = hostel.roomTypes ?? [];
    const byId = types.find((t) => String(t.id ?? "") === String(roomId) || t.name?.toLowerCase().trim() === decodeURIComponent(roomId).toLowerCase().trim());
    if (byId) {
      const idx = types.indexOf(byId);
      const capacity = byId.capacity ?? parseCapacity(byId.name);
      let rawAmenities = byId.roomAmenities ?? [];
      if (!rawAmenities || rawAmenities.length === 0) {
        rawAmenities = [
          capacity && capacity > 1 ? 'Shared Washroom' : 'Private Washroom',
          'Mattress',
          'Single Bed',
          'Wardrobe',
          'Ceiling Fan',
          'Furniture (Table, Chair)'
        ];
      }

      const typePhotos = (byId.images && byId.images.length > 0) ? byId.images : [];
      const typeVideos = (byId.videos && byId.videos.length > 0) ? byId.videos : [];

      return {
        id: byId.id ?? `roomType-${idx}`,
        label: byId.name,
        type: byId.name,
        price: byId.price,
        occupancy: byId.occupancy ?? 0,
        capacity,
        gender: hostel.gender || "Mixed",
        image: typePhotos[0] || primaryImages[idx % primaryImages.length],
        images: typePhotos,
        videos: typeVideos,
        totalRooms: (byId as any).numberOfRooms ?? null,
        amenities: rawAmenities,
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

  const isSoldOut = useMemo(() => {
    if (!hostel || !room) return false;
    if (isHostelSoldOut(hostel)) return true;
    if (hostel.availability === 'Full') return true;

    // Check matching room type
    const types = hostel.roomTypes ?? [];
    const matchingType = types.find(
      (t) => String(t.id ?? "") === String(room.id) ||
             t.name?.toLowerCase().trim() === (room.type || "").toLowerCase().trim()
    );
    if (matchingType && isRoomTypeSoldOut(matchingType)) return true;

    // Check physical room occupancy
    if (room.capacity && room.occupancy >= room.capacity) return true;

    return false;
  }, [hostel, room]);

  const isRestricted = hostel ? isHostelRestricted(hostel) : false;

  const handlePrimaryAction = () => {
    if (isRestricted) {
      toast({
        title: "Action Denied",
        description: SANCTION_MESSAGES.ACTION_DENIED,
        variant: "destructive",
      });
      return;
    }
    if (isSoldOut || hostel.availability === 'Full' || hasSecuredHostel) {
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
    if (isSoldOut) return { status: 'full', color: 'text-rose-600', bgColor: 'bg-rose-50' };
    if (!room.capacity || !room.totalRooms) return null;
    const totalSlots = room.capacity * room.totalRooms;
    const used = Math.max(0, Math.min(totalSlots, room.occupancy));
    const remainingSlots = Math.max(0, totalSlots - used);
    const occupancyRate = (used / totalSlots) * 100;
    
    if (occupancyRate >= 100) return { status: 'full', color: 'text-rose-600', bgColor: 'bg-rose-50' };
    if (occupancyRate >= 80) return { status: 'limited', color: 'text-orange-600', bgColor: 'bg-orange-50' };
    return { status: 'available', color: 'text-green-600', bgColor: 'bg-green-50' };
  };

  const availabilityStatus = getAvailabilityStatus();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      <Header />
      <main className="flex-1 px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8 pb-28 md:pb-8">
        <div className="max-w-5xl mx-auto w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4 sm:mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground text-xs sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to rooms
          </Button>

          {/* Sanction Enforcement Banner */}
          <SanctionBanner hostel={hostel} className="mb-6" />

          {/* Sold Out Notice Banner */}
          {isSoldOut && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 shadow-xs">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                  Inventory Lock: 100% Capacity Reached (Read-Only Mode)
                </h4>
                <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                  This room has reached maximum occupancy and is currently locked for new booking transactions and in-person visit requests. You can freely explore all room inclusions, virtual walkthrough videos, and building specifications below.
                </p>
              </div>
            </div>
          )}

          {/* Room Type Switcher / Comparator Strip */}
          {hostel.roomTypes && hostel.roomTypes.length > 1 && (
            <div className="mb-6 p-3.5 sm:p-4 rounded-2xl bg-white border border-border/80 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <DoorOpen className="h-4 w-4 text-primary" />
                  Room Types Available in {hostel.name}:
                </span>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">Click to switch & compare inclusions</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {hostel.roomTypes.map((rt, i) => {
                  const isActive = (room.type && room.type.toLowerCase().trim() === rt.name.toLowerCase().trim()) ||
                    String(room.id) === String(rt.id);
                  const matchingPhysical = (hostel as any)?.rooms?.find(
                    (r: any) => String(r.roomTypeId ?? '') === String(rt.id ?? '') ||
                                String(r.roomType ?? r.type ?? '').toLowerCase().trim() === rt.name.toLowerCase().trim()
                  );
                  const targetId = matchingPhysical?.id ?? rt.id ?? `roomType-${i}`;

                  return (
                    <Button
                      key={rt.id || i}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => router.push(`/hostels/${hostelId}/rooms/${targetId}`)}
                      className={cn(
                        "rounded-xl text-xs font-semibold shrink-0 gap-2 h-9 transition-all",
                        isActive && "shadow-sm ring-2 ring-primary/30"
                      )}
                    >
                      <span>{rt.name}</span>
                      <span className={cn("text-[11px] font-normal", isActive ? "text-primary-foreground/90" : "text-muted-foreground")}>
                        GH₵{rt.price.toLocaleString()}/yr
                      </span>
                      {isActive && <Badge className="bg-white/20 text-white text-[9px] px-1.5 py-0 h-4 border-0">Selected</Badge>}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Hero Image & Basic Info */}
              <Card className="overflow-hidden shadow-lg border-0 bg-white rounded-2xl">
                <div 
                  className="relative h-64 sm:h-72 md:h-80 w-full cursor-pointer group"
                  onClick={() => {
                    setActiveImageIndex(0);
                    setLightboxOpen(true);
                  }}
                  title="Click to view photo in fullscreen"
                >
                  <Image
                    src={room.image}
                    alt={room.label}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-black/70 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                      <Eye className="w-3.5 h-3.5" /> View Photo
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 text-xs font-medium">
                            {hostel.name}
                          </Badge>
                          <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/90 text-white shadow-sm">
                            University-Approved ✓
                          </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
                          {room.label}
                        </h1>
                        <p className="text-white/90 text-xs sm:text-sm font-medium">
                          {room.type} • {hostel.location}
                        </p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                          GH₵{room.price.toLocaleString()}
                        </div>
                        <div className="text-white/80 text-xs sm:text-sm font-medium">per academic year</div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {isSoldOut && (
                      <Badge className="bg-rose-600/95 hover:bg-rose-600 text-white font-black border-0 shadow-md uppercase tracking-wider text-[11px] flex items-center gap-1 px-2.5 py-1">
                        <Lock className="h-3.5 w-3.5" />
                        Sold Out (100% Full)
                      </Badge>
                    )}
                    <Badge 
                      variant="secondary" 
                      className="bg-white/90 text-gray-900 shadow-sm text-xs font-medium"
                    >
                      {room.gender === "Male" ? "♂ Male" : room.gender === "Female" ? "♀ Female" : "⚥ Mixed"} room
                    </Badge>
                  </div>
                </div>

                {/* Gallery Thumbnail Row if multiple photos exist */}
                {room.images && room.images.length > 1 && (
                  <div className="p-3 bg-muted/20 border-t border-border/60 flex items-center gap-2.5 overflow-x-auto scrollbar-none">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-1 pl-1">
                      <Camera className="h-3 w-3 text-primary" /> Photos ({room.images.length}):
                    </span>
                    {room.images.map((imgUrl, pIdx) => (
                      <div
                        key={pIdx}
                        onClick={() => {
                          setActiveImageIndex(pIdx);
                          setLightboxOpen(true);
                        }}
                        className={cn(
                          "relative h-14 w-20 rounded-lg overflow-hidden shrink-0 border-2 cursor-pointer transition-all",
                          pIdx === 0 ? "border-primary shadow-xs" : "border-border/70 opacity-80 hover:opacity-100 hover:border-primary/50"
                        )}
                      >
                        <Image
                          src={imgUrl}
                          alt={`Thumbnail ${pIdx + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Virtual Video Walkthrough Section if present */}
              {room.videos && room.videos.length > 0 && (
                <Card className="shadow-lg border-0 bg-white overflow-hidden rounded-2xl">
                  <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <Film className="h-5 w-5 text-indigo-600 shrink-0" />
                      Virtual Walkthrough Video
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Take a virtual video tour of this {room.type} before scheduling your in-person visit.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
                    {room.videos.map((vidUrl, vIdx) => (
                      <div key={vIdx} className="rounded-2xl overflow-hidden border border-border bg-black aspect-video relative">
                        <video
                          src={vidUrl}
                          controls
                          preload="metadata"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Room Details */}
              <Card className="shadow-lg border-0 bg-white rounded-2xl">
                <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Home className="h-5 w-5 text-primary shrink-0" />
                    Room Specifications & Occupancy
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-2 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    {room.capacity && (
                      <div className="flex items-center gap-3 p-3 sm:p-3.5 bg-blue-50/80 rounded-xl border border-blue-100/60">
                        <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <Bed className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-blue-950 leading-tight">{room.capacity}</div>
                          <div className="text-xs text-blue-700 leading-tight">Beds per room</div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-3 sm:p-3.5 bg-green-50/80 rounded-xl border border-green-100/60">
                      <div className="h-9 w-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-green-950 leading-tight">{room.occupancy}</div>
                        <div className="text-xs text-green-700 leading-tight">Current occupants</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 sm:p-3.5 bg-purple-50/80 rounded-xl border border-purple-100/60">
                      <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-purple-950 leading-tight truncate max-w-[110px] sm:max-w-none">{hostel.location.split(',')[0]}</div>
                        <div className="text-xs text-purple-700 leading-tight">Location</div>
                      </div>
                    </div>
                    {availabilityStatus && (
                      <div className={cn("flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border border-border/40", availabilityStatus.bgColor)}>
                        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-white/60", availabilityStatus.color)}>
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <div className={cn("font-bold text-sm capitalize leading-tight", availabilityStatus.color)}>
                            {availabilityStatus.status}
                          </div>
                          <div className={cn("text-xs leading-tight opacity-90", availabilityStatus.color)}>Status</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {remainingInfo && (
                    <div className="p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                        <span className="text-xs sm:text-sm font-medium text-amber-900">{remainingInfo}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Room Amenities & Furnishings Section */}
              {Object.keys(groupedAmenities).length > 0 ? (
                <Card className="shadow-lg border-0 bg-white rounded-2xl">
                  <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <Star className="h-5 w-5 text-primary shrink-0" />
                      Room Inclusions & Amenities
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Everything specifically provided in this {room.type} configuration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-2 space-y-6">
                    {Object.entries(groupedAmenities).map(([category, amenities]) => {
                      const categoryInfo = AMENITY_CATEGORIES[category as keyof typeof AMENITY_CATEGORIES] || AMENITY_CATEGORIES.Essential;
                      const CategoryIcon = categoryInfo.icon;
                      
                      return (
                        <div key={category}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className={cn(
                              "p-1.5 rounded-lg shrink-0",
                              categoryInfo.bgColor,
                              categoryInfo.borderColor,
                              "border"
                            )}>
                              <CategoryIcon className={cn("h-4 w-4", categoryInfo.color)} />
                            </div>
                            <h4 className="text-sm font-semibold text-foreground">{category}</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-0 sm:ml-4">
                            {amenities.map(({ amenity, info }) => {
                              const AmenityIcon = info.icon;
                              return (
                                <div key={amenity} className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-xl hover:bg-gray-100/80 transition-colors border border-border/40">
                                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", categoryInfo.bgColor)}>
                                    <AmenityIcon className={cn("h-4 w-4", categoryInfo.color)} />
                                  </div>
                                  <span className="text-xs sm:text-sm font-medium text-gray-800 leading-tight">{info.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-lg border-0 bg-white rounded-2xl">
                  <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <Star className="h-5 w-5 text-primary shrink-0" />
                      Room Inclusions & Amenities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <Bed className="h-4 w-4" />
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-800 leading-tight">Student Bed & Mattress</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <Bath className="h-4 w-4" />
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-800 leading-tight">Private or Shared Washroom</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                          <Wind className="h-4 w-4" />
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-800 leading-tight">Ceiling Fan & Ventilation</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                          <Home className="h-4 w-4" />
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-800 leading-tight">Wardrobe / Storage Closet</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Security & Access Standards for this Room */}
              <Card className="shadow-lg border-0 bg-white rounded-2xl">
                <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Shield className="h-5 w-5 text-rose-600 shrink-0" />
                    Room & Building Security Standards
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Verified safety infrastructure protecting students in this room
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3.5 bg-rose-50/50 rounded-xl border border-rose-100/80">
                      <div className="h-9 w-9 rounded-lg bg-rose-100/80 text-rose-600 flex items-center justify-center shrink-0">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-gray-900 leading-snug">Lockable Room Door</div>
                        <div className="text-xs text-muted-foreground leading-tight">Individual secure key access</div>
                      </div>
                    </div>

                    {(hostel.securityAndSafety && hostel.securityAndSafety.length > 0) ? (
                      hostel.securityAndSafety.map((sec, i) => (
                        <div key={i} className="flex items-center gap-3 p-3.5 bg-rose-50/50 rounded-xl border border-rose-100/80">
                          <div className="h-9 w-9 rounded-lg bg-rose-100/80 text-rose-600 flex items-center justify-center shrink-0">
                            <Shield className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-semibold text-gray-900 leading-snug">{sec}</div>
                            <div className="text-xs text-muted-foreground leading-tight">Active hostel protection standard</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center gap-3 p-3.5 bg-rose-50/50 rounded-xl border border-rose-100/80">
                          <div className="h-9 w-9 rounded-lg bg-rose-100/80 text-rose-600 flex items-center justify-center shrink-0">
                            <Shield className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-semibold text-gray-900 leading-snug">24-Hour Access Security</div>
                            <div className="text-xs text-muted-foreground leading-tight">Gated compound perimeter</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3.5 bg-rose-50/50 rounded-xl border border-rose-100/80">
                          <div className="h-9 w-9 rounded-lg bg-rose-100/80 text-rose-600 flex items-center justify-center shrink-0">
                            <Shield className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-semibold text-gray-900 leading-snug">CCTV Surveillance</div>
                            <div className="text-xs text-muted-foreground leading-tight">Building corridor monitoring</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Utilities & Bills Policy for this Room */}
              <Card className="shadow-lg border-0 bg-white rounded-2xl">
                <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Zap className="h-5 w-5 text-amber-600 shrink-0" />
                    Utilities & Bills Policy
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Transparent breakdown of billing coverage for this room
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-2 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bills Included */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs sm:text-sm">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </div>
                        Included in Rent (Zero Surcharge)
                      </div>
                      <div className="space-y-2 pl-2 sm:pl-3">
                        {hostel.billsIncluded && hostel.billsIncluded.length > 0 ? (
                          hostel.billsIncluded.map((b, i) => (
                            <div key={i} className="text-xs sm:text-sm text-gray-700 flex items-center gap-2.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="leading-snug">{b}</span>
                            </div>
                          ))
                        ) : (
                          <>
                            <div className="text-xs sm:text-sm text-gray-700 flex items-center gap-2.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="leading-snug">Water supply included</span>
                            </div>
                            <div className="text-xs sm:text-sm text-gray-700 flex items-center gap-2.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="leading-snug">Refuse & sanitation disposal</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Bills Excluded */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/50 border border-amber-200/60 space-y-3">
                      <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs sm:text-sm">
                        <div className="h-6 w-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <Zap className="h-3.5 w-3.5" />
                        </div>
                        Prepaid / Student Responsibility
                      </div>
                      <div className="space-y-2 pl-2 sm:pl-3">
                        {hostel.billsExcluded && hostel.billsExcluded.length > 0 ? (
                          hostel.billsExcluded.map((b, i) => (
                            <div key={i} className="text-xs sm:text-sm text-gray-700 flex items-center gap-2.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span className="leading-snug">{b} (Per unit meter)</span>
                            </div>
                          ))
                        ) : (
                          <>
                            <div className="text-xs sm:text-sm text-gray-700 flex items-center gap-2.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span className="leading-snug">Electricity (Prepaid meter per room)</span>
                            </div>
                            <div className="text-xs sm:text-sm text-gray-700 flex items-center gap-2.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span className="leading-snug">Cooking gas (if applicable)</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Booking Card */}
              <Card className="shadow-lg border-0 bg-white rounded-2xl lg:sticky lg:top-24 overflow-hidden">
                <CardHeader className="pb-4 pt-6 px-6 text-center border-b border-border/50 bg-muted/10">
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
                        GH₵{room.price.toLocaleString()}
                      </span>
                      <span className="text-sm font-semibold text-muted-foreground">/ yr</span>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                      Academic Year • Direct Booking (Zero Middleman Fee)
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <Button
                    className={cn(
                      "w-full h-12 text-base font-semibold shadow-md flex items-center justify-center gap-2 rounded-xl transition-all",
                      "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99]",
                      isSoldOut && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 cursor-not-allowed hover:bg-rose-500/10 shadow-none",
                      (isHostelRevoked(hostel) || isHostelSanctioned(hostel)) && "bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700 shadow-none hover:bg-slate-200"
                    )}
                    onClick={handlePrimaryAction}
                    disabled={isSoldOut || hostel.availability === 'Full' || hasSecuredHostel || isRestricted}
                  >
                    {isHostelRevoked(hostel) ? (
                      <>
                        <Ban className="h-5 w-5 mr-2 text-slate-500" />
                        Bookings Permanently Disabled
                      </>
                    ) : isHostelSanctioned(hostel) ? (
                      <>
                        <AlertTriangle className="h-5 w-5 mr-2 text-slate-500" />
                        Bookings Temporarily Paused
                      </>
                    ) : isSoldOut ? (
                      <>
                        <Lock className="h-5 w-5 mr-2" />
                        Sold Out (100% Capacity)
                      </>
                    ) : hostel.availability === 'Full' ? (
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
                        Request a Free Visit
                      </>
                    )}
                  </Button>
                  
                  <div className="text-center text-xs text-muted-foreground leading-relaxed">
                    {isRestricted
                      ? "This property is currently under administrative sanction."
                      : hasCompletedVisit 
                      ? "Complete your room booking with secure university escrow"
                      : "Free inspection • Connect directly with hostel manager"}
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2.5 text-xs sm:text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Room type:</span>
                      <span className="font-semibold text-foreground">{room.type}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Gender:</span>
                      <span className="font-semibold text-foreground">{room.gender}</span>
                    </div>
                    {room.capacity && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span className="font-semibold text-foreground">{room.capacity} students</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs text-emerald-600 font-semibold pt-1">
                      <span>Inspection fee:</span>
                      <span>FREE (Direct Booking)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Protection Card */}
              <Card className={cn(
                "p-4 sm:p-5 rounded-2xl border",
                isHostelRevoked(hostel)
                  ? "border-rose-200 bg-rose-50/50"
                  : isHostelSanctioned(hostel)
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-emerald-200 bg-emerald-50/50"
              )}>
                <div className="flex items-start gap-3">
                  {isHostelRevoked(hostel) ? (
                    <Ban className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  ) : isHostelSanctioned(hostel) ? (
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <p className={cn(
                      "font-semibold",
                      isHostelRevoked(hostel)
                        ? "text-rose-950"
                        : isHostelSanctioned(hostel)
                        ? "text-amber-950"
                        : "text-emerald-900"
                    )}>
                      {isHostelRevoked(hostel)
                        ? "Accreditation Revoked"
                        : isHostelSanctioned(hostel)
                        ? "Executive Sanction Active"
                        : "University Protected"}
                    </p>
                    <p className={cn(
                      "leading-relaxed",
                      isHostelRevoked(hostel)
                        ? "text-rose-700"
                        : isHostelSanctioned(hostel)
                        ? "text-amber-700"
                        : "text-emerald-700"
                    )}>
                      {isHostelRevoked(hostel)
                        ? "University charter accreditation has been revoked for this property. Student bookings and payment gateways are permanently disabled."
                        : isHostelSanctioned(hostel)
                        ? "This property is under formal welfare and regulatory investigation. Room bookings and visit requests are temporarily paused."
                        : "Verified inventory. No illegal middleman charges. Payment held in university-approved escrow until key handoff."}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Need Help Card */}
              <Card className="shadow-sm border border-border/40 bg-white rounded-2xl">
                <CardHeader className="py-4 px-5">
                  <CardTitle className="text-sm font-semibold">Need Assistance?</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4 px-5">
                  <Button variant="outline" className="w-full justify-center gap-2 rounded-xl h-10 text-xs font-semibold" size="sm" asChild>
                    <a href="tel:+233200000000">
                      <Phone className="h-4 w-4" />
                      Call University Housing Support
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border p-3.5 sm:px-6 flex items-center justify-between gap-4 md:hidden shadow-lg">
        <div>
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Academic Year</div>
          <div className="text-lg sm:text-xl font-extrabold text-primary tracking-tight">GH₵{room.price.toLocaleString()}</div>
        </div>
        <Button 
          onClick={handlePrimaryAction}
          disabled={isSoldOut || hostel.availability === 'Full' || hasSecuredHostel || isRestricted}
          className={cn(
            "h-11 px-5 text-sm font-semibold shadow-md flex items-center gap-1.5 rounded-xl transition-all",
            "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99]",
            (isSoldOut || isRestricted) && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 cursor-not-allowed shadow-none",
            isHostelSanctioned(hostel) && !isHostelRevoked(hostel) && "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50 shadow-none"
          )}
        >
          {isHostelRevoked(hostel) ? (
            <>
              <Ban className="h-4 w-4" />
              Bookings Disabled
            </>
          ) : isHostelSanctioned(hostel) ? (
            <>
              <AlertTriangle className="h-4 w-4" />
              Bookings Paused
            </>
          ) : isSoldOut ? (
            <>
              <Lock className="h-4 w-4" />
              Sold Out
            </>
          ) : hostel.availability === 'Full' 
            ? 'Fully Booked' 
            : hasSecuredHostel 
            ? 'Already Secured' 
            : hasCompletedVisit 
            ? 'Secure Room' 
            : 'Request Free Visit'}
        </Button>
      </div>

{/* YARL Fullscreen Photo Lightbox for Room Detail */}
<Lightbox
  open={lightboxOpen}
  close={() => setLightboxOpen(false)}
  index={activeImageIndex}
  on={{ view: ({ index }) => setActiveImageIndex(index) }}
  slides={[
    ...(room.images && room.images.length > 0 ? room.images : [room.image]),
    ...(hostel.images || []).filter(img => !(room.images && room.images.length > 0 ? room.images : [room.image]).includes(img))
  ].map((src, i) => ({
    src,
    alt: `${room.label} photo ${i + 1}`,
  }))}
  plugins={[Zoom, Counter]}
  styles={{
    container: { backgroundColor: '#000000' },
  }}
  carousel={{ finite: false }}
  controller={{ closeOnBackdropClick: true }}
  animation={{ fade: 250 }}
/>
</div>
);
}
