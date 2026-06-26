const KEY = 'silvermind_crash_reporting_enabled';
const CONSENT_KEY = 'silvermind_privacy_consent_shown';

let _enabled = $state(false);
let _consentShown = $state(false);

export function isCrashReportingEnabled(): boolean { return _enabled; }
export function wasConsentShown(): boolean { return _consentShown; }

export function initPrivacy(): void {
  try {
    _enabled = localStorage.getItem(KEY) === 'true';
    _consentShown = localStorage.getItem(CONSENT_KEY) === 'true';
  } catch { /* no localStorage */ }
}

export function setCrashReporting(enabled: boolean): void {
  _enabled = enabled;
  try {
    localStorage.setItem(KEY, String(enabled));
    localStorage.setItem(CONSENT_KEY, 'true');
    _consentShown = true;
  } catch { /* no localStorage */ }
}
