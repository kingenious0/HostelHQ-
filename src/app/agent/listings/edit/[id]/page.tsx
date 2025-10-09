
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
import { Upload, Sparkles, MapPin, Loader2, AlertTriangle, DollarSign, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { uploadImage } from '@/lib/cloudinary';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const amenitiesList = ['WiFi', 'Kitchen', 'Laundry', 'AC', 'Gym', 'Parking', 'Study Area'];

type HostelData = {
    name: string;
    location: string;
    nearbyLandmarks: string;
    price: number;
    amenities: string[];
    roomFeatures: { beds: string; bathrooms: string };
    images: string[];
    description: string;
    agentId: string;
};

export default function EditListingPage() {
    const [formData, setFormData] = useState<Partial<HostelData>>({});
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
            
            // 1. Try fetching from 'hostels' (approved) collection first
            let docRef = doc(db, 'hostels', hostelIdStr);
            let docSnap = await getDoc(docRef);
            let isApproved = true;

            // 2. If not found, fall back to 'pendingHostels'
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

    const handleRoomFeatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({
            ...prev,
            roomFeatures: { ...prev.roomFeatures, [id]: value } as { beds: string; bathrooms: string }
        }));
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
            // This needs to be more complex to match file with preview
            // For now, let's just clear new photos if one is removed
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
            let updatedImageUrls = formData.images || [];

            if (photos.length > 0) {
                const newImageUrls = await Promise.all(photos.map(uploadImage));
                updatedImageUrls = [...updatedImageUrls, ...newImageUrls];
            }

            // Determine which collection to update
            const collectionName = isApprovedListing ? 'hostels' : 'pendingHostels';
            const docRef = doc(db, collectionName, hostelId as string);
            
            await updateDoc(docRef, {
                ...formData,
                price: Number(formData.price) || 0,
                images: updatedImageUrls,
                updatedAt: serverTimestamp()
            });

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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Hostel Name</Label>
                                    <Input id="name" value={formData.name || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="price">Price per Year (GH₵)</Label>
                                    <Input id="price" type="number" value={formData.price || ''} onChange={e => setFormData(p => ({...p, price: Number(e.target.value)}))} />
                                </div>
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

                        {/* Room Features & Amenities */}
                        <div className="space-y-4">
                             <h3 className="font-semibold text-lg border-b pb-2">Features & Amenities</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="beds">Number of Beds</Label>
                                    <Input id="beds" type="number" value={formData.roomFeatures?.beds || ''} onChange={handleRoomFeatureChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bathrooms">Bathroom Details</Label>
                                    <Input id="bathrooms" value={formData.roomFeatures?.bathrooms || ''} onChange={handleRoomFeatureChange} />
                                </div>
                            </div>
                             <div>
                                <Label className="text-base font-semibold">Amenities</Label>
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
                                <p className="text-xs text-muted-foreground mt-1">The AI will re-enhance this on submission.</p>
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
