"use client";

import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Mail, Clock3, MessageCircle } from 'lucide-react';

const faqs = [
  {
      question: 'Can HostelHQ guarantee my booking?',
      answer:
          'Once you secure a hostel through our platform and complete payment, your tenancy agreement is generated immediately and the space is guaranteed.',
  },
  {
      question: 'Do you charge students any hidden fees?',
      answer:
          'No. Students only pay the standard booking fee and rent. We keep the process transparent and show a full breakdown before you pay.',
  },
  {
      question: 'How long does verification take for new hostels?',
      answer:
          'Within 5 working days. We capture photos, verify amenities, and ensure management meets our standards before listing.',
  },
];

export default function ContactPage() {
  return (
      <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1 bg-muted/20">
              <section className="bg-gradient-to-br from-primary/90 via-primary to-primary/80 py-16 text-white">
                  <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 text-center sm:px-6">
                      <p className="text-sm uppercase tracking-[0.3em] text-white/80">We are here to help</p>
                      <h1 className="text-4xl font-bold sm:text-5xl">Let’s build your ideal student stay</h1>
                      <p className="mx-auto max-w-2xl text-white/80">
                          Reach out to our student success team for bookings, partnership requests, or platform support.
                          We respond to emails within 24 hours and calls instantly during working hours.
                      </p>
                  </div>
              </section>

              <section className="relative z-10 mx-auto -mt-14 max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
                  <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                      <Card className="shadow-2xl">
                          <CardHeader>
                              <CardTitle className="text-2xl font-headline">
                                  Send us a message
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                  Fill the form and our support team will be in touch. You can also message us on WhatsApp for urgent questions.
                              </p>
                          </CardHeader>
                          <CardContent className="space-y-4">
                              <div className="grid gap-4 sm:grid-cols-2">
                                  <div className="space-y-2">
                                      <label className="text-sm font-medium">Full Name</label>
                                      <Input placeholder="Akosua Nyarko" />
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-sm font-medium">Email Address</label>
                                      <Input type="email" placeholder="you@example.com" />
                                  </div>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                  <div className="space-y-2">
                                      <label className="text-sm font-medium">Phone Number</label>
                                      <Input placeholder="+233" />
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-sm font-medium">Topic</label>
                                      <Input placeholder="Booking, Support, Partnership..." />
                                  </div>
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium">How can we help?</label>
                                  <Textarea rows={6} placeholder="Tell us about your request..." />
                              </div>
                              <div className="flex flex-wrap gap-4 pt-2">
                                  <Button size="lg" className="h-12 px-6">
                                      Submit message
                                  </Button>
                                  <Button size="lg" variant="outline" className="h-12 px-6">
                                      <MessageCircle className="mr-2 h-5 w-5" />
                                      Chat via WhatsApp
                                  </Button>
                              </div>
                          </CardContent>
                      </Card>

                      <div className="space-y-6">
                          <Card className="bg-primary text-white shadow-xl">
                              <CardContent className="space-y-5 p-6 sm:p-8">
                                  <div>
                                      <p className="text-xs uppercase tracking-[0.3em] text-white/70">Visit our offices</p>
                                      <h3 className="text-xl font-semibold sm:text-2xl">We’re local to campus communities</h3>
                                      <p className="mt-2 text-sm text-white/80">
                                          Drop by or reach out using any of the quick contacts below.
                                      </p>
                                  </div>
                                  <div className="grid gap-4 text-sm text-white/90 sm:grid-cols-2">
                                      <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                                          <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
                                          <div>
                                              <p className="text-xs uppercase tracking-wide text-white/70">Kumasi</p>
                                              <p className="font-semibold text-white">AAMUSTED campus</p>
                                              <p>HostelHQ suite, Block B</p>
                                          </div>
                                      </div>
                                      <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                                          <Phone className="mt-0.5 h-5 w-5 shrink-0" />
                                          <div>
                                              <p className="text-xs uppercase tracking-wide text-white/70">Call us</p>
                                              <p className="font-semibold text-white">+233 (0) 506 746 307</p>
                                              <p>+233 (0) 536 282 694</p>
                                          </div>
                                      </div>
                                      <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                                          <Mail className="mt-0.5 h-5 w-5 shrink-0" />
                                          <div>
                                              <p className="text-xs uppercase tracking-wide text-white/70">Email</p>
                                              <p className="font-semibold text-white">hostelhq.africa@gmail.com</p>
                                              <p>24 hr response window</p>
                                          </div>
                                      </div>
                                      <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                                          <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
                                          <div>
                                              <p className="text-xs uppercase tracking-wide text-white/70">Office hours</p>
                                              <p className="font-semibold text-white">Mon–Fri · 8:00am – 7:00pm</p>
                                              <p>Sat · 10:00am – 7:00pm</p>
                                          </div>
                                      </div>
                                  </div>
                              </CardContent>
                          </Card>

                          <Card className="bg-muted/40 shadow-sm">
                              <CardHeader className="pb-4">
                                  <CardTitle className="text-base font-headline sm:text-lg">Frequently asked questions</CardTitle>
                                  <p className="text-sm text-muted-foreground">
                                      Answers to the most common questions from students and landlords.
                                  </p>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                  {faqs.map((faq) => (
                                      <div key={faq.question} className="rounded-2xl border border-muted/40 p-4">
                                          <p className="font-semibold text-foreground">{faq.question}</p>
                                          <p className="text-sm text-muted-foreground">{faq.answer}</p>
                                      </div>
                                  ))}
                              </CardContent>
                          </Card>
                      </div>
                  </div>
              </section>
          </main>
      </div>
  );
}


