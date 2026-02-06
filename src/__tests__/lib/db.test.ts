import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pg module
vi.mock('pg', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };
  const mockPool = {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue(mockClient),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
    end: vi.fn(),
    on: vi.fn(),
  };
  return {
    Pool: vi.fn(() => mockPool),
    default: { Pool: vi.fn(() => mockPool) },
  };
});

describe('Database module', () => {
  it('should be importable', async () => {
    const db = await import('@/lib/db');
    expect(db).toBeDefined();
    expect(typeof db.query).toBe('function');
    expect(typeof db.healthCheck).toBe('function');
    expect(typeof db.getPoolStats).toBe('function');
  });
});
