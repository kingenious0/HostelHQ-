
// src/app/hostels/[id]/book/rating/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

export default function RatingPage() {
    const router = useRouter();
    const params = useParams();
    const { id: hostelId } = params;
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (rating === 0) {
            toast({ title: "Please select a rating", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        toast({ title: "Submitting your review..." });
        
        try {
            // In a real app, you'd save the rating and comment to your database
            const hostelRef = doc(db, 'hostels', hostelId as string);
            
            // This is a simplified update. A real app might average ratings.
            await updateDoc(hostelRef, {
                reviews: increment(1),
                // This is a naive way to update rating. A better way would involve cloud functions to calculate average.
                // rating: newAverageRating 
            });

             // You could also store the specific review in a subcollection, e.g.,
             // addDoc(collection(db, `hostels/${hostelId}/reviews`), { rating, comment, user: ... });

            toast({
                title: "Review Submitted!",
                description: "Thank you for your feedback.",
            });

            router.push(`/hostels/${hostelId}`);

        } catch (error) {
             console.error("Failed to submit review", error);
             toast({ title: "Submission Failed", description: "Could not save your review.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                <Card className="w-full max-w-lg shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline">Rate Your Visit Experience</CardTitle>
                        <CardDescription>How was the agent and the hostel tour? Your feedback helps other students.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2 text-center">
                            <label className="text-sm font-medium">Your Overall Rating</label>
                            <div className="flex justify-center items-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                        key={star}
                                        className={`h-10 w-10 cursor-pointer transition-colors ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/50'}`}
                                        onClick={() => setRating(star)}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                             <label htmlFor="comment" className="text-sm font-medium">Any additional comments?</label>
                            <Textarea
                                id="comment"
                                placeholder="Tell us about your experience with the agent and the hostel..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Review
                        </Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
