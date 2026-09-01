"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/header';
import { getHostel, Hostel, RoomType } from '@/lib/data';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Phone, 
  Mail, 
  User, 
  MapPin, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  Bed, 
  Sparkles,
  Building,
  ArrowRight
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { sendVisitBookingSMSAction } from '@/app/actions/sms';
import { notifyVisitScheduled, notifyManagerVisitRequest } from '@/lib/notification-service-onesignal';

const TIME_SLOTS = [
  { value: "09:00 - 12:00", label: "Morning (9:00 AM – 12:00 PM)" },
  { value: "12:00 - 15:00", label: "Early Afternoon (12:00 PM – 3:00 PM)" },
  { value: "15:00 - 18:00", label: "Late Afternoon (3:00 PM – 6:00 PM)" },
];

export default function BookingVisitPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const id = params.id as string;
  const roomTypeId = searchParams.get('roomTypeId');

  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdVisitId, setCreatedVisitId] = useState<string | null>(null);

  // Form state
  const [studentName, setStudentName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(roomTypeId || '');
  const [visitDate, setVisitDate] = useState<Date | undefined>(
    () => new Date(Date.now() + 24 * 60 * 60 * 1000) // Default tomorrow
  );
  const [visitTimeSlot, setVisitTimeSlot] = useState(TIME_SLOTS[0].value);
  const [notes, setNotes] = useState('');

  // Fetch current user and prefill
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as any;
            if (userData.verificationStatus) setVerificationStatus(userData.verificationStatus);
            if (userData.fullName) setStudentName(userData.fullName);
            if (userData.email || user.email) setEmail(userData.email || user.email || '');
            if (userData.phoneNumber || userData.phone) setPhone(userData.phoneNumber || userData.phone || '');
          } else {
            if (user.displayName) setStudentName(user.displayName);
            if (user.email) setEmail(user.email);
            if (user.phoneNumber) setPhone(user.phoneNumber);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch hostel details
  useEffect(() => {
    const fetchHostelData = async () => {
      if (!id) return;
      const data = await getHostel(id);
      if (!data) {
        notFound();
        return;
      }
      setHostel(data);
      if (!selectedRoomId && data.roomTypes?.length) {
        setSelectedRoomId(data.roomTypes[0].id);
      }
      setLoading(false);
    };

    fetchHostelData();
  }, [id, selectedRoomId]);

  const selectedRoom: RoomType | undefined = hostel?.roomTypes?.find(
    (rt) => rt.id === selectedRoomId
  );

  const handleSubmitVisit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hostel) return;

    if (!studentName.trim() || !phone.trim() || !email.trim() || !visitDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in your name, contact phone, email, and preferred date.",
        variant: "destructive",
      });
      return;
    }

    if (!currentUser) {
      const redirectUrl = `/hostels/${id}/book?roomTypeId=${selectedRoomId}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
      toast({
        title: "Login Required",
        description: "Please log in with your student account to schedule your free inspection.",
      });
      return;
    }

    if (verificationStatus === 'pending') {
      toast({
        title: "Account Under Review",
        description: "Your student credentials are currently undergoing authentication by the HostelHQ Administration. You can browse hostels in preview mode while your verification is in progress.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const managerPhone = (hostel as any).managerPhone || (hostel as any).contactPhone || "+233597626090";
      
      const newVisit = {
        hostelId: id,
        hostelName: hostel.name,
        studentId: currentUser.uid,
        studentName: studentName.trim(),
        studentEmail: email.trim(),
        studentPhone: phone.trim(),
        roomTypeId: selectedRoomId || null,
        roomTypeName: selectedRoom?.name || "General Inspection",
        visitDate: visitDate.toISOString(),
        visitTime: visitTimeSlot,
        notes: notes.trim(),
        status: "pending",
        visitType: "self", // free direct visit with manager
        createdAt: new Date().toISOString(),
        studentCompleted: false,
        managerPhone: managerPhone,
      };

      const docRef = await addDoc(collection(db, "visits"), newVisit);
      setCreatedVisitId(docRef.id);
      setIsSuccess(true);

      const formattedVisitDate = format(visitDate, 'EEE, MMM d, yyyy');

      // 1. Dispatch SMS notification to both manager and student
      sendVisitBookingSMSAction({
        visitId: docRef.id,
        hostelId: id,
        hostelName: hostel.name,
        studentName: studentName.trim(),
        studentPhone: phone.trim(),
        visitDate: formattedVisitDate,
        visitTime: visitTimeSlot,
        roomTypeName: selectedRoom?.name || "General Inspection",
      }).catch((err) => console.error("Failed to send visit booking SMS:", err));

      // 2. Dispatch push notifications
      notifyVisitScheduled(currentUser.uid, hostel.name, formattedVisitDate)
        .catch((err) => console.error("Failed to send student visit push notification:", err));

      const managerId = (hostel as any).managerId;
      if (managerId) {
        notifyManagerVisitRequest(managerId, studentName.trim(), hostel.name, docRef.id)
          .catch((err) => console.error("Failed to send manager visit push notification:", err));
      }

      toast({
        title: "Visit Scheduled Successfully! 🎉",
        description: `Your free visit to ${hostel.name} has been confirmed. Confirmation SMS sent to your phone.`,
      });
    } catch (err: any) {
      console.error("Error creating visit request:", err);
      toast({
        title: "Booking Error",
        description: err.message || "Failed to schedule visit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!hostel) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      <Header />
      <main className="flex-1 py-8 md:py-12">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          {/* Breadcrumb & Top Bar */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground -ml-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to hostel
            </Button>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                University-Approved ✓
              </span>
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                100% Free Inspection
              </span>
            </div>
          </div>

          {/* Success Screen */}
          {isSuccess ? (
            <Card className="shadow-xl border-emerald-200 bg-white max-w-2xl mx-auto overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-8 text-center text-white">
                <div className="mx-auto w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 shadow-inner">
                  <CheckCircle2 className="h-10 w-10 text-white" />
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold">Visit Request Confirmed!</h1>
                <p className="text-white/90 text-sm mt-2 max-w-md mx-auto">
                  Your free in-person tour of {hostel.name} has been scheduled.
                </p>
              </div>

              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="rounded-xl bg-gray-50 border border-border p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Hostel:</span>
                    <span className="font-semibold text-foreground">{hostel.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-semibold text-foreground">{hostel.location}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Scheduled Date:</span>
                    <span className="font-semibold text-foreground">
                      {visitDate ? format(visitDate, "EEEE, MMMM d, yyyy") : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Time Slot:</span>
                    <span className="font-semibold text-foreground">{visitTimeSlot}</span>
                  </div>
                  {selectedRoom && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Target Room:</span>
                      <span className="font-semibold text-foreground">
                        {selectedRoom.name} (GH₵{selectedRoom.price.toLocaleString()}/yr)
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">Inspection Fee:</span>
                    <span className="font-bold text-emerald-600">GH₵0.00 (FREE)</span>
                  </div>
                </div>

                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                  <p className="font-semibold text-sm text-blue-900 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-700" />
                    Hostel Manager Contact
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    The hostel management has been alerted. You can also directly contact them if you are arriving early:
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="bg-white" asChild>
                      <a href={`tel:${(hostel as any).managerPhone || '+233597626090'}`}>
                        <Phone className="h-3.5 w-3.5 mr-1.5" />
                        Call Manager
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="bg-white" asChild>
                      <a 
                        href={`https://wa.me/${((hostel as any).managerPhone || '233597626090').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I scheduled a free visit to ${hostel.name} on HostelHQ for ${visitDate ? format(visitDate, 'MMM d') : ''}.`)}`} 
                        target="_blank" 
                        rel="noreferrer"
                      >
                        WhatsApp Manager
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-11"
                    onClick={() => router.push('/my-bookings')}
                  >
                    View in My Bookings
                  </Button>
                  <Button
                    className="flex-1 h-11 bg-primary text-primary-foreground font-semibold shadow-md flex items-center justify-center gap-2"
                    onClick={() => router.push(`/hostels/${id}/secure?roomTypeId=${selectedRoomId}`)}
                  >
                    <span>Secure Room Now</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Booking Form View */
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
              {/* Left Column: Booking Form */}
              <Card className="shadow-xl border-0 bg-white">
                <CardHeader>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Sparkles className="h-4 w-4" />
                    <span>Free Inspection Scheduling</span>
                  </div>
                  <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">
                    Schedule a Free Visit to {hostel.name}
                  </CardTitle>
                  <CardDescription>
                    Inspect the rooms in person, meet the management, and verify amenities before paying a pesewa.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleSubmitVisit} className="space-y-6">
                    {/* Room Type Selector */}
                    {hostel.roomTypes && hostel.roomTypes.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="room-type" className="text-sm font-semibold">
                          Room Type You Wish to Inspect
                        </Label>
                        <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                          <SelectTrigger id="room-type" className="h-11 bg-gray-50/50">
                            <SelectValue placeholder="Choose a room type" />
                          </SelectTrigger>
                          <SelectContent>
                            {hostel.roomTypes.map((rt) => (
                              <SelectItem key={rt.id} value={rt.id}>
                                {rt.name} — GH₵{rt.price.toLocaleString()} / year ({rt.capacity} in room)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Date and Time Picker */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Preferred Visit Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full h-11 justify-start text-left font-normal bg-gray-50/50",
                                !visitDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                              {visitDate ? format(visitDate, "PPP") : "Select date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={visitDate}
                              onSelect={setVisitDate}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Preferred Time Window</Label>
                        <Select value={visitTimeSlot} onValueChange={setVisitTimeSlot}>
                          <SelectTrigger className="h-11 bg-gray-50/50">
                            <Clock className="mr-2 h-4 w-4 text-primary shrink-0" />
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_SLOTS.map((slot) => (
                              <SelectItem key={slot.value} value={slot.value}>
                                {slot.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator />

                    {/* Student Information */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        Your Contact Details
                      </h3>

                      <div className="space-y-2">
                        <Label htmlFor="student-name">Full Student Name</Label>
                        <Input
                          id="student-name"
                          type="text"
                          required
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          placeholder="e.g. Kwame Mensah"
                          className="h-11 bg-gray-50/50"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="student-phone">Active Phone Number</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="student-phone"
                              type="tel"
                              required
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="024 123 4567"
                              className="pl-9 h-11 bg-gray-50/50"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="student-email">Email Address</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="student-email"
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="kwame@st.aamusted.edu.gh"
                              className="pl-9 h-11 bg-gray-50/50"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Special Requests / Questions (Optional)</Label>
                        <Textarea
                          id="notes"
                          rows={2}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="e.g., I would like to see the top floor rooms and verify bathroom water pressure."
                          className="bg-gray-50/50 resize-none text-sm"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 space-y-1">
                      <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        HostelHQ Zero Extortion Guarantee
                      </div>
                      <p>
                        Visits on HostelHQ are 100% free of charge. You will meet directly with accredited hostel management. Never pay anyone an &ldquo;inspection fee&rdquo; or middleman surcharge.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-12 text-base font-semibold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Scheduling Free Visit...
                        </>
                      ) : (
                        <>
                          <CalendarIcon className="mr-2 h-5 w-5" />
                          Request Free Visit (GH₵0.00)
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Right Column: Hostel & Security Summary */}
              <div className="space-y-6">
                <Card className="shadow-lg border-0 bg-white overflow-hidden">
                  <div className="relative h-44 w-full">
                    <Image
                      src={hostel.images?.[0] || '/placeholder.jpg'}
                      alt={hostel.name}
                      fill
                      className="object-cover"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="font-bold text-lg leading-tight">{hostel.name}</h3>
                      <p className="text-xs text-white/90 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-emerald-400" />
                        {hostel.location}
                      </p>
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-4 text-sm">
                    {selectedRoom && (
                      <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Selected Room Type</div>
                        <div className="font-semibold text-foreground flex justify-between items-center">
                          <span>{selectedRoom.name}</span>
                          <span className="text-primary font-bold">
                            GH₵{selectedRoom.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {selectedRoom.capacity} in a room • {hostel.gender || "Mixed"}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Institution</span>
                        <span className="font-medium text-foreground">{hostel.institution || 'AAMUSTED'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Campus Distance</span>
                        <span className="font-medium text-foreground">{hostel.distance || 'Near Campus'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Accreditation</span>
                        <span className="font-semibold text-emerald-600">Verified ✓</span>
                      </div>
                      <div className="flex justify-between text-xs pt-2 border-t border-border">
                        <span className="text-muted-foreground">Inspection Fee</span>
                        <span className="font-bold text-emerald-600">FREE</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* University Protection Guarantee */}
                <Card className="border border-emerald-200 bg-emerald-50/60 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-sm text-emerald-950">University Protection</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-emerald-800">
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">•</span>
                      Accredited by University Housing Board
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">•</span>
                      No brokers, middlemen, or extortionate visit fees
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">•</span>
                      Direct key handoff guaranteed upon booking
                    </li>
                  </ul>
                </Card>

                {/* Fast-track banner */}
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 text-center space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    Already seen this hostel or want to lock your room immediately?
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => router.push(`/hostels/${id}/secure?roomTypeId=${selectedRoomId}`)}
                  >
                    Skip Visit & Secure Room Now
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
