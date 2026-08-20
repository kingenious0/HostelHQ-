"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, UserPlus, Building2, Shield, Smartphone } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordReset,
  onAuthStateChanged,
} from "firebase/auth";
import { collection, doc, setDoc, updateDoc, getDocs, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface HostelOption {
  id: string;
  name: string;
  location: string;
  managerId?: string;
  agentId?: string;
}

export default function AgentCreateManagerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(false);
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [loadingHostels, setLoadingHostels] = useState(true);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedHostelId, setSelectedHostelId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState("Welcome2025!");
  const [forceReset, setForceReset] = useState(true);
  const [assistedMode, setAssistedMode] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    fetchMyHostels();
  }, [currentUser, router]);

  const fetchMyHostels = async () => {
    if (!currentUser?.uid) {
      setLoadingHostels(false);
      return;
    }
    try {
      // Only fetch hostels owned by this agent
      const snap = await getDocs(
        query(collection(db, "hostels"), where("agentId", "==", currentUser.uid))
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HostelOption));
      setHostels(list);
    } catch (e) {
      console.error("Failed to fetch hostels:", e);
      toast({ title: "Error", description: "Could not load your hostels.", variant: "destructive" });
    } finally {
      setLoadingHostels(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const generateEmail = (name: string, phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "").slice(-6);
    const namePart = name.replace(/\s+/g, "").slice(0, 3).toUpperCase();
    return `${namePart}${cleanPhone}@hostelhq.com`.toLowerCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      toast({ title: "Missing fields", description: "Full name and phone are required.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const derivedEmail = email.trim() || generateEmail(fullName, phone);

      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, derivedEmail, tempPassword);
      const user = userCredential.user;
      await updateProfile(user, { displayName: fullName });

      // 2. Store user record with forcePasswordReset flag
      await setDoc(doc(db, "users", user.uid), {
        fullName,
        email: derivedEmail,
        phone,
        role: "hostel_manager",
        forcePasswordReset: forceReset,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
      });

      // 3. Assign to hostel if selected
      if (selectedHostelId) {
        await updateDoc(doc(db, "hostels", selectedHostelId), {
          managerId: user.uid,
        });
      }

      // 4. Send SMS with temporary password (fire-and-forget)
      try {
        await fetch("/api/sms/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: phone,
            message: `Hello ${fullName},\nYour HostelHQ manager account is ready.\nLogin: ${derivedEmail}\nPassword: ${tempPassword}\nPlease change your password on first login.\n${window.location.origin}/login`,
          }),
        });
      } catch (smsErr) {
        console.error("Failed to send SMS:", smsErr);
      }

      toast({
        title: "Manager account created",
        description: `Account for ${fullName} created. They’ve been notified via SMS.`,
      });

      if (assistedMode) {
        // In assisted mode, open a quick login screen for the manager to reset password immediately
        router.push(`/manager/first-login?uid=${user.uid}`);
      } else {
        router.push("/agent/dashboard");
      }
    } catch (err: any) {
      console.error("Create manager error:", err);
      toast({
        title: "Failed to create manager",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 bg-gray-50/50 p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="container mx-auto max-w-2xl">
          <Card className="shadow-xl">
            <CardHeader className="text-center space-y-3 px-4 sm:px-6 py-4 sm:py-6">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl sm:text-2xl font-headline">Create Manager Account</CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Create a manager account for one of your hostels. You can set a temporary password and force a password reset on first login.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Kwame Asante"
                    required
                    className="text-base"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+233 20 123 4567"
                    required
                    className="text-base"
                  />
                </div>

                {/* Email (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="If not provided, we’ll generate one."
                    className="text-base"
                  />
                </div>

                {/* Hostel Assignment */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Assign to Hostel</Label>
                  {loadingHostels ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading your hostels…
                    </div>
                  ) : hostels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">You don’t have any hostels yet. Create a hostel first.</p>
                  ) : (
                    <Select onValueChange={setSelectedHostelId}>
                      <SelectTrigger className="text-base">
                        <SelectValue placeholder="Select one of your hostels" />
                      </SelectTrigger>
                      <SelectContent>
                        {hostels.map((h) => (
                          <SelectItem key={h.id} value={h.id} disabled={!!h.managerId} className="text-sm">
                            {h.name} ({h.location}) {h.managerId && "(has manager)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Temporary Password */}
                <div className="space-y-2">
                  <Label htmlFor="tempPassword" className="text-sm font-medium">Temporary Password</Label>
                  <Input
                    id="tempPassword"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    type="text"
                    className="text-base"
                  />
                </div>

                {/* Force Reset Checkbox */}
                <div className="flex items-start space-x-2">
                  <Checkbox id="forceReset" checked={forceReset} onCheckedChange={(c) => setForceReset(!!c)} className="mt-0.5" />
                  <Label htmlFor="forceReset" className="text-sm leading-tight">
                    Force password change on first login (recommended)
                  </Label>
                </div>

                {/* Assisted Mode Checkbox */}
                <div className="flex items-start space-x-2">
                  <Checkbox id="assistedMode" checked={assistedMode} onCheckedChange={(c) => setAssistedMode(!!c)} className="mt-0.5" />
                  <Label htmlFor="assistedMode" className="text-sm leading-tight">
                    I’m helping the manager in person (open login screen after creation)
                  </Label>
                </div>

                {/* Submit */}
                <Button type="submit" disabled={loading || hostels.length === 0} className="w-full text-base py-3">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Manager Account
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
