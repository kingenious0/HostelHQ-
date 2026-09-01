
"use client";

import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, DollarSign, Home, BarChart, Building2, PlusCircle, Trash2, CheckCircle, XCircle, Eye, FileText, User as UserIcon, Phone, Calendar, Clock, Check, MessageSquare, PhoneCall, Search, ShieldAlert, CheckCircle2, Scale, Gavel } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, onSnapshot, getDocs, Timestamp, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Hostel, RoomType, Room, type Complaint, type ComplaintCategory, type ComplaintStatus, type ComplaintDirection } from '@/lib/data';
import { submitComplaintAction, fetchComplaintsAction } from '@/app/actions/db';
import { BookingsChart } from '@/components/bookings-chart';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/lib/cloudinary';
import { sendSMS } from '@/app/actions/sms';
import Image from 'next/image';
import { ManagerWalletCard } from '@/components/manager/manager-wallet-card';
import { VisitRequestCard, type StudentProfileContext } from '@/components/dashboard/VisitRequestCard';
import { DocumentViewerModal } from '@/components/ui/DocumentViewerModal';
import { declineVisitRequestAction } from '@/app/actions/db';

type ManagerHostel = Pick<Hostel, 'id' | 'name' | 'availability'> & {
    roomTypes: Pick<RoomType, 'id' | 'name' | 'price'>[];
};

type Visit = {
    id: string;
    hostelId: string;
    hostelName?: string;
    studentId?: string;
    studentName: string;
    studentEmail?: string;
    studentPhone?: string;
    roomTypeId?: string | null;
    roomTypeName?: string;
    visitDate: string | any;
    visitTime?: string;
    notes?: string;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled' | 'declined';
    declineReason?: string;
    visitType?: string;
    createdAt?: string | any;
    studentCompleted?: boolean;
    managerPhone?: string;
    verificationStatus?: string;
    studentIdCardUrl?: string;
    idCardUrl?: string;
    admissionLetterUrl?: string;
};

type Booking = {
    id: string;
    hostelId: string;
    roomTypeId?: string;
    roomNumber?: string;
    bookingDate: Timestamp;
    status?: string;
    studentId?: string;
    amountPaid?: number;
    paymentReference?: string;
    studentDetails?: {
        fullName: string;
        email: string;
        phoneNumber: string;
        guardianName?: string;
        guardianPhone?: string;
    };
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

    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [bookingDetailOpen, setBookingDetailOpen] = useState(false);

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

    // Manage Rooms dialog state
    const [roomsDialogOpen, setRoomsDialogOpen] = useState(false);
    const [roomsHostelId, setRoomsHostelId] = useState<string | null>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [newRoomNumber, setNewRoomNumber] = useState('');
    const [newRoomTypeId, setNewRoomTypeId] = useState<string>('');
    const [newRoomCapacity, setNewRoomCapacity] = useState('');
    const [newNumberOfRooms, setNewNumberOfRooms] = useState('');
    const [newRoomNumbers, setNewRoomNumbers] = useState<string[]>([]);
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
    const [editRoomNumber, setEditRoomNumber] = useState('');
    const [savingRoomEdit, setSavingRoomEdit] = useState(false);

    // Payment Proofs state
    const [paymentProofs, setPaymentProofs] = useState<any[]>([]);
    const [loadingPaymentProofs, setLoadingPaymentProofs] = useState(false);
    const [proofDialogOpen, setProofDialogOpen] = useState(false);
    const [selectedProof, setSelectedProof] = useState<any>(null);
    const [processingProof, setProcessingProof] = useState(false);

    // In-person Scheduled Visits state
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loadingVisits, setLoadingVisits] = useState(true);
    const [visitFilter, setVisitFilter] = useState<'all' | 'pending' | 'accepted' | 'completed' | 'cancelled' | 'declined'>('all');
    const [visitSearch, setVisitSearch] = useState('');
    const [updatingVisitId, setUpdatingVisitId] = useState<string | null>(null);
    const [studentProfiles, setStudentProfiles] = useState<Record<string, StudentProfileContext>>({});
    const [docViewerState, setDocViewerState] = useState<{
        isOpen: boolean;
        documentUrl?: string | null;
        title?: string;
        documentType?: string;
    }>({ isOpen: false });

    // Disputes & Incident Reports state (Complaints by students against managed hostels + Incident reports by manager)
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [loadingComplaints, setLoadingComplaints] = useState(true);
    const [complaintFilter, setComplaintFilter] = useState<'all' | 'against_hostel' | 'filed_by_me'>('all');
    const [complaintStatusFilter, setComplaintStatusFilter] = useState<string>('all');
    const [complaintSearch, setComplaintSearch] = useState('');
    const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
    const [complaintDetailOpen, setComplaintDetailOpen] = useState(false);

    // Incident Report Dialog state (Manager -> Student complaint to Dean)
    const [reportDialogOpen, setReportDialogOpen] = useState(false);
    const [reportHostelId, setReportHostelId] = useState<string>('');
    const [reportStudentName, setReportStudentName] = useState<string>('');
    const [reportStudentPhone, setReportStudentPhone] = useState<string>('');
    const [reportStudentEmail, setReportStudentEmail] = useState<string>('');
    const [reportRoomNumber, setReportRoomNumber] = useState<string>('');
    const [reportCategory, setReportCategory] = useState<ComplaintCategory>('Conduct & Policy');
    const [reportSubject, setReportSubject] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);

    const loadComplaints = async (hostelIdsList?: string[]) => {
        if (!currentUser) return;
        setLoadingComplaints(true);
        try {
            const res = await fetchComplaintsAction();
            if (res.success && Array.isArray(res.data)) {
                const currentHostelIds = hostelIdsList || hostels.map(h => h.id);
                const relevant = res.data.filter((c: Complaint) => {
                    const isMyHostel = currentHostelIds.length > 0 && currentHostelIds.includes(c.hostelId);
                    const isMyReport = c.managerId === currentUser.uid;
                    return isMyHostel || isMyReport;
                });
                setComplaints(relevant);
            } else {
                setComplaints([]);
            }
        } catch (err) {
            console.error('Error fetching complaints for manager:', err);
            setComplaints([]);
        } finally {
            setLoadingComplaints(false);
        }
    };

    const handleOpenMisconductDialog = (booking: Booking) => {
        setReportHostelId(booking.hostelId);
        setReportStudentName(booking.studentDetails?.fullName || '');
        setReportStudentPhone(booking.studentDetails?.phoneNumber || '');
        setReportStudentEmail(booking.studentDetails?.email || '');
        setReportRoomNumber(booking.roomNumber || '');
        setReportCategory('Conduct & Policy');
        setReportSubject('');
        setReportDescription('');
        setReportDialogOpen(true);
    };

    const handleOpenNewReport = () => {
        setReportHostelId(hostels[0]?.id || '');
        setReportStudentName('');
        setReportStudentPhone('');
        setReportStudentEmail('');
        setReportRoomNumber('');
        setReportCategory('Conduct & Policy');
        setReportSubject('');
        setReportDescription('');
        setReportDialogOpen(true);
    };

    const handleSubmitReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        if (!reportHostelId) {
            toast({
                title: 'Please select a hostel',
                description: 'Select which hostel this incident occurred at.',
                variant: 'destructive',
            });
            return;
        }
        if (!reportStudentName.trim()) {
            toast({
                title: 'Student name required',
                description: 'Please specify the student tenant name.',
                variant: 'destructive',
            });
            return;
        }
        if (!reportSubject.trim() || !reportDescription.trim()) {
            toast({
                title: 'Missing required fields',
                description: 'Please provide both a subject and a detailed incident report.',
                variant: 'destructive',
            });
            return;
        }

        setReportSubmitting(true);
        try {
            const hostel = hostels.find((h) => h.id === reportHostelId);
            const hostelName = hostel?.name || 'Managed Hostel';
            const studentName = reportStudentName.trim();

            const res = await submitComplaintAction({
                direction: 'manager_to_student',
                status: 'Submitted',
                category: reportCategory,
                subject: reportSubject.trim(),
                description: reportDescription.trim(),
                studentId: `student_${Date.now()}`,
                studentName,
                studentEmail: reportStudentEmail.trim() || undefined,
                studentPhone: reportStudentPhone.trim() || undefined,
                hostelId: reportHostelId,
                hostelName,
                managerId: currentUser.uid,
                managerName: currentUser.displayName || 'Hostel Manager',
                roomNumber: reportRoomNumber.trim() || undefined,
                createdAt: new Date().toISOString(),
            });

            if (res.success) {
                toast({
                    title: 'Report Submitted to Dean of Students',
                    description: `Your incident report regarding ${studentName} has been routed to the Dean's office.`,
                });
                setReportDialogOpen(false);
                setBookingDetailOpen(false);
                setReportSubject('');
                setReportDescription('');
                setReportStudentName('');
                setReportStudentPhone('');
                setReportStudentEmail('');
                setReportRoomNumber('');
                await loadComplaints();
            } else {
                toast({
                    title: 'Submission Failed',
                    description: res.error || 'Failed to submit report. Please try again.',
                    variant: 'destructive',
                });
            }
        } catch (err: any) {
            toast({
                title: 'Error',
                description: err.message || 'An unexpected error occurred.',
                variant: 'destructive',
            });
        } finally {
            setReportSubmitting(false);
        }
    };

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
                    const data = userDocSnap.data() as { role?: string; forcePasswordReset?: boolean };
                    setIsManager(data.role === 'hostel_manager');
                    // Redirect to password reset if required
                    if (data.role === 'hostel_manager' && data.forcePasswordReset) {
                        router.replace('/manager/first-login');
                        return;
                    }
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
                const roomTypes = roomTypesSnap.docs.map(rtDoc => {
                    const data = rtDoc.data() as RoomType;
                    return { id: rtDoc.id, name: data.name, price: data.price } as Pick<RoomType, 'id' | 'name' | 'price'>;
                });
                return { id: doc.id, ...doc.data(), roomTypes } as ManagerHostel;
            }));

            setHostels(fetchedHostels);
            loadComplaints(fetchedHostels.map(h => h.id));

            if (fetchedHostels.length > 0) {
                const hostelIds = fetchedHostels.map(h => h.id);
                // Only load confirmed (secured) bookings for these hostels
                const bookingsQuery = query(
                    collection(db, 'bookings'),
                    where('hostelId', 'in', hostelIds),
                    where('status', '==', 'confirmed')
                );

                const unsubscribeBookings = onSnapshot(bookingsQuery, (bookingSnapshot) => {
                    const fetchedBookings = bookingSnapshot.docs.map(bDoc => ({
                        id: bDoc.id,
                        ...bDoc.data()
                    })) as Booking[];
                    setBookings(fetchedBookings);

                    // Fetch payment proofs for this manager's hostels
                    const paymentProofsQuery = query(
                        collection(db, 'paymentProofs'),
                        where('managerId', '==', currentUser.uid),
                        where('status', '==', 'pending')
                    );

                    const unsubscribePaymentProofs = onSnapshot(paymentProofsQuery, (proofSnapshot) => {
                        const fetchedProofs = proofSnapshot.docs.map(pDoc => ({
                            id: pDoc.id,
                            ...pDoc.data()
                        }));
                        console.log('Fetched payment proofs:', fetchedProofs);
                        setPaymentProofs(fetchedProofs);
                    });

                    // Fetch visits for this manager's hostels
                    const visitsQuery = query(
                        collection(db, 'visits'),
                        where('hostelId', 'in', hostelIds.slice(0, 30))
                    );

                    const unsubscribeVisits = onSnapshot(visitsQuery, (visitsSnapshot) => {
                        const fetchedVisits = visitsSnapshot.docs.map(vDoc => ({
                            id: vDoc.id,
                            ...vDoc.data()
                        })) as Visit[];
                        fetchedVisits.sort((a, b) => {
                            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.visitDate ? new Date(a.visitDate).getTime() : 0);
                            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.visitDate ? new Date(b.visitDate).getTime() : 0);
                            return timeB - timeA;
                        });
                        setVisits(fetchedVisits);
                        setLoadingVisits(false);

                        // Asynchronously resolve student verification profiles
                        const sIds = Array.from(new Set(fetchedVisits.map(v => v.studentId).filter(Boolean))) as string[];
                        if (sIds.length > 0) {
                            Promise.all(sIds.map(async (sid) => {
                                try {
                                    const uSnap = await getDoc(doc(db, 'users', sid));
                                    if (uSnap.exists()) {
                                        const uData = uSnap.data() as any;
                                        return {
                                            sid,
                                            profile: {
                                                verificationStatus: uData.verificationStatus || 'pending',
                                                studentIdCardUrl: uData.studentIdCardUrl || uData.verificationDocUrl,
                                                idCardUrl: uData.idCardUrl || uData.verificationDocUrl,
                                                admissionLetterUrl: uData.admissionLetterUrl,
                                                email: uData.email,
                                                phone: uData.phoneNumber || uData.phone,
                                                fullName: uData.fullName,
                                            } as StudentProfileContext
                                        };
                                    }
                                } catch (e) {
                                    console.warn('Error fetching student profile for visit:', e);
                                }
                                return null;
                            })).then((results) => {
                                const map: Record<string, StudentProfileContext> = {};
                                results.forEach((r) => {
                                    if (r) map[r.sid] = r.profile;
                                });
                                setStudentProfiles(prev => ({ ...prev, ...map }));
                            });
                        }
                    }, (err) => {
                        console.error('Error fetching visits for manager:', err);
                        setLoadingVisits(false);
                    });

                    // Process data for the chart
                    const monthlyBookings = new Array(12).fill(0);
                    fetchedBookings.forEach(booking => {
                        if (booking.bookingDate) {
                            const month = booking.bookingDate.toDate().getMonth();
                            monthlyBookings[month]++;
                        }
                    });

                    const currentYearMonths = Array.from({ length: 12 }, (_, i) => format(new Date(0, i), 'MMM'));

                    setChartData(currentYearMonths.map((month, index) => ({
                        month,
                        bookings: monthlyBookings[index]
                    })));

                    setLoadingData(false);
                    return () => {
                        unsubscribePaymentProofs();
                        unsubscribeVisits();
                    };
                });
                return () => unsubscribeBookings();
            } else {
                setLoadingData(false);
                setLoadingVisits(false);
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

    const hostelForRooms = roomsHostelId ? hostels.find((h) => h.id === roomsHostelId) : undefined;

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

    const openRoomsDialogForHostel = async (hostelId: string) => {
        setRoomsHostelId(hostelId);
        setRoomsDialogOpen(true);
        setLoadingRooms(true);
        setNewRoomNumber('');
        setNewRoomTypeId('');
        setNewRoomCapacity('');
        setNewNumberOfRooms('');
        setNewRoomNumbers([]);
        setEditingRoomId(null);
        setEditRoomNumber('');

        try {
            const roomsCol = collection(db, 'hostels', hostelId, 'rooms');
            const snap = await getDocs(roomsCol);
            const list: Room[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Room) }));
            setRooms(list);
        } catch (error) {
            console.error('Error loading rooms for hostel', hostelId, error);
            toast({ title: 'Could not load rooms', variant: 'destructive' });
        } finally {
            setLoadingRooms(false);
        }
    };

    const toggleNewRoomNumber = (value: string) => {
        const targetCount = Number(newNumberOfRooms) || 0;
        const current = newRoomNumbers;

        if (!current.includes(value)) {
            if (targetCount > 0 && current.length >= targetCount) {
                toast({
                    title: 'Room number limit reached',
                    description: `You set Number of Rooms to ${targetCount}. You cannot select more than ${targetCount} room numbers.`,
                    variant: 'destructive',
                });
                return;
            }
            setNewRoomNumbers([...current, value]);
        } else {
            setNewRoomNumbers(current.filter((v) => v !== value));
        }
    };

    const startEditRoom = (room: Room) => {
        setEditingRoomId(room.id ?? null);
        const raw = room.roomNumber || '';
        setEditRoomNumber(raw.toLowerCase().startsWith('room ') ? raw.slice(5) : raw);
    };

    const saveRoomEdit = async () => {
        if (!roomsHostelId || !editingRoomId) return;
        const trimmed = editRoomNumber.trim();
        if (!trimmed) {
            toast({ title: 'Missing room number', description: 'Please enter a room number.', variant: 'destructive' });
            return;
        }
        try {
            setSavingRoomEdit(true);
            const ref = doc(db, 'hostels', roomsHostelId, 'rooms', editingRoomId);
            const roomNumber = trimmed.toLowerCase().startsWith('room ') ? trimmed : `Room ${trimmed}`;
            await updateDoc(ref, { roomNumber });
            setRooms((prev) => prev.map((r) => (r.id === editingRoomId ? { ...r, roomNumber } : r)));
            setEditingRoomId(null);
            setEditRoomNumber('');
            toast({ title: 'Room updated', description: `Room number updated to ${roomNumber}.` });
        } catch (error) {
            console.error('Error updating room:', error);
            toast({ title: 'Could not update room', description: 'Please try again later.', variant: 'destructive' });
        } finally {
            setSavingRoomEdit(false);
        }
    };

    const handleDeleteRoom = async (room: Room) => {
        if (!roomsHostelId || !room.id) return;

        if (!confirm(`Are you sure you want to delete room "${room.roomNumber}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'hostels', roomsHostelId, 'rooms', room.id));
            setRooms((prev) => prev.filter((r) => r.id !== room.id));
            toast({ title: 'Room deleted', description: `Room "${room.roomNumber}" has been deleted.` });
        } catch (error) {
            console.error('Error deleting room:', error);
            toast({ title: 'Could not delete room', description: 'Please try again later.', variant: 'destructive' });
        }
    };

    const handleCreateRoom = async () => {
        if (!roomsHostelId) return;
        if (!newRoomTypeId || !newRoomCapacity) {
            toast({ title: 'Missing room details', description: 'Please enter room type and capacity, and at least a room number, numbers grid, or number of rooms.', variant: 'destructive' });
            return;
        }
        const capacity = Number(newRoomCapacity);
        if (Number.isNaN(capacity) || capacity <= 0) {
            toast({ title: 'Invalid capacity', description: 'Capacity must be a positive number.', variant: 'destructive' });
            return;
        }

        const targetCount = Number(newNumberOfRooms) || 0;
        const selectedCount = newRoomNumbers.length;
        if (targetCount > 0 && selectedCount > 0 && selectedCount !== targetCount) {
            toast({
                title: 'Room numbers mismatch',
                description: `You set Number of Rooms to ${targetCount}. Please select exactly ${targetCount} room numbers (currently ${selectedCount}).`,
                variant: 'destructive',
            });
            return;
        }

        try {
            const roomsCol = collection(db, 'hostels', roomsHostelId, 'rooms');
            const creations: Promise<void>[] = [];

            const createOne = (label: string) => {
                const raw = label.trim();
                const roomNumber = raw.toLowerCase().startsWith('room ') ? raw : `Room ${raw}`;
                const roomData: Omit<Room, 'id'> = {
                    roomNumber,
                    roomTypeId: newRoomTypeId,
                    capacity,
                    currentOccupancy: 0,
                    status: 'active',
                };
                const p = addDoc(roomsCol, roomData).then((ref) => {
                    setRooms((prev) => [...prev, { ...roomData, id: ref.id }]);
                });
                creations.push(p.then(() => undefined));
            };

            if (newRoomNumbers.length > 0) {
                newRoomNumbers.forEach((num) => createOne(num));
            } else if (targetCount > 0) {
                for (let i = 0; i < targetCount; i++) {
                    const rawNumber = `T${1}-${i + 1}`;
                    createOne(rawNumber);
                }
            } else if (newRoomNumber.trim()) {
                createOne(newRoomNumber.trim());
            } else {
                toast({ title: 'Missing room number', description: 'Please specify at least one room number.', variant: 'destructive' });
                return;
            }

            await Promise.all(creations);
            setNewRoomNumber('');
            setNewRoomTypeId('');
            setNewRoomCapacity('');
            setNewNumberOfRooms('');
            setNewRoomNumbers([]);
            toast({ title: 'Room(s) created', description: 'The selected rooms have been added.' });
        } catch (error) {
            console.error('Error creating room:', error);
            toast({ title: 'Could not create room', description: 'Please try again later.', variant: 'destructive' });
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

    // Helper function to format payment status SMS messages
    function formatPaymentStatusSMS(
        status: 'approved' | 'rejected',
        studentName: string,
        hostelName: string,
        rejectionReason?: string
    ): string {
        if (status === 'approved') {
            return `Hi ${studentName}, your payment proof for ${hostelName} has been APPROVED! Your booking is now confirmed. Welcome to HostelHQ! 🎉`;
        } else {
            return `Hi ${studentName}, your payment proof for ${hostelName} was NOT approved. Reason: ${rejectionReason || 'Please contact your hostel manager for details'}. Please submit a new payment proof if needed.`;
        }
    }

    const openProofDialog = (proof: any) => {
        setSelectedProof(proof);
        setProofDialogOpen(true);
    };

    const handleApprovePayment = async () => {
        if (!selectedProof || !currentUser) return;

        setProcessingProof(true);
        try {
            // Update payment proof status
            await updateDoc(doc(db, 'paymentProofs', selectedProof.id), {
                status: 'approved',
                reviewedAt: new Date(),
                reviewedBy: currentUser.uid
            });

            // Find and update the corresponding booking
            const bookingsQuery = query(
                collection(db, 'bookings'),
                where('studentId', '==', selectedProof.studentId),
                where('hostelId', '==', selectedProof.hostelId),
                where('status', '==', 'pending')
            );

            const bookingSnapshot = await getDocs(bookingsQuery);
            if (!bookingSnapshot.empty) {
                const bookingDoc = bookingSnapshot.docs[0];
                await updateDoc(doc(db, 'bookings', bookingDoc.id), {
                    status: 'confirmed',
                    paymentConfirmedAt: new Date(),
                    paymentMethod: selectedProof.accountType === 'bank' ? 'bank_transfer' : 'mobile_money'
                });
            }

            // Send SMS notification to student
            try {
                console.log('🔍 Starting SMS notification process...');

                // Get student's phone number
                const studentDoc = await getDoc(doc(db, 'users', selectedProof.studentId));
                const studentData = studentDoc.data();
                const studentPhone = studentData?.phone;

                console.log('🔍 Student data:', {
                    studentId: selectedProof.studentId,
                    hasPhone: !!studentPhone,
                    phone: studentPhone ? studentPhone.substring(0, 4) + '***' : 'none',
                    studentName: studentData?.fullName || studentData?.email
                });

                if (studentPhone) {
                    const hostelName = hostels.find(h => h.id === selectedProof.hostelId)?.name || 'Your Hostel';
                    const smsMessage = formatPaymentStatusSMS('approved', selectedProof.studentName, hostelName);

                    console.log('🔍 SMS details:', {
                        hostelName,
                        messageLength: smsMessage.length,
                        messagePreview: smsMessage.substring(0, 50) + '...'
                    });

                    const smsResult = await sendSMS(studentPhone, smsMessage);

                    console.log('🔍 SMS result:', smsResult);

                    if (smsResult.success) {
                        console.log('✅ SMS sent successfully to student:', studentPhone);
                        toast({
                            title: 'Payment Approved',
                            description: `Payment proof approved, booking confirmed, and SMS sent to ${selectedProof.studentName}.`,
                        });
                    } else {
                        console.error('❌ SMS sending failed:', smsResult.error);
                        toast({
                            title: 'Payment Approved',
                            description: `Payment proof approved and booking confirmed, but SMS failed to send.`,
                            variant: 'default',
                        });
                    }
                } else {
                    console.log('⚠️ No phone number found for student:', selectedProof.studentId);
                    toast({
                        title: 'Payment Approved',
                        description: `Payment proof approved and booking confirmed, but no phone number for SMS.`,
                        variant: 'default',
                    });
                }
            } catch (smsError) {
                console.error('❌ SMS sending error:', smsError);
                console.error('❌ Error details:', {
                    message: smsError.message,
                    stack: smsError.stack
                });
                // Don't fail the approval if SMS fails
                toast({
                    title: 'Payment Approved',
                    description: `Payment proof approved and booking confirmed, but SMS notification failed.`,
                    variant: 'default',
                });
            }

            setProofDialogOpen(false);
            setSelectedProof(null);
        } catch (error) {
            console.error('Error approving payment:', error);
            toast({
                title: 'Approval Failed',
                description: 'Failed to approve payment. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setProcessingProof(false);
        }
    };

    const handleRejectPayment = async () => {
        if (!selectedProof || !currentUser) return;

        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;

        setProcessingProof(true);
        try {
            await updateDoc(doc(db, 'paymentProofs', selectedProof.id), {
                status: 'rejected',
                reviewedAt: new Date(),
                reviewedBy: currentUser.uid,
                rejectionReason: reason
            });

            // Send SMS notification to student
            try {
                console.log('🔍 Starting SMS notification process for rejection...');

                // Get student's phone number
                const studentDoc = await getDoc(doc(db, 'users', selectedProof.studentId));
                const studentData = studentDoc.data();
                const studentPhone = studentData?.phone;

                console.log('🔍 Student data:', {
                    studentId: selectedProof.studentId,
                    hasPhone: !!studentPhone,
                    phone: studentPhone ? studentPhone.substring(0, 4) + '***' : 'none',
                    studentName: studentData?.fullName || studentData?.email
                });

                if (studentPhone) {
                    const hostelName = hostels.find(h => h.id === selectedProof.hostelId)?.name || 'Your Hostel';
                    const smsMessage = formatPaymentStatusSMS('rejected', selectedProof.studentName, hostelName, reason);

                    console.log('🔍 SMS details:', {
                        hostelName,
                        reason,
                        messageLength: smsMessage.length,
                        messagePreview: smsMessage.substring(0, 50) + '...'
                    });

                    const smsResult = await sendSMS(studentPhone, smsMessage);

                    console.log('🔍 SMS result:', smsResult);

                    if (smsResult.success) {
                        console.log('✅ SMS sent successfully to student:', studentPhone);
                        toast({
                            title: 'Payment Rejected',
                            description: `Payment proof rejected and SMS sent to ${selectedProof.studentName}.`,
                        });
                    } else {
                        console.error('❌ SMS sending failed:', smsResult.error);
                        toast({
                            title: 'Payment Rejected',
                            description: `Payment proof rejected, but SMS failed to send.`,
                            variant: 'default',
                        });
                    }
                } else {
                    console.log('⚠️ No phone number found for student:', selectedProof.studentId);
                    toast({
                        title: 'Payment Rejected',
                        description: `Payment proof rejected, but no phone number for SMS.`,
                        variant: 'default',
                    });
                }
            } catch (smsError) {
                console.error('❌ SMS sending error:', smsError);
                console.error('❌ Error details:', {
                    message: smsError.message,
                    stack: smsError.stack
                });
                // Don't fail the rejection if SMS fails
                toast({
                    title: 'Payment Rejected',
                    description: `Payment proof rejected, but SMS notification failed.`,
                    variant: 'default',
                });
            }

            setProofDialogOpen(false);
            setSelectedProof(null);
        } catch (error) {
            console.error('Error rejecting payment:', error);
            toast({
                title: 'Rejection Failed',
                description: 'Failed to reject payment. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setProcessingProof(false);
        }
    };

    const handleUpdateVisitStatus = async (
        visitId: string,
        newStatus: 'accepted' | 'completed' | 'cancelled' | 'declined',
        reason?: string
    ) => {
        setUpdatingVisitId(visitId);
        try {
            if (newStatus === 'declined') {
                const res = await declineVisitRequestAction({ visitId, reason });
                if (!res.success) {
                    throw new Error(res.error || 'Failed to decline visit request');
                }
                toast({
                    title: 'Visit Request Declined',
                    description: 'Student has been notified of the decision.',
                });
                return;
            }

            const ref = doc(db, 'visits', visitId);
            const updates: any = {
                status: newStatus,
                updatedAt: new Date().toISOString()
            };
            if (newStatus === 'completed') {
                updates.studentCompleted = true;
            }
            await updateDoc(ref, updates);
            toast({
                title: `Visit marked as ${newStatus}`,
                description: `Student visit status has been successfully updated.`,
            });
        } catch (err: any) {
            console.error('Error updating visit status:', err);
            toast({
                title: 'Update Failed',
                description: err.message || 'Failed to update visit status',
                variant: 'destructive',
            });
        } finally {
            setUpdatingVisitId(null);
        }
    };

    const pendingVisitsCount = visits.filter(v => v.status === 'pending').length;
    const acceptedVisitsCount = visits.filter(v => v.status === 'accepted').length;
    const completedVisitsCount = visits.filter(v => v.status === 'completed').length;
    const cancelledVisitsCount = visits.filter(v => v.status === 'cancelled').length;
    const declinedVisitsCount = visits.filter(v => v.status === 'declined').length;

    const filteredVisits = visits.filter(visit => {
        if (visitFilter !== 'all' && visit.status !== visitFilter) {
            return false;
        }
        if (visitSearch.trim()) {
            const query = visitSearch.toLowerCase().trim();
            const nameMatch = visit.studentName?.toLowerCase().includes(query);
            const phoneMatch = visit.studentPhone?.toLowerCase().includes(query);
            const emailMatch = visit.studentEmail?.toLowerCase().includes(query);
            const hostelMatch = visit.hostelName?.toLowerCase().includes(query);
            return nameMatch || phoneMatch || emailMatch || hostelMatch;
        }
        return true;
    });

    // Complaints analytics & filtering
    const againstHostelCount = complaints.filter(c => c.direction === 'student_to_hostel').length;
    const filedByMeCount = complaints.filter(c => c.direction === 'manager_to_student').length;
    const pendingComplaintsCount = complaints.filter(c => c.status !== 'Resolved').length;

    const filteredComplaints = complaints.filter((c) => {
        if (complaintFilter === 'against_hostel' && c.direction !== 'student_to_hostel') return false;
        if (complaintFilter === 'filed_by_me' && c.direction !== 'manager_to_student') return false;
        if (complaintStatusFilter !== 'all' && c.status !== complaintStatusFilter) return false;

        if (complaintSearch.trim()) {
            const query = complaintSearch.toLowerCase().trim();
            const studentMatch = c.studentName?.toLowerCase().includes(query);
            const hostelMatch = c.hostelName?.toLowerCase().includes(query);
            const subjectMatch = c.subject?.toLowerCase().includes(query);
            const categoryMatch = c.category?.toLowerCase().includes(query);
            const roomMatch = c.roomNumber?.toLowerCase().includes(query);
            return studentMatch || hostelMatch || subjectMatch || categoryMatch || roomMatch;
        }
        return true;
    });

    const complaintStatusBadge = (status: ComplaintStatus) => {
        switch (status) {
            case 'Submitted':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Submitted
                    </span>
                );
            case 'Under Review':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Under Review
                    </span>
                );
            case 'Resolved':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Resolved
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {status}
                    </span>
                );
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 px-3 py-4 md:p-8">
                <div className="w-full">
                    <h1 className="text-3xl font-bold font-headline mb-2">Manager Dashboard</h1>
                    <p className="text-sm text-muted-foreground mb-6">Overview of how your hostels are performing on HostelHQ.</p>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 mb-8">
                        {currentUser && (
                            <div className="md:col-span-1 h-full">
                                <ManagerWalletCard userId={currentUser.uid} />
                            </div>
                        )}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Free Visits</CardTitle>
                                <Calendar className="h-4 w-4 text-emerald-600" />
                            </CardHeader>
                            <CardContent>
                                {loadingVisits ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                                    <>
                                        <div className="text-2xl font-bold text-emerald-700">{visits.length}</div>
                                        <p className="text-xs text-muted-foreground">
                                            {pendingVisitsCount > 0 ? (
                                                <span className="font-semibold text-amber-600">{pendingVisitsCount} awaiting confirmation</span>
                                            ) : (
                                                'All visits up to date'
                                            )}
                                        </p>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Hostels Managed</CardTitle>
                                <Home className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {loadingData ? <Loader2 className="h-6 w-6 animate-spin" /> : (
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
                                {loadingData ? <Loader2 className="h-6 w-6 animate-spin" /> : (
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
                                {loadingData ? <Loader2 className="h-6 w-6 animate-spin" /> : (
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
                                {loadingData ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                                    <>
                                        <div className="text-2xl font-bold">{activeStudents}</div>
                                        <p className="text-xs text-muted-foreground">Unique students with secured rooms</p>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Payment Proofs Section */}
                    <Card className="mb-8">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Payment Proofs {paymentProofs.length > 0 && `(${paymentProofs.length})`}
                                    </CardTitle>
                                    <CardDescription>Review and confirm student payment submissions</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {paymentProofs.length > 0 ? (
                                <div className="space-y-4">
                                    {paymentProofs.map((proof) => (
                                        <div key={proof.id} className="flex items-center justify-between p-4 border rounded-lg">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="outline">
                                                        {proof.accountType === 'bank' ? 'Bank Transfer' : proof.momoNetwork}
                                                    </Badge>
                                                    <span className="text-sm text-muted-foreground">
                                                        Submitted {proof.submittedAt?.toDate()?.toLocaleDateString('en-US', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        }) || 'Recently'}
                                                    </span>
                                                </div>
                                                <p className="font-medium">{proof.studentName}</p>
                                                <p className="text-sm text-muted-foreground">{proof.studentEmail}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Hostel: {hostels.find(h => h.id === proof.hostelId)?.name || 'Unknown'}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openProofDialog(proof)}
                                                >
                                                    <Eye className="h-4 w-4 mr-1" />
                                                    Review
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <p className="text-lg text-muted-foreground">No pending payment proofs</p>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Students will upload payment proofs here after making manual bank transfers
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Scheduled In-Person Visits Section */}
                    <Card className="mb-8 border-border shadow-sm">
                        <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                                            <Calendar className="h-5 w-5 text-emerald-600" />
                                            Scheduled Student In-Person Visits
                                        </CardTitle>
                                        {pendingVisitsCount > 0 && (
                                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-2 py-0.5">
                                                {pendingVisitsCount} Pending
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription className="text-sm mt-1">
                                        Students who scheduled a free in-person room inspection directly with you. Use 1-click Call or WhatsApp to confirm their arrival time.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative w-full md:w-64">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search student or hostel..."
                                            value={visitSearch}
                                            onChange={(e) => setVisitSearch(e.target.value)}
                                            className="pl-8 text-xs h-9"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Filter Tabs */}
                            <div className="flex flex-wrap gap-2 pt-2 border-t mt-3">
                                {[
                                    { id: 'all', label: `All (${visits.length})` },
                                    { id: 'pending', label: `Pending (${pendingVisitsCount})`, alert: pendingVisitsCount > 0 },
                                    { id: 'accepted', label: `Confirmed (${acceptedVisitsCount})` },
                                    { id: 'completed', label: `Completed (${completedVisitsCount})` },
                                    { id: 'declined', label: `Declined (${declinedVisitsCount})` },
                                    { id: 'cancelled', label: `Cancelled (${cancelledVisitsCount})` },
                                ].map((tab) => (
                                    <Button
                                        key={tab.id}
                                        type="button"
                                        size="sm"
                                        variant={visitFilter === tab.id ? 'default' : 'outline'}
                                        onClick={() => setVisitFilter(tab.id as any)}
                                        className={`text-xs h-7 px-2.5 ${tab.alert && visitFilter !== tab.id ? 'border-amber-400 text-amber-700 bg-amber-50/50' : ''}`}
                                    >
                                        {tab.label}
                                    </Button>
                                ))}
                            </div>
                        </CardHeader>

                        <CardContent>
                            {loadingVisits ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredVisits.length === 0 ? (
                                <div className="text-center py-10 border border-dashed rounded-xl bg-slate-50/50">
                                    <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                                    <p className="text-sm font-semibold text-slate-700">No scheduled visits found</p>
                                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                        {visitSearch
                                            ? 'No visits matched your search term.'
                                            : 'When students request a free in-person room inspection for your hostels, they will appear right here.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {filteredVisits.map((visit) => (
                                        <VisitRequestCard
                                            key={visit.id}
                                            visit={visit}
                                            studentProfile={studentProfiles[visit.studentId || '']}
                                            onUpdateStatus={handleUpdateVisitStatus}
                                            isUpdating={updatingVisitId === visit.id}
                                            onOpenDocument={(url, title, docType) => {
                                                setDocViewerState({
                                                    isOpen: true,
                                                    documentUrl: url,
                                                    title,
                                                    documentType: docType,
                                                });
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Disputes & Incident Reports section */}
                    <Card className="mb-8 border-border/80 shadow-sm">
                        <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <CardTitle className="flex items-center gap-2 text-xl font-bold">
                                            <Scale className="h-5 w-5 text-primary" />
                                            Hostel Disputes & Incident Reports
                                        </CardTitle>
                                        {pendingComplaintsCount > 0 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200">
                                                {pendingComplaintsCount} Active
                                            </span>
                                        )}
                                    </div>
                                    <CardDescription className="text-sm mt-1">
                                        Review grievances filed by student tenants against your hostels, track Dean of Students arbitrations, or submit incident reports.
                                    </CardDescription>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleOpenNewReport}
                                        className="h-9 px-3.5 text-xs font-semibold gap-1.5 shadow-sm"
                                    >
                                        <PlusCircle className="h-4 w-4" />
                                        File Incident Report
                                    </Button>
                                </div>
                            </div>

                            {/* Direction Tabs & Search / Filter Controls */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t mt-4">
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { id: 'all', label: `All (${complaints.length})` },
                                        { id: 'against_hostel', label: `Student Grievances (${againstHostelCount})` },
                                        { id: 'filed_by_me', label: `My Reports to Dean (${filedByMeCount})` },
                                    ].map((tab) => (
                                        <Button
                                            key={tab.id}
                                            type="button"
                                            size="sm"
                                            variant={complaintFilter === tab.id ? 'default' : 'outline'}
                                            onClick={() => setComplaintFilter(tab.id as any)}
                                            className="text-xs h-8 px-3"
                                        >
                                            {tab.label}
                                        </Button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                    <div className="relative w-full sm:w-56">
                                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Search disputes..."
                                            value={complaintSearch}
                                            onChange={(e) => setComplaintSearch(e.target.value)}
                                            className="pl-8 text-xs h-8"
                                        />
                                    </div>
                                    <Select value={complaintStatusFilter} onValueChange={setComplaintStatusFilter}>
                                        <SelectTrigger className="w-[130px] text-xs h-8">
                                            <SelectValue placeholder="All Statuses" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                                            <SelectItem value="Submitted" className="text-xs">Submitted</SelectItem>
                                            <SelectItem value="Under Review" className="text-xs">Under Review</SelectItem>
                                            <SelectItem value="Resolved" className="text-xs">Resolved</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {loadingComplaints ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredComplaints.length === 0 ? (
                                <div className="text-center py-12 border border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                                    <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No active disputes or reports</p>
                                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                        {complaintSearch || complaintStatusFilter !== 'all' || complaintFilter !== 'all'
                                            ? 'No disputes or reports matched your current filters.'
                                            : 'Grievances filed by student tenants or incident reports you submit to the Dean of Students office will appear here.'}
                                    </p>
                                    <div className="mt-4">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={handleOpenNewReport}
                                            className="text-xs h-8 gap-1.5"
                                        >
                                            <FileText className="h-3.5 w-3.5" />
                                            Submit Tenant Incident Report
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Desktop Table View */}
                                    <div className="hidden md:block overflow-x-auto rounded-xl border border-border/60">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                                    <TableHead className="text-xs font-semibold">Subject & Category</TableHead>
                                                    <TableHead className="text-xs font-semibold">Hostel & Room</TableHead>
                                                    <TableHead className="text-xs font-semibold">Student / Tenant</TableHead>
                                                    <TableHead className="text-xs font-semibold">Direction</TableHead>
                                                    <TableHead className="text-xs font-semibold">Status</TableHead>
                                                    <TableHead className="text-xs font-semibold">Filed Date</TableHead>
                                                    <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredComplaints.map((c) => (
                                                    <TableRow key={c.id} className="hover:bg-muted/20 transition-colors">
                                                        <TableCell className="py-3">
                                                            <div className="font-semibold text-xs text-foreground max-w-[220px] truncate">
                                                                {c.subject}
                                                            </div>
                                                            <div className="text-[11px] text-muted-foreground">
                                                                {c.category}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <div className="text-xs font-medium text-foreground">
                                                                {c.hostelName || 'Managed Hostel'}
                                                            </div>
                                                            {c.roomNumber && (
                                                                <div className="text-[11px] text-muted-foreground">
                                                                    Room {c.roomNumber}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <div className="text-xs font-medium text-foreground">
                                                                {c.studentName || 'Student'}
                                                            </div>
                                                            {c.studentPhone && (
                                                                <div className="text-[11px] font-mono text-muted-foreground">
                                                                    {c.studentPhone}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <span className="text-[11px] font-medium text-muted-foreground">
                                                                {c.direction === 'student_to_hostel' ? 'Student → Hostel' : 'Manager → Tenant'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            {complaintStatusBadge(c.status)}
                                                        </TableCell>
                                                        <TableCell className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                                                            {c.createdAt ? format(new Date(c.createdAt), 'dd MMM yyyy') : '—'}
                                                        </TableCell>
                                                        <TableCell className="py-3 text-right">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setSelectedComplaint(c);
                                                                    setComplaintDetailOpen(true);
                                                                }}
                                                                className="text-xs h-7 px-2.5 font-medium"
                                                            >
                                                                <Eye className="h-3 w-3 mr-1" />
                                                                Review
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Mobile Stacked Card View */}
                                    <div className="grid gap-3 md:hidden">
                                        {filteredComplaints.map((c) => (
                                            <div
                                                key={c.id}
                                                className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-colors space-y-2.5 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-foreground line-clamp-1">{c.subject}</h4>
                                                        <p className="text-[11px] text-muted-foreground">{c.category}</p>
                                                    </div>
                                                    {complaintStatusBadge(c.status)}
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-[11px] bg-muted/30 p-2 rounded-lg">
                                                    <div>
                                                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Hostel / Room</span>
                                                        <span className="font-medium text-foreground">{c.hostelName}</span>
                                                        {c.roomNumber && <span className="text-muted-foreground block">Rm {c.roomNumber}</span>}
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Student / Tenant</span>
                                                        <span className="font-medium text-foreground">{c.studentName}</span>
                                                        {c.studentPhone && <span className="text-muted-foreground font-mono block">{c.studentPhone}</span>}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                                                    <span>{c.direction === 'student_to_hostel' ? 'Student → Hostel' : 'Manager → Tenant'}</span>
                                                    <span>{c.createdAt ? format(new Date(c.createdAt), 'dd MMM yyyy') : ''}</span>
                                                </div>

                                                <div className="pt-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedComplaint(c);
                                                            setComplaintDetailOpen(true);
                                                        }}
                                                        className="w-full text-xs h-8 font-medium gap-1"
                                                    >
                                                        <Eye className="h-3 w-3" />
                                                        Review Dispute Details
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

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
                                            asChild
                                            size="sm"
                                            className="text-xs bg-primary hover:bg-primary/90 text-white font-medium"
                                        >
                                            <Link href="/manager/hostels/new">
                                                <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                                                List New Hostel
                                            </Link>
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
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="xs"
                                                                    className="text-[11px]"
                                                                    onClick={() => openRoomsDialogForHostel(hostel.id)}
                                                                >
                                                                    Manage Rooms
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="xs"
                                                                    className="text-[11px]"
                                                                    onClick={handleDetach}
                                                                >
                                                                    Remove
                                                                </Button>
                                                            </div>
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
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {bookings
                                                .slice()
                                                .sort((a, b) => b.bookingDate.toMillis() - a.bookingDate.toMillis())
                                                .slice(0, 50) // Increased limit to see more
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
                                                        <TableRow key={booking.id || booking.hostelId + index}>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {date ? format(date, 'dd MMM yyyy') : '—'}
                                                            </TableCell>
                                                            <TableCell className="font-medium">
                                                                {hostel?.name || 'Unknown hostel'}
                                                                {booking.roomNumber && <div className="text-xs text-muted-foreground">Room: {booking.roomNumber}</div>}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant={statusVariant as any} className="text-xs capitalize">
                                                                    {status}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1.5">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 text-xs"
                                                                        onClick={() => {
                                                                            setSelectedBooking(booking);
                                                                            setBookingDetailOpen(true);
                                                                        }}
                                                                    >
                                                                        View
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                                                        title="Report Tenant Misconduct to Dean"
                                                                        onClick={() => handleOpenMisconductDialog(booking)}
                                                                    >
                                                                        <ShieldAlert className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
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
                    <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto mx-auto">
                        <DialogHeader>
                            <DialogTitle className="text-lg sm:text-xl">Request a new hostel</DialogTitle>
                            <DialogDescription className="text-sm">
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
                            <div className="space-y-4 sm:space-y-0 sm:grid sm:gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="request-campus" className="text-sm">Campus / Area</Label>
                                    <Input
                                        id="request-campus"
                                        placeholder="e.g., 4500"
                                        value={requestCampus}
                                        onChange={(e) => setRequestCampus(e.target.value)}
                                        className="text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="request-capacity" className="text-sm">Approximate capacity</Label>
                                    <Input
                                        id="request-capacity"
                                        type="number"
                                        min={0}
                                        placeholder="e.g., 120 students"
                                        value={requestCapacity}
                                        onChange={(e) => setRequestCapacity(e.target.value)}
                                        className="text-sm"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="request-base-price" className="text-sm">Typical yearly fee (GHS)</Label>
                                <Input
                                    id="request-base-price"
                                    type="number"
                                    min={0}
                                    placeholder="e.g., 4500"
                                    value={requestBasePrice}
                                    onChange={(e) => setRequestBasePrice(e.target.value)}
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="request-description" className="text-sm">Short description</Label>
                                <Input
                                    id="request-description"
                                    placeholder="e.g., 4-in-a-room hostel close to campus gate"
                                    value={requestDescription}
                                    onChange={(e) => setRequestDescription(e.target.value)}
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="request-notes" className="text-sm">Additional details (optional)</Label>
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

                {/* Manage Rooms dialog for managers */}
                <Dialog open={roomsDialogOpen} onOpenChange={setRoomsDialogOpen}>
                    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
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
                                                    <TableHead className="w-32">Actions</TableHead>
                                                    <TableHead className="text-right">Occupancy</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {rooms.map((room) => (
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
                                                                            '✓'
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                room.roomNumber || '—'
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editingRoomId !== room.id && (
                                                                <div className="flex gap-1">
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
                                                                        variant="outline"
                                                                        size="xs"
                                                                        onClick={() => handleDeleteRoom(room)}
                                                                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm text-muted-foreground">
                                                            {room.currentOccupancy} / {room.capacity}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 border-t border-muted/40 pt-4">
                                <h3 className="text-sm font-medium">Add new rooms</h3>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="manager-room-type">Room type ID</Label>
                                        <Input
                                            id="manager-room-type"
                                            placeholder="roomTypeId"
                                            value={newRoomTypeId}
                                            onChange={(e) => setNewRoomTypeId(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="manager-capacity">Persons (per room)</Label>
                                        <Input
                                            id="manager-capacity"
                                            type="number"
                                            min={1}
                                            value={newRoomCapacity}
                                            onChange={(e) => setNewRoomCapacity(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="manager-number-of-rooms">Number of Rooms (optional)</Label>
                                        <Input
                                            id="manager-number-of-rooms"
                                            type="number"
                                            min={1}
                                            placeholder="e.g., 4"
                                            value={newNumberOfRooms}
                                            onChange={(e) => setNewNumberOfRooms(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="manager-room-number">Single room number (optional)</Label>
                                    <Input
                                        id="manager-room-number"
                                        placeholder="e.g., 101"
                                        value={newRoomNumber}
                                        onChange={(e) => setNewRoomNumber(e.target.value)}
                                    />
                                </div>
                                <div className="mt-2 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label>Room Numbers (optional)</Label>
                                        <p className="text-[11px] text-muted-foreground">
                                            Pick real room numbers, or leave empty and we will auto-generate.
                                        </p>
                                    </div>
                                    <div className="max-h-32 overflow-y-auto rounded-md border border-dashed border-muted-foreground/30 p-2">
                                        <div className="grid grid-cols-6 gap-1 text-xs">
                                            {Array.from({ length: 200 }, (_, i) => String(i + 1)).map((num) => {
                                                const selected = newRoomNumbers.includes(num);
                                                return (
                                                    <button
                                                        key={num}
                                                        type="button"
                                                        onClick={() => toggleNewRoomNumber(num)}
                                                        className={`inline-flex items-center justify-center rounded border px-1.5 py-1 transition-colors ${selected
                                                            ? 'border-primary bg-primary text-primary-foreground'
                                                            : 'border-muted-foreground/30 bg-background text-muted-foreground hover:border-primary/50'
                                                            }`}
                                                    >
                                                        {num}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button type="button" size="sm" onClick={handleCreateRoom}>
                                        Add rooms
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Payment Proof Review Dialog */}
                <Dialog open={proofDialogOpen} onOpenChange={setProofDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Review Payment Proof</DialogTitle>
                            <DialogDescription>
                                Review the submitted payment proof and approve or reject it
                            </DialogDescription>
                        </DialogHeader>
                        {selectedProof && (
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm font-medium">Student Name</p>
                                        <p className="text-sm">{selectedProof.studentName}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Student Email</p>
                                        <p className="text-sm">{selectedProof.studentEmail}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Payment Type</p>
                                        <p className="text-sm">
                                            {selectedProof.accountType === 'bank' ? 'Bank Transfer' : selectedProof.momoNetwork}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Submitted</p>
                                        <p className="text-sm">
                                            {selectedProof.submittedAt?.toDate()?.toLocaleString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) || 'Recently'}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-medium mb-2">Payment Proof Image</p>
                                    <div className="border rounded-lg overflow-hidden">
                                        <img
                                            src={selectedProof.proofImageUrl}
                                            alt="Payment Proof"
                                            className="w-full h-auto max-h-96 object-contain"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        <DialogFooter className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setProofDialogOpen(false)}
                                disabled={processingProof}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleRejectPayment}
                                disabled={processingProof}
                            >
                                {processingProof ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <XCircle className="h-4 w-4 mr-2" />
                                )}
                                Reject
                            </Button>
                            <Button
                                onClick={handleApprovePayment}
                                disabled={processingProof}
                            >
                                {processingProof ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                )}
                                Approve & Confirm Booking
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Booking Details Dialog */}
                <Dialog open={bookingDetailOpen} onOpenChange={setBookingDetailOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Booking Details</DialogTitle>
                            <DialogDescription>
                                Full information about this confirmed booking.
                            </DialogDescription>
                        </DialogHeader>
                        {selectedBooking && (
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground">Booking Info</h4>
                                        <p className="font-semibold">{selectedBooking.roomNumber ? `Room ${selectedBooking.roomNumber}` : 'Room Signed'}</p>
                                        <p className="text-sm text-muted-foreground">{selectedBooking.bookingDate?.toDate?.()?.toLocaleDateString()}</p>
                                        <Badge variant="outline" className="mt-1">{selectedBooking.status}</Badge>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground">Payment</h4>
                                        <p className="font-semibold text-green-600">GH₵ {((selectedBooking.amountPaid || 0) / 100).toFixed(2)}</p>
                                        <p className="text-xs text-muted-foreground break-all">{selectedBooking.paymentReference || 'No Reference'}</p>
                                    </div>
                                </div>
                                <div className="border-t pt-4">
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Student Information</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                <UserIcon className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{selectedBooking.studentDetails?.fullName || 'Unknown Name'}</p>
                                                <p className="text-xs text-muted-foreground">{selectedBooking.studentDetails?.email || 'No email'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Phone className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{selectedBooking.studentDetails?.phoneNumber || 'No phone'}</p>
                                                <p className="text-xs text-muted-foreground">Student Contact</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {selectedBooking.studentDetails?.guardianName && (
                                    <div className="border-t pt-4">
                                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Guardian Contact</h4>
                                        <p className="text-sm"><span className="font-semibold">{selectedBooking.studentDetails.guardianName}</span>: {selectedBooking.studentDetails.guardianPhone}</p>
                                    </div>
                                )}
                            </div>
                        )}
                        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                    if (selectedBooking) {
                                        handleOpenMisconductDialog(selectedBooking);
                                    }
                                }}
                                className="text-xs"
                            >
                                <ShieldAlert className="h-4 w-4 mr-1.5" />
                                Report Tenant Misconduct to Dean
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setBookingDetailOpen(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Incident Report Submission Dialog (Manager -> Student to Dean of Students) */}
                <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                    <DialogContent className="max-w-lg rounded-2xl">
                        <DialogHeader>
                            <div className="flex items-center gap-2">
                                <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                                    <ShieldAlert className="h-5 w-5" />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg font-bold">File Incident Report to Dean</DialogTitle>
                                    <DialogDescription className="text-xs">
                                        Formal report routed directly to the Dean of Students office for review and arbitration.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <form onSubmit={handleSubmitReport} className="space-y-4 pt-1">
                            {/* Hostel selector */}
                            <div className="space-y-1.5">
                                <Label htmlFor="report-hostel" className="text-xs font-semibold">Target Hostel</Label>
                                {hostels.length > 1 ? (
                                    <Select
                                        value={reportHostelId}
                                        onValueChange={(val) => setReportHostelId(val)}
                                    >
                                        <SelectTrigger id="report-hostel" className="h-10 rounded-xl">
                                            <SelectValue placeholder="Select hostel" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {hostels.map((h) => (
                                                <SelectItem key={h.id} value={h.id}>
                                                    {h.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        id="report-hostel"
                                        value={hostels[0]?.name || 'Managed Hostel'}
                                        disabled
                                        className="h-10 rounded-xl bg-muted"
                                    />
                                )}
                            </div>

                            {/* Tenant details */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="report-student-name" className="text-xs font-semibold">Student / Tenant Name *</Label>
                                    <Input
                                        id="report-student-name"
                                        placeholder="e.g. Kwesi Mensah"
                                        value={reportStudentName}
                                        onChange={(e) => setReportStudentName(e.target.value)}
                                        required
                                        className="h-10 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="report-room" className="text-xs font-semibold">Room Number (Optional)</Label>
                                    <Input
                                        id="report-room"
                                        placeholder="e.g. B-104"
                                        value={reportRoomNumber}
                                        onChange={(e) => setReportRoomNumber(e.target.value)}
                                        className="h-10 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="report-phone" className="text-xs font-semibold">Student Phone (Optional)</Label>
                                    <Input
                                        id="report-phone"
                                        placeholder="e.g. 0244123456"
                                        value={reportStudentPhone}
                                        onChange={(e) => setReportStudentPhone(e.target.value)}
                                        className="h-10 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="report-email" className="text-xs font-semibold">Student Email (Optional)</Label>
                                    <Input
                                        id="report-email"
                                        type="email"
                                        placeholder="e.g. student@st.ug.edu.gh"
                                        value={reportStudentEmail}
                                        onChange={(e) => setReportStudentEmail(e.target.value)}
                                        className="h-10 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="report-category" className="text-xs font-semibold">Incident Category</Label>
                                <Select
                                    value={reportCategory}
                                    onValueChange={(val: any) => setReportCategory(val)}
                                >
                                    <SelectTrigger id="report-category" className="h-10 rounded-xl">
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Conduct & Policy">Conduct & Rule Violations</SelectItem>
                                        <SelectItem value="Maintenance & Repairs">Property Damage / Vandalism</SelectItem>
                                        <SelectItem value="Noise & Disturbance">Noise Disturbance / Parties</SelectItem>
                                        <SelectItem value="Security & Safety">Security & Unauthorized Guests</SelectItem>
                                        <SelectItem value="Pricing & Overcharging">Non-Payment / Rent Default</SelectItem>
                                        <SelectItem value="Sanitation & Water">Sanitation Violations</SelectItem>
                                        <SelectItem value="Other">Other Infractions</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="report-subject" className="text-xs font-semibold">Incident Summary / Subject *</Label>
                                <Input
                                    id="report-subject"
                                    placeholder="e.g. Unauthorized room subletting and disruptive noise"
                                    value={reportSubject}
                                    onChange={(e) => setReportSubject(e.target.value)}
                                    required
                                    className="h-10 rounded-xl"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="report-desc" className="text-xs font-semibold">Detailed Incident Report *</Label>
                                <Textarea
                                    id="report-desc"
                                    placeholder="Provide a thorough, factual account of what happened, date/time, witnesses, and any previous warnings given..."
                                    value={reportDescription}
                                    onChange={(e) => setReportDescription(e.target.value)}
                                    rows={4}
                                    required
                                    className="rounded-xl resize-none"
                                />
                            </div>

                            <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>This formal filing is routed to the Dean of Students office for institutional review and arbitration. False reports may be subject to administrative review.</span>
                            </div>

                            <DialogFooter className="gap-2 sm:gap-0 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setReportDialogOpen(false)}
                                    disabled={reportSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                                    disabled={reportSubmitting}
                                >
                                    {reportSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Submitting Report...
                                        </>
                                    ) : (
                                        "Submit Report to Dean"
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Dispute & Grievance Review Dialog (Detail Modal) */}
                <Dialog open={complaintDetailOpen} onOpenChange={setComplaintDetailOpen}>
                    <DialogContent className="max-w-lg rounded-2xl">
                        <DialogHeader>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className="text-xs font-normal">
                                            {selectedComplaint?.category}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {selectedComplaint?.direction === 'student_to_hostel'
                                                ? 'Student → Hostel'
                                                : 'Manager → Tenant'}
                                        </span>
                                    </div>
                                    <DialogTitle className="text-lg font-bold">
                                        {selectedComplaint?.subject || 'Dispute Details'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs">
                                        {selectedComplaint?.hostelName}
                                        {selectedComplaint?.roomNumber ? ` • Room ${selectedComplaint.roomNumber}` : ''}
                                        {selectedComplaint?.createdAt ? ` • Filed ${format(new Date(selectedComplaint.createdAt), 'dd MMM yyyy, h:mm a')}` : ''}
                                    </DialogDescription>
                                </div>
                                {selectedComplaint && (
                                    <Badge
                                        variant="outline"
                                        className={`text-xs font-semibold shrink-0 ${
                                            selectedComplaint.status === 'Resolved'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                : selectedComplaint.status === 'Under Review'
                                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                        }`}
                                    >
                                        {selectedComplaint.status}
                                    </Badge>
                                )}
                            </div>
                        </DialogHeader>

                        {selectedComplaint && (
                            <div className="space-y-4 pt-2">
                                {/* Direction guidance banner */}
                                <div className={`p-3 rounded-xl text-xs border ${
                                    selectedComplaint.direction === 'student_to_hostel'
                                        ? 'bg-blue-50/60 border-blue-200/60 text-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
                                        : 'bg-rose-50/60 border-rose-200/60 text-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
                                }`}>
                                    <p className="font-semibold">
                                        {selectedComplaint.direction === 'student_to_hostel'
                                            ? 'Grievance filed by student tenant regarding your hostel'
                                            : 'Incident / misconduct report filed by you to the Dean of Students'}
                                    </p>
                                    <p className="text-[11px] opacity-90 mt-0.5">
                                        {selectedComplaint.direction === 'student_to_hostel'
                                            ? 'Please review the details below. You can contact the student directly via phone or WhatsApp to address the issue.'
                                            : 'This matter is currently on record with the Dean of Students office for disciplinary or administrative oversight.'}
                                    </p>
                                </div>

                                {/* Student Contact Card */}
                                <div className="p-3 bg-muted/40 rounded-xl text-xs space-y-2 border border-border/50">
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold text-foreground">
                                            Student / Tenant: <span className="font-normal">{selectedComplaint.studentName}</span>
                                        </p>
                                        {selectedComplaint.roomNumber && (
                                            <Badge variant="secondary" className="text-[11px]">
                                                Room {selectedComplaint.roomNumber}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-muted-foreground">
                                        {selectedComplaint.studentPhone && (
                                            <p className="flex items-center gap-1">
                                                <Phone className="h-3 w-3" /> {selectedComplaint.studentPhone}
                                            </p>
                                        )}
                                        {selectedComplaint.studentEmail && (
                                            <p className="truncate">Email: {selectedComplaint.studentEmail}</p>
                                        )}
                                    </div>

                                    {/* Quick Contact buttons if student phone exists */}
                                    {selectedComplaint.studentPhone && (
                                        <div className="flex gap-2 pt-1">
                                            <a
                                                href={`tel:${selectedComplaint.studentPhone}`}
                                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-colors"
                                            >
                                                <PhoneCall className="w-3 h-3" />
                                                Call Student
                                            </a>
                                            <a
                                                href={`https://wa.me/${selectedComplaint.studentPhone.replace(/\D/g, '').replace(/^0/, '233')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] text-xs font-semibold border border-[#25D366]/30 transition-colors"
                                            >
                                                <MessageSquare className="w-3 h-3" />
                                                WhatsApp Student
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* Full Description */}
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-muted-foreground">Detailed Description</Label>
                                    <div className="p-3 bg-background border rounded-xl text-xs whitespace-pre-wrap leading-relaxed">
                                        {selectedComplaint.description}
                                    </div>
                                </div>

                                {/* Dean Arbitration Section */}
                                <div className="space-y-1.5 pt-1">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                                        <Scale className="h-3.5 w-3.5 text-primary" />
                                        <span>Dean of Students Arbitration</span>
                                    </div>

                                    {selectedComplaint.resolutionNotes ? (
                                        <div className="p-3 bg-emerald-50/50 border border-emerald-200/70 dark:bg-emerald-950/20 dark:border-emerald-800/50 rounded-xl text-xs space-y-1">
                                            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                                                Dean&apos;s Directives & Findings:
                                            </p>
                                            <p className="text-emerald-800 dark:text-emerald-300 whitespace-pre-wrap">
                                                {selectedComplaint.resolutionNotes}
                                            </p>
                                            {selectedComplaint.resolvedAt && (
                                                <p className="text-[11px] text-muted-foreground pt-1">
                                                    Resolved: {format(new Date(selectedComplaint.resolvedAt), 'dd MMM yyyy')}
                                                    {selectedComplaint.resolvedBy ? ` by ${selectedComplaint.resolvedBy}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-muted/30 border border-border/50 rounded-xl text-xs text-muted-foreground flex items-start gap-2">
                                            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                                            <span>
                                                {selectedComplaint.status === 'Under Review'
                                                    ? 'The Dean of Students office is currently reviewing this matter and actively arbitrating.'
                                                    : 'This grievance has been submitted and is in queue for review by the Dean of Students office.'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <DialogFooter className="pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setComplaintDetailOpen(false)}
                                className="rounded-xl"
                            >
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Universal Document Viewer Modal */}
                <DocumentViewerModal
                    isOpen={docViewerState.isOpen}
                    onClose={() => setDocViewerState(prev => ({ ...prev, isOpen: false }))}
                    documentUrl={docViewerState.documentUrl}
                    title={docViewerState.title}
                    documentType={docViewerState.documentType}
                />
            </main>
        </div>
    );
}
