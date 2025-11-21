"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/header";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import Link from "next/link";

const faqs = [
  {
    question: "How do I secure a hostel through HostelHQ?",
    answer:
      "Browse verified listings, book a viewing with mobile money, and complete the secure tenancy workflow. Once your booking is confirmed you receive a digital agreement instantly.",
    category: "booking",
  },
  {
    question: "Do I need an account to browse hostels?",
    answer:
      "No. Anyone can search and view hostel information. You only need to create a student account when you want to book a visit or secure a room.",
    category: "account",
  },
  {
    question: "What payment methods do you support?",
    answer:
      "We support MTN, Telecel (Vodafone), AirtelTigo mobile money as well as Visa and Mastercard. All transactions are processed securely via Paystack.",
    category: "payment",
  },
  {
    question: "Can I cancel or reschedule a booked visit?",
    answer:
      "Yes. Simply open your visit tracking link and choose reschedule or cancel at least 12 hours before the visit time so that our agent can adjust their schedule.",
    category: "booking",
  },
  {
    question: "How are hostels verified?",
    answer:
      "Our team visits each property, captures photos, validates amenities, and checks management responsiveness before listing. We regularly re-verify to keep information current.",
    category: "hostels",
  },
  {
    question: "How do I update my profile information?",
    answer:
      "Click on your profile photo in the header, select 'Profile', and update any information you'd like to change. Don't forget to save your changes.",
    category: "account",
  },
  {
    question: "What happens if I don't like the hostel after booking?",
    answer:
      "You can cancel your booking within 24 hours of confirmation for a full refund. After that, cancellation policies vary by hostel. Check the specific hostel's cancellation policy before booking.",
    category: "booking",
  },
  {
    question: "Is my payment information secure?",
    answer:
      "Yes, all payments are processed securely through Paystack, which is PCI DSS compliant. We never store your full payment card details on our servers.",
    category: "payment",
  },
  {
    question: "How do I contact a hostel agent?",
    answer:
      "Once you book a viewing, you'll receive contact information for the assigned agent. You can also message them through the booking dashboard.",
    category: "booking",
  },
  {
    question: "Can I book multiple hostels at once?",
    answer:
      "Yes, you can book viewings for multiple hostels. However, you can only secure (pay for) one hostel at a time. Once you secure a hostel, other pending bookings will be cancelled.",
    category: "booking",
  },
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFAQs = useMemo(() => {
    if (!searchQuery.trim()) {
      return faqs;
    }

    const query = searchQuery.toLowerCase();
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 bg-muted/20">
        <section className="bg-gradient-to-br from-primary via-primary/80 to-primary/70 py-16 text-white">
          <div className="container mx-auto flex flex-col gap-4 px-4 text-center sm:px-6">
            <p className="text-sm uppercase tracking-[0.3em] text-white/80">Support Centre</p>
            <h1 className="text-3xl font-headline font-bold sm:text-4xl">Frequently Asked Questions</h1>
            <p className="mx-auto max-w-2xl text-white/80">
              Answers to common questions about booking, payments, and life on HostelHQ. We keep this page updated as
              new features launch.
            </p>
          </div>
        </section>

        <section className="container mx-auto -mt-12 grid gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-headline">Getting started with HostelHQ</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Everyone can read these answers—no login required.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for help..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={handleClearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Search Results Count */}
              {searchQuery && (
                <p className="text-sm text-muted-foreground">
                  {filteredFAQs.length} {filteredFAQs.length === 1 ? "result" : "results"} found
                </p>
              )}

              {/* FAQ Accordion */}
              {filteredFAQs.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {filteredFAQs.map((faq, index) => (
                    <AccordionItem key={faq.question} value={`faq-${index}`}>
                      <AccordionTrigger className="text-left text-base font-medium">{faq.question}</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Try different keywords or{" "}
                    <Button variant="link" className="p-0 h-auto" onClick={handleClearSearch}>
                      clear your search
                    </Button>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="bg-primary text-primary-foreground">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-headline">Need a human?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm pt-0">
                <p className="text-xs">Our student success team is online every day from 8:30 am to 6:00 pm.</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/70">Call us</p>
                    <p className="font-semibold text-white text-sm">+233 (0) 20 123 4567</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/70">Email</p>
                    <p className="font-semibold text-white text-sm">support@hostelhq.africa</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/70">WhatsApp</p>
                    <p className="font-semibold text-white text-sm">+233 (0) 59 876 5432</p>
                  </div>
                </div>
                <Button variant="secondary" className="w-full text-primary text-sm py-2">
                  Chat with support
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-headline">Still can't find what you need?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground pt-0">
                <p className="text-xs">
                  Let us know how we can improve this help centre.
                </p>
                <Button asChild className="w-full text-sm py-2" variant="outline">
                  <Link href="/contact">Send feedback</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

