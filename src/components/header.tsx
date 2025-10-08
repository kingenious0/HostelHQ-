
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
import { ably } from '@/lib/ably';

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
        // Set client ID for Ably auth
        ably.auth.options.clientId = user.uid;

        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const currentUser = {
                uid: user.uid,
                email: user.email!,
                fullName: userData.fullName,
                role: userData.role
            };
            setAppUser(currentUser);
        } else {
            // If user exists in Auth but not in Firestore, log them out.
            await signOut(auth);
            setAppUser(null);
        }
      } else {
        // Clear client ID on logout
        ably.auth.options.clientId = undefined;
        setAppUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // This effect handles Ably presence for agents.
    if (appUser?.role === 'agent') {
      const agentChannel = ably.channels.get('agents:live');
      const enterPresence = async () => {
        try {
          await agentChannel.presence.enter({ 
            id: appUser.uid, 
            fullName: appUser.fullName, 
            email: appUser.email 
          });
        } catch (e) {
          console.error('Error entering Ably presence:', e);
        }
      };
      enterPresence();

      return () => {
        // Leave presence when component unmounts or user changes
        agentChannel.presence.leave();
      };
    }
  }, [appUser]);


  const handleLogout = async () => {
    setAuthAction(true);
    try {
      if (appUser?.role === 'agent') {
        const agentChannel = ably.channels.get('agents:live');
        await agentChannel.presence.leave();
      }
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
    <header className="bg-background/80 backdrop-blur-sm border-b sticky top-0 z-40">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Hotel className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold text-foreground font-headline">HostelHQ</span>
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
              <Button variant="ghost" size="icon" disabled={loading}>
                {loading || authAction ? <Loader2 className="h-5 w-5 animate-spin" /> : <User className="h-5 w-5" />}
                <span className="sr-only">User Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {appUser ? (
                <>
                  <DropdownMenuLabel>
                    <div className="font-semibold">{appUser.fullName}</div>
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
