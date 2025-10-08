
"use client";

import Link from 'next/link';
import { Hotel, User, LogOut, Loader2, LayoutDashboard, ListPlus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { doc, getDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

type AppUser = {
  uid: string;
  email: string;
  fullName: string;
  role: 'student' | 'agent' | 'admin';
}

export function Header() {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authAction, setAuthAction] = useState<boolean>(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, get their role from Firestore.
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setAppUser({
                uid: user.uid,
                email: user.email!,
                fullName: userData.fullName,
                role: userData.role
            });
        } else {
            // This case can happen if a user is in Auth but not in Firestore.
            // For now, we sign them out to maintain consistency.
            await signOut(auth);
            setAppUser(null);
        }
      } else {
        // User is signed out.
        setAppUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    setAuthAction(true);
    try {
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

  return (
    <header className="bg-card shadow-sm sticky top-0 z-40">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Hotel className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-foreground">HostelHQ</span>
        </Link>
        <div className="flex items-center gap-4">
           <nav className="hidden items-center gap-6 md:flex">
            <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              Hostels
            </Link>
            {isAgent && (
              <Link href="/agent/upload" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                List a Hostel
              </Link>
            )}
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
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" disabled={loading}>
                {loading || authAction ? <Loader2 className="h-5 w-5 animate-spin" /> : <User className="h-5 w-5" />}
                <span className="sr-only">User Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {appUser ? (
                <>
                  <DropdownMenuLabel>
                    {appUser.fullName}
                    <p className="text-xs text-muted-foreground font-normal">{appUser.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAgent && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/agent/listings"><ListPlus className="mr-2 h-4 w-4"/>My Listings</Link>
                      </DropdownMenuItem>
                       <DropdownMenuItem asChild>
                        <Link href="/agent/upload"><ListPlus className="mr-2 h-4 w-4"/>Add New</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                   {isAdmin && (
                    <DropdownMenuItem asChild>
                        <Link href="/admin/dashboard"><LayoutDashboard className="mr-2 h-4 w-4"/>Dashboard</Link>
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
    </header>
  );
}

    