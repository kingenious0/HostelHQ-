import React from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, FileText } from "lucide-react";

export const metadata = {
  title: "Terms of Service | HostelHQ",
  description: "HostelHQ University Housing Terms of Service and Tenancy Guidelines",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <div className="space-y-6">
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-xs font-semibold text-primary">
              <FileText className="h-3.5 w-3.5" />
              University Housing Standards
            </div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Terms of Service</h1>
            <p className="text-sm text-muted-foreground">
              Last revised: August 2026 • Effective across all university-accredited accommodations.
            </p>
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">1. Agreement to Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                By accessing or using the HostelHQ platform, you agree to be bound by these Terms of Service and all applicable university housing policies, statutory tenancy regulations, and student code of conduct rules.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">2. Direct Booking & Zero Middleman Guarantee</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                HostelHQ connects university students directly with accredited hostel managers and university-verified residences. No agent viewing fees, unauthorized middleman markups, or informal reservation fees are permitted on this platform.
              </p>
              <p>
                All room tariffs listed are audited and bound by university housing board guidelines. Any illegal surcharge should be reported immediately to the Dean of Students Directorate.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">3. Dispute Arbitration & Resident Protection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                In the event of unresolved grievances concerning facility maintenance, water shortages, or conduct disputes between residents and management, cases are referred to the statutory Dean of Students arbitration console for formal resolution.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
