/**
 * Asset URL resolver supporting root, multi-segment subpath, and relative deployments
 * (e.g. GitHub Pages https://<user>.github.io/<repo>/ or local dev).
 */
export function getBasePath(): string {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname || '/';
    if (pathname.endsWith('/')) {
      return pathname;
    }
    const lastSlash = pathname.lastIndexOf('/');
    return lastSlash >= 0 ? pathname.slice(0, lastSlash + 1) : '/';
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
