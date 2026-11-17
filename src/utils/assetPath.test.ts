import { describe, expect, it } from 'vitest';
import { assetUrl, getBasePath } from './assetPath';

describe('assetPath utilities', () => {
  it('resolves relative asset URLs cleanly from root', () => {
    expect(getBasePath()).toBe('/');
    expect(assetUrl('data/datasets_registry.json')).toBe('/data/datasets_registry.json');
    expect(assetUrl('/favicon.ico')).toBe('/favicon.ico');
  });
});
