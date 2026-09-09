"use client";

import { Header } from '@/components/header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { uploadImage } from '@/lib/cloudinary';
import { onAuthStateChanged, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Loader2,
  UserCheck,
  Mail,
  Phone,
  MapPin,
  Save,
  X,
  Eye,
  EyeOff,
  ShieldCheck,
  User,
  Lock,
  Sparkles,
  Camera,
  Copy,
  Check,
  Building2,
  GraduationCap,
  CreditCard,
  ChevronRight,
  Shield,
  Smartphone,
  ExternalLink,
  HelpCircle,
  Clock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Fingerprint,
  RefreshCw,
  Trash2,
  Plus
} from 'lucide-react';
import { BackButton } from '@/components/ui/back-button';
import { cn } from '@/lib/utils';
import { isBiometricSupported, getDeviceTypeName, arrayBufferToBase64 } from '@/lib/webauthn';

export interface AppUser {
  uid: string;
  email: string;
  fullName: string;
  role: string;
  profileImage?: string;
  phone?: string;
  address?: string;
  bio?: string;
  nationality?: string;
  gender?: string;
  department?: string;
  studentId?: string;
  emergencyContact?: string;
  momoNumber?: string;
  momoNetwork?: string;
  hasBiometricAuth?: boolean;
  biometricCredential?: any;
  passkeyRegisteredAt?: string;
}

export default function ProfilePage() {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<Partial<AppUser>>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    profileImage: '',
    nationality: '',
    gender: '',
    department: '',
    studentId: '',
    emergencyContact: '',
    momoNumber: '',
    momoNetwork: 'MTN',
  });
  const [activeTab, setActiveTab] = useState<'personal' | 'contact' | 'security'>('personal');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Passkey & Biometric state
  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyEnrolledDate, setPasskeyEnrolledDate] = useState<string | null>(null);
  const [isEnrollingPasskey, setIsEnrollingPasskey] = useState(false);
  const [isRemovingPasskey, setIsRemovingPasskey] = useState(false);
  const [isWebAuthnSupported, setIsWebAuthnSupported] = useState(true);
  const [deviceLabel, setDeviceLabel] = useState('Face ID / Touch ID / Device Lock');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const settingsSectionRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsWebAuthnSupported(isBiometricSupported());
      setDeviceLabel(getDeviceTypeName('platform'));
    }

    const unsubscribe = onAuthStateChanged(auth, async (user: any) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const rawData = userDocSnap.data() as any;
            const isEnrolled = !!(rawData.hasBiometricAuth || rawData.biometricCredential || rawData.biometricCredentialId);
            setHasPasskey(isEnrolled);
            if (rawData.biometricCredential?.createdAt || rawData.passkeyRegisteredAt) {
              const d = new Date(rawData.biometricCredential?.createdAt || rawData.passkeyRegisteredAt);
              if (!isNaN(d.getTime())) {
                setPasskeyEnrolledDate(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
              }
            }

            const currentUser: AppUser = {
              uid: user.uid,
              email: user.email!,
              fullName: rawData.fullName || user.displayName || '',
              role: rawData.role || 'student',
              profileImage: rawData.profileImage || user.photoURL || '',
              phone: rawData.phone || '',
              address: rawData.address || '',
              bio: rawData.bio || '',
              nationality: rawData.nationality || 'Ghanaian',
              gender: rawData.gender || '',
              department: rawData.department || '',
              studentId: rawData.studentId || '',
              emergencyContact: rawData.emergencyContact || '',
              momoNumber: rawData.momoNumber || rawData.phone || '',
              momoNetwork: rawData.momoNetwork || 'MTN',
              hasBiometricAuth: isEnrolled,
              biometricCredential: rawData.biometricCredential,
              passkeyRegisteredAt: rawData.passkeyRegisteredAt || rawData.biometricCredential?.createdAt,
            };
            setAppUser(currentUser);
            setProfileData(currentUser);
          } else {
            const newUser: AppUser = {
              uid: user.uid,
              email: user.email!,
              fullName: user.displayName || '',
              role: 'student',
              profileImage: user.photoURL || '',
              nationality: 'Ghanaian',
              momoNetwork: 'MTN',
            };
            await updateDoc(userDocRef, newUser as any, { merge: true });
            setAppUser(newUser);
            setProfileData(newUser);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setAppUser(null);
        setProfileData({});
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleProfileImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploadingImage(true);
      toast({ title: 'Uploading profile photo...', description: 'Compressing and syncing with secure cloud storage.' });
      try {
        const imageUrl = await uploadImage(file);
        if (imageUrl) {
          setProfileData(prev => ({ ...prev, profileImage: imageUrl }));
          if (appUser) {
            const userDocRef = doc(db, "users", appUser.uid);
            await updateDoc(userDocRef, { profileImage: imageUrl, updatedAt: new Date().toISOString() });
            setAppUser(prev => prev ? { ...prev, profileImage: imageUrl } : null);
          }
          toast({ title: 'Photo updated successfully!' });
        } else {
          toast({ title: 'Image upload failed', variant: 'destructive' });
        }
      } catch (error) {
        console.error("Error uploading image:", error);
        toast({ title: 'Image upload failed', description: (error as Error).message, variant: 'destructive' });
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!appUser) return;
    setIsSavingProfile(true);
    try {
      const userDocRef = doc(db, "users", appUser.uid);
      await updateDoc(userDocRef, {
        ...profileData,
        updatedAt: new Date().toISOString()
      });
      setAppUser(prev => prev ? { ...prev, ...profileData } as AppUser : null);
      toast({
        title: 'Profile changes saved!',
        description: 'Your personal information and preferences have been securely updated.'
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ title: 'Failed to update profile', description: 'Please check your connection and try again.', variant: 'destructive' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!auth.currentUser || !newPassword || newPassword !== confirmNewPassword) {
      toast({ title: 'Password mismatch', description: 'Please ensure both new password fields match.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Password too short', description: 'Password must be at least 6 characters long.', variant: 'destructive' });
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast({ title: 'Password updated successfully!', description: 'Your authentication credentials have been renewed.' });
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast({ title: 'Failed to update password', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!appUser?.uid) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to configure hardware biometric login.",
        variant: "destructive"
      });
      return;
    }

    if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
      toast({
        title: "Passkey Not Supported",
        description: "Your current browser or device does not support WebAuthn biometrics.",
        variant: "destructive"
      });
      return;
    }

    setIsEnrollingPasskey(true);
    try {
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: {
          name: "HostelHQ",
          id: window.location.hostname, // Strictly binds to 'hostel-hq.vercel.app'
        },
        user: {
          id: new TextEncoder().encode(appUser.uid),
          name: appUser.email || "student@hostelhq.com",
          displayName: appUser.fullName || appUser.email || "Hostel Resident",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256 (standard Android/iOS biometric)
          { alg: -257, type: "public-key" }, // RS256 (Windows Hello fallback)
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Enforces local biometrics (fingerprint/Face ID)
          residentKey: "preferred",            // CRITICAL: Saves discoverable passkey on device
          requireResidentKey: false,
          userVerification: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      };

      const credential = (await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      })) as PublicKeyCredential;

      if (!credential) throw new Error("Hardware registration failed");

      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const rawIdBase64 = arrayBufferToBase64(credential.rawId);
      const transports = (credential.response as any)?.getTransports?.() || ['internal'];

      // Save the credential.id (base64url) and transport info into Firestore under users/{uid}/passkeys
      try {
        const passkeyDocRef = doc(db, "users", appUser.uid, "passkeys", credential.id);
        await setDoc(passkeyDocRef, {
          credentialId: credential.id,
          rawId: rawIdBase64,
          transports,
          createdAt: now.toISOString(),
        });
      } catch (subErr) {
        console.warn("Could not save to users/passkeys subcollection:", subErr);
      }

      // Also persist to users/{uid} root document for instant lookup
      try {
        const userDocRef = doc(db, "users", appUser.uid);
        await updateDoc(userDocRef, {
          hasBiometricAuth: true,
          biometricCredentialId: credential.id,
          biometricCredential: {
            id: credential.id,
            rawId: rawIdBase64,
            deviceType: 'platform',
            transports,
            createdAt: now.toISOString(),
          },
          biometricCredentialData: {
            id: credential.id,
            rawId: rawIdBase64,
            deviceType: 'platform',
            transports,
            createdAt: now.toISOString(),
          },
          passkeyRegisteredAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
      } catch (dbErr) {
        console.warn("Could not record passkey timestamp in firestore:", dbErr);
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lastBiometricUserId', appUser.uid);
      }

      setHasPasskey(true);
      setPasskeyEnrolledDate(formattedDate);
      setAppUser(prev => prev ? {
        ...prev,
        hasBiometricAuth: true,
        biometricCredentialId: credential.id,
        passkeyRegisteredAt: now.toISOString(),
      } : null);

      toast({
        title: "Passkey Enrolled",
        description: "Biometric quick login is now active on this device."
      });
    } catch (error: any) {
      console.error("Passkey registration failed:", error);
      if (error?.name === 'NotAllowedError' || error?.message?.includes('cancelled')) {
        toast({
          title: "Registration Cancelled",
          description: "Device biometric prompt was dismissed. You can enroll your passkey anytime."
        });
      } else {
        toast({
          title: "Passkey Registration Failed",
          description: error?.message || "Could not register biometric passkey on this device.",
          variant: "destructive"
        });
      }
    } finally {
      setIsEnrollingPasskey(false);
    }
  };

  const handleRemovePasskey = async () => {
    if (!appUser?.uid) return;
    setIsRemovingPasskey(true);
    try {
      const userDocRef = doc(db, "users", appUser.uid);
      const currentCredId = appUser.biometricCredentialId || appUser.biometricCredential?.id;
      if (currentCredId) {
        try {
          const passkeyDocRef = doc(db, "users", appUser.uid, "passkeys", currentCredId);
          await deleteDoc(passkeyDocRef);
        } catch (_) {}
      }

      await updateDoc(userDocRef, {
        hasBiometricAuth: false,
        biometricCredential: null,
        biometricCredentialId: null,
        biometricCredentialData: null,
        passkeyRegisteredAt: null,
        updatedAt: new Date().toISOString(),
      });

      if (typeof window !== 'undefined') {
        const storedUid = window.localStorage.getItem('lastBiometricUserId');
        if (storedUid === appUser.uid) {
          window.localStorage.removeItem('lastBiometricUserId');
        }
      }

      setHasPasskey(false);
      setPasskeyEnrolledDate(null);
      setAppUser(prev => prev ? {
        ...prev,
        hasBiometricAuth: false,
        biometricCredential: null,
        biometricCredentialId: null,
        passkeyRegisteredAt: null
      } : null);

      toast({
        title: "Passkey Removed",
        description: "Biometric quick login has been disabled for this device."
      });
    } catch (error: any) {
      console.error("Failed to remove passkey:", error);
      toast({
        title: "Action Failed",
        description: "Could not remove passkey. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRemovingPasskey(false);
    }
  };

  const copyUserId = () => {
    if (!appUser?.uid) return;
    navigator.clipboard.writeText(appUser.uid);
    setCopiedUid(true);
    toast({ title: 'User ID copied to clipboard' });
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const scrollToSettingsTab = (tab: 'personal' | 'contact' | 'security') => {
    setActiveTab(tab);
    if (settingsSectionRef.current) {
      settingsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

export const ROLE_CONFIG: Record<string, { label: string; badgeClass: string; description: string }> = {
  student: {
    label: "Student Resident",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40",
    description: "Student account authenticated via University Housing Escrow. Direct booking with verified landlords.",
  },
  manager: {
    label: "Hostel Manager",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40",
    description: "Verified property manager account for off-campus private hostel administration and room tariffs.",
  },
  hostel_manager: {
    label: "Hostel Manager",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40",
    description: "Verified property manager account for off-campus private hostel administration and room tariffs.",
  },
  coordinator: {
    label: "Housing Coordinator",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
    description: "Institutional officer overseeing off-campus accreditation, compliance inspections, and rent caps.",
  },
  hostel_coordinator: {
    label: "Housing Coordinator",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
    description: "Institutional officer overseeing off-campus accreditation, compliance inspections, and rent caps.",
  },
  dean: {
    label: "Dean of Students",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
    description: "Executive student welfare authority governing residential policy, disputes, and hostel accreditation.",
  },
  provost: {
    label: "Pro-Vice-Chancellor",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40",
    description: "University executive leadership monitoring accommodation deficits, compliance, and council briefing reports.",
  },
  pro_vc: {
    label: "Pro-Vice-Chancellor",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40",
    description: "University executive leadership monitoring accommodation deficits, compliance, and council briefing reports.",
  },
  executive: {
    label: "Pro-Vice-Chancellor",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40",
    description: "University executive leadership monitoring accommodation deficits, compliance, and council briefing reports.",
  },
  vc: {
    label: "Vice-Chancellor",
    badgeClass: "bg-red-50 text-red-800 border-red-300 font-semibold dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/40",
    description: "Chief executive authority exercising statutory sanction and charter revocation over non-compliant properties.",
  },
  registrar: {
    label: "University Registrar",
    badgeClass: "bg-slate-50 text-slate-800 border-slate-300 dark:bg-slate-900/60 dark:text-slate-200 dark:border-slate-700",
    description: "Custodial officer of the statutory university housing charter and council record.",
  },
  admin: {
    label: "System Administrator",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    description: "Administrative console access for platform governance, verification pipelines, and payment processing.",
  },
};

export const getRoleConfig = (role?: string) => {
  if (!role) return ROLE_CONFIG.student;
  const normalized = role.toLowerCase().trim();
  return ROLE_CONFIG[normalized] || ROLE_CONFIG.student;
};

  const getRoleBadge = (role?: string) => {
    const config = getRoleConfig(role);
    return (
      <Badge variant="outline" className={cn("font-semibold px-2.5 py-0.5 text-xs border", config.badgeClass)}>
        {config.label}
      </Badge>
    );
  };

  // Institutional handle fallback
  const institutionalHandle = appUser?.email?.includes('@')
    ? appUser.email
    : `${(appUser?.role || 'user').slice(0, 3)}-${(appUser?.uid || 'user').slice(0, 7).toLowerCase()}@hostelhq.com`;

  const roleConfig = getRoleConfig(appUser?.role);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 dark:bg-background">
      <Header />
      
      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8 pb-32 md:pb-16 max-w-4xl mx-auto w-full space-y-6">
        {/* Page Top Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">Profile</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage your verified {roleConfig.label.toLowerCase()} credentials, institutional details, and security settings
            </p>
          </div>
          <BackButton />
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center h-72 space-y-3 bg-white dark:bg-card rounded-3xl border border-border/60 p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-muted-foreground text-sm font-medium">Synchronizing account profile...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Identity Hero Header Card (Airbnb-Inspired Executive Header) */}
            <Card className="rounded-3xl border border-border/70 bg-white dark:bg-card shadow-xs overflow-hidden transition-all">
              <CardContent className="p-5 sm:p-7">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 text-center sm:text-left">
                  {/* Large Circular Avatar with Camera Upload Badge */}
                  <div className="relative group shrink-0">
                    <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-2 border-primary/25 shadow-md ring-4 ring-primary/5">
                      {profileData.profileImage ? (
                        <AvatarImage src={profileData.profileImage} alt="Profile" className="object-cover" />
                      ) : (
                        <AvatarFallback className="text-2xl sm:text-3xl font-bold bg-primary/10 text-primary">
                          {profileData.fullName?.charAt(0) || appUser?.email?.charAt(0) || 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    {/* Quick Camera Action Overlay */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                      title="Upload new profile picture"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Name, Institutional Handle & Verification Badges */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      {getRoleBadge(appUser?.role)}
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Active Verified
                      </span>
                      {profileData.phone && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 hidden sm:inline-flex">
                          <Smartphone className="h-3 w-3" /> MoMo Linked
                        </span>
                      )}
                    </div>

                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
                        {profileData.fullName || roleConfig.label}
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground font-mono truncate mt-0.5">
                        {institutionalHandle}
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground/90 max-w-xl">
                      {profileData.bio || roleConfig.description}
                    </p>
                  </div>

                  {/* Desktop Quick Edit Trigger */}
                  <div className="shrink-0 flex sm:flex-col items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => scrollToSettingsTab('personal')}
                      className="rounded-xl text-xs font-semibold h-9 px-4 gap-1.5 shadow-2xs"
                    >
                      <User className="h-3.5 w-3.5" /> Edit Profile
                    </Button>
                    {profileData.profileImage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setProfileData(p => ({ ...p, profileImage: '' }))}
                        className="text-xs text-muted-foreground hover:text-rose-600 h-8 px-2"
                      >
                        Remove Photo
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Structured Two-Column Metadata Pills Grid Card */}
            <Card className="rounded-3xl border border-border/70 bg-white dark:bg-card shadow-xs overflow-hidden">
              <CardHeader className="p-4 sm:p-5 pb-2 border-b border-border/40">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Institutional Identity Credentials
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* User ID with 1-click copy */}
                  <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-gray-50/80 dark:bg-muted/30 border border-border/50">
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Account ID</p>
                      <p className="text-xs font-mono text-foreground truncate font-medium">
                        {appUser?.uid || 'Not available'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyUserId}
                      className="h-8 w-8 p-0 rounded-lg shrink-0 text-muted-foreground hover:text-foreground"
                      title="Copy Account ID"
                    >
                      {copiedUid ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Department / Programme */}
                  <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-gray-50/80 dark:bg-muted/30 border border-border/50">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Academic Department</p>
                      <p className="text-xs font-medium text-foreground truncate">
                        {profileData.department || "Faculty of Science & Computing"}
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Phone & MoMo Status */}
                  <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-gray-50/80 dark:bg-muted/30 border border-border/50">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Phone Verification</p>
                      <p className="text-xs font-medium text-foreground truncate">
                        {profileData.phone ? `${profileData.phone} (Verified)` : "No Phone Set"}
                      </p>
                    </div>
                    <span className={cn(
                      "text-[11px] font-bold px-2 py-0.5 rounded-md",
                      profileData.phone
                        ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                    )}>
                      {profileData.phone ? "Verified" : "Pending"}
                    </span>
                  </div>

                  {/* Campus Escrow Protection */}
                  <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-gray-50/80 dark:bg-muted/30 border border-border/50">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Protection Layer</p>
                      <p className="text-xs font-medium text-foreground truncate">
                        Zero Brokerage Escrow (Act 843)
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Role-Aware Portal Banner */}
            <Card className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-primary/10 dark:from-primary/10 dark:via-card dark:to-primary/5 shadow-xs overflow-hidden">
              <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center justify-center sm:justify-start gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> {['executive', 'provost', 'pro_vc', 'vc', 'registrar', 'dean'].includes(appUser?.role?.toLowerCase() || '') ? 'HostelHQ Executive Governance' : appUser?.role === 'manager' || appUser?.role === 'hostel_manager' ? 'HostelHQ Manager Portal' : 'HostelHQ Resident Hub'}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    {['executive', 'provost', 'pro_vc', 'vc', 'registrar', 'dean'].includes(appUser?.role?.toLowerCase() || '') 
                      ? 'Access Executive Housing Council & Sanctions'
                      : appUser?.role === 'manager' || appUser?.role === 'hostel_manager'
                      ? 'Manage your properties and room allocations'
                      : 'Looking for next semester\'s verified hostel?'}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    {['executive', 'provost', 'pro_vc', 'vc', 'registrar', 'dean'].includes(appUser?.role?.toLowerCase() || '')
                      ? 'Monitor off-campus accreditation, compliance deficits, and generate statutory council briefings.'
                      : appUser?.role === 'manager' || appUser?.role === 'hostel_manager'
                      ? 'Update room tariffs, verify tenant occupancy, and maintain hostel accreditation standards.'
                      : 'Explore university-accredited properties with instant room walkthroughs and zero middleman markup.'}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <Button asChild size="sm" className="rounded-xl text-xs font-semibold h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm gap-1.5">
                    <Link href={['executive', 'provost', 'pro_vc', 'vc', 'registrar', 'dean'].includes(appUser?.role?.toLowerCase() || '') ? '/executive/dashboard' : appUser?.role === 'manager' || appUser?.role === 'hostel_manager' ? '/manager/dashboard' : '/hostels'}>
                      {['executive', 'provost', 'pro_vc', 'vc', 'registrar', 'dean'].includes(appUser?.role?.toLowerCase() || '') ? 'Executive Console' : appUser?.role === 'manager' || appUser?.role === 'hostel_manager' ? 'Manager Dashboard' : 'Browse Hostels'} <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 4. Airbnb-Style Quick Settings Row Navigator */}
            <div ref={settingsSectionRef} className="space-y-3">
              <h3 className="text-lg font-bold text-foreground tracking-tight px-1">
                Account Settings & Preferences
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('personal')}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 group",
                    activeTab === 'personal'
                      ? "bg-white dark:bg-card border-primary ring-2 ring-primary/20 shadow-xs"
                      : "bg-white/70 dark:bg-card/70 border-border/70 hover:bg-white hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      activeTab === 'personal' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    )}>
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">Personal & Academic</p>
                      <p className="text-[11px] text-muted-foreground truncate">Identity & campus details</p>
                    </div>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform text-muted-foreground", activeTab === 'personal' && "text-primary translate-x-0.5")} />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('contact')}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 group",
                    activeTab === 'contact'
                      ? "bg-white dark:bg-card border-primary ring-2 ring-primary/20 shadow-xs"
                      : "bg-white/70 dark:bg-card/70 border-border/70 hover:bg-white hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      activeTab === 'contact' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    )}>
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">Contact & MoMo</p>
                      <p className="text-[11px] text-muted-foreground truncate">Wallet & emergency info</p>
                    </div>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform text-muted-foreground", activeTab === 'contact' && "text-primary translate-x-0.5")} />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 group",
                    activeTab === 'security'
                      ? "bg-white dark:bg-card border-primary ring-2 ring-primary/20 shadow-xs"
                      : "bg-white/70 dark:bg-card/70 border-border/70 hover:bg-white hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      activeTab === 'security' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    )}>
                      <Shield className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-foreground truncate">Login & Security</p>
                        {hasPasskey && (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {hasPasskey ? "Passkey active • Biometrics" : "Passkey & credentials"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform text-muted-foreground", activeTab === 'security' && "text-primary translate-x-0.5")} />
                </button>
              </div>
            </div>

            {/* 5. Progressive Disclosure Form Stack via Tabs */}
            <Tabs value={activeTab} onValueChange={(val: string) => setActiveTab(val as any)} className="w-full">
              {/* Tab 1: Personal & Academic Details */}
              <TabsContent value="personal" className="mt-0 focus-visible:outline-none">
                <Card className="rounded-3xl border border-border/70 bg-white dark:bg-card shadow-xs">
                  <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border/50">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                      <User className="h-4 w-4 text-primary" />
                      Personal & Academic Details
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Update your legal identification, academic program, and roommate profile.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 sm:p-6 space-y-5">
                    {/* Full Name & Student ID */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="fullName" className="text-xs font-semibold text-foreground">
                          Full Legal Name
                        </Label>
                        <div className="relative">
                          <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="fullName"
                            className="pl-10 h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80"
                            placeholder="e.g. Kwame Mensah"
                            value={profileData.fullName || ''}
                            onChange={(e) => setProfileData(p => ({ ...p, fullName: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="studentId" className="text-xs font-semibold text-foreground">
                          Student ID / Index Number
                        </Label>
                        <div className="relative">
                          <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="studentId"
                            className="pl-10 h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80"
                            placeholder="e.g. 20849312"
                            value={profileData.studentId || ''}
                            onChange={(e) => setProfileData(p => ({ ...p, studentId: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Department & Nationality */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="department" className="text-xs font-semibold text-foreground">
                          Department / Faculty
                        </Label>
                        <Input
                          id="department"
                          className="h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80"
                          placeholder="e.g. Computer Science, KNUST"
                          value={profileData.department || ''}
                          onChange={(e) => setProfileData(p => ({ ...p, department: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="nationality" className="text-xs font-semibold text-foreground">
                          Nationality
                        </Label>
                        <Input
                          id="nationality"
                          className="h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80"
                          placeholder="Ghanaian"
                          value={profileData.nationality || ''}
                          onChange={(e) => setProfileData(p => ({ ...p, nationality: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Gender & Campus Address */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="gender" className="text-xs font-semibold text-foreground">
                          Gender
                        </Label>
                        <Select
                          value={profileData.gender || ''}
                          onValueChange={(val) => setProfileData(p => ({ ...p, gender: val }))}
                        >
                          <SelectTrigger className="w-full h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80">
                            <SelectValue placeholder="Select Gender" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other / Prefer not to say</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="address" className="text-xs font-semibold text-foreground">
                          Campus / Residential Address
                        </Label>
                        <div className="relative">
                          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="address"
                            className="pl-10 h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80"
                            placeholder="e.g. Ayeduase Gate, Kumasi"
                            value={profileData.address || ''}
                            onChange={(e) => setProfileData(p => ({ ...p, address: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bio & Roommate Preferences */}
                    <div className="space-y-1.5">
                      <Label htmlFor="bio" className="text-xs font-semibold text-foreground">
                        Bio & Roommate Preferences
                      </Label>
                      <Textarea
                        id="bio"
                        rows={3}
                        className="text-sm bg-background resize-none rounded-xl border-border/80"
                        placeholder="Share your study habits, sleeping schedule, and what you look for in a prospective roommate..."
                        value={profileData.bio || ''}
                        onChange={(e) => setProfileData(p => ({ ...p, bio: e.target.value }))}
                      />
                    </div>

                    {/* Inline Action Button */}
                    <div className="flex justify-end pt-2 border-t border-border/40">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="rounded-xl h-11 px-6 text-sm font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                      >
                        {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Personal Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 2: Contact & MoMo Preferences */}
              <TabsContent value="contact" className="mt-0 focus-visible:outline-none">
                <Card className="rounded-3xl border border-border/70 bg-white dark:bg-card shadow-xs">
                  <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border/50">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Contact & MoMo Preferences
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Manage phone numbers for direct booking verification and university escrow returns.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 sm:p-6 space-y-5">
                    {/* Primary Email (Read-Only) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                          Institutional Email (Authenticated)
                        </Label>
                        <span className="text-[11px] text-muted-foreground">Managed via SSO</span>
                      </div>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          className="pl-10 h-11 sm:h-12 text-sm bg-muted/40 rounded-xl border-border/80 font-mono text-muted-foreground cursor-not-allowed"
                          value={profileData.email || ''}
                          disabled
                        />
                      </div>
                    </div>

                    {/* Primary Mobile Number */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="phone" className="text-xs font-semibold text-foreground">
                          Primary Mobile Number
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            className="pl-10 h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80"
                            placeholder="024XXXXXXX"
                            value={profileData.phone || ''}
                            onChange={(e) => setProfileData(p => ({ ...p, phone: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Emergency Contact */}
                      <div className="space-y-1.5">
                        <Label htmlFor="emergencyContact" className="text-xs font-semibold text-foreground">
                          Emergency Contact (Parent / Guardian)
                        </Label>
                        <Input
                          id="emergencyContact"
                          className="h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80"
                          placeholder="e.g. 020XXXXXXX (Father)"
                          value={profileData.emergencyContact || ''}
                          onChange={(e) => setProfileData(p => ({ ...p, emergencyContact: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* MoMo Linked Wallet Settings */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-900/40 space-y-3">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider">
                          Mobile Money (MoMo) Escrow Wallet
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        Specify your registered mobile money account. In the event of booking cancellation or overpayment, refunds are routed directly to this wallet.
                      </p>

                      <div className="grid gap-4 sm:grid-cols-2 pt-1">
                        <div className="space-y-1.5">
                          <Label htmlFor="momoNetwork" className="text-xs font-semibold text-foreground">
                            MoMo Network Provider
                          </Label>
                          <Select
                            value={profileData.momoNetwork || 'MTN'}
                            onValueChange={(val) => setProfileData(p => ({ ...p, momoNetwork: val }))}
                          >
                            <SelectTrigger className="w-full h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80">
                              <SelectValue placeholder="Network" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                              <SelectItem value="Telecel">Telecel Cash (Vodafone)</SelectItem>
                              <SelectItem value="AT">AT Money (AirtelTigo)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="momoNumber" className="text-xs font-semibold text-foreground">
                            MoMo Registered Number
                          </Label>
                          <Input
                            id="momoNumber"
                            className="h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80"
                            placeholder="024XXXXXXX"
                            value={profileData.momoNumber || ''}
                            onChange={(e) => setProfileData(p => ({ ...p, momoNumber: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Inline Action Button */}
                    <div className="flex justify-end pt-2 border-t border-border/40">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="rounded-xl h-11 px-6 text-sm font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                      >
                        {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Contact & MoMo Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 3: Login & Security */}
              <TabsContent value="security" className="mt-0 focus-visible:outline-none">
                <Card className="rounded-3xl border border-border/70 bg-white dark:bg-card shadow-xs">
                  <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border/50">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                      <Shield className="h-4 w-4 text-primary" />
                      Login & Security Standards
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Protect your tenancy account and update your login password.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 sm:p-6 space-y-5">
                    {/* Active Session Status */}
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-muted/30 border border-border/60 flex items-center justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          Authenticated Session Active
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          Signed in as <span className="font-mono font-medium text-foreground">{appUser?.email}</span>
                        </p>
                      </div>
                    </div>

                    {/* Biometric & Passkey Quick Login Card */}
                    <div className="p-5 sm:p-6 rounded-2xl border border-border/70 bg-gray-50/60 dark:bg-muted/20 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Fingerprint className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-bold text-foreground">
                                Biometric & Passkey Quick Login
                              </h4>
                              {hasPasskey ? (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold">
                                  Enrolled on this Device
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted text-muted-foreground text-[11px]">
                                  Not Configured
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              Sign into HostelHQ in seconds using {deviceLabel} without typing your password each time.
                            </p>
                          </div>
                        </div>
                      </div>

                      {!isWebAuthnSupported ? (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                          Biometric passkeys and WebAuthn are not supported or are disabled on this browser/device. Please use a modern browser such as Chrome, Safari, or Edge.
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {hasPasskey ? (
                              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>Passkey active • Registered {passkeyEnrolledDate || 'on this device'}</span>
                              </div>
                            ) : (
                              <p>
                                Hardware-backed cryptographic passkey stored securely on this device (FIDO2 / WebAuthn).
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {hasPasskey ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleRegisterPasskey}
                                  disabled={isEnrollingPasskey || isRemovingPasskey}
                                  className="rounded-xl text-xs h-9 font-semibold gap-1.5"
                                >
                                  {isEnrollingPasskey ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  )}
                                  Re-enroll Device
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleRemovePasskey}
                                  disabled={isEnrollingPasskey || isRemovingPasskey}
                                  className="rounded-xl text-xs h-9 font-semibold text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
                                >
                                  {isRemovingPasskey ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                  Remove
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                onClick={handleRegisterPasskey}
                                disabled={isEnrollingPasskey}
                                className="rounded-xl text-xs h-9 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm gap-1.5"
                              >
                                {isEnrollingPasskey ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Fingerprint className="h-3.5 w-3.5" />
                                )}
                                Register This Device Passkey
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Password Update Form */}
                    <div className="space-y-4 pt-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <KeyRound className="h-4 w-4 text-primary" /> Change Password
                      </h4>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="newPassword" className="text-xs font-semibold text-foreground">
                            New Password
                          </Label>
                          <div className="relative">
                            <Input
                              id="newPassword"
                              type={showNewPassword ? "text" : "password"}
                              className="pr-10 h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80"
                              placeholder="At least 6 characters"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <button
                              type="button"
                              className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowNewPassword((prev) => !prev)}
                            >
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="confirmNewPassword" className="text-xs font-semibold text-foreground">
                            Confirm New Password
                          </Label>
                          <div className="relative">
                            <Input
                              id="confirmNewPassword"
                              type={showConfirmNewPassword ? "text" : "password"}
                              className="pr-10 h-11 sm:h-12 text-sm bg-background rounded-xl border-border/80"
                              placeholder="Repeat new password"
                              value={confirmNewPassword}
                              onChange={(e) => setConfirmNewPassword(e.target.value)}
                            />
                            <button
                              type="button"
                              className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                            >
                              {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <Button
                          onClick={handleChangePassword}
                          disabled={isUpdatingPassword || !newPassword || !confirmNewPassword}
                          className="rounded-xl h-11 px-6 text-sm font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                        >
                          {isUpdatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                          Update Password
                        </Button>
                      </div>
                    </div>

                    {/* Regulatory & Security Compliance Card */}
                    <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/10 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 space-y-1.5">
                      <p className="font-bold flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        Ghana Data Protection Act (Act 843) Certified
                      </p>
                      <p className="text-[11px] leading-relaxed text-blue-800 dark:text-blue-400">
                        HostelHQ encrypts all student credentials in transit and at rest. Your phone number and MoMo identifiers are exclusively utilized for university room reservation receipts and escrow verification.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      {/* 6. Sticky Mobile Save State Bar (Mobile Responsiveness & Touch Optimization) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border p-3.5 sm:px-6 flex items-center justify-between gap-4 md:hidden shadow-lg">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Account Profile</div>
          <div className="text-sm font-bold text-foreground truncate">
            {profileData.fullName || roleConfig.label}
          </div>
        </div>
        <Button
          onClick={handleSaveProfile}
          disabled={isSavingProfile}
          className="h-11 px-5 text-sm font-semibold shadow-md rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99] flex items-center gap-2 shrink-0"
        >
          {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
