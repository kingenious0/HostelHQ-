import React from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | HostelHQ",
  description: "HostelHQ University Housing Privacy Policy and Student Data Governance",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <div className="space-y-6">
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Institutional Data Privacy
            </div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">
              Last revised: August 2026 • Compliant with Ghanaian Data Protection Act (Act 843) and institutional regulations.
            </p>
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">1. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                HostelHQ collects relevant academic identification credentials (such as student ID numbers and admission letters) solely to authenticate eligibility for university-approved off-campus accommodations.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">2. Institutional Data Governance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                Student records, medical notes, and dispute transcripts remain strictly sequestered under the statutory authority of the Dean of Students. Executive administration consoles (such as the Vice-Chancellor dashboard) receive only anonymized, aggregate metrics.
              </p>
              <p>
                We do not sell, rent, or monetize student personal information to commercial third parties.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
