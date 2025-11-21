
"use client";

import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, DollarSign, Home, BarChart, Building2, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, onSnapshot, getDocs, Timestamp, doc, getDoc, setDoc, updateDoc, addDoc } from 'firebase/firestore';
import { Hostel, RoomType } from '@/lib/data';
import { BookingsChart } from '@/components/bookings-chart';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/lib/cloudinary';
import Image from 'next/image';

type ManagerHostel = Pick<Hostel, 'id' | 'name' | 'availability'> & {
    roomTypes: Pick<RoomType, 'price'>[];
};

type Booking = {
    hostelId: string;
    roomTypeId?: string; // This might not exist on old bookings
    bookingDate: Timestamp;
    status?: string;
    studentId?: string;
};

type HostelRequest = {
    id: string;
    hostelName: string;
    location: string;
    status: string;
    createdAt?: string;
};


export default function ManagerDashboard() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [isManager, setIsManager] = useState<boolean | null>(null);
    const [hostels, setHostels] = useState<ManagerHostel[]>([]);
    const [allHostels, setAllHostels] = useState<Hostel[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [chartData, setChartData] = useState<{ month: string; bookings: number }[]>([]);

    const [hostelRequests, setHostelRequests] = useState<HostelRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);

    const [attachDialogOpen, setAttachDialogOpen] = useState(false);
    const [selectedHostelId, setSelectedHostelId] = useState<string | undefined>(undefined);
    const [attachSubmitting, setAttachSubmitting] = useState(false);

    const [requestDialogOpen, setRequestDialogOpen] = useState(false);
    const [requestName, setRequestName] = useState('');
    const [requestLocation, setRequestLocation] = useState('');
    const [requestCampus, setRequestCampus] = useState('');
    const [requestCapacity, setRequestCapacity] = useState('');
    const [requestBasePrice, setRequestBasePrice] = useState('');
    const [requestDescription, setRequestDescription] = useState('');
    const [requestNotes, setRequestNotes] = useState('');
    const [requestPhotos, setRequestPhotos] = useState<File[]>([]);
    const [requestPhotoPreviews, setRequestPhotoPreviews] = useState<string[]>([]);
    const [requestSubmitting, setRequestSubmitting] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (!user) {
                setIsManager(false);
                setLoadingAuth(false);
                return;
            }

            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const data = userDocSnap.data() as { role?: string };
                    setIsManager(data.role === 'hostel_manager');
                } else {
                    setIsManager(false);
                }
            } catch (error) {
                console.error('Error checking manager role:', error);
                setIsManager(false);
            } finally {
                setLoadingAuth(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!currentUser) {
            if (!loadingAuth) setLoadingData(false);
            return;
        }

        setLoadingData(true);
        const hostelsQuery = query(collection(db, 'hostels'), where('managerId', '==', currentUser.uid));
        
        const unsubscribeHostels = onSnapshot(hostelsQuery, async (snapshot) => {
            const fetchedHostels = await Promise.all(snapshot.docs.map(async (doc) => {
                const roomTypesSnap = await getDocs(collection(doc.ref, 'roomTypes'));
                const roomTypes = roomTypesSnap.docs.map(rtDoc => rtDoc.data() as RoomType);
                return { id: doc.id, ...doc.data(), roomTypes } as ManagerHostel;
            }));
            
            setHostels(fetchedHostels);

            if (fetchedHostels.length > 0) {
                const hostelIds = fetchedHostels.map(h => h.id);
                // Only load confirmed (secured) bookings for these hostels
                const bookingsQuery = query(
                    collection(db, 'bookings'),
                    where('hostelId', 'in', hostelIds),
                    where('status', '==', 'confirmed')
                );
                
                const unsubscribeBookings = onSnapshot(bookingsQuery, (bookingSnapshot) => {
                    const fetchedBookings = bookingSnapshot.docs.map(bDoc => bDoc.data() as Booking);
                    setBookings(fetchedBookings);
                    
                    // Process data for the chart
                    const monthlyBookings = new Array(12).fill(0);
                    fetchedBookings.forEach(booking => {
                        if (booking.bookingDate) {
                            const month = booking.bookingDate.toDate().getMonth();
                            monthlyBookings[month]++;
                        }
                    });

                    const currentYearMonths = Array.from({length: 12}, (_, i) => format(new Date(0, i), 'MMM'));

                    setChartData(currentYearMonths.map((month, index) => ({
                        month,
                        bookings: monthlyBookings[index]
                    })));

                    setLoadingData(false);
                });
                 return () => unsubscribeBookings();
            } else {
                 setLoadingData(false);
            }
        });

        return () => unsubscribeHostels();

    }, [currentUser, loadingAuth]);

    // Listen to hostelRequests for this manager
    useEffect(() => {
        if (!currentUser) {
            setHostelRequests([]);
            setLoadingRequests(false);
            return;
        }

        const requestsQuery = query(
            collection(db, 'hostelRequests'),
            where('managerId', '==', currentUser.uid)
        );

        const unsubscribe = onSnapshot(
            requestsQuery,
            (snap) => {
                const list: HostelRequest[] = snap.docs.map((d) => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        hostelName: data.hostelName || 'Unknown hostel',
                        location: data.location || '—',
                        status: data.status || 'pending',
                        createdAt: data.createdAt,
                    };
                });
                setHostelRequests(list);
                setLoadingRequests(false);
            },
            (error) => {
                console.error('Error loading hostel requests for manager:', error);
                setLoadingRequests(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser]);

    // Load all hostels once for the attach-dropdown (managers cannot edit them here)
    useEffect(() => {
        const loadAllHostels = async () => {
            try {
                const snap = await getDocs(collection(db, 'hostels'));
                const list: Hostel[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Hostel) }));
                setAllHostels(list);
            } catch (error) {
                console.error('Error loading all hostels for manager attach dropdown:', error);
            }
        };

        // Only load after auth check finishes
        if (loadingAuth === false) {
            loadAllHostels();
        }
    }, [loadingAuth]);


    if (loadingAuth || isManager === null) {
        return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                </main>
            </div>
        );
    }
    
    if (!currentUser || !isManager) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                     <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in as a Hostel Manager to view this page.
                        </AlertDescription>
                    </Alert>
                </main>
            </div>
        )
    }

    const totalBookings = bookings.length;
    const totalHostels = hostels.length;

    // Secured bookings and active students
    const securedBookings = bookings.filter((b) => b.status === 'confirmed');
    const totalSecured = securedBookings.length;
    const activeStudents = new Set(
        securedBookings
            .map((b) => b.studentId)
            .filter((id): id is string => Boolean(id))
    ).size;

    const totalRevenue = bookings.reduce((acc, booking) => {
        const hostel = hostels.find(h => h.id === booking.hostelId);
        // This is a simplification. A real app would store the price in the booking document.
        // We'll just take the price of the first room type as a fallback.
        const price = hostel?.roomTypes[0]?.price || 0;
        return acc + price;
    }, 0);

    // Per-hostel stats: total bookings & secured rooms
    const hostelStats = bookings.reduce<Record<string, { bookings: number; secured: number }>>(
        (acc, booking) => {
            const id = booking.hostelId;
            if (!acc[id]) {
                acc[id] = { bookings: 0, secured: 0 };
            }
            acc[id].bookings += 1;
            if (booking.status === 'confirmed') {
                acc[id].secured += 1;
            }
            return acc;
        },
        {}
    );
    
    const availabilityVariant: Record<Hostel['availability'], "default" | "secondary" | "destructive"> = {
        'Available': 'default',
        'Limited': 'secondary',
        'Full': 'destructive'
    }

    const handleAttachHostel = async () => {
        if (!currentUser || !selectedHostelId) return;
        const hostelDoc = allHostels.find((h) => h.id === selectedHostelId);
        if (!hostelDoc) return;

        // If hostel already has a manager, block and show message
        if ((hostelDoc as any).managerId && (hostelDoc as any).managerId !== currentUser.uid) {
            toast({
                title: 'Hostel already managed',
                description: 'This hostel already has a manager assigned. Please contact support if this is incorrect.',
                variant: 'destructive',
            });
            return;
        }

        try {
            setAttachSubmitting(true);
            const ref = doc(db, 'hostels', selectedHostelId);
            await updateDoc(ref, {
                managerId: currentUser.uid,
            });
            setAttachDialogOpen(false);
            toast({
                title: 'Hostel attached',
                description: 'This hostel is now linked to your manager account.',
            });
        } catch (error) {
            console.error('Error attaching hostel to manager:', error);
            toast({
                title: 'Could not attach hostel',
                description: 'Please try again or contact support if the problem continues.',
                variant: 'destructive',
            });
        } finally {
            setAttachSubmitting(false);
        }
    };

    const handleRequestPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).slice(0, 3 - requestPhotos.length);
            if (newFiles.length > 0) {
                setRequestPhotos((prev) => [...prev, ...newFiles]);
                const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
                setRequestPhotoPreviews((prev) => [...prev, ...newPreviews]);
            }
        }
    };

    const handleSubmitHostelRequest = async () => {
        if (!currentUser) return;
        if (!requestName.trim() || !requestLocation.trim()) {
            toast({
                title: 'Missing details',
                description: 'Please provide at least the hostel name and location.',
                variant: 'destructive',
            });
            return;
        }

        try {
            setRequestSubmitting(true);
            let imageUrls: string[] = [];
            if (requestPhotos.length > 0) {
                try {
                    imageUrls = await Promise.all(requestPhotos.map(uploadImage));
                } catch (err) {
                    console.error('Image upload failed for hostel request:', err);
                    toast({
                        title: 'Image upload failed',
                        description: 'We could not upload some images. You can try again, or submit without photos.',
                        variant: 'destructive',
                    });
                }
            }
            await addDoc(collection(db, 'hostelRequests'), {
                managerId: currentUser.uid,
                managerEmail: currentUser.email || '',
                hostelName: requestName.trim(),
                location: requestLocation.trim(),
                campus: requestCampus.trim() || null,
                approximateCapacity: requestCapacity.trim() || null,
                basePrice: requestBasePrice ? Number(requestBasePrice) : null,
                description: requestDescription.trim() || null,
                notes: requestNotes.trim() || null,
                images: imageUrls,
                status: 'pending',
                createdAt: new Date().toISOString(),
            });
            setRequestDialogOpen(false);
            setRequestName('');
            setRequestLocation('');
            setRequestCampus('');
            setRequestCapacity('');
            setRequestBasePrice('');
            setRequestDescription('');
            setRequestNotes('');
            setRequestPhotos([]);
            setRequestPhotoPreviews([]);
            toast({
                title: 'Request submitted',
                description: 'Your hostel request has been sent. Our team will review it shortly.',
            });
        } catch (error) {
            console.error('Error submitting hostel request:', error);
            toast({
                title: 'Could not submit request',
                description: 'Please try again later or contact support.',
                variant: 'destructive',
            });
        } finally {
            setRequestSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 px-3 py-4 md:p-8">
				<div className="w-full">
					<h1 className="text-3xl font-bold font-headline mb-2">Manager Dashboard</h1>
					<p className="text-sm text-muted-foreground mb-6">Overview of how your hostels are performing on HostelHQ.</p>

                     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Hostels Managed</CardTitle>
                                <Home className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {loadingData ? <Loader2 className="h-6 w-6 animate-spin"/> : (
                                    <>
                                        <div className="text-2xl font-bold">{totalHostels}</div>
                                        <p className="text-xs text-muted-foreground">Active on HostelHQ</p>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                                <BarChart className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                               {loadingData ? <Loader2 className="h-6 w-6 animate-spin"/> : (
                                    <>
                                        <div className="text-2xl font-bold">{totalBookings}</div>
                                        <p className="text-xs text-muted-foreground">All-time bookings across your hostels</p>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Secured Rooms</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {loadingData ? <Loader2 className="h-6 w-6 animate-spin"/> : (
                                    <>
                                        <div className="text-2xl font-bold">{totalSecured}</div>
                                        <p className="text-xs text-muted-foreground">Confirmed bookings (secured beds)</p>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Students</CardTitle>
                                <BarChart className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {loadingData ? <Loader2 className="h-6 w-6 animate-spin"/> : (
                                    <>
                                        <div className="text-2xl font-bold">{activeStudents}</div>
                                        <p className="text-xs text-muted-foreground">Unique students with secured rooms</p>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7 mb-8">
                         <Card className="lg:col-span-4">
                            <CardHeader>
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                        <CardTitle>My Hostels</CardTitle>
                                        <CardDescription>A list of hostels you currently manage.</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setAttachDialogOpen(true)}
                                            className="text-xs"
                                        >
                                            <Building2 className="mr-1 h-3 w-3" />
                                            Attach Existing Hostel
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setRequestDialogOpen(true)}
                                            className="text-xs"
                                        >
                                            <PlusCircle className="mr-1 h-3 w-3" />
                                            Request New Hostel
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="max-h-[350px] overflow-y-auto">
                               {loadingData ? (
                                    <div className="flex items-center justify-center p-8">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                               ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Hostel Name</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Bookings</TableHead>
                                            <TableHead className="text-right">Secured</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {hostels.length > 0 ? hostels.map(hostel => {
                                            const stats = hostelStats[hostel.id] || { bookings: 0, secured: 0 };
                                            const handleDetach = async () => {
                                                if (!confirm(`Remove ${hostel.name} from your managed hostels? This will not delete the hostel, only detach it from your account.`)) {
                                                    return;
                                                }
                                                try {
                                                    const ref = doc(db, 'hostels', hostel.id);
                                                    await updateDoc(ref, { managerId: null });
                                                    toast({
                                                        title: 'Hostel detached',
                                                        description: `${hostel.name} has been removed from your managed hostels.`,
                                                    });
                                                } catch (error) {
                                                    console.error('Error detaching hostel from manager:', error);
                                                    toast({
                                                        title: 'Could not detach hostel',
                                                        description: 'Please try again or contact support if the problem continues.',
                                                        variant: 'destructive',
                                                    });
                                                }
                                            };

                                            return (
                                                <TableRow key={hostel.id}>
                                                    <TableCell className="font-medium">{hostel.name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={availabilityVariant[hostel.availability || 'Full']}>
                                                            {hostel.availability || 'N/A'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm text-muted-foreground">
                                                        {stats.bookings}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm font-medium">
                                                        {stats.secured}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="xs"
                                                            className="text-[11px]"
                                                            onClick={handleDetach}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-24 text-center">
                                                    You are not managing any hostels yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                               )}
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-3">
                            <CardHeader>
                                <CardTitle>Monthly Bookings</CardTitle>
                                <CardDescription>A chart showing booking trends for the current year.</CardDescription>
                            </CardHeader>
                             <CardContent>
                                {loadingData ? (
                                     <div className="flex items-center justify-center h-[300px]">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                     </div>
                                ) : totalBookings > 0 ? (
                                    <BookingsChart data={chartData} />
                                ) : (
                                    <div className="flex items-center justify-center h-[300px] text-center text-muted-foreground">
                                        No booking data available to display.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                    </div>

                    {/* Requests and recent bookings */}
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="lg:col-span-3">
                            <CardHeader>
                                <CardTitle>My Hostel Requests</CardTitle>
                                <CardDescription>Requests you&apos;ve submitted for new hostels to be added.</CardDescription>
                            </CardHeader>
                            <CardContent className="max-h-[280px] overflow-y-auto">
                                {loadingRequests ? (
                                    <div className="flex items-center justify-center p-6">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : hostelRequests.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        You haven&apos;t submitted any hostel requests yet.
                                    </p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Hostel</TableHead>
                                                <TableHead>Location</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Requested</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {hostelRequests.map((req) => {
                                                const created = req.createdAt
                                                    ? new Date(req.createdAt)
                                                    : null;
                                                const statusVariant =
                                                    req.status === 'approved'
                                                        ? 'default'
                                                        : req.status === 'rejected'
                                                        ? 'destructive'
                                                        : 'secondary';
                                                return (
                                                    <TableRow key={req.id}>
                                                        <TableCell className="font-medium">{req.hostelName}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {req.location}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={statusVariant as any} className="text-xs capitalize">
                                                                {req.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            {created ? format(created, 'dd MMM yyyy') : '—'}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-4">
                            <CardHeader>
                                <CardTitle>Recent Bookings</CardTitle>
                                <CardDescription>Latest bookings for the hostels you manage.</CardDescription>
                            </CardHeader>
                            <CardContent className="max-h-[280px] overflow-y-auto">
                                {loadingData ? (
                                    <div className="flex items-center justify-center p-6">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : bookings.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        No booking records found yet.
                                    </p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Hostel</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {bookings
                                                .slice()
                                                .sort((a, b) => b.bookingDate.toMillis() - a.bookingDate.toMillis())
                                                .slice(0, 10)
                                                .map((booking, index) => {
                                                    const hostel = hostels.find((h) => h.id === booking.hostelId);
                                                    const date = booking.bookingDate?.toDate?.();
                                                    const status = booking.status || 'pending';
                                                    const statusVariant =
                                                        status === 'confirmed'
                                                            ? 'default'
                                                            : status === 'cancelled'
                                                            ? 'destructive'
                                                            : 'secondary';
                                                    return (
                                                        <TableRow key={booking.hostelId + index}>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {date ? format(date, 'dd MMM yyyy') : '—'}
                                                            </TableCell>
                                                            <TableCell className="font-medium">
                                                                {hostel?.name || 'Unknown hostel'}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant={statusVariant as any} className="text-xs capitalize">
                                                                    {status}
                                                                </Badge>
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
                </div>

                {/* Attach Existing Hostel Dialog */}
                <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
					<DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Attach an existing hostel</DialogTitle>
                            <DialogDescription>
                                Select a hostel from the list below to mark it as managed by your account.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="hostel-select">Hostel</Label>
                                <Select
                                    value={selectedHostelId}
                                    onValueChange={(value) => setSelectedHostelId(value)}
                                >
                                    <SelectTrigger id="hostel-select">
                                        <SelectValue placeholder="Select a hostel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allHostels.map((h) => (
                                            <SelectItem key={h.id} value={h.id}>
                                                {h.name} {h.location ? `– ${h.location}` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedHostelId && (() => {
                                    const h = allHostels.find((x) => x.id === selectedHostelId) as any;
                                    if (!h) return null;
                                    if (h.managerId) {
                                        return (
                                            <p className="text-xs text-red-600 mt-1">
                                                This hostel already has a manager assigned. Linking will be blocked.
                                            </p>
                                        );
                                    }
                                    return (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            No manager currently attached. You can safely link this hostel.
                                        </p>
                                    );
                                })()}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setAttachDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleAttachHostel}
                                disabled={!selectedHostelId || attachSubmitting}
                            >
                                {attachSubmitting ? 'Attaching...' : 'Attach Hostel'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Request New Hostel Dialog */}
                <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
					<DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Request a new hostel</DialogTitle>
                            <DialogDescription>
                                Tell us about a hostel you manage that isn&apos;t on HostelHQ yet. Our team will review and add it.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="request-name">Hostel name</Label>
                                <Input
                                    id="request-name"
                                    placeholder="e.g., Kings Hostel Annex"
                                    value={requestName}
                                    onChange={(e) => setRequestName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="request-location">Location</Label>
                                <Input
                                    id="request-location"
                                    placeholder="e.g., Kumasi - AAMUSTED"
                                    value={requestLocation}
                                    onChange={(e) => setRequestLocation(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="request-campus">Campus / Area</Label>
                                    <Input
                                        id="request-campus"
                                        placeholder="e.g., AAMUSTED Main Campus"
                                        value={requestCampus}
                                        onChange={(e) => setRequestCampus(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="request-capacity">Approximate capacity</Label>
                                    <Input
                                        id="request-capacity"
                                        type="number"
                                        min={0}
                                        placeholder="e.g., 120 students"
                                        value={requestCapacity}
                                        onChange={(e) => setRequestCapacity(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="request-base-price">Typical yearly fee (GHS)</Label>
                                    <Input
                                        id="request-base-price"
                                        type="number"
                                        min={0}
                                        placeholder="e.g., 4500"
                                        value={requestBasePrice}
                                        onChange={(e) => setRequestBasePrice(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="request-description">Short description</Label>
                                    <Input
                                        id="request-description"
                                        placeholder="e.g., 4-in-a-room hostel close to campus gate"
                                        value={requestDescription}
                                        onChange={(e) => setRequestDescription(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="request-notes">Additional details (optional)</Label>
                                <Input
                                    id="request-notes"
                                    placeholder="Capacity, nearby landmarks, anything helpful for our team"
                                    value={requestNotes}
                                    onChange={(e) => setRequestNotes(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="request-photos">Photos (optional)</Label>
                                <div
                                    className="mt-1 border border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:bg-accent/40"
                                    onClick={() => document.getElementById('request-photos')?.click()}
                                >
                                    <p className="text-xs text-muted-foreground">Click to upload up to 3 photos that help admins verify this hostel.</p>
                                    <Input
                                        id="request-photos"
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleRequestPhotoChange}
                                        disabled={requestPhotos.length >= 3}
                                    />
                                </div>
                                {requestPhotoPreviews.length > 0 && (
                                    <div className="grid grid-cols-5 gap-2 mt-2">
                                        {requestPhotoPreviews.map((src, i) => (
                                            <div key={i} className="relative bg-muted aspect-square rounded-md overflow-hidden">
                                                <Image
                                                    src={src}
                                                    alt={`Preview ${i + 1}`}
                                                    fill
                                                    sizes="(max-width: 640px) 100vw, 120px"
                                                    style={{ objectFit: 'cover' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setRequestDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmitHostelRequest}
                                disabled={requestSubmitting}
                            >
                                {requestSubmitting ? 'Submitting...' : 'Submit Request'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
