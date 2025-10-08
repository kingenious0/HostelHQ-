
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Check, X, Phone } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';

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
    studentPhone?: string; // It might not always exist
};

export default function AgentDashboard() {
    const [myVisits, setMyVisits] = useState<EnrichedVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
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
            where("agentId", "==", currentUser.uid),
            where("status", "in", ["pending", "accepted"])
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
                        studentPhone = studentSnap.data().phoneNumber; // Assuming phone is stored
                    }
                } catch (e) { console.error("Error fetching student", e); }

                return { ...visit, hostelName, studentName, studentPhone };
            }));

            setMyVisits(enrichedVisits.sort((a,b) => a.status === 'pending' ? -1 : 1)); // Show pending first
            setLoading(false);
        });

        return () => unsubscribeVisits();
    }, [currentUser]);
    
    const handleUpdateRequest = async (visitId: string, newStatus: 'accepted' | 'cancelled') => {
        setProcessingId(visitId);
        try {
            const visitRef = doc(db, 'visits', visitId);
            await updateDoc(visitRef, { status: newStatus });
            toast({
                title: `Request ${newStatus === 'accepted' ? 'Accepted' : 'Declined'}`,
                description: "The student has been notified."
            });
        } catch (error) {
            toast({ title: "Update Failed", description: "Could not update the request.", variant: "destructive" });
            console.error("Error updating visit status:", error);
        } finally {
            setProcessingId(null);
        }
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

    if (!currentUser || currentUser.email?.endsWith('@student.hostelhq.com')) {
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

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
                <div className="container mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline">Agent Dashboard</CardTitle>
                            <CardDescription>Manage your incoming visit requests from students.</CardDescription>
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
                                                        {visit.studentPhone && (
                                                            <a href={`tel:${visit.studentPhone}`} className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mt-1">
                                                                <Phone className="h-3 w-3" />
                                                                {visit.studentPhone}
                                                            </a>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{visit.hostelName}</TableCell>
                                                    <TableCell>
                                                        {format(new Date(visit.visitDate), "PPP")} at {visit.visitTime}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={visit.status === 'accepted' ? 'secondary' : 'outline'} className="capitalize">
                                                            {visit.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        {visit.status === 'pending' && (
                                                            <>
                                                                <Button 
                                                                    variant="outline" size="sm" 
                                                                    onClick={() => handleUpdateRequest(visit.id, 'cancelled')}
                                                                    disabled={processingId === visit.id}
                                                                >
                                                                    {processingId === visit.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="mr-1 h-4 w-4" />}
                                                                    Decline
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    onClick={() => handleUpdateRequest(visit.id, 'accepted')}
                                                                    disabled={processingId === visit.id}
                                                                >
                                                                    {processingId === visit.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="mr-1 h-4 w-4" />}
                                                                    Accept
                                                                </Button>
                                                            </>
                                                        )}
                                                        {visit.status === 'accepted' && (
                                                            <span className="text-xs text-green-600 font-semibold">Accepted</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24">
                                                    You have no pending or active visit requests.
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
    
