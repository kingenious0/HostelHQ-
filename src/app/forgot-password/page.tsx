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
import { Loader2, Phone, KeyRound, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Step = 'phone' | 'otp' | 'newPassword' | 'success';

export default function ForgotPasswordPage() {
    const [step, setStep] = useState<Step>('phone');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState('+233');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [userId, setUserId] = useState('');
    const [authEmail, setAuthEmail] = useState('');
    const { toast } = useToast();
    const router = useRouter();

    const isValidPhoneNumber = (phone: string): boolean => {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length >= 9 && cleaned.length <= 10;
    };

    const handleSendOTP = async () => {
        if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
            toast({ title: "Invalid Phone", description: "Please enter a valid phone number.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const fullPhone = countryCode + phoneNumber.replace(/\D/g, '');
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: fullPhone }),
            });

            const data = await response.json();

            if (data.success) {
                setUserId(data.userId);
                setAuthEmail(data.authEmail);
                setStep('otp');
                setResendCooldown(60);
                toast({ title: "OTP Sent", description: "Check your phone for the verification code." });

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
                toast({ title: "Error", description: data.error || "Failed to send OTP.", variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp || otp.length !== 6) {
            toast({ title: "Invalid OTP", description: "Please enter a 6-digit code.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const fullPhone = countryCode + phoneNumber.replace(/\D/g, '');
            const response = await fetch('/api/sms/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: fullPhone, otp }),
            });

            const data = await response.json();

            if (data.success) {
                setStep('newPassword');
                toast({ title: "Verified", description: "OTP verified successfully!" });
            } else {
                toast({ title: "Invalid OTP", description: data.error || "Please check your code.", variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to verify OTP.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (newPassword.length < 6) {
            toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" });
            return;
        }

        if (newPassword !== confirmPassword) {
            toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, newPassword }),
            });

            const data = await response.json();

            if (data.success) {
                setStep('success');
                toast({ title: "Success", description: "Password reset successfully!" });
            } else {
                toast({ title: "Error", description: data.error || "Failed to reset password.", variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to reset password.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="relative flex-1 bg-slate-900">
                <div className="absolute inset-0">
                    <Image
                        src="https://images.pexels.com/photos/3768236/pexels-photo-3768236.jpeg?auto=compress&cs=tinysrgb&w=2000"
                        alt="Background"
                        fill
                        priority
                        className="object-cover brightness-[0.55]"
                    />
                </div>

                <div className="relative flex h-full items-center justify-center py-12 px-4">
                    <Card className="w-full max-w-md border border-white/15 bg-white/10 text-slate-50 shadow-[0_18px_45px_rgba(15,23,42,0.7)] backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline text-slate-50">
                                {step === 'success' ? 'Password Reset!' : 'Forgot Password'}
                            </CardTitle>
                            <CardDescription className="text-slate-100/80">
                                {step === 'phone' && 'Enter your phone number to receive a reset code.'}
                                {step === 'otp' && 'Enter the 6-digit code sent to your phone.'}
                                {step === 'newPassword' && 'Create a new password for your account.'}
                                {step === 'success' && 'Your password has been reset successfully.'}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {step === 'phone' && (
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={countryCode}
                                            onChange={(e) => setCountryCode(e.target.value)}
                                            className="w-20 bg-white/95 text-slate-900"
                                            disabled
                                        />
                                        <div className="relative flex-1">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input
                                                id="phone"
                                                type="tel"
                                                placeholder="0244123456"
                                                className="pl-10 bg-white/95 text-slate-900"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 'otp' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="otp">Verification Code</Label>
                                        <Input
                                            id="otp"
                                            type="text"
                                            placeholder="123456"
                                            maxLength={6}
                                            className="text-center text-2xl tracking-widest bg-white/95 text-slate-900"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        className="w-full text-slate-300"
                                        onClick={handleSendOTP}
                                        disabled={resendCooldown > 0 || isLoading}
                                    >
                                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                                    </Button>
                                </div>
                            )}

                            {step === 'newPassword' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">New Password</Label>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input
                                                id="newPassword"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                className="pl-10 pr-10 bg-white/95 text-slate-900"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                            >
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input
                                                id="confirmPassword"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                className="pl-10 bg-white/95 text-slate-900"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 'success' && (
                                <div className="flex flex-col items-center py-6">
                                    <CheckCircle className="h-16 w-16 text-green-400 mb-4" />
                                    <p className="text-center text-slate-200">
                                        Your login ID is: <strong>{authEmail}</strong>
                                    </p>
                                </div>
                            )}
                        </CardContent>

                        <CardFooter className="flex flex-col gap-4">
                            {step === 'phone' && (
                                <Button onClick={handleSendOTP} className="w-full" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Send Reset Code
                                </Button>
                            )}

                            {step === 'otp' && (
                                <Button onClick={handleVerifyOTP} className="w-full" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Verify Code
                                </Button>
                            )}

                            {step === 'newPassword' && (
                                <Button onClick={handleResetPassword} className="w-full" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Reset Password
                                </Button>
                            )}

                            {step === 'success' && (
                                <Button onClick={() => router.push('/login')} className="w-full">
                                    Go to Login
                                </Button>
                            )}

                            {step !== 'success' && (
                                <Link href="/login" className="flex items-center text-sm text-slate-300 hover:text-white">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Login
                                </Link>
                            )}
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}
