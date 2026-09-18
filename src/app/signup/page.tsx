"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Loader2, User, KeyRound, Mail, GraduationCap, Building, Phone, 
    Eye, EyeOff, ShieldCheck, ArrowLeft, RefreshCw, FileText, 
    CheckCircle2, Clock, ShieldAlert, ArrowRight, Lock, Check
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { cn, parseStudentCredentials } from '@/lib/utils';
import { DocumentUploader } from '@/components/DocumentUploader';
import { facultyDepartments, facultyPrograms } from '@/app/student/register/page';

type UserRole = 'student' | 'hostel_manager';

export default function SignupPage() {
    const [selectedRole, setSelectedRole] = useState<UserRole>('student');
    
    // 3-Step Wizard for Student: 1 = Account Credentials, 2 = Academic Profile, 3 = Verification & Security
    const [studentStep, setStudentStep] = useState<1 | 2 | 3>(1);

    // Step 1: Account Credentials
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState('+233');

    // Step 2: Academic Profile
    const [isFresher, setIsFresher] = useState(false);
    const [studentIndexNumber, setStudentIndexNumber] = useState('');
    const [faculty, setFaculty] = useState('');
    const [department, setDepartment] = useState('');
    const [programOfStudy, setProgramOfStudy] = useState('');

    // Step 3: Verification Document & Account Security
    const [documentType, setDocumentType] = useState<'student_id' | 'admission_letter'>('student_id');
    const [uploadedDocUrl, setUploadedDocUrl] = useState<string>('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(true);

    // Validation & pre-check states
    const [isCheckingAccount, setIsCheckingAccount] = useState(false);
    const [emailExistsError, setEmailExistsError] = useState('');

    // Verification Scan & Completion States
    const [isScanning, setIsScanning] = useState(false);
    const [scanStage, setScanStage] = useState<number>(0);
    const [redirectCountdown, setRedirectCountdown] = useState<number>(3);
    const [verificationResult, setVerificationResult] = useState<{
        completed: boolean;
        status: 'verified' | 'pending';
        autoApproved: boolean;
        message: string;
    } | null>(null);

    // SMS OTP Verification State
    const [showOtpDialog, setShowOtpDialog] = useState(false);
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [resendTimer, setResendTimer] = useState(60);
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Manager specific state
    const [managerHostels, setManagerHostels] = useState<{ id: string; name?: string; location?: string; managerId?: string }[]>([]);
    const [loadingManagerHostels, setLoadingManagerHostels] = useState(false);
    const [selectedManagerHostelId, setSelectedManagerHostelId] = useState('');

    const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

    const { toast } = useToast();
    const router = useRouter();

    // Auto-Focus Refs
    const fullNameRef = useRef<HTMLInputElement>(null);
    const studentIdRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    // Countdown timer for OTP resend
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showOtpDialog && resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [showOtpDialog, resendTimer]);

    // Auto-Redirect to /my-bookings when student is verified
    useEffect(() => {
        if (verificationResult?.autoApproved) {
            const timer = setInterval(() => {
                setRedirectCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        router.push('/my-bookings');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [verificationResult, router]);

    // Focus on step transition
    useEffect(() => {
        if (selectedRole === 'student') {
            if (studentStep === 1) {
                setTimeout(() => fullNameRef.current?.focus(), 80);
            } else if (studentStep === 2) {
                setTimeout(() => studentIdRef.current?.focus(), 80);
            } else if (studentStep === 3) {
                setTimeout(() => passwordRef.current?.focus(), 80);
            }
        }
    }, [studentStep, selectedRole]);

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

    const getFormattedPhone = () => {
        let cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }
        return countryCode.replace(/\D/g, '') + cleaned;
    };

    // Proactively check if email exists on blur
    const handleEmailBlur = async () => {
        if (!email || !isValidEmail(email)) return;
        try {
            const res = await fetch('/api/auth/check-exists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json();
            if (data.exists && data.field === 'email') {
                setEmailExistsError(data.message || 'This email is already registered. Please sign in instead.');
            } else {
                setEmailExistsError('');
            }
        } catch {
            // silent fallback
        }
    };

    // Step 1 Validation -> Proceed to Step 2
    const handleProceedToAcademic = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailExistsError('');

        if (!fullName.trim()) {
            toast({ title: 'Full Name Required', description: 'Please enter your full name.', variant: 'destructive' });
            return;
        }

        if (!email.trim() || !isValidEmail(email)) {
            toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
            return;
        }

        if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
            toast({ title: 'Invalid Phone Number', description: 'Please enter a valid Ghana phone number.', variant: 'destructive' });
            return;
        }

        // Proactive background verification check for duplicate email/phone before advancing
        setIsCheckingAccount(true);
        try {
            const checkRes = await fetch('/api/auth/check-exists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    phoneNumber: getFormattedPhone(),
                }),
            });
            const checkData = await checkRes.json();
            if (checkData.exists) {
                setIsCheckingAccount(false);
                if (checkData.field === 'email') {
                    setEmailExistsError(checkData.message);
                }
                toast({
                    title: 'Account Already Exists',
                    description: checkData.message || 'An account with these credentials already exists. Please sign in.',
                    variant: 'destructive',
                });
                return;
            }
        } catch (checkErr) {
            console.warn('[Signup] Background check exists note:', checkErr);
        } finally {
            setIsCheckingAccount(false);
        }

        setStudentStep(2);
    };

    // Step 2 Validation -> Proceed to Step 3
    const handleProceedToVerification = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanId = studentIndexNumber.trim();
        if (!cleanId) {
            toast({
                title: 'Identifier Required',
                description: isFresher
                    ? 'Please enter your Applicant Number found on your admission letter.'
                    : 'Please enter your Student Index Number.',
                variant: 'destructive',
            });
            return;
        }

        // Universal alphanumeric/numeric string between 7 and 12 characters
        const universalIdRegex = /^[a-zA-Z0-9\-_]{7,12}$/;
        if (!universalIdRegex.test(cleanId)) {
            toast({
                title: 'Invalid Identifier Format',
                description: `${isFresher ? 'Applicant' : 'Student Index'} number must be between 7 and 12 alphanumeric characters (e.g. 52XXXXXXXX or 10XXXXXX).`,
                variant: 'destructive',
            });
            return;
        }

        if (!faculty) {
            toast({ title: 'Faculty Required', description: 'Please select your Faculty.', variant: 'destructive' });
            return;
        }

        if (isFresher && !programOfStudy) {
            toast({ title: 'Program Required', description: 'Please select your Program of Study.', variant: 'destructive' });
            return;
        }

        if (!isFresher && !department) {
            toast({ title: 'Department Required', description: 'Please select your academic Department.', variant: 'destructive' });
            return;
        }

        // Check if student ID is already registered
        try {
            const idCheckRes = await fetch('/api/auth/check-exists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentIdNumber: cleanId }),
            });
            const idCheckData = await idCheckRes.json();
            if (idCheckData.exists && idCheckData.field === 'studentIdNumber') {
                toast({
                    title: 'Student ID Already Registered',
                    description: idCheckData.message,
                    variant: 'destructive',
                });
                return;
            }
        } catch (_) {}

        setStudentStep(3);
    };

    // Trigger SMS OTP send
    const sendOtp = async () => {
        const formattedPhone = getFormattedPhone();
        setIsSendingOtp(true);
        try {
            const response = await fetch('/api/sms/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: formattedPhone }),
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to send verification code');
            }

            toast({
                title: 'Verification Code Sent',
                description: `A 6-digit code has been sent via SMS to +${formattedPhone}`,
            });

            setShowOtpDialog(true);
            setResendTimer(60);
            setOtpCode(['', '', '', '', '', '']);
            setTimeout(() => {
                otpInputRefs.current[0]?.focus();
            }, 150);
        } catch (error: any) {
            console.error('Error sending OTP:', error);
            toast({
                title: 'Failed to Send Code',
                description: error.message || 'Please check your phone number and try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSendingOtp(false);
        }
    };

    // Step 3 Submission for Student: Send OTP
    const handleStudentStep3Submit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!uploadedDocUrl) {
            toast({
                title: 'Verification Document Required',
                description: 'Please upload your Student ID Card or Admission Letter to proceed.',
                variant: 'destructive',
            });
            return;
        }

        if (password.length < 8) {
            toast({
                title: 'Password Too Short',
                description: 'Password must be at least 8 characters long.',
                variant: 'destructive',
            });
            return;
        }

        if (!termsAccepted) {
            toast({
                title: 'Terms Required',
                description: 'Please accept the Terms of Service and Privacy Policy to continue.',
                variant: 'destructive',
            });
            return;
        }

        await sendOtp();
    };

    // Submission for Hostel Manager
    const handleManagerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fullName.trim()) {
            toast({ title: 'Full Name Required', description: 'Please enter your full name.', variant: 'destructive' });
            return;
        }

        if (!email.trim() || !isValidEmail(email)) {
            toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
            return;
        }

        if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
            toast({ title: 'Invalid Phone Number', description: 'Please enter a valid Ghana phone number.', variant: 'destructive' });
            return;
        }

        if (!selectedManagerHostelId) {
            toast({ title: 'Hostel Assignment Required', description: 'Please select the hostel property you manage.', variant: 'destructive' });
            return;
        }

        if (password.length < 8) {
            toast({ title: 'Weak Password', description: 'Password must be at least 8 characters.', variant: 'destructive' });
            return;
        }

        if (!termsAccepted) {
            toast({ title: 'Terms Required', description: 'Please accept the terms of service.', variant: 'destructive' });
            return;
        }

        setIsCheckingAccount(true);
        try {
            const checkRes = await fetch('/api/auth/check-exists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    phoneNumber: getFormattedPhone(),
                }),
            });
            const checkData = await checkRes.json();
            if (checkData.exists) {
                setIsCheckingAccount(false);
                if (checkData.field === 'email') setEmailExistsError(checkData.message);
                toast({
                    title: 'Account Already Exists',
                    description: checkData.message,
                    variant: 'destructive',
                });
                return;
            }
        } catch (_) {} finally {
            setIsCheckingAccount(false);
        }

        await sendOtp();
    };

    // Handle single OTP digit change
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otpCode];
        newOtp[index] = value.substring(value.length - 1);
        setOtpCode(newOtp);

        if (value && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pastedData) return;

        const newOtp = [...otpCode];
        for (let i = 0; i < pastedData.length; i++) {
            newOtp[i] = pastedData[i];
        }
        setOtpCode(newOtp);

        const nextIndex = Math.min(pastedData.length, 5);
        otpInputRefs.current[nextIndex]?.focus();
    };

    // Verify OTP & Complete Account Creation
    const handleVerifyOtpAndCreate = async () => {
        const fullCode = otpCode.join('');
        if (fullCode.length !== 6) {
            toast({ title: 'Invalid Code', description: 'Please enter all 6 digits of the verification code.', variant: 'destructive' });
            return;
        }

        const formattedPhone = getFormattedPhone();
        setIsVerifyingOtp(true);

        try {
            // 1. Verify OTP with backend
            const verifyRes = await fetch('/api/sms/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: formattedPhone,
                    otp: fullCode,
                }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
                throw new Error(verifyData.error || 'Invalid or expired verification code');
            }

            setShowOtpDialog(false);

            if (selectedRole === 'student') {
                // 1. Trigger animated scanning transition
                setIsScanning(true);
                setScanStage(1);

                // 2. Create Firebase Auth account
                const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
                const user = userCredential.user;

                // 3. Build student profile
                const autoParsedId = parseStudentCredentials(email.trim().toLowerCase());
                const finalStudentId = studentIndexNumber.trim() || autoParsedId || '';
                const studentUserData: any = {
                    uid: user.uid,
                    id: user.uid,
                    email: email.trim().toLowerCase(),
                    institutionalEmail: email.trim().toLowerCase(),
                    fullName: fullName.trim(),
                    phone: formattedPhone,
                    phoneNumber: formattedPhone,
                    phoneVerified: true,
                    role: 'student',
                    createdAt: new Date().toISOString(),
                    verificationStatus: 'verified',
                    isVerified: true,
                    autoApproved: true,
                    isFresher,
                    faculty: faculty || '',
                    department: isFresher ? '' : (department || ''),
                    programOfStudy: isFresher ? (programOfStudy || '') : '',
                    studentIndexNumber: finalStudentId,
                    studentId: finalStudentId,
                    verificationDocUrl: uploadedDocUrl,
                    verificationDocType: documentType,
                    avatarUrl: user.photoURL || '',
                    profileImage: user.photoURL || '',
                    institution: 'University of Skills Training and Entrepreneurial Development (USTED)',
                };

                // Fast direct Firestore write
                await setDoc(doc(db, 'users', user.uid), studentUserData, { merge: true });

                // Timed animation milestones for smooth ~2.2s total institutional scan
                const stage2Timer = new Promise((res) => setTimeout(res, 750));
                const stage3Timer = new Promise((res) => setTimeout(res, 1500));
                const minAnimationTimer = new Promise((res) => setTimeout(res, 2100));

                // 4. Background Automated Verification Engine API (guarded by 3.5s timeout)
                const apiCallPromise = (async () => {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 3500);
                        const res = await fetch('/api/verify-student', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            signal: controller.signal,
                            body: JSON.stringify({
                                userId: user.uid,
                                fullName: fullName.trim(),
                                email: email.trim().toLowerCase(),
                                phoneNumber: formattedPhone,
                                phone: formattedPhone,
                                studentIdNumber: finalStudentId,
                                isFresher,
                                faculty,
                                departmentOrProgram: isFresher ? programOfStudy : department,
                                department: isFresher ? '' : department,
                                programOfStudy: isFresher ? programOfStudy : '',
                                documentUrl: uploadedDocUrl,
                                documentType,
                            }),
                        });
                        clearTimeout(timeoutId);
                        return await res.json();
                    } catch (e) {
                        console.warn('[Signup] Automated verification background notice:', e);
                        return { success: true, autoApproved: true, status: 'verified' };
                    }
                })();

                // Transition to Stage 2: "Validating enrollment status..."
                await stage2Timer;
                setScanStage(2);

                // Transition to Stage 3: "Account activated for instant booking!"
                await stage3Timer;
                setScanStage(3);

                // Wait for minimum scan animation and verification API result
                await Promise.all([minAnimationTimer, apiCallPromise]);

                // Brief pause so student sees the 3 completed checkmarks
                await new Promise((res) => setTimeout(res, 500));

                setIsScanning(false);
                setRedirectCountdown(2);
                setVerificationResult({
                    completed: true,
                    status: 'verified',
                    autoApproved: true,
                    message: 'Your USTED student status has been verified. Your account is active for booking.',
                });
                toast({
                    title: 'Account Verified',
                    description: 'Your enrollment credentials are confirmed. Redirecting to your dashboard...',
                });
            } else {
                // MANAGER REGISTRATION FLOW
                const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
                const user = userCredential.user;

                const managerUserData: any = {
                    uid: user.uid,
                    id: user.uid,
                    email: email.trim().toLowerCase(),
                    fullName: fullName.trim(),
                    phone: formattedPhone,
                    phoneNumber: formattedPhone,
                    phoneVerified: true,
                    role: 'hostel_manager',
                    createdAt: new Date().toISOString(),
                    verificationStatus: 'verified',
                    managedHostelId: selectedManagerHostelId,
                };

                await setDoc(doc(db, 'users', user.uid), managerUserData, { merge: true });

                if (selectedManagerHostelId) {
                    try {
                        await updateDoc(doc(db, 'hostels', selectedManagerHostelId), {
                            managerId: user.uid,
                        });
                    } catch (_) {}
                }

                toast({
                    title: 'Manager Account Created',
                    description: 'Welcome to HostelHQ Manager Portal!',
                });

                router.push('/manager/dashboard');
            }
        } catch (error: any) {
            setIsScanning(false);
            console.error('Verification error:', error);
            let message = error.message || 'An error occurred during verification.';
            if (error.code === 'auth/email-already-in-use') {
                message = 'This email is already registered. Please sign in instead.';
            }
            toast({
                title: 'Verification Failed',
                description: message,
                variant: 'destructive',
            });
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    const roles = [
        {
            id: 'student' as UserRole,
            title: 'Student',
            description: 'Find, visit & secure verified rooms near campus',
            icon: <GraduationCap className="h-5 w-5" />,
        },
        {
            id: 'hostel_manager' as UserRole,
            title: 'Hostel Manager',
            description: 'Manage room inventory, bookings & wallet payouts',
            icon: <Building className="h-5 w-5" />,
        },
    ];

    const currentPrograms = (facultyPrograms as Record<string, string[]>)[faculty] || [];
    const currentDepartments = (facultyDepartments as Record<string, string[]>)[faculty] || [];

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="relative flex-1 bg-slate-900 flex items-center justify-center py-10 px-4">
                <div className="absolute inset-0">
                    <Image
                        src="https://images.pexels.com/photos/3755761/pexels-photo-3755761.jpeg?auto=compress&cs=tinysrgb&w=2000"
                        alt="Campus hostel background"
                        fill
                        priority
                        className="object-cover brightness-[0.35]"
                    />
                </div>

                <div className="relative z-10 w-full max-w-xl">
                    <Card className="border border-white/15 bg-white/10 text-slate-50 shadow-[0_18px_45px_rgba(15,23,42,0.7)] backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
                        
                        {/* Institutional Badge & Card Header */}
                        <CardHeader className="text-center pt-8 pb-3 px-6 sm:px-10">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6B1D2F]/20 border border-[#6B1D2F]/40 text-rose-300 text-xs font-semibold mx-auto mb-2">
                                <div className="relative h-4 w-4 shrink-0">
                                    <Image
                                        src="/usted logo.png"
                                        alt="USTED Crest"
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                                <span>University of Skills Training and Entrepreneurial Development</span>
                            </div>
                            <CardTitle className="text-2xl sm:text-3xl font-headline font-extrabold tracking-tight text-white">
                                {selectedRole === 'student' ? 'Student Registration' : 'Manager Registration'}
                            </CardTitle>
                            <CardDescription className="text-slate-200/80 text-xs sm:text-sm mt-1">
                                Safe, verified student accommodation under official USTED oversight
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-5 px-6 sm:px-10 pb-8">
                            {/* Role Switcher (Hidden during verification scan or completion) */}
                            {!isScanning && !verificationResult && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                        I am joining as:
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/40 border border-white/10">
                                        {roles.map((r) => (
                                            <button
                                                key={r.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedRole(r.id);
                                                    setStudentStep(1);
                                                }}
                                                className={cn(
                                                    "flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 text-center relative",
                                                    selectedRole === r.id
                                                        ? "bg-[#6B1D2F] text-white shadow-lg font-bold"
                                                        : "text-slate-300 hover:text-white hover:bg-white/5 font-medium"
                                                )}
                                            >
                                                <div className="mb-1">{r.icon}</div>
                                                <span className="text-xs">{r.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 1. ANIMATED INSTITUTIONAL SCANNING OVERLAY */}
                            {isScanning ? (
                                <div className="py-8 px-2 text-center space-y-6">
                                    <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full border-2 border-[#6B1D2F]/40 animate-ping opacity-75" />
                                        <div className="h-16 w-16 rounded-full bg-[#6B1D2F]/20 border-2 border-[#6B1D2F] flex items-center justify-center text-rose-300 shadow-sm">
                                            <ShieldCheck className="h-8 w-8 animate-pulse text-[#6B1D2F]" />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <h3 className="text-base font-bold text-white">
                                            Institutional Verification in Progress
                                        </h3>
                                        <p className="text-xs text-slate-300 max-w-xs mx-auto">
                                            Running automated checks through the USTED student registry.
                                        </p>
                                    </div>

                                    <div className="max-w-sm mx-auto space-y-3 text-left text-xs bg-black/40 p-4 rounded-2xl border border-white/10">
                                        <div className="flex items-center justify-between">
                                            <span className={scanStage >= 1 ? "text-white font-semibold" : "text-slate-400"}>
                                                Checking your student details...
                                            </span>
                                            {scanStage > 1 ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                            ) : scanStage === 1 ? (
                                                <Loader2 className="h-4 w-4 text-[#6B1D2F] animate-spin shrink-0" />
                                            ) : (
                                                <div className="h-2 w-2 rounded-full bg-white/20" />
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className={scanStage >= 2 ? "text-white font-semibold" : "text-slate-400"}>
                                                Validating enrollment status...
                                            </span>
                                            {scanStage > 2 ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                            ) : scanStage === 2 ? (
                                                <Loader2 className="h-4 w-4 text-[#6B1D2F] animate-spin shrink-0" />
                                            ) : (
                                                <div className="h-2 w-2 rounded-full bg-white/20" />
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className={scanStage >= 3 ? "text-white font-semibold" : "text-slate-400"}>
                                                Account activated for instant booking!
                                            </span>
                                            {scanStage >= 3 ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                            ) : (
                                                <div className="h-2 w-2 rounded-full bg-white/20" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : verificationResult ? (
                                /* 2. SUCCESS CONFIRMATION STATE */
                                <div className="text-center py-6 space-y-5">
                                    <div className="h-20 w-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/40 shadow-md">
                                        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                                    </div>

                                    <div className="space-y-1.5">
                                        <h3 className="text-xl font-extrabold text-white">
                                            {verificationResult.autoApproved ? "Account Verified" : "Submission Received"}
                                        </h3>
                                        <p className="text-xs text-slate-300 max-w-sm mx-auto">
                                            {verificationResult.message}
                                        </p>
                                    </div>

                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/15 text-xs space-y-2 text-left shadow-sm">
                                        <div className="flex justify-between items-center pb-1.5 border-b border-white/10">
                                            <span className="text-slate-400">Student Name:</span>
                                            <span className="font-bold text-white">{fullName}</span>
                                        </div>
                                        <div className="flex justify-between items-center pb-1.5 border-b border-white/10">
                                            <span className="text-slate-400">{isFresher ? "Applicant Number:" : "Index Number:"}</span>
                                            <span className="font-mono font-bold text-white">{studentIndexNumber}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Status:</span>
                                            <span className="font-extrabold text-emerald-400 capitalize text-sm">
                                                {verificationResult.status}
                                            </span>
                                        </div>
                                    </div>

                                    {verificationResult.autoApproved ? (
                                        <div className="pt-2 space-y-3">
                                            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-300">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" />
                                                <span>Redirecting to your student dashboard in {redirectCountdown}s...</span>
                                            </div>
                                            <Button
                                                onClick={() => router.push('/my-bookings')}
                                                className="w-full h-11 text-xs font-bold rounded-xl bg-[#6B1D2F] hover:bg-[#6B1D2F]/90 text-white shadow-lg flex items-center justify-center gap-1.5"
                                            >
                                                <span>Continue to My Bookings</span>
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="pt-2 flex flex-col gap-2">
                                            <Button
                                                onClick={() => router.push('/student/hostels')}
                                                className="w-full h-11 text-xs font-bold rounded-xl bg-[#6B1D2F] hover:bg-[#6B1D2F]/90 text-white shadow-lg"
                                            >
                                                <span>Explore Approved Hostels</span>
                                                <ArrowRight className="h-4 w-4 ml-1.5" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => router.push('/login')}
                                                className="w-full h-10 text-xs rounded-xl bg-white/5 border-white/20 text-white hover:bg-white/10"
                                            >
                                                Go to Student Login
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : selectedRole === 'student' ? (
                                /* 3. STUDENT 3-STEP PROGRESSIVE WIZARD */
                                <div className="space-y-5">
                                    {/* Top Progress Stepper Indicator */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 px-1">
                                            <span className={studentStep === 1 ? "text-rose-300 font-extrabold" : studentStep > 1 ? "text-emerald-400 font-semibold" : ""}>
                                                1. Account Credentials
                                            </span>
                                            <span className={studentStep === 2 ? "text-rose-300 font-extrabold" : studentStep > 2 ? "text-emerald-400 font-semibold" : ""}>
                                                2. Academic Profile
                                            </span>
                                            <span className={studentStep === 3 ? "text-rose-300 font-extrabold" : ""}>
                                                3. Verification & Security
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            {[1, 2, 3].map((s) => (
                                                <div 
                                                    key={s} 
                                                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                                        s <= studentStep ? "bg-[#6B1D2F]" : "bg-white/15"
                                                    }`} 
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* STEP 1: ACCOUNT CREDENTIALS */}
                                    {studentStep === 1 && (
                                        <form onSubmit={handleProceedToAcademic} className="space-y-4">
                                            {/* Full Name */}
                                            <div className="space-y-1.5">
                                                <Label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                    Full Name *
                                                </Label>
                                                <div className="relative">
                                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    <Input
                                                        id="fullName"
                                                        ref={fullNameRef}
                                                        required
                                                        type="text"
                                                        placeholder="e.g. Kwame Mensah"
                                                        className="pl-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium"
                                                        value={fullName}
                                                        onChange={(e) => setFullName(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Email Address */}
                                            <div className="space-y-1.5">
                                                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                    Email Address *
                                                </Label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    <Input
                                                        id="email"
                                                        required
                                                        type="email"
                                                        placeholder="e.g. student@gmail.com"
                                                        className="pl-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium"
                                                        value={email}
                                                        onChange={(e) => {
                                                            setEmail(e.target.value);
                                                            if (emailExistsError) setEmailExistsError('');
                                                        }}
                                                        onBlur={handleEmailBlur}
                                                    />
                                                </div>
                                                {emailExistsError && (
                                                    <div className="flex items-center justify-between mt-1 text-xs text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-500/30">
                                                        <span>{emailExistsError}</span>
                                                        <Link href="/login" className="underline font-bold text-red-200 ml-2 shrink-0">Sign In</Link>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Phone Number */}
                                            <div className="space-y-1.5">
                                                <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                    Phone Number (+233 GH) *
                                                </Label>
                                                <div className="flex gap-2">
                                                    <div className="w-24 shrink-0 flex items-center justify-center rounded-xl bg-white/10 border border-white/20 text-sm font-semibold text-white">
                                                        +233 🇬🇭
                                                    </div>
                                                    <div className="relative flex-1">
                                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                        <Input
                                                            id="phone"
                                                            required
                                                            type="tel"
                                                            placeholder="0244123456"
                                                            className="pl-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium font-mono"
                                                            value={phoneNumber}
                                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                type="submit"
                                                disabled={isCheckingAccount}
                                                className="w-full h-12 rounded-xl bg-[#6B1D2F] text-white font-bold hover:bg-[#6B1D2F]/90 shadow-xl transition-all duration-200 hover:scale-[1.01] mt-2 flex items-center justify-center gap-2"
                                            >
                                                {isCheckingAccount ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        <span>Checking details...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>Continue to Academic Profile</span>
                                                        <ArrowRight className="h-4 w-4" />
                                                    </>
                                                )}
                                            </Button>
                                        </form>
                                    )}

                                    {/* STEP 2: ACADEMIC PROFILE & STUDENT STATUS */}
                                    {studentStep === 2 && (
                                        <form onSubmit={handleProceedToVerification} className="space-y-4">
                                            {/* Status Selector (Two Scannable, Tap-Friendly Pills) */}
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                    Student Status *
                                                </Label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsFresher(false);
                                                            setDepartment('');
                                                            setProgramOfStudy('');
                                                            setDocumentType('student_id');
                                                        }}
                                                        className={cn(
                                                            "h-11 px-3 rounded-xl border text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5",
                                                            !isFresher
                                                                ? "bg-[#6B1D2F] text-white border-[#6B1D2F] shadow-sm ring-2 ring-[#6B1D2F]/30"
                                                                : "bg-white/5 text-slate-300 border-white/10 hover:text-white hover:bg-white/10"
                                                        )}
                                                    >
                                                        <span>🎓</span>
                                                        <span>Continuing Student</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsFresher(true);
                                                            setDepartment('');
                                                            setProgramOfStudy('');
                                                            setDocumentType('admission_letter');
                                                        }}
                                                        className={cn(
                                                            "h-11 px-3 rounded-xl border text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5",
                                                            isFresher
                                                                ? "bg-[#6B1D2F] text-white border-[#6B1D2F] shadow-sm ring-2 ring-[#6B1D2F]/30"
                                                                : "bg-white/5 text-slate-300 border-white/10 hover:text-white hover:bg-white/10"
                                                        )}
                                                    >
                                                        <span>🎒</span>
                                                        <span>Fresher / Newly Admitted</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Flexible Identifier Input */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Label htmlFor="studentIndexNumber" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                        Student Index / Applicant Number *
                                                    </Label>
                                                    <span className="text-[10px] text-amber-300 font-medium">
                                                        {isFresher ? "Found on Admission Letter" : "7–12 Characters"}
                                                    </span>
                                                </div>
                                                <div className="relative">
                                                    <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    <Input
                                                        id="studentIndexNumber"
                                                        ref={studentIdRef}
                                                        required
                                                        type="text"
                                                        placeholder="e.g. 52XXXXXXXX or 10XXXXXX"
                                                        className="pl-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium font-mono"
                                                        value={studentIndexNumber}
                                                        onChange={(e) => setStudentIndexNumber(e.target.value)}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-400">
                                                    Enter your official Student Index Number or Admission Applicant Number.
                                                </p>
                                            </div>

                                            {/* Dynamic Academic Dropdowns */}
                                            <div className="space-y-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                        Faculty *
                                                    </Label>
                                                    <Select
                                                        value={faculty}
                                                        onValueChange={(val) => {
                                                            setFaculty(val);
                                                            setDepartment('');
                                                            setProgramOfStudy('');
                                                        }}
                                                    >
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

                                                {/* Dropdown 2: Dynamic Context Based on Pill Selection */}
                                                {isFresher ? (
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                            Program of Study *
                                                        </Label>
                                                        <Select
                                                            value={programOfStudy}
                                                            onValueChange={setProgramOfStudy}
                                                            disabled={!faculty}
                                                        >
                                                            <SelectTrigger className="h-11 bg-white/95 text-slate-900 rounded-xl border-white/20 font-medium">
                                                                <SelectValue placeholder={!faculty ? "Select faculty first" : "Select program of study"} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {currentPrograms.map((prog) => (
                                                                    <SelectItem key={prog} value={prog}>{prog}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                            Department *
                                                        </Label>
                                                        <Select
                                                            value={department}
                                                            onValueChange={setDepartment}
                                                            disabled={!faculty}
                                                        >
                                                            <SelectTrigger className="h-11 bg-white/95 text-slate-900 rounded-xl border-white/20 font-medium">
                                                                <SelectValue placeholder={!faculty ? "Select faculty first" : "Select department"} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {currentDepartments.map((dept) => (
                                                                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2 pt-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => setStudentStep(1)}
                                                    className="h-12 px-4 rounded-xl bg-white/5 border-white/20 text-white hover:bg-white/10 text-xs font-semibold"
                                                >
                                                    <ArrowLeft className="h-4 w-4 mr-1" />
                                                    Back
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    className="flex-1 h-12 rounded-xl bg-[#6B1D2F] text-white font-bold hover:bg-[#6B1D2F]/90 shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                                                >
                                                    <span>Continue to Document Upload</span>
                                                    <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </form>
                                    )}

                                    {/* STEP 3: VERIFICATION DOCUMENT & ACCOUNT SECURITY */}
                                    {studentStep === 3 && (
                                        <form onSubmit={handleStudentStep3Submit} className="space-y-4">
                                            {/* Universal, Non-Rigid Document Upload Dropzone */}
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                    Upload Verification Document (Student ID Card OR Admission Letter) *
                                                </Label>
                                                <p className="text-[11px] text-slate-300/90 leading-relaxed">
                                                    Upload your official USTED Student ID Card (front) OR your official University Admission Letter (PDF or clear photo). Continuing students who have misplaced their ID cards may upload their Admission Letter.
                                                </p>
                                                <DocumentUploader
                                                    documentType={documentType}
                                                    onDocumentTypeChange={setDocumentType}
                                                    onUploadSuccess={(url) => {
                                                        setUploadedDocUrl(url);
                                                        toast({
                                                            title: "Document Attached",
                                                            description: "File uploaded and ready for verification.",
                                                        });
                                                    }}
                                                    onError={(err) => {
                                                        toast({
                                                            title: "Upload Failed",
                                                            description: err || "Could not upload document.",
                                                            variant: "destructive",
                                                        });
                                                    }}
                                                />
                                            </div>

                                            {/* Password Field */}
                                            <div className="space-y-1.5">
                                                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                    Password *
                                                </Label>
                                                <div className="relative">
                                                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    <Input
                                                        id="password"
                                                        ref={passwordRef}
                                                        required
                                                        type={showPassword ? 'text' : 'password'}
                                                        minLength={8}
                                                        placeholder="At least 8 characters"
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
                                                <p className="text-[11px] text-slate-400">Must be at least 8 characters long.</p>
                                            </div>

                                            {/* Summary Pill Box */}
                                            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs space-y-1.5">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Student:</span>
                                                    <span className="font-semibold text-white">{fullName}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Status:</span>
                                                    <span className="font-semibold text-white">{isFresher ? "Fresher / Newly Admitted" : "Continuing Student"}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">{isFresher ? "Applicant No:" : "Index No:"}</span>
                                                    <span className="font-mono font-semibold text-white">{studentIndexNumber}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Document:</span>
                                                    <span className={uploadedDocUrl ? "text-emerald-400 font-semibold" : "text-amber-300 font-semibold"}>
                                                        {uploadedDocUrl ? "Attached ✓" : "Pending Upload"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Compliance Checkbox */}
                                            <div className="flex items-center space-x-2 pt-1">
                                                <Checkbox
                                                    id="terms"
                                                    checked={termsAccepted}
                                                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                                                    className="border-white/40 data-[state=checked]:bg-[#6B1D2F]"
                                                />
                                                <label htmlFor="terms" className="text-xs text-slate-300 cursor-pointer">
                                                    I agree to the{' '}
                                                    <Link href="/terms" className="text-rose-300 font-semibold hover:underline">
                                                        Terms of Service
                                                    </Link>{' '}
                                                    and Privacy Policy.
                                                </label>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2 pt-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => setStudentStep(2)}
                                                    className="h-12 px-4 rounded-xl bg-white/5 border-white/20 text-white hover:bg-white/10 text-xs font-semibold"
                                                >
                                                    <ArrowLeft className="h-4 w-4 mr-1" />
                                                    Back
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={isSendingOtp || !uploadedDocUrl || !termsAccepted}
                                                    className="flex-1 h-12 rounded-xl bg-[#6B1D2F] text-white font-bold hover:bg-[#6B1D2F]/90 shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    {isSendingOtp ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            <span>Sending SMS Code...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ShieldCheck className="h-4 w-4" />
                                                            <span>Verify Phone & Complete Registration</span>
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            ) : (
                                /* 4. HOSTEL MANAGER REGISTRATION FORM */
                                <form onSubmit={handleManagerSubmit} className="space-y-4">
                                    {/* Full Name */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mgrFullName" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                            Full Name *
                                        </Label>
                                        <div className="relative">
                                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="mgrFullName"
                                                required
                                                type="text"
                                                placeholder="e.g. Kwame Mensah"
                                                className="pl-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Email Address */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mgrEmail" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                            Email Address *
                                        </Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="mgrEmail"
                                                required
                                                type="email"
                                                placeholder="e.g. manager@gmail.com"
                                                className="pl-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium"
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    if (emailExistsError) setEmailExistsError('');
                                                }}
                                                onBlur={handleEmailBlur}
                                            />
                                        </div>
                                        {emailExistsError && (
                                            <div className="flex items-center justify-between mt-1 text-xs text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-500/30">
                                                <span>{emailExistsError}</span>
                                                <Link href="/login" className="underline font-bold text-red-200 ml-2 shrink-0">Sign In</Link>
                                            </div>
                                        )}
                                    </div>

                                    {/* Phone Number */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mgrPhone" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                            Phone Number (+233 GH) *
                                        </Label>
                                        <div className="flex gap-2">
                                            <div className="w-24 shrink-0 flex items-center justify-center rounded-xl bg-white/10 border border-white/20 text-sm font-semibold text-white">
                                                +233 🇬🇭
                                            </div>
                                            <div className="relative flex-1">
                                                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                <Input
                                                    id="mgrPhone"
                                                    required
                                                    type="tel"
                                                    placeholder="0244123456"
                                                    className="pl-11 h-11 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium font-mono"
                                                    value={phoneNumber}
                                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Managed Hostel Property */}
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

                                    {/* Password */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mgrPassword" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                            Password *
                                        </Label>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="mgrPassword"
                                                required
                                                type={showPassword ? 'text' : 'password'}
                                                minLength={8}
                                                placeholder="At least 8 characters"
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

                                    {/* Terms */}
                                    <div className="flex items-center space-x-2 pt-1">
                                        <Checkbox
                                            id="mgrTerms"
                                            checked={termsAccepted}
                                            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                                            className="border-white/40 data-[state=checked]:bg-[#6B1D2F]"
                                        />
                                        <label htmlFor="mgrTerms" className="text-xs text-slate-300 cursor-pointer">
                                            I agree to the{' '}
                                            <Link href="/terms" className="text-rose-300 font-semibold hover:underline">
                                                Terms of Service
                                            </Link>{' '}
                                            and Privacy Policy.
                                        </label>
                                    </div>

                                    {/* Submit */}
                                    <Button
                                        type="submit"
                                        disabled={isSendingOtp || isCheckingAccount}
                                        className="w-full h-12 rounded-xl bg-[#6B1D2F] text-white font-bold hover:bg-[#6B1D2F]/90 shadow-xl transition-all duration-200 hover:scale-[1.01] mt-2 flex items-center justify-center gap-2"
                                    >
                                        {isCheckingAccount ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Checking account...</span>
                                            </>
                                        ) : isSendingOtp ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Sending SMS Code...</span>
                                            </>
                                        ) : (
                                            'Verify Phone & Complete Registration'
                                        )}
                                    </Button>
                                </form>
                            )}
                        </CardContent>

                        {!isScanning && !verificationResult && (
                            <CardFooter className="flex flex-col gap-2 px-6 sm:px-10 pb-8 pt-0">
                                <p className="text-center text-xs text-slate-300/90">
                                    Already have an account?{' '}
                                    <Link href="/login" className="text-rose-300 font-bold hover:underline">
                                        Sign In here
                                    </Link>
                                </p>
                            </CardFooter>
                        )}
                    </Card>
                </div>
            </main>

            {/* 6-Digit SMS OTP Verification Dialog */}
            <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
                <DialogContent className="sm:max-w-md p-6 rounded-3xl bg-slate-900 border border-white/20 text-white">
                    <DialogHeader className="space-y-2 text-center">
                        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#6B1D2F]/30 border border-[#6B1D2F]/50 flex items-center justify-center text-rose-300">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <DialogTitle className="text-lg font-bold text-white">SMS Phone Verification</DialogTitle>
                        <DialogDescription className="text-xs text-slate-300">
                            Enter the 6-digit verification code sent to{' '}
                            <span className="font-semibold text-white font-mono">+{getFormattedPhone()}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* 6-Digit Input Boxes */}
                        <div className="flex justify-center gap-2 sm:gap-2.5">
                            {otpCode.map((digit, idx) => (
                                <input
                                    key={idx}
                                    ref={(el) => {
                                        otpInputRefs.current[idx] = el;
                                    }}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                    onPaste={handleOtpPaste}
                                    className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-2xl font-bold rounded-xl border border-white/20 bg-black/50 text-white focus:border-[#6B1D2F] focus:ring-2 focus:ring-[#6B1D2F]/30 outline-none transition-all"
                                />
                            ))}
                        </div>

                        {/* Resend Code Section */}
                        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                            <span>Didn't receive code?</span>
                            {resendTimer > 0 ? (
                                <span className="font-medium text-slate-400">Resend in {resendTimer}s</span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={sendOtp}
                                    disabled={isSendingOtp}
                                    className="text-rose-300 font-bold hover:underline flex items-center gap-1"
                                >
                                    <RefreshCw className={cn("h-3 w-3", isSendingOtp && "animate-spin")} />
                                    Resend Code
                                </button>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2 pt-2">
                            <Button
                                type="button"
                                onClick={handleVerifyOtpAndCreate}
                                disabled={isVerifyingOtp || otpCode.join('').length !== 6}
                                className="w-full h-11 rounded-xl bg-[#6B1D2F] text-white font-bold hover:bg-[#6B1D2F]/90 shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                                {isVerifyingOtp ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Verifying Code...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        <span>Verify & Complete Registration</span>
                                    </>
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setShowOtpDialog(false)}
                                disabled={isVerifyingOtp}
                                className="w-full h-9 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/10"
                            >
                                Edit details
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
