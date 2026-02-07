/**
 * Trigger haptic feedback on supported devices.
 * Falls back silently on unsupported browsers.
 */
export function hapticFeedback(type: "light" | "medium" | "heavy" = "light") {
  if (!navigator.vibrate) return;

  switch (type) {
    case "light":
      navigator.vibrate(15);
      break;
    case "medium":
      navigator.vibrate(30);
      break;
    case "heavy":
      navigator.vibrate([30, 50, 30]);
      break;
  }
}

/**
 * Trigger success haptic + optional callback
 */
export function hapticSuccess() {
  hapticFeedback("medium");
}
