"use client";

import { useEffect, useState } from 'react';
import { Header } from '@/components/header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, updateProfile, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { loadSettings, saveSettings, clearLocalData, type ClientSettings } from '@/lib/clientSettings';
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
  privacySettings?: {
    showPicture: boolean;
    showProfile: boolean;
    showProgrammeOfStudy: boolean;
    showPhoneNumber: boolean;
    showEmailAddress: boolean;
    roommateContactMode?: 'phone' | 'whatsapp' | 'basic';
    whatsappNumber?: string;
  };
  offlineSmsOptIn?: boolean;
}

export default function SettingsPage() {
    const { toast } = useToast();
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
                    const userData = docSnap.data() as AppUser;
                    setAppUser({
                        uid: u.uid,
                        email: u.email!,
                        fullName: userData.fullName || u.displayName || '',
                        role: userData.role || 'student',
                        profileImage: userData.profileImage || u.photoURL || '',
                        phone: userData.phone || '',
                        address: userData.address || '',
                        bio: userData.bio || '',
                        nationality: userData.nationality || '',
                        gender: userData.gender || '',
                        privacySettings: userData.privacySettings,
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
                } else {
                    // If user exists in Auth but not in DB, create a basic profile
                    const newUser: AppUser = {
                        uid: u.uid,
                        email: u.email!,
                        fullName: u.displayName || '',
                        role: 'student', // Default role
                        profileImage: u.photoURL || '',
                    };
                    updateDoc(userDocRef, newUser, { merge: true }); // Create initial user doc
                    setAppUser(newUser);
                    setFullName(newUser.fullName);
                    setInitialName(newUser.fullName);
                    setPrivacySettings({
                      showPicture: true,
                      showProfile: true,
                      showProgrammeOfStudy: true,
                      showPhoneNumber: true,
                      showEmailAddress: true,
                      roommateContactMode: 'phone',
                      whatsappNumber: '',
                    });
                    setOfflineSmsOptIn(false);
                }
                setLoading(false);
            }, (error) => {
                console.error("Error fetching user profile:", error);
                toast({ title: "Error loading profile", variant: 'destructive' });
                setLoading(false);
            });

            return () => unsubFirestore();
        });
        return () => unsubAuth();
    }, []);

    const canSave = user && fullName.trim() && fullName.trim() !== initialName.trim() && !saving;
    const canSavePrivacy = user && !loading && !saving; // Simplistic check for now

    useEffect(() => {
        // Load client-side UI settings (theme, data usage) after mount to avoid hydration mismatch
        const clientSettings = loadSettings();
        setSettings(clientSettings);
    }, []);

    const handleSave = async () => {
        if (!user) return;
        const name = fullName.trim();
        if (!name) return;
        setSaving(true);
        try {
            // Optimistic UI
            setInitialName(name);

            // Persist minimal server-side: update users doc and auth displayName
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { fullName: name });
            await updateProfile(user, { displayName: name }).catch(() => {});

            toast({ title: 'Name updated' });
        } catch (e) {
            setInitialName(fullName); // revert optimistic change if needed
            toast({ title: 'Failed to update name', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleSavePrivacy = async () => {
      if (!user) return;
      setSaving(true);
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { privacySettings: privacySettings });
        toast({ title: 'Privacy settings updated' });
      } catch (e) {
        console.error("Error saving privacy settings:", e);
        toast({ title: 'Failed to update privacy settings', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    };

    const handleRoommateContactModeClick = (mode: 'phone' | 'whatsapp' | 'basic') => {
      if (!user) return;

      if (mode === 'whatsapp') {
        try {
          const existing = privacySettings.whatsappNumber || appUser?.phone || '';
          const input = window.prompt('Enter your WhatsApp number (include country code)', existing);
          if (!input) return;
          const cleaned = input.replace(/[^0-9+]/g, '');
          if (!cleaned) return;
          setPrivacySettings(prev => ({
            ...prev,
            roommateContactMode: 'whatsapp',
            whatsappNumber: cleaned,
          }));
          handleSavePrivacy();
        } catch {
          // ignore prompt errors
        }
        return;
      }

      setPrivacySettings(prev => ({
        ...prev,
        roommateContactMode: mode,
      }));
      handleSavePrivacy();
    };

    const updateSetting = <K extends keyof ClientSettings>(section: K, updater: (prev: ClientSettings[K]) => ClientSettings[K]) => {
        if (!settings) return; // Ignore updates until settings are loaded
        const nextSection = updater(settings[section]);
        const next = { ...settings, [section]: nextSection } as ClientSettings;
        setSettings(next);
        saveSettings(next);
        
        // Apply theme change immediately
        if (section === 'profile' && 'theme' in nextSection) {
            const newTheme = (nextSection as any).theme;
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
        }
    };

    const handlePrivacyToggle = (key: keyof AppUser['privacySettings'], checked: boolean) => {
      setPrivacySettings(prev => ({
        ...prev,
        [key]: checked,
      }));
    };

    const handleOfflineSmsToggle = async (checked: boolean) => {
      if (!user) return;
      setSaving(true);
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { offlineSmsOptIn: checked });
        setOfflineSmsOptIn(checked);
        toast({
          title: checked ? 'Offline SMS enabled' : 'Offline SMS disabled',
          description: checked
            ? 'Students can select you while you are offline and you will receive SMS alerts.'
            : 'Students will only be able to select you when you are online.',
        });
      } catch (e) {
        console.error('Error updating offline SMS preference:', e);
        toast({ title: 'Failed to update agent notification setting', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50">
            <Header />
            <main className="flex-1 p-8 max-w-2xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <BackButton />
                    <h1 className="text-2xl font-bold">Settings</h1>
                </div>
                <p className="text-muted-foreground mt-2">Update your preferences here.</p>

                <div className="mt-8 space-y-8">
                    <div>
                        <h2 className="text-lg font-semibold">Profile</h2>
                        <p className="text-sm text-muted-foreground">This updates only your display name.</p>
                        <div className="mt-4 flex items-center gap-3">
                            <Input
                                placeholder="Full name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                disabled={loading || saving}
                            />
                            <Button onClick={handleSave} disabled={!canSave}>
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>

                    {/* General profile sharing controls */}
                    <div>
                        <h2 className="text-lg font-semibold">Profile sharing</h2>
                        <p className="text-sm text-muted-foreground">Choose what parts of your profile your roommates and hostel mates can see.</p>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Show picture</p>
                                    <p className="text-sm text-muted-foreground">Allow others to see your profile photo.</p>
                                </div>
                                <Switch
                                    checked={privacySettings.showPicture}
                                    onCheckedChange={(v) => handlePrivacyToggle('showPicture', v)}
                                    disabled={loading || saving}
                                />
                            </div>

                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Show profile</p>
                                    <p className="text-sm text-muted-foreground">Turn this off to hide your profile completely from roommate lists.</p>
                                </div>
                                <Switch
                                    checked={privacySettings.showProfile}
                                    onCheckedChange={(v) => handlePrivacyToggle('showProfile', v)}
                                    disabled={loading || saving}
                                />
                            </div>

                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Show programme & level</p>
                                    <p className="text-sm text-muted-foreground">Share your programme of study and level.</p>
                                </div>
                                <Switch
                                    checked={privacySettings.showProgrammeOfStudy}
                                    onCheckedChange={(v) => handlePrivacyToggle('showProgrammeOfStudy', v)}
                                    disabled={loading || saving}
                                />
                            </div>

                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Show phone number</p>
                                    <p className="text-sm text-muted-foreground">Let roommates see your phone when contact mode allows it.</p>
                                </div>
                                <Switch
                                    checked={privacySettings.showPhoneNumber}
                                    onCheckedChange={(v) => handlePrivacyToggle('showPhoneNumber', v)}
                                    disabled={loading || saving}
                                />
                            </div>

                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Show email address</p>
                                    <p className="text-sm text-muted-foreground">Allow roommates to see your email.</p>
                                </div>
                                <Switch
                                    checked={privacySettings.showEmailAddress}
                                    onCheckedChange={(v) => handlePrivacyToggle('showEmailAddress', v)}
                                    disabled={loading || saving}
                                />
                            </div>
                        </div>
                        <div className="mt-3">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleSavePrivacy}
                                disabled={!canSavePrivacy}
                            >
                                {saving ? 'Saving...' : 'Save profile sharing'}
                            </Button>
                        </div>
                    </div>

                    {/* Privacy settings for roommates / hostel mates */}
                    <div>
                      <h2 className="text-lg font-semibold">Roommates &amp; hostel mates</h2>
                      <p className="text-sm text-muted-foreground">
                        Control how much contact information your roommates and hostel mates can see.
                      </p>
                      <div className="mt-4 space-y-4 border rounded-md p-4">
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">Roommate contact visibility</p>
                          <p className="text-sm text-muted-foreground">This affects how your details appear on the My Roommates and Hostel Mates pages.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={privacySettings.roommateContactMode === 'phone' ? 'default' : 'outline'}
                            onClick={() => handleRoommateContactModeClick('phone')}
                            disabled={loading || saving}
                          >
                            Show phone to roommates
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={privacySettings.roommateContactMode === 'whatsapp' ? 'default' : 'outline'}
                            onClick={() => handleRoommateContactModeClick('whatsapp')}
                            disabled={loading || saving}
                          >
                            WhatsApp only
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={privacySettings.roommateContactMode === 'basic' ? 'default' : 'outline'}
                            onClick={() => handleRoommateContactModeClick('basic')}
                            disabled={loading || saving}
                          >
                            Name &amp; programme only
                          </Button>
                        </div>
                        <div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleSavePrivacy}
                            disabled={!canSavePrivacy}
                          >
                            {saving ? 'Saving...' : 'Save roommate privacy'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {appUser?.role === 'agent' && (
                      <div>
                        <h2 className="text-lg font-semibold">Agent notifications</h2>
                        <p className="text-sm text-muted-foreground">Control whether students can select you for visits while you are offline.</p>
                        <div className="mt-4 flex items-center justify-between border rounded-md p-3">
                          <div>
                            <p className="font-medium">Allow offline visit requests</p>
                            <p className="text-sm text-muted-foreground">When you are offline, students can still pick you and you will receive SMS alerts.</p>
                          </div>
                          <Switch
                            checked={offlineSmsOptIn}
                            onCheckedChange={handleOfflineSmsToggle}
                            disabled={loading || saving}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                        <h2 className="text-lg font-semibold">Appearance</h2>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Dark mode</p>
                                    <p className="text-sm text-muted-foreground">Use a dark theme for low light environments.</p>
                                </div>
                                <Switch
                                    checked={settings?.profile.theme === 'dark'}
                                    onCheckedChange={(v) => updateSetting('profile', (p) => ({ ...p, theme: v ? 'dark' : 'light' }))}
                                    disabled={!settings}
                                />
                            </div>

                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Reduced motion</p>
                                    <p className="text-sm text-muted-foreground">Minimize animations to reduce motion.</p>
                                </div>
                                <Switch
                                    checked={!!settings?.profile.reducedMotion}
                                    onCheckedChange={(v) => updateSetting('profile', (p) => ({ ...p, reducedMotion: !!v }))}
                                    disabled={!settings}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold">Data usage</h2>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Low data mode</p>
                                    <p className="text-sm text-muted-foreground">Defer heavy images and maps to save bandwidth.</p>
                                </div>
                                <Switch
                                    checked={!!settings?.data.lowDataMode}
                                    onCheckedChange={(v) => updateSetting('data', (d) => ({ ...d, lowDataMode: !!v }))}
                                    disabled={!settings}
                                />
                            </div>
                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Firestore offline cache</p>
                                    <p className="text-sm text-muted-foreground">Keep data available offline using browser storage.</p>
                                </div>
                                <Switch
                                    checked={!!settings?.data.firestorePersistence}
                                    onCheckedChange={(v) => updateSetting('data', (d) => ({ ...d, firestorePersistence: !!v }))}
                                    disabled={!settings}
                                />
                            </div>
                        </div>
                    </div>


                    <div>
                        <h2 className="text-lg font-semibold">Danger zone</h2>
                        <p className="text-sm text-muted-foreground">Clear locally cached data for this app on this device.</p>
                        <div className="mt-3">
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    clearLocalData();
                                    setSettings(loadSettings());
                                    toast({ title: 'Local data cleared' });
                                }}
                            >
                                Clear local data
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}


