import { fetchJSON } from './http.mjs';

/** The app object for bundleId inside another AltStore source. */
export async function fetchUpstreamApp(sourceURL, bundleId, { fetch } = {}) {
  const source = await fetchJSON(sourceURL, { fetch });
  const apps = Array.isArray(source?.apps) ? source.apps : [];
  const app = apps.find((a) => a.bundleIdentifier === bundleId);
  if (!app) throw new Error(`${bundleId} not found in ${sourceURL} (available: ${apps.map((a) => a.bundleIdentifier).join(', ') || 'none'})`);
  return { app, source };
}
