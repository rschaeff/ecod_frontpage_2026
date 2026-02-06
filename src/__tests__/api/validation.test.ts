import { describe, it, expect } from 'vitest';

// Evalue validation regex (same as used in blast/foldseek submit routes)
function isValidEvalue(value: string): boolean {
  return /^\d*\.?\d+(e[+-]?\d+)?$/i.test(value);
}

// Sequence validation (same logic as blast submit)
function isValidSequence(sequence: string): boolean {
  const cleaned = sequence.replace(/^>.*\n?/gm, '').replace(/\s/g, '').toUpperCase();
  if (cleaned.length < 10 || cleaned.length > 10000) return false;
  return /^[ACDEFGHIKLMNPQRSTVWY]+$/.test(cleaned);
}

// Pagination capping
function capLimit(limit: number, max: number = 100): number {
  return Math.max(1, Math.min(limit, max));
}

function capOffset(offset: number): number {
  return Math.max(0, offset);
}

// Job ID validation
function isValidJobId(jobId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(jobId) && jobId.length <= 64;
}

describe('Evalue validation', () => {
  it('accepts valid evalue formats', () => {
    expect(isValidEvalue('0.01')).toBe(true);
    expect(isValidEvalue('1e-5')).toBe(true);
    expect(isValidEvalue('1E-10')).toBe(true);
    expect(isValidEvalue('1.5e+3')).toBe(true);
    expect(isValidEvalue('10')).toBe(true);
    expect(isValidEvalue('.001')).toBe(true);
    expect(isValidEvalue('1e10')).toBe(true);
  });

  it('rejects command injection attempts', () => {
    expect(isValidEvalue('0.01; rm -rf /')).toBe(false);
    expect(isValidEvalue('0.01\necho pwned')).toBe(false);
    expect(isValidEvalue('$(whoami)')).toBe(false);
    expect(isValidEvalue('`cat /etc/passwd`')).toBe(false);
    expect(isValidEvalue('0.01 && malicious')).toBe(false);
    expect(isValidEvalue('')).toBe(false);
    expect(isValidEvalue('abc')).toBe(false);
  });
});

describe('Sequence validation', () => {
  it('accepts valid protein sequences', () => {
    expect(isValidSequence('ACDEFGHIKLMNPQRSTVWY')).toBe(true);
    expect(isValidSequence('acdefghiklmnpqrstvwy')).toBe(true);
    expect(isValidSequence('>header\nACDEFGHIKL\nMNPQRSTVWY')).toBe(true);
  });

  it('rejects invalid sequences', () => {
    expect(isValidSequence('SHORT')).toBe(false); // too short
    expect(isValidSequence('ACDEFXYZ12')).toBe(false); // invalid chars
    expect(isValidSequence('')).toBe(false);
  });

  it('handles FASTA format', () => {
    const fasta = '>sp|P12345|TEST\nACDEFGHIKLMNPQRSTVWY';
    expect(isValidSequence(fasta)).toBe(true);
  });
});

describe('Pagination capping', () => {
  it('caps limit to maximum', () => {
    expect(capLimit(999999)).toBe(100);
    expect(capLimit(200, 200)).toBe(200);
    expect(capLimit(50)).toBe(50);
  });

  it('enforces minimum limit of 1', () => {
    expect(capLimit(0)).toBe(1);
    expect(capLimit(-10)).toBe(1);
  });

  it('caps offset to non-negative', () => {
    expect(capOffset(-1)).toBe(0);
    expect(capOffset(0)).toBe(0);
    expect(capOffset(100)).toBe(100);
  });
});

describe('Job ID validation', () => {
  it('accepts valid job IDs', () => {
    expect(isValidJobId('abc123')).toBe(true);
    expect(isValidJobId('job-id_123')).toBe(true);
  });

  it('rejects dangerous job IDs', () => {
    expect(isValidJobId('../../../etc/passwd')).toBe(false);
    expect(isValidJobId('id; rm -rf /')).toBe(false);
    expect(isValidJobId('')).toBe(false);
    expect(isValidJobId('a'.repeat(65))).toBe(false);
  });
});
