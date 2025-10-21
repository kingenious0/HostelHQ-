
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin } from 'lucide-react';

export function SearchForm() {
    const [searchQuery, setSearchQuery] = useState('');
    const [locationQuery, setLocationQuery] = useState('');
    const router = useRouter();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (searchQuery) {
            params.set('search', searchQuery);
        }
        if (locationQuery) {
            params.set('location', locationQuery);
        }
        router.push(`/?${params.toString()}`);
    };

    return (
        <Card className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-2xl">
            <CardContent className="p-2">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-4">
                    <div className="relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Search hostel name..." 
                            className="pl-12 h-14 text-base rounded-lg text-foreground bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="relative w-full">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Enter location" 
                            className="pl-12 h-14 text-base rounded-lg text-foreground bg-white"
                            value={locationQuery}
                            onChange={(e) => setLocationQuery(e.target.value)}
                        />
                    </div>
                    <Button type="submit" size="lg" className="w-full md:w-auto h-14 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg text-lg">
                        Search
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
