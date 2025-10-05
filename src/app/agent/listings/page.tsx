
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
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Hostel = {
    id: string;
    name: string;
    status: 'pending' | 'approved' | 'rejected';
    price: number;
    location: string;
};

export default function AgentListingsPage() {
    const [myListings, setMyListings] = useState<Hostel[]>([]);
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
        const q = query(
            collection(db, "pendingHostels"),
            where("agentId", "==", currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const listingsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Hostel));
            setMyListings(listingsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching listings: ", error);
            toast({ title: "Error", description: "Could not fetch your listings.", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, toast]);
    
    const getStatusVariant = (status: Hostel['status']) => {
        switch (status) {
            case 'approved': return 'default';
            case 'pending': return 'secondary';
            case 'rejected': return 'destructive';
            default: return 'outline';
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
                                            <TableHead>Location</TableHead>
                                            <TableHead>Price/Year</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myListings.length > 0 ? (
                                            myListings.map(listing => (
                                                <TableRow key={listing.id}>
                                                    <TableCell className="font-medium">{listing.name}</TableCell>
                                                    <TableCell>{listing.location}</TableCell>
                                                    <TableCell>GH₵{listing.price.toLocaleString()}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={getStatusVariant(listing.status)} className="capitalize">
                                                            {listing.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="outline" size="sm" onClick={() => router.push(`/agent/listings/edit/${listing.id}`)}>
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

    