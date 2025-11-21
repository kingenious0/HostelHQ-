"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HelpCenterPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/faq");
  }, [router]);

  return null;
}

