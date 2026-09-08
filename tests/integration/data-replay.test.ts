import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImmutableEventLog } from '../../src/data/immutable-event-log.js';
import { replayDeterministically } from '../../src/replay/replay-engine.js';

test('immutable event log is hash chained and replay is deterministic', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-data-'));
  try {
    const file = join(root, 'events.jsonl');
    const log = new ImmutableEventLog(file);
    await log.append({ eventType: 'TICKER', eventTimeMs: 1, receivedAtMs: 2, payload: { last: 100 } });
    await log.append({ eventType: 'TICKER', eventTimeMs: 3, receivedAtMs: 4, payload: { last: 101 } });
    await log.verifyChain();
    const events = await log.readAll();
    assert.equal(events.length, 2);
    const final = replayDeterministically(events, 0, (state, event) => state + Number((event.payload as { last: number }).last));
    assert.equal(final, 201);
    const tampered = JSON.stringify({ ...events[0], payload: { last: 999 } });
    const handle = await open(file, 'w');
    try { await handle.writeFile(`${tampered}\n${JSON.stringify(events[1])}\n`, 'utf8'); } finally { await handle.close(); }
    await assert.rejects(() => log.verifyChain(), /IMMUTABLE_EVENT_HASH_MISMATCH/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
