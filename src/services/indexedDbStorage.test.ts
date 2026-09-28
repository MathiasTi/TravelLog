import { describe, it, expect, beforeEach, vi } from 'vitest';
import { indexedDbStorage } from './indexedDbStorage';

describe('indexedDbStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles environment without indexedDB gracefully without crashing', async () => {
    // In mock/headless environment where indexedDB might fail or succeed, verify methods return cleanly
    const setResult = await indexedDbStorage.setItem('test_key', { sample: 123 });
    expect(typeof setResult).toBe('boolean');

    const getResult = await indexedDbStorage.getItem('test_key');
    expect(getResult === null || typeof getResult === 'object').toBe(true);

    const removeResult = await indexedDbStorage.removeItem('test_key');
    expect(typeof removeResult).toBe('boolean');

    const cacheMediaResult = await indexedDbStorage.cacheMedia('media_1', 'data:image/jpeg;base64,...');
    expect(typeof cacheMediaResult).toBe('boolean');

    const cachedMedia = await indexedDbStorage.getCachedMedia('media_1');
    expect(cachedMedia === null || typeof cachedMedia === 'string').toBe(true);
  });
});
