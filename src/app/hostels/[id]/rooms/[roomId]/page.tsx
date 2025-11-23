"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import Image from "next/image";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Users, Bed, ShieldCheck, ArrowLeft } from "lucide-react";
import { getHostel, Hostel, RoomType } from "@/lib/data";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

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
          occupancy: found.occupancy ?? found.occupants ?? 0,
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
    return `${remainingRooms} of ${room.totalRooms} rooms available`;
  })();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to rooms
          </Button>

          <Card className="overflow-hidden shadow-xl border border-border bg-card">
            <div className="relative h-56 w-full">
              <Image
                src={room.image}
                alt={room.label}
                fill
                className="object-cover"
              />
              <Badge className="absolute left-3 top-3 bg-black/70 text-white border-0">
                {hostel.name}
              </Badge>
              <Badge variant="secondary" className="absolute right-3 top-3 bg-white/90 text-xs">
                {room.gender === "Male" ? "Male" : room.gender === "Female" ? "Female" : "Mixed"} room
              </Badge>
            </div>

            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4">
                <span>{room.label}</span>
                <span className="text-primary text-xl font-bold">
                  GH₵{room.price.toLocaleString()}
                </span>
              </CardTitle>
              <CardDescription>
                {room.type} in {hostel.name} &middot; {hostel.location}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {room.capacity && (
                  <span className="flex items-center gap-1">
                    <Bed className="h-4 w-4" />
                     {room.capacity} Beds per room
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {room.occupancy} {room.occupancy === 1 ? "student" : "students"} currently here
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {hostel.location}
                </span>
              </div>

              {remainingInfo && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-1">
                  {remainingInfo}
                </p>
              )}

              {room.amenities && room.amenities.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Key amenities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {room.amenities.slice(0, 6).map((amenity) => (
                      <Badge key={amenity} variant="outline" className="text-[10px] px-2 py-0.5">
                        {amenity}
                      </Badge>
                    ))}
                    {room.amenities.length > 6 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{room.amenities.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4">
                <Button
                  className="w-full h-11 flex items-center justify-center gap-2"
                  onClick={handlePrimaryAction}
                  disabled={hostel.availability === 'Full' || hasSecuredHostel}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {hostel.availability === 'Full'
                    ? 'Hostel Fully Booked'
                    : hasSecuredHostel
                    ? 'You already secured a room here'
                    : hasCompletedVisit
                    ? 'Secure this room'
                    : 'Book a visit for this room'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
