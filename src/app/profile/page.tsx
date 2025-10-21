"use client";

import { Header } from '@/components/header';

export default function ProfilePage() {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50">
            <Header />
            <main className="flex-1 p-8">
                <h1 className="text-2xl font-bold">My Profile</h1>
                <p className="text-muted-foreground mt-2">Coming soon.</p>
            </main>
        </div>
    );
}


