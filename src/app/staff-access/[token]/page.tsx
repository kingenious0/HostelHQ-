"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import {
  validateStaffInviteAction,
  completeStaffRegistrationAction,
} from "@/app/actions/staff-invite";
import { type StaffRole } from "@/lib/staff";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Building,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function StaffAccessPage() {
  const params = useParams();
  const token = (params?.token as string) || "";
  const router = useRouter();
  const { toast } = useToast();

  // Token validation state
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [roleTitle, setRoleTitle] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate the invitation token on mount
  useEffect(() => {
    async function validate() {
      if (!token) {
        setIsValidating(false);
        setValidationError("No invitation token was provided.");
        return;
      }

      try {
        const res = await validateStaffInviteAction(token);
        if (res.valid) {
          setTokenValid(true);
          setRoleTitle(res.roleTitle || "Institutional Staff");
          setExpiresAt(res.expiresAt || "");
        } else {
          setTokenValid(false);
          setValidationError(res.error || "This invitation link is invalid or expired.");
        }
      } catch (err: any) {
        console.error("Token validation error:", err);
        setTokenValid(false);
        setValidationError("Unable to verify invitation. Please check your network and try again.");
      } finally {
        setIsValidating(false);
      }
    }

    validate();
  }, [token]);

  // Handle staff registration submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast({ title: "Name Required", description: "Please enter your full official name.", variant: "destructive" });
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Valid Email Required", description: "Please provide a valid institutional email address.", variant: "destructive" });
      return;
    }

    if (!phone.trim()) {
      toast({ title: "Phone Required", description: "Please provide an official contact phone number.", variant: "destructive" });
      return;
    }

    if (password.length < 8) {
      toast({ title: "Password Too Short", description: "Password must be at least 8 characters long for security.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Passwords Do Not Match", description: "Please ensure both password fields match exactly.", variant: "destructive" });
      return;
    }

    if (!agreedToTerms) {
      toast({ title: "Acknowledgment Required", description: "Please accept the institutional data governance terms.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create real Firebase Auth user account
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const user = userCredential.user;

      // Update display name in Firebase Auth
      await updateProfile(user, { displayName: fullName.trim() });

      // 2. Complete staff registration server-side (locks role to token and burns token)
      const regRes = await completeStaffRegistrationAction({
        token,
        uid: user.uid,
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        phone: phone.trim(),
      });

      if (!regRes.success) {
        throw new Error(regRes.error || "Failed to configure institutional access role.");
      }

      setIsSuccess(true);
      toast({
        title: "Account Configured Successfully! 🎓",
        description: `Welcome aboard, ${fullName.trim()}. Your institutional credentials are now active.`,
      });
    } catch (err: any) {
      console.error("Staff registration error:", err);
      let errorMsg = err.message || "An error occurred during onboarding.";
      if (err.code === "auth/email-already-in-use") {
        errorMsg = "An account with this email address already exists. Please use a different institutional email or log in.";
      } else if (err.code === "auth/weak-password") {
        errorMsg = "The password is too weak. Please choose a stronger combination of letters, numbers, and symbols.";
      }
      toast({
        title: "Onboarding Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (isValidating) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl border-border/60 text-center p-8">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Verifying Institutional Access Link</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Validating security token and role authorizations with university administration...
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // 2. Invalid / Expired State
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-xl border-red-200/80">
            <CardHeader className="text-center pb-4">
              <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 text-red-600">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900">
                Invitation Inactive or Expired
              </CardTitle>
              <CardDescription className="text-slate-600 mt-2 text-sm">
                {validationError || "This staff onboarding invitation link is no longer valid or has expired."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600 bg-slate-50/70 p-5 rounded-lg border border-slate-200 mx-6 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-slate-800">Why am I seeing this?</p>
                  <p className="text-xs text-muted-foreground">
                    Staff onboarding invitation links are single-use and expire strictly 24 hours after being issued for university security compliance.
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-3 text-xs text-muted-foreground">
                If you need access, please contact your university system administrator to generate a fresh invitation link.
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href="/login" className="w-full">
                <Button variant="outline" className="w-full">
                  Go to Standard Login
                </Button>
              </Link>
              <Link href="/" className="w-full">
                <Button className="w-full">
                  Return to Home
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // 3. Success State
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-emerald-200 text-center p-6 sm:p-8">
            <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 mx-auto mb-3">
              Onboarding Complete
            </Badge>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 font-headline">
              Official Account Configured
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              Your institutional credentials for <strong className="text-slate-900">{email}</strong> have been created and assigned your official role.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left text-xs text-muted-foreground mb-6 space-y-2">
              <div className="flex items-center gap-2 font-medium text-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Permanent Login Information
              </div>
              <p>
                From now on, access your dashboard directly from the standard <Link href="/login" className="text-primary underline font-medium">/login</Link> page. This tokenized onboarding page has served its purpose and is now permanently closed.
              </p>
            </div>

            <Button
              onClick={() => router.push("/login")}
              size="lg"
              className="w-full font-medium text-base gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
            >
              Proceed to Login
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // 4. Active Staff Registration Form
  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60">
      <Header />
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 md:p-8">
        <div className="w-full max-w-xl">
          <Card className="shadow-2xl border-border/60 bg-white">
            <CardHeader className="text-center space-y-2 border-b border-border/40 pb-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/80 text-white shadow-lg shadow-primary/20 mb-2">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold font-headline text-slate-900">
                Institutional Staff Onboarding
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-slate-600 max-w-md mx-auto">
                Welcome to the verified university administration portal. Please set up your official account credentials.
              </CardDescription>
              <div className="pt-2">
                <Badge variant="secondary" className="px-3 py-1 font-normal text-xs bg-slate-100 text-slate-700 border border-slate-300/80">
                  <Lock className="h-3 w-3 mr-1.5 text-primary" />
                  Role Pre-Configured by Administration
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Information Callout */}
                <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 flex items-start gap-2.5">
                  <Shield className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong>Single-Use Security Notice:</strong> This onboarding link will expire once you create your account. Use your official university email and a strong password to ensure seamless daily access via the standard login page.
                  </div>
                </div>

                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">
                    Full Official Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="e.g. Dr. Kwame Mensah"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-9 text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Official University Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                    Official University / Institutional Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="e.g. kmensah@university.edu.gh"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 text-sm"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This email will be your permanent username for all future logins.
                  </p>
                </div>

                {/* Official Phone Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
                    Official Contact Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+233 24 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9 text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                      Permanent Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 pr-9 text-sm"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-3 text-muted-foreground hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-9 text-sm"
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                </div>

                {/* Data Governance Checkbox */}
                <div className="flex items-start space-x-3 pt-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(val) => setAgreedToTerms(!!val)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed">
                    I acknowledge that this account has access to confidential university housing and student data, and I agree to uphold institutional privacy policies.
                  </Label>
                </div>

                {/* Submit Action */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full text-base py-3 h-12 font-medium bg-primary hover:bg-primary/90 text-white shadow-md transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Institutional Account...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-5 w-5" />
                      Complete Account Setup
                    </>
                  )}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="bg-slate-50/70 border-t border-border/40 py-4 px-6 text-center text-xs text-muted-foreground justify-center">
              Already set up your credentials?{" "}
              <Link href="/login" className="text-primary hover:underline font-semibold ml-1">
                Sign in to your account
              </Link>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
