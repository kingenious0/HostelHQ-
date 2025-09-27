"use client";

import { useState } from 'react';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Sparkles, MapPin } from 'lucide-react';
import { enhanceHostelDescription } from '@/ai/flows/enhance-hostel-description';
import { useToast } from '@/hooks/use-toast';

const amenitiesList = ['WiFi', 'Kitchen', 'Laundry', 'AC', 'Gym', 'Parking', 'Study Area'];

export default function AgentUploadPage() {
    const [step, setStep] = useState(1);
    const { toast } = useToast();
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [description, setDescription] = useState('');
    const [enhancedDescription, setEnhancedDescription] = useState('');
    
    const totalSteps = 5;
    const progress = (step / totalSteps) * 100;

    const handleEnhance = async () => {
        if (!description) {
            toast({
                title: "Description is empty",
                description: "Please write a description first before enhancing.",
                variant: 'destructive',
            });
            return;
        }
        setIsEnhancing(true);
        try {
            // Mock data for AI flow
            const input = {
                photosDataUris: [], // In a real app, you'd convert uploaded files to data URIs
                gpsLocation: '5.6037, -0.1870',
                nearbyLandmarks: 'University of Ghana, Accra Mall',
                amenities: 'WiFi, Kitchen, AC',
                roomFeatures: '2 beds, 1 private bathroom',
                currentDescription: description,
            };
            const result = await enhanceHostelDescription(input);
            setEnhancedDescription(result.enhancedDescription);
            toast({
                title: "Description Enhanced!",
                description: "The AI has generated a new description for your hostel.",
            });
        } catch (error) {
            console.error(error);
            toast({
                title: "Enhancement Failed",
                description: "There was an error enhancing the description.",
                variant: 'destructive',
            });
        } finally {
            setIsEnhancing(false);
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
                                step === 3 ? 'Upload Photos' :
                                step === 4 ? 'Location' : 'Description'
                            }</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {step === 1 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="hostel-name">Hostel Name</Label>
                                        <Input id="hostel-name" placeholder="e.g., Pioneer Hall" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="landmarks">Nearby Landmarks</Label>
                                        <Input id="landmarks" placeholder="e.g., Accra Mall, University of Ghana" />
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
                                                <Input id="beds" type="number" placeholder="e.g., 2" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="bathrooms">Bathroom Details</Label>
                                                <Input id="bathrooms" placeholder="e.g., Private" />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-base font-semibold">Amenities</Label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
                                            {amenitiesList.map(amenity => (
                                                <div key={amenity} className="flex items-center space-x-2">
                                                    <Checkbox id={amenity} />
                                                    <label htmlFor={amenity} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{amenity}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {step === 3 && (
                                <div className="space-y-4">
                                    <Label>Upload 5 Photos</Label>
                                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-accent/10">
                                        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                                        <p className="mt-2 text-sm text-muted-foreground">Drag & drop photos here, or click to select files</p>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2 mt-2">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="bg-muted aspect-square rounded-md flex items-center justify-center">
                                                <span className="text-xs text-muted-foreground">Photo {i+1}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                             {step === 4 && (
                                <div className="space-y-4">
                                    <Label htmlFor="gps">GPS Location</Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input id="gps" placeholder="e.g., 5.6037, -0.1870" className="pl-10" />
                                    </div>
                                    <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
                                        <p className="text-muted-foreground">Map Preview</p>
                                    </div>
                                </div>
                            )}
                            {step === 5 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Current Description</Label>
                                        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the room, its features, and what makes it a great place for students." rows={6} />
                                    </div>
                                    <Button onClick={handleEnhance} disabled={isEnhancing} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
                                    </Button>
                                    {enhancedDescription && (
                                        <Card className="bg-muted/50">
                                            <CardHeader>
                                                <CardTitle className="text-lg">AI Enhanced Description</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <Textarea value={enhancedDescription} onChange={e => setEnhancedDescription(e.target.value)} rows={6} />
                                                <div className="flex gap-2 mt-4">
                                                    <Button onClick={() => { setDescription(enhancedDescription); setEnhancedDescription(''); }}>Accept</Button>
                                                    <Button variant="outline" onClick={() => setEnhancedDescription('')}>Reject</Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-between mt-8">
                            <Button variant="outline" onClick={prevStep} disabled={step === 1}>Previous</Button>
                            {step < totalSteps ? (
                                <Button onClick={nextStep}>Next</Button>
                            ) : (
                                <Button>Submit for Approval</Button>
                            )}
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}
