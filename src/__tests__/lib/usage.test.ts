import { describe, it, expect } from 'vitest';
import { classifyApiRequest, cleanPath, geoFromRecord, isBot, isLoopback, isPageviewPath, referrerHost, visitorHash } from '@/lib/usage';

describe('classifyApiRequest', () => {
  it('counts job submissions only on POST', () => {
    expect(classifyApiRequest('/api/blast/submit', 'POST')).toEqual({ kind: 'blast' });
    expect(classifyApiRequest('/api/foldseek/submit', 'POST')).toEqual({ kind: 'foldseek' });
    expect(classifyApiRequest('/api/blast/submit', 'GET')).toBeNull();
  });

  it('ignores job polling and internal data fetches', () => {
    expect(classifyApiRequest('/api/blast/abc123', 'GET')).toBeNull();
    expect(classifyApiRequest('/api/tree', 'GET')).toBeNull();
    expect(classifyApiRequest('/api/domain/123', 'GET')).toBeNull();
    expect(classifyApiRequest('/api/usage', 'POST')).toBeNull();
  });

  it('classifies public API, searches and file downloads', () => {
    expect(classifyApiRequest('/api/v1/domains/2083261/pdb', 'GET')).toEqual({ kind: 'api', detail: 'domains/2083261' });
    expect(classifyApiRequest('/api/v1/health', 'GET')).toBeNull();
    expect(classifyApiRequest('/api/search/advanced', 'GET')).toEqual({ kind: 'search', detail: 'advanced' });
    expect(classifyApiRequest('/api/domain/123/fasta', 'GET')).toEqual({ kind: 'file', detail: 'fasta' });
    expect(classifyApiRequest('/api/structures/unp/P12345/download', 'GET')).toEqual({ kind: 'file', detail: 'model' });
  });
});

describe('privacy helpers', () => {
  it('drops query strings so search terms and sequences are never stored', () => {
    expect(cleanPath('/search?q=MKTAYIAK')).toBe('/search');
    expect(cleanPath('/domain/e1abcA1#x')).toBe('/domain/e1abcA1');
  });

  it('reduces referrers to an external host', () => {
    expect(referrerHost('https://www.uniprot.org/uniprotkb/P12345?x=1', 'prodata.swmed.edu')).toBe('www.uniprot.org');
    expect(referrerHost('http://prodata.swmed.edu/ecod/tree', 'prodata.swmed.edu:443')).toBeNull();
    expect(referrerHost('not a url')).toBeNull();
    // behind the proxy the Host header is internal, so the public name must still be recognised
    expect(referrerHost('http://prodata.swmed.edu/ecod/domain/1', 'localhost:3004')).toBeNull();
  });

  it('hashes visitors per salt so days are unlinkable', () => {
    const a = visitorHash('salt1', '1.2.3.4', 'UA');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(visitorHash('salt1', '1.2.3.4', 'UA')).toBe(a);
    expect(visitorHash('salt2', '1.2.3.4', 'UA')).not.toBe(a);
  });

  it('rounds locations to 0.1 degree', () => {
    expect(geoFromRecord({
      country: { iso_code: 'US' }, city: { names: { en: 'Dallas' } }, location: { latitude: 32.7831, longitude: -96.8067 },
    } as never)).toEqual({ country: 'US', city: 'Dallas', lat: 32.8, lon: -96.8 });
    expect(geoFromRecord(null)).toEqual({ country: null, city: null, lat: null, lon: null });
  });
});

describe('isPageviewPath', () => {
  it('accepts real routes', () => {
    for (const p of ['/', '/tree', '/domain/e1abcA1', '/group/1.1.1.1', '/search/blast', '/protein/P12345', '/documentation/api']) {
      expect(isPageviewPath(p)).toBe(true);
    }
  });

  it('rejects unknown routes and the injection probes a scanner sent on day one', () => {
    for (const p of ["/' AND pg_sleep(20)--", "/'|ping -c 21 127.0.0.1", '/]]>><', '/ecod2/search', '/wp-admin', 'tree', '/' + 'a'.repeat(300)]) {
      expect(isPageviewPath(p)).toBe(false);
    }
  });
});

describe('isLoopback', () => {
  it('treats the app\'s own fetches as internal', () => {
    expect(isLoopback('127.0.0.1')).toBe(true);
    expect(isLoopback('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopback('::1')).toBe(true);
    expect(isLoopback(null)).toBe(true);
    expect(isLoopback('129.112.32.5')).toBe(false);
  });
});

describe('isBot', () => {
  it('flags automated clients and empty agents', () => {
    expect(isBot('Wget/1.21')).toBe(true);
    expect(isBot('python-requests/2.31')).toBe(true);
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15')).toBe(false);
  });

  it('flags browser-like agents that lack Sec-Fetch headers', () => {
    const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
    expect(isBot(chrome, false)).toBe(true);
    expect(isBot(chrome, true)).toBe(false);
    expect(isBot(chrome)).toBe(false);
    // a declared script is automated regardless; one without Sec-Fetch is not "faking"
    expect(isBot('Wget/1.21', true)).toBe(true);
  });
});
