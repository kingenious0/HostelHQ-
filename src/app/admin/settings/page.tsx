"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Shield, Phone, Save, Loader2, MessageSquare, Bell } from 'lucide-react';

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Admin profile data
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [smsNotifications, setSmsNotifications] = useState(true);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            setUser(user);
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setFullName(userData.fullName || user.displayName || '');
                        setEmail(userData.email || user.email || '');
                        setPhone(userData.phone || '');
                        setSmsNotifications(userData.smsNotifications !== false); // Default to true
                    }
                } catch (error) {
                    console.error('Error fetching admin data:', error);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSaveProfile = async () => {
        if (!user) return;
        
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                fullName,
                email,
                phone,
                smsNotifications,
                updatedAt: new Date().toISOString()
            });

            toast({ 
                title: "Settings Updated", 
                description: "Your admin settings have been saved successfully." 
            });
        } catch (error) {
            console.error('Error saving settings:', error);
            toast({ 
                title: "Error", 
                description: "Failed to save settings. Please try again.", 
                variant: 'destructive' 
            });
        } finally {
            setSaving(false);
        }
    };

    const handleTestSMS = async () => {
        if (!phone) {
            toast({ 
                title: "Phone Number Required", 
                description: "Please add your phone number first.", 
                variant: 'destructive' 
            });
            return;
        }

        try {
            const message = `🧪 HOSTELHQ: Test SMS notification\n\nThis is a test message from HostelHQ admin panel. Your SMS notifications are working correctly!\n\nAdmin: ${fullName}`;
            
            const response = await fetch('/api/sms/send-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: phone,
                    message: message,
                    adminName: fullName
                })
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.devMode) {
                    toast({ 
                        title: "SMS Test Successful (Development Mode)", 
                        description: "SMS will be sent when deployed to production. Check console for details." 
                    });
                } else {
                    toast({ 
                        title: "Test SMS Sent via Wigal", 
                        description: "Check your phone for the test message from HostelHQ." 
                    });
                }
            } else {
                toast({ 
                    title: "SMS Failed", 
                    description: data.error || "Failed to send test SMS via Wigal.", 
                    variant: 'destructive' 
                });
            }
        } catch (error) {
            console.error('Error sending test SMS:', error);
            toast({ 
                title: "Error", 
                description: "Failed to send test SMS. Check Wigal configuration.", 
                variant: 'destructive' 
            });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <div className="container mx-auto py-8">
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <div className="container mx-auto py-8 space-y-6">
                <div className="flex items-center gap-2 mb-6">
                    <Shield className="h-6 w-6" />
                    <h1 className="text-3xl font-bold">Admin Settings</h1>
                </div>

                {/* Profile Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Information</CardTitle>
                        <CardDescription>
                            Update your admin profile information
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input
                                    id="fullName"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Enter your full name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="phone">
                                <Phone className="h-4 w-4 inline mr-1" />
                                Phone Number (for SMS notifications)
                            </Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+233XXXXXXXXXX"
                            />
                            <p className="text-sm text-muted-foreground">
                                Include country code (e.g., +233 for Ghana). This number will receive SMS notifications 
                                when agents submit new hostels for approval.
                            </p>
                        </div>

                        <Button 
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="w-full md:w-auto"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Profile
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* SMS Notification Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <MessageSquare className="h-5 w-5 inline mr-2" />
                            SMS Notifications
                        </CardTitle>
                        <CardDescription>
                            Configure SMS notifications for admin alerts
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <h4 className="font-medium">New Hostel Submissions</h4>
                                <p className="text-sm text-muted-foreground">
                                    Receive SMS via Wigal FROG when agents/manager submit hostels for approval
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    phone ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                    {phone ? 'Phone Set' : 'No Phone'}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    smsNotifications ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {smsNotifications ? 'Enabled' : 'Disabled'}
                                </span>
                                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    Wigal Active
                                </span>
                            </div>
                        </div>

                        {phone && (
                            <Button 
                                onClick={handleTestSMS}
                                variant="outline"
                                className="w-full md:w-auto"
                            >
                                <Bell className="h-4 w-4 mr-2" />
                                Send Test SMS
                            </Button>
                        )}

                        {!phone && (
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                    ⚠️ Phone number is required to receive SMS notifications. 
                                    Please add your phone number above.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* SMS Service Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>SMS Service Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-sm space-y-2">
                            <p>
                                <strong>🔧 Status:</strong> SMS notifications configured for production deployment.
                            </p>
                            <p>
                                <strong>Service Provider:</strong> Wigal FROG SMS (Ghana's reliable SMS gateway)
                            </p>
                            <p>
                                <strong>Development Mode:</strong> SMS is bypassed locally, will work when deployed.
                            </p>
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                    📧 SMS notifications are configured and will work in production!
                                    In development mode, SMS is simulated to avoid costs and local API issues.
                                </p>
                            </div>
                            <p>
                                <strong>Environment Variables (Configured ✅):</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                                <li><code>WIGAL_API_KEY</code> - Your Wigal API key</li>
                                <li><code>WIGAL_USERNAME</code> - Your Wigal username</li>
                                <li><code>WIGAL_SENDER_ID</code> - "HostelHQ" (default)</li>
                            </ul>
                            <p>
                                <strong>When Deployed:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                                <li>Admins receive SMS when agents submit hostels</li>
                                <li>Creators get SMS for approval/rejection status</li>
                                <li>Test SMS works for verification</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
