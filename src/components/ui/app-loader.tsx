"use client";

import React from "react";
import Image from "next/image";
import { Loader2, ShieldCheck } from "lucide-react";

interface AppLoaderProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export function AppLoader({
  message = "Loading HostelHQ...",
  subMessage = "Securing verified campus accommodations",
  fullScreen = true,
}: AppLoaderProps) {
  return (
    <div
      className={
        fullScreen
          ? "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl px-4 select-none"
          : "w-full min-h-[300px] flex flex-col items-center justify-center p-8 select-none"
      }
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 flex items-center justify-center">
        <div className="w-72 h-72 rounded-full bg-primary/15 blur-3xl animate-pulse" />
        <div className="w-56 h-56 rounded-full bg-amber-500/10 blur-2xl -translate-y-6" />
      </div>

      <div className="flex flex-col items-center max-w-sm text-center">
        {/* Animated Brand Emblem Container */}
        <div className="relative mb-6">
          {/* Glowing Ring */}
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-primary/40 via-amber-500/30 to-primary/20 blur-md animate-pulse" />
          
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-card border border-border/80 shadow-2xl p-3">
            <div className="relative w-full h-full">
              <Image
                src="/HostelHQ Web App Logo.png"
                alt="HostelHQ"
                fill
                sizes="80px"
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Micro Status Badge */}
          <div className="absolute -bottom-1.5 -right-1.5 bg-primary text-primary-foreground p-1 rounded-full shadow-lg ring-2 ring-background">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Progress Spinner & Dynamic Bar */}
        <div className="w-44 h-1.5 bg-muted/60 rounded-full overflow-hidden mb-4 relative shadow-inner">
          <div className="h-full bg-gradient-to-r from-primary via-amber-500 to-primary w-2/3 rounded-full animate-progress" />
        </div>

        {/* Text Details */}
        <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
          <span>{message}</span>
        </h2>
        {subMessage && (
          <p className="text-xs text-muted-foreground mt-1 font-medium tracking-wide">
            {subMessage}
          </p>
        )}
      </div>
    </div>
  );
}
