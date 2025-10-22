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
  };
}

export default function SettingsPage() {
    const { toast } = useToast();
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [fullName, setFullName] = useState('');
    const [initialName, setInitialName] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<ClientSettings>(loadSettings());
    const [privacySettings, setPrivacySettings] = useState({
      showPicture: true,
      showProfile: true,
      showProgrammeOfStudy: true,
      showPhoneNumber: true,
      showEmailAddress: true,
    });

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
                    });
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
                    });
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

    const updateSetting = <K extends keyof ClientSettings>(section: K, updater: (prev: ClientSettings[K]) => ClientSettings[K]) => {
        const next = { ...settings, [section]: updater(settings[section]) } as ClientSettings;
        setSettings(next);
        saveSettings(next);
        
        // Apply theme change immediately
        if (section === 'profile' && 'theme' in updater(settings[section])) {
            const newTheme = (updater(settings[section]) as any).theme;
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
        }
    };

    const handlePrivacyToggle = (key: keyof AppUser['privacySettings'], checked: boolean) => {
      setPrivacySettings(prev => ({
        ...prev,
        [key]: checked,
      }));
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

                    {/* Account Privacy Section */}
                    <div>
                        <h2 className="text-lg font-semibold">Account Privacy</h2>
                        <p className="text-sm text-muted-foreground">Control what information other roommates can see.</p>
                        <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Picture</p>
                                    <p className="text-sm text-muted-foreground">Allow other roommates to see your profile picture.</p>
                                </div>
                                <Switch
                                    checked={privacySettings.showPicture}
                                    onCheckedChange={(checked) => handlePrivacyToggle('showPicture', checked)}
                                    disabled={loading || saving}
                                />
                            </div>
                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Profile</p>
                                    <p className="text-sm text-muted-foreground">Allow other roommates to view your full profile.</p>
                                </div>
                                <Switch
                                    checked={privacySettings.showProfile}
                                    onCheckedChange={(checked) => handlePrivacyToggle('showProfile', checked)}
                                    disabled={loading || saving}
                                />
                            </div>
                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Programme of Study</p>
                                    <p className="text-sm text-muted-foreground">Allow other roommates to see your programme of study.</p>
                                </div>
                                <Switch
                                    checked={privacySettings.showProgrammeOfStudy}
                                    onCheckedChange={(checked) => handlePrivacyToggle('showProgrammeOfStudy', checked)}
                                    disabled={loading || saving}
                                />
                            </div>
                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Phone Number</p>
                                    <p className="text-sm text-muted-foreground">Allow other roommates to see your phone number.</p>
                                </div>
                                <Switch
                                    checked={privacySettings.showPhoneNumber}
                                    onCheckedChange={(checked) => handlePrivacyToggle('showPhoneNumber', checked)}
                                    disabled={loading || saving}
                                />
                            </div>
                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Email Address</p>
                                    <p className="text-sm text-muted-foreground">Allow other roommates to see your email address.</p>
                                </div>
                                <Switch
                                    checked={privacySettings.showEmailAddress}
                                    onCheckedChange={(checked) => handlePrivacyToggle('showEmailAddress', checked)}
                                    disabled={loading || saving}
                                />
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={handleSavePrivacy} disabled={!canSavePrivacy || saving}>
                                  {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold">Appearance</h2>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Dark mode</p>
                                    <p className="text-sm text-muted-foreground">Use a dark theme for low light environments.</p>
                                </div>
                                <Switch
                                    checked={settings.profile.theme === 'dark'}
                                    onCheckedChange={(v) => updateSetting('profile', (p) => ({ ...p, theme: v ? 'dark' : 'light' }))}
                                />
                            </div>

                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Reduced motion</p>
                                    <p className="text-sm text-muted-foreground">Minimize animations to reduce motion.</p>
                                </div>
                                <Switch
                                    checked={settings.profile.reducedMotion}
                                    onCheckedChange={(v) => updateSetting('profile', (p) => ({ ...p, reducedMotion: !!v }))}
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
                                    checked={settings.data.lowDataMode}
                                    onCheckedChange={(v) => updateSetting('data', (d) => ({ ...d, lowDataMode: !!v }))}
                                />
                            </div>
                            <div className="flex items-center justify-between border rounded-md p-3">
                                <div>
                                    <p className="font-medium">Firestore offline cache</p>
                                    <p className="text-sm text-muted-foreground">Keep data available offline using browser storage.</p>
                                </div>
                                <Switch
                                    checked={settings.data.firestorePersistence}
                                    onCheckedChange={(v) => updateSetting('data', (d) => ({ ...d, firestorePersistence: !!v }))}
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


