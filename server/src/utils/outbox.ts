import { OutboxEvent } from '../models/OutboxEvent';

interface OutboxParams {
  tenantId: string;
  type: string;
  targetModule: 'm1' | 'm3';
  targetPath: string;
  payload: object;
}

export async function enqueueOutbox(params: OutboxParams): Promise<void> {
  await OutboxEvent.create(params);
}
