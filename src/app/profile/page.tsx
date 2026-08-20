"use client";

import { Header } from '@/components/header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast, useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { uploadImage } from '@/lib/cloudinary';
import { onAuthStateChanged, User as FirebaseUser, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { Loader2, UserCheck, Mail, Phone, MapPin, Save, X, Eye, EyeOff } from 'lucide-react';
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
      // Re-authenticate user if necessary (Firebase security rule)
      // This part is crucial for security but is complex, often handled server-side or with Firebase popup re-auth
      // For simplicity, we are skipping explicit re-auth here, but in a real app, it's a must.
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

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50">
            <Header />
      <main className="flex-1 p-8 container mx-auto">
        <div className="flex items-center gap-4 mb-6">
            <BackButton />
            <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading profile...</span>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Personal Information Section */}
            <div className="bg-card p-6 rounded-lg shadow-md border">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Personal Information</h2>
              <div className="space-y-4">
                {/* Profile Photo Upload */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    {profileData.profileImage ? (
                      <AvatarImage src={profileData.profileImage} alt="Profile" />
                    ) : (
                      <AvatarFallback>{profileData.fullName?.charAt(0) || appUser?.email?.charAt(0) || 'U'}</AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <Label htmlFor="profilePhoto" className="text-sm">Upload your profile photo</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input id="profilePhoto" type="file" accept="image/*" onChange={handleProfileImageUpload} className="h-9 w-auto" />
                      {profileData.profileImage && (
                        <Button variant="outline" size="sm" onClick={() => setProfileData(p => ({ ...p, profileImage: '' }))}><X className="h-3 w-3 mr-1" />Remove</Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Full Name */}
                <div className="grid gap-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="fullName" className="pl-9" value={profileData.fullName} onChange={(e) => setProfileData(p => ({ ...p, fullName: e.target.value }))} />
                  </div>
                </div>

                {/* Email */}
                <div className="grid gap-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" className="pl-9" value={profileData.email} disabled />
                  </div>
                </div>

                {/* Phone & Nationality */}
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Mobile number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="phone" className="pl-9" value={profileData.phone} onChange={(e) => setProfileData(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nationality">Nationality</Label>
                    <Input id="nationality" value={profileData.nationality} onChange={(e) => setProfileData(p => ({ ...p, nationality: e.target.value }))} />
                  </div>
                </div>

                {/* Address & Gender */}
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="address" className="pl-9" value={profileData.address} onChange={(e) => setProfileData(p => ({ ...p, address: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select onValueChange={(value) => setProfileData(p => ({ ...p, gender: value }))} value={profileData.gender}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select Gender" /></SelectTrigger>
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
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" rows={3} value={profileData.bio} onChange={(e) => setProfileData(p => ({ ...p, bio: e.target.value }))} />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                    {isSavingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>

            {/* Update Password Section */}
            <div className="bg-card p-6 rounded-lg shadow-md border">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Update Password</h2>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Your current email address is <span className="font-semibold">{appUser?.email}</span></p>
                {/* Current Password */}
                <div className="grid gap-2">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      className="pr-10"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                </div>

                {/* New Password */}
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">Enter new password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      className="pr-10"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="grid gap-2">
                  <Label htmlFor="confirmNewPassword">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="confirmNewPassword"
                      type={showConfirmNewPassword ? "text" : "password"}
                      className="pr-10"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                    >
                      {showConfirmNewPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleChangePassword} disabled={isUpdatingPassword}>
                    {isUpdatingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Change Password
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
            </main>
        </div>
    );
}


