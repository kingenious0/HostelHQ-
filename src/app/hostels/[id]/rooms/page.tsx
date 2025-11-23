"use client";

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/header';
import { getHostel, Hostel, RoomType } from '@/lib/data';
import { notFound, useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { Star, MapPin, Users, Bed, Bath, DoorOpen, ArrowLeft, Grid3x3, List, Search, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  role: 'student' | 'agent' | 'admin';
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

        // Try to resolve the correct RoomType for this physical room using roomTypeId
        const matchingType: RoomType | undefined = hostel.roomTypes?.find(
          (rt) => String(rt.id ?? '') === String(room.roomTypeId ?? '')
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

        const occupancyFromBookings =
          roomOccupancy[id] ?? roomOccupancy[String(matchingType?.id ?? typeName)] ?? 0;
        return {
          id,
          label: formatLabel(room.roomNumber ?? room.number ?? room.name, index),
          type: typeName,
          price: room.price ?? matchingType?.price ?? hostel.priceRange?.min ?? 0,
          occupancy: room.occupancy ?? room.occupants ?? occupancyFromBookings,
          capacity: capacity ?? null,
          gender: room.gender ?? room.genderTag ?? (hostel.gender || 'Mixed'),
          image: room.image ?? room.imageUrl ?? primaryImages[index % primaryImages.length],
          roomNumber: room.roomNumber ?? room.number,
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
      return {
        id: roomTypeId,
        label: roomType.name,
        type: roomType.name,
        price: roomType.price,
        occupancy: roomType.occupancy ?? occupancyFromBookings,
        capacity: capacity ?? null,
        gender: hostel.gender || 'Mixed',
        image: primaryImages[typeIndex % primaryImages.length],
        roomNumber: undefined,
        totalRooms: (roomType as any).numberOfRooms ?? null,
        amenities: roomType.roomAmenities ?? [],
      };
    });
  }, [hostel, primaryImages, roomOccupancy]);

  // Load current occupancy per room/roomType based on confirmed bookings
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
          const roomTypeId = data.roomTypeId || null;
          const roomTypeName = data.roomTypeName || data.roomType || null;
          if (roomTypeId) {
            counts[String(roomTypeId)] = (counts[String(roomTypeId)] || 0) + 1;
          }
          if (roomTypeName) {
            counts[String(roomTypeName)] = (counts[String(roomTypeName)] || 0) + 1;
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
      <main className="flex-1 bg-background">
        {/* Hero Section */}
        <section className="relative h-[300px] sm:h-[400px] w-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10">
          <div className="absolute inset-0">
            {hostel.images?.[0] && (
              <Image
                src={hostel.images[0]}
                alt={hostel.name}
                fill
                className="object-cover opacity-80"
                priority
              />
            )}
          </div>
          <div className="relative container mx-auto px-4 sm:px-6 h-full flex flex-col justify-center items-center text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="absolute top-4 left-4 sm:left-6 text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mt-8">
              {roomInventory.length} Rooms in {hostel.name.toUpperCase()}
            </h1>
            <div className="flex items-center justify-center text-white/90 mt-3">
              <MapPin className="h-5 w-5 mr-2" />
              <span className="text-lg sm:text-xl font-medium">{hostel.location}</span>
            </div>
          </div>
        </section>

        {/* Filters Section */}
        <section className="container mx-auto px-4 sm:px-6 -mt-2">
          <Card className="shadow-lg border border-border align-center bg-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex justify-center gap-4 mb-4">
                
                <Select
                  value={roomTypeFilter || '__all__'}
                  onValueChange={(value) => setRoomTypeFilter(value === '__all__' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Room Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Room Types</SelectItem>
                    {uniqueRoomTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={genderFilter || '__all__'}
                  onValueChange={(value) => setGenderFilter(value === '__all__' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Genders</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Rooms Section */}
        <section className="container mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold font-headline text-foreground">Select Rooms</h2>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search Room Number"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price-low">PRICE: LOW TO HIGH</SelectItem>
                  <SelectItem value="price-high">PRICE: HIGH TO LOW</SelectItem>
                  <SelectItem value="newest">NEWEST</SelectItem>
                  <SelectItem value="oldest">OLDEST</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 border rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-9"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-9"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {filteredAndSortedRooms.length > 0 ? (
            <div className="space-y-10">
              {Object.entries(groupedRoomsByType).map(([typeName, roomsForType]) => (
                <div key={typeName} className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-xl font-semibold font-headline text-foreground">
                      {typeName.toUpperCase()}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {roomsForType.length} room{roomsForType.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "gap-6",
                      viewMode === 'grid'
                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        : "flex flex-col"
                    )}
                  >
                    {roomsForType.map((room) => (
                      <Card
                        key={room.id}
                        className={cn(
                          "overflow-hidden transition-all hover:shadow-xl group cursor-pointer",
                          viewMode === 'list' && "flex flex-row"
                        )}
                        onClick={() => router.push(`/hostels/${id}/rooms/${room.id}`)}
                      >
                  <div className={cn(
                    "relative bg-background/40 overflow-hidden",
                    viewMode === 'grid' ? "h-48" : "h-32 w-32 flex-shrink-0"
                  )}>
                    <Image
                      src={room.image}
                      alt={room.label}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    {(() => {
                      const perRoomCapacity = room.capacity ?? null;
                      const totalCapacity =
                        perRoomCapacity && room.totalRooms
                          ? perRoomCapacity * room.totalRooms
                          : perRoomCapacity;
                      const used = totalCapacity != null
                        ? Math.max(0, Math.min(totalCapacity, room.occupancy))
                        : room.occupancy;
                      const isFull = totalCapacity != null && used >= totalCapacity;
                      const label = totalCapacity != null
                        ? isFull
                          ? 'Room Full'
                          : `${used} of ${totalCapacity} Occupied`
                        : `${room.occupancy} ${room.occupancy === 1 ? 'Occupant' : 'Occupants'}`;
                      return (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "absolute left-3 top-3 border-0",
                            isFull
                              ? "bg-red-600 text-white"
                              : "bg-slate-900/70 text-white"
                          )}
                        >
                          {label}
                        </Badge>
                      );
                    })()}
                    <div className="absolute right-3 top-3 flex gap-1">
                      <Badge variant="outline" className="bg-card/90 text-xs">
                        {room.gender === 'Male' ? '♂' : room.gender === 'Female' ? '♀' : 'Mixed'}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className={cn(
                    "p-4 flex flex-col",
                    viewMode === 'list' && "flex-1"
                  )}>
                    <div className="flex-1 space-y-2">
                      <h3 className="font-bold text-lg text-foreground">
                        {room.label}
                      </h3>
                      <p className="text-sm text-muted-foreground">{room.type}</p>

                      <div className="flex items-baseline justify-between">
                        <span className="text-xl font-bold text-primary">
                          GH₵{room.price.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">per year</span>
                      </div>

                      {room.capacity && room.totalRooms && (
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const totalSlots = room.capacity! * room.totalRooms!;
                            const used = Math.max(0, Math.min(totalSlots, room.occupancy));
                            const remainingSlots = Math.max(0, totalSlots - used);
                            const remainingRooms = Math.round(remainingSlots / room.capacity!);
                            return `${remainingRooms} of ${room.totalRooms} rooms available`;
                          })()}
                        </p>
                      )}

                      {room.amenities && room.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {room.amenities.slice(0, 3).map((amenity) => (
                            <Badge key={amenity} variant="outline" className="text-[10px] px-1.5 py-0.5">
                              {amenity}
                            </Badge>
                          ))}
                          {room.amenities.length > 3 && (
                            <span className="text-[10px] text-slate-500">+{room.amenities.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full mt-4"
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
                              : 'Please log in to book a visit for this room.',
                          });
                        }
                      }}
                    >
                      {hostel?.availability === 'Full'
                        ? 'Hostel Fully Booked'
                        : hasSecuredHostel
                        ? 'You already secured a room here'
                        : hasCompletedVisit
                        ? 'Secure Room'
                        : 'Book Room'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No rooms found matching your filters.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('');
                  setRoomTypeFilter('');
                  setGenderFilter('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

