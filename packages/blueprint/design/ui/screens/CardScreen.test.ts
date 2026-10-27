import { createActor } from "xstate";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { expect, it } from "vitest";
import { createCardMachine } from "../../machines/cards.ts";
import { createCardServices } from "../fixtures/services.ts";
import { inbox, question, feedbackDecision, NOW, pairingInbox, pairingDecision } from "../fixtures/decisions.ts";
import { CardScreen } from "./CardScreen.tsx";
import { optionMark } from "../components/cards/schemas.ts";

it("shows an explicit busy state while ending the session", () => {
  const machine = createCardMachine(createCardServices(inbox).layer);
  const snapshot = machine.resolveState({
    value: { live: { screen: "ending", clock: "counting" } },
    context: { ...createActor(machine).getSnapshot().context, inbox },
  });
  const html = renderToStaticMarkup(
    createElement(CardScreen, { snapshot, send: () => {} }),
  );
  expect(html).toMatch(/<button class="ap-primary ap-danger" disabled="">Ending…<\/button>/);
});

it("marks the card UI so its styles stay scoped to it", () => {
  const machine = createCardMachine(createCardServices(inbox).layer);
  const snapshot = machine.resolveState({
    value: { live: { screen: "queue", clock: "counting" } },
    context: { ...createActor(machine).getSnapshot().context, inbox },
  });
  const html = renderToStaticMarkup(
    createElement(CardScreen, { snapshot, send: () => {} }),
  );
  expect(html).toContain('class="ap-app ap-rich"');
});

it('tells the owner who ended the session',()=>{
 const machine=createCardMachine(createCardServices(inbox).layer);
 for(const endedBy of ['owner','agent'] as const){
  const snapshot=machine.resolveState({value:'ended',context:{...createActor(machine).getSnapshot().context,inbox:null,endedBy}});
  const html=renderToStaticMarkup(createElement(CardScreen,{snapshot,send:()=>{}}));
  expect(html).toContain(endedBy==='owner'?'You ended this session.':'Your agent ended this session before you paired.');
 }
});


const viewing = (decision = question) => {
  const machine = createCardMachine(createCardServices(inbox).layer);
  const snapshot = machine.resolveState({
    value: { live: { screen: "view", clock: "counting" } },
    context: { ...createActor(machine).getSnapshot().context, inbox, viewing: decision.decisionId },
  });
  return renderToStaticMarkup(createElement(CardScreen, { snapshot, send: () => {} }));
};

it("shows the offered number in each option", () => {
  const html = viewing();
  for (const option of question.card.options) {
    expect(html).toContain(`<strong>${option.title}</strong>`);
  }
});

it("names each choice with its offered number", () => {
  const html = viewing();
  for (const option of question.card.options) {
    expect(html).toContain(`aria-label="Choose ${option.number}: ${option.title}"`);
  }
});

it("offers Ask for changes after Send on every card kind", () => {
  for (const decision of inbox.open) {
    const html = viewing(decision);
    expect(html.indexOf("Ask for changes")).toBeGreaterThan(html.indexOf(">Send<"));
  }
});

it("shows the detail under the title, with no info control", () => {
  const dialog = viewing().split('role="dialog"')[1];
  expect(dialog).toContain(question.detail!);
  expect(dialog.indexOf(question.detail!)).toBeGreaterThan(dialog.indexOf(question.title));
  expect(dialog).not.toContain('aria-label="About this decision"');
});

it.each([false, true])("shows acknowledgement state on feedback history (acknowledged=%s)", (acknowledged) => {
  const decision = {
    ...feedbackDecision,
    ...(acknowledged ? { acknowledgement: {
      decisionId: feedbackDecision.decisionId,
      answerId: feedbackDecision.answer!.answerId,
      nextSteps: "I will revise the proposal.",
      acknowledgedAt: NOW,
    } } : {}),
  };
  const value = { ...inbox, history: [decision] };
  const machine = createCardMachine(createCardServices(value).layer);
  const snapshot = machine.resolveState({
    value: { live: { screen: "queue", clock: "counting" } },
    context: { ...createActor(machine).getSnapshot().context, inbox: value },
  });
  const html = renderToStaticMarkup(createElement(CardScreen, { snapshot, send: () => {} }));
  expect(html).toContain(acknowledged ? "<small>Asked for changes</small>" : "<small>Asked for changes · Waiting for your agent</small>");
});

it("marks each history row with the chosen option's emoji and names its title", () => {
  const machine = createCardMachine(createCardServices(inbox).layer);
  const snapshot = machine.resolveState({
    value: { live: { screen: "queue", clock: "counting" } },
    context: { ...createActor(machine).getSnapshot().context, inbox },
  });
  const html = renderToStaticMarkup(createElement(CardScreen, { snapshot, send: () => {} }));
  const [first] = inbox.history;
  const option = first.card.options.find((o) => first.answer?.choice.kind === "option" && o.number === first.answer.choice.number)!;
  expect(html).toContain(`<span class="ap-mark" aria-hidden="true">${optionMark(option)}</span>`);
  expect(html).toMatch(new RegExp(`<small>${option.title}( · Waiting for your agent)?</small>`));
});

it("offers no feedback on the pairing card and shows no expiry before pairing", () => {
  const machine = createCardMachine(createCardServices(pairingInbox).layer);
  const snapshot = machine.resolveState({
    value: { live: { screen: "view", clock: "unpaired" } },
    context: { ...createActor(machine).getSnapshot().context, inbox: pairingInbox, viewing: pairingDecision.decisionId },
  });
  const html = renderToStaticMarkup(createElement(CardScreen, { snapshot, send: () => {} }));
  expect(html).not.toContain("Ask for changes");
  expect(html).not.toContain("Session expires");
  expect(html).not.toContain("Short exchange");
});

it('keeps a finished session readable and shows its open cards as unanswerable',()=>{
 const finished={...inbox,session:{...inbox.session,finishedAt:inbox.session.pairedAt}};
 const machine=createCardMachine(createCardServices(finished).layer);
 const base=createActor(machine).getSnapshot().context;
 const queue=renderToStaticMarkup(createElement(CardScreen,{snapshot:machine.resolveState({value:{live:{screen:'queue',clock:'counting'}},context:{...base,inbox:finished}}),send:()=>{}}));
 expect(queue).toContain('Your agent finished this session.');
 expect(queue).toContain(finished.history[0].title);
 const card=renderToStaticMarkup(createElement(CardScreen,{snapshot:machine.resolveState({value:{live:{screen:'view',clock:'counting'}},context:{...base,inbox:finished,viewing:finished.open[0].decisionId}}),send:()=>{}}));
 expect(card).toContain('This card can no longer be answered.');
 expect(card).not.toContain('>Send<');
});
