'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Analytics } from '@vercel/analytics/next';
import { initAnalytics, trackPageview } from '@/lib/analytics';

// Mounts Vercel Web Analytics and initializes PostHog, capturing a
// pageview on every client-side route change.
export default function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageview();
  }, [pathname]);

  return <Analytics />;
}
