import Link from 'next/link';
import { Hotel } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="bg-card shadow-sm sticky top-0 z-40">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Hotel className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-foreground">HostelHQ</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Hostels
          </Link>
          <Link href="/agent/upload" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            For Agents
          </Link>
          <Link href="/admin/dashboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Admin
          </Link>
        </nav>
        <Button>Login / Sign Up</Button>
      </div>
    </header>
  );
}
