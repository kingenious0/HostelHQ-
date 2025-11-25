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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, User, KeyRound, Mail, Info, FileText, GraduationCap, UserCheck, Building, Phone, ArrowLeft, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { tenancyAgreementText } from '@/lib/legal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { FaceCaptureDialog } from '@/components/FaceCaptureDialog';
import { BiometricCaptureDialog } from '@/components/BiometricCaptureDialog';
import { detectFaceDescriptor, descriptorToArray } from '@/lib/faceDetection';

type UserRole = 'student' | 'agent' | 'hostel_manager' | null;

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
    const [selectedRole, setSelectedRole] = useState<UserRole>(null);
    const [fullName, setFullName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState('+233');
    const [otp, setOtp] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingOTP, setIsSendingOTP] = useState(false);
    const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [faculty, setFaculty] = useState('');
    const [department, setDepartment] = useState('');
    const [managerHostels, setManagerHostels] = useState<{ id: string; name?: string; location?: string; managerId?: string }[]>([]);
    const [loadingManagerHostels, setLoadingManagerHostels] = useState(false);
    const [selectedManagerHostelId, setSelectedManagerHostelId] = useState('');
    const { toast } = useToast();
    const router = useRouter();

    // State for multi-step form
    const [step, setStep] = useState(1); // 1: Role selection, 2: Basic info, 3: OTP, 4: Face capture, 5: Manager hostel selection
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [isFaceCaptureOpen, setIsFaceCaptureOpen] = useState(false);
    const [isBiometricCaptureOpen, setIsBiometricCaptureOpen] = useState(false);
    const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
    const [biometricCredential, setBiometricCredential] = useState<any>(null);
    const [isProcessingBiometric, setIsProcessingBiometric] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    // Build the exact role-based auth email that will be used at account creation
    // This ensures WebAuthn uses a stable identifier (no temp IDs)
    const getUserId = () => {
        try {
            if (selectedRole === 'student') {
                // Students: STU-XXXNNN from firstName + phone last 3
                if (firstName && phoneNumber && countryCode) {
                    const cleanedNumber = phoneNumber.replace(/\D/g, '');
                    const cc = countryCode.replace(/\D/g, '');
                    const combined = cc + cleanedNumber;
                    const firstThree = firstName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
                    const lastThree = combined.slice(-3);
                    const studentId = `STU-${firstThree}${lastThree}`;
                    return `${studentId.toLowerCase()}@hostelhq.com`;
                }
                // fallback to typed email if present during early steps
                if (email) return email;
            } else if (selectedRole === 'agent') {
                // Agents: AGNT-XXXNNN from first word of name + phone last 3
                if (fullName && phoneNumber && countryCode) {
                    const namePart = (fullName || '').trim().split(/\s+/)[0] || 'AGENT';
                    const cleanedNumber = phoneNumber.replace(/\D/g, '');
                    const cc = countryCode.replace(/\D/g, '');
                    const combined = cc + cleanedNumber;
                    const firstThree = namePart.replace(/\s+/g, '').slice(0, 3).toUpperCase();
                    const lastThree = combined.slice(-3);
                    const agentId = `AGNT-${firstThree}${lastThree}`;
                    return `${agentId.toLowerCase()}@hostelhq.com`;
                }
            } else if (selectedRole === 'hostel_manager') {
                // Managers: MNG-XXXNNN from first word of name + phone last 3 (deterministic)
                if (fullName && phoneNumber && countryCode) {
                    const namePart = (fullName || '').trim().split(/\s+/)[0] || 'MGR';
                    const cleanedNumber = phoneNumber.replace(/\D/g, '');
                    const cc = countryCode.replace(/\D/g, '');
                    const combined = cc + cleanedNumber;
                    const firstThree = namePart.replace(/\s+/g, '').slice(0, 3).toUpperCase();
                    const lastThree = combined.slice(-3);
                    const managerId = `MNG-${firstThree}${lastThree}`;
                    return `${managerId.toLowerCase()}@hostelhq.com`;
                }
            }
            // Generic fallbacks (no temp IDs)
            if (email) return email;
            if (phoneNumber && countryCode) {
                const cleanedNumber = phoneNumber.replace(/\D/g, '');
                const cc = countryCode.replace(/\D/g, '');
                return `${cc}${cleanedNumber}`;
            }
        } catch (_) {}
        // As a last resort, return empty string (will be rejected upstream rather than using temp)
        return '';
    };

    // Validate email format
    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Load available hostels (without a manager) for manager signup step
    const loadManagerHostels = async () => {
        setLoadingManagerHostels(true);
        try {
            const snap = await getDocs(collection(db, 'hostels'));
            const list = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
            const filtered = list.filter((h: any) => !h.managerId);
            setManagerHostels(filtered);
        } catch (error) {
            console.error('Error loading hostels for manager signup:', error);
        } finally {
            setLoadingManagerHostels(false);
        }
    };

    // Validate Ghana phone number
    const isValidPhoneNumber = (phone: string): boolean => {
        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');
        // Ghana numbers: 10 digits (0XXXXXXXXX) or 9 digits after country code
        return cleaned.length >= 9 && cleaned.length <= 10;
    };

    // Handle role selection
    const handleRoleSelect = (role: UserRole) => {
        setSelectedRole(role);
        // Immediately move to the next step so users don't have to press Continue again
        setStep(2);
    };

    // Handle next step from role selection
    const handleRoleSelectionNext = () => {
        if (!selectedRole) {
            toast({ title: "Please select a role", variant: "destructive" });
            return;
        }
        setStep(2);
    };

    // Handle next step from basic info
    const handleBasicInfoNext = () => {
        if (!selectedRole) {
            toast({ title: "Missing Role", description: "Please select an account type.", variant: "destructive" });
            return;
        }

        if (password.length < 6) {
            toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" });
            return;
        }

        // Student-specific validation
        if (selectedRole === 'student') {
            if (!firstName || !lastName || !phoneNumber || !faculty || !department) {
                toast({ title: "Missing Fields", description: "Please fill in all required details for student signup.", variant: "destructive" });
                return;
            }

            if (!isValidPhoneNumber(phoneNumber)) {
                toast({ title: "Invalid Phone Number", description: "Please enter a valid Ghana phone number.", variant: "destructive" });
                return;
            }

            setStep(3);
            handleSendOTP();
            return;
        }

        // Agent validation (uses phone + OTP, no email field shown)
        if (selectedRole === 'agent') {
            if (!fullName) {
                toast({ title: "Missing Fields", description: "Please enter your full name.", variant: "destructive" });
                return;
            }

            if (!phoneNumber) {
                toast({ title: "Phone Number Required", description: "Please enter your phone number.", variant: "destructive" });
                return;
            }
            if (!isValidPhoneNumber(phoneNumber)) {
                toast({ title: "Invalid Phone Number", description: "Please enter a valid Ghana phone number.", variant: "destructive" });
                return;
            }

            setStep(3);
            handleSendOTP();
            return;
        }

        // Hostel managers: full name + phone + OTP (same pattern as agents, no email field)
        if (selectedRole === 'hostel_manager') {
            if (!fullName) {
                toast({ title: "Missing Fields", description: "Please enter your full name.", variant: "destructive" });
                return;
            }

            if (!phoneNumber) {
                toast({ title: "Phone Number Required", description: "Please enter your phone number.", variant: "destructive" });
                return;
            }
            if (!isValidPhoneNumber(phoneNumber)) {
                toast({ title: "Invalid Phone Number", description: "Please enter a valid Ghana phone number.", variant: "destructive" });
                return;
            }

            setStep(3);
            handleSendOTP();
        }
    };

    // Send OTP to agent's phone
    const handleSendOTP = async () => {
        if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
            toast({ title: "Invalid Phone Number", description: "Please enter a valid phone number.", variant: "destructive" });
            return;
        }

        setIsSendingOTP(true);
        try {
            const fullPhone = countryCode + phoneNumber.replace(/\D/g, '');
            const response = await fetch('/api/sms/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: fullPhone }),
            });

            const data = await response.json();

            if (data.success) {
                setOtpSent(true);
                setResendCooldown(60); // 60 second cooldown
                toast({ title: "OTP Sent", description: "Please check your phone for the verification code." });
                
                // Start cooldown timer
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
                // Show detailed error message
                const errorMessage = data.error || "Failed to send OTP. Please try again.";
                const hint = data.hint ? `\n\nHint: ${data.hint}` : '';
                toast({ 
                    title: "Failed to Send OTP", 
                    description: errorMessage + hint, 
                    variant: "destructive" 
                });
            }
        } catch (error: any) {
            console.error("Error sending OTP:", error);
            toast({ 
                title: "Network Error", 
                description: "Failed to connect to the server. Please check your internet connection and try again.", 
                variant: "destructive" 
            });
        } finally {
            setIsSendingOTP(false);
        }
    };

    // Verify OTP
    const handleVerifyOTP = async () => {
        if (!otp || otp.length !== 6) {
            toast({ title: "Invalid OTP", description: "Please enter a 6-digit OTP.", variant: "destructive" });
            return;
        }

        setIsVerifyingOTP(true);
        try {
            const fullPhone = countryCode + phoneNumber.replace(/\D/g, '');
            const response = await fetch('/api/sms/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: fullPhone, otp }),
            });

            const data = await response.json();

            if (data.success) {
                setOtpVerified(true);
                toast({ title: "OTP Verified", description: "Phone number verified successfully!" });

                // MANDATORY: Go to biometric capture step for ALL users
                setStep(4);
                setIsBiometricCaptureOpen(true);
            } else {
                toast({ title: "Invalid OTP", description: data.error || "Please check your OTP and try again.", variant: "destructive" });
            }
        } catch (error: any) {
            console.error("Error verifying OTP:", error);
            toast({ title: "Error", description: "Failed to verify OTP. Please try again.", variant: "destructive" });
        } finally {
            setIsVerifyingOTP(false);
        }
    };

    // Handle biometric capture (MANDATORY - Primary method)
    const handleBiometricCapture = async (credential: any) => {
        setIsProcessingBiometric(true);
        
        try {
            setBiometricCredential(credential);
            setIsBiometricCaptureOpen(false);
            
            toast({
                title: '✅ Biometric Setup Complete!',
                description: 'Your biometric authentication has been registered successfully.',
            });

            // For managers, proceed to hostel selection
            if (selectedRole === 'hostel_manager') {
                setIsProcessingBiometric(false);
                setStep(5);
                loadManagerHostels();
            } else {
                // For students/agents, biometric setup is the final step - proceed to complete signup
                console.log('Biometric setup complete for', selectedRole, '- proceeding to signup');
                // Don't set isProcessingBiometric(false) here - let handleSignup manage the loading state
                await handleSignup(credential);
            }
        } catch (error: any) {
            console.error('Biometric processing error:', error);
            toast({
                title: '❌ Biometric Setup Failed',
                description: error.message || 'Please try again.',
                variant: 'destructive'
            });
            setIsProcessingBiometric(false);
            setIsBiometricCaptureOpen(true); // Reopen to try again
        }
    };

    // Handle face capture (MANDATORY - Fallback method)
    const handleFaceCapture = async (capturedImageBase64: string) => {
        setIsProcessingBiometric(true);
        
        try {
            // Create image element from base64 for face detection
            const img = document.createElement('img');
            img.src = capturedImageBase64;
            
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Failed to load image'));
            });
            
            // Extract face descriptor from captured image
            const descriptor = await detectFaceDescriptor(img);
            
            if (!descriptor) {
                toast({
                    title: 'No Face Detected',
                    description: 'Please ensure your face is clearly visible and try again.',
                    variant: 'destructive'
                });
                setIsProcessingBiometric(false);
                setIsFaceCaptureOpen(true); // Reopen to try again
                return;
            }

            // Convert descriptor to array for storage
            const descriptorArray = descriptorToArray(descriptor);
            setFaceDescriptor(descriptorArray);

            toast({
                title: '✅ Face Captured!',
                description: 'Your face has been registered successfully.',
            });

            setIsProcessingBiometric(false);

            // For managers, go to hostel selection; others complete signup
            if (selectedRole === 'hostel_manager') {
                setStep(5);
                await loadManagerHostels();
            } else {
                await handleSignup(undefined, descriptorArray);
            }
        } catch (error: any) {
            console.error('Face capture error:', error);
            toast({
                title: 'Face Capture Failed',
                description: error.message || 'Could not capture face. Please try again.',
                variant: 'destructive'
            });
            setIsProcessingBiometric(false);
            setIsFaceCaptureOpen(true); // Reopen to try again
        }
    };

    // Handle final signup
    const handleSignup = async (passedBiometricCredential?: any, passedFaceDescriptor?: number[]) => {
        console.log('🚀 handleSignup called for role:', selectedRole);
        
        // Use passed credentials or state credentials
        const currentBiometricCredential = passedBiometricCredential || biometricCredential;
        const currentFaceDescriptor = passedFaceDescriptor || faceDescriptor;
        
        console.log('🔍 Debug state - otpVerified:', otpVerified, 'biometricCredential:', !!currentBiometricCredential, 'faceDescriptor:', !!currentFaceDescriptor);
        
        if (!selectedRole) {
            toast({ title: "Error", description: "Please select a role.", variant: "destructive" });
            return;
        }

        if ((selectedRole === 'agent' || selectedRole === 'student' || selectedRole === 'hostel_manager') && !otpVerified) {
            console.log('❌ OTP verification failed - otpVerified is:', otpVerified);
            toast({ title: "OTP Required", description: "Please verify your phone number first.", variant: "destructive" });
            return;
        }

        // MANDATORY: Biometric or face verification must be completed
        if (!currentBiometricCredential && !currentFaceDescriptor) {
            toast({ title: "Security Verification Required", description: "Please complete biometric or face verification to continue.", variant: "destructive" });
            setStep(4);
            setIsBiometricCaptureOpen(true);
            return;
        }

        // Managers must choose a hostel on Step 5 before completing signup
        if (selectedRole === 'hostel_manager' && !selectedManagerHostelId) {
            toast({ title: "Select Hostel", description: "Please choose the hostel you manage before finishing signup.", variant: "destructive" });
            setStep(5);
            return;
        }
        
        console.log('✅ All validations passed, starting signup process...');
        setIsSubmitting(true);
        try {
            console.log('📧 Building auth email for role:', selectedRole);
            let authEmail = email;

            // Build synthetic auth emails so users can log in with role-based IDs (deterministic)
            if (selectedRole === 'student') {
                // Students: STU-XXXNNN based on firstName + phone
                const cleanedNumber = phoneNumber.replace(/\D/g, '');
                const countryCodeDigits = countryCode.replace(/\D/g, '');
                const combinedPhone = countryCodeDigits + cleanedNumber;

                const firstThree = firstName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
                const lastThree = combinedPhone.slice(-3);
                const studentId = `STU-${firstThree}${lastThree}`;

                // Students will log in using this unique ID email, e.g. std-ell205@hostelhq.com
                authEmail = `${studentId.toLowerCase()}@hostelhq.com`;
            } else if (selectedRole === 'agent') {
                // Agents: AGNT-XXXNNN based on first word of fullName + phone
                const namePart = (fullName || '').trim().split(/\s+/)[0] || 'AGENT';
                const cleanedNumber = phoneNumber.replace(/\D/g, '');
                const countryCodeDigits = countryCode.replace(/\D/g, '');
                const combinedPhone = countryCodeDigits + cleanedNumber;
                const firstThree = namePart.replace(/\s+/g, '').slice(0, 3).toUpperCase();
                const lastThree = combinedPhone.slice(-3);
                const agentId = `AGNT-${firstThree}${lastThree}`;

                authEmail = `${agentId.toLowerCase()}@hostelhq.com`;
            } else if (selectedRole === 'hostel_manager') {
                // Managers: MNG-XXXNNN based on first word of fullName + phone last 3 (deterministic)
                const namePart = (fullName || '').trim().split(/\s+/)[0] || 'MGR';
                const cleanedNumber = phoneNumber.replace(/\D/g, '');
                const countryCodeDigits = countryCode.replace(/\D/g, '');
                const combinedPhone = countryCodeDigits + cleanedNumber;
                const firstThree = namePart.replace(/\s+/g, '').slice(0, 3).toUpperCase();
                const lastThree = combinedPhone.slice(-3);
                const managerId = `MNG-${firstThree}${lastThree}`;

                authEmail = `${managerId.toLowerCase()}@hostelhq.com`;
            }

            // Derive a local full name string for storage
            const derivedStudentFullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
            const localFullName = selectedRole === 'student' ? derivedStudentFullName : fullName;

            console.log('🔐 Creating user with email:', authEmail);
            const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
            const user = userCredential.user;
            console.log('✅ User created successfully:', user.uid);

            let userData: any = {
                uid: user.uid,
                email: authEmail,
                role: selectedRole,
                createdAt: new Date().toISOString(),
                // Store biometric data (preferred) or face data (fallback)
                ...(currentBiometricCredential && {
                    biometricCredential: currentBiometricCredential,
                    biometricSetupDate: new Date().toISOString(),
                    hasBiometric: true,
                }),
                ...(currentFaceDescriptor && {
                    faceDescriptor: currentFaceDescriptor,
                    faceSetupDate: new Date().toISOString(),
                }),
            };

            if (localFullName) {
                userData.fullName = localFullName;
            }
            if (firstName) {
                userData.firstName = firstName;
            }
            if (middleName) {
                userData.middleName = middleName;
            }
            if (lastName) {
                userData.lastName = lastName;
            }

            // Add phone number for agents, students, and managers (store in numeric E.164-like format)
            if ((selectedRole === 'agent' || selectedRole === 'student' || selectedRole === 'hostel_manager') && phoneNumber) {
                // Remove all non-digits
                let cleanedNumber = phoneNumber.replace(/\D/g, '');
                // Remove leading 0 if present (Ghana numbers start with 0)
                if (cleanedNumber.startsWith('0')) {
                    cleanedNumber = cleanedNumber.substring(1);
                }
                // Remove + from country code and combine
                const countryCodeDigits = countryCode.replace(/\D/g, '');
                const combined = countryCodeDigits + cleanedNumber;
                userData.phoneNumber = combined;

                if (selectedRole === 'student') {
                    const firstThree = firstName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
                    const lastThree = combined.slice(-3);
                    const studentId = `STU-${firstThree}${lastThree}`;
                    userData.studentId = studentId;
                    userData.faculty = faculty;
                    userData.department = department;
                    userData.authEmail = authEmail;
                }
            }

            // Store authEmail and role-based IDs for agents and managers
            if (selectedRole === 'agent') {
                userData.authEmail = authEmail;
                // Extract agent ID prefix from authEmail if possible (before @)
                const emailLocal = authEmail.split('@')[0];
                if (emailLocal.toUpperCase().startsWith('AGNT-')) {
                    userData.agentId = emailLocal.toUpperCase();
                }
            } else if (selectedRole === 'hostel_manager') {
                userData.authEmail = authEmail;
                const emailLocal = authEmail.split('@')[0];
                if (emailLocal.toUpperCase().startsWith('MNG-')) {
                    userData.managerId = emailLocal.toUpperCase();
                }
            }

            // (Optional) additional metadata for managers could be added here later

            // Create user document (no more pendingUsers for agents)
            console.log('💾 Saving user document to Firestore...');
            await setDoc(doc(db, "users", user.uid), userData);
            console.log('✅ User document saved successfully');

            // If this is a manager and they selected a hostel, assign that hostel to the new manager
            if (selectedRole === 'hostel_manager' && selectedManagerHostelId) {
                try {
                    await updateDoc(doc(db, 'hostels', selectedManagerHostelId), {
                        managerId: user.uid,
                    });
                } catch (assignError) {
                    console.error('Failed to assign hostel to manager during signup:', assignError);
                }
            }

            // After successful signup, send SMS with unique login ID email (best-effort, non-blocking)
            if (userData.phoneNumber) {
                try {
                    let messageRole = 'user';
                    if (selectedRole === 'student') messageRole = 'student';
                    else if (selectedRole === 'agent') messageRole = 'agent';
                    else if (selectedRole === 'hostel_manager') messageRole = 'manager';

                    const message = `Hello ${localFullName || messageRole}, this is your HostelHQ ${messageRole} login ID: ${authEmail}. Please use this ID to log into the app anytime and keep it safe. Thank you.`;

                    await fetch('/api/sms/send-notification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phoneNumber: userData.phoneNumber, message }),
                    });
                } catch (smsError) {
                    console.error('Failed to send login ID SMS:', smsError);
                }
            }

            toast({ title: 'Account Created Successfully!', description: 'Welcome to HostelHQ!' });

            // Redirect based on role
            console.log('🔄 Redirecting user based on role:', selectedRole);
            if (selectedRole === 'hostel_manager') {
                console.log('➡️ Redirecting to /manager/dashboard');
                router.push('/manager/dashboard');
            } else if (selectedRole === 'agent') {
                console.log('➡️ Redirecting to /agent/dashboard');
                router.push('/agent/dashboard');
            } else if (selectedRole === 'student') {
                console.log('➡️ Redirecting to /my-bookings');
                router.push('/my-bookings');
            } else {
                console.log('➡️ Redirecting to /');
                router.push('/');
            }

        } catch (error: any) {
            console.error("❌ Signup error:", error);
            console.error("Error code:", error.code);
            console.error("Error message:", error.message);
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
            console.log('🏁 Signup process completed, resetting loading states');
            setIsSubmitting(false);
            setIsProcessingBiometric(false);
        }
    };

    // Role selection cards
    const roleCards = [
        {
            role: 'student' as UserRole,
            icon: <GraduationCap className="h-8 w-8" />,
            title: 'Student',
            description: "I'm looking for a hostel to rent",
            color: 'text-blue-600',
        },
        {
            role: 'agent' as UserRole,
            icon: <UserCheck className="h-8 w-8" />,
            title: 'Agent',
            description: 'I want to list hostels and help students find rooms',
            color: 'text-green-600',
        },
        {
            role: 'hostel_manager' as UserRole,
            icon: <Building className="h-8 w-8" />,
            title: 'Hostel Manager',
            description: 'I manage hostel properties and oversee operations',
            color: 'text-purple-600',
        },
    ];

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="relative flex-1 bg-slate-900">
                <div className="absolute inset-0">
                    <Image
                        src="https://images.pexels.com/photos/3755761/pexels-photo-3755761.jpeg?auto=compress&cs=tinysrgb&w=2000"
                        alt="Students walking through a campus hostel corridor"
                        fill
                        priority
                        className="object-cover brightness-[0.55]"
                    />
                </div>

                <div className="relative flex h-full items-center justify-center py-10 px-4">
                    <Card className="w-full max-w-3xl border border-white/15 bg-white/10 text-slate-50 shadow-[0_18px_45px_rgba(15,23,42,0.7)] backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline text-slate-50">Create an Account</CardTitle>
                            <CardDescription className="text-slate-100/80">
                                {step === 1 && 'Choose your account type to get started'}
                                {step === 2 && 'Enter your account information'}
                                {step === 3 && (selectedRole === 'agent' || selectedRole === 'student' || selectedRole === 'hostel_manager') && 'Verify your phone number'}
                                {step === 4 && '🔒 Secure your account with biometric verification'}
                                {step === 5 && selectedRole === 'hostel_manager' && 'Select the hostel you manage'}
                            </CardDescription>
                            
                            {/* Progress Indicator */}
                            {step > 1 && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-100/60">
                                        <span>Step {step} of {selectedRole === 'hostel_manager' ? '5' : '4'}</span>
                                        <span>{Math.round((step / (selectedRole === 'hostel_manager' ? 5 : 4)) * 100)}% Complete</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
                                            style={{ width: `${(step / (selectedRole === 'hostel_manager' ? 5 : 4)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Step 1: Role Selection */}
                            {step === 1 && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {roleCards.map((card) => (
                                        <button
                                            key={card.role}
                                            onClick={() => handleRoleSelect(card.role)}
                                            className={cn(
                                                "p-6 border-2 rounded-lg text-left transition-all hover:shadow-md",
                                                selectedRole === card.role
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border hover:border-primary/50"
                                            )}
                                        >
                                            <div className={cn("mb-4", card.color)}>{card.icon}</div>
                                            <h3 className="font-semibold text-lg mb-2">{card.title}</h3>
                                            <p className="text-sm text-slate-100/80">{card.description}</p>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Step 4: Biometric Verification (MANDATORY) */}
                            {step === 4 && (
                                <div className="space-y-4">
                                    <Alert className="bg-blue-50/10 border-blue-500/50">
                                        <Info className="h-4 w-4" />
                                        <AlertTitle>🔒 Biometric Verification Required</AlertTitle>
                                        <AlertDescription className="text-slate-100/80">
                                            For maximum security, we require biometric verification during signup. Use your fingerprint, Face ID, or camera as fallback.
                                        </AlertDescription>
                                    </Alert>
                                    
                                    <div className="text-center space-y-4 py-6">
                                        {!biometricCredential && !faceDescriptor ? (
                                            <>
                                                <div className="text-6xl mb-4">🔐</div>
                                                <h3 className="text-xl font-semibold">Secure Your Account</h3>
                                                <p className="text-slate-100/80 max-w-md mx-auto">
                                                    Use your device's biometric sensor (fingerprint, Face ID) or camera to verify your identity.
                                                </p>
                                                <Button
                                                    onClick={() => setIsBiometricCaptureOpen(true)}
                                                    size="lg"
                                                    className="mt-4"
                                                    disabled={isProcessingBiometric}
                                                >
                                                    {isProcessingBiometric ? (
                                                        <>
                                                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                                            Processing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Fingerprint className="h-5 w-5 mr-2" />
                                                            Set Up Biometric Security
                                                        </>
                                                    )}
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-6xl mb-4">✅</div>
                                                <h3 className="text-xl font-semibold text-green-400">
                                                    {biometricCredential ? 'Biometric Setup Complete!' : 'Face Captured Successfully!'}
                                                </h3>
                                                <p className="text-slate-100/80">
                                                    {isSubmitting || isProcessingBiometric
                                                        ? 'Your identity verification has been completed. Proceeding to complete signup...'
                                                        : 'Your identity verification is complete.'}
                                                </p>
                                                {(isSubmitting || isProcessingBiometric) && (
                                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mt-4" />
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 5: Manager Hostel Selection */}
                            {step === 5 && selectedRole === 'hostel_manager' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="manager-hostel">Select Your Hostel</Label>
                                        <Select
                                            value={selectedManagerHostelId}
                                            onValueChange={setSelectedManagerHostelId}
                                            disabled={loadingManagerHostels}
                                        >
                                            <SelectTrigger id="manager-hostel" className="bg-white/90 text-slate-900">
                                                <SelectValue placeholder={loadingManagerHostels ? 'Loading hostels...' : 'Choose the hostel you manage'} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {managerHostels.map((h) => (
                                                    <SelectItem key={h.id} value={h.id}>
                                                        {h.name || 'Unnamed hostel'}{h.location ? ` – ${h.location}` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {!loadingManagerHostels && managerHostels.length === 0 && (
                                            <p className="text-xs text-red-300">
                                                No available hostels without a manager were found. You can request a new hostel later from your dashboard.
                                            </p>
                                        )}
                                        {selectedManagerHostelId && (
                                            <p className="text-xs text-muted-foreground">
                                                This hostel will be linked to your manager account.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Basic Info Form - Student */}
                            {step === 2 && selectedRole === 'student' && (
                                <div className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName">First Name</Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input
                                                    id="firstName"
                                                    placeholder="e.g., Elliot"
                                                    className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                    value={firstName}
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="middleName">Middle Name</Label>
                                            <Input
                                                id="middleName"
                                                placeholder="Optional"
                                                className="bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                value={middleName}
                                                onChange={(e) => setMiddleName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lastName">Last Name</Label>
                                            <Input
                                                id="lastName"
                                                placeholder="e.g., Entsiwah"
                                                className="bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="phone-student">Phone Number</Label>
                                        <div className="flex gap-2">
                                            <Select value={countryCode} onValueChange={setCountryCode}>
                                                <SelectTrigger className="w-24 bg-white/90 text-slate-900">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="+233">+233 (GH)</SelectItem>
                                                    <SelectItem value="+234">+234 (NG)</SelectItem>
                                                    <SelectItem value="+254">+254 (KE)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <div className="relative flex-1">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input
                                                    id="phone-student"
                                                    type="tel"
                                                    placeholder="0244123456"
                                                    className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                    value={phoneNumber}
                                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">We will send a verification code to this number.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password-student">Password</Label>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input
                                                id="password-student"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                className="pl-10 pr-10 bg-white/95 text-slate-900 placeholder:text-slate-500"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-900 transition-colors"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Faculty</Label>
                                            <Select
                                                value={faculty}
                                                onValueChange={(value) => {
                                                    setFaculty(value);
                                                    setDepartment('');
                                                }}
                                            >
                                                <SelectTrigger className="bg-white/90 text-slate-900">
                                                    <SelectValue placeholder="Select your faculty" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.keys(facultyDepartments).map((fac) => (
                                                        <SelectItem key={fac} value={fac}>
                                                            {fac}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Department</Label>
                                            <Select
                                                value={department}
                                                onValueChange={setDepartment}
                                                disabled={!faculty}
                                            >
                                                <SelectTrigger className="bg-white/90 text-slate-900">
                                                    <SelectValue placeholder={faculty ? 'Select your department' : 'Select a faculty first'} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(facultyDepartments[faculty] || []).map((dept) => (
                                                        <SelectItem key={dept} value={dept}>
                                                            {dept}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Basic Info Form - Agent / Manager (no email field) */}
                            {step === 2 && selectedRole !== 'student' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="fullname">Full Name</Label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input 
                                                id="fullname" 
                                                placeholder="e.g., Jane Doe" 
                                                className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500" 
                                                value={fullName} 
                                                onChange={(e) => setFullName(e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Password</Label>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input 
                                                id="password" 
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••" 
                                                className="pl-10 pr-10 bg-white/95 text-slate-900 placeholder:text-slate-500" 
                                                value={password} 
                                                onChange={(e) => setPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-900 transition-colors"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                                    </div>
                                    {(selectedRole === 'agent' || selectedRole === 'hostel_manager') && (
                                        <div className="space-y-2">
                                            <Label htmlFor="phone">Phone Number</Label>
                                            <div className="flex gap-2">
                                                <Select value={countryCode} onValueChange={setCountryCode}>
                                                    <SelectTrigger className="w-24 bg-white/90 text-slate-900">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="+233">+233 (GH)</SelectItem>
                                                        <SelectItem value="+234">+234 (NG)</SelectItem>
                                                        <SelectItem value="+254">+254 (KE)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <div className="relative flex-1">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                    <Input 
                                                        id="phone" 
                                                        type="tel" 
                                                        placeholder="0244123456" 
                                                        className="pl-10 bg-white/95 text-slate-900 placeholder:text-slate-500" 
                                                        value={phoneNumber} 
                                                        onChange={(e) => setPhoneNumber(e.target.value)} 
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground">We'll send a verification code to this number</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: OTP Verification (Students, Agents & Managers) */}
                        {step === 3 && (selectedRole === 'agent' || selectedRole === 'student' || selectedRole === 'hostel_manager') && (
                            <div className="space-y-4">
                                <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>Verify Your Phone Number</AlertTitle>
                                    <AlertDescription>
                                        {otpSent 
                                            ? "Enter the 6-digit code sent to your phone number."
                                            : "Click the button below to receive a verification code."}
                                    </AlertDescription>
                                </Alert>
                                {otpSent ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="otp">Verification Code</Label>
                                            <Input 
                                                id="otp" 
                                                type="text" 
                                                placeholder="000000" 
                                                maxLength={6}
                                                value={otp} 
                                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
                                                className="text-center text-2xl tracking-widest bg-white/95 text-slate-900 placeholder:text-slate-500"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={handleSendOTP}
                                                disabled={resendCooldown > 0 || isSendingOTP}
                                                className="flex-1"
                                            >
                                                {isSendingOTP ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    `Resend Code${resendCooldown > 0 ? ` (${resendCooldown}s)` : ''}`
                                                )}
                                            </Button>
                                            <Button
                                                onClick={handleVerifyOTP}
                                                disabled={otp.length !== 6 || isVerifyingOTP || otpVerified}
                                                className="flex-1"
                                            >
                                                {isVerifyingOTP ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Verifying...
                                                    </>
                                                ) : otpVerified ? (
                                                    'Verified ✓'
                                                ) : (
                                                    'Verify'
                                                )}
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <Button
                                        onClick={handleSendOTP}
                                        disabled={isSendingOTP}
                                        className="w-full"
                                    >
                                        {isSendingOTP ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            'Send Verification Code'
                                        )}
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Step 3: Terms Agreement (Manager) removed - managers now sign up without viewing the tenancy template here */}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        {/* Step 2: Basic Info - Back to Role Selection */}
                        {step === 2 && (
                            <div className="flex gap-2 w-full">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setStep(1)} 
                                    className="flex-1 border-white/40 bg-white/5 text-slate-50 hover:bg-white/15"
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                                <Button 
                                    onClick={handleBasicInfoNext} 
                                    className="flex-1" 
                                    disabled={isSubmitting}
                                >
                                    Next
                                </Button>
                            </div>
                        )}

                        {/* Step 3: OTP Verification - Back to Basic Info */}
                        {step === 3 && (
                            <div className="flex gap-2 w-full">
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        setStep(2);
                                        setOtp('');
                                        setOtpSent(false);
                                    }} 
                                    className="flex-1 border-white/40 bg-white/5 text-slate-50 hover:bg-white/15"
                                    disabled={isVerifyingOTP}
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                            </div>
                        )}

                        {/* Step 4: Face Capture - Back to OTP (but keep OTP verified) */}
                        {step === 4 && !faceDescriptor && (
                            <div className="flex gap-2 w-full">
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        setStep(3);
                                        setIsFaceCaptureOpen(false);
                                    }} 
                                    className="flex-1 border-white/40 bg-white/5 text-slate-50 hover:bg-white/15"
                                    disabled={isProcessingBiometric}
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                            </div>
                        )}

                        {/* Step 5: Manager Hostel Selection - Back to Face Capture */}
                        {step === 5 && selectedRole === 'hostel_manager' && (
                            <div className="flex gap-2 w-full">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setStep(4)} 
                                    className="flex-1 border-white/40 bg-white/5 text-slate-50 hover:bg-white/15"
                                    disabled={isSubmitting}
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                                <Button
                                    onClick={handleSignup}
                                    className="flex-1"
                                    disabled={isSubmitting || !selectedManagerHostelId}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Finishing Setup...
                                        </>
                                    ) : (
                                        'Finish Setup'
                                    )}
                                </Button>
                            </div>
                        )}
                        {/* Managers no longer have a separate Step 3; they complete signup directly after basic info. */}
                        {step !== 3 && (
                            <p className="text-sm text-slate-100/80 text-center">
                                Already have an account?{' '}
                                <Link href="/login" className="text-accent font-semibold hover:underline">
                                    Log In
                                </Link>
                            </p>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </main>

        {/* Biometric Capture Dialog (MANDATORY - Primary) */}
        <BiometricCaptureDialog
            open={isBiometricCaptureOpen}
            onOpenChange={(open) => {
                setIsBiometricCaptureOpen(open);
                // Reset loading state if dialog is closed without completing
                if (!open && !biometricCredential && !faceDescriptor) {
                    setIsProcessingBiometric(false);
                }
            }}
            onCapture={handleBiometricCapture}
            mode="register"
            userId={getUserId()}
            userName={fullName || firstName || email}
            title="🔐 Set Up Biometric Security"
            description="Use your fingerprint, Face ID, or camera to secure your account."
        />

        {/* Face Capture Dialog (Fallback) */}
        <FaceCaptureDialog
            open={isFaceCaptureOpen}
            onOpenChange={(open) => {
                setIsFaceCaptureOpen(open);
                // Reset loading state if dialog is closed without completing
                if (!open && !biometricCredential && !faceDescriptor) {
                    setIsProcessingBiometric(false);
                }
            }}
            onCapture={handleFaceCapture}
            title="📸 Capture Your Face"
            description="Position your face in the center and ensure good lighting. This is required for account security."
        />
    </div>
    );
}
