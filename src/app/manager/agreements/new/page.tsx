
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { tenancyAgreementText } from '@/lib/legal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getHostels, Hostel } from '@/lib/data';


export default function NewAgreementPage() {
    const [templateName, setTemplateName] = useState('');
    const [hostelId, setHostelId] = useState('');
    const [agreementBody, setAgreementBody] = useState(tenancyAgreementText);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hostels, setHostels] = useState<Hostel[]>([]);
    const [isLoadingHostels, setIsLoadingHostels] = useState(true);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const fetchHostels = async () => {
            setIsLoadingHostels(true);
            const fetchedHostels = await getHostels();
            setHostels(fetchedHostels);
            setIsLoadingHostels(false);
        };
        fetchHostels();
    }, []);

    const handleSubmit = async () => {
        if (!templateName || !hostelId || !agreementBody) {
            toast({ title: 'Missing Fields', description: 'Please fill out all fields.', variant: 'destructive'});
            return;
        }

        setIsSubmitting(true);
        toast({ title: 'Submitting template for review...' });

        // Firestore logic will be added in a future step
        // For now, we simulate the process.
        setTimeout(() => {
            setIsSubmitting(false);
            toast({ title: 'Template Submitted!', description: 'Your template has been sent to the admin for approval.'});
            router.push('/manager/dashboard');
        }, 2000);
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex flex-col items-center py-12 px-4 bg-gray-50/50">
                <Card className="w-full max-w-3xl shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline">Create New Agreement Template</CardTitle>
                        <CardDescription>
                            This template will be reviewed by an admin. Once approved, it can be used for new tenancy agreements for the selected hostel.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="template-name">Template Name</Label>
                                <Input 
                                    id="template-name" 
                                    placeholder="e.g., Standard 2025 Agreement" 
                                    value={templateName} 
                                    onChange={(e) => setTemplateName(e.target.value)} 
                                />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="hostel-select">Select Hostel</Label>
                                 <Select value={hostelId} onValueChange={setHostelId} disabled={isLoadingHostels}>
                                    <SelectTrigger id="hostel-select">
                                        <SelectValue placeholder={isLoadingHostels ? "Loading hostels..." : "Assign to a hostel"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isLoadingHostels ? (
                                            <div className="flex items-center justify-center p-4">
                                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                            </div>
                                        ) : (
                                            hostels.map(hostel => (
                                                <SelectItem key={hostel.id} value={hostel.id}>
                                                    {hostel.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="agreement-body">Agreement Body</Label>
                            <Textarea 
                                id="agreement-body" 
                                value={agreementBody} 
                                onChange={(e) => setAgreementBody(e.target.value)}
                                rows={20}
                                className="font-mono text-xs"
                             />
                             <p className="text-xs text-muted-foreground">
                                Use placeholders like `{'{{studentName}}'}`, `{'{{rentAmount}}'}`, etc. The system will fill these in automatically.
                             </p>
                        </div>

                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Submit for Approval
                        </Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
