import { mkdir, open, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertIntentTransition, isTerminalIntentState, type IntentState } from './intent-state-machine.js';

export type IntentRecord = {
  intentId: string;
  idempotencyKey: string;
  venueId: string;
  strategyId: string;
  instrumentId: string;
  state: IntentState;
  createdAt: string;
  updatedAt: string;
};

type JournalEntry = {
  kind: 'INTENT_STATE';
  intent: IntentRecord;
  previousState: IntentState | null;
};

export type IntentStore = {
  append(entry: JournalEntry): Promise<void>;
  get(intentId: string): Promise<IntentRecord | null>;
  listNonTerminal(): Promise<IntentRecord[]>;
  listNonTerminalForInstrument(instrumentId: string): Promise<IntentRecord[]>;
};

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Append-only durable journal. A complete intent + state transition is one
 * physical journal record, then fsync() is issued before returning. This is a
 * persistence primitive, not a database; production deployment still needs
 * filesystem durability characteristics to be validated for the target host.
 */
export class FileIntentJournal implements IntentStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async append(entry: JournalEntry): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const handle = await open(this.filePath, 'a');
    try {
      await handle.writeFile(`${JSON.stringify(entry)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async get(intentId: string): Promise<IntentRecord | null> {
    const entries = await this.readEntries();
    let latest: IntentRecord | null = null;
    for (const entry of entries) {
      if (entry.kind === 'INTENT_STATE' && entry.intent.intentId === intentId) {
        latest = entry.intent;
      }
    }
    return latest;
  }

  async listNonTerminal(): Promise<IntentRecord[]> {
    const latest = this.latestByIntent(await this.readEntries());
    return [...latest.values()].filter((intent) => !isTerminalIntentState(intent.state));
  }

  async listNonTerminalForInstrument(instrumentId: string): Promise<IntentRecord[]> {
    const items = await this.listNonTerminal();
    return items.filter((intent) => intent.instrumentId === instrumentId);
  }

  async create(input: Omit<IntentRecord, 'state' | 'createdAt' | 'updatedAt'>, createdAt = nowIso()): Promise<IntentRecord> {
    const existing = await this.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.instrumentId !== input.instrumentId || existing.venueId !== input.venueId) {
        throw new Error('IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_TARGET');
      }
      return existing;
    }
    const intent: IntentRecord = { ...input, state: 'INTENT_CREATED', createdAt, updatedAt: createdAt };
    return this.transition(intent, null, 'DURABLE');
  }

  async transition(intent: IntentRecord, expectedState: IntentState | null, nextState: IntentState, updatedAt = nowIso()): Promise<IntentRecord> {
    if (expectedState !== null && intent.state !== expectedState) {
      throw new Error(`STALE_INTENT_STATE:${intent.state}`);
    }
    assertIntentTransition(intent.state, nextState);
    const next: IntentRecord = { ...intent, state: nextState, updatedAt };
    await this.append({ kind: 'INTENT_STATE', intent: next, previousState: intent.state });
    return next;
  }

  async resumeNonTerminal(intentId: string): Promise<IntentRecord | null> {
    return this.get(intentId);
  }

  private async findByIdempotencyKey(key: string): Promise<IntentRecord | null> {
    const latest = this.latestByIntent(await this.readEntries());
    for (const intent of latest.values()) {
      if (intent.idempotencyKey === key) return intent;
    }
    return null;
  }

  private latestByIntent(entries: JournalEntry[]): Map<string, IntentRecord> {
    const latest = new Map<string, IntentRecord>();
    for (const entry of entries) {
      if (entry.kind === 'INTENT_STATE') latest.set(entry.intent.intentId, entry.intent);
    }
    return latest;
  }

  private async readEntries(): Promise<JournalEntry[]> {
    try {
      const text = await readFile(this.filePath, 'utf8');
      const entries: JournalEntry[] = [];
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        entries.push(JSON.parse(line) as JournalEntry);
      }
      return entries;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'ENOENT') return [];
      throw error;
    }
  }
}
