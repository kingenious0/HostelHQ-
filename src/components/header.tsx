
"use client";

import Link from 'next/link';
import Image from 'next/image';
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
  MessageSquare,
  CreditCard,
  Users,
  Banknote,
  Settings,
  Search,
  Home as HomeIcon,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { NotificationToggle } from '@/components/NotificationToggle';
import { NotificationBell } from '@/components/NotificationBell';
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
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
  authEmail?: string; // Original Firebase Auth email for password verification
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
  const [originalPhone, setOriginalPhone] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isOtpDialogOpen, setIsOtpDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordDialogType, setPasswordDialogType] = useState<'phone' | 'profile'>('profile');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    const storage = typeof window.localStorage !== 'undefined' ? window.localStorage : null;
    if (!storage || typeof storage.getItem !== 'function') return 'system';
    const stored = storage.getItem('hostelhq-theme') as ThemeMode | null;
    return stored ?? 'system';
  });
  const [fontScale, setFontScale] = useState<FontScale>('normal');
  const [uiScale, setUiScale] = useState<number>(100); // 70-130 range (percentage)
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
    // Make text size changes clearly visible
    const scale = value === 'large' ? 1.25 : value === 'xlarge' ? 1.5 : 1;
    console.log('[HostelHQ] applyFontScale', { value, scale });
    document.documentElement.style.setProperty('--font-scale', String(scale));
  }, []);

  const applyUiScale = useCallback((value: number) => {
    if (typeof document === 'undefined') return;
    const scale = value / 100; // Convert percentage to decimal (e.g., 80 -> 0.8)
    console.log('[HostelHQ] applyUiScale', { value, scale });
    document.documentElement.style.setProperty('--ui-scale', String(scale));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storage = typeof window.localStorage !== 'undefined' ? window.localStorage : null;
    if (!storage || typeof storage.getItem !== 'function') return;
    const stored = storage.getItem('hostelhq-font-scale') as FontScale | null;
    const initial = stored ?? 'normal';
    setFontScale(initial);
    applyFontScale(initial);
  }, [applyFontScale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storage = typeof window.localStorage !== 'undefined' ? window.localStorage : null;
    if (!storage || typeof storage.getItem !== 'function') return;
    const stored = storage.getItem('hostelhq-ui-scale');
    const initial = stored ? parseInt(stored, 10) : 100;
    setUiScale(initial);
    applyUiScale(initial);
  }, [applyUiScale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storage = typeof window.localStorage !== 'undefined' ? window.localStorage : null;
    if (!storage || typeof storage.setItem !== 'function') return;
    storage.setItem('hostelhq-theme', themeMode);
    applyTheme(themeMode);
  }, [themeMode, applyTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storage = typeof window.localStorage !== 'undefined' ? window.localStorage : null;
    if (!storage || typeof storage.setItem !== 'function') return;
    storage.setItem('hostelhq-font-scale', fontScale);
    applyFontScale(fontScale);
  }, [fontScale, applyFontScale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storage = typeof window.localStorage !== 'undefined' ? window.localStorage : null;
    if (!storage || typeof storage.setItem !== 'function') return;
    storage.setItem('hostelhq-ui-scale', String(uiScale));
    applyUiScale(uiScale);
  }, [uiScale, applyUiScale]);

  // Listen for custom event to open profile dialog
  useEffect(() => {
    const handleOpenProfileDialog = () => {
      setIsProfileOpen(true);
    };

    window.addEventListener('openProfileDialog', handleOpenProfileDialog);
    return () => window.removeEventListener('openProfileDialog', handleOpenProfileDialog);
  }, []);

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
              email: userData.email || user.email!,
              fullName: userData.fullName || user.displayName || '',
              role: userData.role || 'student',
              profileImage: userData.profileImage || user.photoURL || '',
              phone: userData.phoneNumber || userData.phone || '',
              address: userData.address || '',
              bio: userData.bio || '',
              authEmail: userData.authEmail || user.email!, // Store original auth email
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

  const handleEditProfile = async () => {
    if (!appUser) return;
    setIsProfileOpen(true);

    try {
      const userDocRef = doc(db, "users", appUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();

        // Check all possible phone field names (phoneNumber is the primary field from signup)
        const phone = userData.phoneNumber || userData.phone || appUser.phone || '';
        const fullName = userData.fullName || appUser.fullName || '';
        const email = userData.email || appUser.email || '';

        console.log('🔍 Profile Loading Debug:', {
          userData: userData,
          phone: phone,
          fullName: fullName,
          email: email,
          appUserPhone: appUser.phone,
          appUserFullName: appUser.fullName
        });

        // If we have phone but no email, generate it
        const displayEmail = email || (phone && fullName ? generateEmail(fullName, phone, appUser.role) : '');

        setProfileData({
          fullName: fullName,
          email: displayEmail,
          phone: phone,
          address: userData.address || '',
          bio: userData.bio || '',
          profileImage: userData.profileImage || appUser.profileImage || ''
        });

        // Store original values for comparison
        setOriginalPhone(phone);
        setOriginalName(fullName);
        console.log('📋 Profile loaded - setting originalName to:', fullName, 'phone:', phone);
      } else {
        // Fallback to appUser data
        const phone = appUser.phone || '';
        const fullName = appUser.fullName || '';
        const email = appUser.email || (phone && fullName ? generateEmail(fullName, phone, appUser.role) : '');

        setProfileData({
          fullName: fullName,
          email: email,
          phone: phone,
          address: '',
          bio: '',
          profileImage: appUser.profileImage || ''
        });
        setOriginalPhone(phone);
        setOriginalName(fullName);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

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

  // Generate email from name, phone, and role
  const generateEmail = (fullName: string, phone: string, role: string) => {
    if (!fullName || !phone || !role) return '';

    // Extract first 3 letters of name
    const nameNoSpaces = fullName.replace(/\s+/g, '');
    const namePart = nameNoSpaces.length >= 3
      ? nameNoSpaces.substring(0, 3).toLowerCase()
      : nameNoSpaces.toLowerCase().padEnd(3, 'x');

    // Extract last 3 digits of phone
    const digitsOnly = phone.replace(/\D/g, '');
    const phonePart = digitsOnly.length >= 3
      ? digitsOnly.slice(-3)
      : digitsOnly.padStart(3, '0');

    // Get role prefix
    let rolePrefix = 'stu'; // default
    if (role === 'agent' || role === 'pending_agent') {
      rolePrefix = 'agnt';
    } else if (role === 'hostel_manager') {
      rolePrefix = 'mng';
    } else if (role === 'admin') {
      rolePrefix = 'adm';
    }

    return `${rolePrefix}-${namePart}${phonePart}@hostelhq.com`;
  };

  const handleSaveProfile = async () => {
    if (!appUser) return;

    // Check what fields changed (normalize phone numbers for comparison)
    const normalizePhone = (phone: string) => phone?.replace(/\D/g, '') || '';

    // Handle case where originalPhone might be empty/undefined
    const currentPhoneNormalized = normalizePhone(profileData.phone || '');
    const originalPhoneNormalized = normalizePhone(originalPhone || '');

    // Phone field is read-only, so never detect phone changes
    const phoneChanged = false;
    const nameChanged = profileData.fullName !== originalName;
    const addressChanged = profileData.address !== (appUser.address || '');
    const bioChanged = profileData.bio !== (appUser.bio || '');

    console.log('🔍 Save Profile Debug:', {
      phoneChanged,
      nameChanged,
      addressChanged,
      bioChanged,
      currentPhone: profileData.phone,
      originalPhone: originalPhone,
      currentName: profileData.fullName,
      originalName: originalName,
      phoneComparison: {
        current: `"${profileData.phone}"`,
        original: `"${originalPhone}"`,
        areEqual: profileData.phone === originalPhone,
        currentType: typeof profileData.phone,
        originalType: typeof originalPhone,
        normalizedCurrent: normalizePhone(profileData.phone),
        normalizedOriginal: normalizePhone(originalPhone),
        normalizedEqual: normalizePhone(profileData.phone) === normalizePhone(originalPhone)
      }
    });

    // If phone changed, require password + OTP verification
    if (phoneChanged) {
      console.log('🔄 Phone changed - using phone flow - needs (password + OTP)');
      setNewPhone(profileData.phone || '');
      setPasswordDialogType('phone');
      setIsPasswordDialogOpen(true);
      return;
    }

    // If only name, address, or bio changed, require password verification only
    if (nameChanged || addressChanged || bioChanged) {
      console.log('👤 Profile changed - using profile flow (password only)', { nameChanged, addressChanged, bioChanged });
      setPasswordDialogType('profile');
      console.log('🔧 Set passwordDialogType to: profile');
      setIsPasswordDialogOpen(true);
      return;
    }

    setIsSavingProfile(true);
    try {
      const userDocRef = doc(db, "users", appUser.uid);
      const updateData: any = {
        fullName: profileData.fullName,
        phone: profileData.phone,
        phoneNumber: profileData.phone, // Store in both fields for compatibility
        address: profileData.address,
        bio: profileData.bio,
        profileImage: profileData.profileImage,
        updatedAt: new Date().toISOString()
      };

      // If name changed, update email
      if (nameChanged && profileData.phone) {
        const newEmail = generateEmail(profileData.fullName || '', profileData.phone, appUser.role);
        updateData.email = newEmail;

        toast({
          title: 'Email Updated',
          description: `Your email has been updated to ${newEmail}`
        });
      }

      await updateDoc(userDocRef, updateData);

      // Update appUser state to reflect changes immediately in header
      setAppUser(prev => prev ? { ...prev, ...profileData, email: updateData.email || prev.email } as AppUser : null);

      toast({ title: 'Profile updated successfully!' });
      setIsProfileOpen(false);
      setOriginalName(profileData.fullName || '');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ title: 'Failed to update profile', variant: 'destructive' });
    } finally {
      setIsSavingProfile(false);
    }
  };


  const handlePasswordVerify = async () => {
    if (!password || !appUser) {
      toast({ title: 'Please enter your password', variant: 'destructive' });
      return;
    }

    setIsVerifying(true);
    try {
      console.log('🔐 Phone Password verification debug:', {
        firebaseAuthEmail: auth.currentUser?.email,
        firestoreEmail: appUser?.email,
        authEmail: appUser?.authEmail,
        passwordLength: password.length
      });

      // Use the original authEmail for authentication if available
      const emailForAuth = appUser?.authEmail || auth.currentUser?.email || appUser.email;
      console.log('🔑 Using email for phone auth:', emailForAuth);

      // Import reauthenticateWithCredential and EmailAuthProvider
      const { reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth');
      const credential = EmailAuthProvider.credential(emailForAuth, password);

      await reauthenticateWithCredential(auth.currentUser!, credential);

      // Password verified, now send OTP
      setIsPasswordDialogOpen(false);
      setPassword('');

      // In production, you would send SMS OTP here
      // For now, we'll simulate it
      toast({
        title: 'Verification Code Sent',
        description: `A 6-digit code has been sent to ${newPhone}`
      });

      setIsOtpDialogOpen(true);
    } catch (error: any) {
      console.error('Password verification error:', error);
      toast({
        title: 'Incorrect Password',
        description: 'Please check your password and try again',
        variant: 'destructive'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePasswordVerifyForProfile = async () => {
    if (!password) {
      toast({ title: 'Please enter your password', variant: 'destructive' });
      return;
    }

    setIsVerifying(true);
    try {
      // Verify password with Firebase Auth using reauthentication
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('User not authenticated');
      }

      console.log('🔐 Password verification debug:', {
        firebaseAuthEmail: user.email,
        firestoreEmail: appUser?.email,
        authEmail: appUser?.authEmail,
        passwordLength: password.length
      });

      // Use the original authEmail for authentication if available
      const emailForAuth = appUser?.authEmail || user.email;
      console.log('🔑 Using email for auth:', emailForAuth);

      const { reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth');
      const credential = EmailAuthProvider.credential(emailForAuth, password);
      await reauthenticateWithCredential(user, credential);

      // Password verified, complete profile update
      setIsPasswordDialogOpen(false);
      setPassword('');
      await completeProfileUpdate();
    } catch (error: any) {
      console.error('Password verification error:', error);
      toast({
        title: 'Incorrect Password',
        description: 'Please check your password and try again',
        variant: 'destructive'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpVerify = async () => {
    if (!otp || otp.length !== 6) {
      toast({ title: 'Please enter the 6-digit code', variant: 'destructive' });
      return;
    }

    // OTP verified, complete phone number change directly
    setIsOtpDialogOpen(false);
    setOtp('');
    await completePhoneChange();
  };


  const completeProfileUpdate = async () => {
    setIsSavingProfile(true);
    try {
      const userDocRef = doc(db, "users", appUser!.uid);
      const nameChanged = profileData.fullName !== originalName;

      console.log('🔍 Profile Update Debug:', {
        currentName: profileData.fullName,
        originalName: originalName,
        nameChanged: nameChanged,
        phone: appUser!.phone,
        role: appUser!.role
      });

      const updateData: any = {
        fullName: profileData.fullName,
        address: profileData.address,
        bio: profileData.bio,
        profileImage: profileData.profileImage,
        updatedAt: new Date().toISOString()
      };

      // If name changed, update email (use current phone from appUser or profileData)
      if (nameChanged) {
        const currentPhone = appUser!.phone || profileData.phone || '';

        if (currentPhone) {
          const newEmail = generateEmail(profileData.fullName || '', currentPhone, appUser!.role);
          updateData.email = newEmail;
          console.log('📧 Updating email from name change:', newEmail, 'using phone:', currentPhone);

          // Note: We skip Firebase Auth email update to avoid verification requirements
          // The app uses Firestore data primarily, so this is sufficient
          console.log('ℹSkipping Firebase Auth email update to avoid verification requirement');

          toast({
            title: 'Email Updated',
            description: `Your email has been updated to ${newEmail}`
          });
        } else {
          console.log('⚠️ Cannot update email - no phone number available');
          console.log('🔍 Debug - appUser.phone:', appUser!.phone, 'profileData.phone:', profileData.phone);
        }
      }

      await updateDoc(userDocRef, updateData);

      // Update appUser state
      setAppUser(prev => {
        if (!prev) return null;
        const updatedEmail = updateData.email || prev.email || '';
        console.log('🔄 Updated appUser with new email:', updatedEmail);
        return {
          ...prev,
          fullName: profileData.fullName || prev.fullName,
          address: profileData.address || prev.address || '',
          bio: profileData.bio || prev.bio || '',
          profileImage: profileData.profileImage || prev.profileImage || '',
          email: updatedEmail
        };
      });

      // Update original values
      setOriginalName(profileData.fullName || '');

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully'
      });

      setIsProfileOpen(false);
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const completePhoneChange = async () => {
    try {
      const userDocRef = doc(db, "users", appUser!.uid);
      const newEmail = generateEmail(profileData.fullName || '', newPhone, appUser!.role);

      // Note: Skip Firebase Auth email update to avoid verification requirements
      // The app uses Firestore data primarily, so updating Firestore is sufficient
      console.log('ℹ️ Skipping Firebase Auth email update for phone change to avoid verification requirement');

      await updateDoc(userDocRef, {
        phone: newPhone,
        phoneNumber: newPhone,
        email: newEmail,
        fullName: profileData.fullName,
        address: profileData.address,
        bio: profileData.bio,
        profileImage: profileData.profileImage,
        updatedAt: new Date().toISOString()
      });

      // Update appUser state
      setAppUser(prev => prev ? {
        ...prev,
        ...profileData,
        phone: newPhone,
        email: newEmail
      } as AppUser : null);

      // Update profileData and original values
      setProfileData(prev => ({ ...prev, phone: newPhone, email: newEmail }));
      setOriginalPhone(newPhone);
      setOriginalName(profileData.fullName);

      toast({
        title: 'Profile Updated Successfully!',
        description: `Your email has been updated to ${newEmail}. All your bookings and data have been preserved.`
      });

      // Close all dialogs
      setIsProfileOpen(false);
      setNewPhone('');
      setIsVerifying(false);
    } catch (error) {
      console.error('Phone change error:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not update phone number. Please try again.',
        variant: 'destructive'
      });
      setIsVerifying(false);
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
        let lastToastTime = 0;
        locationWatcherId.current = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const agentGpsChannel = ablyClient.channels.get(`agent:${appUser.uid}:gps`);

            // Publish to Ably for real-time map updates
            agentGpsChannel.publish('location', { lat: latitude, lng: longitude });

            // Also update Firestore
            const userDocRef = doc(db, "users", appUser.uid);
            await updateDoc(userDocRef, {
              location: { lat: latitude, lng: longitude },
              lastActive: new Date().toISOString()
            });
          },
          (error) => {
            const now = Date.now();
            // Only toast once every 5 minutes to avoid spamming
            if (error.code === 1 && now - lastToastTime > 300000) {
              lastToastTime = now;
              toast({
                title: 'Location visibility limited',
                description: 'Enable location to help students find you on the map.',
                variant: 'default'
              });
            }
          },
          { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
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

  // Role helpers
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

  /* Base links are always visible */
  const navLinks = baseNavLinks;

  /* Manageable links (consolidated into a dropdown for cleaner UI) */
  const manageLinks: { label: string; href: string; icon?: React.ReactNode }[] = [];
  if (isAgent) {
    manageLinks.push(
      { label: 'Dashboard', href: '/agent/dashboard', icon: <LayoutDashboard className="mr-2 h-4 w-4" /> },
      { label: 'My Listings', href: '/agent/listings', icon: <ListPlus className="mr-2 h-4 w-4" /> },
      { label: 'Create Manager', href: '/agent/create-manager', icon: <UserPlus className="mr-2 h-4 w-4" /> }
    );
  }
  if (isAdmin) {
    manageLinks.push(
      { label: 'Admin Console', href: '/admin/dashboard', icon: <LayoutDashboard className="mr-2 h-4 w-4" /> },
      { label: 'All Listings', href: '/admin/listings', icon: <ListPlus className="mr-2 h-4 w-4" /> },
      { label: 'Hostel Requests', href: '/admin/hostel-requests', icon: <FileText className="mr-2 h-4 w-4" /> },
      { label: 'Payment Accounts', href: '/admin/bank-accounts', icon: <Banknote className="mr-2 h-4 w-4" /> }
    );
  }
  if (isManager) {
    manageLinks.push({ label: 'Manager Console', href: '/manager/dashboard', icon: <Building className="mr-2 h-4 w-4" /> });
  }

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
    <header className="sticky top-0 z-50 transition-all duration-300">
      <div className="border-b border-border/40 transition-all bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-20 items-center justify-between gap-2 px-2 sm:h-24 sm:gap-4 sm:px-6">
          <div className="flex flex-1 items-center gap-3">
            <Sheet open={isNavOpen} onOpenChange={setIsNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden transition-transform active:scale-95" aria-label="Open navigation">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 text-lg">
                    <div className="relative h-14 w-[180px]">
                      <Image
                        src="/HostelHQ Web App Logo.png"
                        alt="HostelHQ"
                        fill
                        sizes="180px"
                        className="object-contain object-left"
                        priority
                      />
                    </div>
                  </SheetTitle>
                  <SheetDescription className="text-left mt-2">Find your next home with confidence.</SheetDescription>
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

                <div className="mt-auto pb-6 space-y-4">
                  {/* Notification Toggle in Mobile Sidebar */}
                  {appUser && (
                    <div className="mt-4">
                      <NotificationToggle />
                    </div>
                  )}

                  <div className="space-y-3">
                    <Link href="tel:+233201234567" className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 text-primary" />
                      233 (0) 597626090 / 233 (0) 536 282 694
                    </Link>
                    <Link href="mailto:hostelhqghana@gmail.com" className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 text-primary" />
                      hostelhqghana@gmail.com
                    </Link>
                  </div>
                </div>

                {/* UI Scale Slider in Mobile Sidebar */}
                <div className="mt-6 border-t pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">UI Scale ({uiScale}%)</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">A</span>
                    <Slider
                      value={[uiScale]}
                      onValueChange={(values) => setUiScale(values[0])}
                      min={70}
                      max={130}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium text-muted-foreground">A</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">Smaller</span>
                    <button
                      onClick={() => setUiScale(100)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Reset
                    </button>
                    <span className="text-[10px] text-muted-foreground">Larger</span>
                  </div>
                </div>

                {/* Notification Toggle in Mobile Sidebar */}
                {appUser && (
                  <div className="mt-4">
                    <NotificationToggle />
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <Link href="tel:+233201234567" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 text-primary" />
                    233 (0) 597626090 / 233 (0) 536 282 694
                  </Link>
                  <Link href="mailto:hostelhqghana@gmail.com" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 text-primary" />
                    hostelhqghana@gmail.com
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
            <Link href="/" className="flex items-center gap-1 sm:gap-2 shrink-1 min-w-0" aria-label="HostelHQ home">
              <div className="relative h-10 w-[140px] sm:h-14 sm:w-[200px] md:h-16 md:w-[280px] lg:h-[72px] lg:w-[320px]">
                <Image
                  src="/HostelHQ Web App Logo.png"
                  alt="HostelHQ"
                  fill
                  sizes="(max-width: 640px) 140px, (max-width: 768px) 200px, (max-width: 1024px) 280px, 320px"
                  className="object-contain object-left"
                  priority
                />
              </div>
            </Link>
          </div>
          <nav className="hidden flex-1 items-center justify-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link key={`${link.href}-${link.label}`} href={link.href} className={navLinkClasses(link.href)}>
                {link.label}
              </Link>
            ))}

            {(isAgent || isAdmin || isManager) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 flex items-center gap-1.5 focus:outline-none focus:ring-0">
                    Manage <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56 rounded-2xl p-2 border-border/40 shadow-2xl backdrop-blur-xl">
                  {manageLinks.map((link) => (
                    <DropdownMenuItem key={link.href} asChild className="rounded-xl cursor-pointer">
                      <Link href={link.href} className="flex items-center">
                        {link.icon}
                        <span>{link.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>
          <div className="flex flex-1 items-center justify-end gap-3">
            {!loading && appUser && (
              <NotificationBell />
            )}
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
                    <DropdownMenuItem onClick={() => setIsProfileOpen(true)} data-profile-trigger>
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <NotificationToggle />
                    </DropdownMenuItem>
                    {isStudent && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/my-bookings">
                            <Briefcase className="mr-2 h-4 w-4" />
                            My Bookings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/settings">
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/help-center">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Help Center
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('openHostie'))}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      <span>Chat with Hostie</span>
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
                        <DropdownMenuItem asChild>
                          <Link href="/admin/bank-accounts">
                            <Banknote className="mr-2 h-4 w-4" />
                            Payment Accounts
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {isManager && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/manager/dashboard">
                            <Building className="mr-2 h-4 w-4" />
                            Manager Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/manager/bank-accounts">
                            <Banknote className="mr-2 h-4 w-4" />
                            Payment Accounts
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <div className="px-2 py-3 bg-muted/30 rounded-xl mx-1 mb-1 border border-border/40">
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <MonitorCog className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Display Settings</span>
                      </div>

                      <div className="space-y-4">
                        {/* Theme Grid */}
                        <div className="grid grid-cols-3 gap-1">
                          {themeOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setThemeMode(option.value); }}
                              className={cn(
                                "flex flex-col items-center justify-center gap-1.5 rounded-lg py-2 transition-all",
                                themeMode === option.value
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "bg-background/50 text-muted-foreground hover:bg-background hover:text-foreground border border-transparent hover:border-border/60"
                              )}
                            >
                              {option.icon}
                              <span className="text-[10px] font-medium">{option.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Text Size Slider - Better for mobile than buttons */}
                        <div className="px-1">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Text Size</span>
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-bold lowercase italic">{fontScale}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground font-medium">A</span>
                            <Slider
                              value={[fontScale === 'normal' ? 0 : fontScale === 'large' ? 1 : 2]}
                              onValueChange={(values) => {
                                const scales: FontScale[] = ['normal', 'large', 'xlarge'];
                                setFontScale(scales[values[0]]);
                              }}
                              max={2}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-lg text-muted-foreground font-medium leading-none">A</span>
                          </div>
                        </div>

                        {/* UI Scale */}
                        <div className="px-1 border-t border-border/30 pt-3">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">UI Scale: {uiScale}%</span>
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUiScale(100); }}
                              className="text-[9px] font-bold text-primary hover:underline hover:text-primary/80 uppercase"
                            >
                              Reset
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <Slider
                              value={[uiScale]}
                              onValueChange={(values) => setUiScale(values[0])}
                              min={70}
                              max={130}
                              step={5}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
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
                    <DropdownMenuLabel className="mt-1 text-xs text-muted-foreground">UI Scale ({uiScale}%)</DropdownMenuLabel>
                    <div className="px-3 pb-3 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">A</span>
                        <Slider
                          value={[uiScale]}
                          onValueChange={(values) => setUiScale(values[0])}
                          min={70}
                          max={130}
                          step={5}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium text-muted-foreground">A</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground">Smaller</span>
                        <button
                          onClick={() => setUiScale(100)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Reset
                        </button>
                        <span className="text-[10px] text-muted-foreground">Larger</span>
                      </div>
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation - 95% of users */}
      <div className="fixed bottom-0 left-0 z-50 w-full h-16 md:hidden">
        <div className="grid h-full max-w-lg grid-cols-5 mx-auto mobile-nav-blur border-t px-1">
          <Link href="/" className={cn("inline-flex flex-col items-center justify-center group", pathname === '/' ? 'text-primary' : 'text-muted-foreground')}>
            <HomeIcon className={cn("w-5 h-5 mb-1 transition-transform group-active:scale-90", pathname === '/' && "animate-pulse")} />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href={appUser ? "/my-bookings" : "/login"} className={cn("inline-flex flex-col items-center justify-center group", pathname === '/my-bookings' ? 'text-primary' : 'text-muted-foreground')}>
            <Briefcase className="w-5 h-5 mb-1 group-active:scale-90" />
            <span className="text-[10px] font-medium">Bookings</span>
          </Link>
          <Link href={appUser ? "/payments" : "/login"} className={cn("inline-flex flex-col items-center justify-center group", pathname === '/payments' ? 'text-primary' : 'text-muted-foreground')}>
            <CreditCard className="w-5 h-5 mb-1 group-active:scale-90" />
            <span className="text-[10px] font-medium">Payments</span>
          </Link>
          <Link href={appUser ? "/my-roommates" : "/login"} className={cn("inline-flex flex-col items-center justify-center group", pathname === '/my-roommates' ? 'text-primary' : 'text-muted-foreground')}>
            <Users className="w-5 h-5 mb-1 group-active:scale-90" />
            <span className="text-[10px] font-medium">Roommates</span>
          </Link>
          <Link
            href={appUser ? "/profile" : "/login"}
            className={cn("inline-flex flex-col items-center justify-center group", pathname === '/profile' ? 'text-primary' : 'text-muted-foreground')}
          >
            <div className="relative mb-1">
              <Avatar className="h-5 w-5 border border-primary/20 transition-transform group-active:scale-90">
                {appUser?.profileImage ? (
                  <AvatarImage src={appUser.profileImage} />
                ) : (
                  <AvatarFallback className="text-[8px] font-bold">{appUser?.fullName?.charAt(0) || 'U'}</AvatarFallback>
                )}
              </Avatar>
            </div>
            <span className="text-[10px] font-medium">Profile</span>
          </Link>
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
                  <Button variant="outline" size="sm" onClick={() => setProfileData(p => ({ ...p, profileImage: '' }))}><X className="h-3 w-3 mr-1" />Remove</Button>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="fullName" className="pl-9" value={profileData.fullName} onChange={(e) => setProfileData(p => ({ ...p, fullName: e.target.value }))} />
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
                  <Input
                    id="phone"
                    className="pl-9 bg-muted/50 text-foreground placeholder:text-muted-foreground"
                    value={profileData.phone}
                    readOnly
                    placeholder="Phone number (contact admin to change)"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  📞 To change your phone number, please contact support for security verification.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="address" className="pl-9" value={profileData.address} onChange={(e) => setProfileData(p => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" rows={3} value={profileData.bio} onChange={(e) => setProfileData(p => ({ ...p, bio: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsProfileOpen(false)}><X className="h-4 w-4 mr-2" />Cancel</Button>
              <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Password Verification Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>🔒 Verify Your Password</DialogTitle>
            <DialogDescription>
              Please enter your original account password to save your profile changes.
              {passwordDialogType === 'profile' && (
                <span className="block text-sm text-blue-600 mt-1">
                  💡 Use your original password, even if your email ID is changing.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (passwordDialogType === 'phone' ? handlePasswordVerify() : handlePasswordVerifyForProfile())}
                placeholder="Enter your password"
                autoFocus
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setIsPasswordDialogOpen(false);
              setPassword('');
            }}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={passwordDialogType === 'phone' ? handlePasswordVerify : handlePasswordVerifyForProfile} disabled={isVerifying}>
              {isVerifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Verify
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* OTP Verification Dialog */}
      <Dialog open={isOtpDialogOpen} onOpenChange={setIsOtpDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>📱 Enter Verification Code</DialogTitle>
            <DialogDescription>
              We've sent a 6-digit code to {newPhone}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleOtpVerify()}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                For testing, enter any 6-digit code
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setIsOtpDialogOpen(false);
              setOtp('');
              setProfileData(p => ({ ...p, phone: originalPhone }));
            }}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleOtpVerify} disabled={isVerifying || otp.length !== 6}>
              {isVerifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Verify & Update
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </header>
  );
}
