"use client";

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, Mail, Fingerprint, Lock, Phone, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where, setDoc } from 'firebase/firestore';
import { isPlatformAuthenticatorAvailable, verifyBiometric } from '@/lib/webauthn';
import { cn } from '@/lib/utils';
import { AppLoader } from '@/components/ui/app-loader';

function LoginPageInner() {
    const [loginMethod, setLoginMethod] = useState<'password' | 'phone_otp'>('password');
    const [identifier, setIdentifier] = useState(''); // email or phone for password login
    const [password, setPassword] = useState('');
    const [otpPhone, setOtpPhone] = useState('');
    const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [resendTimer, setResendTimer] = useState(60);
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricLoading, setBiometricLoading] = useState(false);
    
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectParam = searchParams.get('redirect');
    const safeRedirect = redirectParam && redirectParam.startsWith('/') ? redirectParam : null;

    // Resend countdown timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (otpStep === 'code' && resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [otpStep, resendTimer]);

    // Check if biometric authentication is available on device
    useEffect(() => {
        const checkBiometric = async () => {
            try {
                const available = await isPlatformAuthenticatorAvailable();
                setBiometricAvailable(available);
            } catch (error) {
                console.error('Error checking biometric:', error);
                setBiometricAvailable(false);
            }
        };
        checkBiometric();
    }, []);

    const getRouteForRole = (role?: string) => {
        if (role === 'agent') return '/agent/dashboard';
        if (role === 'hostel_manager') return '/manager/dashboard';
        if (role === 'admin') return '/admin/dashboard';
        return '/my-bookings';
    };

    const formatPhone = (phone: string) => {
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }
        if (cleaned.startsWith('233')) {
            return cleaned;
        }
        return '233' + cleaned;
    };

    const handleGoogleLogin = async () => {
        setIsGoogleSubmitting(true);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            let role = 'student';
            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, {
                    uid: user.uid,
                    email: user.email,
                    fullName: user.displayName || 'Student',
                    role: 'student',
                    createdAt: new Date().toISOString(),
                    profileImage: user.photoURL || '',
                });
            } else {
                role = (userDocSnap.data() as any).role || 'student';
            }

            toast({ title: `Welcome back, ${user.displayName || 'Student'}!` });
            const destination = safeRedirect && (!role || role === 'student')
                ? safeRedirect
                : getRouteForRole(role);
            router.push(destination);
        } catch (error: any) {
            console.error("Google login error:", error);
            toast({
                title: "Google Sign-In Failed",
                description: error.message || "Failed to sign in with Google.",
                variant: "destructive",
            });
        } finally {
            setIsGoogleSubmitting(false);
        }
    };

    const handlePasswordLogin = async () => {
        if (!identifier.trim() || !password) {
            toast({
                title: "Missing Fields",
                description: "Please enter your email/phone and password.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            let loginEmail = identifier.trim();
            const isEmailLike = loginEmail.includes('@');

            if (!isEmailLike) {
                const formatted = formatPhone(loginEmail);
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('phoneNumber', '==', formatted));
                const snap = await getDocs(q);

                if (snap.empty) {
                    throw new Error('user-not-found');
                }

                const userData = snap.docs[0].data() as any;
                loginEmail = (userData.authEmail as string) || (userData.email as string);

                if (!loginEmail) {
                    throw new Error('missing-email');
                }
            }

            const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
            const user = userCredential.user;

            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data() as any;
                const role = userData.role as string | undefined;
                const displayName = (userData.fullName as string) || (userData.firstName as string) || '';

                toast({ title: displayName ? `Welcome back, ${displayName}!` : 'Login Successful!' });

                const destination =
                    safeRedirect && (!role || role === 'student')
                        ? safeRedirect
                        : getRouteForRole(role);
                router.push(destination);
            } else {
                toast({ title: 'Login Successful!' });
                router.push(safeRedirect ?? '/my-bookings');
            }

        } catch (error: any) {
            console.error("Login error:", error);
            let errorMessage = "Invalid email/phone or password. Please try again.";
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.message === 'user-not-found') {
                errorMessage = "Invalid credentials. Please check your email/phone and password.";
            } else if (error.message === 'invalid-phone') {
                errorMessage = "Please enter a valid phone number or email address.";
            }
            toast({
                title: 'Login Failed',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Send OTP for SMS Login
    const handleSendLoginOtp = async () => {
        const cleaned = otpPhone.replace(/\D/g, '');
        if (cleaned.length < 9) {
            toast({ title: 'Invalid Phone Number', description: 'Please enter a valid Ghana phone number.', variant: 'destructive' });
            return;
        }

        const formatted = formatPhone(otpPhone);
        setIsSendingOtp(true);

        try {
            // Check if user exists with this phone
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('phoneNumber', '==', formatted));
            const snap = await getDocs(q);

            if (snap.empty) {
                toast({
                    title: 'Account Not Found',
                    description: 'No account found with this phone number. Please sign up first.',
                    variant: 'destructive',
                });
                setIsSendingOtp(false);
                return;
            }

            const res = await fetch('/api/sms/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: formatted }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to send SMS code');
            }

            toast({
                title: 'Verification Code Sent',
                description: `A 6-digit code has been sent to +${formatted}`,
            });

            setOtpStep('code');
            setResendTimer(60);
            setOtpCode(['', '', '', '', '', '']);
            setTimeout(() => {
                otpInputRefs.current[0]?.focus();
            }, 100);
        } catch (error: any) {
            console.error('Error sending login OTP:', error);
            toast({
                title: 'Failed to Send Code',
                description: error.message || 'Please check your connection and try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSendingOtp(false);
        }
    };

    // Verify OTP for SMS Login
    const handleVerifyLoginOtp = async () => {
        const fullCode = otpCode.join('');
        if (fullCode.length !== 6) {
            toast({ title: 'Invalid Code', description: 'Please enter all 6 digits.', variant: 'destructive' });
            return;
        }

        const formatted = formatPhone(otpPhone);
        setIsVerifyingOtp(true);

        try {
            const verifyRes = await fetch('/api/sms/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: formatted, otp: fullCode }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
                throw new Error(verifyData.error || 'Invalid or expired verification code');
            }

            // 1. Authenticate with Firebase Auth via Custom Token
            if (verifyData.customToken) {
                await signInWithCustomToken(auth, verifyData.customToken);
            }

            // 2. Fetch user role and name for proper redirection
            let role = verifyData.user?.role || 'student';
            let displayName = verifyData.user?.fullName || 'User';

            if (!verifyData.user) {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('phoneNumber', '==', formatted));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const userData = snap.docs[0].data() as any;
                    role = userData.role || 'student';
                    displayName = userData.fullName || userData.firstName || 'User';
                    
                    const userEmail = userData.authEmail || userData.email;
                    if (!verifyData.customToken && userEmail && userData.biometricPassword) {
                        await signInWithEmailAndPassword(auth, userEmail, userData.biometricPassword);
                    }
                }
            }

            toast({ title: `Welcome back, ${displayName}!` });
            const destination = safeRedirect && (!role || role === 'student')
                ? safeRedirect
                : getRouteForRole(role);
            router.push(destination);

        } catch (error: any) {
            console.error('OTP login error:', error);
            toast({
                title: 'Verification Failed',
                description: error.message || 'Invalid verification code.',
                variant: 'destructive',
            });
        } finally {
            setIsVerifyingOtp(false);
        }
    };

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

    const handleBiometricLogin = async () => {
        setBiometricLoading(true);
        try {
            toast({
                title: 'Scan Your Biometric Sensor',
                description: 'Touch sensor or use Face ID/Windows Hello...',
            });

            const lastUserId = typeof window !== 'undefined' && window.localStorage?.getItem ? window.localStorage.getItem('lastBiometricUserId') : null;
            
            if (lastUserId) {
                const result = await verifyBiometric(lastUserId);
                if (result.success) {
                    const userDocRef = doc(db, 'users', lastUserId);
                    const userDocSnap = await getDoc(userDocRef);
                    
                    if (userDocSnap.exists()) {
                        const userData = userDocSnap.data();
                        const userEmail = userData.authEmail || userData.email;
                        
                        if (userEmail && userData.biometricPassword) {
                            await signInWithEmailAndPassword(auth, userEmail, userData.biometricPassword);
                            const role = userData.role as string | undefined;
                            const displayName = userData.fullName || userData.firstName || '';
                            
                            toast({ 
                                title: `Welcome back, ${displayName}!`,
                                description: 'Biometric verification successful.',
                            });

                            const destination = safeRedirect && (!role || role === 'student')
                                ? safeRedirect
                                : getRouteForRole(role);
                            router.push(destination);
                            setBiometricLoading(false);
                            return;
                        }
                    }
                }
            }

            toast({
                title: 'Passkey Not Enrolled',
                description: 'Please sign in with your email/password. You can enable passkey in Settings.',
                variant: 'destructive',
            });
            setBiometricLoading(false);
        } catch (error: any) {
            console.error('Biometric login error:', error);
            toast({
                title: 'Biometric Login Failed',
                description: error.message || 'Please sign in with your password.',
                variant: 'destructive',
            });
            setBiometricLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="relative flex-1 bg-slate-900 flex items-center justify-center py-16 px-4">
                <div className="absolute inset-0">
                    <Image
                        src="https://images.pexels.com/photos/3768236/pexels-photo-3768236.jpeg?auto=compress&cs=tinysrgb&w=2000"
                        alt="Hostel common area"
                        fill
                        priority
                        className="object-cover brightness-[0.45]"
                    />
                </div>

                <div className="relative z-10 w-full max-w-md">
                    <Card className="border border-white/15 bg-white/10 text-slate-50 shadow-[0_18px_45px_rgba(15,23,42,0.7)] backdrop-blur-xl rounded-[2rem] overflow-hidden">
                        <CardHeader className="text-center pt-8 pb-4">
                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 border border-primary/30 text-primary">
                                <Lock className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle className="text-3xl font-headline font-extrabold tracking-tight text-white">Welcome Back</CardTitle>
                            <CardDescription className="text-slate-200/80 text-sm mt-1">
                                Sign in to your verified HostelHQ account
                            </CardDescription>
                        </CardHeader>
                        
                        <CardContent className="space-y-5 px-6 sm:px-8">
                            {/* Google Sign In (SSO) */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleGoogleLogin}
                                disabled={isGoogleSubmitting || isSubmitting || isSendingOtp || isVerifyingOtp}
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
                                <span>Continue with Google</span>
                            </Button>

                            <div className="relative flex items-center justify-center my-4">
                                <div className="border-t border-white/15 w-full" />
                                <span className="bg-slate-900/80 px-3 text-xs uppercase tracking-wider text-slate-300 backdrop-blur-md">
                                    or
                                </span>
                                <div className="border-t border-white/15 w-full" />
                            </div>

                            {/* Method Switcher */}
                            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/40 border border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setLoginMethod('password')}
                                    className={cn(
                                        "py-2 text-xs font-semibold rounded-lg transition-all",
                                        loginMethod === 'password'
                                            ? "bg-primary text-white shadow-md"
                                            : "text-slate-300 hover:text-white"
                                    )}
                                >
                                    Password
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLoginMethod('phone_otp')}
                                    className={cn(
                                        "py-2 text-xs font-semibold rounded-lg transition-all",
                                        loginMethod === 'phone_otp'
                                            ? "bg-primary text-white shadow-md"
                                            : "text-slate-300 hover:text-white"
                                    )}
                                >
                                    SMS Code
                                </button>
                            </div>

                            {/* Password Sign In View */}
                            {loginMethod === 'password' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="identifier" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                            Email or Phone Number
                                        </Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                            <Input
                                                id="identifier"
                                                type="text"
                                                placeholder="e.g. name@gmail.com or 0244123456"
                                                className="pl-11 h-12 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 focus:ring-2 focus:ring-primary font-medium"
                                                value={identifier}
                                                onChange={(e) => setIdentifier(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handlePasswordLogin();
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                Password
                                            </Label>
                                            <Link href="/forgot-password" className="text-xs text-amber-400 hover:text-amber-300 font-semibold hover:underline transition-colors">
                                                Forgot Password?
                                            </Link>
                                        </div>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                            <Input
                                                id="password"
                                                type="password"
                                                placeholder="••••••••"
                                                className="pl-11 h-12 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 focus:ring-2 focus:ring-primary font-medium"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handlePasswordLogin();
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <Button 
                                        onClick={handlePasswordLogin} 
                                        className="w-full h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all duration-200 hover:scale-[1.01]" 
                                        disabled={isSubmitting || isGoogleSubmitting}
                                    >
                                        {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                        Sign In
                                    </Button>
                                </div>
                            )}

                            {/* SMS Code Sign In View */}
                            {loginMethod === 'phone_otp' && (
                                <div className="space-y-4">
                                    {otpStep === 'phone' ? (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="otpPhone" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                                    Phone Number
                                                </Label>
                                                <div className="flex gap-2">
                                                    <div className="w-24 shrink-0 flex items-center justify-center rounded-xl bg-white/10 border border-white/20 text-sm font-semibold text-white">
                                                        +233 🇬🇭
                                                    </div>
                                                    <div className="relative flex-1">
                                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                                        <Input
                                                            id="otpPhone"
                                                            type="tel"
                                                            placeholder="e.g. 0244123456"
                                                            className="pl-11 h-12 bg-white/95 text-slate-900 placeholder:text-slate-500 rounded-xl border-white/20 font-medium"
                                                            value={otpPhone}
                                                            onChange={(e) => setOtpPhone(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSendLoginOtp();
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <Button 
                                                onClick={handleSendLoginOtp} 
                                                className="w-full h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all duration-200 hover:scale-[1.01]" 
                                                disabled={isSendingOtp}
                                            >
                                                {isSendingOtp ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                        Sending Code...
                                                    </>
                                                ) : (
                                                    'Send Verification Code'
                                                )}
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-center space-y-1">
                                                <p className="text-xs text-slate-300">
                                                    Enter the 6-digit code sent to <span className="text-white font-semibold">+{formatPhone(otpPhone)}</span>
                                                </p>
                                            </div>

                                            <div className="flex justify-center gap-2 py-2">
                                                {otpCode.map((digit, idx) => (
                                                    <input
                                                        key={idx}
                                                        ref={(el) => { otpInputRefs.current[idx] = el; }}
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={1}
                                                        value={digit}
                                                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                                                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                                        onPaste={handleOtpPaste}
                                                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold bg-white text-slate-900 rounded-xl border border-white/20 shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                                                    />
                                                ))}
                                            </div>

                                            <div className="flex items-center justify-between text-xs text-slate-300">
                                                <button
                                                    type="button"
                                                    onClick={() => setOtpStep('phone')}
                                                    className="text-slate-400 hover:text-white"
                                                >
                                                    Change number
                                                </button>
                                                {resendTimer > 0 ? (
                                                    <span className="text-slate-400">Resend in {resendTimer}s</span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={handleSendLoginOtp}
                                                        disabled={isSendingOtp}
                                                        className="text-amber-400 hover:text-amber-300 font-bold hover:underline"
                                                    >
                                                        Resend Code
                                                    </button>
                                                )}
                                            </div>

                                            <Button 
                                                onClick={handleVerifyLoginOtp} 
                                                className="w-full h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all duration-200 hover:scale-[1.01]" 
                                                disabled={isVerifyingOtp || otpCode.join('').length !== 6}
                                            >
                                                {isVerifyingOtp ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                        Verifying...
                                                    </>
                                                ) : (
                                                    'Verify & Sign In'
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            )}
                        </CardContent>
                        
                        <CardFooter className="flex flex-col gap-4 px-6 sm:px-8 pb-8 pt-2">
                            {biometricAvailable && (
                                <Button
                                    type="button"
                                    onClick={handleBiometricLogin}
                                    variant="ghost"
                                    disabled={biometricLoading}
                                    className="w-full h-10 text-slate-300 hover:text-white hover:bg-white/10 text-xs font-medium gap-2"
                                >
                                    {biometricLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4 text-emerald-400" />}
                                    Sign in with Passkey / Biometrics
                                </Button>
                            )}

                            <p className="text-center text-xs text-slate-300/90 pt-2">
                                Don't have an account?{' '}
                                <Link href="/signup" className="text-amber-400 hover:text-amber-300 font-bold hover:underline transition-colors">
                                    Sign up here
                                </Link>
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<AppLoader message="Loading HostelHQ Login..." />}>
            <LoginPageInner />
        </Suspense>
    );
}
