"use client";

import { useState } from 'react';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Mail, Clock3, MessageCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

const WHATSAPP_DEEP_LINK = 'https://wa.me/message/UV7CF4JAPA7WO1';

export default function ContactPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [topicTouched, setTopicTouched] = useState(false);
  const [messageTouched, setMessageTouched] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Do not allow submitting when any field is empty
    if (!fullName || !email || !phone || !topic || !message) {
      return;
    }

    setSubmitting(true);

    try {
      // 1. Send email via backend API
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phone, topic, message }),
      });

      if (!res.ok) {
        throw new Error('Failed to send contact message');
      }

      // Clear form on successful email send
      setFullName('');
      setEmail('');
      setPhone('');
      setTopic('');
      setMessage('');

      toast({
        title: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Message sent</span>
          </div>
        ),
        description: 'Thank you for reaching out to HostelHQ Ghana. We will get back to you shortly.',
      });
    } catch (error) {
      console.error('Error sending contact email:', error);

      toast({
        title: 'Could not send message',
        description: 'We could not send your email right now. You can still reach us instantly on WhatsApp.',
        variant: 'destructive',
      });
    }

    // 2. Always open WhatsApp with the same branded content
    const lines = [
      '👋 Hi HostelHQ Ghana team,',
      'I just submitted a message from the HostelHQ contact page.',
      '',
      `Full name: ${fullName || 'N/A'}`,
      `Email: ${email || 'N/A'}`,
      `Phone: ${phone || 'N/A'}`,
      `Topic: ${topic || 'N/A'}`,
      '',
      'Message:',
      message || 'N/A',
      '',
      '— Sent via HostelHQ Ghana contact form',
    ];

    const encoded = encodeURIComponent(lines.join('\n'));
    const url = `${WHATSAPP_DEEP_LINK}?text=${encoded}`;

    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }

    setSubmitting(false);
  };

  const handleWhatsAppChat = () => {
    const quickLines = [
      '👋 Hi HostelHQ Team,',
      'I would like to chat with you on WhatsApp.',
      topic ? `Topic: ${topic}` : '',
    ].filter(Boolean);

    const encoded = quickLines.length ? `?text=${encodeURIComponent(quickLines.join('\n'))}` : '';
    const url = `${WHATSAPP_DEEP_LINK}${encoded}`;

    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  return (
      <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1 bg-muted/20">
              <section className="bg-gradient-to-br from-primary/90 via-primary to-primary/80 py-16 text-white">
                  <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 text-center sm:px-6">
                      <p className="text-sm uppercase tracking-[0.3em] text-white/80">HostelHQ Ghana</p>
                      <h1 className="text-4xl font-bold sm:text-5xl">Let’s build your ideal student stay</h1>
                      <p className="mx-auto max-w-2xl text-white/80">
                          Reach out to our student success team for bookings, hostel management, or platform support.
                          We respond to emails within 24 hours and WhatsApp or calls instantly during working hours.
                      </p>
                  </div>
              </section>

              <section className="relative z-10 mx-auto -mt-14 max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
                  <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                      <Card className="shadow-2xl">
                          <CardHeader>
                              <CardTitle className="text-2xl font-headline">
                                  Send a message to HostelHQ
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                  Fill the form and our support team will be in touch. For urgent questions, tap WhatsApp to speak to us directly.
                              </p>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <form onSubmit={handleSubmit} className="space-y-4">
                              <div className="grid gap-4 sm:grid-cols-2">
                                  <div className="space-y-2">
                                      <label className="text-sm font-medium">Full Name</label>
                                      <Input
                                        placeholder="Akosua Kotodwe"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        onBlur={() => setNameTouched(true)}
                                      />
                                      {nameTouched && !fullName && (
                                        <p className="text-xs text-destructive">Full name is required.</p>
                                      )}
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-sm font-medium">Email Address</label>
                                      <Input
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onBlur={() => setEmailTouched(true)}
                                      />
                                      {emailTouched && !email && (
                                        <p className="text-xs text-destructive">Email address is required.</p>
                                      )}
                                  </div>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                  <div className="space-y-2">
                                      <label className="text-sm font-medium">Phone Number</label>
                                      <Input
                                        placeholder="+233"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        onBlur={() => setPhoneTouched(true)}
                                      />
                                      {phoneTouched && !phone && (
                                        <p className="text-xs text-destructive">Phone number is required.</p>
                                      )}
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-sm font-medium">Topic</label>
                                      <Input
                                        placeholder="Booking, Support, Partnership..."
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        onBlur={() => setTopicTouched(true)}
                                      />
                                      {topicTouched && !topic && (
                                        <p className="text-xs text-destructive">Topic is required.</p>
                                      )}
                                  </div>
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium">How can we help?</label>
                                  <Textarea
                                    rows={6}
                                    placeholder="Tell us about your request..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onBlur={() => setMessageTouched(true)}
                                  />
                                  {messageTouched && !message && (
                                    <p className="text-xs text-destructive">Please tell us how we can help.</p>
                                  )}
                              </div>
                              <div className="flex flex-wrap gap-4 pt-2">
                                  <Button
                                    type="submit"
                                    size="lg"
                                    className="h-12 px-6"
                                    disabled={
                                      submitting ||
                                      !fullName ||
                                      !email ||
                                      !phone ||
                                      !topic ||
                                      !message
                                    }
                                  >
                                      {submitting ? 'Sending...' : 'Submit message'}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="lg"
                                    variant="outline"
                                    className="h-12 px-6"
                                    onClick={handleWhatsAppChat}
                                  >
                                      <MessageCircle className="mr-2 h-5 w-5" />
                                      Chat via WhatsApp
                                  </Button>
                              </div>
                            </form>
                          </CardContent>
                      </Card>

                      <div className="space-y-6">
                          <Card className="bg-primary text-white shadow-xl rounded-3xl border border-white/20">
                              <CardContent className="space-y-6 p-6 sm:p-8">
                                  <div className="space-y-2">
                                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Visit our offices</p>
                                      <h3 className="text-2xl font-headline font-semibold sm:text-3xl">We’re local to campus communities</h3>
                                      <p className="mt-1 text-sm text-white/80">
                                          Drop by or reach out using any of the quick contacts below.
                                      </p>
                                  </div>
                                  <div className="grid gap-4 text-sm text-white/90 sm:grid-cols-2 md:gap-5">
                                      <div className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-4 sm:px-5 sm:py-5">
                                          <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
                                          <div className="space-y-0.5">
                                              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Kumasi</p>
                                              <p className="text-sm font-semibold">AAMUSTED campus</p>
                                              <p className="text-xs text-white/80">HostelHQ suite, Block B</p>
                                          </div>
                                      </div>
                                      <div className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-4 sm:px-5 sm:py-5">
                                          <Phone className="mt-0.5 h-5 w-5 shrink-0" />
                                          <div className="space-y-0.5">
                                              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Call us</p>
                                              <p className="text-sm font-semibold">+233 (0) 506 746 307</p>
                                              <p className="text-sm">+233 (0) 536 282 694</p>
                                          </div>
                                      </div>
                                      <div className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-4 sm:px-5 sm:py-5">
                                          <Mail className="mt-0.5 h-5 w-5 shrink-0" />
                                          <div className="space-y-0.5">
                                              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Email</p>
                                              <p className="text-sm font-semibold break-words">hostelhqghana@gmail.com</p>
                                              <p className="text-xs text-white/80">24 hr response window</p>
                                          </div>
                                      </div>
                                      <div className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-4 sm:px-5 sm:py-5">
                                          <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
                                          <div className="space-y-0.5">
                                              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Office hours</p>
                                              <p className="text-sm font-semibold">Mon–Fri · 8:00am – 7:00pm</p>
                                              <p className="text-sm">Sat · 10:00am – 7:00pm</p>
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


