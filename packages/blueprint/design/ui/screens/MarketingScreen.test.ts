import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MARKETING, MarketingScreen } from "./MarketingScreen.tsx";
import { CARD_AGENT_INSTRUCTION } from "./StartScreen.tsx";

it("offers the agent instruction that points at the one start document", () => {
  const html = renderToStaticMarkup(createElement(MarketingScreen));
  expect(CARD_AGENT_INSTRUCTION).toBe("Connect AgentPager at agentpager.me/start");
  expect(html).toContain(CARD_AGENT_INSTRUCTION);
  expect(html).toContain("Copy the agent instruction");
  expect(html).toContain(MARKETING.headline);
});
