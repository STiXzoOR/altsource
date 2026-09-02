import ENTITLEMENTS from '../data/entitlements.mjs';
import PRIVACY from '../data/privacy.mjs';

const humanize = (key) => key.replace(/^NS/, '').replace(/UsageDescription$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();

export function entitlementInfo(key) {
  const e = ENTITLEMENTS[key];
  return { key, name: e?.name ?? key, description: e?.description ?? 'No description is available for this entitlement.', icon: e?.icon ?? 'shield' };
}

export function privacyInfo(key, text) {
  const p = PRIVACY[key];
  return { key, name: p?.name ?? humanize(key), description: text, icon: p?.icon ?? 'lock' };
}
