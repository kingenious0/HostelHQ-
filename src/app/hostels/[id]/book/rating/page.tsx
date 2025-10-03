// src/app/hostels/[id]/book/rating/page.tsx
"use client";

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RatingPage() {
    const router = useRouter();
    const params = useParams();
    const { id: hostelId } = params;
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        setIsSubmitting(true);
        toast({ title: "Submitting your review..." });
        
        // Simulate an API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        // In a real app, you'd save the rating and comment to your database
        console.log({
            hostelId,
            rating,
            comment
        });

        toast({
            title: "Review Submitted!",
            description: "Thank you for your feedback.",
        });

        router.push('/');
        setIsSubmitting(false);
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                <Card className="w-full max-w-lg shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline">Rate Your Visit</CardTitle>
                        <CardDescription>Your feedback helps us improve.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2 text-center">
                            <label className="text-sm font-medium">How was your agent?</label>
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
                                placeholder="Tell us about your experience..."
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