"use client";

import {useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {Header} from "@/components/header";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {AlertTriangle, Edit, Loader2, PlusCircle, Repeat, Trash2, Users} from "lucide-react";
import {db, auth} from "@/lib/firebase";
import {collection, doc, getDoc, getDocs, onSnapshot, updateDoc, deleteDoc, query, where} from "firebase/firestore";
import {onAuthStateChanged, type User} from "firebase/auth";
import type {Hostel, RoomType} from "@/lib/data";
import {useToast} from "@/hooks/use-toast";
import {fetchHostelOccupanciesAction} from "@/app/actions/db";

type ListingRow = {
  id: string;
  name?: string;
  location?: string;
  availability?: Hostel["availability"];
  dateSubmitted?: string;
  totalCapacity: number;
  totalOccupancy: number;
  roomTypes?: RoomType[];
  [key: string]: any;
};

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const deriveCapacityFromName = (name?: string | null) => {
  if (!name) return 0;
  const numericMatch = name.match(/\d+/);
  if (numericMatch) return Number(numericMatch[0]);
  const words: Record<string, number> = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6};
  const first = name.trim().split(" ")[0]?.toLowerCase() ?? "";
  return words[first] ?? 0;
};

const calculateHostelCapacity = (hostel: any, roomTypes: RoomType[] = []) => {
  if (typeof hostel.totalCapacity === "number" && hostel.totalCapacity > 0) {
    return hostel.totalCapacity;
  }
  if (typeof hostel.capacity === "number" && hostel.capacity > 0) {
    return hostel.capacity;
  }
  const rTypes = roomTypes.length > 0 ? roomTypes : (Array.isArray(hostel.roomTypes) ? hostel.roomTypes : []);
  if (rTypes.length > 0) {
    return rTypes.reduce((sum: number, rt: any) => {
      const capPerRoom = Number(rt.capacity) || deriveCapacityFromName(rt.name) || 1;
      const numRooms = Number(rt.numberOfRooms) || (Array.isArray(rt.roomNumbers) ? rt.roomNumbers.length : 1);
      return sum + (capPerRoom * numRooms);
    }, 0);
  }
  if (Array.isArray(hostel.rooms) && hostel.rooms.length > 0) {
    return hostel.rooms.reduce((sum: number, r: any) => sum + (Number(r.capacity) || 1), 0);
  }
  return 0;
};

export default function AdminListingsPage() {
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [approvedHostels, setApprovedHostels] = useState<ListingRow[]>([]);
  const [pendingHostels, setPendingHostels] = useState<ListingRow[]>([]);
  const [realtimeOccupancy, setRealtimeOccupancy] = useState<Record<string, number>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const {toast} = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: any) => {
      setCurrentUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserRole((userDoc.data() as any).role ?? null);
        } else {
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser || userRole !== "admin") return;

    setLoading(true);

    // Initial occupancy aggregation seed from backend
    fetchHostelOccupanciesAction().then((res) => {
      if (res.success && res.occupancies) {
        setRealtimeOccupancy((prev) => ({ ...prev, ...res.occupancies }));
      }
    });

    // Real-time confirmed & active bookings listener
    const bookingsQuery = query(
      collection(db, "bookings"),
      where("status", "in", ["confirmed", "active", "completed"])
    );

    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snapshot: any) => {
        const counts: Record<string, number> = {};
        snapshot.docs.forEach((docSnap: any) => {
          const data = docSnap.data();
          const hId = data.hostelId;
          if (hId) {
            const beds = Number(data.assignedBeds || data.bedsCount || data.bedCount) || 1;
            counts[hId] = (counts[hId] || 0) + beds;
          }
        });
        setRealtimeOccupancy(counts);
      },
      (err: any) => {
        console.warn("Real-time bookings snapshot note (falling back to server action):", err);
        fetchHostelOccupanciesAction().then((res) => {
          if (res.success && res.occupancies) {
            setRealtimeOccupancy(res.occupancies);
          }
        });
      }
    );

    const hydrateHostels = async (snapshots: ListingRow[], collectionName: "hostels" | "pendingHostels") => {
      return Promise.all(
        snapshots.map(async (hostel) => {
          let roomTypes: RoomType[] = Array.isArray(hostel.roomTypes) ? hostel.roomTypes : [];
          try {
            const hostelRef = doc(db, collectionName, hostel.id);
            const roomTypesSnap = await getDocs(collection(hostelRef, "roomTypes"));
            if (!roomTypesSnap.empty) {
              roomTypes = roomTypesSnap.docs.map((d: any) => ({id: d.id, ...d.data()}) as RoomType);
            }
          } catch (err) {
            console.warn(`Could not fetch roomTypes subcollection for ${hostel.id}:`, err);
          }
          const totalCapacity = calculateHostelCapacity(hostel, roomTypes);
          return {...hostel, roomTypes, totalCapacity};
        })
      );
    };

    const unsubApproved = onSnapshot(collection(db, "hostels"), async (snapshot: any) => {
      const hostels = snapshot.docs.map((docSnap: any) => ({id: docSnap.id, ...docSnap.data()})) as ListingRow[];
      const deduplicated = deduplicateById(hostels);
      const hydrated = await hydrateHostels(deduplicated, "hostels");
      setApprovedHostels(deduplicateById(hydrated));
      setLoading(false);
    });

    const unsubPending = onSnapshot(collection(db, "pendingHostels"), async (snapshot: any) => {
      const hostels = snapshot.docs.map((docSnap: any) => ({id: docSnap.id, ...docSnap.data()})) as ListingRow[];
      const deduplicated = deduplicateById(hostels);
      const hydrated = await hydrateHostels(deduplicated, "pendingHostels");
      setPendingHostels(deduplicateById(hydrated));
    });

    return () => {
      unsubApproved();
      unsubPending();
      unsubBookings();
    };
  }, [currentUser, userRole]);

  const handleDelete = async (id: string, collectionName: "hostels" | "pendingHostels") => {
    if (!window.confirm("Delete this hostel listing permanently?")) return;
    setProcessingId(id);
    try {
      await deleteDoc(doc(db, collectionName, id));
      toast({title: "Hostel deleted"});
    } catch (error) {
      console.error(error);
      toast({title: "Failed to delete hostel", variant: "destructive"});
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleAvailability = async (hostel: ListingRow) => {
    const sequence: Record<string, Hostel["availability"]> = {
      Available: "Limited",
      Limited: "Full",
      Full: "Available",
    };
    const nextState = sequence[hostel.availability || "Full"];
    setProcessingId(hostel.id);
    try {
      await updateDoc(doc(db, "hostels", hostel.id), {availability: nextState});
      toast({title: "Availability updated", description: `${hostel.name} is now ${nextState}`});
    } catch (error) {
      console.error(error);
      toast({title: "Failed to update availability", variant: "destructive"});
    } finally {
      setProcessingId(null);
    }
  };

  const availabilityBadge: Record<string, "default" | "secondary" | "destructive" | "outline"> = useMemo(
    () => ({
      Available: "default",
      Limited: "secondary",
      Full: "destructive",
    }),
    []
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!currentUser || userRole !== "admin") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center bg-gray-50/50 px-4 py-12">
          <Alert variant="destructive" className="max-w-lg">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access denied</AlertTitle>
            <AlertDescription>You must be an admin to manage all listings.</AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
        <div className="container mx-auto space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold">Admin Listings</h1>
              <p className="text-sm text-muted-foreground">Create, audit, and edit every hostel on the platform.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>
                Dashboard
              </Button>
              <Link href="/admin/upload">
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Hostel
                </Button>
              </Link>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Live Hostels</CardTitle>
              <CardDescription>Every hostel currently visible to students.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loading ? (
                <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading hostels...
                </div>
              ) : approvedHostels.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No approved hostels yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hostel</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Occupancy</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedHostels.map((hostel) => {
                      const occupancy = realtimeOccupancy[hostel.id] ?? hostel.totalOccupancy ?? 0;
                      const capacity = hostel.totalCapacity || 0;
                      const percentage = capacity > 0 ? Math.min(100, Math.round((occupancy / capacity) * 100)) : null;
                      const isFull = capacity > 0 && occupancy >= capacity;

                      return (
                        <TableRow key={hostel.id}>
                          <TableCell>
                            <div className="font-semibold">{hostel.name}</div>
                            <p className="text-xs text-muted-foreground">{hostel.location}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={availabilityBadge[hostel.availability || "Full"] || "default"}>
                              {hostel.availability || "Full"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <Users className="h-4 w-4 text-primary" />
                              {capacity > 0 ? capacity : "N/A"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5 min-w-[130px]">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">
                                  {occupancy}
                                  {capacity > 0 && (
                                    <span className="text-muted-foreground font-normal"> / {capacity}</span>
                                  )}
                                </span>
                                {isFull ? (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-semibold">
                                    Full
                                  </Badge>
                                ) : percentage !== null ? (
                                  <Badge
                                    variant={percentage >= 80 ? "secondary" : "outline"}
                                    className={`text-[10px] px-1.5 py-0 h-4 font-medium ${
                                      percentage >= 80 ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200" : ""
                                    }`}
                                  >
                                    {percentage}%
                                  </Badge>
                                ) : occupancy > 0 ? (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    {occupancy} active
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                                    Vacant
                                  </Badge>
                                )}
                              </div>
                              {capacity > 0 && (
                                <div className="w-full max-w-[110px] bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      isFull
                                        ? "bg-red-500"
                                        : (percentage ?? 0) >= 80
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${Math.min(100, percentage ?? 0)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/hostels/${hostel.id}`)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              title="Cycle availability"
                              onClick={() => handleToggleAvailability(hostel)}
                              disabled={processingId === hostel.id}
                            >
                              {processingId === hostel.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Repeat className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-9 w-9"
                              title="Delete hostel"
                              onClick={() => handleDelete(hostel.id, "hostels")}
                              disabled={processingId === hostel.id}
                            >
                              {processingId === hostel.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Submissions</CardTitle>
              <CardDescription>Hostels awaiting approval or edits.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {pendingHostels.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No pending hostels.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hostel</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Occupancy</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingHostels.map((hostel) => {
                      const occupancy = realtimeOccupancy[hostel.id] ?? hostel.totalOccupancy ?? 0;
                      const capacity = hostel.totalCapacity || 0;
                      const percentage = capacity > 0 ? Math.min(100, Math.round((occupancy / capacity) * 100)) : null;
                      const isFull = capacity > 0 && occupancy >= capacity;

                      return (
                        <TableRow key={hostel.id}>
                          <TableCell>
                            <div className="font-semibold">{hostel.name}</div>
                            <p className="text-xs text-muted-foreground">
                              Submitted {hostel.dateSubmitted || "recently"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <Users className="h-4 w-4 text-primary" />
                              {capacity > 0 ? capacity : "N/A"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5 min-w-[130px]">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">
                                  {occupancy}
                                  {capacity > 0 && (
                                    <span className="text-muted-foreground font-normal"> / {capacity}</span>
                                  )}
                                </span>
                                {isFull ? (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-semibold">
                                    Full
                                  </Badge>
                                ) : percentage !== null ? (
                                  <Badge
                                    variant={percentage >= 80 ? "secondary" : "outline"}
                                    className={`text-[10px] px-1.5 py-0 h-4 font-medium ${
                                      percentage >= 80 ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200" : ""
                                    }`}
                                  >
                                    {percentage}%
                                  </Badge>
                                ) : occupancy > 0 ? (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    {occupancy} active
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                                    Vacant
                                  </Badge>
                                )}
                              </div>
                              {capacity > 0 && (
                                <div className="w-full max-w-[110px] bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      isFull
                                        ? "bg-red-500"
                                        : (percentage ?? 0) >= 80
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${Math.min(100, percentage ?? 0)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/hostels/${hostel.id}`)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Review
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => handleDelete(hostel.id, "pendingHostels")}
                              disabled={processingId === hostel.id}
                              title="Delete pending hostel"
                            >
                              {processingId === hostel.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

    </div>
  );
}

