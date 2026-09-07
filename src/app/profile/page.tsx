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
import { toast, useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { uploadImage } from '@/lib/cloudinary';
import { onAuthStateChanged, User as FirebaseUser, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { Loader2, UserCheck, Mail, Phone, MapPin, Save, X, Eye, EyeOff, ShieldCheck, User, Lock, Sparkles } from 'lucide-react';
import { BackButton } from '@/components/ui/back-button';

interface AppUser {
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
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as AppUser;
          const currentUser: AppUser = {
            uid: user.uid,
            email: user.email!,
            fullName: userData.fullName || user.displayName || '',
            role: userData.role || 'student',
            profileImage: userData.profileImage || user.photoURL || '',
            phone: userData.phone || '',
            address: userData.address || '',
            bio: userData.bio || '',
            nationality: userData.nationality || '',
            gender: userData.gender || '',
          };
          setAppUser(currentUser);
          setProfileData(currentUser);
        } else {
          // If user exists in Auth but not in DB, create a basic profile
          const newUser: AppUser = {
            uid: user.uid,
            email: user.email!,
            fullName: user.displayName || '',
            role: 'student', // Default role
            profileImage: user.photoURL || '',
          };
          await updateDoc(userDocRef, newUser, { merge: true });
          setAppUser(newUser);
          setProfileData(newUser);
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
      toast({ title: 'Uploading image...', duration: 3000 });
      try {
        const imageUrl = await uploadImage(file);
        if (imageUrl) {
          setProfileData(prev => ({ ...prev, profileImage: imageUrl }));
          toast({ title: 'Image uploaded successfully!' });
        } else {
          toast({ title: 'Image upload failed', variant: 'destructive' });
        }
      } catch (error) {
        console.error("Error uploading image:", error);
        toast({ title: 'Image upload failed', description: (error as Error).message, variant: 'destructive' });
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
      toast({ title: 'Profile updated successfully!' });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ title: 'Failed to update profile', variant: 'destructive' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!auth.currentUser || !newPassword || newPassword !== confirmNewPassword) {
      toast({ title: 'Error', description: 'Please ensure new passwords match.', variant: 'destructive' });
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast({ title: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast({ title: 'Failed to update password', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'executive':
        return <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 font-semibold">Executive / Pro-VC</Badge>;
      case 'dean':
        return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold">Dean of Students</Badge>;
      case 'coordinator':
        return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold">Hostel Coordinator</Badge>;
      case 'manager':
        return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold">Hostel Manager</Badge>;
      case 'admin':
        return <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold">System Administrator</Badge>;
      default:
        return <Badge variant="outline" className="bg-muted/40 font-semibold">Student Resident</Badge>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-8 container mx-auto max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Account Profile</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Manage your identity, institutional credentials, and security settings.</p>
            </div>
          </div>
          {appUser && (
            <div className="flex items-center gap-2">
              {getRoleBadge(appUser.role)}
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Active
              </Badge>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground text-sm">Loading profile...</span>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Identity Overview Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="border border-border/60 shadow-xs bg-card">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 border-2 border-border shadow-xs">
                      {profileData.profileImage ? (
                        <AvatarImage src={profileData.profileImage} alt="Profile" className="object-cover" />
                      ) : (
                        <AvatarFallback className="text-xl font-bold bg-muted/60">
                          {profileData.fullName?.charAt(0) || appUser?.email?.charAt(0) || 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{profileData.fullName || "Unnamed User"}</h2>
                    <p className="text-xs text-muted-foreground font-mono">{appUser?.email}</p>
                  </div>
                  <div className="w-full pt-2 border-t border-border/60 flex flex-col gap-2 text-left text-xs">
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">User ID</span>
                      <span className="font-mono text-muted-foreground truncate max-w-[150px]">{appUser?.uid}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Institutional Role</span>
                      <span className="font-medium capitalize">{appUser?.role || "Student"}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Phone Verified</span>
                      <span className="font-medium text-emerald-600">{profileData.phone ? "Yes" : "Pending"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Status Card */}
              <Card className="border border-border/60 shadow-xs bg-card">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Security & Verification
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 text-xs text-muted-foreground space-y-2.5">
                  <p>
                    All profile information is synchronized with institutional directory records under Ghana Data Protection Act (Act 843).
                  </p>
                  <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 text-[11px] space-y-1">
                    <p className="font-semibold text-foreground">Multi-Device Access</p>
                    <p>Logged in via Firebase secure token authentication.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Form Tabs/Sections */}
            <div className="lg:col-span-8 space-y-6">
              {/* Personal Information Card */}
              <Card className="border border-border/60 shadow-xs bg-card">
                <CardHeader className="p-6 border-b border-border/50">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Personal & Academic Profile
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Update your verified identity details and contact preferences.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  {/* Profile Photo Upload */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-muted/30 rounded-xl border border-border/60">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-foreground">Profile Picture</p>
                      <p className="text-[11px] text-muted-foreground">Recommended format: Square JPG or PNG, under 2MB.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input id="profilePhoto" type="file" accept="image/*" onChange={handleProfileImageUpload} className="h-8 text-xs w-auto bg-background" />
                      {profileData.profileImage && (
                        <Button variant="outline" size="sm" onClick={() => setProfileData(p => ({ ...p, profileImage: '' }))} className="h-8 text-xs">
                          <X className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Full Name */}
                  <div className="grid gap-2">
                    <Label htmlFor="fullName" className="text-xs font-medium">Full Legal Name</Label>
                    <div className="relative">
                      <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="fullName" className="pl-9 text-xs bg-background h-9" value={profileData.fullName} onChange={(e) => setProfileData(p => ({ ...p, fullName: e.target.value }))} />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-xs font-medium">Email Address (Read-only)</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="email" className="pl-9 text-xs bg-muted/40 h-9" value={profileData.email} disabled />
                    </div>
                  </div>

                  {/* Phone & Nationality */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="phone" className="text-xs font-medium">Mobile Contact (MoMo Linked)</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="phone" className="pl-9 text-xs bg-background h-9" placeholder="024XXXXXXX" value={profileData.phone} onChange={(e) => setProfileData(p => ({ ...p, phone: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="nationality" className="text-xs font-medium">Nationality</Label>
                      <Input id="nationality" className="text-xs bg-background h-9" placeholder="Ghanaian" value={profileData.nationality} onChange={(e) => setProfileData(p => ({ ...p, nationality: e.target.value }))} />
                    </div>
                  </div>

                  {/* Address & Gender */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="address" className="text-xs font-medium">Campus / Residential Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="address" className="pl-9 text-xs bg-background h-9" placeholder="Ayeduase / Tanoso" value={profileData.address} onChange={(e) => setProfileData(p => ({ ...p, address: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gender" className="text-xs font-medium">Gender</Label>
                      <Select onValueChange={(value) => setProfileData(p => ({ ...p, gender: value }))} value={profileData.gender}>
                        <SelectTrigger className="w-full text-xs bg-background h-9"><SelectValue placeholder="Select Gender" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="grid gap-2">
                    <Label htmlFor="bio" className="text-xs font-medium">Bio & Roommate Preferences</Label>
                    <Textarea id="bio" rows={3} className="text-xs bg-background resize-none" placeholder="Brief note about your daily study routine, hobbies, and roommate expectations..." value={profileData.bio} onChange={(e) => setProfileData(p => ({ ...p, bio: e.target.value }))} />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="text-xs font-semibold">
                      {isSavingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Profile Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Password & Security Card */}
              <Card className="border border-border/60 shadow-xs bg-card">
                <CardHeader className="p-6 border-b border-border/50">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    Authentication & Password
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Protect your account with a secure passphrase.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Connected credential: <span className="font-semibold text-foreground font-mono">{appUser?.email}</span>
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="newPassword" className="text-xs font-medium">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          className="pr-10 text-xs bg-background h-9"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-2.5 py-2 hover:bg-transparent"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                        >
                          {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="confirmNewPassword" className="text-xs font-medium">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmNewPassword"
                          type={showConfirmNewPassword ? "text" : "password"}
                          className="pr-10 text-xs bg-background h-9"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-2.5 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                        >
                          {showConfirmNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button onClick={handleChangePassword} disabled={isUpdatingPassword || !newPassword} className="text-xs font-semibold" variant="outline">
                      {isUpdatingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Update Password
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


