"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { HostelListingWizard } from "@/components/hostel-listing-wizard";
import { ArrowLeft, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ManagerNewHostelPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto mb-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground text-xs gap-1.5 h-8 px-2"
          >
            <Link href="/manager/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to Manager Dashboard
            </Link>
          </Button>
        </div>

        <HostelListingWizard mode="manager" />
      </main>
    </div>
  );
}
