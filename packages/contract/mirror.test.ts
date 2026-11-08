import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { Schema } from "effect";
import { createHash } from "node:crypto";
import { AskInput, CLIENT_HEADER, CLOSED_AGENT_FINISHED, Closed, PICKUP_PROTOCOL, PROTOCOL, QuestionInput, Token, clientVersion, decisionIdOf, readClientVersion } from "./exchange.ts";

// The iPhone app and its UI tests' agent mirror the client header in Swift (METHOD.md › Design in code): the same
// header, the same protocol, and the app sends it on every request.
const swift = (file: string) => readFileSync(new URL(`../ios/${file}`, import.meta.url), "utf8");

it("the app names the same header and protocol, and sends it on every request", () => {
  const api = swift("AgentPager/Model/API.swift");
  expect(api).toContain(`static let header = "${CLIENT_HEADER}"`);
  expect(api).toContain(`static let protocolNumber = ${PROTOCOL}\n`);
  expect(api).toContain('return "ios/\\(protocolNumber) \\(version)+\\(build)"');
  // Every request goes through raw(), which sets it.
  expect(api.match(/URLRequest\(/g)?.length).toBe(1);
  expect(api).toMatch(/func raw\([^]*?r\.setValue\(ClientVersion\.value, forHTTPHeaderField: ClientVersion\.header\)[^]*?URLSession\.shared\.data\(for: r\)/);
  // The app's build is its version and build numbers, which fit the header.
  expect(readClientVersion(`ios/${PROTOCOL} 0.1+1`)).toEqual({ client: "ios", protocol: PROTOCOL, build: "0.1+1" });
});

// A decision that closed unanswered: the app reads the same field, with the same two fields inside, and knows the one
// reason by the same name. It reads the reason as text, so a reason added later fails no read.
it("the app reads a decision's closed record as the contract sends it", () => {
  const api = swift("AgentPager/Model/API.swift");
  expect(Object.keys(Closed.fields).sort()).toEqual(["at", "reason"]);
  expect(api).toMatch(/struct Closed: Codable, Hashable, Sendable \{\n    static let agentFinished = "([A-Za-z]+)"\n    var at: Date\n    var reason: String\n\}/);
  expect(api.match(/static let agentFinished = "([A-Za-z]+)"/)?.[1]).toBe(CLOSED_AGENT_FINISHED);
  expect(api).toMatch(/struct SealedDecision: Codable, Hashable, Sendable \{[^}]*\n    var closed: Closed\?\n\}/);
});

// It speaks protocol 2, as the m6.1 command did: its reads pick answers up, so the journeys draw what they always did.
it("the UI tests' agent names the same header as the command, and protocol 2", () => {
  const harness = swift("AgentPagerUITests/AgentHarness.swift");
  expect(harness).toContain(`static let clientHeader = "${CLIENT_HEADER}"`);
  const sent = harness.match(/static let clientVersion = "([^"]+)"/)?.[1] ?? "";
  expect(readClientVersion(sent)?.protocol).toBe(PROTOCOL);
  expect(PROTOCOL).toBeLessThan(PICKUP_PROTOCOL);
  expect(harness).toContain("var headers = [\"content-type\": \"application/json\", Self.clientHeader: Self.clientVersion]");
});

it("reads a client's header as its name, protocol and build, and nothing else", () => {
  expect(readClientVersion(clientVersion("cli", "3f9c2ab"))).toEqual({ client: "cli", protocol: PROTOCOL, build: "3f9c2ab" });
  expect(readClientVersion(clientVersion("cli", "dev"))).toEqual({ client: "cli", protocol: PROTOCOL, build: "dev" });
  expect(readClientVersion(clientVersion("cli", "3f9c2ab", PICKUP_PROTOCOL))).toEqual({ client: "cli", protocol: 3, build: "3f9c2ab" });
  // A build that doesn't fit is sent with its other characters replaced, never as a header the service can't read.
  expect(readClientVersion(clientVersion("cli", "a b/c"))?.build).toBe("a-b-c");
  expect(readClientVersion(clientVersion("cli", ""))?.build).toBe("-");
  for (const bad of [null, "", "cli", "cli/1", "cli/one dev", "CLI/1 dev", "cli/01 dev", "cli/1  dev", "cli/1 dev extra", "cli/1 " + "x".repeat(41), "cli/1234567 dev"]) {
    expect(readClientVersion(bad)).toBeNull();
  }
});

it("asks with a request id the agent chose, and never with the question readable", () => {
  const card = { type: "brief", recommended: 1, options: [{ number: 1, title: "First", prioritizes: "speed" }, { number: 2, title: "Second", prioritizes: "safety" }], markdown: "## Options\n\n## Recommendation: A\n**Why:** It is quick.\n" };
  const question = { title: "Which?", card };
  expect(Schema.is(QuestionInput)(question)).toBe(true);
  expect(Schema.is(AskInput)(question)).toBe(false);
  expect(Schema.is(AskInput)({ requestId: "r".repeat(32), ...question })).toBe(false);
  expect(() => Schema.decodeUnknownSync(QuestionInput, { onExcessProperty: "error" })({ requestId: "r".repeat(32), ...question })).toThrow();
});

it("names a decision by its agent and request id: the same pair the same id, another agent another id", async () => {
  const agent = "A".repeat(32), other = "B".repeat(32), request = "r".repeat(32);
  const id = await decisionIdOf(agent, request);
  expect(Schema.is(Token)(id)).toBe(true);
  expect(await decisionIdOf(agent, request)).toBe(id);
  expect(await decisionIdOf(other, request)).not.toBe(id);
  expect(await decisionIdOf(agent, "s".repeat(32))).not.toBe(id);
  // Pinned, so every side that works it out agrees: SHA-256 of "agentpager decision\n<agent>\n<request>", 24 bytes.
  expect(id).toBe(createHash("sha256").update(`agentpager decision\n${agent}\n${request}`).digest().subarray(0, 24).toString("base64url"));
});
