
"use client";

import Link from 'next/link';
import { Hotel, User, LogOut, Loader2, LayoutDashboard, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const roles = {
  student: { email: 'student@test.com', password: 'password', redirect: '/' },
  agent: { email: 'agent@test.com', password: 'password', redirect: '/agent/listings' },
  admin: { email: 'admin@test.com', password: 'password', redirect: '/admin/dashboard' },
};

export function Header() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authAction, setAuthAction] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (role: keyof typeof roles) => {
    setAuthAction(role);
    try {
      await signInWithEmailAndPassword(auth, roles[role].email, roles[role].password);
      toast({ title: `Logged in as ${role}` });
      // Quick navigation, Next.js Link will handle the rest
      window.location.href = roles[role].redirect;
    } catch (error) {
      console.error(`Error logging in as ${role}:`, error);
      toast({
        title: `Login Failed for ${role}`,
        description: `Please ensure user '${roles[role].email}' exists in Firebase Auth with password 'password'.`,
        variant: 'destructive',
      });
    } finally {
      setAuthAction(null);
    }
  };

  const handleLogout = async () => {
    setAuthAction('logout');
    try {
      await signOut(auth);
      toast({ title: "Logged out successfully" });
      window.location.href = '/';
    } catch (error) {
      console.error("Error logging out:", error);
      toast({ title: "Logout failed", variant: 'destructive' });
    } finally {
      setAuthAction(null);
    }
  };

  const isAgent = currentUser?.email === roles.agent.email;
  const isAdmin = currentUser?.email === roles.admin.email;


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
            {(isAgent || isAdmin) && (
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
              {currentUser ? (
                <>
                  <DropdownMenuLabel>
                    {currentUser.email}
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
                  <DropdownMenuItem onClick={handleLogout} disabled={authAction === 'logout'}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuLabel>Login As</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleLogin('student')} disabled={!!authAction}>
                    Student
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleLogin('agent')} disabled={!!authAction}>
                    Agent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleLogin('admin')} disabled={!!authAction}>
                    Admin
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

    