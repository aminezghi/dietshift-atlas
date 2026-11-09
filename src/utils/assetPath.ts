/**
 * Asset URL resolver supporting root, subpath, and relative deployments
 * (e.g. GitHub Pages https://<user>.github.io/<repo>/ or local dev).
 */
export function assetUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const base = import.meta.env.BASE_URL || './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${cleanPath}`;
}

export function absoluteAssetUrl(path: string): string {
  const rel = assetUrl(path);
  try {
    return new URL(rel, window.location.href).href;
  } catch {
    return rel;
  }
}
