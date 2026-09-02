"use client";

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/header';
import { getHostel, Hostel, RoomType } from '@/lib/data';
import { notFound, useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { Star, MapPin, Users, Bed, Bath, DoorOpen, ArrowLeft, Grid3x3, List, Search, Filter, CheckCircle2, Clock, ShieldCheck, Sparkles, Building, ChevronRight, Check, Shield, Zap, Droplets, Wind, Home, Eye, Info, Camera, Film, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';

interface AppUser {
  uid: string;
  email: string;
  fullName: string;
  role: 'student' | 'hostel_manager' | 'admin';
  profileImage?: string;
}

type RoomInventoryItem = {
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
  roomNumber?: string;
  totalRooms?: number | null;
  amenities?: string[];
};

export default function RoomsPage() {
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [loading, setLoading] = useState(true);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hasCompletedVisit, setHasCompletedVisit] = useState<boolean>(false);
  const [hasSecuredHostel, setHasSecuredHostel] = useState<boolean>(false);
  const [roomOccupancy, setRoomOccupancy] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price-low' | 'price-high' | 'newest' | 'oldest'>('price-low');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<string>('');
  const [rentDuration, setRentDuration] = useState<string>('year');
  const [modalRoomType, setModalRoomType] = useState<RoomType | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const routeParams = useParams();
  const router = useRouter();
  const { toast } = useToast();
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

        // Check if this student has a completed visit for this hostel
        if (id) {
          try {
            const visitsQuery = query(
              collection(db, 'visits'),
              where('studentId', '==', user.uid),
              where('hostelId', '==', id)
            );
            const visitsSnapshot = await getDocs(visitsQuery);
            if (!visitsSnapshot.empty) {
              const hasCompleted = visitsSnapshot.docs.some((docSnap) => {
                const data = docSnap.data() as any;
                return data.status === 'completed' && data.studentCompleted === true;
              });
              setHasCompletedVisit(hasCompleted);
            } else {
              setHasCompletedVisit(false);
            }
          } catch (error) {
            console.error('Error checking completed visit for rooms page:', error);
            setHasCompletedVisit(false);
          }

          // Check if this student already has a confirmed/secured booking in this hostel
          try {
            const bookingsQuery = query(
              collection(db, 'bookings'),
              where('studentId', '==', user.uid),
              where('hostelId', '==', id),
              where('status', '==', 'confirmed')
            );
            const bookingsSnapshot = await getDocs(bookingsQuery);
            setHasSecuredHostel(!bookingsSnapshot.empty);
          } catch (error) {
            console.error('Error checking secured booking for rooms page:', error);
            setHasSecuredHostel(false);
          }
        }
      } else {
        setAppUser(null);
        setHasCompletedVisit(false);
        setHasSecuredHostel(false);
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, [id]);

  const parseCapacityFromName = (value?: string | null): number | null => {
    if (!value) return null;
    const match = value.match(/\d+/);
    if (!match) return null;
    const parsed = parseInt(match[0], 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const primaryImages = hostel?.images?.length ? hostel.images : ['/placeholder.jpg'];

  const roomInventory = useMemo<RoomInventoryItem[]>(() => {
    if (!hostel) return [];

    const rooms = (hostel as any)?.rooms;
    if (Array.isArray(rooms) && rooms.length > 0) {
      const formatLabel = (raw: any, index: number) => {
        const value = String(raw ?? '').trim();
        if (!value) return `Room ${index + 1}`;
        if (value.toLowerCase().startsWith('room ')) return value;
        return `Room ${value}`;
      };

      return rooms.map((room: any, index: number) => {
        const id = room.id ?? `room-${index}`;

        // Try to resolve the correct RoomType for this physical room using roomTypeId or name
        const matchingType: RoomType | undefined = hostel.roomTypes?.find(
          (rt) => String(rt.id ?? '') === String(room.roomTypeId ?? '') ||
                  rt.name?.toLowerCase().trim() === String(room.roomType ?? room.type ?? '').toLowerCase().trim()
        );

        const typeName =
          room.roomType ??
          room.type ??
          matchingType?.name ??
          hostel.roomTypes?.[0]?.name ??
          'Room';

        const capacity =
          room.capacity ??
          matchingType?.capacity ??
          parseCapacityFromName(room.roomType ?? room.type ?? matchingType?.name);

        // Inherit amenities
        let rawAmenities = (room.amenities && Array.isArray(room.amenities) && room.amenities.length > 0)
          ? room.amenities
          : (room.roomAmenities && Array.isArray(room.roomAmenities) && room.roomAmenities.length > 0)
          ? room.roomAmenities
          : (matchingType?.roomAmenities && Array.isArray(matchingType.roomAmenities) && matchingType.roomAmenities.length > 0)
          ? matchingType.roomAmenities
          : [
            capacity && capacity > 1 ? 'Shared Washroom' : 'Private Washroom',
            'Mattress',
            'Single Bed',
            'Wardrobe',
            'Ceiling Fan'
          ];

        // Get occupancy for this specific room (not room type)
        const roomNumber = room.roomNumber ?? room.number;
        const occupancyFromBookings = 
          roomOccupancy[id] ?? // Try specific room ID first
          (roomNumber ? roomOccupancy[`room-${roomNumber}`] : 0) ?? // Then try room number
          room.currentOccupancy ?? // Then try stored occupancy
          0; // Default to 0

        const roomPhotos = (room.images && room.images.length > 0)
          ? room.images
          : (matchingType?.images && matchingType.images.length > 0)
          ? matchingType.images
          : [];
        const roomVideos = (room.videos && room.videos.length > 0)
          ? room.videos
          : (matchingType?.videos && matchingType.videos.length > 0)
          ? matchingType.videos
          : [];
          
        return {
          id,
          label: formatLabel(roomNumber ?? room.name, index),
          type: typeName,
          price: room.price ?? matchingType?.price ?? hostel.priceRange?.min ?? 0,
          occupancy: occupancyFromBookings,
          capacity: capacity ?? null,
          gender: room.gender ?? room.genderTag ?? (hostel.gender || 'Mixed'),
          image: roomPhotos[0] || (room.image ?? room.imageUrl ?? primaryImages[index % primaryImages.length]),
          images: roomPhotos,
          videos: roomVideos,
          roomNumber: roomNumber,
          amenities: rawAmenities,
        };
      });
    }

    const types = hostel.roomTypes ?? [];
    if (types.length === 0) {
      return [];
    }

    return types.map((roomType, typeIndex) => {
      const capacity = roomType.capacity ?? parseCapacityFromName(roomType.name);
      const roomTypeId = roomType.id ?? `roomType-${typeIndex}`;
      const occupancyFromBookings =
        roomOccupancy[roomTypeId] ?? roomOccupancy[roomType.name] ?? 0;

      let rawAmenities = roomType.roomAmenities ?? [];
      if (!rawAmenities || rawAmenities.length === 0) {
        rawAmenities = [
          capacity && capacity > 1 ? 'Shared Washroom' : 'Private Washroom',
          'Mattress',
          'Single Bed',
          'Wardrobe',
          'Ceiling Fan'
        ];
      }

      const typePhotos = (roomType.images && roomType.images.length > 0) ? roomType.images : [];
      const typeVideos = (roomType.videos && roomType.videos.length > 0) ? roomType.videos : [];

      return {
        id: roomTypeId,
        label: roomType.name,
        type: roomType.name,
        price: roomType.price,
        occupancy: roomType.occupancy ?? occupancyFromBookings,
        capacity: capacity ?? null,
        gender: hostel.gender || 'Mixed',
        image: typePhotos[0] || primaryImages[typeIndex % primaryImages.length],
        images: typePhotos,
        videos: typeVideos,
        roomNumber: undefined,
        totalRooms: (roomType as any).numberOfRooms ?? null,
        amenities: rawAmenities,
      };
    });
  }, [hostel, primaryImages, roomOccupancy]);

  // Load current occupancy per individual room based on confirmed bookings
  useEffect(() => {
    const loadOccupancy = async () => {
      if (!id) return;
      try {
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('hostelId', '==', id),
          where('status', '==', 'confirmed')
        );
        const snapshot = await getDocs(bookingsQuery);
        const counts: Record<string, number> = {};
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          
          // Priority: specific roomId > roomNumber > fallback to roomTypeId
          const specificRoomId = data.roomId || null;
          const roomNumber = data.roomNumber || null;
          const roomTypeId = data.roomTypeId || null;
          
          if (specificRoomId) {
            // Count by specific room ID
            counts[String(specificRoomId)] = (counts[String(specificRoomId)] || 0) + 1;
          } else if (roomNumber) {
            // Count by room number if no specific room ID
            counts[`room-${roomNumber}`] = (counts[`room-${roomNumber}`] || 0) + 1;
          } else if (roomTypeId) {
            // Fallback to room type for backwards compatibility
            counts[String(roomTypeId)] = (counts[String(roomTypeId)] || 0) + 1;
          }
        });
        
        setRoomOccupancy(counts);
      } catch (error) {
        console.error('Error loading room occupancy for hostel rooms page:', error);
      }
    };

    loadOccupancy();
  }, [id]);

  const filteredAndSortedRooms = useMemo(() => {
    let filtered = [...roomInventory];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(room =>
        room.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by room type
    if (roomTypeFilter) {
      filtered = filtered.filter(room =>
        room.type.toLowerCase().includes(roomTypeFilter.toLowerCase())
      );
    }

    // Filter by gender
    if (genderFilter) {
      filtered = filtered.filter(room =>
        room.gender.toLowerCase() === genderFilter.toLowerCase()
      );
    }

    // Sort
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        filtered.sort((a, b) => (b.roomNumber || '').localeCompare(a.roomNumber || ''));
        break;
      case 'oldest':
        filtered.sort((a, b) => (a.roomNumber || '').localeCompare(b.roomNumber || ''));
        break;
    }

    return filtered;
  }, [roomInventory, searchQuery, roomTypeFilter, genderFilter, sortBy]);

  const groupedRoomsByType = useMemo(() => {
    const groups: Record<string, RoomInventoryItem[]> = {};
    filteredAndSortedRooms.forEach((room) => {
      const key = room.type && room.type.trim().length > 0 ? room.type : 'Other Rooms';
      if (!groups[key]) groups[key] = [];
      groups[key].push(room);
    });
    return groups;
  }, [filteredAndSortedRooms]);

  // Ensure we don't create <SelectItem> options with empty values
  const uniqueRoomTypes = useMemo(
    () => Array.from(new Set(roomInventory.map((r) => r.type).filter((t) => t && t.trim().length > 0))),
    [roomInventory]
  );

  if (loading || !authChecked) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!hostel) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/hostels/${id}`)}
            className="rounded-full gap-2 text-muted-foreground hover:bg-primary/5 hover:text-primary transition-colors pr-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {hostel.name}
          </Button>

          <div className="text-xs text-muted-foreground hidden sm:block">
            <Link href="/" className="hover:underline">Home</Link>
            <span className="mx-2">/</span>
            <Link href={`/hostels/${id}`} className="hover:underline">{hostel.name}</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground font-semibold">Rooms</span>
          </div>
        </div>

        {/* Header Title & Trust Strip */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-headline tracking-tight text-foreground">
              Room Options at {hostel.name}
            </h1>
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0 px-3 py-1 text-xs gap-1.5 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" /> University-Approved ✓
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{hostel.location}</span>
            </div>
            {hostel.distanceToUniversity && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1.5 text-primary font-medium">
                  <Clock className="h-4 w-4" />
                  <span>{hostel.distanceToUniversity} from campus</span>
                </div>
              </>
            )}
            {hostel.institution && (
              <>
                <span>•</span>
                <Badge variant="secondary" className="font-semibold text-xs">
                  {hostel.institution}
                </Badge>
              </>
            )}
            <span>•</span>
            <span className="text-xs font-semibold text-foreground">
              {roomInventory.length} room configuration{roomInventory.length === 1 ? '' : 's'} available
            </span>
          </div>
        </div>

        {/* Quick Filter Bar (Amber Student Style) */}
        <div className="rounded-3xl border border-border/70 bg-card/70 backdrop-blur-xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            {/* Quick Room Type Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
              <Button
                variant={roomTypeFilter === '' ? 'default' : 'outline'}
                size="sm"
                className="rounded-full text-xs font-semibold shrink-0"
                onClick={() => setRoomTypeFilter('')}
              >
                All Rooms
              </Button>
              {uniqueRoomTypes.map((type) => (
                <Button
                  key={type}
                  variant={roomTypeFilter === type ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full text-xs font-semibold shrink-0"
                  onClick={() => setRoomTypeFilter(roomTypeFilter === type ? '' : type)}
                >
                  {type}
                </Button>
              ))}
            </div>

            {/* Gender Pills & Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-full border border-border/50">
                <button
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-colors",
                    genderFilter === '' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setGenderFilter('')}
                >
                  All
                </button>
                <button
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-colors",
                    genderFilter === 'Male' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setGenderFilter(genderFilter === 'Male' ? '' : 'Male')}
                >
                  Male
                </button>
                <button
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-colors",
                    genderFilter === 'Female' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setGenderFilter(genderFilter === 'Female' ? '' : 'Female')}
                >
                  Female
                </button>
              </div>

              {/* Sort By */}
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[170px] rounded-full text-xs h-9">
                  <SelectValue placeholder="Sort price" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="newest">Room: A to Z</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="hidden sm:flex items-center border rounded-full p-1 bg-muted/40">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-7 w-7 p-0 rounded-full"
                >
                  <Grid3x3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-7 w-7 p-0 rounded-full"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Room Comparison Section */}
        {filteredAndSortedRooms.length > 0 ? (
          <div className="space-y-12">
            {Object.entries(groupedRoomsByType).map(([typeName, roomsForType]) => {
              const matchingType = hostel?.roomTypes?.find(
                rt => rt.name.toLowerCase().trim() === typeName.toLowerCase().trim() ||
                      rt.id === roomsForType[0]?.roomTypeId
              );
              const amenitiesList = (matchingType?.roomAmenities && matchingType.roomAmenities.length > 0)
                ? matchingType.roomAmenities
                : (roomsForType[0]?.amenities && roomsForType[0].amenities.length > 0)
                ? roomsForType[0].amenities
                : [
                    `${roomsForType[0]?.capacity || 1} Student Bedding`,
                    'Lockable Wardrobe',
                    'Study Desk & Chair',
                    'Ceiling Fan',
                    'Washroom Facilities'
                  ];

              return (
                <div key={typeName} className="space-y-5">
                  {/* Room Type Header & Quick Inclusions Banner */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-xl font-bold font-headline text-foreground flex items-center gap-2">
                          <Bed className="h-5 w-5 text-primary" />
                          {typeName}
                        </h3>
                        <Badge variant="outline" className="text-xs font-semibold">
                          GH₵{roomsForType[0]?.price.toLocaleString()} / yr
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {roomsForType.length} {roomsForType.length === 1 ? 'room option' : 'room options'}
                      </span>
                    </div>

                    {/* What's Included for this room type strip */}
                    <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
                            What's Included in {typeName}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-medium">Included for every student in this room</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {amenitiesList.slice(0, 5).map((amenity) => (
                            <span
                              key={amenity}
                              className="inline-flex items-center gap-1 text-xs bg-background/90 border border-border/80 px-2.5 py-1 rounded-lg text-foreground font-medium shadow-xs"
                            >
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              {amenity}
                            </span>
                          ))}
                          {amenitiesList.length > 5 && (
                            <span className="text-xs text-muted-foreground font-medium self-center pl-1">
                              +{amenitiesList.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-white font-bold text-xs h-9 shrink-0 gap-1.5"
                        onClick={() => {
                          setModalRoomType(matchingType || {
                            id: roomsForType[0]?.roomTypeId || roomsForType[0]?.id || typeName,
                            name: typeName,
                            price: roomsForType[0]?.price || 0,
                            capacity: roomsForType[0]?.capacity || 1,
                            numberOfRooms: roomsForType.length,
                            roomAmenities: amenitiesList
                          });
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Compare Inclusions & Security</span>
                      </Button>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "gap-6",
                      viewMode === 'grid'
                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                        : "flex flex-col"
                    )}
                  >
                    {roomsForType.map((room) => (
                      <Card
                        key={room.id}
                        className={cn(
                          "rounded-3xl border border-border/70 bg-card/80 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/40 group flex flex-col justify-between",
                          viewMode === 'list' && "sm:flex-row sm:items-center sm:gap-6"
                        )}
                      >
                        <div 
                          className={cn("relative overflow-hidden bg-muted cursor-pointer", viewMode === 'grid' ? "h-52 w-full" : "h-44 sm:w-64 shrink-0")}
                          onClick={() => {
                            const slidesToOpen = (room.images && room.images.length > 0)
                              ? [...room.images, ...(hostel?.images || []).filter(img => !room.images!.includes(img))]
                              : [room.image, ...(hostel?.images || []).filter(img => img !== room.image)];
                            setLightboxImages(slidesToOpen);
                            setActiveImageIndex(0);
                            setLightboxOpen(true);
                          }}
                          title="Click to view room photos in fullscreen"
                        >
                          <Image
                            src={room.image}
                            alt={room.label}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

                          {/* Hover indicator */}
                          <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="bg-black/70 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                              <Eye className="w-3 h-3" /> View {room.images && room.images.length > 1 ? `(${room.images.length})` : ''}
                            </span>
                          </div>

                          {/* Top badge indicators */}
                          <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                            <Badge className="bg-background/90 text-foreground backdrop-blur-md border-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                              {room.gender === 'Male' ? '♂ Male' : room.gender === 'Female' ? '♀ Female' : 'Mixed'}
                            </Badge>
                            {room.images && room.images.length > 1 && (
                              <Badge className="bg-black/75 text-white backdrop-blur-md border-0 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                <Camera className="w-2.5 h-2.5 text-primary" /> {room.images.length}
                              </Badge>
                            )}
                            {room.videos && room.videos.length > 0 && (
                              <Badge className="bg-indigo-600/90 text-white backdrop-blur-md border-0 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                <Film className="w-2.5 h-2.5" /> Video
                              </Badge>
                            )}
                          </div>

                          {/* Capacity info pill */}
                          <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md text-white text-[11px] font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/20">
                            <Users className="h-3 w-3" />
                            <span>
                              {room.capacity ? `${room.capacity} in a Room` : room.type}
                            </span>
                          </div>
                        </div>

                        <CardContent className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-lg text-foreground font-headline group-hover:text-primary transition-colors">
                                {room.label}
                              </h4>
                            </div>

                            <div className="flex items-baseline justify-between pt-1">
                              <div>
                                <span className="text-2xl font-extrabold text-primary font-headline">
                                  GH₵{room.price.toLocaleString()}
                                </span>
                                <span className="text-xs text-muted-foreground ml-1.5 font-medium">/ year</span>
                              </div>
                            </div>

                            {/* Room Specifications */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 font-medium">
                              {room.capacity && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5 text-primary" /> {room.capacity} Student{room.capacity > 1 ? 's' : ''}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Bed className="h-3.5 w-3.5 text-primary" /> Single Bed
                              </span>
                              <span className="flex items-center gap-1">
                                <Bath className="h-3.5 w-3.5 text-primary" /> Washroom
                              </span>
                            </div>

                            {/* Amenities Tags */}
                            {room.amenities && room.amenities.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-2">
                                {room.amenities.slice(0, 3).map((amenity) => (
                                  <span
                                    key={amenity}
                                    className="text-[10px] bg-muted/80 px-2 py-0.5 rounded-md text-muted-foreground font-medium"
                                  >
                                    {amenity}
                                  </span>
                                ))}
                                {room.amenities.length > 3 && (
                                  <span className="text-[10px] text-muted-foreground self-center">
                                    +{room.amenities.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* CTA Buttons */}
                          <div className="space-y-2 pt-2 border-t border-border/50">
                            <Button
                              className="w-full rounded-xl font-bold text-xs h-11"
                              disabled={hostel?.availability === 'Full' || hasSecuredHostel}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!hostel || hostel.availability === 'Full' || hasSecuredHostel) {
                                  return;
                                }

                                const params = new URLSearchParams();
                                params.set('roomTypeId', room.id);
                                if (room.id) params.set('roomId', room.id);
                                if (room.roomNumber) params.set('roomNumber', room.roomNumber);

                                const base = hasCompletedVisit ? 'secure' : 'book';
                                const target = `/hostels/${id}/${base}?${params.toString()}`;

                                if (appUser) {
                                  router.push(target);
                                } else {
                                  router.push(`/login?redirect=${encodeURIComponent(target)}`);
                                  toast({
                                    title: 'Login Required',
                                    description: hasCompletedVisit
                                      ? 'Please log in to secure this room.'
                                      : 'Please log in to request a visit for this room.',
                                  });
                                }
                              }}
                            >
                              {hostel?.availability === 'Full'
                                ? 'Hostel Fully Booked'
                                : hasSecuredHostel
                                ? 'Room Secured ✓'
                                : hasCompletedVisit
                                ? 'Secure This Room'
                                : 'Request Free Visit'}
                            </Button>

                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-[11px] font-semibold text-muted-foreground hover:text-primary flex items-center justify-center gap-1 h-8 rounded-lg"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalRoomType(matchingType || {
                                    id: room.roomTypeId || room.id,
                                    name: room.type,
                                    price: room.price,
                                    capacity: room.capacity || 1,
                                    numberOfRooms: 1,
                                    roomAmenities: room.amenities || amenitiesList
                                  });
                                }}
                              >
                                <Eye className="h-3 w-3" />
                                <span>Inclusions</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-[11px] font-semibold text-muted-foreground hover:text-primary flex items-center justify-center gap-1 h-8 rounded-lg"
                                onClick={() => router.push(`/hostels/${id}/rooms/${room.id}`)}
                              >
                                <span>Full Details</span>
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 rounded-3xl border border-dashed border-border/70 p-8 space-y-4">
            <DoorOpen className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold">No room configurations found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or search query to see other rooms.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-semibold"
              onClick={() => {
                setSearchQuery('');
                setRoomTypeFilter('');
                setGenderFilter('');
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}

        {/* Room Type Inclusions & Security Modal */}
        <Dialog open={!!modalRoomType} onOpenChange={(open) => !open && setModalRoomType(null)}>
          <DialogContent className="max-w-2xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Room Specifications & Inclusions
                </Badge>
                {modalRoomType?.capacity && (
                  <Badge variant="outline" className="text-xs font-semibold">
                    {modalRoomType.capacity} in a Room
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-2xl font-bold font-headline text-foreground">
                {modalRoomType?.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Detailed breakdown of all items, security provisions, and utilities included for this room type at {hostel?.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-3">
              {/* Price highlight */}
              {modalRoomType?.price && (
                <div className="p-4 rounded-2xl bg-muted/50 border border-border/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Official Rate</span>
                    <span className="text-2xl font-extrabold text-primary font-headline">
                      GH₵{modalRoomType.price.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5 font-medium">/ year</span>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-bold px-3 py-1">
                    Standard University Term
                  </Badge>
                </div>
              )}

              {/* In-Room Inclusions & Furnishings */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Bed className="h-4 w-4 text-primary" />
                  Room Amenities & Furnishings
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {((modalRoomType?.roomAmenities && modalRoomType.roomAmenities.length > 0)
                    ? modalRoomType.roomAmenities
                    : [
                        'Student Bed & Mattress',
                        'Study Desk & Chair',
                        'Lockable Wardrobe / Closet',
                        'Ceiling Fan',
                        'Standard Washroom Facility',
                        'Dedicated Power Socket'
                      ]
                  ).map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-card border border-border/70 text-sm font-medium"
                    >
                      <div className="h-6 w-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room & Building Security Standards */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Security & Safety Standards
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    'Lockable Room Door with Private Key',
                    ...(hostel?.securityAndSafety && hostel.securityAndSafety.length > 0
                      ? hostel.securityAndSafety
                      : ['CCTV Surveillance in corridors', '24-hour Access Gate', 'Fenced Compound', 'On-call Security Guard'])
                  ].map((sec) => (
                    <div
                      key={sec}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-card border border-border/70 text-sm font-medium"
                    >
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </div>
                      <span>{sec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Utilities & Bills Policy */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Utilities & Bills Breakdown
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="h-4 w-4" />
                      Included in Rent
                    </span>
                    <p className="text-muted-foreground">
                      {hostel?.billsIncluded && hostel.billsIncluded.length > 0
                        ? hostel.billsIncluded.join(', ')
                        : 'Water supply & municipal refuse collection are fully included in the annual fee.'}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                    <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-xs">
                      <Zap className="h-4 w-4" />
                      Paid Separately
                    </span>
                    <p className="text-muted-foreground">
                      {hostel?.billsExcluded && hostel.billsExcluded.length > 0
                        ? hostel.billsExcluded.join(', ')
                        : 'Prepaid electricity meter managed by room occupants as per personal consumption.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <Button
                  className="flex-1 rounded-xl font-bold h-11"
                  onClick={() => {
                    const firstRoom = modalRoomType?.name
                      ? (groupedRoomsByType[modalRoomType.name]?.[0])
                      : null;
                    if (firstRoom) {
                      router.push(`/hostels/${id}/rooms/${firstRoom.id}`);
                    } else {
                      setModalRoomType(null);
                    }
                  }}
                >
                  View Full Specifications & Room Photos
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* YARL Fullscreen Photo Lightbox for Rooms Comparison Page */}
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          index={activeImageIndex}
          on={{ view: ({ index }) => setActiveImageIndex(index) }}
          slides={(lightboxImages.length > 0 ? lightboxImages : (hostel?.images || ['/AAMUSTED-Full-shot.jpeg'])).map((src, i) => ({
            src,
            alt: `${hostel?.name || 'Room'} photo ${i + 1}`,
          }))}
          plugins={[Zoom, Counter]}
          styles={{
            container: { backgroundColor: '#000000' },
          }}
          carousel={{ finite: false }}
          controller={{ closeOnBackdropClick: true }}
          animation={{ fade: 250 }}
        />
      </main>
    </div>
  );
}

