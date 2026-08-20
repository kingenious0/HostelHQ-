"use client";

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, Mail, Fingerprint, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where, setDoc } from 'firebase/firestore';
import { isPlatformAuthenticatorAvailable, verifyBiometric } from '@/lib/webauthn';

function LoginPageInner() {
    const [identifier, setIdentifier] = useState(''); // email or phone
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricLoading, setBiometricLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectParam = searchParams.get('redirect');
    const safeRedirect = redirectParam && redirectParam.startsWith('/') ? redirectParam : null;

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

    const handleGoogleLogin = async () => {
        setIsGoogleSubmitting(true);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if user profile exists
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

    const handleLogin = async () => {
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

            // If identifier is a phone number, resolve it to the stored authEmail/email
            if (!isEmailLike) {
                const cleaned = loginEmail.replace(/\D/g, '');
                if (!cleaned) {
                    throw new Error('invalid-phone');
                }

                let normalized = cleaned;
                if (normalized.startsWith('0') && normalized.length === 10) {
                    normalized = '233' + normalized.substring(1);
                }

                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('phoneNumber', '==', normalized));
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

            // Check user role and redirect accordingly
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
                router.push(safeRedirect ?? '/');
            }

        } catch (error: any) {
            console.error("Login error:", error);
            let errorMessage = "An unknown error occurred.";
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

    // Handle biometric / passkey login
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
                                <span>Continue with Google</span>
                            </Button>

                            <div className="relative flex items-center justify-center my-4">
                                <div className="border-t border-white/15 w-full" />
                                <span className="bg-slate-900/80 px-3 text-xs uppercase tracking-wider text-slate-300 backdrop-blur-md">
                                    or
                                </span>
                                <div className="border-t border-white/15 w-full" />
                            </div>

                            {/* Email or Phone Input */}
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
                                            if (e.key === 'Enter') handleLogin();
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                        Password
                                    </Label>
                                    <Link href="/forgot-password" className="text-xs text-primary font-medium hover:underline">
                                        Forgot?
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
                                            if (e.key === 'Enter') handleLogin();
                                        }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        
                        <CardFooter className="flex flex-col gap-4 px-6 sm:px-8 pb-8 pt-2">
                            <Button 
                                onClick={handleLogin} 
                                className="w-full h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all duration-200 hover:scale-[1.01]" 
                                disabled={isSubmitting || isGoogleSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                Sign In
                            </Button>
                            
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
                                <Link href="/signup" className="text-primary font-bold hover:underline">
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
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <LoginPageInner />
        </Suspense>
    );
}
