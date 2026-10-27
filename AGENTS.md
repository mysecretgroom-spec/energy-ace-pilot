# Architecture rules
- Native iOS/Android builds use Capacitor with the shared React bundle (android/ and ios/ committed); the sandbox hot-reload server.url in capacitor.config.ts must be removed before any store-bound build so the app loads its bundled dist.
- MCP uses SDK-generated transport, OAuth caller tokens and own-user RLS; WebMCP reads visible data only. Canonical OAuth return paths preserve consent through all sign-in methods to avoid lost consent and open redirects.
- Download actions use src/lib/fileDelivery: native file sharing on touch devices, browser downloads on desktop, and a fresh Save action after asynchronous preparation loses user activation; never revoke download URLs immediately.
- Document/photo thumbnails open the shared MediaPreview viewer; use document MIME metadata and shared URL resolution, with swipe navigation and PDF.js rendering, so all previews stay consistent without third-party document viewers.
- End-of-study scans use explicit document study associations and a dedicated context source; the shared study annex pipeline copies their PDF pages for preview, exports, stored PDFs and signature sharing without rebranding originals.
- Scanner shadow correction uses shared bounded pixel illumination correction, not generative image rewriting; crop geometry is normalized and rotated with the displayed image to preserve document fidelity.
- Scanner processing keeps lossless intermediate images and confirms the exact cached preview; document PDF compression retains the crop resolution within a bounded mobile budget to avoid cumulative handwriting blur.
- Scanner page proposals use color-neutral paper masks and evidence on all four boundaries rather than area; preserve supplied/manual corners until explicit redetection and require the shared crop/filter preview before confirmation to exclude furniture from saved scans.
- Camera scans must be reviewed on the captured image before being added to the study; reject video frames without decoded pixels and never infer sensor-photo framing solely from aspect ratio, to prevent blank pages and destructive preview crops.
- Automatic scan deskew runs after perspective and illumination correction, rejects uncertain text angles and expands the output bounds to preserve document corners; contrast uses bounded histogram correction rather than fixed boosts to avoid erasing annotations.
- Shared PageState views distinguish loading and request failures; AppErrorBoundary catches render/import failures and offers explicit recovery without automatic reload loops.
- Access-check errors and timeouts show recovery rather than bypassing account checks; entitlement query failures must propagate to the route guard.

- Agency WhatsApp recaps use the shared notification hook and study recap mapper; signature attachments reuse the study PDF generation pipeline, while other statuses remain text-only and independent exports remain separate.
- Roof map exports use the saved Leaflet viewport in study parameter overrides and scale tile rendering by pixel density without changing geographic extent, so study and PDF framing match.
- Paired PV views share placement and marked-map reference to target the same roof.
- Study subdirectories have AGENTS.md; read before editing there.
- AI roof targeting includes the marker's normalized position in the saved viewport and a close-up reference; reject off-frame points instead of selecting a different roof.
- Manual PV layouts live within the saved roof viewport and use shared metric corner geometry for Leaflet and PDF rendering; manual panels take precedence over AI images.- Offline RDV closing goes through src/lib/offline: reads use cachedQuery (same query functions for preload and use, so cache keys match) and writes use writeOrQueue/outbox with client-generated ids; never intercept fetch globally (fake 200s broke earlier).
- Official logos on study/result PDFs are gated by src/lib/officialLogos, driven by HejjaModeProvider (HEJJA active + premium); never load logos directly elsewhere.
- Billing uses the built-in Paddle integration: plan/top-up price ids live in src/lib/plans.ts and supabase/functions/_shared/plans.ts (keep in sync); entitlement is derived server-side by get_user_plan(), and only the payments-webhook (service role) changes access state.
- Satellite PV visuals are drawn deterministically (exact panel count, centred on the red marker, metric panel size); generative AI is only used for the study photo view, because it ignored the designated pan and count.
- WhatsApp webhook acks Twilio immediately, dedupes by MessageSid and processes each user's messages sequentially in background (waitUntil), because concurrent messages raced on conversation state and hit 150s timeouts.

- Burst scans default to the in-app camera, guard capture/finish synchronously and render outside transformed layouts; pages are pre-cropped once (services/scanPipeline) and reviewed in a height-bounded BatchCropReview carousel, then go to ReviewDocument with CropEditor per page on demand, preventing lost captures and clipped images.
- Admin console metrics come from security-definer RPCs (admin_get_metrics, admin_get_user_360) that check is_saas_admin and aggregate server-side; admin pages share src/components/admin/AdminUI primitives for a consistent dense layout.
- Visitor mode signs into the shared demo account (src/lib/visitorMode, visitor-session function); RLS restrictive policies make it read-only and AI functions reject it via _shared/visitorGuard, so a public demo cannot write data or spend AI budget.

- Google product access uses the explicitly chosen custom unified OAuth flow with one Gmail/Drive/Calendar grant, PKCE and single-use auth-bound server state; provider tokens stay encrypted server-side. Existing connector credentials remain connector-bound and legacy accounts remain until explicit reconnect.
