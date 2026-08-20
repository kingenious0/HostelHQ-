
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Sparkles, MapPin, Loader2, AlertTriangle, DollarSign, Trash2, PlusCircle, ShieldCheck, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, addDoc, deleteDoc as deleteRoomDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { uploadImage } from '@/lib/cloudinary';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RoomType, Hostel } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BackButton } from '@/components/ui/back-button';

const amenitiesList = ['WiFi', 'Kitchen', 'Laundry', 'AC', 'Gym', 'Parking', 'Study Area'];
const billsIncludedList = ['Water', 'Refuse'];
const billsExcludedList = ['Gas', 'Electricity'];
const securitySafetyList = ['Security Alarm', 'Maintenance Team (24-hour on call)', 'Entire Building Fenced', 'Controlled Access Gate (24-hour)', 'Tanoso Police Station (close)'];
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


type HostelData = Partial<Hostel>;

export default function EditListingPage() {
    const [formData, setFormData] = useState<HostelData>({});
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [photos, setPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [isApprovedListing, setIsApprovedListing] = useState(false);

    const router = useRouter();
    const params = useParams();
    const { id: hostelId } = params;
    const { toast } = useToast();

    const isAdmin = userRole === 'admin';
    const isAgent = userRole === 'agent';
    const returnPath = isAdmin ? '/admin/listings' : '/agent/listings';

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

    useEffect(() => {
        if (!hostelId || !currentUser || (!isAdmin && !isAgent)) return;

        const fetchHostelData = async () => {
            setLoading(true);
            const hostelIdStr = hostelId as string;
            
            let docRef = doc(db, 'hostels', hostelIdStr);
            let docSnap = await getDoc(docRef);
            let isApproved = true;

            if (!docSnap.exists()) {
                docRef = doc(db, 'pendingHostels', hostelIdStr);
                docSnap = await getDoc(docRef);
                isApproved = false;
            }
            
            setIsApprovedListing(isApproved);

            if (docSnap.exists()) {
                const hostelData = docSnap.data() as HostelData;
                if (!isAdmin && hostelData.agentId !== currentUser.uid) {
                    toast({ title: "Access Denied", description: "You can only edit your own listings.", variant: "destructive" });
                    router.push(returnPath);
                    return;
                }
                setFormData(hostelData);
                setPhotoPreviews(hostelData.images || []);

                const roomTypesRef = collection(docRef, 'roomTypes');
                const roomTypesSnap = await getDocs(roomTypesRef);
                const fetchedRoomTypes = roomTypesSnap.docs.map(d => ({...d.data(), id: d.id})) as RoomType[];
                setRoomTypes(fetchedRoomTypes);

            } else {
                toast({ title: "Not Found", description: "This listing does not exist.", variant: "destructive" });
                router.push(returnPath);
            }
            setLoading(false);
        };

        fetchHostelData();
    }, [hostelId, currentUser, router, toast, isAdmin, isAgent, returnPath]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleRoomTypeChange = (index: number, field: keyof RoomType, value: string | number | undefined) => {
        const newRoomTypes = [...roomTypes];
        (newRoomTypes[index] as any)[field] = value;
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
        const newId = `new-${Date.now()}`;
        setRoomTypes([...roomTypes, { id: newId, name: '', price: 0, availability: 'Available', capacity: 0, occupancy: 0, roomAmenities: [] }]);
    };

    const removeRoomType = (index: number) => {
        if (roomTypes.length <= 1) {
            toast({ title: "Cannot Remove", description: "You must have at least one room type.", variant: "destructive" });
            return;
        }
        const newRoomTypes = roomTypes.filter((_, i) => i !== index);
        setRoomTypes(newRoomTypes);
    };

    const handleCheckboxChange = (field: keyof HostelData, item: string, checked: boolean) => {
        const currentItems = (formData[field] as string[] | undefined) || [];
        setFormData(prev => ({
            ...prev,
            [field]: checked ? [...currentItems, item] : currentItems.filter(i => i !== item)
        }));
    };
    
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setPhotos(prev => [...prev, ...newFiles]);
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setPhotoPreviews(prev => [...(prev || []), ...newPreviews]);
        }
    };

    const removePhoto = (index: number, isExisting: boolean) => {
        if (isExisting) {
            setFormData(prev => ({
                ...prev,
                images: prev.images?.filter((_, i) => i !== index)
            }));
            setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
        } else {
            setPhotos([]);
            setPhotoPreviews(formData.images || []);
            toast({ title: "New Photos Cleared", description: "To remove a single new photo, please re-select your desired images."});
        }
    };


    const handleSubmit = async () => {
        if (!currentUser || !hostelId) return;

        // Validate capacity and occupancy
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
        }

        setIsSubmitting(true);
        toast({ title: 'Updating listing...' });

        try {
            const collectionName = isApprovedListing ? 'hostels' : 'pendingHostels';
            const hostelRef = doc(db, collectionName, hostelId as string);
            const roomTypesCollection = collection(hostelRef, 'roomTypes');

            let updatedImageUrls = formData.images || [];

            if (photos.length > 0) {
                const newImageUrls = await Promise.all(photos.map(uploadImage));
                updatedImageUrls = [...updatedImageUrls, ...newImageUrls];
            }

            const { id, roomTypes: rt, priceRange, ...updateData } = formData;

            await updateDoc(hostelRef, {
                ...updateData,
                images: updatedImageUrls,
                updatedAt: serverTimestamp()
            });

            const existingRoomTypeDocs = await getDocs(roomTypesCollection);
            const existingRoomTypeIds = existingRoomTypeDocs.docs.map(d => d.id);
            const desiredRoomTypeIds = new Set(
                roomTypes
                    .map((rt) => rt.id)
                    .filter((roomId): roomId is string => Boolean(roomId) && !roomId.startsWith('new-'))
            );

            const deletions = existingRoomTypeIds
                .filter((id) => !desiredRoomTypeIds.has(id))
                .map((id) => deleteRoomDoc(doc(roomTypesCollection, id)));
            if (deletions.length) {
                await Promise.all(deletions);
            }

            // Track room type IDs for creating physical rooms
            const roomTypeRefs: { id: string; room: RoomType }[] = [];
            
            for (const room of roomTypes) {
                const { id: roomId, ...roomData } = room;
                if (roomId && !roomId.startsWith('new-')) {
                    await updateDoc(doc(roomTypesCollection, roomId), roomData);
                    roomTypeRefs.push({ id: roomId, room });
                } else {
                    const newRef = await addDoc(roomTypesCollection, roomData);
                    roomTypeRefs.push({ id: newRef.id, room });
                }
            }

            // Now sync physical rooms based on numberOfRooms for each room type
            const roomsCollection = collection(hostelRef, 'rooms');
            const existingRoomsSnap = await getDocs(roomsCollection);
            const existingRooms = existingRoomsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
            
            const batch = writeBatch(db);
            let batchHasOperations = false;
            
            for (const { id: roomTypeId, room } of roomTypeRefs) {
                const explicitNumbers = room.roomNumbers || [];
                const numberOfRooms = room.numberOfRooms ?? 1;
                const capacityPerRoom = room.capacity ?? 0;
                const typeIndex = roomTypeRefs.findIndex(r => r.id === roomTypeId);
                
                // Get existing rooms for this room type
                const existingForType = existingRooms.filter(r => r.roomTypeId === roomTypeId);
                const currentCount = existingForType.length;
                
                // Determine target room count
                const targetCount = explicitNumbers.length > 0 ? explicitNumbers.length : numberOfRooms;
                
                if (currentCount < targetCount) {
                    // Need to create more rooms
                    for (let i = currentCount; i < targetCount; i++) {
                        const physicalRoomRef = doc(collection(hostelRef, 'rooms'));
                        let roomNum: string;
                        
                        if (explicitNumbers.length > 0 && explicitNumbers[i]) {
                            // Use explicit room number
                            roomNum = explicitNumbers[i];
                        } else {
                            // Auto-generate room number
                            roomNum = roomTypes.length > 1 
                                ? `${typeIndex + 1}-${i + 1}` 
                                : `${i + 1}`;
                        }
                        
                        batch.set(physicalRoomRef, {
                            roomNumber: `Room ${roomNum}`,
                            roomTypeId,
                            capacity: capacityPerRoom,
                            currentOccupancy: 0,
                            status: 'active',
                        });
                        batchHasOperations = true;
                    }
                } else if (currentCount > targetCount) {
                    // Need to delete excess rooms (only delete rooms with 0 occupancy)
                    const roomsToDelete = existingForType
                        .filter(r => (r.currentOccupancy ?? 0) === 0)
                        .slice(0, currentCount - targetCount);
                    
                    for (const roomToDelete of roomsToDelete) {
                        batch.delete(doc(roomsCollection, roomToDelete.id));
                        batchHasOperations = true;
                    }
                }
                
                // Update capacity for existing rooms of this type
                for (const existingRoom of existingForType) {
                    if (existingRoom.capacity !== capacityPerRoom) {
                        batch.update(doc(roomsCollection, existingRoom.id), { capacity: capacityPerRoom });
                        batchHasOperations = true;
                    }
                }
            }
            
            if (batchHasOperations) {
                await batch.commit();
            }

            const successMessage = isApprovedListing 
                ? 'Your live listing has been updated.'
                : 'Your changes have been submitted for review.';

            toast({ title: 'Listing Updated!', description: successMessage });
            router.push(returnPath);

        } catch (error) {
            console.error("Update error: ", error);
            toast({ title: 'Update Failed', description: 'An error occurred. Please try again.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loadingAuth || loading) {
        return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                </main>
            </div>
        );
    }
    
    if (!currentUser || (!isAgent && !isAdmin)) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                     <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in as an Agent or Admin to edit a listing.
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
                <Card className="w-full max-w-3xl shadow-lg">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <BackButton fallbackHref={returnPath} />
                            <CardTitle className="text-2xl font-headline">Edit Hostel Listing</CardTitle>
                            <div className="w-10">{/* Placeholder to balance the layout */}</div>
                        </div>
                        <CardDescription>Update the details for "{formData.name}".</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>
                             <div className="space-y-2">
                                <Label htmlFor="name">Hostel Name</Label>
                                <Input id="name" value={formData.name || ''} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location">GPS Location</Label>
                                <Input id="location" value={formData.location || ''} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="nearbyLandmarks">Nearby Landmarks</Label>
                                <Input id="nearbyLandmarks" value={formData.nearbyLandmarks || ''} onChange={handleInputChange} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="distanceToUniversity">Distance to AAMUSTED University</Label>
                                <Input id="distanceToUniversity" placeholder="e.g., 10mins" value={formData.distanceToUniversity || ''} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender">Gender</Label>
                                <Select value={formData.gender || 'Mixed'} onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}>
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

                        {/* Room Types */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">Room Types & Pricing</h3>
                            {roomTypes.map((room, index) => {
                                const capacity = room.capacity ?? 0;
                                const occupancy = room.occupancy ?? 0;
                                const hasError = capacity > 0 && occupancy > capacity;
                                return (
                                <div key={room.id} className="flex flex-col gap-3 p-4 border rounded-lg relative">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        <div className="space-y-2">
                                            <Label htmlFor={`room-name-${index}`}>Room Type Name</Label>
                                            <Input 
                                                id={`room-name-${index}`} 
                                                placeholder="e.g., 4 in a room, Annex"
                                                value={room.name}
                                                onChange={(e) => handleRoomTypeChange(index, 'name', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`room-price-${index}`}>Price/Year (GH₵)</Label>
                                            <Input
                                                id={`room-price-${index}`}
                                                type="number"
                                                placeholder="3500"
                                                value={room.price}
                                                onChange={(e) => handleRoomTypeChange(index, 'price', Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`room-availability-${index}`}>Availability</Label>
                                            <Select 
                                                value={room.availability} 
                                                onValueChange={(value) => handleRoomTypeChange(index, 'availability', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Available">Available</SelectItem>
                                                    <SelectItem value="Limited">Limited</SelectItem>
                                                    <SelectItem value="Full">Full</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`room-capacity-${index}`}>Capacity (per room)</Label>
                                            <Input
                                                id={`room-capacity-${index}`}
                                                type="number"
                                                min="1"
                                                placeholder="e.g., 4"
                                                value={room.capacity || ''}
                                                onChange={(e) => handleRoomTypeChange(index, 'capacity', Number(e.target.value) || 0)}
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
                                                onChange={(e) => handleRoomTypeChange(index, 'occupancy', Number(e.target.value) || 0)}
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
                                    
                                    {/* Room Amenities */}
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
                                    
                                    {/* Room Numbers Selection */}
                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label>Room Numbers (optional)</Label>
                                            <p className="text-[11px] text-muted-foreground">
                                                Pick real room numbers, or leave empty for auto-generation.
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
                        
                        {/* Amenities, Bills, Security */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold text-lg border-b pb-2">Amenities</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
                                    {amenitiesList.map(item => (
                                        <div key={item} className="flex items-center space-x-2">
                                            <Checkbox id={`amenity-${item}`} checked={formData.amenities?.includes(item)} onCheckedChange={(checked) => handleCheckboxChange('amenities', item, !!checked)} />
                                            <label htmlFor={`amenity-${item}`} className="text-sm font-medium">{item}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                             <div>
                                <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2"><FileText className="h-4 w-4"/>Student Bills</h3>
                                <div className="p-3 border rounded-md mt-2 space-y-4">
                                    <p className="text-sm font-medium">Included:</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        {billsIncludedList.map(item => (
                                            <div key={item} className="flex items-center space-x-2">
                                                <Checkbox id={`bills-inc-${item}`} checked={formData.billsIncluded?.includes(item)} onCheckedChange={(checked) => handleCheckboxChange('billsIncluded', item, !!checked)} />
                                                <label htmlFor={`bills-inc-${item}`} className="text-sm">{item}</label>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-sm font-medium">Excluded:</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                         {billsExcludedList.map(item => (
                                            <div key={item} className="flex items-center space-x-2">
                                                <Checkbox id={`bills-exc-${item}`} checked={formData.billsExcluded?.includes(item)} onCheckedChange={(checked) => handleCheckboxChange('billsExcluded', item, !!checked)} />
                                                <label htmlFor={`bills-exc-${item}`} className="text-sm">{item}</label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4"/>Security & Safety</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                     {securitySafetyList.map(item => (
                                        <div key={item} className="flex items-center space-x-2">
                                            <Checkbox id={`sec-${item}`} checked={formData.securityAndSafety?.includes(item)} onCheckedChange={(checked) => handleCheckboxChange('securityAndSafety', item, !!checked)} />
                                            <label htmlFor={`sec-${item}`} className="text-sm">{item}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Photos */}
                         <div>
                            <h3 className="font-semibold text-lg border-b pb-2">Photos</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
                                {photoPreviews.map((preview, i) => (
                                    <div key={i} className="relative aspect-square">
                                        <Image
                                            src={preview}
                                            alt={`Preview ${i+1}`}
                                            fill
                                            sizes="(max-width: 640px) 100vw, 200px"
                                            style={{objectFit: 'cover'}}
                                            className="rounded-md"
                                        />
                                        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removePhoto(i, true)}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                             <div className="mt-4">
                                <Label htmlFor="photos-input">Add More Photos</Label>
                                <Input id="photos-input" type="file" multiple accept="image/*" onChange={handlePhotoChange} />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                             <h3 className="font-semibold text-lg border-b pb-2">Description</h3>
                            <Textarea id="description" value={formData.description || ''} onChange={handleInputChange} rows={6} />
                            {!isApprovedListing && (
                                <p className="text-xs text-muted-foreground mt-1">The AI will re-enhance this on submission if it meets criteria.</p>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}

    
