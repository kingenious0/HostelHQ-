
"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DollarSign, BarChart, Users, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { adminStats } from '@/lib/data';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type PendingHostel = {
  id: string;
  name: string;
  agentId: string;
  location: string;
  dateSubmitted: string;
};

export default function AdminDashboard() {
  const [pendingHostels, setPendingHostels] = useState<PendingHostel[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'pendingHostels'), (snapshot) => {
      const hostelsData = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = (data.dateSubmitted as Timestamp)?.toDate ? (data.dateSubmitted as Timestamp).toDate().toLocaleDateString() : data.dateSubmitted;
        return {
          id: doc.id,
          name: data.name || 'No Name',
          agentId: data.agentId || 'Unknown Agent',
          location: data.location || 'No Location',
          dateSubmitted: date,
        }
      });
      setPendingHostels(hostelsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (hostelId: string) => {
    setProcessingId(hostelId);
    toast({ title: "Approving Hostel..." });
    try {
      const pendingDocRef = doc(db, 'pendingHostels', hostelId);
      const pendingDocSnap = await getDoc(pendingDocRef);

      if (pendingDocSnap.exists()) {
        const hostelData = pendingDocSnap.data();
        
        // Add to main 'hostels' collection
        await setDoc(doc(db, 'hostels', hostelId), {
          ...hostelData,
          status: 'approved',
          approvedAt: new Date().toISOString(),
        });
        
        // Delete from 'pendingHostels' collection
        await deleteDoc(pendingDocRef);

        toast({ title: "Hostel Approved", description: `${hostelData.name} is now live.` });
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
    } catch (error) {
      console.error("Error rejecting hostel: ", error);
      toast({ title: "Rejection Failed", description: "An error occurred.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold font-headline mb-6">Admin Dashboard</h1>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{adminStats.revenue}</div>
                <p className="text-xs text-muted-foreground">+20.1% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{adminStats.occupancyRate}</div>
                <p className="text-xs text-muted-foreground">+2% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Top Performing Agents</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {adminStats.topAgents.map(agent => (
                    <div key={agent.name} className="flex justify-between text-sm">
                      <span>{agent.name}</span>
                      <span className="font-semibold">{agent.sales} bookings</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

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
                      <TableHead className="hidden md:table-cell">Agent ID</TableHead>
                      <TableHead className="hidden lg:table-cell">Location</TableHead>
                      <TableHead className="hidden md:table-cell">Date Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingHostels.length > 0 ? (
                      pendingHostels.map(hostel => (
                        <TableRow key={hostel.id}>
                          <TableCell className="font-medium">{hostel.name}</TableCell>
                          <TableCell className="hidden md:table-cell">{hostel.agentId}</TableCell>
                          <TableCell className="hidden lg:table-cell">{hostel.location}</TableCell>
                          <TableCell className="hidden md:table-cell">{hostel.dateSubmitted}</TableCell>
                          <TableCell className="text-right space-x-2">
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-primary hover:text-primary/80"
                                onClick={() => handleApprove(hostel.id)}
                                disabled={processingId === hostel.id}
                              >
                                {processingId === hostel.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                                <span className="sr-only">Approve</span>
                             </Button>
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive/80"
                                onClick={() => handleReject(hostel.id)}
                                disabled={processingId === hostel.id}
                             >
                                {processingId === hostel.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
                                <span className="sr-only">Reject</span>
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">
                                No pending approvals.
                            </TableCell>
                        </TableRow>
                    )}
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

    