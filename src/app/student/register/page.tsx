"use client";

import React, { useState } from "react";
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

  // 3-Step Wizard: 1 = Credentials, 2 = Academic Profile, 3 = Document Attachment
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Account Credentials
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+233");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Academic Profile
  const [isFresher, setIsFresher] = useState(false);
  const [faculty, setFaculty] = useState("");
  const [departmentOrProgram, setDepartmentOrProgram] = useState("");
  const [studentIdNumber, setStudentIdNumber] = useState("");

  // Step 3: Fast Document Attachment
  const [documentType, setDocumentType] = useState<"student_id" | "admission_letter">("student_id");
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [verificationResult, setVerificationResult] = useState<{
    completed: boolean;
    status: "verified" | "pending";
    autoApproved: boolean;
    message: string;
  } | null>(null);

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

  // Step 1 Validation -> Step 2 (Checks existence before advancing)
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
    if (password.length < 6) {
      toast({ title: "Password Too Short", description: "Password must be at least 6 characters.", variant: "destructive" });
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
  const handleProceedToVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faculty) {
      toast({ title: "Faculty Required", description: "Please select your academic faculty.", variant: "destructive" });
      return;
    }
    if (!departmentOrProgram) {
      toast({
        title: isFresher ? "Program of Study Required" : "Department Required",
        description: `Please select your ${isFresher ? "program of study" : "department"}.`,
        variant: "destructive",
      });
      return;
    }

    const cleanId = studentIdNumber.trim();
    if (!cleanId) {
      toast({
        title: "Student Number Required",
        description: `Please enter your ${isFresher ? "Applicant Serial/Voucher Number" : "Student Index Number"}.`,
        variant: "destructive",
      });
      return;
    }

    // Validation rules:
    // Continuing Students (Index Number): pure numeric, length 9 to 11 digits
    // Freshers (Applicant Number): alphanumeric, length 7 to 12 characters
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

    // Default document type matching student category
    setDocumentType(isFresher ? "admission_letter" : "student_id");
    setStep(3);
  };

  // Step 3 Submission & Automated Rule Engine Verification
  const handleFinalSubmit = async () => {
    if (!uploadedDocUrl) {
      toast({
        title: "Document Required",
        description: `Please attach your ${documentType === "student_id" ? "Student ID Card" : "Admission Letter"} to verify your student account.`,
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

      // 2. Initial User Record set to 'pending' state
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
        department: departmentOrProgram,
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
          message: "Your USTED student status has been successfully verified! Your account is active and you have instant booking privileges.",
        });
        toast({
          title: "Account Verified! 🎓",
          description: "Welcome to HostelHQ! You can now browse and book university-approved rooms.",
        });
      } else {
        setVerificationResult({
          completed: true,
          status: "pending",
          autoApproved: false,
          message: "Your submission has been received and forwarded to the Dean of Students office for expedited review.",
        });
        toast({
          title: "Registration Received ⏳",
          description: "Your account is under Dean of Students inspection. You will receive an SMS confirmation once verified.",
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

      <main className="flex-1 flex flex-col justify-center items-center py-6 px-4 sm:px-6">
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

          {/* 3-Step Wizard Progress Bar */}
          {!verificationResult && (
            <div className="bg-card border border-border/70 p-3 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span className={step === 1 ? "text-[#6B1D2F] dark:text-rose-400 font-extrabold" : step > 1 ? "text-emerald-600 font-semibold" : ""}>
                  1. Credentials
                </span>
                <span className={step === 2 ? "text-[#6B1D2F] dark:text-rose-400 font-extrabold" : step > 2 ? "text-emerald-600 font-semibold" : ""}>
                  2. Academic Profile
                </span>
                <span className={step === 3 ? "text-[#6B1D2F] dark:text-rose-400 font-extrabold" : ""}>
                  3. Verification
                </span>
              </div>
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#6B1D2F] to-[#D4AF37] transition-all duration-300 rounded-full"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Wizard Card Body */}
          <Card className="border border-border/80 shadow-md rounded-3xl overflow-hidden">
            <CardContent className="p-5 sm:p-7">
              {/* SUCCESS CONFIRMATION STATE */}
              {verificationResult ? (
                <div className="text-center py-6 space-y-4">
                  <div className="h-16 w-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-foreground">
                      {verificationResult.autoApproved ? "Account Verified! 🎓" : "Credentials Queued for Review ⏳"}
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
                /* STEP 1: ACCOUNT CREDENTIALS */
                <form onSubmit={handleProceedToAcademic} className="space-y-3.5">
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-foreground">Account Credentials</h2>
                    <p className="text-xs text-muted-foreground">Enter your contact and security details.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Full Legal Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
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
                    <Label className="text-xs font-semibold">Email Address</Label>
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
                        <span>⚠️ {emailError}</span>
                        <Link href="/login" className="underline font-bold text-rose-700 hover:text-rose-800 ml-2">
                          Sign In
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Ghana Phone Number (SMS Alerts)</Label>
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

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
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
                          <span>Checking account status...</span>
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
                /* STEP 2: ACADEMIC PROFILE */
                <form onSubmit={handleProceedToVerification} className="space-y-3.5">
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-foreground">Academic Profile</h2>
                    <p className="text-xs text-muted-foreground">Specify your USTED enrollment status and department.</p>
                  </div>

                  {/* Fresher vs Continuing Student Segmented Toggle */}
                  <div className="p-3 bg-muted/40 rounded-2xl border border-border/80 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        id="fresherToggle"
                        checked={isFresher}
                        onCheckedChange={(c) => {
                          const val = Boolean(c);
                          setIsFresher(val);
                          setDepartmentOrProgram(""); // reset dependent selection
                        }}
                        className="h-4 w-4 rounded"
                      />
                      <label htmlFor="fresherToggle" className="text-xs font-bold text-foreground cursor-pointer">
                        I am a Fresher / Newly Admitted Student
                      </label>
                    </div>
                    <p className="text-[11px] text-muted-foreground pl-6">
                      {isFresher
                        ? "Select your admitted program of study and enter your applicant serial number."
                        : "Continuing students must select their academic department and enter their 9-11 digit index number."}
                    </p>
                  </div>

                  {/* Dropdown 1: Faculty */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Faculty</Label>
                    <Select
                      value={faculty}
                      onValueChange={(val) => {
                        setFaculty(val);
                        setDepartmentOrProgram("");
                      }}
                    >
                      <SelectTrigger className="h-10 text-xs rounded-xl">
                        <SelectValue placeholder="Select your faculty" />
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
                      {isFresher ? "Program of Study" : "Academic Department"}
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
                              ? "Select your program of study"
                              : "Select your department"
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

                  {/* Relabeled Student Number Field */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Student Index / Applicant Number
                    </Label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={isFresher ? "e.g. 10102596 or App-2026-XXXX" : "e.g. 5230100452"}
                        value={studentIdNumber}
                        onChange={(e) => setStudentIdNumber(e.target.value)}
                        className="pl-9 h-10 text-xs font-mono rounded-xl"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {isFresher
                        ? "7-12 characters matching your USTED admission voucher."
                        : "9-11 digits matching your official university student ID."}
                    </p>
                  </div>

                  {/* Bottom Pinned Navigation */}
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
                      <span>Continue to Verification</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              ) : (
                /* STEP 3: FAST DOCUMENT ATTACHMENT */
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-foreground">Attach Verification Document</h2>
                      <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Automated Verification
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Attach your {isFresher ? "Admission Letter" : "Student ID Card"} to instantly verify your account and unlock booking access.
                    </p>
                  </div>

                  <DocumentUploader
                    documentType={documentType}
                    onDocumentTypeChange={setDocumentType}
                    onUploadSuccess={(url) => {
                      setUploadedDocUrl(url);
                      toast({
                        title: "Document Uploaded Successfully 📎",
                        description: "File compressed and ready for automated approval.",
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

                  {/* Anti-Fraud Notice */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-border/70 text-[11px] text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-rose-400" />
                      <span>USTED Institutional Verification Guarantee</span>
                    </div>
                    <p>
                      Authenticated securely via the USTED student registry for instant booking access.
                    </p>
                  </div>

                  {/* Pinned Action Controls */}
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
                      type="button"
                      disabled={isSubmitting || !uploadedDocUrl}
                      onClick={handleFinalSubmit}
                      className="flex-1 h-11 text-xs font-bold rounded-xl bg-[#6B1D2F] hover:bg-[#6B1D2F]/90 text-white shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Verifying & Creating Account...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                          <span>Complete & Verify Account</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
