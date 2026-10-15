# Architecture rules

- Agency WhatsApp recaps use the shared notification hook and study recap mapper; signature attachments reuse the study PDF generation pipeline, while other statuses remain text-only and independent exports remain separate.
- Roof map exports use the saved Leaflet viewport in study parameter overrides and scale tile rendering by pixel density without changing geographic extent, so study and PDF framing match.
- Paired PV visualizations share one placement payload and pass the marked satellite map as the photo reference, so both views target the same installation space.
- AI roof targeting includes the marker's normalized position in the saved viewport and a close-up reference; reject off-frame points instead of selecting a different roof.
- Manual PV layouts live within the saved roof viewport and use shared metric corner geometry for Leaflet and PDF rendering; manual panels take precedence over AI images.- Offline RDV closing goes through src/lib/offline: reads use cachedQuery (same query functions for preload and use, so cache keys match) and writes use writeOrQueue/outbox with client-generated ids; never intercept fetch globally (fake 200s broke earlier).
- Official logos on study/result PDFs are gated by src/lib/officialLogos, driven by HejjaModeProvider (HEJJA active + premium); never load logos directly elsewhere.
- Billing uses the built-in Paddle integration: plan/top-up price ids live in src/lib/plans.ts and supabase/functions/_shared/plans.ts (keep in sync); entitlement is derived server-side by get_user_plan(), and only the payments-webhook (service role) changes access state.
