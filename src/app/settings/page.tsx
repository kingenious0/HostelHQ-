"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Header } from '@/components/header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, updateProfile, type User as FirebaseUser } from 'firebase/auth';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { loadSettings, saveSettings, clearLocalData, type ClientSettings } from '@/lib/clientSettings';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarSeparator, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import {
  Loader2,
  Calendar,
  CreditCard,
  Users,
  Banknote,
  Settings as SettingsIcon,
  LogOut,
  ChevronLeft,
  User,
  Shield,
  Eye,
  Palette,
  Database,
  AlertTriangle,
  Bell,
  CheckCircle
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface AppUser {
  uid: string;
  email: string;
  fullName: string;
  role: string;
  profileImage?: string;
  phone?: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [initialName, setInitialName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [privacySettings, setPrivacySettings] = useState({
    showPicture: true,
    showProfile: true,
    showProgrammeOfStudy: true,
    showPhoneNumber: true,
    showEmailAddress: true,
    roommateContactMode: 'phone' as 'phone' | 'whatsapp' | 'basic',
    whatsappNumber: '',
  });
  const [offlineSmsOptIn, setOfflineSmsOptIn] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        setAppUser(null);
        return;
      }

      const userDocRef = doc(db, "users", u.uid);
      const unsubFirestore = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setAppUser({
            uid: u.uid,
            email: u.email!,
            fullName: userData.fullName || u.displayName || '',
            role: userData.role || 'student',
            profileImage: userData.profileImage || u.photoURL || '',
          });
          setFullName(userData.fullName || u.displayName || '');
          setInitialName(userData.fullName || u.displayName || '');
          setPrivacySettings(userData.privacySettings || {
            showPicture: true,
            showProfile: true,
            showProgrammeOfStudy: true,
            showPhoneNumber: true,
            showEmailAddress: true,
            roommateContactMode: 'phone',
            whatsappNumber: userData.phone || '',
          });
          setOfflineSmsOptIn(!!userData.offlineSmsOptIn);
        }
        setLoading(false);
      });

      return () => unsubFirestore();
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const handleSave = async () => {
    if (!user) return;
    const name = fullName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { fullName: name });
      await updateProfile(user, { displayName: name });
      setInitialName(name);
      toast({ title: 'Profile Updated', description: 'Your display name has been saved.' });
    } catch (e) {
      toast({ title: 'Update Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrivacy = async (updatedPrivacy?: typeof privacySettings) => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { privacySettings: updatedPrivacy || privacySettings });
      toast({ title: 'Privacy Saved', description: 'Roommate preferences updated.' });
    } catch (e) {
      toast({ title: 'Save Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof typeof privacySettings, val: boolean) => {
    const next = { ...privacySettings, [key]: val };
    setPrivacySettings(next);
    handleSavePrivacy(next);
  };

  const updateAppearance = <K extends keyof ClientSettings['profile']>(key: K, value: any) => {
    if (!settings) return;
    const next = {
      ...settings,
      profile: { ...settings.profile, [key]: value }
    } as ClientSettings;
    setSettings(next);
    saveSettings(next);
    if (key === 'theme') {
      document.documentElement.classList.toggle('dark', value === 'dark');
    }
  };

  const navItems = [
    { label: 'My Bookings', href: '/my-bookings', icon: Calendar },
    { label: 'Payments', href: '/payments', icon: CreditCard },
    { label: 'My Roommates', href: '/my-roommates', icon: Users },
    { label: 'Bank Accounts', href: '/bank-accounts', icon: Banknote },
    { label: 'Settings', href: '/settings', icon: SettingsIcon },
  ];

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon" className="border-r border-border/50 bg-card/50 backdrop-blur-xl">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-primary/10">
                {appUser?.profileImage ? (
                  <AvatarImage src={appUser.profileImage} />
                ) : (
                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                    {appUser?.fullName?.charAt(0) || 'U'}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
                <span className="font-bold text-sm truncate">{appUser?.fullName || 'User'}</span>
                <span className="text-[10px] text-muted-foreground truncate">{appUser?.email}</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-2">System</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton asChild isActive={pathname === item.href} className={cn(
                        "transition-all duration-200",
                        pathname === item.href ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-primary/5 hover:text-primary"
                      )}>
                        <Link href={item.href} className="flex items-center gap-3 py-6">
                          <item.icon className="h-4 w-4" />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="flex flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-x-hidden pt-4 pb-24 md:pb-8">
            <div className="container mx-auto max-w-4xl px-4 sm:px-6">
              <div className="mb-10 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight text-foreground mb-2">Settings</h1>
                <p className="text-muted-foreground text-sm max-w-lg">Manage your identity, privacy, and app experience.</p>
              </div>

              <div className="space-y-8">
                {/* Profile Section */}
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <User className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-bold font-headline">Identity</h2>
                  </div>
                  <Card className="rounded-[2rem] border-transparent premium-shadow overflow-hidden bg-card/80 backdrop-blur-md">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Display Name</p>
                          <div className="flex gap-3">
                            <Input
                              value={fullName}
                              onChange={e => setFullName(e.target.value)}
                              className="rounded-xl h-12 bg-muted/20 border-border/40"
                              placeholder="Electronic Student Name"
                            />
                            <Button
                              disabled={!fullName.trim() || fullName === initialName || saving}
                              onClick={handleSave}
                              className="rounded-xl px-8 h-12 font-bold"
                            >
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                {/* Privacy Section */}
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="h-5 w-5 text-green-600" />
                    <h2 className="text-xl font-bold font-headline">Privacy & Safety</h2>
                  </div>
                  <Card className="rounded-[2rem] border-transparent premium-shadow overflow-hidden bg-card/80 backdrop-blur-md">
                    <CardContent className="p-6 divide-y divide-border/40">
                      {[
                        { id: 'showProfile', label: 'Public Profile Visibility', desc: 'Allows roommates to see your profile.' },
                        { id: 'showPicture', label: 'Show Profile Photo', desc: 'Display your picture to other students.' },
                        { id: 'showProgrammeOfStudy', label: 'Show Programme', desc: 'Share your academic details.' },
                        { id: 'showPhoneNumber', label: 'Share Phone Number', desc: 'Necessary for easy connection.' },
                      ].map((item) => (
                        <div key={item.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                          <div>
                            <p className="font-bold text-sm">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                          </div>
                          <Switch
                            checked={(privacySettings as any)[item.id]}
                            onCheckedChange={v => handleToggle(item.id as any, v)}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </section>

                {/* Appearance Section */}
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <Palette className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-bold font-headline">Appearance</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="rounded-3xl border-transparent premium-shadow bg-white/80 backdrop-blur-md">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm">Dark Mode</p>
                          <p className="text-[10px] text-muted-foreground">High contrast theme</p>
                        </div>
                        <Switch
                          checked={settings?.profile.theme === 'dark'}
                          onCheckedChange={v => updateAppearance('theme', v ? 'dark' : 'light')}
                        />
                      </CardContent>
                    </Card>
                    <Card className="rounded-3xl border-transparent premium-shadow bg-white/80 backdrop-blur-md">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm">Reduced Motion</p>
                          <p className="text-[10px] text-muted-foreground">Minimize animations</p>
                        </div>
                        <Switch
                          checked={!!settings?.profile.reducedMotion}
                          onCheckedChange={v => updateAppearance('reducedMotion', !!v)}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </section>

                {/* Data & Performance */}
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <Database className="h-5 w-5 text-blue-600" />
                    <h2 className="text-xl font-bold font-headline">Data & Cache</h2>
                  </div>
                  <Card className="rounded-[2rem] border-transparent premium-shadow overflow-hidden bg-card/80 backdrop-blur-md">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-sm">Cache Management</p>
                          <p className="text-xs text-muted-foreground">Free up space by clearing local hostel data.</p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="rounded-xl px-6 font-bold"
                          onClick={() => {
                            clearLocalData();
                            toast({ title: 'Cache Purged', description: 'Local storage has been cleared.' });
                          }}
                        >
                          Clear Local Data
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                <div className="pt-8 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">HostelHQ v2.4.0 • AAMUSTED Edition</p>
                </div>
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
