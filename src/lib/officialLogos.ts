// Official logos (France Rénov', Ministère, Enedis) are only printed when HEJJA mode
// is active on a premium account. The flag is driven by HejjaModeProvider.
let enabled = false;
export const setOfficialLogosEnabled = (v: boolean) => { enabled = v; };
export const areOfficialLogosEnabled = () => enabled;
