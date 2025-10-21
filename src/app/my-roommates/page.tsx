"use client";

import { Header } from '@/components/header';

export default function MyRoommatesPage() {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50">
            <Header />
            <main className="flex-1 p-8">
                <h1 className="text-2xl font-bold">My Roommates</h1>
                <p className="text-muted-foreground mt-2">You have no roommates yet.</p>
            </main>
        </div>
    );
}


