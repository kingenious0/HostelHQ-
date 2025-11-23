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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {AlertTriangle, Edit, Loader2, PlusCircle, Repeat, Trash2, Users} from "lucide-react";
import {db, auth} from "@/lib/firebase";
import {collection, doc, getDoc, getDocs, onSnapshot, updateDoc, deleteDoc, addDoc} from "firebase/firestore";
import {onAuthStateChanged, type User} from "firebase/auth";
import type {Hostel, RoomType, Room} from "@/lib/data";
import {useToast} from "@/hooks/use-toast";

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

const deriveCapacityFromName = (name?: string | null) => {
  if (!name) return 0;
  const numericMatch = name.match(/\d+/);
  if (numericMatch) return Number(numericMatch[0]);
  const words: Record<string, number> = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6};
  const first = name.trim().split(" ")[0]?.toLowerCase() ?? "";
  return words[first] ?? 0;
};

const summarizeRoomTypes = (roomTypes: RoomType[]) => {
  return roomTypes.reduce(
    (acc, room) => {
      const capacity = room.capacity ?? deriveCapacityFromName(room.name);
      const occupancy = room.occupancy ?? 0;
      return {
        totalCapacity: acc.totalCapacity + (capacity || 0),
        totalOccupancy: acc.totalOccupancy + occupancy,
      };
    },
    {totalCapacity: 0, totalOccupancy: 0}
  );
};

export default function AdminListingsPage() {
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [approvedHostels, setApprovedHostels] = useState<ListingRow[]>([]);
  const [pendingHostels, setPendingHostels] = useState<ListingRow[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [roomsDialogOpen, setRoomsDialogOpen] = useState(false);
  const [roomsHostelId, setRoomsHostelId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomTypeId, setNewRoomTypeId] = useState<string>("");
  const [newRoomCapacity, setNewRoomCapacity] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomNumber, setEditRoomNumber] = useState("");
  const [savingRoomEdit, setSavingRoomEdit] = useState(false);
  const {toast} = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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

    const hydrateHostels = async (snapshots: ListingRow[], collectionName: "hostels" | "pendingHostels") => {
      return Promise.all(
        snapshots.map(async (hostel) => {
          const hostelRef = doc(db, collectionName, hostel.id);
          const roomTypesSnap = await getDocs(collection(hostelRef, "roomTypes"));
          const roomTypes = roomTypesSnap.docs.map((d) => ({id: d.id, ...d.data()}) as RoomType);
          const totals = summarizeRoomTypes(roomTypes);
          return {...hostel, roomTypes, ...totals};
        })
      );
    };

    const unsubApproved = onSnapshot(collection(db, "hostels"), async (snapshot) => {
      const hostels = snapshot.docs.map((docSnap) => ({id: docSnap.id, ...docSnap.data()})) as ListingRow[];
      const hydrated = await hydrateHostels(hostels, "hostels");
      setApprovedHostels(hydrated);
      setLoading(false);
    });

    const unsubPending = onSnapshot(collection(db, "pendingHostels"), async (snapshot) => {
      const hostels = snapshot.docs.map((docSnap) => ({id: docSnap.id, ...docSnap.data()})) as ListingRow[];
      const hydrated = await hydrateHostels(hostels, "pendingHostels");
      setPendingHostels(hydrated);
    });

    return () => {
      unsubApproved();
      unsubPending();
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

  const openRoomsDialogForHostel = async (hostelId: string) => {
    setRoomsHostelId(hostelId);
    setRoomsDialogOpen(true);
    setLoadingRooms(true);
    setNewRoomNumber("");
    setNewRoomTypeId("");
    setNewRoomCapacity("");
    setEditingRoomId(null);
    setEditRoomNumber("");

    try {
      const roomsCol = collection(db, "hostels", hostelId, "rooms");
      const snap = await getDocs(roomsCol);
      const list: Room[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Room) }));
      setRooms(list);
    } catch (error) {
      console.error("Error loading rooms for hostel", hostelId, error);
      toast({ title: "Could not load rooms", variant: "destructive" });
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!roomsHostelId) return;
    if (!newRoomNumber.trim() || !newRoomTypeId || !newRoomCapacity) {
      toast({ title: "Missing room details", description: "Please enter room number, type and capacity.", variant: "destructive" });
      return;
    }
    const capacity = Number(newRoomCapacity);
    if (Number.isNaN(capacity) || capacity <= 0) {
      toast({ title: "Invalid capacity", description: "Capacity must be a positive number.", variant: "destructive" });
      return;
    }

    try {
      const roomsCol = collection(db, "hostels", roomsHostelId, "rooms");
      const newRoom: Omit<Room, "id"> = {
        roomNumber: newRoomNumber.trim(),
        roomTypeId: newRoomTypeId,
        capacity,
        currentOccupancy: 0,
        status: "active",
      };
      const ref = await addDoc(roomsCol, newRoom);
      setRooms((prev) => [...prev, { ...newRoom, id: ref.id }]);
      setNewRoomNumber("");
      setNewRoomTypeId("");
      setNewRoomCapacity("");
      toast({ title: "Room created", description: `Room ${newRoom.roomNumber} has been added.` });
    } catch (error) {
      console.error("Error creating room:", error);
      toast({ title: "Could not create room", description: "Please try again later.", variant: "destructive" });
    }
  };

  const startEditRoom = (room: Room) => {
    setEditingRoomId(room.id ?? null);
    const raw = room.roomNumber || "";
    setEditRoomNumber(raw.toLowerCase().startsWith("room ") ? raw.slice(5) : raw);
  };

  const saveRoomEdit = async () => {
    if (!roomsHostelId || !editingRoomId) return;
    const trimmed = editRoomNumber.trim();
    if (!trimmed) {
      toast({ title: "Missing room number", description: "Please enter a room number.", variant: "destructive" });
      return;
    }
    try {
      setSavingRoomEdit(true);
      const ref = doc(db, "hostels", roomsHostelId, "rooms", editingRoomId);
      const roomNumber = trimmed.toLowerCase().startsWith("room ") ? trimmed : `Room ${trimmed}`;
      await updateDoc(ref, { roomNumber });
      setRooms((prev) => prev.map((r) => (r.id === editingRoomId ? { ...r, roomNumber } : r)));
      setEditingRoomId(null);
      setEditRoomNumber("");
      toast({ title: "Room updated", description: `Room number updated to ${roomNumber}.` });
    } catch (error) {
      console.error("Error updating room:", error);
      toast({ title: "Could not update room", description: "Please try again later.", variant: "destructive" });
    } finally {
      setSavingRoomEdit(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!roomsHostelId) return;
    if (!window.confirm("Delete this room permanently?")) return;
    try {
      await deleteDoc(doc(db, "hostels", roomsHostelId, "rooms", roomId));
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      toast({ title: "Room deleted" });
    } catch (error) {
      console.error("Error deleting room:", error);
      toast({ title: "Could not delete room", description: "Please try again later.", variant: "destructive" });
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

  const availabilityBadge = useMemo(
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
                    {approvedHostels.map((hostel) => (
                      <TableRow key={hostel.id}>
                        <TableCell>
                          <div className="font-semibold">{hostel.name}</div>
                          <p className="text-xs text-muted-foreground">{hostel.location}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={availabilityBadge[hostel.availability || "Full"]}>
                            {hostel.availability || "Full"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Users className="h-4 w-4 text-primary" />
                            {hostel.totalCapacity || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>{hostel.totalOccupancy || 0}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/agent/listings/edit/${hostel.id}`)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRoomsDialogForHostel(hostel.id)}
                          >
                            Manage Rooms
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
                    ))}
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
                    {pendingHostels.map((hostel) => (
                      <TableRow key={hostel.id}>
                        <TableCell>
                          <div className="font-semibold">{hostel.name}</div>
                          <p className="text-xs text-muted-foreground">
                            Submitted {hostel.dateSubmitted || "recently"}
                          </p>
                        </TableCell>
                        <TableCell>{hostel.totalCapacity || "N/A"}</TableCell>
                        <TableCell>{hostel.totalOccupancy || 0}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/agent/listings/edit/${hostel.id}`)}
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
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Manage Rooms dialog for admins */}
      <Dialog open={roomsDialogOpen} onOpenChange={setRoomsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Manage Rooms</DialogTitle>
            <DialogDescription>
              Create and view numbered rooms for this hostel. Students will be able to pick from these rooms when securing a bed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Existing rooms</h3>
              {loadingRooms ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rooms added yet for this hostel.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto rounded-md border border-muted/40">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                        <TableHead className="text-right">Occupancy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rooms.map((room) => {
                        const hostel =
                          approvedHostels.find((h) => h.id === roomsHostelId) ||
                          pendingHostels.find((h) => h.id === roomsHostelId);
                        const matchingType = hostel?.roomTypes?.find(
                          (rt) => String(rt.id ?? "") === String(room.roomTypeId ?? "")
                        );
                        const typeName =
                          (matchingType && matchingType.name) ||
                          room.roomTypeId ||
                          "Unknown type";
                        return (
                          <TableRow key={room.id}>
                            <TableCell className="font-medium">
                              {editingRoomId === room.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editRoomNumber}
                                    onChange={(e) => setEditRoomNumber(e.target.value)}
                                    className="h-8 max-w-[140px]"
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={saveRoomEdit}
                                    disabled={savingRoomEdit}
                                  >
                                    {savingRoomEdit ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "✓"
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                room.roomNumber || "—"
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {typeName}
                            </TableCell>
                            <TableCell>
                              {editingRoomId !== room.id && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="xs"
                                    onClick={() => startEditRoom(room)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="xs"
                                    onClick={() => handleDeleteRoom(room.id!)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {room.currentOccupancy} / {room.capacity}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-muted/40 pt-4">
              <h3 className="text-sm font-medium">Add a new room</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="roomNumber">Room number</Label>
                  <Input
                    id="roomNumber"
                    placeholder="101, B12..."
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="roomType">Room type ID</Label>
                  <Input
                    id="roomType"
                    placeholder="roomTypeId"
                    value={newRoomTypeId}
                    onChange={(e) => setNewRoomTypeId(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min={1}
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={handleCreateRoom}>
                  Add room
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

