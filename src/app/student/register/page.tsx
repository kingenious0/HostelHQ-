"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentUploader } from "@/components/DocumentUploader";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { 
  User, Mail, Phone, Lock, Eye, EyeOff, GraduationCap, 
  ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2, Loader2, Sparkles
} from "lucide-react";

export const facultyDepartments: Record<string, string[]> = {
  'Faculty of Applied Sciences and Mathematics Education (FASME)': [
    'Information Technology Education',
    'Mathematics Education',
  ],
  'Faculty of Business Education (FBE)': [
    'Accounting Studies',
    'Management Studies',
  ],
  'Faculty of Technical Education (FTE)': [
    'Construction Technology and Management Education',
    'Wood Science and Technology Education',
    'Architecture and Civil Engineering',
    'Automotive & Mechanical Technology Education',
    'Electrical & Electronics Technology Education',
  ],
  'Faculty of Engineering and Technology (FET)': [
    'Mechanical & Automotive Engineering',
    'Electrical & Electronic Engineering',
    'Civil & Biomedical Engineering',
  ],
  'Faculty of Education and Communication Sciences (FECS)': [
    'Languages Education',
    'Interdisciplinary Studies',
  ],
  'Faculty of Vocational Education (FVE)': [
    'Catering & Hospitality Education',
    'Fashion & Textiles Design Education',
  ],
  'Institute of Entrepreneurial Development Education and Innovation (IEDEI)': [
    'Entrepreneurship & Innovation Education',
  ],
  'Institute for Competency-Based Training and Research (ICBTR)': [
    'Competency-Based Training and Research',
  ],
};

export const facultyPrograms: Record<string, string[]> = {
  'Faculty of Technical Education (FTE)': [
    'B.Sc. Construction Technology and Management with Education',
    'B.Sc. Wood Technology with Education',
    'B.Sc. Welding and Fabrication Engineering Technology with Education',
    'B.Sc. Plumbing and Gas Technology',
    'B.Ed. Applied Technology (Building Construction and Wood)',
    'B.Ed. Design and Communication Technology',
    '2-year Diploma in Construction Technology',
    '2-year Diploma in Architecture and Digital Construction',
    '2-year Diploma in Wood Technology',
    '2-year Diploma in Welding and Fabrication Technology',
  ],
  'Faculty of Engineering and Technology (FET)': [
    'B.Sc. Mechanical Engineering Technology Education',
    'B.Sc. Mechanical Engineering Technology',
    'B.Sc. Automotive Engineering Technology Education',
    'B.Sc. Electrical and Electronics Engineering with Education',
    'B.Sc. Electrical and Electronics Engineering',
    'B.Sc. Civil Engineering',
    'B.Sc. Biomedical Equipment Engineering',
    'B.Sc. Renewable Energy Engineering with Education',
    'B.Ed. Applied Technology (Electrical and Electronics)',
    'B.Ed. Applied Technology (Automotive and Mechanical)',
    'B.Ed. STEM (Engineering with Biomedical Science)',
    'B.Ed. STEM (Engineering with Manufacturing)',
    'B.Ed. STEM (Engineering with Robotics)',
    '2-year Diploma in Automotive Technology',
    '2-year Diploma in Mechanical Technology',
  ],
  'Faculty of Vocational Education (FVE)': [
    'B.Sc. Fashion Design and Textiles Education',
    'B.Sc. Catering and Hospitality Education',
    'B.Ed. Art and Design Technology',
    'B.Ed. Home Economics (Clothing and Textiles)',
    'B.Ed. Home Economics (Food and Nutrition)',
    '2-year Diploma in Fashion Design and Textiles',
    '2-year Diploma in Catering and Hospitality',
  ],
  'Faculty of Applied Sciences and Mathematics Education (FASME)': [
    'B.Sc. Information Technology',
    'B.Sc. Cyber Security and Digital Forensics',
    'B.Sc. Statistical Computing',
    'B.Sc. Mathematics',
    'B.Ed. Computing with Artificial Intelligence (AI)',
    'B.Ed. Computing with Internet of Things (IOT)',
    'B.Ed. Information Technology',
    'B.Ed. Mathematics',
    '2-year Diploma in Cyber Security and Digital Forensics',
    '2-year Diploma in Information Technology',
  ],
  'Faculty of Education and Communication Sciences (FECS)': [
    'B.Ed. English',
    'B.Ed. French',
    'B.Ed. Arabic',
    'B.Ed. Social Studies',
    'B.Ed. Geography',
    'B.Ed. Ghanaian Language (Asante Twi)',
    'B.Ed. Early Grade',
    'B.Ed. Upper Primary',
    'B.Ed. Physical Education and Health',
    'Postgraduate Diploma in Education',
  ],
  'Faculty of Business Education (FBE)': [
    'B.Sc. Accounting',
    'B.Sc. Procurement and Supply Chain Management',
    'B.Sc. Banking and Finance',
    'B.Sc. Business Information Systems',
    'B.Sc. Marketing',
    'B.Sc. Economics with Social Studies',
    'B.B.A. Management',
    'B.Ed. Business Studies (Accounting)',
    'B.Ed. Business Studies (Management)',
    'B.Ed. Economics',
  ],
  'Institute of Entrepreneurial Development Education and Innovation (IEDEI)': [
    'B.Sc. Entrepreneurship Education',
    'B.Sc. Marketing and Entrepreneurship',
  ],
  'Institute for Competency-Based Training and Research (ICBTR)': [
    'Diploma in Education, Competency-Based Training (CBT)',
  ],
};

export default function StudentRegisterPage() {
  const router = useRouter();
  const { toast } = useToast();

  // 3-Step Wizard: 1 = Basic Identity & Contact, 2 = Academic Profile & Student Status, 3 = Account Security & Terms
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Basic Identity & Contact
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+233");

  // Step 2: Academic Profile & Student Status
  const [isFresher, setIsFresher] = useState(false);
  const [faculty, setFaculty] = useState("");
  const [departmentOrProgram, setDepartmentOrProgram] = useState("");
  const [studentIdNumber, setStudentIdNumber] = useState("");
  const [documentType, setDocumentType] = useState<"student_id" | "admission_letter">("student_id");
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string>("");

  // Step 3: Account Security & Terms
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);

  // Verification & Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [verificationResult, setVerificationResult] = useState<{
    completed: boolean;
    status: "verified" | "pending";
    autoApproved: boolean;
    message: string;
  } | null>(null);

  // Auto-Focus Refs
  const fullNameRef = useRef<HTMLInputElement>(null);
  const studentIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) {
      setTimeout(() => fullNameRef.current?.focus(), 80);
    } else if (step === 2) {
      setTimeout(() => studentIdRef.current?.focus(), 80);
    } else if (step === 3) {
      setTimeout(() => passwordRef.current?.focus(), 80);
    }
  }, [step]);

  const getFormattedPhone = () => {
    let cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    return countryCode.replace(/\D/g, "") + cleaned;
  };

  // Check email on blur proactively
  const handleEmailBlur = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    try {
      const res = await fetch("/api/auth/check-exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.exists && data.field === "email") {
        setEmailError(data.message);
      } else {
        setEmailError("");
      }
    } catch (_) {}
  };

  // Step 1 Validation -> Step 2
  const handleProceedToAcademic = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");

    if (!fullName.trim()) {
      toast({ title: "Full Name Required", description: "Please enter your full legal name.", variant: "destructive" });
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      toast({ title: "Invalid Phone Number", description: "Please enter a valid Ghana phone number (9-10 digits).", variant: "destructive" });
      return;
    }

    // Proactive background verification check for duplicate email/phone before advancing
    setIsCheckingAccount(true);
    try {
      const checkRes = await fetch("/api/auth/check-exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          phoneNumber: getFormattedPhone(),
        }),
      });
      const checkData = await checkRes.json();
      if (checkData.exists) {
        if (checkData.field === "email") {
          setEmailError(checkData.message);
        }
        toast({
          title: "Account Already Exists",
          description: checkData.message,
          variant: "destructive",
        });
        setIsCheckingAccount(false);
        return;
      }
    } catch (checkErr) {
      console.warn("[Register] Background pre-check note:", checkErr);
    } finally {
      setIsCheckingAccount(false);
    }

    setStep(2);
  };

  // Step 2 Validation -> Step 3
  const handleProceedToSecurity = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanId = studentIdNumber.trim();
    if (!cleanId) {
      toast({
        title: isFresher ? "Applicant Number Required" : "Student Index Number Required",
        description: isFresher
          ? "Please enter your Applicant Number found on your admission letter."
          : "Please enter your official 9–11 digit Student Index Number.",
        variant: "destructive",
      });
      return;
    }

    // Format validation: Continuing 9-11 digits, Fresher 7-12 chars
    if (isFresher) {
      const fresherRegex = /^[a-zA-Z0-9\-_]{7,12}$/;
      if (!fresherRegex.test(cleanId)) {
        toast({
          title: "Invalid Applicant Number",
          description: "Applicant voucher/serial number must be 7 to 12 characters (e.g. App-2026-042 or 10102596).",
          variant: "destructive",
        });
        return;
      }
    } else {
      const continuingRegex = /^\d{9,11}$/;
      if (!continuingRegex.test(cleanId)) {
        toast({
          title: "Invalid Student Index Number",
          description: "USTED continuing student index number must be 9 to 11 digits (e.g. 5230100452).",
          variant: "destructive",
        });
        return;
      }
    }

    if (!faculty) {
      toast({ title: "Faculty Required", description: "Please select your academic faculty.", variant: "destructive" });
      return;
    }

    if (!departmentOrProgram) {
      toast({
        title: isFresher ? "Program of Study Required" : "Department Required",
        description: `Please select your ${isFresher ? "Program of Study" : "Department"}.`,
        variant: "destructive",
      });
      return;
    }

    if (!uploadedDocUrl) {
      toast({
        title: "Document Required",
        description: `Please attach your ${isFresher ? "Admission Letter" : "Student ID Card"} before proceeding.`,
        variant: "destructive",
      });
      return;
    }

    // Check if student ID is already registered
    try {
      const idCheckRes = await fetch("/api/auth/check-exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIdNumber: cleanId }),
      });
      const idCheckData = await idCheckRes.json();
      if (idCheckData.exists && idCheckData.field === "studentIdNumber") {
        toast({
          title: "Student ID Already Registered",
          description: idCheckData.message,
          variant: "destructive",
        });
        return;
      }
    } catch (_) {}

    setStep(3);
  };

  // Step 3 Submission & Automated Rule Engine Verification
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (!termsAccepted) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms of service and privacy policy to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const formattedPhone = getFormattedPhone();

    try {
      // 1. Create Firebase Auth Account
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2. Initial User Record
      const initialUserDoc = {
        uid: user.uid,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: formattedPhone,
        phone: formattedPhone,
        role: "student",
        verificationStatus: "pending",
        isVerified: false,
        isFresher,
        faculty,
        department: !isFresher ? departmentOrProgram : "",
        programOfStudy: isFresher ? departmentOrProgram : "",
        studentIndexNumber: studentIdNumber.trim(),
        studentId: studentIdNumber.trim(),
        verificationDocUrl: uploadedDocUrl,
        verificationDocType: documentType,
        createdAt: new Date().toISOString(),
        institution: "University of Skills Training and Entrepreneurial Development (USTED)",
      };

      await setDoc(doc(db, "users", user.uid), initialUserDoc, { merge: true });

      // 3. Trigger Automated Student Verification Engine API
      const verifyRes = await fetch("/api/verify-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phoneNumber: formattedPhone,
          studentIdNumber: studentIdNumber.trim(),
          isFresher,
          faculty,
          departmentOrProgram,
          documentUrl: uploadedDocUrl,
          documentType,
        }),
      });

      const verifyData = await verifyRes.json();

      if (verifyRes.ok && verifyData.success && verifyData.status === "verified") {
        setVerificationResult({
          completed: true,
          status: "verified",
          autoApproved: true,
          message: "Your USTED student status has been verified. Your account is active for booking.",
        });
        toast({
          title: "Account Verified",
          description: "Your student credentials are confirmed. You can now book university-approved hostels.",
        });
      } else {
        setVerificationResult({
          completed: true,
          status: "pending",
          autoApproved: false,
          message: "Your documents have been submitted for verification. You will receive an SMS confirmation once approved.",
        });
        toast({
          title: "Registration Received",
          description: "Your account credentials have been submitted for institutional verification.",
        });
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      let errMsg = err.message || "Failed to create account. Please try again.";
      if (err.code === "auth/email-already-in-use") {
        errMsg = "This email is already registered. Please sign in instead.";
      }
      toast({
        title: "Registration Failed",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentAvailableOptions = isFresher
    ? (faculty ? facultyPrograms[faculty] || [] : [])
    : (faculty ? facultyDepartments[faculty] || [] : []);

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Header />

      <main className="flex-1 flex flex-col justify-center items-center py-6 px-3 sm:px-6">
        <div className="w-full max-w-lg space-y-4">
          {/* Institutional Header with USTED Crest */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6B1D2F]/10 border border-[#6B1D2F]/20 text-[#6B1D2F] dark:text-rose-300 text-xs font-semibold">
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
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Student Housing Onboarding
            </h1>
            <p className="text-xs text-muted-foreground">
              Official university portal for verified student accommodation & rent-cap protection.
            </p>
          </div>

          {/* Minimal 3-Step Progress Stepper Bar */}
          {!verificationResult && (
            <div className="space-y-2 mb-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-1">
                <span className={step === 1 ? "text-[#6B1D2F] dark:text-rose-400 font-extrabold" : step > 1 ? "text-emerald-600 font-semibold" : ""}>
                  1. Contact
                </span>
                <span className={step === 2 ? "text-[#6B1D2F] dark:text-rose-400 font-extrabold" : step > 2 ? "text-emerald-600 font-semibold" : ""}>
                  2. Academic & Document
                </span>
                <span className={step === 3 ? "text-[#6B1D2F] dark:text-rose-400 font-extrabold" : ""}>
                  3. Security & Terms
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mb-4">
                {[1, 2, 3].map((s) => (
                  <div 
                    key={s} 
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                      s <= step ? "bg-[#6B1D2F]" : "bg-gray-700/40"
                    }`} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* Wizard Card Body */}
          <Card className="border border-border/80 shadow-md rounded-3xl overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              {/* SUCCESS CONFIRMATION STATE */}
              {verificationResult ? (
                <div className="text-center py-6 space-y-4">
                  <div className="h-16 w-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-foreground">
                      {verificationResult.autoApproved ? "Account Verified" : "Submission Received"}
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      {verificationResult.message}
                    </p>
                  </div>

                  <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60 text-xs space-y-1 text-left">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Student Name:</span>
                      <span className="font-semibold">{fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isFresher ? "Applicant Number:" : "Index Number:"}</span>
                      <span className="font-mono font-semibold">{studentIdNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-bold text-emerald-600 capitalize">{verificationResult.status}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <Button
                      onClick={() => router.push("/student/hostels")}
                      className="w-full h-11 text-xs font-bold rounded-xl bg-[#6B1D2F] hover:bg-[#6B1D2F]/90 text-white shadow-sm"
                    >
                      <span>Explore Verified Hostels</span>
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push("/login")}
                      className="w-full h-10 text-xs rounded-xl"
                    >
                      Go to Student Login
                    </Button>
                  </div>
                </div>
              ) : step === 1 ? (
                /* STEP 1: BASIC IDENTITY & CONTACT */
                <form onSubmit={handleProceedToAcademic} className="space-y-3.5">
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-foreground">Basic Identity & Contact</h2>
                    <p className="text-xs text-muted-foreground">Enter your contact details to begin registration.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Full Legal Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={fullNameRef}
                        type="text"
                        placeholder="e.g. Kwame Mensah Boateng"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-9 h-10 text-xs rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="e.g. student@usted.edu.gh or personal@gmail.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (emailError) setEmailError("");
                        }}
                        onBlur={handleEmailBlur}
                        className={`pl-9 h-10 text-xs rounded-xl ${emailError ? "border-rose-500 focus-visible:ring-rose-500 bg-rose-50/20" : ""}`}
                        required
                      />
                    </div>
                    {emailError && (
                      <div className="flex items-center justify-between text-[11px] text-rose-600 font-semibold pt-0.5 px-1">
                        <span>{emailError}</span>
                        <Link href="/login" className="underline font-bold text-rose-700 hover:text-rose-800 ml-2">
                          Sign In
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Phone Number (+233 GH) *</Label>
                    <div className="flex gap-2">
                      <span className="inline-flex items-center px-3 rounded-xl border border-input bg-muted/50 text-xs font-mono font-medium">
                        +233
                      </span>
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="tel"
                          placeholder="e.g. 0542709440"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="pl-9 h-10 text-xs font-mono rounded-xl"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isCheckingAccount}
                      className="w-full h-11 text-xs font-bold rounded-xl bg-[#6B1D2F] hover:bg-[#6B1D2F]/90 text-white shadow-sm flex items-center justify-center gap-1.5"
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
                  </div>

                  <div className="text-center pt-2">
                    <span className="text-xs text-muted-foreground">Already have an account? </span>
                    <Link href="/login" className="text-xs font-bold text-[#6B1D2F] hover:underline">
                      Log In
                    </Link>
                  </div>
                </form>
              ) : step === 2 ? (
                /* STEP 2: ACADEMIC PROFILE & STUDENT STATUS */
                <form onSubmit={handleProceedToSecurity} className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h2 className="text-base font-bold text-foreground">Academic Profile</h2>
                      <p className="text-xs text-muted-foreground">Specify your USTED status and attach proof.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back
                    </button>
                  </div>

                  {/* Dual-Pill Student Status Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Student Status *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsFresher(false);
                          setDepartmentOrProgram("");
                          setDocumentType("student_id");
                        }}
                        className={cn(
                          "h-11 px-3 rounded-xl border text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5",
                          !isFresher
                            ? "bg-[#6B1D2F] text-white border-[#6B1D2F] shadow-sm ring-2 ring-[#6B1D2F]/20"
                            : "bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted/70"
                        )}
                      >
                        <span>🎓</span>
                        <span>Continuing Student</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFresher(true);
                          setDepartmentOrProgram("");
                          setDocumentType("admission_letter");
                        }}
                        className={cn(
                          "h-11 px-3 rounded-xl border text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5",
                          isFresher
                            ? "bg-[#6B1D2F] text-white border-[#6B1D2F] shadow-sm ring-2 ring-[#6B1D2F]/20"
                            : "bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted/70"
                        )}
                      >
                        <span>🎒</span>
                        <span>Fresher / Newly Admitted</span>
                      </button>
                    </div>
                  </div>

                  {/* Identifier Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">
                        {isFresher ? "Applicant Number *" : "Student Index Number *"}
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        {isFresher ? "Found on your Admission Letter" : "9–11 Digits"}
                      </span>
                    </div>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={studentIdRef}
                        type="text"
                        placeholder={isFresher ? "e.g. 10102596 or App-2026-042" : "e.g. 5230100452"}
                        value={studentIdNumber}
                        onChange={(e) => setStudentIdNumber(e.target.value)}
                        className="pl-9 h-10 text-xs font-mono rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  {/* Dropdown 1: Faculty */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Faculty *</Label>
                    <Select
                      value={faculty}
                      onValueChange={(val) => {
                        setFaculty(val);
                        setDepartmentOrProgram("");
                      }}
                    >
                      <SelectTrigger className="h-10 text-xs rounded-xl">
                        <SelectValue placeholder="Select faculty" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(facultyDepartments).map((fac) => (
                          <SelectItem key={fac} value={fac} className="text-xs">
                            {fac}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dropdown 2: Dynamic Department vs Program */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {isFresher ? "Program of Study *" : "Academic Department *"}
                    </Label>
                    <Select
                      value={departmentOrProgram}
                      onValueChange={setDepartmentOrProgram}
                      disabled={!faculty}
                    >
                      <SelectTrigger className="h-10 text-xs rounded-xl">
                        <SelectValue
                          placeholder={
                            !faculty
                              ? "Select a faculty first"
                              : isFresher
                              ? "Select program of study"
                              : "Select department"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {currentAvailableOptions.map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-xs">
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Document Upload */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground">
                        {isFresher ? "Admission Letter Document *" : "Student ID Card Document *"}
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        {isFresher ? "PDF or photo" : "Front of ID card"}
                      </span>
                    </div>
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
                          title: "Upload Notice",
                          description: err,
                          variant: "destructive",
                        });
                      }}
                    />
                  </div>

                  {/* Navigation Buttons */}
                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="h-11 px-4 text-xs font-semibold rounded-xl"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 h-11 text-xs font-bold rounded-xl bg-[#6B1D2F] hover:bg-[#6B1D2F]/90 text-white shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span>Continue to Security & Verification</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              ) : (
                /* STEP 3: ACCOUNT SECURITY & TERMS */
                <form onSubmit={handleFinalSubmit} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h2 className="text-base font-bold text-foreground">Account Security</h2>
                      <p className="text-xs text-muted-foreground">Set your account password to complete registration.</p>
                    </div>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setStep(2)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={passwordRef}
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 pr-9 h-10 text-xs rounded-xl"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Use at least 6 characters.
                    </p>
                  </div>

                  {/* Summary of Student Account */}
                  <div className="p-3 bg-muted/40 rounded-2xl border border-border/70 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-semibold">{fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-semibold">{isFresher ? "Fresher / Newly Admitted" : "Continuing Student"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isFresher ? "Applicant No:" : "Index No:"}</span>
                      <span className="font-mono font-semibold">{studentIdNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Document:</span>
                      <span className="text-emerald-600 font-semibold">Attached</span>
                    </div>
                  </div>

                  {/* Terms & Conditions Checkbox */}
                  <div className="flex items-start space-x-2 pt-1">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="terms" className="text-xs text-muted-foreground leading-snug cursor-pointer">
                      I accept the{" "}
                      <Link href="/terms" className="text-[#6B1D2F] font-semibold hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-[#6B1D2F] font-semibold hover:underline">
                        Privacy Policy
                      </Link>
                      .
                    </label>
                  </div>

                  {/* Action Controls */}
                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={() => setStep(2)}
                      className="h-11 px-4 text-xs font-semibold rounded-xl"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || !termsAccepted}
                      className="flex-1 h-11 text-xs font-bold rounded-xl bg-[#6B1D2F] hover:bg-[#6B1D2F]/90 text-white shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Completing Registration...</span>
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
