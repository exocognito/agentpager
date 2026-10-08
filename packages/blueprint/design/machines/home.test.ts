import { afterEach, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import { createHomeMachine } from "./home.ts";
import { connectIds, connectIdsInTurn, createHomeServices, endedRow, joinedRow, liveRow } from "../ui/fixtures/home.ts";
import { PHONE_POLL_MS } from "../schemas/exchange.ts";

afterEach(() => vi.useRealTimers());

it("lists the stored sessions, and opens and closes the connect sheet", async () => {
  vi.useFakeTimers();
  const f = createHomeServices([liveRow, endedRow]);
  const actor = createActor(createHomeMachine(f.layer)).start();
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().matches({ list: "browse" })).toBe(true);
    expect(actor.getSnapshot().context.sessions).toEqual([liveRow, endedRow]);
    actor.send({ type: "CONNECT" });
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().matches({ list: { connect: "listening" } })).toBe(true);
    expect(actor.getSnapshot().context.connectId).not.toBeNull();
    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().matches({ list: "browse" })).toBe(true);
    expect(actor.getSnapshot().context.connectId).toBeNull();
  } finally {
    actor.stop();
  }
});

it("keeps the last rows and marks them stale when a poll fails, then recovers", async () => {
  vi.useFakeTimers();
  const f = createHomeServices([liveRow]);
  const actor = createActor(createHomeMachine(f.layer)).start();
  try {
    await vi.advanceTimersByTimeAsync(0);
    f.fail(true);
    await vi.advanceTimersByTimeAsync(PHONE_POLL_MS);
    expect(actor.getSnapshot().context).toMatchObject({ stale: true, sessions: [liveRow] });
    f.fail(false);
    f.set([{ ...liveRow, openCount: 0 }]);
    await vi.advanceTimersByTimeAsync(PHONE_POLL_MS);
    expect(actor.getSnapshot().context.stale).toBe(false);
    expect(actor.getSnapshot().context.sessions?.[0]).toMatchObject({ openCount: 0 });
  } finally {
    actor.stop();
  }
});

it("shows a failed first load, and Retry reads again", async () => {
  vi.useFakeTimers();
  const f = createHomeServices([liveRow]);
  f.fail(true);
  const actor = createActor(createHomeMachine(f.layer)).start();
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().value).toBe("failed");
    f.fail(false);
    actor.send({ type: "RETRY" });
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().matches("list")).toBe(true);
  } finally {
    actor.stop();
  }
});

it("registers one connect id, replaces a failed one until one registers, and offers the session an agent makes", async () => {
  vi.useFakeTimers();
  const f = createHomeServices([liveRow]);
  const actor = createActor(createHomeMachine(f.layer, connectIdsInTurn())).start();
  try {
    await vi.advanceTimersByTimeAsync(0);
    f.fail(true);
    actor.send({ type: "CONNECT" });
    // Nothing goes on screen until the server has the id.
    expect(actor.getSnapshot().context).toMatchObject({ connectId: null, trying: connectIds[0] });
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().context).toMatchObject({ connectId: null, offline: true });
    // A reply for another id cannot speak for the one being tried.
    actor.send({ type: "CONNECT_OPENED", connectId: connectIds[1] });
    expect(actor.getSnapshot().context.connectId).toBeNull();
    f.fail(false);
    await vi.advanceTimersByTimeAsync(PHONE_POLL_MS);
    expect(actor.getSnapshot().context).toMatchObject({ connectId: connectIds[1], offline: false });
    expect(f.opened()).toEqual([connectIds[1]]);
    // Once one registers, the sheet keeps it.
    await vi.advanceTimersByTimeAsync(PHONE_POLL_MS * 5);
    expect(f.opened()).toEqual([connectIds[1]]);
    expect(actor.getSnapshot().context.connectId).toBe(connectIds[1]);
    // A session already held when the sheet opened is not the one that joined.
    f.join();
    await vi.advanceTimersByTimeAsync(PHONE_POLL_MS);
    expect(actor.getSnapshot().matches({ list: { connect: "opening" } })).toBe(true);
    expect(actor.getSnapshot().context.joined).toEqual(joinedRow);
    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().context).toMatchObject({ connectId: null, joined: null });
  } finally {
    actor.stop();
  }
});
