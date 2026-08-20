import Link from "next/link";
import { Mail, MapPin, PhoneCall } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-200">
      <div className="container mx-auto grid gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-headline text-xl">
              H
            </span>
            HostelHQ
          </Link>
          <p className="text-sm leading-relaxed text-slate-400">
            Built for Ghanaian students to discover trusted hostels, compare prices transparently, and complete digital
            tenancy within minutes.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            <Link href="https://www.linkedin.com" target="_blank" rel="noreferrer" className="transition hover:text-primary">
              LinkedIn
            </Link>
            <Link href="https://www.instagram.com" target="_blank" rel="noreferrer" className="transition hover:text-primary">
              Instagram
            </Link>
            <Link href="https://www.twitter.com" target="_blank" rel="noreferrer" className="transition hover:text-primary">
              Twitter/X
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/80">Explore</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <Link href="/" className="transition hover:text-primary">
                Home
              </Link>
            </li>
            <li>
              <Link href="/about" className="transition hover:text-primary">
                About HostelHQ
              </Link>
            </li>
            <li>
              <Link href="/faq" className="transition hover:text-primary">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/payments" className="transition hover:text-primary">
                Payments
              </Link>
            </li>
            <li>
              <Link href="/contact" className="transition hover:text-primary">
                Contact & Support
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/80">Talk to us</p>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3">
              <PhoneCall className="h-4 w-4 text-primary" />
              <span>233 (0) 597626090 / 233 (0) 536 282 694</span>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-primary" />
              <span>hostelhqghana@gmail.com</span>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="mt-1 h-4 w-4 text-primary" />
              <span>
                Kumasi • AAMUSTED
                <br />
              
              </span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container mx-auto flex flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} HostelHQ. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/terms" className="transition hover:text-primary">
              Terms & Conditions
            </Link>
            <Link href="/privacy" className="transition hover:text-primary">
              Privacy Policy
            </Link>
            <Link href="/contact" className="transition hover:text-primary">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

