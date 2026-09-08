import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type ImmutableEvent = {
  sequence: number;
  eventType: string;
  eventTimeMs: number;
  receivedAtMs: number;
  payload: unknown;
  previousHash: string;
  hash: string;
};

export class ImmutableEventLog {
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async append(event: Omit<ImmutableEvent, 'sequence' | 'previousHash' | 'hash'>): Promise<ImmutableEvent> {
    const run = this.writeQueue.then(async () => {
      const current = await this.readAll();
      const previous = current.at(-1);
      const next: Omit<ImmutableEvent, 'hash'> = {
        ...event,
        sequence: (previous?.sequence ?? 0) + 1,
        previousHash: previous?.hash ?? 'GENESIS',
      };
      const hash = createHash('sha256').update(JSON.stringify(next)).digest('hex');
      const complete = { ...next, hash };
      await mkdir(dirname(this.filePath), { recursive: true });
      const handle = await open(this.filePath, 'a');
      try {
        await handle.writeFile(`${JSON.stringify(complete)}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      return complete;
    });
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  async readAll(): Promise<ImmutableEvent[]> {
    try {
      const text = await readFile(this.filePath, 'utf8');
      return text.trim() ? text.trim().split('\n').map((line: string) => JSON.parse(line) as ImmutableEvent) : [];
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return [];
      throw error;
    }
  }

  async verifyChain(): Promise<void> {
    const events = await this.readAll();
    let previousHash = 'GENESIS';
    let expectedSequence = 1;
    for (const event of events) {
      if (event.sequence !== expectedSequence || event.previousHash !== previousHash) throw new Error('IMMUTABLE_EVENT_CHAIN_BROKEN');
      const { hash: _hash, ...payload } = event;
      const expectedHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      if (expectedHash !== event.hash) throw new Error('IMMUTABLE_EVENT_HASH_MISMATCH');
      previousHash = event.hash;
      expectedSequence += 1;
    }
  }
}
