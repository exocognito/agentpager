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

it("On dev.agentpager.me the front page says it is a dev server; on agentpager.me and local servers it does not", () => {
  const page = (host: string) => renderToStaticMarkup(createElement(MarketingScreen, { host }));
  for (const host of ["dev.agentpager.me", "DEV.agentpager.me", "dev.example.com"]) {
    expect(page(host)).toContain(`<p class="mk-dev" role="note"><strong>dev</strong>This is ${host}, a dev server for testing AgentPager, not agentpager.me.</p>`);
  }
  // The catalogue draws the page from a local server, so none of these is marked.
  for (const host of ["agentpager.me", "", "127.0.0.1", "localhost", "192.168.1.20", "devbox.local", "pager.dev.example.com"]) {
    expect(page(host), host).not.toContain("mk-dev");
  }
});
