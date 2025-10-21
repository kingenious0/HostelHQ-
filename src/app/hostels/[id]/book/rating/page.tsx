
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
import { db, auth } from '@/lib/firebase';
import { doc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export default function RatingPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { id: hostelId } = params;
    const visitId = searchParams.get('visitId');

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    const handleSubmit = async () => {
        if (rating === 0) {
            toast({ title: "Please select a rating", variant: "destructive" });
            return;
        }

        if (!currentUser) {
            toast({ title: "You must be logged in to submit a review.", variant: "destructive" });
            return;
        }
        
        if (!hostelId || typeof hostelId !== 'string') {
            toast({ title: "Invalid hostel specified.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        toast({ title: "Submitting your review..." });
        
        try {
            // Save the review to a 'reviews' subcollection for moderation
            const reviewsRef = collection(db, 'reviews');
            await addDoc(reviewsRef, {
                hostelId: hostelId,
                studentId: currentUser.uid,
                studentName: currentUser.displayName || 'Anonymous Student', // Fallback
                rating: rating,
                comment: comment,
                createdAt: serverTimestamp(),
                status: 'pending', // for moderation
                visitId: visitId || null,
            });

            toast({
                title: "Review Submitted!",
                description: "Thank you for your feedback. Your review is pending approval.",
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
                        <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting || rating === 0 || !currentUser}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Review
                        </Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
