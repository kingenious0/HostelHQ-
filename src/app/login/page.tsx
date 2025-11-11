
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleLogin = async () => {
        setIsSubmitting(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check user role and redirect accordingly
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                const role = userData.role;

                toast({ title: 'Login Successful!' });

                // Redirect based on role
                if (role === 'agent') {
                    router.push('/agent/dashboard');
                } else if (role === 'hostel_manager') {
                    router.push('/manager/dashboard');
                } else if (role === 'admin') {
                    router.push('/admin/dashboard');
                } else {
                    router.push('/');
                }
            } else {
                // User document doesn't exist, redirect to home
                toast({ title: 'Login Successful!' });
                router.push('/');
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

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                <Card className="w-full max-w-md shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline">Welcome Back</CardTitle>
                        <CardDescription>Log in to your HostelHQ account.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input 
                                    id="email" 
                                    type="email" 
                                    placeholder="e.g. name@student.hostelhq.com" 
                                    className="pl-10" 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)} 
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
                                    className="pl-10" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button onClick={handleLogin} className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Log In
                        </Button>
                        <p className="text-sm text-muted-foreground">
                            Don't have an account?{' '}
                            <Link href="/signup" className="text-primary hover:underline">
                                Sign Up
                            </Link>
                        </p>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
