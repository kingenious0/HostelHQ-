"use client";

import React, { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Hammer, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Maintenance Guard
 * 
 * Provides a global "Kill Switch" for the application. 
 * If enabled in Firestore (system_settings/global), all non-admin 
 * users will see a maintenance screen.
 */
export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen for Global Maintenance Mode
    const maintenanceRef = doc(db, "system_settings", "global");
    const unsubMaintenance = onSnapshot(maintenanceRef, (snap: any) => {
      if (snap.exists()) {
        setMaintenanceMode(snap.data().maintenanceMode === true);
      }
      setLoading(false);
    });

    // 2. Track Admin Status
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        onSnapshot(userRef, (userSnap: any) => {
           if (userSnap.exists()) {
             setIsAdmin(userSnap.data().role === "admin");
           }
        });
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      unsubMaintenance();
      unsubAuth();
    };
  }, []);

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;

  // If maintenance is ON and user is NOT an admin, lock the door
  if (maintenanceMode && !isAdmin) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900 text-white p-6 overflow-hidden">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="flex justify-center">
            <div className="p-4 bg-orange-500/10 rounded-full border border-orange-500/20">
              <Hammer className="w-16 h-16 text-orange-500 animate-bounce" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-white">HostelHQ is under maintenance</h1>
            <p className="text-slate-400 text-lg">
              We're currently hardening our defenses and making improvements. We'll be back online shortly. 
            </p>
          </div>

          <div className="pt-8 border-t border-slate-800">
             <div className="flex items-center justify-center gap-2 text-slate-500 mb-6">
                <ShieldAlert className="w-5 h-5" />
                <span className="text-sm font-medium">Security lockdown active</span>
             </div>
             
             <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800 text-slate-300" onClick={() => window.location.reload()}>
                Check Status
             </Button>
          </div>
          
          <p className="text-xs text-slate-600">
             Emergency? Contact support@hostelhq.com
          </p>
        </div>
      </div>
    );
  }

  // Otherwise, all good
  return (
    <>
      {maintenanceMode && isAdmin && (
        <div className="fixed top-0 left-0 right-0 z-[10000] bg-orange-600 text-white text-center py-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider">
           <ShieldAlert className="w-3 h-3" />
           Maintenance Mode Active (Admin View)
        </div>
      )}
      {children}
    </>
  );
}
