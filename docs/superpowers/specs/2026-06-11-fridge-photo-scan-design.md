# Fridge Photo Scan — Design

**Date:** 2026-06-11
**Status:** Approved by PO via interactive mockup (`mockups/fridge-scan-mockup.html`)

## Summary

Signed-in users can photograph their fridge; Claude Sonnet 4.6 vision identifies the
ingredients; the user reviews/edits the list in a modal, then confirms to fill Step 1.

## Decisions (made with PO)

- **Model:** `claude-haiku-4-5` (~$0.003/scan). Originally launched on Sonnet 4.6;
  PO switched to Haiku on 2026-06-12 after testing.
- **Review step:** Yes — chips modal, tap to untick, add-missing input, confirm button
- **Access:** Signed-in users only; guests see 🔒 + sign-up nudge (same as Pantry)
- **Photo handling:** resized client-side to ≤1568px long edge (JPEG ~0.8 quality)
  before upload; never stored server-side

## Flow

1. Step 1 card gets a "📸 Scan Fridge" button (camera on mobile via
   `<input type="file" accept="image/*" capture="environment">`, file picker on desktop)
2. Client resizes photo on-device → base64 JPEG → `POST /api/scan`
3. Server: auth check → Anthropic vision call → returns `{ ingredients: string[] }`
4. Modal shows scanning animation while waiting, then review chips
5. Confirm merges selected items into the Step 1 ingredients text (deduped)
6. "Scan another photo" allows additional scans; results accumulate via the input box

## Components

- `app/api/scan/route.js` — new POST route. NextAuth session required.
  Sends image + instruction to Sonnet 4.6; instruction demands a strict JSON array of
  visible food items (lowercase, no quantities). Server parses defensively.
- `app/page.js` — scan button, hidden file input, client-side resize (canvas),
  scan modal (states: scanning / review / error), merge-on-confirm
  (same dedupe logic as pantry confirm)
- `app/page.module.css` — scan button + chip styles (reuse modal/chip patterns)

## Error handling

- No food recognized / unparseable AI reply → friendly modal message + retry button
- API/network failure → same retry path
- Oversized request guarded by client resize; server rejects >6MB payloads
- Guest clicks scan → sign-up nudge modal (reuse guest pantry nudge pattern)

## Cost guardrails

- Client resize caps image tokens (~1568 max per photo)
- Signed-in-only prevents anonymous abuse
- (Future, if needed: per-user daily scan cap)

## Testing

- Build must pass; manual verification on live site by PO (scan with real fridge photo,
  verify review/edit/confirm, verify guest lock)
