
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DollarSign, BarChart, Users, CheckCircle, XCircle, Loader2, Trash2, Repeat, UserCheck, UserX, Wifi, Bed, Bath, Star, MessageSquare, FileText } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, Timestamp, getDocs, updateDoc, writeBatch, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ably } from '@/lib/ably';
import { Types } from 'ably';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RoomType, Review } from '@/lib/data';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type Hostel = {
  id: string;
  name: string;
  agentId: string;
  location: string;
  price: number;
  availability: 'Available' | 'Limited' | 'Full';
  isFeatured?: boolean;
  [key: string]: any;
};

type PendingHostel = Omit<Hostel, 'availability'> & {
  dateSubmitted: string;
  roomTypes: RoomType[];
};

type User = {
  id: string;
  fullName: string;
  email: string;
  role: 'student' | 'agent' | 'admin' | 'pending_agent';
}

type OnlineAgent = {
  clientId: string;
  data: {
      id: string;
      fullName: string;
      email: string;
  }
}

const availabilityCycle: Record<Hostel['availability'], Hostel['availability']> = {
  'Available': 'Limited',
  'Limited': 'Full',
  'Full': 'Available',
};

const availabilityVariant: Record<Hostel['availability'], "default" | "secondary" | "destructive"> = {
    'Available': 'default',
    'Limited': 'secondary',
    'Full': 'destructive'
}


export default function AdminDashboard() {
  const [pendingHostels, setPendingHostels] = useState<PendingHostel[]>([]);
  const [approvedHostels, setApprovedHostels] = useState<Hostel[]>([]);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pendingAgents, setPendingAgents] = useState<User[]>([]);
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedHostel, setSelectedHostel] = useState<PendingHostel | null>(null);
  const [isHostelDialogOpen, setIsHostelDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Real-time pending hostels
    const unsubPending = onSnapshot(collection(db, 'pendingHostels'), (snapshot) => {
      const hostelsData = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = (data.dateSubmitted as Timestamp)?.toDate ? (data.dateSubmitted as Timestamp).toDate().toLocaleDateString() : new Date(data.dateSubmitted).toLocaleDateString();
        return {
          id: doc.id,
          name: data.name || 'No Name',
          agentId: data.agentId || 'Unknown Agent',
          location: data.location || 'No Location',
          dateSubmitted: date,
          price: data.price || 0,
          description: data.description || 'No description provided.',
          images: data.images || [],
          amenities: data.amenities || [],
          roomTypes: [], // Will be fetched on review
        } as PendingHostel
      });
      setPendingHostels(hostelsData);
      setLoading(false);
    });

    // Real-time approved hostels
    const unsubApproved = onSnapshot(collection(db, 'hostels'), (snapshot) => {
      const hostelsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hostel));
      setApprovedHostels(hostelsData);
    });

    // Fetch all users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(usersData);
    });

    // Fetch pending agents
    const unsubPendingAgents = onSnapshot(collection(db, 'pendingUsers'), (snapshot) => {
        const agentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setPendingAgents(agentsData);
    });
    
     // Real-time pending reviews
    const reviewsQuery = query(collection(db, 'reviews'), where('status', '==', 'pending'));
    const unsubReviews = onSnapshot(reviewsQuery, (snapshot) => {
        const reviewsData = snapshot.docs.map(doc => {
            const data = doc.data();
            const date = (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toLocaleDateString() : new Date(data.createdAt).toLocaleDateString();
            return {
                id: doc.id,
                ...data,
                createdAt: date
            } as Review;
        });
        setPendingReviews(reviewsData);
    });

    // Ably presence for online agents
    const presenceChannel = ably.channels.get('agents:live');
    const updateOnlineAgents = (agents: Types.PresenceMessage[]) => {
      setOnlineAgents(agents.map(a => ({ clientId: a.clientId, data: a.data as any })));
    };
    const setupPresenceListener = async () => {
        await presenceChannel.presence.subscribe(['enter', 'present', 'leave'], () => {
            presenceChannel.presence.get().then(updateOnlineAgents);
        });
        const initialAgents = await presenceChannel.presence.get();
        updateOnlineAgents(initialAgents);
    };
    setupPresenceListener();


    return () => {
      unsubPending();
      unsubApproved();
      unsubUsers();
      unsubPendingAgents();
      unsubReviews();
      presenceChannel.presence.unsubscribe();
    };
  }, []);

  const handleApprove = async (hostelId: string) => {
    setProcessingId(hostelId);
    toast({ title: "Approving Hostel..." });
    try {
        const pendingDocRef = doc(db, 'pendingHostels', hostelId);
        const batch = writeBatch(db);

        // Fetch the main hostel document
        const pendingDocSnap = await getDoc(pendingDocRef);
        if (!pendingDocSnap.exists()) {
            throw new Error("Hostel not found in pending list.");
        }
        
        const { id, roomTypes, ...hostelData } = selectedHostel as PendingHostel;
        
        // Define the new approved hostel document
        const approvedDocRef = doc(db, 'hostels', hostelId);
        batch.set(approvedDocRef, {
            ...hostelData,
            status: 'approved',
            approvedAt: new Date().toISOString(),
        });
        
        // Copy all room types from subcollection
        if (roomTypes && roomTypes.length > 0) {
            for (const room of roomTypes) {
                const newRoomRef = doc(collection(approvedDocRef, 'roomTypes'));
                batch.set(newRoomRef, room);
            }
        }

        // Delete the original pending document
        batch.delete(pendingDocRef);
        
        // Commit the batch
        await batch.commit();

        toast({ title: "Hostel Approved", description: `${hostelData.name} is now live.` });
        setIsHostelDialogOpen(false);
        setSelectedHostel(null);

    } catch (error) {
        console.error("Error approving hostel: ", error);
        toast({ title: "Approval Failed", description: "An error occurred.", variant: "destructive" });
    } finally {
        setProcessingId(null);
    }
  };


  const handleReject = async (hostelId: string) => {
    setProcessingId(hostelId);
    toast({ title: "Rejecting Hostel..." });
    try {
      await deleteDoc(doc(db, 'pendingHostels', hostelId));
      toast({ title: "Hostel Rejected", description: "The submission has been removed." });
      setIsHostelDialogOpen(false);
      setSelectedHostel(null);
    } catch (error) {
      console.error("Error rejecting hostel: ", error);
      toast({ title: "Rejection Failed", description: "An error occurred.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };
  
    const handleAgentApproval = async (agent: User) => {
        setProcessingId(agent.id);
        toast({ title: "Approving Agent..." });
        try {
            const batch = writeBatch(db);
            const pendingAgentRef = doc(db, 'pendingUsers', agent.id);
            const userRef = doc(db, 'users', agent.id);
            
            // Create a new object for the user, excluding the 'id' field to avoid undefined values.
            const { id, ...agentDataForUser } = agent;

            // Set the final user document with the 'agent' role
            batch.set(userRef, { ...agentDataForUser, role: 'agent' });
            
            // Delete the pending user document
            batch.delete(pendingAgentRef);

            await batch.commit();

            toast({ title: "Agent Approved", description: `${agent.fullName} is now an active agent.` });

        } catch (error) {
            console.error("Error approving agent:", error);
            toast({ title: "Approval Failed", description: "An error occurred.", variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    };
    
    const handleAgentRejection = async (agentId: string) => {
        if (!confirm("Are you sure you want to reject and delete this agent application? This action cannot be undone.")) return;
        
        setProcessingId(agentId);
        toast({ title: "Rejecting Agent..." });
        try {
            // Note: A backend function would be needed to delete the Firebase Auth user.
            // This client-side action can only delete the Firestore record.
            await deleteDoc(doc(db, 'pendingUsers', agentId));
            toast({ title: "Agent Rejected", description: "The application has been deleted." });
        } catch (error) {
            console.error("Error rejecting agent:", error);
            toast({ title: "Rejection Failed", description: "An error occurred.", variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    };

    const handleReviewAction = async (reviewId: string, action: 'approve' | 'reject') => {
        setProcessingId(reviewId);
        const reviewRef = doc(db, 'reviews', reviewId);
        
        try {
            if (action === 'approve') {
                await updateDoc(reviewRef, { status: 'approved' });
                toast({ title: "Review Approved", description: "The review is now public." });
            } else { // reject
                await deleteDoc(reviewRef);
                toast({ title: "Review Rejected", description: "The review has been deleted." });
            }
        } catch (error) {
            console.error(`Error ${action}ing review:`, error);
            toast({ title: "Action Failed", description: `Could not ${action} the review.`, variant: 'destructive' });
        } finally {
            setProcessingId(null);
        }
    };

  const handleDeleteApproved = async (hostelId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this hostel? This action cannot be undone.")) {
        return;
    }
    setProcessingId(hostelId);
    toast({ title: "Deleting Hostel..." });
    try {
        await deleteDoc(doc(db, 'hostels', hostelId));
        toast({ title: "Hostel Deleted", description: "The listing has been permanently removed." });
    } catch (error) {
        console.error("Error deleting hostel: ", error);
        toast({ title: "Deletion Failed", description: "An error occurred.", variant: "destructive" });
    } finally {
        setProcessingId(null);
    }
};

  const handleToggleAvailability = async (hostel: Hostel) => {
      setProcessingId(hostel.id);
      const newAvailability = availabilityCycle[hostel.availability || 'Full'];
      try {
          const hostelRef = doc(db, 'hostels', hostel.id);
          await updateDoc(hostelRef, { availability: newAvailability });
          toast({ title: "Status Updated", description: `${hostel.name} is now set to ${newAvailability}.`});
      } catch (error) {
          console.error("Error updating availability:", error);
          toast({ title: "Update Failed", description: "Could not update status.", variant: "destructive"});
      } finally {
          setProcessingId(null);
      }
  }

  const handleToggleFeatured = async (hostel: Hostel) => {
    setProcessingId(hostel.id);
    const newFeaturedState = !hostel.isFeatured;
    try {
        const hostelRef = doc(db, 'hostels', hostel.id);
        await updateDoc(hostelRef, { isFeatured: newFeaturedState });
        toast({ title: "Featured Status Updated", description: `${hostel.name} is ${newFeaturedState ? 'now featured' : 'no longer featured'}.`});
    } catch (error) {
        console.error("Error updating featured status:", error);
        toast({ title: "Update Failed", description: "Could not update featured status.", variant: "destructive"});
    } finally {
        setProcessingId(null);
    }
}


  const toggleUserRole = async (user: User) => {
    const newRole = user.role === 'student' ? 'agent' : 'student';
    if(!confirm(`Are you sure you want to change ${user.fullName}'s role to ${newRole}?`)) return;

    setProcessingId(user.id);
    toast({ title: 'Updating user role...'});
    try {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, { role: newRole });
        toast({ title: 'Role Updated', description: `${user.fullName} is now an ${newRole}.`});
    } catch (error) {
        console.error("Error updating user role:", error);
        toast({ title: 'Update Failed', description: "Could not update user role.", variant: "destructive"});
    } finally {
        setProcessingId(null);
    }
  }


  const openHostelReviewDialog = async (hostel: PendingHostel) => {
    // Fetch full details including room types before opening dialog
    const pendingDocRef = doc(db, 'pendingHostels', hostel.id);
    const roomTypesRef = collection(pendingDocRef, 'roomTypes');
    
    const [hostelSnap, roomTypesSnap] = await Promise.all([
        getDoc(pendingDocRef),
        getDocs(roomTypesRef)
    ]);

    if(hostelSnap.exists()) {
        const fetchedRoomTypes = roomTypesSnap.docs.map(d => ({...d.data(), id: d.id})) as RoomType[];
        const fullHostelData = {
            ...hostelSnap.data(),
            id: hostelSnap.id,
            roomTypes: fetchedRoomTypes
        } as PendingHostel;

        setSelectedHostel(fullHostelData);
        setIsHostelDialogOpen(true);
    } else {
        toast({ title: "Error", description: "Could not fetch hostel details.", variant: 'destructive'});
    }
  }

  const students = users.filter(u => u.role === 'student');
  const agents = users.filter(u => u.role === 'agent');
  const totalPending = pendingHostels.length + pendingAgents.length + pendingReviews.length;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold font-headline mb-6">Admin Dashboard</h1>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{students.length}</div>
                <p className="text-xs text-muted-foreground">Registered students</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Agents</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agents.length}</div>
                 <p className="text-xs text-muted-foreground">Registered agents</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Online Agents</CardTitle>
                <Wifi className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{onlineAgents.length}</div>
                 <p className="text-xs text-muted-foreground">Currently active</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved Listings</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{approvedHostels.length}</div>
                 <p className="text-xs text-muted-foreground">Live on the platform</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                <Loader2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalPending}</div>
                 <p className="text-xs text-muted-foreground">Hostels, Agents & Reviews</p>
              </CardContent>
            </Card>
          </div>

            <div className="grid gap-8 lg:grid-cols-2 mb-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Hostel Approvals</CardTitle>
                        <CardDescription>Review and approve or reject new hostel listings.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="ml-4 text-muted-foreground">Loading pending hostels...</p>
                        </div>
                        ) : (
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Hostel Name</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {pendingHostels.length > 0 ? (
                                pendingHostels.map(hostel => (
                                <TableRow key={hostel.id}>
                                    <TableCell className="font-medium">{hostel.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{hostel.dateSubmitted}</TableCell>
                                    <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => openHostelReviewDialog(hostel)}>Review</Button>
                                    </TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">
                                        No pending hostels.
                                    </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Agent Approvals</CardTitle>
                        <CardDescription>Review and approve or reject new agent applications.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Full Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingAgents.length > 0 ? (
                                    pendingAgents.map(agent => (
                                        <TableRow key={agent.id}>
                                            <TableCell className="font-medium">{agent.fullName}</TableCell>
                                            <TableCell>{agent.email}</TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button
                                                    variant="ghost" size="sm"
                                                    disabled={processingId === agent.id}
                                                    onClick={() => handleAgentRejection(agent.id)}
                                                ><XCircle className="h-4 w-4" /></Button>
                                                <Button
                                                    size="sm"
                                                    disabled={processingId === agent.id}
                                                    onClick={() => handleAgentApproval(agent)}
                                                >
                                                    {processingId === agent.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                     <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24">
                                            No pending agent approvals.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

          <div className="grid gap-8 lg:grid-cols-2 mb-8">
            
             <Card>
                <CardHeader>
                    <CardTitle>Live Hostel Listings</CardTitle>
                    <CardDescription>Manage approved hostels and their availability.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[400px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Hostel Name</TableHead>
                                <TableHead>Availability</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {approvedHostels.length > 0 ? (
                                approvedHostels.map(hostel => (
                                    <TableRow key={hostel.id}>
                                        <TableCell className="font-medium">{hostel.name}</TableCell>
                                        <TableCell>
                                            <Badge variant={availabilityVariant[hostel.availability || 'Full']}>
                                                {hostel.availability || 'N/A'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                             <Button 
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleToggleFeatured(hostel)}
                                                disabled={processingId === hostel.id}
                                                title={hostel.isFeatured ? "Remove from featured" : "Mark as featured"}
                                            >
                                                {processingId === hostel.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                                  <Star className={cn("h-4 w-4", hostel.isFeatured ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground")} />
                                                )}
                                            </Button>
                                            <Button 
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleToggleAvailability(hostel)}
                                                disabled={processingId === hostel.id}
                                                title="Cycle availability status"
                                            >
                                                {processingId === hostel.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleDeleteApproved(hostel.id)}
                                                disabled={processingId === hostel.id}
                                                title="Delete hostel"
                                            >
                                                {processingId === hostel.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">
                                        No approved hostels.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          
           
                <Card>
                    <CardHeader>
                        <CardTitle>User Management</CardTitle>
                        <CardDescription>View all registered users and manage their roles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Full Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.length > 0 ? (
                                    users.map(user => (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium">{user.fullName}</TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={user.role === 'agent' ? 'secondary' : 'outline'} className="capitalize">
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleUserRole(user)}
                                                    disabled={processingId === user.id || user.role === 'admin'}
                                                    title={`Change to ${user.role === 'student' ? 'Agent' : 'Student'}`}
                                                >
                                                    {processingId === user.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        user.role === 'student' ? <UserCheck className="h-4 w-4 text-blue-500" /> : <UserX className="h-4 w-4 text-orange-500" />
                                                    )}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">
                                            No users found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                 <Card>
                    <CardHeader>
                        <CardTitle>Online Agents</CardTitle>
                        <CardDescription>A real-time list of agents currently active on the platform.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Full Name</TableHead>
                                    <TableHead>Email</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {onlineAgents.length > 0 ? (
                                    onlineAgents.map(agent => (
                                        <TableRow key={`${agent.clientId}-${agent.data.id}`}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                 <Avatar className="h-8 w-8">
                                                    <AvatarFallback>{agent.data.fullName.charAt(0)}</AvatarFallback>
                                                 </Avatar>
                                                {agent.data.fullName}
                                            </TableCell>
                                            <TableCell>{agent.data.email}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center h-24">
                                            No agents are currently online.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Pending Review Moderation</CardTitle>
                        <CardDescription>Approve or reject new reviews from students.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Review</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingReviews.length > 0 ? (
                                    pendingReviews.map(review => (
                                        <TableRow key={review.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star key={i} className={cn("h-4 w-4", i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30")} />
                                                    ))}
                                                </div>
                                                <p className="font-medium mt-1 truncate max-w-xs">{review.comment}</p>
                                                <p className="text-xs text-muted-foreground">{review.studentName} on {format(new Date(review.createdAt), 'PP')}</p>
                                            </TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8"
                                                    disabled={processingId === review.id}
                                                    onClick={() => handleReviewAction(review.id, 'reject')}
                                                ><XCircle className="h-4 w-4 text-destructive" /></Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8"
                                                    disabled={processingId === review.id}
                                                    onClick={() => handleReviewAction(review.id, 'approve')}
                                                >
                                                    {processingId === review.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4 text-green-600" />}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center h-24">
                                            No pending reviews.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
           </div>
            
        </div>
      </main>

      {selectedHostel && (
        <Dialog open={isHostelDialogOpen} onOpenChange={setIsHostelDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">Review: {selectedHostel.name}</DialogTitle>
              <DialogDescription>
                Location: {selectedHostel.location} | Submitted by Agent: {selectedHostel.agentId.substring(0, 8)}...
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Images</h3>
                  <Carousel className="w-full">
                    <CarouselContent>
                      {selectedHostel.images.map((img, index) => (
                        <CarouselItem key={index}>
                          <div className="relative h-64 w-full rounded-md overflow-hidden">
                            <Image src={img} alt={`Hostel image ${index + 1}`} fill style={{ objectFit: 'cover' }} />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-4" />
                    <CarouselNext className="right-4" />
                  </Carousel>
                </div>
                
                 <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Room Types</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Room Name</TableHead>
                                <TableHead>Price/Year</TableHead>
                                <TableHead>Beds</TableHead>
                                <TableHead>Bathroom</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedHostel.roomTypes.map((room) => (
                                <TableRow key={room.id}>
                                    <TableCell className="font-medium">{room.name}</TableCell>
                                    <TableCell>GH₵{room.price.toLocaleString()}</TableCell>
                                    <TableCell>{room.beds || 'N/A'}</TableCell>
                                    <TableCell>{room.bathrooms || 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>


                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <h3 className="font-semibold text-lg mb-2">Amenities</h3>
                        <div className="flex flex-wrap gap-2">
                            {(selectedHostel.amenities as string[]).map(amenity => (
                                <Badge key={amenity} variant="secondary">{amenity}</Badge>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="font-semibold text-lg mb-2">Description</h3>
                    <p className="text-sm text-foreground/80 bg-muted/50 p-3 rounded-md">{selectedHostel.description}</p>
                </div>

            </div>
            <DialogFooter className="pt-4 border-t">
              <Button 
                 variant="destructive" 
                 onClick={() => handleReject(selectedHostel.id)}
                 disabled={processingId === selectedHostel.id}
              >
                {processingId === selectedHostel.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
                <span className="ml-2">Reject</span>
              </Button>
               <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(selectedHostel.id)}
                  disabled={processingId === selectedHostel.id}
                >
                  {processingId === selectedHostel.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                  <span className="ml-2">Approve</span>
               </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
