"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin, Upload, Trash2, Plus, PlusCircle, Loader2, Lightbulb, Sparkles, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { enhanceHostelDescription } from '@/ai/flows/enhance-hostel-description';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { addDoc, collection, writeBatch, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { uploadImage } from '@/lib/cloudinary';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RoomType } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MapboxLocationPicker from '@/components/mapbox-location-picker';

const hostelAmenitiesList = [
    'WiFi',
    'Car Parking Space',
    'DSTV Room',
    'General Kitchen',
    'Study Room',
    'Laundry',
    'Gym',
    'Security',
];

const roomAmenitiesList = [
    'Private Washroom',
    'Shared Washroom',
    'Mattress',
    'Wardrobe',
    'Furniture (Table, Chair)',
    'TV',
    'Ceiling Fan',
    'Balcony',
    'Private Kitchen',
    'Shared Kitchen',
    'AC',
];
const billsIncludedList = ['Water', 'Refuse'];
const billsExcludedList = ['Gas', 'Electricity'];
const securitySafetyList = ['Security Alarm', 'Maintenance Team (24-hour on call)', 'Entire Building Fenced', 'Controlled Access Gate (24-hour)', 'Tanoso Police Station (close)'];


const deriveCapacityFromName = (name?: string | null) => {
    if (!name) return 0;
    const numericMatch = name.match(/\d+/);
    if (numericMatch) return Number(numericMatch[0]);
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
    const first = name.trim().split(' ')[0]?.toLowerCase() ?? '';
    return words[first] ?? 0;
};

export default function AgentUploadPage() {
    const [step, setStep] = useState(1);
    const { toast } = useToast();
    const router = useRouter();

    // Form State
    const [hostelName, setHostelName] = useState('');
    const [nearbyLandmarks, setNearbyLandmarks] = useState('');
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
    const [photos, setPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [gpsLocation, setGpsLocation] = useState('');
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [fullAddress, setFullAddress] = useState('');
    const [description, setDescription] = useState('');
    const [gender, setGender] = useState<string>('Mixed');
    const [roomTypes, setRoomTypes] = useState<Partial<RoomType>[]>([
        { name: '', price: 0, availability: 'Available', capacity: 0, occupancy: 0, roomAmenities: [] }
    ]);
    const [distanceToUni, setDistanceToUni] = useState('');
    const [billsIncluded, setBillsIncluded] = useState<string[]>([]);
    const [billsExcluded, setBillsExcluded] = useState<string[]>([]);
    const [securityAndSafety, setSecurityAndSafety] = useState<string[]>([]);
    
    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    const totalSteps = 5;
    const progress = (step / totalSteps) * 100;

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                // Fetch user role from Firestore
                try {
                    const userDocRef = doc(db, "users", user.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        const userData = userDocSnap.data();
                        setUserRole(userData.role || null);
                    } else {
                        setUserRole(null);
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                    setUserRole(null);
                }
            } else {
                setUserRole(null);
            }
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    const handleRoomTypeChange = (index: number, field: keyof RoomType, value: string | number | undefined) => {
        const newRoomTypes = [...roomTypes];
        (newRoomTypes[index] as any)[field] = value;

        if (field === 'name') {
            const derived = deriveCapacityFromName(String(value));
            if (derived > 0) {
                (newRoomTypes[index] as any).capacity = derived;
            }
        }

        setRoomTypes(newRoomTypes);
    };

    const toggleRoomNumberForType = (index: number, value: string, checked: boolean) => {
        const newRoomTypes = [...roomTypes];
        const current = newRoomTypes[index].roomNumbers || [];
        const targetCount = newRoomTypes[index].numberOfRooms ?? 0;

        if (checked && targetCount > 0 && current.length >= targetCount) {
            toast({
                title: 'Room number limit reached',
                description: `You set Number of Rooms to ${targetCount}. You cannot select more than ${targetCount} room numbers.`,
                variant: 'destructive',
            });
            return;
        }

        newRoomTypes[index].roomNumbers = checked
            ? Array.from(new Set([...current, value]))
            : current.filter((v) => v !== value);
        setRoomTypes(newRoomTypes);
    };

    const addRoomType = () => {
        setRoomTypes([
            ...roomTypes,
            { name: '', price: 0, availability: 'Available', capacity: 0, occupancy: 0, roomAmenities: [] },
        ]);
    };

    const removeRoomType = (index: number) => {
        if (roomTypes.length <= 1) {
            toast({ title: "Cannot Remove", description: "You must have at least one room type.", variant: "destructive" });
            return;
        }
        const newRoomTypes = roomTypes.filter((_, i) => i !== index);
        setRoomTypes(newRoomTypes);
    };

    const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string, checked: boolean) => {
        setter(prev => 
            checked ? [...prev, item] : prev.filter(i => i !== item)
        );
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).slice(0, 5 - photos.length);
            if (newFiles.length > 0) {
                setPhotos(prev => [...prev, ...newFiles]);
                const newPreviews = newFiles.map(file => URL.createObjectURL(file));
                setPhotoPreviews(prev => [...prev, ...newPreviews]);
            }
        }
    };

    const handleSubmit = async () => {
        if (!currentUser) {
            toast({ title: 'Not authenticated', description: 'Please log in as an agent to submit.', variant: 'destructive' });
            return;
        }

        if (photos.length === 0) {
            toast({ title: 'No Photos', description: 'Please upload at least one photo.', variant: 'destructive' });
            return;
        }
        
        if (roomTypes.some(rt => !rt.name || !rt.price || rt.price <= 0)) {
            toast({ title: 'Invalid Room Types', description: 'Please ensure all room types have a name and a valid price.', variant: 'destructive' });
            return;
        }

        // Validate capacity, occupancy and room numbers
        for (const rt of roomTypes) {
            const capacity = rt.capacity ?? 0;
            const occupancy = rt.occupancy ?? 0;
            if (capacity > 0 && occupancy > capacity) {
                toast({ title: 'Invalid Occupancy', description: `Room type "${rt.name}" has occupancy (${occupancy}) greater than capacity (${capacity}).`, variant: 'destructive' });
                return;
            }
            if (rt.numberOfRooms !== undefined && rt.numberOfRooms <= 0) {
                toast({ title: 'Invalid Number of Rooms', description: `Room type "${rt.name}" must have at least 1 room if specified.`, variant: 'destructive' });
                return;
            }
            const targetCount = rt.numberOfRooms ?? 0;
            const selectedCount = rt.roomNumbers?.length ?? 0;
            if (targetCount > 0 && selectedCount > 0 && selectedCount !== targetCount) {
                toast({
                    title: 'Room numbers mismatch',
                    description: `Room type "${rt.name}" must have exactly ${targetCount} room numbers selected (currently ${selectedCount}).`,
                    variant: 'destructive',
                });
                return;
            }
        }

        setIsSubmitting(true);
        toast({ title: 'Submitting hostel...', description: 'Uploading images and enhancing description.' });

        try {
            // 1. Upload images to Cloudinary
            const imageUrls = await Promise.all(photos.map(uploadImage));
            toast({ title: 'Images Uploaded!', description: 'Your photos have been compressed and saved.' });
            
            // 2. Enhance description with AI
            let finalDescription = description;
            const roomFeaturesString = roomTypes.map(rt => `${rt.name} at GHS ${rt.price}`).join('; ');
            if (photos.length > 0 && description) {
                try {
                    const photoDataUris = await Promise.all(photos.map(file => {
                        return new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });
                    }));

                    const input = {
                        photosDataUris: photoDataUris,
                        gpsLocation,
                        nearbyLandmarks,
                        amenities: selectedAmenities.join(', '),
                        roomFeatures: roomFeaturesString,
                        currentDescription: description,
                    };
                    const result = await enhanceHostelDescription(input);
                    finalDescription = result.enhancedDescription;
                    toast({
                        title: "Description Enhanced!",
                        description: "The AI has improved the listing description.",
                    });
                } catch (error) {
                    console.error("AI Enhancement failed, using original description.", error);
                    toast({
                        title: "AI Enhancement Failed",
                        description: "Could not enhance description, using original text.",
                        variant: 'destructive',
                    });
                }
            }
            
            // 3. Use a batch write to add hostel and room types
            const batch = writeBatch(db);
            const hostelRef = doc(collection(db, 'pendingHostels'));

            batch.set(hostelRef, {
                name: hostelName,
                location: fullAddress || gpsLocation,
                coordinates: latitude && longitude ? { lat: latitude, lng: longitude } : null,
                nearbyLandmarks,
                rating: 0,
                reviews: 0,
                amenities: selectedAmenities,
                images: imageUrls,
                description: finalDescription,
                status: 'pending',
                agentId: currentUser.uid,
                dateSubmitted: new Date().toISOString(),
                availability: roomTypes.some(rt => rt.availability === 'Available' || rt.availability === 'Limited') ? 'Available' : 'Full',
                distanceToUniversity: distanceToUni,
                billsIncluded: billsIncluded,
                billsExcluded: billsExcluded,
                securityAndSafety: securityAndSafety,
                gender: gender,
            });
            
            // Save room types and create physical numbered rooms based on roomNumbers or numberOfRooms
            const roomTypeRefs: string[] = [];

            roomTypes.forEach(room => {
                const roomTypeRef = doc(collection(hostelRef, 'roomTypes'));

                // Firestore does not allow undefined values; strip them out before saving
                const sanitizedRoom: any = { ...room };
                Object.keys(sanitizedRoom).forEach((key) => {
                    if (sanitizedRoom[key] === undefined) {
                        delete sanitizedRoom[key];
                    }
                });

                batch.set(roomTypeRef, sanitizedRoom);
                roomTypeRefs.push(roomTypeRef.id);
            });

            // For each room type, create physical rooms under pendingHostels/{hostelId}/rooms
            roomTypes.forEach((room, index) => {
                const capacityPerRoom = room.capacity ?? 0;
                const roomTypeId = roomTypeRefs[index];
                const explicitNumbers = room.roomNumbers || [];
                const numberOfRooms = room.numberOfRooms ?? 1; // Default to 1 room if not specified

                if (!roomTypeId) return;

                if (explicitNumbers.length > 0) {
                    // Use explicitly selected room numbers
                    explicitNumbers.forEach((num) => {
                        const physicalRoomRef = doc(collection(hostelRef, 'rooms'));
                        batch.set(physicalRoomRef, {
                            roomNumber: `Room ${num}`,
                            roomTypeId,
                            capacity: capacityPerRoom,
                            currentOccupancy: 0,
                            status: 'active',
                        });
                    });
                } else {
                    // Auto-generate rooms based on numberOfRooms (defaults to 1)
                    for (let i = 0; i < numberOfRooms; i++) {
                        const physicalRoomRef = doc(collection(hostelRef, 'rooms'));
                        // Use simple sequential numbering: Room 1, Room 2, etc.
                        // If multiple room types, prefix with type index to avoid duplicates
                        const roomNum = roomTypes.length > 1 ? `${index + 1}-${i + 1}` : `${i + 1}`;
                        batch.set(physicalRoomRef, {
                            roomNumber: `Room ${roomNum}`,
                            roomTypeId,
                            capacity: capacityPerRoom,
                            currentOccupancy: 0,
                            status: 'active',
                        });
                    }
                }
            });

            await batch.commit();

            toast({ title: 'Submission Successful!', description: 'The hostel has been sent for admin approval.' });
            router.push('/agent/listings'); 
        } catch (error) {
            console.error("Submission error: ", error);
            setIsSubmitting(false);
            toast({
                title: 'Submission Failed',
                description: 'An error occurred. Please try again.',
                variant: 'destructive',
            });
        }
    };


    const validateCurrentStep = () => {
        if (step === 1) {
            // Validate basic hostel info
            if (!hostelName.trim()) {
                toast({ title: 'Missing Information', description: 'Please enter a hostel name.', variant: 'destructive' });
                return false;
            }
            if (!gender) {
                toast({ title: 'Missing Information', description: 'Please select gender preference.', variant: 'destructive' });
                return false;
            }
        }
        
        if (step === 2) {
            // Validate room types
            if (roomTypes.length === 0) {
                toast({ title: 'Missing Information', description: 'Please add at least one room type.', variant: 'destructive' });
                return false;
            }
            
            for (const [index, room] of roomTypes.entries()) {
                if (!room.name) {
                    toast({ title: 'Missing Information', description: `Please select a room type name for Room Type ${index + 1}.`, variant: 'destructive' });
                    return false;
                }
                if (!room.price || room.price <= 0) {
                    toast({ title: 'Missing Information', description: `Please enter a valid price for Room Type ${index + 1}.`, variant: 'destructive' });
                    return false;
                }
                if (!room.numberOfRooms || room.numberOfRooms <= 0) {
                    toast({ title: 'Missing Information', description: `Please select the number of rooms for Room Type ${index + 1}.`, variant: 'destructive' });
                    return false;
                }
                
                // Check if room numbers are selected when numberOfRooms is set
                const targetCount = room.numberOfRooms ?? 0;
                const selectedCount = room.roomNumbers?.length ?? 0;
                if (targetCount > 0 && selectedCount > 0 && selectedCount !== targetCount) {
                    toast({
                        title: 'Room Numbers Mismatch',
                        description: `Room Type ${index + 1} must have exactly ${targetCount} room numbers selected (currently ${selectedCount}).`,
                        variant: 'destructive',
                    });
                    return false;
                }
            }
        }
        
        if (step === 4) {
            // Validate location (photos and location step)
            if (!latitude || !longitude) {
                toast({ title: 'Missing Information', description: 'Please select the hostel location on the map.', variant: 'destructive' });
                return false;
            }
        }
        
        return true;
    };

    const nextStep = () => {
        if (!validateCurrentStep()) {
            return;
        }
        
        if (step < totalSteps) {
            setStep(s => s + 1);
        }
    };

    const prevStep = () => {
        if (step > 1) {
            setStep(s => s - 1);
        }
    };

    if (loadingAuth) {
        return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                </main>
            </div>
        );
    }

    if (!currentUser || userRole !== 'agent') {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                     <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in as an Agent to access this page. Please use the menu in the top right to log in.
                        </AlertDescription>
                    </Alert>
                </main>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex flex-col items-center py-12 px-4 bg-gray-50/50">
                <div className="w-full max-w-3xl">
                    <Progress value={progress} className="mb-4" />
                    <p className="text-center text-sm text-muted-foreground mb-4">Step {step} of {totalSteps}</p>
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline">List a New Hostel</CardTitle>
                            <CardDescription>{
                                step === 1 ? 'Hostel Information' :
                                step === 2 ? 'Room Types & Pricing' :
                                step === 3 ? 'Facilities & Location' : 
                                step === 4 ? 'Description & Photos' : 'Submission'
                            }</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {step === 1 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="hostel-name">Hostel Name</Label>
                                        <Input id="hostel-name" placeholder="e.g., Pioneer Hall" value={hostelName} onChange={(e) => setHostelName(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="landmarks">Nearby Landmarks</Label>
                                        <Input id="landmarks" placeholder="e.g., Accra Mall, University of Ghana" value={nearbyLandmarks} onChange={(e) => setNearbyLandmarks(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="distance">Distance to AAMUSTED University</Label>
                                        <Input id="distance" placeholder="e.g., 10mins" value={distanceToUni} onChange={(e) => setDistanceToUni(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="gender">Gender</Label>
                                        <Select value={gender} onValueChange={setGender}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select gender" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Male">Male</SelectItem>
                                                <SelectItem value="Female">Female</SelectItem>
                                                <SelectItem value="Mixed">Mixed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                             {step === 2 && (
                                <div className="space-y-4">
                                    <Label className="text-base font-semibold">Room Types & Pricing</Label>
                                    <p className="text-sm text-muted-foreground">Add all the different types of rooms available in this hostel.</p>
                                    {roomTypes.map((room, index) => {
                                        const capacity = room.capacity ?? 0;
                                        const occupancy = room.occupancy ?? 0;
                                        const hasError = capacity > 0 && occupancy > capacity;
                                        return (
                                        <div key={index} className="flex flex-col gap-3 p-4 border rounded-lg relative">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`room-name-${index}`}>Room Type Name *</Label>
                                                    <Select 
                                                        value={room.name} 
                                                        onValueChange={(value) => handleRoomTypeChange(index, 'name', value)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select room type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="1 IN A ROOM">1 IN A ROOM</SelectItem>
                                                            <SelectItem value="2 IN A ROOM">2 IN A ROOM</SelectItem>
                                                            <SelectItem value="3 IN A ROOM">3 IN A ROOM</SelectItem>
                                                            <SelectItem value="4 IN A ROOM">4 IN A ROOM</SelectItem>
                                                            <SelectItem value="5 IN A ROOM">5 IN A ROOM</SelectItem>
                                                            <SelectItem value="6 IN A ROOM">6 IN A ROOM</SelectItem>
                                                            <SelectItem value="7 IN A ROOM">7 IN A ROOM</SelectItem>
                                                            <SelectItem value="8 IN A ROOM">8 IN A ROOM</SelectItem>
                                                            <SelectItem value="9 IN A ROOM">9 IN A ROOM</SelectItem>
                                                            <SelectItem value="10 IN A ROOM">10 IN A ROOM</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`room-price-${index}`}>Price/Year (GH₵) *</Label>
                                                    <Input
                                                        id={`room-price-${index}`}
                                                        type="number"
                                                        placeholder="3500"
                                                        value={room.price || ''}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            // Allow empty string or valid numbers
                                                            if (value === '' || !isNaN(Number(value))) {
                                                                handleRoomTypeChange(index, 'price', value === '' ? 0 : Number(value));
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <Label htmlFor={`room-capacity-${index}`}>Persons (per room)</Label>
                                                    <Input
                                                        id={`room-capacity-${index}`}
                                                        type="number"
                                                        min="1"
                                                        placeholder="e.g., 4"
                                                        value={room.capacity || ''}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            if (value === '' || !isNaN(Number(value))) {
                                                                handleRoomTypeChange(index, 'capacity', value === '' ? 0 : Number(value));
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`room-occupancy-${index}`}>Current Occupancy</Label>
                                                    <Input
                                                        id={`room-occupancy-${index}`}
                                                        type="number"
                                                        min="0"
                                                        placeholder="e.g., 2"
                                                        value={room.occupancy || ''}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            if (value === '' || !isNaN(Number(value))) {
                                                                handleRoomTypeChange(index, 'occupancy', value === '' ? 0 : Number(value));
                                                            }
                                                        }}
                                                        className={hasError ? 'border-red-500' : ''}
                                                    />
                                                    {hasError && (
                                                        <p className="text-xs text-red-500">Occupancy cannot exceed capacity</p>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`room-number-${index}`}>Number of Rooms *</Label>
                                                    <Select 
                                                        value={room.numberOfRooms ? String(room.numberOfRooms) : ''} 
                                                        onValueChange={(value) => handleRoomTypeChange(index, 'numberOfRooms', Number(value))}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select number of rooms" />
                                                        </SelectTrigger>
                                                        <SelectContent className="max-h-60">
                                                            {Array.from({ length: 200 }, (_, i) => i + 1).map((num) => (
                                                                <SelectItem key={num} value={String(num)}>
                                                                    {num} {num === 1 ? 'room' : 'rooms'}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="mt-4 space-y-2">
                                                <Label>Room Amenities</Label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {roomAmenitiesList.map((amenity) => {
                                                        const currentAmenities = room.roomAmenities || [];
                                                        const checked = currentAmenities.includes(amenity);

                                                        return (
                                                            <div key={amenity} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`room-${index}-amenity-${amenity}`}
                                                                    checked={checked}
                                                                    onCheckedChange={(isChecked) => {
                                                                        const newRoomTypes = [...roomTypes];
                                                                        const rt = { ...(newRoomTypes[index] as RoomType) };
                                                                        const next = new Set(rt.roomAmenities || []);

                                                                        if (isChecked) {
                                                                            next.add(amenity);
                                                                        } else {
                                                                            next.delete(amenity);
                                                                        }

                                                                        rt.roomAmenities = Array.from(next);
                                                                        newRoomTypes[index] = rt;
                                                                        setRoomTypes(newRoomTypes);
                                                                    }}
                                                                />
                                                                <label
                                                                    htmlFor={`room-${index}-amenity-${amenity}`}
                                                                    className="text-xs sm:text-sm"
                                                                >
                                                                    {amenity}
                                                                </label>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="mt-3 space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <Label>Room Numbers (optional)</Label>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        Pick real room numbers, or leave empty and we will auto-generate.
                                                    </p>
                                                </div>
                                                <div className="max-h-32 overflow-y-auto rounded-md border border-dashed border-muted-foreground/30 p-2">
                                                    <div className="grid grid-cols-6 gap-1 text-xs">
                                                        {Array.from({ length: 200 }, (_, i) => String(i + 1)).map((num) => {
                                                            const selected = (room.roomNumbers || []).includes(num);
                                                            return (
                                                                <button
                                                                    key={num}
                                                                    type="button"
                                                                    onClick={() => toggleRoomNumberForType(index, num, !selected)}
                                                                    className={`inline-flex items-center justify-center rounded border px-1.5 py-1 transition-colors ${
                                                                        selected
                                                                            ? 'border-primary bg-primary text-primary-foreground'
                                                                            : 'border-muted-foreground/30 bg-background text-muted-foreground hover:border-primary/50'
                                                                    }`}
                                                                >
                                                                    {num}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                {room.numberOfRooms && room.numberOfRooms > 0 && (
                                                    <p className="text-xs text-muted-foreground">
                                                        💡 You set {room.numberOfRooms} rooms. Select exactly {room.numberOfRooms} room numbers above, or leave empty for auto-generation.
                                                    </p>
                                                )}
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute top-2 right-2 h-7 w-7 text-muted-foreground"
                                                onClick={() => removeRoomType(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )})}
                                    <Button variant="outline" onClick={addRoomType} className="w-full">
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Add Another Room Type
                                    </Button>
                                </div>
                            )}
                             {step === 3 && (
                                <div className="space-y-6">
                                     <div>
                                        <Label className="text-base font-semibold">Amenities & Services</Label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
                                            {hostelAmenitiesList.map(item => (
                                                <div key={item} className="flex items-center space-x-2">
                                                    <Checkbox id={`amenity-${item}`} checked={selectedAmenities.includes(item)} onCheckedChange={(checked) => handleCheckboxChange(setSelectedAmenities, item, !!checked)} />
                                                    <label htmlFor={`amenity-${item}`} className="text-sm font-medium">{item}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-base font-semibold flex items-center gap-2"><FileText className="h-4 w-4"/>Student Bills</Label>
                                        <div className="p-3 border rounded-md mt-2 space-y-4">
                                            <p className="text-sm font-medium">Included:</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                {billsIncludedList.map(item => (
                                                    <div key={item} className="flex items-center space-x-2">
                                                        <Checkbox id={`bills-inc-${item}`} checked={billsIncluded.includes(item)} onCheckedChange={(checked) => handleCheckboxChange(setBillsIncluded, item, !!checked)} />
                                                        <label htmlFor={`bills-inc-${item}`} className="text-sm">{item}</label>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-sm font-medium">Excluded:</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                 {billsExcludedList.map(item => (
                                                    <div key={item} className="flex items-center space-x-2">
                                                        <Checkbox id={`bills-exc-${item}`} checked={billsExcluded.includes(item)} onCheckedChange={(checked) => handleCheckboxChange(setBillsExcluded, item, !!checked)} />
                                                        <label htmlFor={`bills-exc-${item}`} className="text-sm">{item}</label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-base font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4"/>Security & Safety</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                             {securitySafetyList.map(item => (
                                                <div key={item} className="flex items-center space-x-2">
                                                    <Checkbox id={`sec-${item}`} checked={securityAndSafety.includes(item)} onCheckedChange={(checked) => handleCheckboxChange(setSecurityAndSafety, item, !!checked)} />
                                                    <label htmlFor={`sec-${item}`} className="text-sm">{item}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {step === 4 && (
                                <div className="space-y-6">
                                     <div>
                                        <Label htmlFor="photos-input">Upload up to 5 Photos</Label>
                                        <div 
                                            className="mt-2 border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-accent/10"
                                            onClick={() => document.getElementById('photos-input')?.click()}
                                        >
                                            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                                            <p className="mt-2 text-sm text-muted-foreground">Drag & drop photos here, or click to select files</p>
                                            <Input id="photos-input" type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={photos.length >= 5} />
                                        </div>
                                        <div className="grid grid-cols-5 gap-2 mt-2">
                                            {photoPreviews.map((preview, i) => (
                                                <div key={i} className="relative bg-muted aspect-square rounded-md flex items-center justify-center overflow-hidden">
                                                    <Image
                                                        src={preview}
                                                        alt={`Preview ${i+1}`}
                                                        fill
                                                        sizes="(max-width: 640px) 100vw, 200px"
                                                        style={{objectFit: 'cover'}}
                                                    />
                                                </div>
                                            ))}
                                            {[...Array(5 - photoPreviews.length)].map((_, i) => (
                                                <div key={i} className="bg-muted aspect-square rounded-md flex items-center justify-center">
                                                    <span className="text-xs text-muted-foreground">Photo {photoPreviews.length + i + 1}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hostel Location</Label>
                                        <MapboxLocationPicker
                                            onLocationSelect={(location) => {
                                                setLatitude(location.lat);
                                                setLongitude(location.lng);
                                                setFullAddress(location.address);
                                                setGpsLocation(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
                                            }}
                                            initialLocation={latitude && longitude ? { lat: latitude, lng: longitude } : undefined}
                                            initialAddress={fullAddress}
                                        />
                                    </div>
                                     <div className="space-y-2">
                                        <Label htmlFor="description">Main Hostel Description</Label>
                                        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the room, its features, and what makes it a great place for students." rows={6} />
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> An AI will enhance this description upon submission to make it more appealing.</p>
                                    </div>
                                </div>
                            )}
                             {step === 5 && (
                                <div className="space-y-4 text-center">
                                    <h3 className="text-xl font-semibold">Final Check</h3>
                                    <p className="text-muted-foreground">You are about to submit <span className="font-bold">{hostelName}</span> for approval. Please confirm all details are correct.</p>
                                    <Alert>
                                        <Lightbulb className="h-4 w-4" />
                                        <AlertTitle>AI Enhancement</AlertTitle>
                                        <AlertDescription>
                                            The main description you provided will be automatically enhanced by our AI to make it more attractive to students.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-between mt-8">
                            <Button variant="outline" onClick={prevStep} disabled={isSubmitting || step === 1}>Previous</Button>
                            {step < totalSteps ? (
                                <Button onClick={nextStep} disabled={isSubmitting || !currentUser}>Next</Button>
                            ) : (
                                <Button onClick={handleSubmit} disabled={isSubmitting || !currentUser}>
                                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}

    