import type { ImmutableEventLog } from '../data/immutable-event-log.js';
import { applyOrderEvent, createLifecycleState, type OrderEvent, type OrderLifecycleState } from './order-lifecycle.js';

export class OrderLifecycleJournal {
  constructor(private readonly log: ImmutableEventLog) {}

  async append(event: OrderEvent): Promise<void> {
    await this.log.append({
      eventType: `ORDER_LIFECYCLE:${event.type}`,
      eventTimeMs: event.timestampMs,
      receivedAtMs: event.timestampMs,
      payload: event,
    });
  }

  async load(orderId: string): Promise<OrderLifecycleState | null> {
    const events = (await this.log.readAll())
      .filter((entry) => entry.eventType.startsWith('ORDER_LIFECYCLE:'))
      .map((entry) => entry.payload as OrderEvent)
      .filter((event) => event.orderId === orderId)
      .sort((a, b) => a.seq - b.seq);
    if (events.length === 0) return null;
    const [created, ...rest] = events;
    if (created.type !== 'ORDER_CREATED') throw new Error('ORDER_LIFECYCLE_MISSING_CREATE');
    let state = createLifecycleState(created);
    for (const event of rest) state = applyOrderEvent(state, event);
    return state;
  }

  async verify(): Promise<void> {
    await this.log.verifyChain();
  }
}
