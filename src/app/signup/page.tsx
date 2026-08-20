"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, User, KeyRound, Mail, Info, FileText, GraduationCap, UserCheck, Building, Phone, ArrowLeft, Eye, EyeOff, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

type UserRole = 'student' | 'agent' | 'hostel_manager';

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
    const [selectedRole, setSelectedRole] = useState<UserRole>('student');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState('+233');
    const [studentIndexNumber, setStudentIndexNumber] = useState('');
    const [faculty, setFaculty] = useState('');
    const [department, setDepartment] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(true);
    
    // Manager specific state
    const [managerHostels, setManagerHostels] = useState<{ id: string; name?: string; location?: string; managerId?: string }[]>([]);
    const [loadingManagerHostels, setLoadingManagerHostels] = useState(false);
    const [selectedManagerHostelId, setSelectedManagerHostelId] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

    const { toast } = useToast();
    const router = useRouter();

    // Load available hostels for manager signup
    useEffect(() => {
        if (selectedRole === 'hostel_manager') {
            const loadHostels = async () => {
                setLoadingManagerHostels(true);
                try {
                    const snap = await getDocs(collection(db, 'hostels'));
                    const list = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
                    const filtered = list.filter((h: any) => !h.managerId);
                    setManagerHostels(filtered);
                } catch (err) {
                    console.error('Error loading hostels:', err);
                } finally {
                    setLoadingManagerHostels(false);
                }
            };
            loadHostels();
        }
    }, [selectedRole]);

    const isValidEmail = (email: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const isValidPhoneNumber = (phone: string): boolean => {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length >= 9 && cleaned.length <= 10;
    };

    // Google Single Sign-On for 1-Click Fast Student Signup (PRD 3.1)
    const handleGoogleSignup = async () => {
        setIsGoogleSubmitting(true);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, {
                    uid: user.uid,
                    email: user.email,
                    fullName: user.displayName || 'Student',
                    role: 'student',
                    createdAt: new Date().toISOString(),
                    profileImage: user.photoURL || '',
                    authProvider: 'google',
                    verificationStatus: 'verified_email',
                });
            }

            toast({
                title: 'Account Created Successfully!',
                description: `Welcome to HostelHQ, ${user.displayName || 'Student'}!`,
            });

            router.push('/my-bookings?welcome=true');
        } catch (error: any) {
            console.error('Google signup error:', error);
            toast({
                title: 'Google Sign-Up Failed',
                description: error.message || 'Could not complete Google Sign-Up.',
                variant: 'destructive',
            });
        } finally {
            setIsGoogleSubmitting(false);
        }
    };

    // Frictionless 30-Second Student & Partner Registration
    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fullName.trim()) {
            toast({ title: 'Full Name Required', description: 'Please enter your full name.', variant: 'destructive' });
            return;
        }

        if (!email.trim() || !isValidEmail(email)) {
            toast({ title: 'Invalid Email', description: 'Please enter a valid personal email address.', variant: 'destructive' });
            return;
        }

        if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
            toast({ title: 'Invalid Phone Number', description: 'Please enter a valid 9 or 10-digit Ghana phone number.', variant: 'destructive' });
            return;
        }

        if (password.length < 6) {
            toast({ title: 'Weak Password', description: 'Password must be at least 6 characters.', variant: 'destructive' });
            return;
        }

        if (!termsAccepted) {
            toast({ title: 'Terms Required', description: 'Please accept the terms of service.', variant: 'destructive' });
            return;
        }

        if (selectedRole === 'hostel_manager' && !selectedManagerHostelId) {
            toast({ title: 'Hostel Assignment Required', description: 'Please select the hostel you manage.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const user = userCredential.user;

            // 2. Format phone number (E.164 without plus)
            let cleanedPhone = phoneNumber.replace(/\D/g, '');
            if (cleanedPhone.startsWith('0')) {
                cleanedPhone = cleanedPhone.substring(1);
            }
            const fullPhone = countryCode.replace(/\D/g, '') + cleanedPhone;

            // 3. Build unified user profile
            const userData: any = {
                uid: user.uid,
                email: email.trim().toLowerCase(),
                fullName: fullName.trim(),
                phone: fullPhone,
                phoneNumber: fullPhone,
                role: selectedRole,
                createdAt: new Date().toISOString(),
                verificationStatus: 'progressive_pending', // Deferred until booking confirmation per PRD 3.1
            };

            if (selectedRole === 'student') {
                if (studentIndexNumber.trim()) {
                    userData.studentIndexNumber = studentIndexNumber.trim();
                }
                if (faculty) userData.faculty = faculty;
                if (department) userData.department = department;
            }

            if (selectedRole === 'hostel_manager' && selectedManagerHostelId) {
                userData.managedHostelId = selectedManagerHostelId;
            }

            // 4. Save to Firestore
            await setDoc(doc(db, 'users', user.uid), userData);

            // 5. If manager, link to hostel document
            if (selectedRole === 'hostel_manager' && selectedManagerHostelId) {
                try {
                    await updateDoc(doc(db, 'hostels', selectedManagerHostelId), {
                        managerId: user.uid,
                    });
                } catch (assignErr) {
                    console.error('Error assigning manager to hostel:', assignErr);
                }
            }

            // 6. Send welcome SMS notification (best-effort non-blocking)
            try {
                const welcomeMsg = `Welcome to HostelHQ, ${fullName}! Your ${selectedRole} account is active. Log in anytime with ${email}. Safe & verified stays!`;
                fetch('/api/sms/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: fullPhone, message: welcomeMsg }),
                }).catch(() => {});
            } catch (_) {}

            toast({
                title: 'Account Created Successfully!',
                description: 'Welcome to HostelHQ!',
            });

            // Redirect based on role
            if (selectedRole === 'hostel_manager') {
                router.push('/manager/dashboard');
            } else if (selectedRole === 'agent') {
                router.push('/agent/dashboard');
            } else {
                router.push('/my-bookings?welcome=true');
            }
        } catch (error: any) {
            console.error('Signup error:', error);
            let message = 'An unexpected error occurred during signup.';
            if (error.code === 'auth/email-already-in-use') {
                message = 'This email is already registered. Please sign in instead.';
            } else if (error.code === 'auth/weak-password') {
                message = 'Password should be at least 6 characters long.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Please enter a valid email address.';
            }
            toast({
                title: 'Sign Up Failed',
                description: message,
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const roles = [
        {
            id: 'student' as UserRole,
            title: 'Student',
            description: 'Find, visit & secure verified rooms near campus',
            icon: <GraduationCap className="h-5 w-5" />,
            badge: 'Fast 30s',
        },
        {
            id: 'agent' as UserRole,
            title: 'Field Agent',
            description: 'List hostels, guide student visits & earn commission',
            icon: <UserCheck className="h-5 w-5" />,
            badge: 'Partner',
        },
        {
            id: 'hostel_manager' as UserRole,
            title: 'Hostel Manager',
            description: 'Manage room inventory, bookings & wallet payouts',
            icon: <Building className="h-5 w-5" />,
            badge: 'Landlord',
        },
    ];

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="relative flex-1 bg-slate-900 flex items-center justify-center py-12 px-4">
                <div className="absolute inset-0">
                    <Image
                        src="https://images.pexels.com/photos/3755761/pexels-photo-3755761.jpeg?auto=compress&cs=tinysrgb&w=2000"
                        alt="Campus hostel background"
                        fill
                        priority
                        className="object-cover brightness-[0.45]"
                    />
                </div>

                <div className="relative z-10 w-full max-w-xl">
                    <Card className="border border-white/15 bg-white/10 text-slate-50 shadow-[0_18px_45px_rgba(15,23,42,0.7)] backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="text-center pt-8 pb-4">
                            <div className="inline-flex items-center gap-2 mx-auto mb-3 rounded-full border border-primary/40 bg-primary/20 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent backdrop-blur-md">
                                <Sparkles className="h-3.5 w-3.5" />
                                Frictionless Student Onboarding
                            </div>
                            <CardTitle className="text-3xl font-headline font-extrabold tracking-tight text-white">Create Your Account</CardTitle>
                            <CardDescription className="text-slate-200/80 text-sm mt-1">
                                Safe, verified student accommodation across Ghana
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-6 px-6 sm:px-10">
                            {/* Role Switcher */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                    I am joining as:
                                </Label>
                                <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-black/40 border border-white/10">
                                    {roles.map((r) => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => setSelectedRole(r.id)}
                                            className={cn(
                                                "flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 text-center relative",
                                                selectedRole === r.id
                                                    ? "bg-primary text-white shadow-lg font-bold"
                                                    : "text-slate-300 hover:text-white hover:bg-white/5 font-medium"
                                            )}
                                        >
                                            <div className="mb-1">{r.icon}</div>
                                            <span className="text-xs">{r.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Google Sign-In Button for Students */}
                            {selectedRole === 'student' && (
                                <div className="space-y-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleGoogleSignup}
                                        disabled={isGoogleSubmitting || isSubmitting}
                                        className="w-full h-12 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border-white/20 font-semibold shadow-md flex items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.01]"
                                    >
                                        {isGoogleSubmitting ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                                <path
                                                    fill="#4285F4"
                                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                />
                                                <path
                                                    fill="#34A853"
                                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                />
                                                <path
                                                    fill="#FBBC05"
                                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                                />
                                                <path
                                                    fill="#EA4335"
                                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                                />
                                            </svg>
                                        )}
                                        <span>Sign up with Google</span>
                                    </Button>

                                    <div className="relative flex items-center justify-center my-3">
                                        <div className="border-t border-white/15 w-full" />
                                        <span className="bg-slate-900/80 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-300 backdrop-blur-md">
                                            or register in 30s
                                        </span>
                                        <div className="border-t border-white/15 w-full" />
                                    </div>
                                </div>
                            )}

                            {/* Main Signup Form */}
                            <form onSubmit={handleSignup} className="space-y-4">
                                {/* Full Name */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                        Full Name *
                                    </Label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                        <Input
                                            id="fullName"
                                            required
                                            type="text"
                                            placeholder="e.g. Kwame Mensah"
                                            className="pl-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Personal Email */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                        Personal Email (Gmail / Yahoo) *
                                    </Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                        <Input
                                            id="email"
                                            required
                                            type="email"
                                            placeholder="e.g. kwame.mensah@gmail.com"
                                            className="pl-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Ghana Phone Number */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                        Phone Number (MoMo Enabled) *
                                    </Label>
                                    <div className="flex gap-2">
                                        <div className="w-24 shrink-0 flex items-center justify-center rounded-xl bg-white/10 border border-white/20 text-sm font-semibold text-white">
                                            +233 🇬🇭
                                        </div>
                                        <div className="relative flex-1">
                                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                            <Input
                                                id="phone"
                                                required
                                                type="tel"
                                                placeholder="e.g. 0244123456"
                                                className="pl-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Student Index Number (PRD 3.1 - Student Role) */}
                                {selectedRole === 'student' && (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="indexNumber" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                Student Index / Reference Number
                                            </Label>
                                            <span className="text-[10px] text-accent font-semibold">Optional for Freshmen</span>
                                        </div>
                                        <div className="relative">
                                            <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                            <Input
                                                id="indexNumber"
                                                type="text"
                                                placeholder="e.g. 5201040001 (or leave blank if freshman)"
                                                className="pl-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium"
                                                value={studentIndexNumber}
                                                onChange={(e) => setStudentIndexNumber(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Faculty & Department (Student Role) */}
                                {selectedRole === 'student' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-200">Faculty</Label>
                                            <Select value={faculty} onValueChange={(val) => { setFaculty(val); setDepartment(''); }}>
                                                <SelectTrigger className="h-11 bg-white/95 text-slate-900 rounded-xl border-white/20 font-medium">
                                                    <SelectValue placeholder="Select faculty" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.keys(facultyDepartments).map((fac) => (
                                                        <SelectItem key={fac} value={fac}>{fac}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-200">Department</Label>
                                            <Select value={department} onValueChange={setDepartment} disabled={!faculty}>
                                                <SelectTrigger className="h-11 bg-white/95 text-slate-900 rounded-xl border-white/20 font-medium">
                                                    <SelectValue placeholder="Select department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(facultyDepartments[faculty] || []).map((dept) => (
                                                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {/* Manager Hostel Assignment (Hostel Manager Role) */}
                                {selectedRole === 'hostel_manager' && (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                            Managed Hostel Property *
                                        </Label>
                                        <Select value={selectedManagerHostelId} onValueChange={setSelectedManagerHostelId}>
                                            <SelectTrigger className="h-11 bg-white/95 text-slate-900 rounded-xl border-white/20 font-medium">
                                                <SelectValue placeholder={loadingManagerHostels ? "Loading hostels..." : "Select your hostel property"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {managerHostels.map((h) => (
                                                    <SelectItem key={h.id} value={h.id}>
                                                        {h.name || 'Unnamed Hostel'} ({h.location || 'Campus area'})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Password */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                        Password *
                                    </Label>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                        <Input
                                            id="password"
                                            required
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="At least 6 characters"
                                            className="pl-11 pr-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Progressive disclosure note */}
                                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-black/30 border border-white/10 text-xs text-slate-300">
                                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Progressive Verification:</strong> Identity documents (Student Portal screenshot or Ghana Card) are only requested when securing a room. No upfront uploads needed.
                                    </span>
                                </div>

                                {/* Terms & Conditions */}
                                <div className="flex items-center space-x-2 pt-1">
                                    <Checkbox
                                        id="terms"
                                        checked={termsAccepted}
                                        onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                                        className="border-white/40 data-[state=checked]:bg-primary"
                                    />
                                    <label htmlFor="terms" className="text-xs text-slate-300 cursor-pointer">
                                        I agree to the{' '}
                                        <Link href="/terms" className="text-primary font-semibold hover:underline">
                                            Terms of Service
                                        </Link>{' '}
                                        and Privacy Policy.
                                    </label>
                                </div>

                                {/* Submit Button */}
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || isGoogleSubmitting}
                                    className="w-full h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 shadow-xl shadow-primary/30 transition-all duration-200 hover:scale-[1.01] mt-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Creating Account...
                                        </>
                                    ) : (
                                        `Create ${selectedRole === 'student' ? 'Student' : selectedRole === 'agent' ? 'Agent' : 'Manager'} Account`
                                    )}
                                </Button>
                            </form>
                        </CardContent>

                        <CardFooter className="flex flex-col gap-2 px-6 sm:px-10 pb-8 pt-0">
                            <p className="text-center text-xs text-slate-300/90">
                                Already have an account?{' '}
                                <Link href="/login" className="text-primary font-bold hover:underline">
                                    Sign In here
                                </Link>
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}
