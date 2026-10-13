# Architecture rules

- Agency WhatsApp recaps use the shared notification hook and study recap mapper, with text only; independent PDF exports remain separate to prevent accidental attachments.
- Roof map exports use the saved Leaflet viewport in study parameter overrides and scale tile rendering by pixel density without changing geographic extent, so study and PDF framing match.