"use client";

import { Header } from '@/components/header';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, HeartHandshake, MapPin, Users, Building2 } from 'lucide-react';

const milestones = [
  {
      year: '2021',
      title: 'Idea & Research',
      description: 'We interviewed hundreds of students and hostel managers to understand the booking pain points.',
  },
  {
      year: '2022',
      title: 'Product Launch',
      description: 'HostelHQ launched in Kumasi with 12 verified hostels and real-time availability updates.',
  },
  {
      year: '2023',
      title: 'Secure Booking',
      description: 'Added digital tenancy agreements, mobile money payments, and roommate matching.',
  },
  {
      year: '2024',
      title: 'Expansion',
      description: 'Serving 5 institutions, 70+ hostels, and thousands of students every academic year.',
  },
];

const team = [
  { name: 'Elliot Paakow Entsiwah', role: 'Co-Founder & Lead Engineer'   , image: '/elliot.jpg' },
  { name: 'David Amankwah', role: 'Co-Founder & Head of Operations', image: '/david.jpg' },
  //{ name: 'Yaw Frimpong', role: 'Lead Engineer', image: '/yaw.jpg' },
];

export default function AboutPage() {
  return (
      <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1">
              <section className="relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/80 text-white">
                  <div className="absolute inset-0">
                      <Image
                          src="https://images.pexels.com/photos/4907200/pexels-photo-4907200.jpeg"
                          alt="Students moving into a hostel"
                          fill
                          className="object-cover opacity-20"
                          priority
                      />
                  </div>
                  <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 lg:px-8">
                      <Badge variant="secondary" className="w-fit bg-white/20 text-white backdrop-blur">
                          Ghana&apos;s trusted student housing platform
                      </Badge>
                      <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                          We connect students with safe, verified hostels — hassle free.
                      </h1>
                      <p className="max-w-2xl text-lg text-white/80">
                          HostelHQ was brought to life by with a team of students who experienced how stressful securing accommodation
                          can be. Today we are on a mission to make campus living transparent, affordable, and delightful.
                      </p>
                      <div className="flex flex-wrap gap-4">
                          <Button size="lg" className="h-12 rounded-full">
                              Explore Hostels
                          </Button>
                          <Button variant="outline" size="lg" className="h-12 rounded-full bg-white text-primary hover:bg-white/90">
                              Become a Partner Hostel
                          </Button>
                      </div>
                  </div>
              </section>

              <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                      <Card className="border-none bg-primary/5">
                          <CardContent className="space-y-3 pt-6">
                              <MapPin className="h-10 w-10 text-primary" />
                              <p className="text-3xl font-bold">5+ Cities</p>
                              <p className="text-sm text-muted-foreground">We map verified hostels across major tertiary hubs in Ghana.</p>
                          </CardContent>
                      </Card>
                      <Card className="border-none bg-primary/5">
                          <CardContent className="space-y-3 pt-6">
                              <Users className="h-10 w-10 text-primary" />
                              <p className="text-3xl font-bold">20K Students</p>
                              <p className="text-sm text-muted-foreground">Students rely on HostelHQ every semester to find housing.</p>
                          </CardContent>
                      </Card>
                      <Card className="border-none bg-primary/5">
                          <CardContent className="space-y-3 pt-6">
                              <Building2 className="h-10 w-10 text-primary" />
                              <p className="text-3xl font-bold">70+ Hostels</p>
                              <p className="text-sm text-muted-foreground">Every listing is vetted, photographed, and regularly updated.</p>
                          </CardContent>
                      </Card>
                      <Card className="border-none bg-primary/5">
                          <CardContent className="space-y-3 pt-6">
                              <HeartHandshake className="h-10 w-10 text-primary" />
                              <p className="text-3xl font-bold">24/7 Support</p>
                              <p className="text-sm text-muted-foreground">Our team guides students from search to moving in.</p>
                          </CardContent>
                      </Card>
                  </div>
              </section>

              <section className="bg-muted/40 py-16">
                  <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                      <div className="mb-10 md:flex md:items-center md:justify-between">
                          <div>
                              <h2 className="text-3xl font-headline font-bold">How far we&apos;ve come</h2>
                              <p className="mt-2 max-w-2xl text-muted-foreground">
                                  We iterate quickly with our community. Here are the milestones that shaped HostelHQ.
                              </p>
                          </div>
                      </div>
                      <div className="relative border-l border-primary/30 pl-8">
                          {milestones.map((milestone, index) => (
                              <div key={milestone.year} className="relative mb-10 last:mb-0">
                                  <span className="absolute -left-[11px] flex h-6 w-6 items-center justify-center rounded-full border border-primary bg-background text-xs font-semibold text-primary">
                                      {index + 1}
                                  </span>
                                  <p className="text-sm font-semibold uppercase tracking-wider text-primary/80">{milestone.year}</p>
                                  <h3 className="text-xl font-semibold">{milestone.title}</h3>
                                  <p className="mt-2 text-muted-foreground">{milestone.description}</p>
                              </div>
                          ))}
                      </div>
                  </div>
              </section>

              <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
                  <div className="mb-8 text-center sm:text-left">
                      <h2 className="text-3xl font-headline font-bold">Meet the team</h2>
                      <p className="mt-2 text-muted-foreground">
                          We&apos;re a small but passionate group of technologists, designers, and community champions.
                      </p>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {team.map((member) => (
                          <Card key={member.name} className="border-none bg-muted/30">
                              <CardHeader>
                                  <CardTitle className="text-xl">{member.name}</CardTitle>
                                  <p className="text-sm font-medium text-primary/80">{member.role}</p>
                              </CardHeader>
                              <CardContent>
                                  <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>
                              </CardContent>
                          </Card>
                      ))}
                  </div>
              </section>

              <section className="bg-primary/90 py-16 text-white">
                  <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 text-center">
                      <CheckCircle2 className="h-12 w-12" />
                      <h2 className="text-3xl font-headline font-semibold sm:text-4xl">
                          Ready to transform your student housing experience?
                      </h2>
                      <p className="max-w-2xl text-lg text-white/80">
                          Join thousands of students who secure reliable accommodation with HostelHQ.
                          Let&apos;s make your next academic year stress-free.
                      </p>
                      <div className="flex flex-wrap justify-center gap-4">
                          <Button size="lg" variant="secondary" className="h-12 rounded-full">
                              Browse Available Hostels
                          </Button>
                          <Button size="lg" className="h-12 rounded-full bg-white text-primary hover:bg-white/90">
                              Talk to Our Team
                          </Button>
                      </div>
                  </div>
              </section>
          </main>
      </div>
  );
}


