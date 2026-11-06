import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { Schema } from "effect";
import { AskInput, CLIENT_HEADER, PROTOCOL, QuestionInput, clientVersion, readClientVersion } from "./exchange.ts";

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

it("the UI tests' agent names the same header and protocol as the command", () => {
  const harness = swift("AgentPagerUITests/AgentHarness.swift");
  expect(harness).toContain(`static let clientHeader = "${CLIENT_HEADER}"`);
  const sent = harness.match(/static let clientVersion = "([^"]+)"/)?.[1] ?? "";
  expect(readClientVersion(sent)?.protocol).toBe(PROTOCOL);
  expect(harness).toContain("var headers = [\"content-type\": \"application/json\", Self.clientHeader: Self.clientVersion]");
});

it("reads a client's header as its name, protocol and build, and nothing else", () => {
  expect(readClientVersion(clientVersion("cli", "3f9c2ab"))).toEqual({ client: "cli", protocol: PROTOCOL, build: "3f9c2ab" });
  expect(readClientVersion(clientVersion("cli", "dev"))).toEqual({ client: "cli", protocol: PROTOCOL, build: "dev" });
  // A build that doesn't fit is sent with its other characters replaced, never as a header the service can't read.
  expect(readClientVersion(clientVersion("cli", "a b/c"))?.build).toBe("a-b-c");
  expect(readClientVersion(clientVersion("cli", ""))?.build).toBe("-");
  for (const bad of [null, "", "cli", "cli/1", "cli/one dev", "CLI/1 dev", "cli/01 dev", "cli/1  dev", "cli/1 dev extra", "cli/1 " + "x".repeat(41), "cli/1234567 dev"]) {
    expect(readClientVersion(bad)).toBeNull();
  }
});

it("asks under a decision id the agent chose; the question itself is unchanged", () => {
  const card = { type: "brief", recommended: 1, options: [{ number: 1, title: "First", prioritizes: "speed" }, { number: 2, title: "Second", prioritizes: "safety" }], markdown: "## Options\n\n## Recommendation: A\n**Why:** It is quick.\n" };
  const question = { title: "Which?", card };
  expect(Schema.is(QuestionInput)(question)).toBe(true);
  expect(Schema.is(AskInput)(question)).toBe(false);
  expect(Schema.is(AskInput)({ decisionId: "d".repeat(32), ...question })).toBe(true);
  expect(Schema.is(AskInput)({ decisionId: "short", ...question })).toBe(false);
  expect(() => Schema.decodeUnknownSync(QuestionInput, { onExcessProperty: "error" })({ decisionId: "d".repeat(32), ...question })).toThrow();
});
