/**
 * M2 event flow tests:
 *  - calcHours: pure hour calculation with/without breaks
 *  - peers.m3 serviceClient: M3 push with/without integration settings
 *  - processOutboxBatch: outbox retry — deliver, fail, max-attempts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('../models/OutboxEvent');
vi.mock('../models/IntegrationSettings');

import { OutboxEvent }          from '../models/OutboxEvent';
import { IntegrationSettings }  from '../models/IntegrationSettings';
import { calcHours }            from '../utils/timeUtils';
import { processOutboxBatch }   from '../jobs/outboxRetry';

const mockOutboxEvent        = vi.mocked(OutboxEvent);
const mockIntegrationSettings = vi.mocked(IntegrationSettings);

// ── calcHours ─────────────────────────────────────────────────────────────────
describe('calcHours', () => {
  const h = (startH: number, endH: number) =>
    (date: number) => new Date(2025, 5, 15, date, 0, 0);

  it('returns exact hours for a shift with no break', () => {
    const start = new Date('2025-06-15T08:00:00Z');
    const end   = new Date('2025-06-15T16:00:00Z');
    expect(calcHours(start, end, false, 0)).toBe(8);
  });

  it('deducts break minutes when breakTaken is true', () => {
    const start = new Date('2025-06-15T08:00:00Z');
    const end   = new Date('2025-06-15T16:00:00Z');
    // 8 hours − 30 min = 7.5 hours
    expect(calcHours(start, end, true, 30)).toBe(7.5);
  });

  it('does NOT deduct break when breakTaken is false even if breakMinutes > 0', () => {
    const start = new Date('2025-06-15T08:00:00Z');
    const end   = new Date('2025-06-15T16:00:00Z');
    expect(calcHours(start, end, false, 30)).toBe(8);
  });

  it('rounds to 2 decimal places', () => {
    // 7h 45m = 7.75h exactly
    const start = new Date('2025-06-15T08:00:00Z');
    const end   = new Date('2025-06-15T15:45:00Z');
    expect(calcHours(start, end, false, 0)).toBe(7.75);
  });

  it('floors at 0 when break is longer than the shift', () => {
    const start = new Date('2025-06-15T08:00:00Z');
    const end   = new Date('2025-06-15T08:20:00Z'); // 20 min shift
    expect(calcHours(start, end, true, 60)).toBe(0); // break 60 min > 20 min
  });

  it('handles overnight shifts correctly', () => {
    const start = new Date('2025-06-15T22:00:00Z');
    const end   = new Date('2025-06-16T06:00:00Z'); // 8h across midnight
    expect(calcHours(start, end, false, 0)).toBe(8);
  });
});

// ── processOutboxBatch ────────────────────────────────────────────────────────
describe('processOutboxBatch — outbox retry worker', () => {
  function makeEvent(overrides: Record<string, unknown> = {}) {
    return {
      _id:           'evt-1',
      tenantId:      { toString: () => 'tenant-1' },
      targetModule:  'm3',
      targetPath:    '/api/internal/payroll-lines',
      payload:       { foo: 'bar' },
      status:        'pending',
      attempts:      0,
      lastAttemptAt: undefined,
      save:          vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  function mockSettings(peer: Record<string, unknown> | null) {
    mockIntegrationSettings.findOne = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(
          peer ? { connectedServices: { m3: peer } } : null
        ),
      }),
    });
  }

  beforeEach(() => vi.clearAllMocks());

  function mockFind(events: ReturnType<typeof makeEvent>[]) {
    mockOutboxEvent.find = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(events) });
  }

  it('marks event as delivered when M3 responds with ok', async () => {
    const evt = makeEvent();
    mockFind([evt]);
    mockSettings({ enabled: true, url: 'http://m3:5002', token: 'secret' });

    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as typeof fetch;

    await processOutboxBatch();

    expect(evt.status).toBe('delivered');
    expect(evt.attempts).toBe(1);
    expect(evt.save).toHaveBeenCalled();
  });

  it('keeps status pending when M3 returns a non-ok response', async () => {
    const evt = makeEvent({ attempts: 3 });
    mockFind([evt]);
    mockSettings({ enabled: true, url: 'http://m3:5002', token: 'secret' });

    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as typeof fetch;

    await processOutboxBatch();

    expect(evt.status).toBe('pending');  // still under attempt limit
    expect(evt.attempts).toBe(4);
  });

  it('marks event as failed after 10 failed attempts', async () => {
    const evt = makeEvent({ attempts: 9 });
    mockFind([evt]);
    mockSettings({ enabled: true, url: 'http://m3:5002', token: 'secret' });

    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as typeof fetch;

    await processOutboxBatch();

    expect(evt.status).toBe('failed');
    expect(evt.attempts).toBe(10);
  });

  it('marks event as failed when fetch throws after max attempts', async () => {
    const evt = makeEvent({ attempts: 9 });
    mockFind([evt]);
    mockSettings({ enabled: true, url: 'http://m3:5002', token: 'secret' });

    global.fetch = vi.fn().mockRejectedValue(new Error('network timeout')) as typeof fetch;

    await processOutboxBatch();

    expect(evt.status).toBe('failed');
  });

  it('skips delivery when integration settings are missing; marks failed at 10 attempts', async () => {
    const evt = makeEvent({ attempts: 9 });
    mockFind([evt]);
    mockSettings(null);  // no settings

    await processOutboxBatch();

    expect(evt.status).toBe('failed');
    expect(global.fetch).not.toHaveBeenCalled?.();
  });

  it('increments attempts and stays pending when peer is disabled', async () => {
    const evt = makeEvent({ attempts: 2 });
    mockFind([evt]);
    mockSettings({ enabled: false, url: 'http://m3:5002', token: 'secret' });

    await processOutboxBatch();

    expect(evt.status).toBe('pending');
    expect(evt.attempts).toBe(3);
    expect(evt.save).toHaveBeenCalled();
  });

  it('does nothing when the pending queue is empty', async () => {
    mockFind([]);

    await processOutboxBatch();

    expect(mockIntegrationSettings.findOne).not.toHaveBeenCalled();
  });
});

// ── serviceClient peers.m3 ────────────────────────────────────────────────────
// Tests that callM3 correctly uses IntegrationSettings and falls back to null
// when integration is not configured.
describe('peers.m3.pushPayrollEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when integration settings are not found', async () => {
    mockIntegrationSettings.findOne = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    });

    const { peers } = await import('../utils/serviceClient');
    const result = await peers.m3.pushPayrollEntry('tenant-1', {
      syncId: 's1', m2StaffId: 'sp1', staffName: 'Test',
      firstName: 'T', lastName: 'T', email: 't@t.de',
      grossCents: 10000, taxCents: 2000, deductionCents: 0, netCents: 8000,
      hoursWorked: 8, periodYear: 2025, periodMonth: 6, timesheetId: 'ts1',
    });

    expect(result).toBeNull();
  });

  it('returns null when integration is disabled', async () => {
    mockIntegrationSettings.findOne = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ connectedServices: { m3: { enabled: false, url: 'http://m3', token: 'tok' } } }),
      }),
    });

    const { peers } = await import('../utils/serviceClient');
    const result = await peers.m3.pushPayrollEntry('tenant-1', {
      syncId: 's2', m2StaffId: 'sp1', staffName: 'Test',
      firstName: 'T', lastName: 'T', email: 't@t.de',
      grossCents: 10000, taxCents: 2000, deductionCents: 0, netCents: 8000,
      hoursWorked: 8, periodYear: 2025, periodMonth: 6, timesheetId: 'ts2',
    });

    expect(result).toBeNull();
  });

  it('returns the parsed JSON body when M3 responds with 200', async () => {
    mockIntegrationSettings.findOne = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ connectedServices: { m3: { enabled: true, url: 'http://m3:5002', token: 'secret' } } }),
      }),
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ payrollId: 'prl-1', created: true }),
    }) as typeof fetch;

    const { peers } = await import('../utils/serviceClient');
    const result = await peers.m3.pushPayrollEntry('tenant-1', {
      syncId: 's3', m2StaffId: 'sp1', staffName: 'Test',
      firstName: 'T', lastName: 'T', email: 't@t.de',
      grossCents: 10000, taxCents: 2000, deductionCents: 0, netCents: 8000,
      hoursWorked: 8, periodYear: 2025, periodMonth: 6, timesheetId: 'ts3',
    });

    expect(result).toMatchObject({ payrollId: 'prl-1', created: true });
  });
});
