import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, PhoneCall } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#130307] text-gray-400 border-t border-[#6B1D2F]/20">
      <div className="container mx-auto grid gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_1fr_1fr]">
        <div className="space-y-4">
          {/* Institutional Brand Unit */}
          <Link href="/" className="inline-flex items-center group">
            <div className="relative h-9 w-9 shrink-0">
              <Image
                src="/usted logo.png"
                alt="USTED Crest"
                fill
                sizes="36px"
                className="object-contain"
              />
            </div>
            <span className="h-6 border-r border-gray-700 mx-2.5 inline-block" />
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#D4AF37] transition-colors">
              HostelHQ
            </span>
          </Link>

          {/* Official University Disclaimer */}
          <p className="text-xs leading-relaxed text-gray-300 max-w-md">
            An authorized accommodation governance system for the University of Skills Training and Entrepreneurial Development (USTED), Kumasi.
          </p>

          <p className="text-xs leading-relaxed text-gray-500">
            Empowering students with verified campus accommodations, transparent rates, and instant authenticated booking governance.
          </p>

          <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-400 pt-1">
            <Link href="https://www.linkedin.com" target="_blank" rel="noreferrer" className="transition hover:text-[#D4AF37]">
              LinkedIn
            </Link>
            <Link href="https://www.instagram.com" target="_blank" rel="noreferrer" className="transition hover:text-[#D4AF37]">
              Instagram
            </Link>
            <Link href="https://www.twitter.com" target="_blank" rel="noreferrer" className="transition hover:text-[#D4AF37]">
              Twitter / X
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#D4AF37]">Explore</p>
          <ul className="space-y-2.5 text-sm text-gray-300">
            <li>
              <Link href="/" className="transition hover:text-[#D4AF37]">
                Approved Hostels
              </Link>
            </li>
            <li>
              <Link href="/about" className="transition hover:text-[#D4AF37]">
                About HostelHQ
              </Link>
            </li>
            <li>
              <Link href="/faq" className="transition hover:text-[#D4AF37]">
                Student FAQ
              </Link>
            </li>
            <li>
              <Link href="/payments" className="transition hover:text-[#D4AF37]">
                Secure Payments & Escrow
              </Link>
            </li>
            <li>
              <Link href="/contact" className="transition hover:text-[#D4AF37]">
                Contact & Support
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#D4AF37]">University Directorate</p>
          <ul className="space-y-3 text-sm text-gray-300">
            <li className="flex items-center gap-3">
              <PhoneCall className="h-4 w-4 text-[#D4AF37] shrink-0" />
              <span className="text-xs">+233 (0) 597 626 090 / +233 (0) 536 282 694</span>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-[#D4AF37] shrink-0" />
              <span className="text-xs">hostelhqghana@gmail.com</span>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-[#D4AF37] shrink-0" />
              <span className="text-xs leading-relaxed">
                USTED Main Campus, Tanoso
                <br />
                Kumasi, Ashanti Region, Ghana
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#6B1D2F]/20 bg-black/40">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-6 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} USTED HostelHQ Governance Portal. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/terms" className="transition hover:text-[#D4AF37]">
              Terms & Conditions
            </Link>
            <Link href="/privacy" className="transition hover:text-[#D4AF37]">
              Privacy Policy
            </Link>
            <Link href="/contact" className="transition hover:text-[#D4AF37]">
              Institutional Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
