import pkg from '../package.json';

/**
 * Authoritative runtime software version resolved directly from package.json.
 * Analytical engine sub-versions (e.g., 3.1.0-phase3b .. 5.1.0-phase5a) and historical
 * release records remain independently tracked in docs/development/CHANGELOG.md.
 */
export const APP_VERSION: string = pkg.version;
