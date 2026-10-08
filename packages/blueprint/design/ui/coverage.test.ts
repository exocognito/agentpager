import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createCardMachine } from "../machines/cards.ts";
import { createHomeMachine } from "../machines/home.ts";
import { createCardServices } from "./fixtures/services.ts";
import { createHomeServices } from "./fixtures/home.ts";
import { inbox } from "./fixtures/decisions.ts";

it("has a screen story for every visible leaf of the phone's machines and no invented state", () => {
  const machines = [createCardMachine(createCardServices(inbox).layer), createHomeMachine(createHomeServices([]).layer)];
  const leaves: string[] = [];
  function walk(node: (typeof machines)[number]["root"]) {
    const children = Object.values(node.states);
    if (
      children.length === 0 &&
      !(node.always?.length && node.transitions.size === 0)
    )
      leaves.push(node.id);
    children.forEach(walk);
  }
  machines.forEach((machine) => walk(machine.root));
  const directory = fileURLToPath(new URL(".", import.meta.url));
  const tags = globSync("**/*.stories.tsx", { cwd: directory }).flatMap(
    (file) =>
      [
        ...readFileSync(`${directory}/${file}`, "utf8").matchAll(
          /["']state:([A-Za-z0-9_.]+)["']/g,
        ),
      ].map((match) => match[1]),
  );
  expect(leaves.length).toBeGreaterThan(0);
  expect([...new Set(tags)].sort()).toEqual(leaves.sort());
});
