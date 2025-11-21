"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, User, KeyRound, Mail, Info, FileText, GraduationCap, UserCheck, Building, Phone, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { tenancyAgreementText } from '@/lib/legal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type UserRole = 'student' | 'agent' | 'hostel_manager' | null;

const facultyDepartments: Record<string, string[]> = {
    'Faculty of Technical Education (FTE)': [
        'Department of Construction Technology and Management Education',
        'Department of Wood Science and Technology Education',
        'Department of Electrical and Electronics Technology Education',
        'Department of Mechanical and Automotive Technology Education',
        'Department of Civil Engineering',
    ],
    'Faculty of Vocational Education (FVE)': [
        'Department of Catering & Hospitality Education',
        'Department of Fashion & Textiles Design Education',
    ],
    'Faculty of Applied Sciences and Mathematics Education (FASME)': [
        'Department of Information Technology Education',
        'Department of Mathematics Education',
    ],
    'Faculty of Business Education (FBE)': [
        'Department of Accounting Studies Education',
        'Department of Management Education',
        'Department of Economics Education',
        'Department of Human Resource and Strategy',
    ],
    'Faculty of Education and Communication Sciences (FECS)': [
        'Department of Languages Education',
        'Department of Interdisciplinary Studies',
        'Department of Educational Leadership',
    ],
};

export default function SignupPage() {
    const [selectedRole, setSelectedRole] = useState<UserRole>(null);
    const [fullName, setFullName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState('+233');
    const [otp, setOtp] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingOTP, setIsSendingOTP] = useState(false);
    const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [faculty, setFaculty] = useState('');
    const [department, setDepartment] = useState('');
    const { toast } = useToast();
    const router = useRouter();

    // State for multi-step form
    const [step, setStep] = useState(1); // 1: Role selection, 2: Basic info, 3: OTP/Terms, 4: Complete
    const [termsAccepted, setTermsAccepted] = useState(false);

    // Validate email format
    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Validate Ghana phone number
    const isValidPhoneNumber = (phone: string): boolean => {
        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');
        // Ghana numbers: 10 digits (0XXXXXXXXX) or 9 digits after country code
        return cleaned.length >= 9 && cleaned.length <= 10;
    };

    // Handle role selection
    const handleRoleSelect = (role: UserRole) => {
        setSelectedRole(role);
    };

    // Handle next step from role selection
    const handleRoleSelectionNext = () => {
        if (!selectedRole) {
            toast({ title: "Please select a role", variant: "destructive" });
            return;
        }
        setStep(2);
    };

    // Handle next step from basic info
    const handleBasicInfoNext = () => {
        if (!selectedRole) {
            toast({ title: "Missing Role", description: "Please select an account type.", variant: "destructive" });
            return;
        }

        if (password.length < 6) {
            toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" });
            return;
        }

        // Student-specific validation
        if (selectedRole === 'student') {
            if (!firstName || !lastName || !phoneNumber || !faculty || !department) {
                toast({ title: "Missing Fields", description: "Please fill in all required details for student signup.", variant: "destructive" });
                return;
            }

            if (!isValidPhoneNumber(phoneNumber)) {
                toast({ title: "Invalid Phone Number", description: "Please enter a valid Ghana phone number.", variant: "destructive" });
                return;
            }

            setStep(3);
            handleSendOTP();
            return;
        }

        // Agent validation (uses phone + OTP)
        if (selectedRole === 'agent') {
            if (!fullName || !email) {
                toast({ title: "Missing Fields", description: "Please fill out all required fields.", variant: "destructive" });
                return;
            }

            if (!isValidEmail(email)) {
                toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
                return;
            }

            if (!phoneNumber) {
                toast({ title: "Phone Number Required", description: "Please enter your phone number.", variant: "destructive" });
                return;
            }
            if (!isValidPhoneNumber(phoneNumber)) {
                toast({ title: "Invalid Phone Number", description: "Please enter a valid Ghana phone number.", variant: "destructive" });
                return;
            }

            setStep(3);
            handleSendOTP();
            return;
        }

        // Hostel managers: keep email-based signup without OTP for now
        if (selectedRole === 'hostel_manager') {
            if (!fullName || !email) {
                toast({ title: "Missing Fields", description: "Please fill out all required fields.", variant: "destructive" });
                return;
            }

            if (!isValidEmail(email)) {
                toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
                return;
            }

            handleSignup();
        }
    };

    // Send OTP to agent's phone
    const handleSendOTP = async () => {
        if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
            toast({ title: "Invalid Phone Number", description: "Please enter a valid phone number.", variant: "destructive" });
            return;
        }

        setIsSendingOTP(true);
        try {
            const fullPhone = countryCode + phoneNumber.replace(/\D/g, '');
            const response = await fetch('/api/sms/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: fullPhone }),
            });

            const data = await response.json();

            if (data.success) {
                setOtpSent(true);
                setResendCooldown(60); // 60 second cooldown
                toast({ title: "OTP Sent", description: "Please check your phone for the verification code." });
                
                // Start cooldown timer
                const timer = setInterval(() => {
                    setResendCooldown((prev) => {
                        if (prev <= 1) {
                            clearInterval(timer);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else {
                // Show detailed error message
                const errorMessage = data.error || "Failed to send OTP. Please try again.";
                const hint = data.hint ? `\n\nHint: ${data.hint}` : '';
                toast({ 
                    title: "Failed to Send OTP", 
                    description: errorMessage + hint, 
                    variant: "destructive" 
                });
            }
        } catch (error: any) {
            console.error("Error sending OTP:", error);
            toast({ 
                title: "Network Error", 
                description: "Failed to connect to the server. Please check your internet connection and try again.", 
                variant: "destructive" 
            });
        } finally {
            setIsSendingOTP(false);
        }
    };

    // Verify OTP
    const handleVerifyOTP = async () => {
        if (!otp || otp.length !== 6) {
            toast({ title: "Invalid OTP", description: "Please enter a 6-digit OTP.", variant: "destructive" });
            return;
        }

        setIsVerifyingOTP(true);
        try {
            const fullPhone = countryCode + phoneNumber.replace(/\D/g, '');
            const response = await fetch('/api/sms/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: fullPhone, otp }),
            });

            const data = await response.json();

            if (data.success) {
                setOtpVerified(true);
                toast({ title: "OTP Verified", description: "Phone number verified successfully!" });
                // Proceed to signup
                handleSignup();
            } else {
                toast({ title: "Invalid OTP", description: data.error || "Please check your OTP and try again.", variant: "destructive" });
            }
        } catch (error: any) {
            console.error("Error verifying OTP:", error);
            toast({ title: "Error", description: "Failed to verify OTP. Please try again.", variant: "destructive" });
        } finally {
            setIsVerifyingOTP(false);
        }
    };

    // Handle final signup
    const handleSignup = async () => {
        if (!selectedRole) {
            toast({ title: "Error", description: "Please select a role.", variant: "destructive" });
            return;
        }

        if ((selectedRole === 'agent' || selectedRole === 'student') && !otpVerified) {
            toast({ title: "OTP Required", description: "Please verify your phone number first.", variant: "destructive" });
            return;
        }
        
        setIsSubmitting(true);
        try {
            let authEmail = email;

            // Build synthetic auth email for students so they never need to type one
            if (selectedRole === 'student') {
                const cleanedNumber = phoneNumber.replace(/\D/g, '');
                const countryCodeDigits = countryCode.replace(/\D/g, '');
                const combinedPhone = countryCodeDigits + cleanedNumber;

                const firstThree = firstName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
                const lastThree = combinedPhone.slice(-3);
                const studentId = `STD-${firstThree}${lastThree}`;

                authEmail = `${studentId.toLowerCase()}@students.hostelhq.com`;

                // Derive fullName for storage
                const parts = [firstName, middleName, lastName].filter(Boolean);
                const derivedFullName = parts.join(' ');
                setFullName(derivedFullName);
            }

            const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
            const user = userCredential.user;

            let userData: any = {
                uid: user.uid,
                fullName: fullName || undefined,
                firstName: firstName || undefined,
                middleName: middleName || undefined,
                lastName: lastName || undefined,
                email: authEmail,
                role: selectedRole,
                createdAt: new Date().toISOString(),
            };

            // Add phone number for agents and students (store in numeric E.164-like format)
            if ((selectedRole === 'agent' || selectedRole === 'student') && phoneNumber) {
                // Remove all non-digits
                let cleanedNumber = phoneNumber.replace(/\D/g, '');
                // Remove leading 0 if present (Ghana numbers start with 0)
                if (cleanedNumber.startsWith('0')) {
                    cleanedNumber = cleanedNumber.substring(1);
                }
                // Remove + from country code and combine
                const countryCodeDigits = countryCode.replace(/\D/g, '');
                const combined = countryCodeDigits + cleanedNumber;
                userData.phoneNumber = combined;

                if (selectedRole === 'student') {
                    const firstThree = firstName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
                    const lastThree = combined.slice(-3);
                    const studentId = `STD-${firstThree}${lastThree}`;
                    userData.studentId = studentId;
                    userData.faculty = faculty;
                    userData.department = department;
                    userData.authEmail = authEmail;
                }
            }

            // (Optional) additional metadata for managers could be added here later

            // Create user document (no more pendingUsers for agents)
            await setDoc(doc(db, "users", user.uid), userData);

            toast({ title: 'Account Created Successfully!', description: 'Welcome to HostelHQ!' });

            // Redirect based on role
            if (selectedRole === 'hostel_manager') {
                router.push('/manager/dashboard');
            } else if (selectedRole === 'agent') {
                router.push('/agent/dashboard');
            } else {
                router.push('/');
            }

        } catch (error: any) {
            console.error("Signup error:", error);
            let errorMessage = "An unknown error occurred.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered. Please log in.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "Password should be at least 6 characters.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Please enter a valid email address.";
            }
            
            toast({
                title: 'Sign Up Failed',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Role selection cards
    const roleCards = [
        {
            role: 'student' as UserRole,
            icon: <GraduationCap className="h-8 w-8" />,
            title: 'Student',
            description: "I'm looking for a hostel to rent",
            color: 'text-blue-600',
        },
        {
            role: 'agent' as UserRole,
            icon: <UserCheck className="h-8 w-8" />,
            title: 'Agent',
            description: 'I want to list hostels and help students find rooms',
            color: 'text-green-600',
        },
        {
            role: 'hostel_manager' as UserRole,
            icon: <Building className="h-8 w-8" />,
            title: 'Hostel Manager',
            description: 'I manage hostel properties and oversee operations',
            color: 'text-purple-600',
        },
    ];

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="relative flex-1 bg-slate-900">
                <div className="absolute inset-0">
                    <Image
                        src="https://images.pexels.com/photos/3755761/pexels-photo-3755761.jpeg?auto=compress&cs=tinysrgb&w=2000"
                        alt="Students walking through a campus hostel corridor"
                        fill
                        priority
                        className="object-cover brightness-[0.55]"
                    />
                </div>

                <div className="relative flex h-full items-center justify-center py-10 px-4">
                    <Card className="w-full max-w-3xl border border-white/15 bg-white/10 text-slate-50 shadow-[0_18px_45px_rgba(15,23,42,0.7)] backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline text-slate-50">Create an Account</CardTitle>
                            <CardDescription className="text-slate-100/80">
                                {step === 1 && 'Choose your account type to get started'}
                                {step === 2 && 'Enter your account information'}
                                {step === 3 && (selectedRole === 'agent' || selectedRole === 'student') && 'Verify your phone number'}
                                {step === 3 && selectedRole === 'hostel_manager' && 'Terms and Agreement'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Step 1: Role Selection */}
                            {step === 1 && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {roleCards.map((card) => (
                                        <button
                                            key={card.role}
                                            onClick={() => handleRoleSelect(card.role)}
                                            className={cn(
                                                "p-6 border-2 rounded-lg text-left transition-all hover:shadow-md",
                                                selectedRole === card.role
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border hover:border-primary/50"
                                            )}
                                        >
                                            <div className={cn("mb-4", card.color)}>{card.icon}</div>
                                            <h3 className="font-semibold text-lg mb-2">{card.title}</h3>
                                            <p className="text-sm text-slate-100/80">{card.description}</p>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Step 2: Basic Info Form - Student */}
                            {step === 2 && selectedRole === 'student' && (
                                <div className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName">First Name</Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input
                                                    id="firstName"
                                                    placeholder="e.g., Elliot"
                                                    className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                    value={firstName}
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="middleName">Middle Name</Label>
                                            <Input
                                                id="middleName"
                                                placeholder="Optional"
                                                className="bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                value={middleName}
                                                onChange={(e) => setMiddleName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lastName">Last Name</Label>
                                            <Input
                                                id="lastName"
                                                placeholder="e.g., Entsiwah"
                                                className="bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="phone-student">Phone Number</Label>
                                        <div className="flex gap-2">
                                            <Select value={countryCode} onValueChange={setCountryCode}>
                                                <SelectTrigger className="w-24 bg-white/90 text-slate-900">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="+233">+233 (GH)</SelectItem>
                                                    <SelectItem value="+234">+234 (NG)</SelectItem>
                                                    <SelectItem value="+254">+254 (KE)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <div className="relative flex-1">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input
                                                    id="phone-student"
                                                    type="tel"
                                                    placeholder="0244123456"
                                                    className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                    value={phoneNumber}
                                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">We will send a verification code to this number.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password-student">Password</Label>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input
                                                id="password-student"
                                                type="password"
                                                placeholder="••••••••"
                                                className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Faculty</Label>
                                            <Select
                                                value={faculty}
                                                onValueChange={(value) => {
                                                    setFaculty(value);
                                                    setDepartment('');
                                                }}
                                            >
                                                <SelectTrigger className="bg-white/90 text-slate-900">
                                                    <SelectValue placeholder="Select your faculty" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.keys(facultyDepartments).map((fac) => (
                                                        <SelectItem key={fac} value={fac}>
                                                            {fac}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Department</Label>
                                            <Select
                                                value={department}
                                                onValueChange={setDepartment}
                                                disabled={!faculty}
                                            >
                                                <SelectTrigger className="bg-white/90 text-slate-900">
                                                    <SelectValue placeholder={faculty ? 'Select your department' : 'Select a faculty first'} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(facultyDepartments[faculty] || []).map((dept) => (
                                                        <SelectItem key={dept} value={dept}>
                                                            {dept}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Basic Info Form - Agent / Manager */}
                            {step === 2 && selectedRole !== 'student' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="fullname">Full Name</Label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input 
                                                id="fullname" 
                                                placeholder="e.g., Jane Doe" 
                                                className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500" 
                                                value={fullName} 
                                                onChange={(e) => setFullName(e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email Address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input 
                                                id="email" 
                                                type="email" 
                                                placeholder="your.email@example.com" 
                                                className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500" 
                                                value={email} 
                                                onChange={(e) => setEmail(e.target.value)} 
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">You can use any valid email address</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Password</Label>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input 
                                                id="password" 
                                                type="password" 
                                                placeholder="••••••••" 
                                                className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500" 
                                                value={password} 
                                                onChange={(e) => setPassword(e.target.value)}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                                    </div>
                                    {selectedRole === 'agent' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="phone">Phone Number</Label>
                                            <div className="flex gap-2">
                                                <Select value={countryCode} onValueChange={setCountryCode}>
                                                    <SelectTrigger className="w-24 bg-white/90 text-slate-900">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="+233">+233 (GH)</SelectItem>
                                                        <SelectItem value="+234">+234 (NG)</SelectItem>
                                                        <SelectItem value="+254">+254 (KE)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <div className="relative flex-1">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                    <Input 
                                                        id="phone" 
                                                        type="tel" 
                                                        placeholder="0244123456" 
                                                        className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500" 
                                                        value={phoneNumber} 
                                                        onChange={(e) => setPhoneNumber(e.target.value)} 
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground">We'll send a verification code to this number</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: OTP Verification (Students & Agents) */}
                        {step === 3 && (selectedRole === 'agent' || selectedRole === 'student') && (
                            <div className="space-y-4">
                                <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>Verify Your Phone Number</AlertTitle>
                                    <AlertDescription>
                                        {otpSent 
                                            ? "Enter the 6-digit code sent to your phone number."
                                            : "Click the button below to receive a verification code."}
                                    </AlertDescription>
                                </Alert>
                                {otpSent ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="otp">Verification Code</Label>
                                            <Input 
                                                id="otp" 
                                                type="text" 
                                                placeholder="000000" 
                                                maxLength={6}
                                                value={otp} 
                                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
                                                className="text-center text-2xl tracking-widest bg-white/95 text-slate-900 placeholder:text-slate-500"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={handleSendOTP}
                                                disabled={resendCooldown > 0 || isSendingOTP}
                                                className="flex-1"
                                            >
                                                {isSendingOTP ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    `Resend Code${resendCooldown > 0 ? ` (${resendCooldown}s)` : ''}`
                                                )}
                                            </Button>
                                            <Button
                                                onClick={handleVerifyOTP}
                                                disabled={otp.length !== 6 || isVerifyingOTP || otpVerified}
                                                className="flex-1"
                                            >
                                                {isVerifyingOTP ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Verifying...
                                                    </>
                                                ) : otpVerified ? (
                                                    'Verified ✓'
                                                ) : (
                                                    'Verify'
                                                )}
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <Button
                                        onClick={handleSendOTP}
                                        disabled={isSendingOTP}
                                        className="w-full"
                                    >
                                        {isSendingOTP ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            'Send Verification Code'
                                        )}
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Step 3: Terms Agreement (Manager) removed - managers now sign up without viewing the tenancy template here */}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        {step === 1 && (
                            <Button 
                                onClick={handleRoleSelectionNext} 
                                className="w-full" 
                                disabled={!selectedRole}
                            >
                                Continue
                            </Button>
                        )}
                        {step === 2 && (
                            <div className="flex gap-2 w-full">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setStep(1)} 
                                    className="flex-1 border-white/40 bg-white/5 text-slate-50 hover:bg-white/15"
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                                <Button 
                                    onClick={handleBasicInfoNext} 
                                    className="flex-1" 
                                    disabled={isSubmitting}
                                >
                                    {selectedRole === 'agent' || selectedRole === 'hostel_manager' ? 'Next' : 'Create Account'}
                                </Button>
                            </div>
                        )}
                        {step === 3 && (selectedRole === 'agent' || selectedRole === 'student') && otpVerified && (
                            <Button 
                                onClick={handleSignup} 
                                className="w-full" 
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </Button>
                        )}
                        {/* Managers no longer have a separate Step 3; they complete signup directly after basic info. */}
                        <p className="text-sm text-slate-100/80 text-center">
                            Already have an account?{' '}
                            <Link href="/login" className="text-accent font-semibold hover:underline">
                                Log In
                            </Link>
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </main>
    </div>
    );
}
