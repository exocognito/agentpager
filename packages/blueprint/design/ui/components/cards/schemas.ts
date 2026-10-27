import { Schema } from "effect";
import type { Choice } from "../../../schemas/exchange.ts";
import * as generic from "./generic/schema.ts";
import * as brief from "./brief/schema.ts";

// Each kind is one folder here. In `generic` the decision's title and detail carry the question; in `brief` a
// Markdown brief carries it, with lettered options.
export const schemas = {
  generic,
  brief,
};
export const Card = Schema.Union(
  ...Object.values(schemas).map((s) => s.Payload),
);
export type Card = typeof Card.Type;
export const CardKind = Schema.Literal(
  ...(Object.keys(schemas) as (keyof typeof schemas)[]),
);
export type CardKind = typeof CardKind.Type;

// Check registration keys against payload discriminants without widening the schemas.
schemas satisfies {
  [K in CardKind]: { Payload: { readonly Type: { readonly type: K } } };
};

export const acceptsChoice = (card: Card, choice: Choice) =>
  choice.kind === "feedback" ||
  card.options.some((option) => option.number === choice.number);

// What tells options apart on a screen: a generic option's emoji, or a brief option's letter; and the line under it.
type CardOption = Card["options"][number];
export const optionMark = (option: CardOption) => "prioritizes" in option ? brief.letter(option.number) : option.emoji;
export const optionDetail = (option: CardOption) => "prioritizes" in option ? `Prioritizes ${option.prioritizes}` : option.detail;
