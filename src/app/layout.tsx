import type { Metadata, Viewport } from 'next';
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { RootLayoutShell } from "@/components/root-layout-shell";

export const metadata: Metadata = {
  title: 'HostelHQ',
  description: 'Find your perfect student hostel.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
        {/* PWA: manifest & basic meta tags for installability */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/hostelhq-icon-new.png" />
        {/* OneSignal Web Push SDK */}
        <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.OneSignalDeferred = window.OneSignalDeferred || [];
              OneSignalDeferred.push(async function(OneSignal) {
                // Initialize only if not localhost to avoid 404s and domain errors
                if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    await OneSignal.init({
                      appId: "${process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''}",
                      allowLocalhostAsSecureOrigin: true,
                    });
                }
              });
            `,
          }}
        />
      </head>
      <body className="font-body antialiased min-h-full bg-background" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('hostelhq-theme');
      const mode = stored || 'system';
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldUseDark = mode === 'dark' || (mode === 'system' && prefersDark);
      const doc = document.documentElement;
      doc.classList.remove('light', 'dark');
      doc.classList.add(shouldUseDark ? 'dark' : 'light');
    }
  } catch (_) {
    // fail silently; Header will handle theme on client
  }
})();`,
          }}
        />
        <RootLayoutShell>
          {children}
        </RootLayoutShell>
        <Toaster />
      </body>
    </html>
  );
}
