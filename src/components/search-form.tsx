
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, University, DoorOpen, Users } from 'lucide-react';

export function SearchForm() {
    const [searchQuery, setSearchQuery] = useState('');
    const [locationQuery, setLocationQuery] = useState('');
    const [institution, setInstitution] = useState('');
    const [roomType, setRoomType] = useState('');
    const [gender, setGender] = useState('');
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
    };

    return (
        <Card className="bg-card/90 backdrop-blur-sm p-3 sm:p-4 rounded-xl shadow-2xl mx-2 sm:mx-0 border border-border/60">
            <CardContent className="p-2 sm:p-3">
                <form onSubmit={handleSearch} className="flex flex-col gap-5 sm:gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        <div className="relative">
                            <University className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground z-10" />
                            <Select onValueChange={setInstitution} value={institution}>
                                <SelectTrigger className="w-full pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base rounded-lg text-foreground bg-background/90">
                                    <SelectValue placeholder="Select Institution" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="KNUST KUMASI CAMPUS">KNUST KUMASI CAMPUS</SelectItem>
                                    <SelectItem value="KNUST OBUASI CAMPUS">KNUST OBUASI CAMPUS</SelectItem>
                                    <SelectItem value="KUMASI TECHNICAL UNIVERSITY (KSTU)">KUMASI TECHNICAL UNIVERSITY (KSTU)</SelectItem>
                                    <SelectItem value="UNIVERSITY OF GHANA (UG)">UNIVERSITY OF GHANA (UG)</SelectItem>
                                    <SelectItem value="A A M U S T E D">A A M U S T E D</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="relative">
                            <DoorOpen className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground z-10" />
                            <Select onValueChange={setRoomType} value={roomType}>
                                <SelectTrigger className="w-full pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base rounded-lg text-foreground bg-background/90">
                                    <SelectValue placeholder="Select Room Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="One In A Room">One In A Room</SelectItem>
                                    <SelectItem value="Two In A Room">Two In A Room</SelectItem>
                                    <SelectItem value="Three In A Room">Three In A Room</SelectItem>
                                    <SelectItem value="Four In A Room">Four In A Room</SelectItem>
                                    <SelectItem value="Five In A Room">Five In A Room</SelectItem>
                                    <SelectItem value="Six In A Room">Six In A Room</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="relative">
                            <Users className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground z-10" />
                            <Select onValueChange={setGender} value={gender}>
                                <SelectTrigger className="w-full pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base rounded-lg text-foreground bg-background/90">
                                    <SelectValue placeholder="Select Gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                    <SelectItem value="Mixed">Mixed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                        <div className="relative w-full">
                            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                            <Input 
                                placeholder="Search hostel name..." 
                                className="pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base rounded-lg text-foreground bg-background/90"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="relative w-full">
                            <MapPin className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                            <Input 
                                placeholder="Enter location" 
                                className="pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base rounded-lg text-foreground bg-background/90"
                                value={locationQuery}
                                onChange={(e) => setLocationQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <Button
                        type="submit"
                        size="lg"
                        className="w-full h-12 sm:h-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-base sm:text-lg font-semibold tracking-wide"
                    >
                        Search hostels
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
