import { OutboxEvent } from '../models/OutboxEvent';
import { IntegrationSettings } from '../models/IntegrationSettings';

export async function processOutboxBatch(): Promise<void> {
  const pending = await OutboxEvent.find({
    status: 'pending',
    attempts: { $lt: 10 },
  }).limit(50);

  for (const evt of pending) {
    const tenantId = evt.tenantId.toString();
    const target = evt.targetModule as 'm1' | 'm3';

    const settings = await IntegrationSettings
      .findOne({ tenantId })
      .select(`connectedServices.${target}`)
      .lean();
    const peer = settings?.connectedServices?.[target];

    evt.attempts = (evt.attempts ?? 0) + 1;
    evt.lastAttemptAt = new Date();

    if (!peer?.enabled || !peer.url || !peer.token) {
      if (evt.attempts >= 10) evt.status = 'failed';
      await evt.save();
      continue;
    }

    try {
      const res = await fetch(`${peer.url}${evt.targetPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-token': peer.token,
          'x-caller-module': 'm2',
        },
        body: JSON.stringify(evt.payload),
        signal: AbortSignal.timeout(3000),
      });
      evt.status = res.ok ? 'delivered' : (evt.attempts >= 10 ? 'failed' : 'pending');
    } catch {
      evt.status = evt.attempts >= 10 ? 'failed' : 'pending';
    }

    await evt.save();
  }
}

export function startOutboxRetry(): void {
  setInterval(async () => {
    try {
      await processOutboxBatch();
    } catch (err) {
      console.error('[M2 outbox retry]', err);
    }
  }, 60_000);
}
