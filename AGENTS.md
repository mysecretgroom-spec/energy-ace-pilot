# Architecture rules

- Agency WhatsApp recaps use the shared notification hook and study recap mapper; signature attachments reuse the study PDF generation pipeline, while other statuses remain text-only and independent exports remain separate.
- Roof map exports use the saved Leaflet viewport in study parameter overrides and scale tile rendering by pixel density without changing geographic extent, so study and PDF framing match.
- Paired PV visualizations share one placement payload and pass the marked satellite map as the photo reference, so both views target the same installation space.