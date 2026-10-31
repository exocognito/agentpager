import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MARKETING, MarketingScreen } from "./MarketingScreen.tsx";

it("offers the agent instruction that points at the one start document", () => {
  const html = renderToStaticMarkup(createElement(MarketingScreen));
  expect(MARKETING.instruction).toBe("Connect AgentPager at agentpager.me/start");
  expect(html).toContain(MARKETING.instruction);
  expect(html).toContain("Copy the agent instruction");
  expect(html).toContain(MARKETING.headline);
});

it("sends the owner to the iPhone app, never to a web app", () => {
  const html = renderToStaticMarkup(createElement(MarketingScreen));
  expect(html).toContain(MARKETING.ctaButton);
  // The phone picture still draws the card screen's back link; no button on the page leads to a web app.
  expect(html).not.toMatch(/class="mk-(?:button|action)[^"]*" href="\/app"/);
});
