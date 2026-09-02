import { fetchJSON, githubHeaders } from './http.mjs';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function globToRegExp(glob) {
  return new RegExp(`^${glob.split('*').map(escapeRe).join('.*')}$`, 'i');
}

function normalize(r) {
  return {
    tag: r.tag_name,
    name: r.name ?? r.tag_name,
    body: r.body ?? '',
    publishedAt: r.published_at ?? r.created_at,
    htmlURL: r.html_url,
    prerelease: Boolean(r.prerelease),
    assets: (r.assets ?? []).map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })),
  };
}

export async function fetchLatestRelease(repo, { fetch, token, prerelease = false, tag } = {}) {
  const headers = githubHeaders(token);
  if (tag) return normalize(await fetchJSON(`https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`, { fetch, headers }));
  const list = await fetchJSON(`https://api.github.com/repos/${repo}/releases?per_page=30`, { fetch, headers });
  const rel = list.find((r) => !r.draft && (prerelease || !r.prerelease));
  if (!rel) throw new Error(`no ${prerelease ? '' : 'stable '}release found in ${repo}`);
  return normalize(rel);
}

export function matchAsset(assets, glob = '*.ipa') {
  const re = globToRegExp(glob);
  const hit = assets.find((a) => re.test(a.name));
  if (!hit) throw new Error(`no release asset matches "${glob}" (have: ${assets.map((a) => a.name).join(', ') || 'none'})`);
  return hit;
}

export async function fetchRepoInfo(repo, { fetch, token } = {}) {
  const r = await fetchJSON(`https://api.github.com/repos/${repo}`, { fetch, headers: githubHeaders(token) });
  return { description: r.description ?? '', owner: r.owner?.login ?? repo.split('/')[0], htmlURL: r.html_url ?? `https://github.com/${repo}`, homepage: r.homepage ?? '' };
}
