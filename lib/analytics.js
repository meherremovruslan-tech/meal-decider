'use client';
import posthog from 'posthog-js';

// Product analytics (PostHog). Silently disabled until
// NEXT_PUBLIC_POSTHOG_KEY is configured, so the app never breaks
// or slows down without it.
let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    // Privacy-friendly: anonymous events only, no per-person profiles
    // unless we explicitly identify someone (we don't).
    person_profiles: 'identified_only',
    // Pageviews are captured manually on route changes (App Router SPA
    // navigation doesn't reload the page, so the default misses them).
    capture_pageview: false,
    // Only the named product events below — no noisy click autocapture.
    autocapture: false,
    session_recording: { maskAllInputs: true },
  });
  initialized = true;
}

export function trackPageview() {
  if (!initialized) return;
  posthog.capture('$pageview', { $current_url: window.location.href });
}

export function track(event, props) {
  if (!initialized) return;
  posthog.capture(event, props);
}
