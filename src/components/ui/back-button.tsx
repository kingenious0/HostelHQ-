"use client";

import { useRouter } from 'next/navigation';
import { Button } from './button';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  fallbackHref?: string; // Optional: A specific path to go back to if router.back() isn't suitable
}

export function BackButton({ fallbackHref }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else if (fallbackHref) {
      router.push(fallbackHref);
    } else {
      router.push('/'); // Fallback to homepage if no history or fallbackHref
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleBack}>
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back
    </Button>
  );
}
