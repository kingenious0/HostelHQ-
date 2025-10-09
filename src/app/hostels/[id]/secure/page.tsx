"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { getHostel, Hostel } from "@/lib/data"
import { notFound } from 'next/navigation';
import { initializeHostelPayment } from "@/app/actions/paystack"

const formSchema = z.object({
  studentName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  indexNumber: z.string().min(5, { message: "Index number is required." }),
  ghanaCardNumber: z.string().regex(/^[A-Z0-9]{10,15}$/, { message: "Invalid Ghana Card number." }),
  departmentName: z.string().min(3, { message: "Department is required." }),
  level: z.enum(["100", "200", "300", "400"]),
  phoneNumber: z.string().regex(/^\+?[0-9]{10,13}$/, { message: "Invalid phone number." }),
  email: z.string().email({ message: "Invalid email address." }),
})


export default function SecureHostelPage() {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const { id: hostelId } = params;
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [hostel, setHostel] = React.useState<Hostel | null>(null);

     React.useEffect(() => {
        const fetchHostelData = async () => {
            if(typeof hostelId !== 'string') return;
            const hostelData = await getHostel(hostelId);
            if (!hostelData) {
                notFound();
            }
            setHostel(hostelData);
        };
        fetchHostelData();
    }, [hostelId]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            studentName: "",
            indexNumber: "",
            ghanaCardNumber: "",
            departmentName: "",
            phoneNumber: "",
            email: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!hostel || typeof hostelId !== 'string') return;
        
        setIsSubmitting(true);
        toast({ title: "Initializing Payment..." });

        try {
            const result = await initializeHostelPayment({
                email: values.email,
                amount: hostel.price * 100, // Amount in pesewas
                hostelName: hostel.name,
                studentName: values.studentName,
                hostelId: hostelId,
            });

            if (result.status && result.authorization_url) {
                toast({ title: "Redirecting to Payment", description: "You will be redirected to a secure payment page."});
                // Redirect user to the returned authorization URL
                router.push(result.authorization_url);
            } else {
                throw new Error(result.message || "Failed to initialize payment.");
            }

        } catch (error: any) {
             toast({ title: "Payment Error", description: error.message || "Could not connect to payment service.", variant: "destructive" });
             setIsSubmitting(false);
        }
    }

  return (
    <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
            <Card className="w-full max-w-lg shadow-xl">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline">Secure Your Hostel Room</CardTitle>
                    <CardDescription>
                        Complete this form to proceed to the final payment for {hostel?.name}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="studentName"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="indexNumber"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Index Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Your university index number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="ghanaCardNumber"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Ghana Card Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="GHA-XXXXXXXXX-X" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="departmentName"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Department</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Computer Science" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="level"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Level</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select your current level" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="100">Level 100</SelectItem>
                                                <SelectItem value="200">Level 200</SelectItem>
                                                <SelectItem value="300">Level 300</SelectItem>
                                                <SelectItem value="400">Level 400</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                             <FormField
                                control={form.control}
                                name="phoneNumber"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Payment Phone Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="+233 XX XXX XXXX" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        This can be any number for the transaction.
                                    </FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Email Address</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="you@example.com" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Your payment receipt will be sent here.
                                    </FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <CardFooter className="px-0 pt-6">
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Proceed to Pay GH₵{hostel?.price.toLocaleString() || 0}
                                </Button>
                            </CardFooter>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </main>
    </div>
  )
}
