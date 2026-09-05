"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LiveRefresh() {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [router]);
  return (
    <span className="live-refresh" aria-live="polite">
      <i /> Live polling · {lastRefresh ? `updated ${lastRefresh.toLocaleTimeString()}` : "waiting"}
    </span>
  );
}
