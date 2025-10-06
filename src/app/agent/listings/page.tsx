
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Edit, PlusCircle } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Listing = {
    id: string;
    name: string;
    status: 'pending' | 'approved';
    price: number;
    location: string;
    availability?: 'Available' | 'Limited' | 'Full';
};

export default function AgentListingsPage() {
    const [myListings, setMyListings] = useState<Listing[]>([]);
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

        const fetchListings = async () => {
            const pendingQuery = query(collection(db, "pendingHostels"), where("agentId", "==", currentUser.uid));
            const approvedQuery = query(collection(db, "hostels"), where("agentId", "==", currentUser.uid));
            
            const [pendingSnapshot, approvedSnapshot] = await Promise.all([
                getDocs(pendingQuery),
                getDocs(approvedQuery)
            ]);

            const listingsData: Listing[] = [];
            pendingSnapshot.forEach(doc => listingsData.push({ id: doc.id, ...doc.data() } as Listing));
            approvedSnapshot.forEach(doc => listingsData.push({ id: doc.id, ...doc.data() } as Listing));
            
            setMyListings(listingsData);
            setLoading(false);
        };
        
        // Initial fetch
        fetchListings();

        // Listen for real-time updates
        const unsubPending = onSnapshot(query(collection(db, "pendingHostels"), where("agentId", "==", currentUser.uid)), () => fetchListings());
        const unsubApproved = onSnapshot(query(collection(db, "hostels"), where("agentId", "==", currentUser.uid)), () => fetchListings());

        return () => {
            unsubPending();
            unsubApproved();
        };

    }, [currentUser, toast]);
    
    const getStatusVariant = (status: Listing['status']) => {
        switch (status) {
            case 'approved': return 'default';
            case 'pending': return 'secondary';
            default: return 'outline';
        }
    }
    
    const availabilityVariant: Record<string, "default" | "secondary" | "destructive"> = {
        'Available': 'default',
        'Limited': 'secondary',
        'Full': 'destructive'
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

    if (!currentUser) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                     <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in as an Agent to view your listings.
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
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl font-headline">My Hostel Listings</CardTitle>
                                <CardDescription>View, edit, or track the status of your submissions.</CardDescription>
                            </div>
                            <Link href="/agent/upload">
                                <Button>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add New Hostel
                                </Button>
                            </Link>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    <p className="ml-4 text-muted-foreground">Loading your listings...</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Hostel Name</TableHead>
                                            <TableHead>Approval</TableHead>
                                            <TableHead>Availability</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myListings.length > 0 ? (
                                            myListings.map(listing => (
                                                <TableRow key={listing.id}>
                                                    <TableCell className="font-medium">{listing.name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={getStatusVariant(listing.status)} className="capitalize">
                                                            {listing.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {listing.availability ? (
                                                            <Badge variant={availabilityVariant[listing.availability]} className="capitalize">
                                                                {listing.availability}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">N/A</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="outline" size="sm" onClick={() => router.push(`/agent/listings/edit/${listing.id}`)} disabled={listing.status === 'approved'}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24">
                                                    You haven't listed any hostels yet.
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
