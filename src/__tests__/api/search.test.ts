import { describe, it, expect } from 'vitest';

// Replicate the search type detection logic from src/app/api/search/route.ts
type SearchType = 'uid' | 'domain_id' | 'unp_acc' | 'pdb_id' | 'cluster_id' | 'keyword';

function detectSearchType(q: string): SearchType {
  const trimmed = q.trim();

  // Domain ID: starts with 'e' followed by 4 chars + more
  if (/^e[0-9a-z]{4}/i.test(trimmed)) {
    return 'domain_id';
  }

  // Cluster ID: number WITH dots (e.g., 1.2.3) - must have at least one dot
  if (/^\d+\.\d+(\.\d+)*$/.test(trimmed)) {
    return 'cluster_id';
  }

  // UID: pure number without dots (any length, will be validated)
  if (/^\d+$/.test(trimmed)) {
    return 'uid';
  }

  // PDB ID: 4 characters starting with digit
  if (/^[0-9][a-z0-9]{3}$/i.test(trimmed)) {
    return 'pdb_id';
  }

  // UniProt accession pattern
  if (/^[OPQ][0-9][A-Z0-9]{3}[0-9]$/i.test(trimmed) ||
      /^[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$/i.test(trimmed)) {
    return 'unp_acc';
  }

  return 'keyword';
}

describe('Search type detection', () => {
  it('detects UIDs (pure numeric)', () => {
    expect(detectSearchType('12345')).toBe('uid');
    expect(detectSearchType('1')).toBe('uid');
    expect(detectSearchType('999999999')).toBe('uid');
  });

  it('detects domain IDs', () => {
    expect(detectSearchType('e00000001.1')).toBe('domain_id');
    expect(detectSearchType('E00123456.2')).toBe('domain_id');
    expect(detectSearchType('e4v4fA1.1')).toBe('domain_id');
  });

  it('detects cluster IDs', () => {
    expect(detectSearchType('1.1')).toBe('cluster_id');
    expect(detectSearchType('1.1.1')).toBe('cluster_id');
    expect(detectSearchType('1.1.1.1')).toBe('cluster_id');
    expect(detectSearchType('200.30.5')).toBe('cluster_id');
  });

  it('detects PDB IDs', () => {
    expect(detectSearchType('1abc')).toBe('pdb_id');
    expect(detectSearchType('4HHB')).toBe('pdb_id');
    expect(detectSearchType('9xyz')).toBe('pdb_id');
  });

  it('detects UniProt accessions', () => {
    expect(detectSearchType('P12345')).toBe('unp_acc');
    expect(detectSearchType('Q9UHD2')).toBe('unp_acc');
    expect(detectSearchType('A0A0K9RDH3')).toBe('unp_acc');
  });

  it('falls back to keyword', () => {
    expect(detectSearchType('kinase')).toBe('keyword');
    expect(detectSearchType('TIM barrel')).toBe('keyword');
    expect(detectSearchType('immunoglobulin fold')).toBe('keyword');
  });

  it('domain_id takes priority over pdb_id for e-prefixed strings', () => {
    // "e4v4f" starts with 'e' followed by 4 alphanumeric chars -> domain_id
    expect(detectSearchType('e4v4f')).toBe('domain_id');
  });

  it('cluster_id takes priority over uid for dotted numbers', () => {
    expect(detectSearchType('1.2')).toBe('cluster_id');
  });
});
