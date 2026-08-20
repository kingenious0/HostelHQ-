"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, updatePassword } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

function FirstLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // From query param (assisted mode) or from current user (direct login)
  const uid = searchParams.get("uid");
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [managerName, setManagerName] = useState("");

  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!uid && !currentUser) {
      router.push("/login");
      return;
    }
    if (currentUser) {
      setManagerName(currentUser.displayName || "");
    }
  }, [uid, currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      toast({ title: "Passwords don’t match", description: "Please confirm your new password.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let user = currentUser;

      // If we have a uid (assisted mode), sign in with the temporary password first
      if (uid && tempPassword) {
        const userDocRef = doc(db, "users", uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) throw new Error("Manager not found");
        const userData = userDocSnap.data() as any;
        const email = userData.email;

        const cred = await signInWithEmailAndPassword(auth, email, tempPassword);
        user = cred.user;
        setManagerName(userData.fullName || "");
      }

      if (!user) throw new Error("Not authenticated");

      // Update password in Firebase Auth
      await updatePassword(user, newPassword);

      // Clear forcePasswordReset flag in Firestore
      await updateDoc(doc(db, "users", user.uid), {
        forcePasswordReset: false,
        passwordUpdatedAt: new Date().toISOString(),
      });

      toast({
        title: "Password Updated",
        description: "Your password has been changed. Welcome to HostelHQ!",
      });

      router.push("/manager/dashboard");
    } catch (err: any) {
      console.error("Password reset error:", err);
      toast({
        title: "Failed to update password",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 bg-gray-50/50 flex items-center justify-center p-3 sm:p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center space-y-3 px-4 sm:px-6 py-4 sm:py-6">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Lock className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-headline">Set Your Password</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {managerName ? `Welcome, ${managerName}!` : "Welcome!"} Please choose a new password for your manager account.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {!currentUser && (
                <div className="space-y-2">
                  <Label htmlFor="tempPassword" className="text-sm font-medium">Temporary Password</Label>
                  <div className="relative">
                    <Input
                      id="tempPassword"
                      type={showNew ? "text" : "password"}
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Enter the temporary password you received"
                      required
                      className="text-base pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10 px-2"
                      onClick={() => setShowNew(!showNew)}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showConfirm ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Choose a new password"
                    required
                    className="text-base pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10 px-2"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re‑enter your new password"
                  required
                  className="text-base"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full text-base py-3">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function ManagerFirstLoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FirstLoginContent />
    </Suspense>
  );
}
