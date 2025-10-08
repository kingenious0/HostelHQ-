
"use client";

import Link from 'next/link';
import { Hotel, User, LogOut, Loader2, LayoutDashboard, ListPlus, UserPlus, Briefcase } from 'lucide-react';
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
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ably } from '@/lib/ably';
import { Types } from 'ably';

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
  const locationWatcherId = useRef<number | null>(null);
  const agentPresenceChannel = useRef<Types.RealtimeChannelPromise | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (!ably.auth.options) {
          (ably.auth.options as any) = {};
        }
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
            await signOut(auth);
            setAppUser(null);
        }
      } else {
        if (ably.auth && ably.auth.options) {
          ably.auth.options.clientId = undefined;
        }
        setAppUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // This effect handles Ably presence and location tracking for agents.
    if (appUser?.role === 'agent') {
      // --- Enter Presence ---
      agentPresenceChannel.current = ably.channels.get('agents:live');
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
        locationWatcherId.current = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const agentGpsChannel = ably.channels.get(`agent:${appUser.uid}:gps`);
            
            // Publish to Ably for real-time map updates
            agentGpsChannel.publish('location', { lat: latitude, lng: longitude });

            // Also update Firestore for initial location fetching
            const userDocRef = doc(db, "users", appUser.uid);
            await updateDoc(userDocRef, {
              location: { lat: latitude, lng: longitude }
            });
          },
          (error) => {
            console.error("Geolocation error:", error);
            if(error.code === 1) { // PERMISSION_DENIED
              toast({ title: 'Location Access Denied', description: 'Please enable location services to be visible to students.', variant: 'destructive'});
            }
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
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
  
  const isAgent = appUser?.role === 'agent';
  const isAdmin = appUser?.role === 'admin';
  const isStudent = appUser?.role === 'student';

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
               <Link href="/agent/dashboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Dashboard
              </Link>
            )}
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
            {isStudent && (
                 <Link href="/my-visits" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                    My Visits
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
                  {isStudent && (
                     <DropdownMenuItem asChild>
                        <Link href="/my-visits"><Briefcase className="mr-2 h-4 w-4"/>My Visits</Link>
                    </DropdownMenuItem>
                  )}
                  {isAgent && (
                    <>
                       <DropdownMenuItem asChild>
                        <Link href="/agent/dashboard"><LayoutDashboard className="mr-2 h-4 w-4"/>Dashboard</Link>
                      </DropdownMenuItem>
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
    