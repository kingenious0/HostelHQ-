import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'HostelHQ',
  description: 'Find your perfect student hostel.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('hostelhq:settings');
      if (raw) {
        const { profile } = JSON.parse(raw);
        const theme = profile?.theme;
        document.documentElement.classList.toggle('dark', theme === 'dark');
      }
    } catch {}
  }
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
