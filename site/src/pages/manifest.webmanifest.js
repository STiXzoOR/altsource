import { getSite } from '../lib/data.mjs';
import { normalizeTint } from '../lib/tint.mjs';

/** Web app manifest so "Add to Home Screen" opens the source as a standalone app. */
export async function GET() {
  const site = await getSite();
  const base = import.meta.env.BASE_URL;
  const manifest = {
    name: site.meta.name,
    short_name: site.meta.name.split(/\s+/)[0],
    start_url: base,
    scope: base,
    display: 'standalone',
    background_color: '#000000',
    theme_color: normalizeTint(site.meta.tintColor),
    icons: [
      { src: site.meta.iconURL, sizes: '1024x1024', type: 'image/png' },
      { src: new URL('assets/apple-touch-icon.png', site.base).href, sizes: '180x180', type: 'image/png' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), { headers: { 'Content-Type': 'application/manifest+json' } });
}
