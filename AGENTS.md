# Architecture rules

- Agency WhatsApp recaps use the shared notification hook and study recap mapper; signature attachments reuse the study PDF generation pipeline, while other statuses remain text-only and independent exports remain separate.
- Roof map exports use the saved Leaflet viewport in study parameter overrides and scale tile rendering by pixel density without changing geographic extent, so study and PDF framing match.