import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { AgentFinished, SessionEnded, type SessionStoreService } from './session.ts';
import type { CardApiService } from './cards.ts';

const endedAt = '2026-09-29T14:00:00Z';

// Checked by pnpm check; invalid calls remain unexecuted.
function checkEndedErrors() {
  // @ts-expect-error An ended response identifies who ended it.
  new SessionEnded({ endedAt });
  // @ts-expect-error A finished response says when.
  new AgentFinished({});
  const finished = new AgentFinished({ finishedAt: endedAt });
  // Every agent call after finishing is refused as finished.
  const agentStatusError: Effect.Effect.Error<ReturnType<SessionStoreService['agentStatus']>> = finished;
  const askError: Effect.Effect.Error<ReturnType<SessionStoreService['askCard']>> = finished;
  const readAnswerError: Effect.Effect.Error<ReturnType<SessionStoreService['readCardAnswer']>> = finished;
  const acknowledgeError: Effect.Effect.Error<ReturnType<SessionStoreService['acknowledgeCard']>> = finished;
  // The phone can still read a finished session; only answering is refused.
  // @ts-expect-error Reading cards never answers AgentFinished.
  const phoneReadError: Effect.Effect.Error<ReturnType<SessionStoreService['readCards']>> = finished;
  const phoneAnswerError: Effect.Effect.Error<ReturnType<SessionStoreService['answerCard']>> = finished;
  const phoneAdapterAnswerError: Effect.Effect.Error<ReturnType<CardApiService['answerCard']>> = finished;
  return { agentStatusError, askError, readAnswerError, acknowledgeError, phoneReadError, phoneAnswerError, phoneAdapterAnswerError };
}

void checkEndedErrors;

describe('ended and finished responses', () => {
  it('name who ended the session, or when the agent finished', () => {
    expect(new SessionEnded({ endedAt, endedBy: 'owner' })).toMatchObject({ _tag: 'SessionEnded', endedAt, endedBy: 'owner' });
    expect(new AgentFinished({ finishedAt: endedAt })).toMatchObject({ _tag: 'AgentFinished', finishedAt: endedAt });
  });
});
