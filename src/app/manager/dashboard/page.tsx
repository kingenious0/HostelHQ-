
"use client";

import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, onSnapshot } from 'firebase/firestore';


type AgreementTemplate = {
    id: string;
    templateName: string;
    status: 'Approved' | 'Pending' | 'Rejected';
};

export default function ManagerDashboard() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [myTemplates, setMyTemplates] = useState<AgreementTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
            if (!user) {
                setLoadingTemplates(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        setLoadingTemplates(true);
        const templatesQuery = query(
            collection(db, "agreementTemplates"), 
            where("managerId", "==", currentUser.uid)
        );

        const unsubscribeTemplates = onSnapshot(templatesQuery, (snapshot) => {
            const templatesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgreementTemplate));
            setMyTemplates(templatesData);
            setLoadingTemplates(false);
        });

        return () => unsubscribeTemplates();
    }, [currentUser]);


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
    
    // A simple check. A more robust solution would check the user's role from your database.
    if (!currentUser || !currentUser.email?.endsWith('@manager.hostelhq.com')) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                     <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in as a Hostel Manager to view this page.
                        </AlertDescription>
                    </Alert>
                </main>
            </div>
        )
    }

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'Approved': return 'default';
            case 'Pending': return 'secondary';
            case 'Rejected': return 'destructive';
            default: return 'outline';
        }
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
                <div className="container mx-auto grid gap-8 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline">My Hostels</CardTitle>
                            <CardDescription>A list of hostels you manage.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Hostel management feature coming soon.</p>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl font-headline">Tenancy Agreements</CardTitle>
                                <CardDescription>Manage your agreement templates.</CardDescription>
                            </div>
                            <Button onClick={() => router.push('/manager/agreements/new')}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                New Template
                            </Button>
                        </CardHeader>
                        <CardContent>
                           {loadingTemplates ? (
                                <div className="flex items-center justify-center p-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                           ) : (
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Template Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {myTemplates.length > 0 ? (
                                        myTemplates.map((template) => (
                                            <TableRow key={template.id}>
                                                <TableCell className="font-medium">{template.templateName}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getStatusVariant(template.status)}>{template.status}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm">View</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24">
                                                You have not created any templates yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                           )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}

    