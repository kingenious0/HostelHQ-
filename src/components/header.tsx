
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Hotel,
  User,
  LogOut,
  Loader2,
  LayoutDashboard,
  ListPlus,
  UserPlus,
  Briefcase,
  Building,
  Save,
  X,
  Phone,
  MapPin,
  Mail,
  UserCheck,
  Menu,
  HelpCircle,
  Check,
  Sun,
  Moon,
  MonitorCog,
  FileText,
  ChevronDown,
  CreditCard,
  Users,
  Banknote,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/lib/cloudinary';
import { auth, db } from '@/lib/firebase';
import { ably } from '@/lib/ably';
import { cn } from '@/lib/utils';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';

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

type ThemeMode = 'light' | 'dark' | 'system';
type FontScale = 'normal' | 'large' | 'xlarge';

export function Header() {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authAction, setAuthAction] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [profileData, setProfileData] = useState<Partial<AppUser>>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    profileImage: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [fontScale, setFontScale] = useState<FontScale>('normal');
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const locationWatcherId = useRef<number | null>(null);
  const agentPresenceChannel = useRef<any>(null);
  const applyTheme = useCallback((value: ThemeMode) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = value === 'dark' || (value === 'system' && prefersDark);
    document.documentElement.classList.remove('light', 'dark');
    if (shouldUseDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light');
    }
  }, []);

  const applyFontScale = useCallback((value: FontScale) => {
    if (typeof document === 'undefined') return;
    const scale = value === 'large' ? 1.1 : value === 'xlarge' ? 1.25 : 1;
    document.documentElement.style.setProperty('--font-scale', String(scale));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('hostelhq-theme') as ThemeMode | null;
    const initial = stored ?? 'light';
    setThemeMode(initial);
    applyTheme(initial);
  }, [applyTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('hostelhq-font-scale') as FontScale | null;
    const initial = stored ?? 'normal';
    setFontScale(initial);
    applyFontScale(initial);
  }, [applyFontScale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('hostelhq-theme', themeMode);
    applyTheme(themeMode);
  }, [themeMode, applyTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('hostelhq-font-scale', fontScale);
    applyFontScale(fontScale);
  }, [fontScale, applyFontScale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (themeMode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme('system');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [themeMode, applyTheme]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const ablyClient = ably;
        if (ablyClient?.auth) {
          const authOptions = ((ablyClient.auth as any).options ??= {});
          authOptions.clientId = user.uid;
        }

        const userDocRef = doc(db, "users", user.uid);
        const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap: any) => {
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
        }, (error: any) => {
          console.error("Error listening to user document:", error);
          setLoading(false);
        });
        return () => unsubscribeFirestore(); // Unsubscribe from Firestore listener
      } else {
        const ablyClient = ably;
        if (ablyClient?.auth && (ablyClient.auth as any).options) {
          (ablyClient.auth as any).options.clientId = undefined;
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
    const ablyClient = ably;
    if (appUser?.role === 'agent' && ablyClient) {
      // --- Enter Presence ---
      agentPresenceChannel.current = ablyClient.channels.get('agents:live');
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
            const agentGpsChannel = ablyClient.channels.get(`agent:${appUser.uid}:gps`);
            
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

  const baseNavLinks = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'All Hostels', href: '/#all-hostels' },
  ];

  const fontSizeOptions: { value: FontScale; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'large', label: 'Large' },
    { value: 'xlarge', label: 'Extra large' },
  ];

  const roleNavLinks: { label: string; href: string }[] = [];

  if (isStudent) {
    roleNavLinks.push(
      { label: 'My Bookings', href: '/my-bookings' },
      { label: 'Payments', href: '/payments' },
    );
  }
  if (isAgent) {
    roleNavLinks.push(
      { label: 'Agent Dashboard', href: '/agent/dashboard' },
      { label: 'My Listings', href: '/agent/listings' }
    );
  }
  if (isAdmin) {
    roleNavLinks.push(
      { label: 'Admin Console', href: '/admin/dashboard' },
      { label: 'Admin Listings', href: '/admin/listings' },
    );
  }
  if (isManager) {
    roleNavLinks.push({ label: 'Manager Console', href: '/manager/dashboard' });
  }

  const navLinks = [...baseNavLinks, ...roleNavLinks];

  const themeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'system', label: 'System', icon: <MonitorCog className="h-4 w-4" /> },
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  ];

  const navLinkClasses = (href: string) =>
    cn(
      'rounded-full px-4 py-2 text-sm font-medium transition-colors',
      pathname === href
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
    );

  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-3 sm:h-20 sm:px-6">
          <div className="flex flex-1 items-center gap-3">
            <Sheet open={isNavOpen} onOpenChange={setIsNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 text-lg">
                    <Hotel className="h-5 w-5 text-primary" />
                    HostelHQ
                  </SheetTitle>
                  <SheetDescription>Curated hostels, transparent pricing, and trusted support for students.</SheetDescription>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-2">
                  {baseNavLinks.map((link) => (
                    <SheetClose asChild key={`${link.href}-${link.label}`}>
                      <Link
                        href={link.href}
                        onClick={() => setIsNavOpen(false)}
                        className={cn(
                          'rounded-lg px-3 py-2 text-sm font-medium transition',
                          pathname === link.href
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'
                        )}
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>

                {isStudent && (
                  <div className="mt-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="w-full justify-between rounded-full bg-primary/5 text-primary hover:bg-primary/10">
                          <span>My Bookings</span>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <SheetClose asChild>
                          <DropdownMenuItem asChild>
                            <Link href="/profile">
                              <User className="mr-2 h-4 w-4" />
                              <span>My Profile</span>
                            </Link>
                          </DropdownMenuItem>
                        </SheetClose>
                        <SheetClose asChild>
                          <DropdownMenuItem asChild>
                            <Link href="/my-bookings">
                              <Briefcase className="mr-2 h-4 w-4" />
                              <span>My Bookings</span>
                            </Link>
                          </DropdownMenuItem>
                        </SheetClose>
                        <SheetClose asChild>
                          <DropdownMenuItem asChild>
                            <Link href="/payments">
                              <CreditCard className="mr-2 h-4 w-4" />
                              <span>Payments</span>
                            </Link>
                          </DropdownMenuItem>
                        </SheetClose>
                        <SheetClose asChild>
                          <DropdownMenuItem asChild>
                            <Link href="/my-roommates">
                              <Users className="mr-2 h-4 w-4" />
                              <span>My Roommates</span>
                            </Link>
                          </DropdownMenuItem>
                        </SheetClose>
                        <SheetClose asChild>
                          <DropdownMenuItem asChild>
                            <Link href="/bank-accounts">
                              <Banknote className="mr-2 h-4 w-4" />
                              <span>Bank Accounts</span>
                            </Link>
                          </DropdownMenuItem>
                        </SheetClose>
                        <SheetClose asChild>
                          <DropdownMenuItem asChild>
                            <Link href="/settings">
                              <Settings className="mr-2 h-4 w-4" />
                              <span>Settings</span>
                            </Link>
                          </DropdownMenuItem>
                        </SheetClose>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  <Link href="tel:+233201234567" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 text-primary" />
                    +233 (0) 20 123 4567
                  </Link>
                  <Link href="mailto:support@hostelhq.africa" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 text-primary" />
                    support@hostelhq.africa
                  </Link>
                  {!appUser && !loading && (
                    <div className="flex gap-2 pt-2">
                      <SheetClose asChild>
                        <Button asChild variant="outline" className="flex-1">
                          <Link href="/login">Login</Link>
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button asChild className="flex-1">
                          <Link href="/signup">Sign Up</Link>
                        </Button>
                      </SheetClose>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/" className="flex items-center gap-2">
              <Hotel className="h-6 w-6 text-primary sm:h-8 sm:w-8" />
              <span className="text-xl font-bold text-foreground font-headline sm:text-2xl">HostelHQ</span>
            </Link>
          </div>
          <nav className="hidden flex-1 items-center justify-center gap-2 md:flex">
            {navLinks.map((link) => (
              <Link key={`${link.href}-${link.label}`} href={link.href} className={navLinkClasses(link.href)}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-1 items-center justify-end gap-3">
            {!loading && !appUser && (
              <>
                <Button asChild variant="ghost" className="hidden md:inline-flex">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild className="hidden rounded-full md:inline-flex">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={loading}>
                  {loading || authAction ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
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
              <DropdownMenuContent align="end" className="w-56 max-h-[calc(100vh-4rem)] overflow-y-auto">
                    {appUser ? (
                  <>
                    <DropdownMenuLabel>
                      <div className="font-semibold">{appUser.fullName}</div>
                      <p className="text-xs text-muted-foreground font-normal">{appUser.email}</p>
                      {isPending && <Badge variant="secondary" className="mt-1">Pending Approval</Badge>}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    {isStudent && (
                      <DropdownMenuItem asChild>
                        <Link href="/my-bookings">
                          <Briefcase className="mr-2 h-4 w-4" />
                          My Bookings
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/help-center">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Help Center
                      </Link>
                    </DropdownMenuItem>
                    {isAgent && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/agent/dashboard">
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/agent/listings">
                            <ListPlus className="mr-2 h-4 w-4" />
                            My Listings
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/dashboard">
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/listings">
                            <ListPlus className="mr-2 h-4 w-4" />
                            Admin Listings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/hostel-requests">
                            <FileText className="mr-2 h-4 w-4" />
                            Hostel Requests
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/brands">
                            <Building className="mr-2 h-4 w-4" />
                            Brand Partners
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {isManager && (
                      <DropdownMenuItem asChild>
                        <Link href="/manager/dashboard">
                          <Building className="mr-2 h-4 w-4" />
                          Manager Dashboard
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
                    <div className="space-y-1 px-1 pb-1">
                      {themeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setThemeMode(option.value)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                            themeMode === option.value ? "bg-primary/5 text-primary" : "text-foreground hover:bg-muted"
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background">
                              {option.icon}
                            </span>
                            {option.label}
                          </span>
                          {themeMode === option.value && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                    <DropdownMenuLabel className="mt-1 text-xs text-muted-foreground">Text size</DropdownMenuLabel>
                    <div className="space-y-1 px-1 pb-2">
                      {fontSizeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFontScale(option.value)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors",
                            fontScale === option.value ? "bg-primary/5 text-primary" : "text-foreground hover:bg-muted"
                          )}
                        >
                          <span>{option.label}</span>
                          {fontScale === option.value && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      ))}
                    </div>
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
                      <Link href="/login">
                        <User className="mr-2 h-4 w-4" />
                        Login
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/signup">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Sign Up
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
                    <div className="space-y-1 px-1 pb-1">
                      {themeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setThemeMode(option.value)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                            themeMode === option.value ? "bg-primary/5 text-primary" : "text-foreground hover:bg-muted"
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background">
                              {option.icon}
                            </span>
                            {option.label}
                          </span>
                          {themeMode === option.value && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
