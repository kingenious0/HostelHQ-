
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
import { Loader2, User, KeyRound, Mail, Phone, GraduationCap, ShieldCheck, Building } from 'lucide-react';
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
    const [phoneNumber, setPhoneNumber] = useState('');
    const [studentIndex, setStudentIndex] = useState('');
    const [selectedRole, setSelectedRole] = useState<'student' | 'agent' | 'hostel_manager'>('student');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    // State for multi-step form
    const [step, setStep] = useState(1);
    const [termsAccepted, setTermsAccepted] = useState(false);

    const getResolvedRole = (email: string, chosenRole: string): 'student' | 'agent' | 'admin' | 'pending_agent' | 'hostel_manager' => {
        const lowerCaseEmail = email.toLowerCase().trim();
        if (lowerCaseEmail === 'admin@hostelhq.com') return 'admin';
        if (chosenRole === 'agent' || lowerCaseEmail.endsWith('@agent.hostelhq.com')) return 'pending_agent';
        if (chosenRole === 'hostel_manager' || lowerCaseEmail.endsWith('@manager.hostelhq.com')) return 'hostel_manager';
        return 'student';
    }

    const role = getResolvedRole(email, selectedRole);
    const isManagerSignup = role === 'hostel_manager';

    const handleNextStep = () => {
        if (!fullName.trim() || !email.trim() || !password) {
            toast({ title: "Missing Fields", description: "Please fill out your name, email, and password.", variant: "destructive" });
            return;
        }
        if (password.length < 6) {
            toast({ title: "Password Too Short", description: "Password must be at least 6 characters.", variant: "destructive" });
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
            const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const user = userCredential.user;

            let userData: any = {
                uid: user.uid,
                fullName: fullName.trim(),
                email: email.trim().toLowerCase(),
                phoneNumber: phoneNumber.trim() || '',
                role: role,
                createdAt: new Date().toISOString(),
            };

            if (selectedRole === 'student' && studentIndex.trim()) {
                userData.studentIndexNumber = studentIndex.trim();
            }
            
            if (isManagerSignup) {
                userData.termsAcceptedAt = new Date().toISOString();
            }

            if (role === 'pending_agent') {
                await setDoc(doc(db, "pendingUsers", user.uid), userData);
                toast({ title: 'Application Submitted!', description: 'Your agent application has been submitted for admin approval.' });
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
                <Card className="w-full max-w-lg shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline">Create an Account</CardTitle>
                        <CardDescription>
                            {step === 1 ? 'Join HostelHQ for safe, verified student accommodation.' : 'Hostel Manager Tenancy Agreement'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {step === 1 && (
                            <>
                                {/* Role Selection Tabs */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">I am joining as</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedRole('student')}
                                            className={`p-3 text-xs font-semibold rounded-lg border flex flex-col items-center gap-1.5 transition-all ${
                                                selectedRole === 'student'
                                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                                    : 'bg-card text-foreground hover:bg-muted/50 border-border'
                                            }`}
                                        >
                                            <GraduationCap className="h-4 w-4" />
                                            <span>Student</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedRole('agent')}
                                            className={`p-3 text-xs font-semibold rounded-lg border flex flex-col items-center gap-1.5 transition-all ${
                                                selectedRole === 'agent'
                                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                                    : 'bg-card text-foreground hover:bg-muted/50 border-border'
                                            }`}
                                        >
                                            <ShieldCheck className="h-4 w-4" />
                                            <span>Campus Agent</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedRole('hostel_manager')}
                                            className={`p-3 text-xs font-semibold rounded-lg border flex flex-col items-center gap-1.5 transition-all ${
                                                selectedRole === 'hostel_manager'
                                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                                    : 'bg-card text-foreground hover:bg-muted/50 border-border'
                                            }`}
                                        >
                                            <Building className="h-4 w-4" />
                                            <span>Manager</span>
                                        </button>
                                    </div>
                                </div>

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
                                        <Input id="email" type="email" placeholder="you@example.com (Gmail, Yahoo, or Uni email)" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone Number (MoMo)</Label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input id="phone" type="tel" placeholder="054XXXXXXX" className="pl-10" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                                        </div>
                                    </div>

                                    {selectedRole === 'student' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="studentIndex">Student Index No. (Optional)</Label>
                                            <div className="relative">
                                                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input id="studentIndex" placeholder="e.g., 10892345" className="pl-10" value={studentIndex} onChange={(e) => setStudentIndex(e.target.value)} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input id="password" type="password" placeholder="•••••••• (Min. 6 chars)" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} />
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
