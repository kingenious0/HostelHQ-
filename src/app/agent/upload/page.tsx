
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
import { Upload, Sparkles, MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { enhanceHostelDescription } from '@/ai/flows/enhance-hostel-description';
import { useToast } from '@/hooks/use-toast';
import { db, storage, auth } from '@/lib/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const amenitiesList = ['WiFi', 'Kitchen', 'Laundry', 'AC', 'Gym', 'Parking', 'Study Area'];

export default function AgentUploadPage() {
    const [step, setStep] = useState(1);
    const { toast } = useToast();
    const router = useRouter();

    // Form State
    const [hostelName, setHostelName] = useState('');
    const [nearbyLandmarks, setNearbyLandmarks] = useState('');
    const [beds, setBeds] = useState('');
    const [bathrooms, setBathrooms] = useState('');
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
    const [photos, setPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [gpsLocation, setGpsLocation] = useState('');
    const [description, setDescription] = useState('');
    
    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
    const [loadingAuth, setLoadingAuth] = useState(true);

    const totalSteps = 4;
    const progress = (step / totalSteps) * 100;

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);


    const handleAmenityChange = (amenity: string, checked: boolean) => {
        setSelectedAmenities(prev => 
            checked ? [...prev, amenity] : prev.filter(a => a !== amenity)
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

        setIsSubmitting(true);
        toast({ title: 'Submitting hostel...', description: 'Enhancing description and uploading files.' });

        try {
            // 1. Enhance description with AI
            let finalDescription = description;
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
                        roomFeatures: `${beds} beds, ${bathrooms} bathrooms`,
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
            
            // 2. Upload images to Firebase Storage
            const imageUrls = await Promise.all(
                photos.map(async (photo) => {
                    const storageRef = ref(storage, `hostel-images/${currentUser.uid}/${Date.now()}-${photo.name}`);
                    await uploadBytes(storageRef, photo);
                    const downloadUrl = await getDownloadURL(storageRef);
                    return downloadUrl;
                })
            );

            // 3. Add hostel data to Firestore 'pendingHostels' collection
            await addDoc(collection(db, 'pendingHostels'), {
                name: hostelName,
                location: gpsLocation,
                nearbyLandmarks,
                price: 0, // Set a default or have a field for it
                rating: 0,
                reviews: 0,
                amenities: selectedAmenities,
                roomFeatures: { beds, bathrooms },
                images: imageUrls,
                description: finalDescription,
                status: 'pending',
                agentId: currentUser.uid,
                dateSubmitted: new Date().toISOString(),
            });

            toast({ title: 'Submission Successful!', description: 'The hostel has been sent for admin approval.' });
            router.push('/'); // Redirect to home or an agent dashboard
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
                                step === 2 ? 'Room Features & Amenities' :
                                step === 3 ? 'Upload Photos & Location' : 'Description & Submission'
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
                                </div>
                            )}
                            {step === 2 && (
                                <div className="space-y-6">
                                    <div>
                                        <Label className="text-base font-semibold">Room Features</Label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="beds">Number of Beds</Label>
                                                <Input id="beds" type="number" placeholder="e.g., 2" value={beds} onChange={(e) => setBeds(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="bathrooms">Bathroom Details</Label>
                                                <Input id="bathrooms" placeholder="e.g., Private" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-base font-semibold">Amenities</Label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
                                            {amenitiesList.map(amenity => (
                                                <div key={amenity} className="flex items-center space-x-2">
                                                    <Checkbox id={amenity} checked={selectedAmenities.includes(amenity)} onCheckedChange={(checked) => handleAmenityChange(amenity, !!checked)} />
                                                    <label htmlFor={amenity} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{amenity}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {step === 3 && (
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
                                </div>
                            )}
                            {step === 4 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Hostel Description</Label>
                                        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the room, its features, and what makes it a great place for students. The AI will automatically enhance this on submission." rows={8} />
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> An AI will enhance this description upon submission to make it more appealing.</p>
                                    </div>
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


    