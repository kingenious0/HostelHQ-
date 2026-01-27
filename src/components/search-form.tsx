
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, University, DoorOpen, Users, RotateCcw } from 'lucide-react';

export function SearchForm() {
    const [searchQuery, setSearchQuery] = useState('');
    const [locationQuery, setLocationQuery] = useState('');
    const [institution, setInstitution] = useState('');
    const [roomType, setRoomType] = useState('');
    const [gender, setGender] = useState('');
    const router = useRouter();

    // Auto-search with debouncing
    const performSearch = useCallback(() => {
        const params = new URLSearchParams();
        if (searchQuery) {
            params.set('search', searchQuery);
        }
        if (locationQuery) {
            params.set('location', locationQuery);
        }
        if (institution) {
            params.set('institution', institution);
        }
        if (roomType) {
            params.set('roomType', roomType);
        }
        if (gender) {
            params.set('gender', gender);
        }
        router.push(`/?${params.toString()}`);
    }, [searchQuery, locationQuery, institution, roomType, gender, router]);

    // Debounce auto-search
    useEffect(() => {
        const timer = setTimeout(() => {
            performSearch();
        }, 500); // 500ms delay for typing

        return () => clearTimeout(timer);
    }, [performSearch]);

    // Clear all filters
    const handleClearSearch = () => {
        setSearchQuery('');
        setLocationQuery('');
        setInstitution('');
        setRoomType('');
        setGender('');
        router.push('/');
    };

    // Check if any filter is active
    const hasActiveFilters = searchQuery || locationQuery || institution || roomType || gender;

    return (
        <Card className="glass dark:glass-dark p-2 sm:p-4 rounded-[2.5rem] shadow-2xl mx-2 sm:mx-0 border border-white/10">
            <CardContent className="p-2 sm:p-4">
                <div className="flex flex-col gap-5 sm:gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        <div className="relative">
                            <University className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-primary/60 z-10" />
                            <Select onValueChange={setInstitution} value={institution}>
                                <SelectTrigger className="w-full pl-10 sm:pl-12 h-14 text-sm sm:text-base rounded-2xl border-none bg-white/50 dark:bg-slate-800/50 focus:ring-primary/20">
                                    <SelectValue placeholder="Select Institution" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                                    <SelectItem value="KNUST KUMASI CAMPUS">KNUST KUMASI CAMPUS</SelectItem>
                                    <SelectItem value="KNUST OBUASI CAMPUS">KNUST OBUASI CAMPUS</SelectItem>
                                    <SelectItem value="KUMASI TECHNICAL UNIVERSITY (KSTU)">KUMASI TECHNICAL UNIVERSITY (KSTU)</SelectItem>
                                    <SelectItem value="UNIVERSITY OF GHANA (UG)">UNIVERSITY OF GHANA (UG)</SelectItem>
                                    <SelectItem value="A A M U S T E D">A A M U S T E D</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="relative">
                            <DoorOpen className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-primary/60 z-10" />
                            <Select onValueChange={setRoomType} value={roomType}>
                                <SelectTrigger className="w-full pl-10 sm:pl-12 h-14 text-sm sm:text-base rounded-2xl border-none bg-white/50 dark:bg-slate-800/50 focus:ring-primary/20">
                                    <SelectValue placeholder="Select Room Type" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                                    <SelectItem value="1 IN A ROOM">1 IN A ROOM</SelectItem>
                                    <SelectItem value="2 IN A ROOM">2 IN A ROOM</SelectItem>
                                    <SelectItem value="3 IN A ROOM">3 IN A ROOM</SelectItem>
                                    <SelectItem value="4 IN A ROOM">4 IN A ROOM</SelectItem>
                                    <SelectItem value="5 IN A ROOM">5 IN A ROOM</SelectItem>
                                    <SelectItem value="6 IN A ROOM">6 IN A ROOM</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="relative">
                            <Users className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-primary/60 z-10" />
                            <Select onValueChange={setGender} value={gender}>
                                <SelectTrigger className="w-full pl-10 sm:pl-12 h-14 text-sm sm:text-base rounded-2xl border-none bg-white/50 dark:bg-slate-800/50 focus:ring-primary/20">
                                    <SelectValue placeholder="Select Gender" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                    <SelectItem value="Mixed">Mixed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative w-full">
                            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-primary/60" />
                            <Input
                                placeholder="Search hostel name..."
                                className="pl-10 sm:pl-12 h-14 text-sm sm:text-base rounded-2xl border-none bg-white/50 dark:bg-slate-800/50 focus-visible:ring-primary/20"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="relative w-full">
                            <MapPin className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-primary/60" />
                            <Input
                                placeholder="Enter location"
                                className="pl-10 sm:pl-12 h-14 text-sm sm:text-base rounded-2xl border-none bg-white/50 dark:bg-slate-800/50 focus-visible:ring-primary/20"
                                value={locationQuery}
                                onChange={(e) => setLocationQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <Button
                            type="button"
                            onClick={handleClearSearch}
                            size="lg"
                            variant="outline"
                            className="w-full h-12 sm:h-14 rounded-full border-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary text-base sm:text-lg font-semibold tracking-wide flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="h-5 w-5" />
                            Clear Search
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
