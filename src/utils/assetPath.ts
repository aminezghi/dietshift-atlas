/**
 * Asset URL resolver supporting root, subpath, and relative deployments
 * (e.g. GitHub Pages https://<user>.github.io/<repo>/ or local dev).
 */
export function getBasePath(): string {
  if (typeof window !== 'undefined') {
    const segments = window.location.pathname.split('/').filter(Boolean);
    // If running on a GitHub Pages repo subpath (e.g. /dietshift-atlas/ or /dietshift-atlas/index.html)
    if (segments.length > 0 && !segments[0].includes('.')) {
      return `/${segments[0]}/`;
    }
  }
  const base = import.meta.env.BASE_URL || './';
  return base.endsWith('/') ? base : `${base}/`;
}

export function assetUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const base = getBasePath();
  return `${base}${cleanPath}`;
}

export function absoluteAssetUrl(path: string): string {
  const rel = assetUrl(path);
  try {
    return new URL(rel, window.location.origin).href;
  } catch {
    return rel;
  }
}
