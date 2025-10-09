
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
import { Upload, Sparkles, MapPin, Loader2, AlertTriangle, DollarSign, Trash2, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, writeBatch, addDoc } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { uploadImage } from '@/lib/cloudinary';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RoomType } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const amenitiesList = ['WiFi', 'Kitchen', 'Laundry', 'AC', 'Gym', 'Parking', 'Study Area'];

type HostelData = {
    name: string;
    location: string;
    nearbyLandmarks: string;
    amenities: string[];
    images: string[];
    description: string;
    agentId: string;
};

export default function EditListingPage() {
    const [formData, setFormData] = useState<Partial<HostelData>>({});
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [photos, setPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [isApprovedListing, setIsApprovedListing] = useState(false);

    const router = useRouter();
    const params = useParams();
    const { id: hostelId } = params;
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!hostelId || !currentUser) return;

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
                if (hostelData.agentId !== currentUser.uid) {
                    toast({ title: "Access Denied", description: "You can only edit your own listings.", variant: "destructive" });
                    router.push('/agent/listings');
                    return;
                }
                setFormData(hostelData);
                setPhotoPreviews(hostelData.images || []);

                // Fetch room types
                const roomTypesRef = collection(docRef, 'roomTypes');
                const roomTypesSnap = await getDocs(roomTypesRef);
                const fetchedRoomTypes = roomTypesSnap.docs.map(d => ({...d.data(), id: d.id})) as RoomType[];
                setRoomTypes(fetchedRoomTypes);

            } else {
                toast({ title: "Not Found", description: "This listing does not exist.", variant: "destructive" });
                router.push('/agent/listings');
            }
            setLoading(false);
        };

        fetchHostelData();
    }, [hostelId, currentUser, router, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleRoomTypeChange = (index: number, field: keyof RoomType, value: string | number) => {
        const newRoomTypes = [...roomTypes];
        (newRoomTypes[index] as any)[field] = value;
        setRoomTypes(newRoomTypes);
    };

    const addRoomType = () => {
        // Add a temporary, client-side-only ID for keying purposes
        const newId = `new-${Date.now()}`;
        setRoomTypes([...roomTypes, { id: newId, name: '', price: 0, availability: 'Available' }]);
    };

    const removeRoomType = (index: number) => {
        if (roomTypes.length <= 1) {
            toast({ title: "Cannot Remove", description: "You must have at least one room type.", variant: "destructive" });
            return;
        }
        const newRoomTypes = roomTypes.filter((_, i) => i !== index);
        setRoomTypes(newRoomTypes);
    };

    const handleAmenityChange = (amenity: string, checked: boolean) => {
        const currentAmenities = formData.amenities || [];
        setFormData(prev => ({
            ...prev,
            amenities: checked ? [...currentAmenities, amenity] : currentAmenities.filter(a => a !== amenity)
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

        setIsSubmitting(true);
        toast({ title: 'Updating listing...' });

        try {
            const collectionName = isApprovedListing ? 'hostels' : 'pendingHostels';
            const hostelRef = doc(db, collectionName, hostelId as string);
            
            const batch = writeBatch(db);

            let updatedImageUrls = formData.images || [];

            if (photos.length > 0) {
                const newImageUrls = await Promise.all(photos.map(uploadImage));
                updatedImageUrls = [...updatedImageUrls, ...newImageUrls];
            }

            // Update main hostel document
            batch.update(hostelRef, {
                ...formData,
                images: updatedImageUrls,
                updatedAt: serverTimestamp()
            });

            // Sync room types
            const existingRoomTypeIds = (await getDocs(collection(hostelRef, 'roomTypes'))).docs.map(d => d.id);
            const currentRoomTypeIds = roomTypes.map(rt => rt.id).filter(id => id && !id.startsWith('new-'));

            // Delete rooms that were removed
            for (const id of existingRoomTypeIds) {
                if (!currentRoomTypeIds.includes(id)) {
                    batch.delete(doc(hostelRef, 'roomTypes', id));
                }
            }
            
            // Update or add new rooms
            for (const room of roomTypes) {
                const { id, ...roomData } = room;
                if (id && !id.startsWith('new-')) {
                    // Update existing room
                    batch.update(doc(hostelRef, 'roomTypes', id), roomData);
                } else {
                    // Add new room
                    const newRoomRef = doc(collection(hostelRef, 'roomTypes'));
                    batch.set(newRoomRef, roomData);
                }
            }

            await batch.commit();

            const successMessage = isApprovedListing 
                ? 'Your live listing has been updated.'
                : 'Your changes have been submitted for review.';

            toast({ title: 'Listing Updated!', description: successMessage });
            router.push('/agent/listings');

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
    
    if (!currentUser) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                     <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in to edit a listing.
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
                        <CardTitle className="text-2xl font-headline">Edit Hostel Listing</CardTitle>
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
                        </div>

                        {/* Room Types */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">Room Types & Pricing</h3>
                            {roomTypes.map((room, index) => (
                                <div key={room.id} className="flex flex-col md:flex-row gap-3 p-4 border rounded-lg relative">
                                    <div className="flex-1 space-y-2">
                                        <Label htmlFor={`room-name-${index}`}>Room Type Name</Label>
                                        <Input 
                                            id={`room-name-${index}`} 
                                            placeholder="e.g., 4 in a room, Annex"
                                            value={room.name}
                                            onChange={(e) => handleRoomTypeChange(index, 'name', e.target.value)}
                                        />
                                    </div>
                                     <div className="w-full md:w-40 space-y-2">
                                        <Label htmlFor={`room-price-${index}`}>Price/Year (GH₵)</Label>
                                        <Input
                                            id={`room-price-${index}`}
                                            type="number"
                                            placeholder="3500"
                                            value={room.price}
                                            onChange={(e) => handleRoomTypeChange(index, 'price', Number(e.target.value))}
                                        />
                                    </div>
                                     <div className="w-full md:w-48 space-y-2">
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
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground"
                                        onClick={() => removeRoomType(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" onClick={addRoomType} className="w-full">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Another Room Type
                            </Button>
                        </div>
                        
                        {/* Amenities */}
                        <div className="space-y-4">
                             <h3 className="font-semibold text-lg border-b pb-2">Amenities</h3>
                             <div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
                                    {amenitiesList.map(amenity => (
                                        <div key={amenity} className="flex items-center space-x-2">
                                            <Checkbox id={amenity} checked={formData.amenities?.includes(amenity)} onCheckedChange={(checked) => handleAmenityChange(amenity, !!checked)} />
                                            <label htmlFor={amenity} className="text-sm font-medium">{amenity}</label>
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
                                        <Image src={preview} alt={`Preview ${i+1}`} fill style={{objectFit: 'cover'}} className="rounded-md"/>
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
