
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, User, KeyRound, Mail, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function SignupPage() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const getRoleFromEmail = (email: string): 'student' | 'agent' | 'admin' | 'pending_agent' | 'invalid' => {
        const lowerCaseEmail = email.toLowerCase();
        if (lowerCaseEmail === 'admin@hostelhq.com') return 'admin';
        if (lowerCaseEmail.endsWith('@student.hostelhq.com')) return 'student';
        if (lowerCaseEmail.endsWith('@agent.hostelhq.com')) return 'pending_agent';
        return 'invalid';
    }

    const handleSignup = async () => {
        if (!fullName || !email || !password) {
            toast({ title: "Missing Fields", description: "Please fill out all fields.", variant: "destructive" });
            return;
        }

        const role = getRoleFromEmail(email);

        if (role === 'invalid') {
            toast({
                title: "Invalid Email Format",
                description: "Please use a valid email ending in @student.hostelhq.com or @agent.hostelhq.com.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);
        try {
            // Step 1: Create user in Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const userData = {
                uid: user.uid,
                fullName: fullName,
                email: email,
                role: role,
                createdAt: new Date().toISOString(),
            };

            // Step 2: Create user document in the correct Firestore collection
            if (role === 'pending_agent') {
                // For agents, create in 'pendingUsers' for admin approval
                await setDoc(doc(db, "pendingUsers", user.uid), userData);
                toast({ title: 'Application Submitted!', description: 'Your agent account has been submitted for admin approval.' });
                await auth.signOut(); // Sign the user out until they are approved
                router.push('/login');
            } else {
                // For students and admin, create directly in 'users' collection
                await setDoc(doc(db, "users", user.uid), userData);
                toast({ title: 'Account Created Successfully!' });
                if (role === 'admin') {
                    toast({ title: 'Admin Account Detected!', description: 'You have been assigned admin privileges.' });
                }
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

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                <Card className="w-full max-w-md shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline">Create an Account</CardTitle>
                        <CardDescription>Join HostelHQ to find or list student rooms.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Email Requirement</AlertTitle>
                            <AlertDescription>
                                Use a <code className="font-mono">@student.hostelhq.com</code> email to sign up as a student, or a <code className="font-mono">@agent.hostelhq.com</code> email to apply as an agent.
                            </AlertDescription>
                        </Alert>
                         <div className="space-y-2">
                            <Label htmlFor="fullname">Full Name</Label>
                             <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input id="fullname" placeholder="e.g., Jane Doe" className="pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input id="email" type="email" placeholder="you@role.hostelhq.com" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input id="password" type="password" placeholder="••••••••" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button onClick={handleSignup} className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Account
                        </Button>
                         <p className="text-sm text-muted-foreground">
                            Already have an account?{' '}
                            <Link href="/login" className="text-primary hover:underline">
                                Log In
                            </Link>
                        </p>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
