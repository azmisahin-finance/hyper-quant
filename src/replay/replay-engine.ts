import type { ImmutableEvent } from '../data/immutable-event-log.js';

export type ReplayReducer<S> = (state: S, event: ImmutableEvent) => S;

export function replayDeterministically<S>(events: readonly ImmutableEvent[], initialState: S, reducer: ReplayReducer<S>): S {
  let state = initialState;
  let expected = 1;
  for (const event of events) {
    if (event.sequence !== expected) throw new Error('REPLAY_SEQUENCE_GAP');
    state = reducer(state, event);
    expected += 1;
  }
  return state;
}
