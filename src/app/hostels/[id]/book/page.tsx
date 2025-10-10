
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { getHostel, Hostel } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Calendar as CalendarIcon, Loader2, Phone, Briefcase, Clock, User, Navigation } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { initializeMomoPayment } from '@/app/actions/paystack';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


type VisitType = 'agent' | 'self';

const visitOptions = {
    agent: {
        price: 10,
        title: "Visit with an Agent",
        description: "An agent will guide you to the hostel and show you the room.",
        icon: <User className="h-5 w-5" />
    },
    self: {
        price: 35,
        title: "Visit by Yourself",
        description: "Get detailed directions and visit the hostel at your convenience.",
        icon: <Navigation className="h-5 w-5" />
    }
}


export default function BookingPage() {
    const [hostel, setHostel] = useState<Hostel | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    
    // Form state
    const [visitType, setVisitType] = useState<VisitType>('agent');
    const [phone, setPhone] = useState('');
    const [provider, setProvider] = useState('');
    const [email, setEmail] = useState('student@test.com'); // Default email
    const [visitDate, setVisitDate] = useState<Date>();
    const [visitTime, setVisitTime] = useState('');


    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const id = params.id as string;
    const roomTypeId = searchParams.get('roomTypeId');

    useEffect(() => {
        const fetchHostelData = async () => {
            const hostelData = await getHostel(id);
            if (!hostelData) {
                notFound();
            }
            setHostel(hostelData);
            setLoading(false);
        };
        fetchHostelData();
    }, [id]);

    const handlePayment = async () => {
        const isAgentVisit = visitType === 'agent';
        if (!hostel || !phone || !provider || !email || (isAgentVisit && (!visitDate || !visitTime))) {
            toast({ title: "Missing Information", description: "Please fill all required fields for your chosen visit type.", variant: "destructive" });
            return;
        }

        setIsPaying(true);
        toast({ title: "Initializing Payment..." });
        
        try {
            const result = await initializeMomoPayment({
                email,
                amount: visitOptions[visitType].price * 100, // Price in pesewas
                phone,
                provider: provider as 'mtn' | 'vod' | 'tgo',
                label: `Visit fee for ${hostel.name}`,
                hostelId: id,
                visitDate: isAgentVisit && visitDate ? visitDate.toISOString() : new Date().toISOString(), // Use current date for self-visit
                visitTime: isAgentVisit ? visitTime : '',
                visitType: visitType,
            });

            if (result.status && result.authorization_url) {
                toast({ title: "Redirecting to Payment", description: "Your payment page will open in a new tab."});
                window.open(result.authorization_url, '_blank');
            } else {
                throw new Error(result.message || "Failed to initialize payment.");
            }

        } catch (error: any) {
            console.error("Payment initialization failed:", error);
            toast({ title: "Payment Error", description: error.message || "Could not connect to payment service.", variant: "destructive" });
        } finally {
            setIsPaying(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                </main>
            </div>
        );
    }
    
    if (!hostel) {
        notFound();
    }


    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4">
                <Card className="w-full max-w-2xl shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline">Book a Visit to {hostel.name}</CardTitle>
                        <CardDescription>Secure your spot to visit this hostel. Choose your preferred method.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <RadioGroup defaultValue="agent" onValueChange={(value: VisitType) => setVisitType(value)} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                           {Object.entries(visitOptions).map(([key, option]) => (
                                <Label key={key} htmlFor={key} className={cn("flex flex-col items-start rounded-lg border p-4 cursor-pointer transition-all hover:bg-accent/10", visitType === key && "ring-2 ring-primary bg-primary/5")}>
                                     <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value={key} id={key} />
                                            <span className="font-semibold text-base">{option.title}</span>
                                        </div>
                                        <div className="font-bold text-lg">
                                            GH₵{option.price.toFixed(2)}
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2 pl-8">{option.description}</p>
                                </Label>
                           ))}
                        </RadioGroup>

                        <div className="space-y-4">
                            {visitType === 'agent' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/20">
                                    <div className="space-y-2">
                                        <Label htmlFor="visit-date">Visit Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                "w-full justify-start text-left font-normal bg-background",
                                                !visitDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {visitDate ? format(visitDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={visitDate}
                                                    onSelect={setVisitDate}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="visit-time">Proposed Time</Label>
                                        <Input id="visit-time" type="time" value={visitTime} onChange={e => setVisitTime(e.target.value)} className="bg-background"/>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Mobile Money Phone</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <Input id="phone" type="tel" className="pl-10" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+233244123456" />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="provider">Provider</Label>
                                 <Select value={provider} onValueChange={setProvider}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select mobile money provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mtn">MTN</SelectItem>
                                        <SelectItem value="vod">Telecel (Vodafone)</SelectItem>
                                        <SelectItem value="tgo">AirtelTigo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter>
                        <Button className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handlePayment} disabled={isPaying}>
                            {isPaying ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
                             Pay GH₵{visitOptions[visitType].price.toFixed(2)}
                        </Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
