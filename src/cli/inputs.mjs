import { loadBytes } from '../lib/http.mjs';
import { inspectIPA, versionFromIPA } from '../lib/ipa.mjs';
import { fetchManifest, parseManifest, versionFromManifest } from '../lib/adp.mjs';
import { fetchLatestRelease, matchAsset } from '../lib/github.mjs';
import { today } from '../lib/content.mjs';

export class UsageError extends Error {}

export const SOURCE_OPTIONS = {
  'from-source': { type: 'string' }, 'from-github': { type: 'string' }, 'from-adp': { type: 'string' }, 'from-ipa': { type: 'string' },
  asset: { type: 'string' }, tag: { type: 'string' }, prerelease: { type: 'boolean', default: false }, release: { type: 'string' },
  'download-url': { type: 'string' }, notes: { type: 'string' }, date: { type: 'string' },
};

export function sourceKind(values) {
  const kinds = ['from-source', 'from-github', 'from-adp', 'from-ipa'].filter((k) => values[k]);
  if (kinds.length > 1) throw new UsageError('use only one of --from-source, --from-github, --from-adp, --from-ipa');
  return kinds[0] ?? null;
}

const isoFromHTTPDate = (s) => { const t = s ? Date.parse(s) : NaN; return Number.isNaN(t) ? undefined : new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z'); };

/** Turn --from-ipa / --from-github / --from-adp into a version entry plus what it was built from. */
export async function resolvePackage(values, { cwd, fetch }) {
  if (values['from-ipa']) {
    const { buffer, url } = await loadBytes(values['from-ipa'], { cwd, fetch });
    const ipa = inspectIPA(buffer);
    const downloadURL = values['download-url'] ?? url;
    if (!downloadURL) throw new UsageError('--download-url is required when --from-ipa is a local file (AltStore needs a hosted URL)');
    return { kind: 'ipa', ipa, version: versionFromIPA(ipa, { downloadURL, date: values.date ?? today(), notes: values.notes }) };
  }
  if (values['from-github']) {
    const repo = values['from-github'];
    const release = await fetchLatestRelease(repo, { fetch, prerelease: values.prerelease, tag: values.tag });
    const asset = matchAsset(release.assets, values.asset ?? '*.ipa');
    const { buffer } = await loadBytes(asset.url, { cwd, fetch });
    const ipa = inspectIPA(buffer);
    const version = versionFromIPA(ipa, { downloadURL: asset.url, size: asset.size, date: values.date ?? release.publishedAt ?? today(), notes: values.notes ?? (release.body || undefined) });
    return { kind: 'ipa', ipa, release, repo, asset, version };
  }
  if (values['from-adp']) {
    const { manifest, manifestURL, lastModified } = await fetchManifest(values['from-adp'], { fetch });
    const parsed = parseManifest(manifest);
    const version = versionFromManifest(parsed, { manifestURL, date: values.date ?? isoFromHTTPDate(lastModified) ?? today(), notes: values.notes, releaseBase: values.release });
    return { kind: 'adp', manifest: parsed, version };
  }
  return null;
}

/** Print issues for one content file after a write (best effort). */
export async function reportFileIssues(file, { cwd, stdout }) {
  const { loadContent, LoadError } = await import('../lib/load.mjs');
  const { validateContent } = await import('../lib/validate.mjs');
  const { formatIssues } = await import('./format.mjs');
  try {
    const issues = await validateContent(await loadContent(cwd), { rootDir: cwd });
    const mine = (list) => list.filter((i) => i.path.startsWith(`${file}#`));
    const errors = mine(issues.errors), warnings = mine(issues.warnings);
    if (errors.length || warnings.length) stdout.write(formatIssues({ errors, warnings }));
    return errors.length;
  } catch (e) {
    if (e instanceof LoadError) return 0;
    throw e;
  }
}
