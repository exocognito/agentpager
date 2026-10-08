import { Schema } from "effect";
import type { Choice } from "../../../schemas/exchange.ts";
import * as generic from "./generic/schema.ts";

// Each kind is one folder here. `generic` is the only one: the decision's title and detail carry the question.
export const schemas = {
  generic,
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
