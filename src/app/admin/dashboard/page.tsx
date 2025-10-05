
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DollarSign, BarChart, Users, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, Timestamp, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { BookingsChart } from '@/components/bookings-chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { bookingsChartData } from '@/lib/data'; // Keep chart data for now

type Hostel = {
  id: string;
  name: string;
  agentId: string;
  location: string;
  price: number;
  [key: string]: any;
};

type PendingHostel = Hostel & {
  dateSubmitted: string;
};


export default function AdminDashboard() {
  const [pendingHostels, setPendingHostels] = useState<PendingHostel[]>([]);
  const [approvedHostels, setApprovedHostels] = useState<Hostel[]>([]);
  const [stats, setStats] = useState({ revenue: 0, occupancyRate: '0%', totalListings: 0 });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedHostel, setSelectedHostel] = useState<PendingHostel | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
          roomFeatures: data.roomFeatures || { beds: 'N/A', bathrooms: 'N/A' },
        }
      });
      setPendingHostels(hostelsData);
      setLoading(false);
    });

    // Real-time approved hostels
    const unsubApproved = onSnapshot(collection(db, 'hostels'), (snapshot) => {
      const hostelsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hostel));
      setApprovedHostels(hostelsData);
    });

    // Fetch stats
    const fetchStats = async () => {
        const approvedSnapshot = await getDocs(collection(db, 'hostels'));
        const pendingSnapshot = await getDocs(collection(db, 'pendingHostels'));
        
        const totalApproved = approvedSnapshot.size;
        const totalPending = pendingSnapshot.size;
        const totalListings = totalApproved + totalPending;

        // Simplified revenue and occupancy for demonstration
        const totalRevenue = approvedSnapshot.docs.reduce((sum, doc) => sum + (doc.data().price || 0), 0);
        const occupancy = totalListings > 0 ? (totalApproved / totalListings) * 100 : 0;

        setStats({
            revenue: totalRevenue,
            occupancyRate: `${occupancy.toFixed(0)}%`,
            totalListings: totalApproved,
        });
    };

    fetchStats();
    const unsubStats = onSnapshot(collection(db, 'hostels'), fetchStats);


    return () => {
      unsubPending();
      unsubApproved();
      unsubStats();
    };
  }, []);

  const handleApprove = async (hostelId: string) => {
    setProcessingId(hostelId);
    toast({ title: "Approving Hostel..." });
    try {
      const pendingDocRef = doc(db, 'pendingHostels', hostelId);
      const pendingDocSnap = await getDoc(pendingDocRef);

      if (pendingDocSnap.exists()) {
        const hostelData = pendingDocSnap.data();
        
        await setDoc(doc(db, 'hostels', hostelId), {
          ...hostelData,
          status: 'approved',
          approvedAt: new Date().toISOString(),
        });
        
        await deleteDoc(pendingDocRef);

        toast({ title: "Hostel Approved", description: `${hostelData.name} is now live.` });
        setIsDialogOpen(false);
        setSelectedHostel(null);
      } else {
        throw new Error("Hostel not found in pending list.");
      }
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
      setIsDialogOpen(false);
      setSelectedHostel(null);
    } catch (error) {
      console.error("Error rejecting hostel: ", error);
      toast({ title: "Rejection Failed", description: "An error occurred.", variant: "destructive" });
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

  const openReviewDialog = (hostel: PendingHostel) => {
    setSelectedHostel(hostel);
    setIsDialogOpen(true);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold font-headline mb-6">Admin Dashboard</h1>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Potential Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">GH₵{stats.revenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Based on approved listings</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.occupancyRate}</div>
                <p className="text-xs text-muted-foreground">{stats.totalListings} approved listings</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total Approved Listings</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{approvedHostels.length}</div>
                 <p className="text-xs text-muted-foreground">Live on the platform</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-5 mb-8">
            <Card className="lg:col-span-3">
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
                               <Button variant="outline" size="sm" onClick={() => openReviewDialog(hostel)}>Review</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                          <TableRow>
                              <TableCell colSpan={3} className="text-center h-24">
                                  No pending approvals.
                              </TableCell>
                          </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
             <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Live Hostel Listings</CardTitle>
                    <CardDescription>Manage approved hostels on the platform.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[400px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Hostel Name</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {approvedHostels.length > 0 ? (
                                approvedHostels.map(hostel => (
                                    <TableRow key={hostel.id}>
                                        <TableCell className="font-medium">{hostel.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDeleteApproved(hostel.id)}
                                                disabled={processingId === hostel.id}
                                            >
                                                {processingId === hostel.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center h-24">
                                        No approved hostels.
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold text-lg mb-2">Details</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Price/Year:</span>
                                <span className="font-medium">GH₵{selectedHostel.price.toLocaleString()}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Beds:</span>
                                <span className="font-medium">{selectedHostel.roomFeatures.beds}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Bathroom:</span>
                                <span className="font-medium">{selectedHostel.roomFeatures.bathrooms}</span>
                            </div>
                        </div>
                    </div>
                     <div>
                        <h3 className="font-semibold text-lg mb-2">Amenities</h3>
                        <div className="flex flex-wrap gap-2">
                            {selectedHostel.amenities.map(amenity => (
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

    