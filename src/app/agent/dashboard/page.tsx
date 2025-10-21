
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Check, X, Phone, CheckCheck, Eye, User, Home, Calendar, Clock } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

type Visit = {
    id: string;
    hostelId: string;
    studentId: string;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled';
    visitDate: string;
    visitTime: string;
};

type EnrichedVisit = Visit & {
    hostelName: string;
    studentName: string;
    studentPhone?: string;
};

export default function AgentDashboard() {
    const [myVisits, setMyVisits] = useState<EnrichedVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [selectedVisit, setSelectedVisit] = useState<EnrichedVisit | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
            if (!user) {
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        setLoading(true);

        const visitsQuery = query(
            collection(db, "visits"), 
            where("agentId", "==", currentUser.uid)
        );

        const unsubscribeVisits = onSnapshot(visitsQuery, async (querySnapshot) => {
            const visitsData: Visit[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Visit));

            const enrichedVisits = await Promise.all(visitsData.map(async (visit) => {
                let hostelName = 'Unknown Hostel';
                let studentName = 'Unknown Student';
                let studentPhone: string | undefined = undefined;

                try {
                    const hostelRef = doc(db, 'hostels', visit.hostelId);
                    const hostelSnap = await getDoc(hostelRef);
                    if (hostelSnap.exists()) hostelName = hostelSnap.data().name;
                } catch (e) { console.error("Error fetching hostel", e); }
                
                try {
                    const studentRef = doc(db, 'users', visit.studentId);
                    const studentSnap = await getDoc(studentRef);
                    if (studentSnap.exists()) {
                        studentName = studentSnap.data().fullName;
                        studentPhone = studentSnap.data().phoneNumber;
                    }
                } catch (e) { console.error("Error fetching student", e); }

                return { ...visit, hostelName, studentName, studentPhone };
            }));
            
            // Sort by pending first, then by date
            const sortedVisits = enrichedVisits.sort((a,b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                if (a.status === 'accepted' && b.status !== 'accepted') return -1;
                if (a.status !== 'accepted' && b.status === 'accepted') return 1;
                return new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime();
            });

            setMyVisits(sortedVisits);
            setLoading(false);
        });

        return () => unsubscribeVisits();
    }, [currentUser]);
    
    const handleUpdateRequest = async (visitId: string, newStatus: 'accepted' | 'cancelled' | 'completed') => {
        setProcessingId(visitId);
        try {
            const visitRef = doc(db, 'visits', visitId);
            await updateDoc(visitRef, { status: newStatus });
            
            let title = '';
            if (newStatus === 'accepted') title = 'Request Accepted';
            else if (newStatus === 'cancelled') title = 'Request Declined';
            else if (newStatus === 'completed') title = 'Visit Marked as Complete';
            
            toast({
                title: title,
                description: "The student has been notified."
            });

            // Close dialog only if rejecting or completing a visit
            if(newStatus === 'cancelled' || newStatus === 'completed'){
                setIsDetailsOpen(false);
                setSelectedVisit(null);
            } else {
                // If accepting, just update the state locally to reflect the change
                setSelectedVisit(prev => prev ? {...prev, status: 'accepted'} : null);
                setMyVisits(prev => prev.map(v => v.id === visitId ? {...v, status: 'accepted'} : v));
            }

        } catch (error) {
            toast({ title: "Update Failed", description: "Could not update the request.", variant: "destructive" });
            console.error("Error updating visit status:", error);
        } finally {
            setProcessingId(null);
        }
    }
    
    const openDetailsDialog = (visit: EnrichedVisit) => {
        setSelectedVisit(visit);
        setIsDetailsOpen(true);
    }

    if (loadingAuth) {
        return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                </main>
            </div>
        );
    }

    if (!currentUser || !currentUser.email?.endsWith('@agent.hostelhq.com')) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                     <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in as an Agent to view this page.
                        </AlertDescription>
                    </Alert>
                </main>
            </div>
        )
    }
    
    const getStatusVariant = (status: Visit['status']): 'default' | 'secondary' | 'outline' | 'destructive' => {
        switch(status) {
            case 'completed': return 'default';
            case 'accepted': return 'secondary';
            case 'pending': return 'outline';
            case 'cancelled': return 'destructive';
            default: return 'outline';
        }
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
                <div className="container mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline">Agent Dashboard</CardTitle>
                            <CardDescription>Manage your incoming and scheduled visit requests from students.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    <p className="ml-4 text-muted-foreground">Loading visit requests...</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Hostel</TableHead>
                                            <TableHead>Date & Time</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myVisits.length > 0 ? (
                                            myVisits.map(visit => (
                                                <TableRow key={visit.id} className={visit.status === 'pending' ? 'bg-blue-50/50' : ''}>
                                                    <TableCell className="font-medium">
                                                        <div>{visit.studentName}</div>
                                                    </TableCell>
                                                    <TableCell>{visit.hostelName}</TableCell>
                                                    <TableCell>
                                                        {format(new Date(visit.visitDate), "PPP")} at {visit.visitTime}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={getStatusVariant(visit.status)} className="capitalize">
                                                            {visit.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        <Button variant="outline" size="sm" onClick={() => openDetailsDialog(visit)}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24">
                                                    You have no visit requests.
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
            
            {selectedVisit && (
                <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="font-headline text-2xl">Visit Details</DialogTitle>
                            <DialogDescription>
                                Review and respond to the visit request from {selectedVisit.studentName}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex items-center gap-4 p-3 border rounded-lg">
                                <User className="h-6 w-6 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Student Name</p>
                                    <p className="font-semibold">{selectedVisit.studentName}</p>
                                </div>
                            </div>
                            {selectedVisit.studentPhone && (
                                <div className="flex items-center gap-4 p-3 border rounded-lg">
                                    <Phone className="h-6 w-6 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Contact Number</p>
                                        <a href={`tel:${selectedVisit.studentPhone}`} className="font-semibold text-primary hover:underline">
                                            {selectedVisit.studentPhone}
                                        </a>
                                    </div>
                                </div>
                            )}
                             <div className="flex items-center gap-4 p-3 border rounded-lg">
                                <Home className="h-6 w-6 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Hostel</p>
                                    <p className="font-semibold">{selectedVisit.hostelName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-3 border rounded-lg">
                                <Calendar className="h-6 w-6 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Date & Time</p>
                                    <p className="font-semibold">{format(new Date(selectedVisit.visitDate), "PPP")} at {selectedVisit.visitTime}</p>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-4 border-t">
                            {selectedVisit.status === 'pending' && (
                                <div className="flex w-full gap-2">
                                    <Button 
                                        variant="outline" 
                                        className="flex-1"
                                        onClick={() => handleUpdateRequest(selectedVisit.id, 'cancelled')}
                                        disabled={processingId === selectedVisit.id}
                                    >
                                        {processingId === selectedVisit.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="mr-1 h-4 w-4" />}
                                        Decline
                                    </Button>
                                    <Button 
                                        className="flex-1"
                                        onClick={() => handleUpdateRequest(selectedVisit.id, 'accepted')}
                                        disabled={processingId === selectedVisit.id}
                                    >
                                        {processingId === selectedVisit.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="mr-1 h-4 w-4" />}
                                        Accept
                                    </Button>
                                </div>
                            )}
                            {selectedVisit.status === 'accepted' && (
                                <Button 
                                    className="w-full bg-green-600 hover:bg-green-700"
                                    onClick={() => handleUpdateRequest(selectedVisit.id, 'completed')}
                                    disabled={processingId === selectedVisit.id}
                                >
                                    {processingId === selectedVisit.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCheck className="mr-1 h-4 w-4" />}
                                    Mark as Complete
                                </Button>
                            )}
                             {selectedVisit.status === 'completed' && (
                                <div className="text-center w-full text-sm text-muted-foreground">
                                    This visit has been completed.
                                </div>
                            )}
                             {selectedVisit.status === 'cancelled' && (
                                <div className="text-center w-full text-sm text-muted-foreground">
                                    This visit was declined.
                                </div>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

        </div>
    );
}
