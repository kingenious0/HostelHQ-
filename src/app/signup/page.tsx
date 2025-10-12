
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
import { Loader2, User, KeyRound, Mail, Info, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { tenancyAgreementText } from '@/lib/legal';

export default function SignupPage() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    // State for multi-step form
    const [step, setStep] = useState(1);
    const [termsAccepted, setTermsAccepted] = useState(false);

    const getRoleFromEmail = (email: string): 'student' | 'agent' | 'admin' | 'pending_agent' | 'hostel_manager' | 'invalid' => {
        const lowerCaseEmail = email.toLowerCase();
        if (lowerCaseEmail === 'admin@hostelhq.com') return 'admin';
        if (lowerCaseEmail.endsWith('@student.hostelhq.com')) return 'student';
        if (lowerCaseEmail.endsWith('@agent.hostelhq.com')) return 'pending_agent';
        if (lowerCaseEmail.endsWith('@manager.hostelhq.com')) return 'hostel_manager';
        return 'invalid';
    }

    const role = getRoleFromEmail(email);
    const isManagerSignup = role === 'hostel_manager';

    const handleNextStep = () => {
        if (!fullName || !email || !password) {
            toast({ title: "Missing Fields", description: "Please fill out all fields.", variant: "destructive" });
            return;
        }
        if (role === 'invalid') {
            toast({
                title: "Invalid Email Format",
                description: "Use a valid email ending: @student.hostelhq.com, @agent.hostelhq.com, or @manager.hostelhq.com.",
                variant: "destructive"
            });
            return;
        }
        if (isManagerSignup) {
            setStep(2);
        } else {
            handleSignup(); // Non-managers proceed directly to signup
        }
    }

    const handleSignup = async () => {
        if (isManagerSignup && !termsAccepted) {
            toast({ title: "Agreement Required", description: "You must accept the terms and conditions.", variant: "destructive" });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            let userData: any = {
                uid: user.uid,
                fullName: fullName,
                email: email,
                role: role,
                createdAt: new Date().toISOString(),
            };
            
            if (isManagerSignup) {
                userData.termsAcceptedAt = new Date().toISOString();
            }


            if (role === 'pending_agent') {
                await setDoc(doc(db, "pendingUsers", user.uid), userData);
                toast({ title: 'Application Submitted!', description: 'Your agent account has been submitted for admin approval.' });
                await auth.signOut(); 
                router.push('/login');
            } else {
                await setDoc(doc(db, "users", user.uid), userData);
                toast({ title: 'Account Created Successfully!' });
                if (role === 'admin') {
                    toast({ title: 'Admin Account Detected!', description: 'You have been assigned admin privileges.' });
                }
                if (role === 'hostel_manager') {
                     router.push('/manager/dashboard');
                } else {
                    router.push('/');
                }
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
                        <CardDescription>
                            {step === 1 ? 'Join HostelHQ to find or list student rooms.' : 'Hostel Manager Agreement'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {step === 1 && (
                            <>
                                <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>Email Requirement</AlertTitle>
                                    <AlertDescription>
                                        Use a specific email format for your role:
                                        <ul className="list-disc list-inside text-xs mt-2">
                                            <li><b>Student:</b> <code className="font-mono text-xs">...@student.hostelhq.com</code></li>
                                            <li><b>Agent:</b> <code className="font-mono text-xs">...@agent.hostelhq.com</code></li>
                                            <li><b>Manager:</b> <code className="font-mono text-xs">...@manager.hostelhq.com</code></li>
                                        </ul>
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
                            </>
                        )}
                        {step === 2 && isManagerSignup && (
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">Please read and agree to the standard Tenancy Agreement and Rent Control regulations before proceeding.</p>
                                <Card>
                                    <CardContent className="p-0">
                                        <ScrollArea className="h-64 w-full p-4 border rounded-md">
                                            <h4 className="font-bold mb-4">Master Tenancy Agreement Template</h4>
                                            <p className="text-xs whitespace-pre-wrap">{tenancyAgreementText}</p>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(!!checked)} />
                                    <label
                                        htmlFor="terms"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        I have read and accept the regulations and agreement template.
                                    </label>
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        {step === 1 && (
                            <Button onClick={handleNextStep} className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isManagerSignup ? 'Next' : 'Create Account')}
                            </Button>
                        )}
                        {step === 2 && isManagerSignup && (
                            <>
                                <Button onClick={handleSignup} className="w-full" disabled={isSubmitting || !termsAccepted}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create Manager Account
                                </Button>
                                <Button variant="outline" onClick={() => setStep(1)} className="w-full">Back</Button>
                            </>
                        )}
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
