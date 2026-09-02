import { loadBytes } from './http.mjs';
import { inspectIPA } from './ipa.mjs';
import { inferKind } from './kinds.mjs';

/** Fill appPermissions from the newest IPA when missing. Returns { app, note? }; never throws. */
export async function ensurePermissions(app, { cwd, fetch }) {
  const latest = app.versions?.[0];
  if (app.appPermissions || !latest || inferKind(latest) !== 'ipa') return { app };
  try {
    const { buffer } = await loadBytes(latest.downloadURL, { cwd, fetch });
    const ipa = inspectIPA(buffer);
    return { app: { ...app, appPermissions: { entitlements: ipa.entitlements, privacy: ipa.privacy } }, note: `filled appPermissions from ${latest.downloadURL}` };
  } catch (e) {
    return { app, note: `could not inspect ${latest.downloadURL} for permissions: ${e.message}` };
  }
}
