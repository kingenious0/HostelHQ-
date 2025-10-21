"use client";

import { useEffect, useState } from 'react';
import { Header } from '@/components/header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, updateProfile, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { loadSettings, saveSettings, clearLocalData, type ClientSettings } from '@/lib/clientSettings';

export default function SettingsPage() {
    const { toast } = useToast();
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [fullName, setFullName] = useState('');
    const [initialName, setInitialName] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<ClientSettings>(loadSettings());

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (!u) {
                setLoading(false);
                return;
            }
            try {
                const userDoc = await getDoc(doc(db, 'users', u.uid));
                const name = (userDoc.exists() ? userDoc.data().fullName : u.displayName) || '';
                setFullName(name);
                setInitialName(name);
            } catch (e) {
                // fall back silently
            } finally {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    const canSave = user && fullName.trim() && fullName.trim() !== initialName.trim() && !saving;

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

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50">
            <Header />
            <main className="flex-1 p-8 max-w-2xl">
                <h1 className="text-2xl font-bold">Settings</h1>
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


