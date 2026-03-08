import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  let dbConnected = false;
  let dbLatency = 0;

  try {
    const start = Date.now();
    await query('SELECT 1');
    dbLatency = Date.now() - start;
    dbConnected = true;
  } catch {
    // Database unreachable
  }

  const status = dbConnected ? 'ok' : 'degraded';

  return NextResponse.json({
    status,
    version: '1.0.0',
    database: dbConnected ? 'connected' : 'unavailable',
    latency_ms: dbLatency,
  }, {
    status: dbConnected ? 200 : 503,
  });
}
