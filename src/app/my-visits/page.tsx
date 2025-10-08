
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Eye } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Hostel, Agent } from '@/lib/data';
import { format } from 'date-fns';

type Visit = {
    id: string;
    hostelId: string;
    agentId: string | null;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled';
    visitDate: string;
    visitTime: string;
};

type EnrichedVisit = Visit & {
    hostelName: string;
    agentName: string | null;
};

export default function MyVisitsPage() {
    const [myVisits, setMyVisits] = useState<EnrichedVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
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

        const visitsQuery = query(collection(db, "visits"), where("studentId", "==", currentUser.uid));

        const unsubscribeVisits = onSnapshot(visitsQuery, async (querySnapshot) => {
            const visitsData: Visit[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Visit));

            const enrichedVisits = await Promise.all(visitsData.map(async (visit) => {
                let hostelName = 'Unknown Hostel';
                let agentName: string | null = null;

                try {
                    const hostelRef = doc(db, 'hostels', visit.hostelId);
                    const hostelSnap = await getDoc(hostelRef);
                    if (hostelSnap.exists()) {
                        hostelName = hostelSnap.data().name;
                    }
                } catch (e) { console.error("Error fetching hostel", e); }
                
                if (visit.agentId) {
                    try {
                        const agentRef = doc(db, 'users', visit.agentId);
                        const agentSnap = await getDoc(agentRef);
                        if (agentSnap.exists()) {
                            agentName = agentSnap.data().fullName;
                        }
                    } catch (e) { console.error("Error fetching agent", e); }
                }

                return { ...visit, hostelName, agentName };
            }));

            setMyVisits(enrichedVisits);
            setLoading(false);
        });

        return () => {
            unsubscribeVisits();
        };

    }, [currentUser, toast]);
    
    const getStatusVariant = (status: Visit['status']) => {
        switch (status) {
            case 'completed': return 'default';
            case 'accepted': return 'secondary';
            case 'pending': return 'outline';
            case 'cancelled': return 'destructive';
            default: return 'outline';
        }
    };

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

    if (!currentUser) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                     <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in as a Student to view your visits.
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
                            <CardTitle className="text-2xl font-headline">My Visits</CardTitle>
                            <CardDescription>Track your upcoming and past hostel visits.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    <p className="ml-4 text-muted-foreground">Loading your visits...</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Hostel</TableHead>
                                            <TableHead>Agent</TableHead>
                                            <TableHead>Date & Time</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myVisits.length > 0 ? (
                                            myVisits.map(visit => (
                                                <TableRow key={visit.id}>
                                                    <TableCell className="font-medium">{visit.hostelName}</TableCell>
                                                    <TableCell>{visit.agentName || 'Pending...'}</TableCell>
                                                     <TableCell>
                                                        {format(new Date(visit.visitDate), "PPP")} at {visit.visitTime}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={getStatusVariant(visit.status)} className="capitalize">
                                                            {visit.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Link href={`/hostels/${visit.hostelId}/book/tracking?visitId=${visit.id}`}>
                                                            <Button variant="outline" size="sm">
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View
                                                            </Button>
                                                        </Link>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24">
                                                    You haven't booked any visits yet.
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
