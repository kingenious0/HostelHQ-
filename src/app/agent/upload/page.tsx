
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Sparkles, MapPin, Loader2, AlertTriangle, DollarSign, PlusCircle, Trash2, BedDouble, ShieldCheck, FileText, Lightbulb } from 'lucide-react';
import { enhanceHostelDescription } from '@/ai/flows/enhance-hostel-description';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { addDoc, collection, writeBatch, doc } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { uploadImage } from '@/lib/cloudinary';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RoomType } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const amenitiesList = ['WiFi', 'Kitchen', 'Laundry', 'AC', 'Gym', 'Parking', 'Study Area'];
const billsIncludedList = ['Water', 'Refuse'];
const billsExcludedList = ['Gas', 'Electricity'];
const securitySafetyList = ['Security Alarm', 'Maintenance Team (24-hour on call)', 'Entire Building Fenced', 'Controlled Access Gate (24-hour)', 'Tanoso Police Station (close)'];


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
    const [description, setDescription] = useState('');
    const [roomTypes, setRoomTypes] = useState<Partial<RoomType>[]>([
        { name: '', price: 0, availability: 'Available' }
    ]);
    const [distanceToUni, setDistanceToUni] = useState('');
    const [billsIncluded, setBillsIncluded] = useState<string[]>([]);
    const [billsExcluded, setBillsExcluded] = useState<string[]>([]);
    const [securityAndSafety, setSecurityAndSafety] = useState<string[]>([]);
    
    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
    const [loadingAuth, setLoadingAuth] = useState(true);

    const totalSteps = 5;
    const progress = (step / totalSteps) * 100;

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    const handleRoomTypeChange = (index: number, field: keyof RoomType, value: string | number) => {
        const newRoomTypes = [...roomTypes];
        (newRoomTypes[index] as any)[field] = value;
        setRoomTypes(newRoomTypes);
    };

    const addRoomType = () => {
        setRoomTypes([...roomTypes, { name: '', price: 0, availability: 'Available' }]);
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
                location: gpsLocation,
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
            });
            
            roomTypes.forEach(room => {
                const roomTypeRef = doc(collection(hostelRef, 'roomTypes'));
                batch.set(roomTypeRef, room);
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


    const nextStep = () => {
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

    if (!currentUser) {
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
                                </div>
                            )}
                             {step === 2 && (
                                <div className="space-y-4">
                                    <Label className="text-base font-semibold">Room Types & Pricing</Label>
                                    <p className="text-sm text-muted-foreground">Add all the different types of rooms available in this hostel.</p>
                                    {roomTypes.map((room, index) => (
                                        <div key={index} className="flex flex-col md:flex-row gap-3 p-4 border rounded-lg relative">
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
                            )}
                             {step === 3 && (
                                <div className="space-y-6">
                                     <div>
                                        <Label className="text-base font-semibold">Amenities</Label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
                                            {amenitiesList.map(item => (
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
                                                    <Image src={preview} alt={`Preview ${i+1}`} fill style={{objectFit: 'cover'}}/>
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
                                        <Label htmlFor="gps">GPS Location</Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input id="gps" placeholder="e.g., 5.6037, -0.1870" className="pl-10" value={gpsLocation} onChange={e => setGpsLocation(e.target.value)} />
                                        </div>
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

    