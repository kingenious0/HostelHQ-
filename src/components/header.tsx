
"use client";

import Link from 'next/link';
import { Hotel, User, LogOut, Loader2, LayoutDashboard, ListPlus, UserPlus, Briefcase, Building, Camera, Save, X, Phone, MapPin, Mail, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { auth, db } from '@/lib/firebase';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ably } from '@/lib/ably';
import { Types } from 'ably';
import { Badge } from '@/components/ui/badge';
import { uploadImage } from '@/lib/cloudinary';

type AppUser = {
  uid: string;
  email: string;
  fullName: string;
  role: 'student' | 'agent' | 'admin' | 'pending_agent' | 'hostel_manager';
  profileImage?: string;
  phone?: string;
  address?: string;
  bio?: string;
}

export function Header() {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authAction, setAuthAction] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState<Partial<AppUser>>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    profileImage: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const locationWatcherId = useRef<number | null>(null);
  const agentPresenceChannel = useRef<Types.RealtimeChannelPromise | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (!ably.auth.options) {
          (ably.auth.options as any) = {};
        }
        ably.auth.options.clientId = user.uid;

        const userDocRef = doc(db, "users", user.uid);
        const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as AppUser;
            const currentUser: AppUser = {
                uid: user.uid,
                email: user.email!,
                fullName: userData.fullName || user.displayName || '',
                role: userData.role || 'student',
                profileImage: userData.profileImage || user.photoURL || '',
                phone: userData.phone || '',
                address: userData.address || '',
                bio: userData.bio || '',
            };
            setAppUser(currentUser);
            setProfileData(currentUser);
          } else {
            // User exists in Auth but not in any DB collection, likely an anomaly
            signOut(auth);
            setAppUser(null);
            setProfileData({});
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user document:", error);
          setLoading(false);
        });
        return () => unsubscribeFirestore(); // Unsubscribe from Firestore listener
      } else {
        if (ably.auth && ably.auth.options) {
          ably.auth.options.clientId = undefined;
        }
        setAppUser(null);
        setProfileData({});
        setLoading(false);
      }
    });

    return () => unsubscribeAuth(); // Unsubscribe from Auth state changes
  }, []);

  const loadProfileData = async () => {
    if (!appUser) return;
    
    try {
        const userDocRef = doc(db, "users", appUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setProfileData({
                fullName: userData.fullName || appUser.fullName || '',
                email: appUser.email || '',
                phone: userData.phone || '',
                address: userData.address || '',
                bio: userData.bio || '',
                profileImage: userData.profileImage || appUser.profileImage || ''
            });
        } else {
            setProfileData({
                fullName: appUser.fullName || '',
                email: appUser.email || '',
                phone: '',
                address: '',
                bio: '',
                profileImage: appUser.profileImage || ''
            });
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!appUser) return;
    
    setIsSavingProfile(true);
    try {
        const userDocRef = doc(db, "users", appUser.uid);
        await updateDoc(userDocRef, {
            fullName: profileData.fullName,
            phone: profileData.phone,
            address: profileData.address,
            bio: profileData.bio,
            profileImage: profileData.profileImage,
            updatedAt: new Date().toISOString()
        });
        
        // Update appUser state to reflect changes immediately in header
        setAppUser(prev => prev ? { ...prev, ...profileData } as AppUser : null);

        toast({ title: 'Profile updated successfully!' });
        setIsProfileOpen(false);
    } catch (error) {
        console.error('Error saving profile:', error);
        toast({ title: 'Failed to update profile', variant: 'destructive' });
    } finally {
        setIsSavingProfile(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        toast({ title: 'Uploading image...', duration: 3000 });
        const imageUrl = await uploadImage(file);
        if (imageUrl) {
            setProfileData(prev => ({ ...prev, profileImage: imageUrl }));
            toast({ title: 'Image uploaded successfully!' });
        } else {
            toast({ title: 'Image upload failed', variant: 'destructive' });
        }
    }
  };

  useEffect(() => {
    // This effect handles Ably presence and location tracking for agents.
    if (appUser?.role === 'agent') {
      // --- Enter Presence ---
      agentPresenceChannel.current = ably.channels.get('agents:live');
      const enterPresence = async () => {
        try {
          await agentPresenceChannel.current?.presence.enter({ 
            id: appUser.uid, 
            fullName: appUser.fullName, 
            email: appUser.email 
          });
        } catch (e) {
          console.error('Error entering Ably presence:', e);
        }
      };
      enterPresence();

      // --- Start Location Tracking ---
      if ('geolocation' in navigator) {
        locationWatcherId.current = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const agentGpsChannel = ably.channels.get(`agent:${appUser.uid}:gps`);
            
            // Publish to Ably for real-time map updates
            agentGpsChannel.publish('location', { lat: latitude, lng: longitude });

            // Also update Firestore for initial location fetching
            const userDocRef = doc(db, "users", appUser.uid);
            await updateDoc(userDocRef, {
              location: { lat: latitude, lng: longitude }
            });
          },
          (error) => {
            if(error.code === 1) { // PERMISSION_DENIED
              toast({ title: 'Location Access Denied', description: 'Please enable location services to be visible to students.', variant: 'destructive'});
            }
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
      }
      
    }

    // --- Cleanup function ---
    return () => {
      // Leave presence when component unmounts or user changes
      if (agentPresenceChannel.current) {
        agentPresenceChannel.current.presence.leave();
        agentPresenceChannel.current = null;
      }
      // Stop watching location
      if (locationWatcherId.current !== null) {
        navigator.geolocation.clearWatch(locationWatcherId.current);
        locationWatcherId.current = null;
      }
    };
  }, [appUser, toast]);


  const handleLogout = async () => {
    setAuthAction(true);
    try {
      // The useEffect cleanup will handle leaving presence and clearing watchers
      await signOut(auth);
      toast({ title: "Logged out successfully" });
      router.push('/');
    } catch (error) {
      console.error("Error logging out:", error);
      toast({ title: "Logout failed", variant: 'destructive' });
    } finally {
      setAuthAction(false);
    }
  };
  
  const isAgent = appUser?.role === 'agent';
  const isAdmin = appUser?.role === 'admin';
  const isStudent = appUser?.role === 'student';
  const isPending = appUser?.role === 'pending_agent';
  const isManager = appUser?.role === 'hostel_manager';

  return (
    <header className="bg-background/80 backdrop-blur-sm border-b sticky top-0 z-40">
      <div className="container mx-auto flex h-16 sm:h-20 items-center justify-between px-3 sm:px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Hotel className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <span className="text-xl sm:text-2xl font-bold text-foreground font-headline">HostelHQ</span>
        </Link>
        <div className="flex items-center gap-4">
           <nav className="hidden items-center gap-6 md:flex">
            <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              Hostels
            </Link>
            {isAgent && (
              <Link href="/agent/listings" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                My Listings
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin/dashboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Admin Dashboard
              </Link>
            )}
            {isManager && (
              <Link href="/manager/dashboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Manager Dashboard
              </Link>
            )}
            {isStudent && (
                 <Link href="/my-bookings" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                    My Bookings
                </Link>
            )}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={loading}>
                {loading || authAction ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <Avatar className="h-9 w-9">
                    {appUser?.profileImage ? (
                      <AvatarImage src={appUser.profileImage} alt="Profile" />
                    ) : (
                      <AvatarFallback>{appUser?.fullName?.charAt(0) || appUser?.email?.charAt(0) || 'U'}</AvatarFallback>
                    )}
                  </Avatar>
                )}
                <span className="sr-only">User Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {appUser ? (
                <>
                  <DropdownMenuLabel>
                    <div className="font-semibold">{appUser.fullName}</div>
                    <p className="text-xs text-muted-foreground font-normal">{appUser.email}</p>
                     {isPending && <Badge variant="secondary" className="mt-1">Pending Approval</Badge>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                    <User className="mr-2 h-4 w-4"/>
                    <span>Profile</span>
                  </DropdownMenuItem>
                  {isStudent && (
                     <DropdownMenuItem asChild>
                        <Link href="/my-bookings"><Briefcase className="mr-2 h-4 w-4"/>My Bookings</Link>
                    </DropdownMenuItem>
                  )}
                  {isAgent && (
                    <>
                       <DropdownMenuItem asChild>
                        <Link href="/agent/dashboard" className="flex items-center justify-between w-full"><div className="flex items-center"><LayoutDashboard className="mr-2 h-4 w-4"/>Dashboard</div></Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/agent/listings"><ListPlus className="mr-2 h-4 w-4"/>My Listings</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                   {isAdmin && (
                    <DropdownMenuItem asChild>
                        <Link href="/admin/dashboard"><LayoutDashboard className="mr-2 h-4 w-4"/>Dashboard</Link>
                    </DropdownMenuItem>
                  )}
                   {isManager && (
                    <DropdownMenuItem asChild>
                        <Link href="/manager/dashboard"><Building className="mr-2 h-4 w-4"/>Manager Dashboard</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} disabled={authAction}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuLabel>Welcome</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/login"><User className="mr-2 h-4 w-4" />Login</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/signup"><UserPlus className="mr-2 h-4 w-4" />Sign Up</Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
                <DialogDescription>Manage your profile information and picture.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        {profileData.profileImage ? (
                            <AvatarImage src={profileData.profileImage} alt="Profile" />
                        ) : (
                            <AvatarFallback>
                                {profileData.fullName?.charAt(0) || appUser?.email?.charAt(0) || 'U'}
                            </AvatarFallback>
                        )}
                    </Avatar>
                    <div>
                        <Label htmlFor="photo" className="text-sm">Profile Photo</Label>
                        <div className="mt-1 flex items-center gap-2">
                            <Input id="photo" type="file" accept="image/*" onChange={handleImageUpload} className="h-9" />
                            <Button variant="outline" size="sm" onClick={() => setProfileData(p => ({...p, profileImage: ''}))}><X className="h-3 w-3 mr-1"/>Remove</Button>
                        </div>
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                        <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="fullName" className="pl-9" value={profileData.fullName} onChange={(e) => setProfileData(p => ({...p, fullName: e.target.value}))} />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="email" className="pl-9" value={profileData.email} disabled />
                    </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                    <div className="grid gap-2">
                        <Label htmlFor="phone">Phone</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input id="phone" className="pl-9" value={profileData.phone} onChange={(e) => setProfileData(p => ({...p, phone: e.target.value}))} />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="address">Address</Label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input id="address" className="pl-9" value={profileData.address} onChange={(e) => setProfileData(p => ({...p, address: e.target.value}))} />
                        </div>
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea id="bio" rows={3} value={profileData.bio} onChange={(e) => setProfileData(p => ({...p, bio: e.target.value}))} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setIsProfileOpen(false)}><X className="h-4 w-4 mr-2"/>Cancel</Button>
                    <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                        {isSavingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Save className="h-4 w-4 mr-2"/>}
                        Save Changes
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
