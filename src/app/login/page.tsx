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
import { Loader2, KeyRound, Mail, Fingerprint, Keyboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { isPlatformAuthenticatorAvailable, verifyBiometric } from '@/lib/webauthn';

function LoginPageInner() {
    const [identifier, setIdentifier] = useState(''); // email or phone
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loginMode, setLoginMode] = useState<'choose' | 'fingerprint' | 'manual'>('choose');
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricLoading, setBiometricLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectParam = searchParams.get('redirect');
    const safeRedirect = redirectParam && redirectParam.startsWith('/') ? redirectParam : null;

    // Check if biometric authentication is available
    useEffect(() => {
        const checkBiometric = async () => {
            try {
                const available = await isPlatformAuthenticatorAvailable();
                setBiometricAvailable(available);
                console.log('Biometric available:', available);
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
        return '/';
    };

    const handleLogin = async () => {
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

                // Normalize phone to match signup storage format
                // Signup stores phoneNumber as: countryCodeDigits + localWithoutLeadingZero (e.g. 233244123456)
                let normalized = cleaned;
                if (normalized.startsWith('0') && normalized.length === 10) {
                    // Assume Ghana local format like 0244xxxxxx -> 233244xxxxxx
                    normalized = '233' + normalized.substring(1);
                } else if (normalized.startsWith('233') && normalized.length === 12) {
                    // Already in 233 + 9-digit form; keep as is
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
                toast({ title: displayName ? `Welcome ${displayName}!` : 'Login Successful!' });

                // Redirect based on role
                const destination =
                    safeRedirect && (!role || role === 'student')
                        ? safeRedirect
                        : getRouteForRole(role);
                router.push(destination);
            } else {
                // User document doesn't exist, redirect to home
                toast({ title: 'Login Successful!' });
                router.push(safeRedirect ?? '/');
            }

        } catch (error: any) {
            console.error("Login error:", error);
            let errorMessage = "An unknown error occurred.";
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                errorMessage = "Invalid email or password. Please try again.";
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

    // Handle fingerprint login - NO EMAIL/PHONE REQUIRED!
    const handleFingerprintLogin = async () => {
        setBiometricLoading(true);
        try {
            toast({
                title: 'Scan Your Fingerprint',
                description: 'Place your finger on the sensor...',
            });

            // Get stored user ID from last successful biometric login (if any)
            const lastUserId = localStorage.getItem('lastBiometricUserId');
            
            // Try to verify with stored user ID first
            let userId = lastUserId;
            let userData: any = null;
            let userEmail: string | null = null;

            if (userId) {
                console.log('Attempting biometric login with stored user ID:', userId);
                const result = await verifyBiometric(userId);
                
                if (result.success) {
                    // Get user data
                    const userDocRef = doc(db, 'users', userId);
                    const userDocSnap = await getDoc(userDocRef);
                    
                    if (userDocSnap.exists()) {
                        userData = userDocSnap.data();
                        userEmail = userData.authEmail || userData.email;
                        
                        // Successfully verified! Now sign in to Firebase
                        if (userEmail && userData.biometricPassword) {
                            await signInWithEmailAndPassword(auth, userEmail, userData.biometricPassword);
                            
                            const role = userData.role as string | undefined;
                            const displayName = userData.fullName || userData.firstName || '';
                            
                            toast({ 
                                title: `Welcome back, ${displayName}!`,
                                description: 'Fingerprint verified successfully.',
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

            // If we get here, either no stored user or verification failed
            // Fall back to manual login
            toast({
                title: 'Fingerprint Not Recognized',
                description: 'Please sign in manually or ensure you\'ve set up fingerprint during signup.',
                variant: 'destructive',
            });
            setLoginMode('manual');
            setBiometricLoading(false);
        } catch (error: any) {
            console.error('Fingerprint login error:', error);
            toast({
                title: 'Fingerprint Login Failed',
                description: error.message || 'Please try again or sign in manually.',
                variant: 'destructive',
            });
            setLoginMode('manual');
            setBiometricLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="relative flex-1 bg-slate-900">
                <div className="absolute inset-0">
                    <Image
                        src="https://images.pexels.com/photos/3768236/pexels-photo-3768236.jpeg?auto=compress&cs=tinysrgb&w=2000"
                        alt="Students in a hostel common area"
                        fill
                        priority
                        className="object-cover brightness-[0.55]"
                    />
                </div>

                <div className="relative flex h-full items-center justify-center py-12 px-4">
                    <Card className="w-full max-w-md border border-white/15 bg-white/10 text-slate-50 shadow-[0_18px_45px_rgba(15,23,42,0.7)] backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline text-slate-50">Welcome Back</CardTitle>
                            <CardDescription className="text-slate-100/80">
                                {loginMode === 'choose' 
                                    ? 'Choose how you want to sign in.'
                                    : loginMode === 'fingerprint'
                                    ? 'Sign in with your fingerprint.'
                                    : 'Log in to your HostelHQ account.'}
                            </CardDescription>
                        </CardHeader>
                        
                        <CardContent className="space-y-6">
                            {/* Login Mode Selection */}
                            {loginMode === 'choose' && (
                                <div className="space-y-4">
                                    {/* Fingerprint Option */}
                                    {biometricAvailable && (
                                        <Button
                                            onClick={() => setLoginMode('fingerprint')}
                                            variant="outline"
                                            className="w-full h-20 flex flex-col items-center justify-center gap-2 bg-white/10 border-white/20 hover:bg-white/20 text-white"
                                        >
                                            <Fingerprint className="h-8 w-8 text-green-400" />
                                            <span className="text-sm font-medium">Sign in with Fingerprint</span>
                                        </Button>
                                    )}
                                    
                                    {/* Manual Sign In Option */}
                                    <Button
                                        onClick={() => setLoginMode('manual')}
                                        variant="outline"
                                        className="w-full h-20 flex flex-col items-center justify-center gap-2 bg-white/10 border-white/20 hover:bg-white/20 text-white"
                                    >
                                        <Keyboard className="h-8 w-8 text-blue-400" />
                                        <span className="text-sm font-medium">Sign in Manually</span>
                                    </Button>

                                    {!biometricAvailable && (
                                        <p className="text-xs text-center text-slate-300/70">
                                            Fingerprint login is not available on this device.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Fingerprint Login Mode */}
                            {loginMode === 'fingerprint' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="identifier-fp">Your Email or Phone</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input
                                                id="identifier-fp"
                                                type="text"
                                                placeholder="e.g. std-ell205@hostelhq.com or 0244123456"
                                                className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                value={identifier}
                                                onChange={(e) => setIdentifier(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center py-4">
                                        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                                            <Fingerprint className="h-12 w-12 text-green-400" />
                                        </div>
                                        <p className="text-sm text-slate-200 text-center">
                                            Enter your email/phone, then tap the button below to verify with your fingerprint.
                                        </p>
                                    </div>

                                    <Button 
                                        onClick={handleFingerprintLogin} 
                                        className="w-full bg-green-600 hover:bg-green-700" 
                                        disabled={biometricLoading}
                                    >
                                        {biometricLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Verifying...
                                            </>
                                        ) : (
                                            <>
                                                <Fingerprint className="mr-2 h-4 w-4" />
                                                Verify Fingerprint
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        onClick={() => setLoginMode('manual')}
                                        variant="ghost"
                                        className="w-full text-slate-300 hover:text-white hover:bg-white/10"
                                    >
                                        <Keyboard className="mr-2 h-4 w-4" />
                                        Sign in Manually Instead
                                    </Button>
                                </div>
                            )}

                            {/* Manual Login Mode */}
                            {loginMode === 'manual' && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="identifier">Unique ID</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input
                                                id="identifier"
                                                type="text"
                                                placeholder="e.g. std-ell205@hostelhq.com"
                                                className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                value={identifier}
                                                onChange={(e) => setIdentifier(e.target.value)}
                                            />
                                        </div>
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
                                    </div>
                                </>
                            )}
                        </CardContent>
                        
                        <CardFooter className="flex flex-col gap-4">
                            {loginMode === 'manual' && (
                                <>
                                    <Button onClick={handleLogin} className="w-full" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Log In
                                    </Button>
                                    
                                    {biometricAvailable && (
                                        <Button
                                            onClick={() => setLoginMode('fingerprint')}
                                            variant="ghost"
                                            className="w-full text-slate-300 hover:text-white hover:bg-white/10"
                                        >
                                            <Fingerprint className="mr-2 h-4 w-4" />
                                            Use Fingerprint Instead
                                        </Button>
                                    )}
                                </>
                            )}
                            
                            {loginMode === 'choose' && (
                                <div className="w-full" />
                            )}
                            
                            <p className="text-sm text-slate-100/80">
                                Don't have an account?{' '}
                                <Link href="/signup" className="text-accent font-semibold hover:underline">
                                    Sign Up
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
        <Suspense
            fallback={
                <div className="flex flex-col min-h-screen">
                    <Header />
                    <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </main>
                </div>
            }
        >
            <LoginPageInner />
        </Suspense>
    );
}
