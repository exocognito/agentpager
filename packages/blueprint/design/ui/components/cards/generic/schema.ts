import { Schema } from "effect";
import { OptionNumber, Options } from "../../../../schemas/values.ts";

// A question with no product to show: the title and detail carry it.
// `recommended` names the agent's pick; the detail then gives the reason, never a second question.
export const Payload = Schema.Struct({
  type: Schema.Literal("generic"),
  options: Options,
  recommended: Schema.optional(OptionNumber),
}).pipe(Schema.filter((card) => card.recommended === undefined || card.options.some((option) => option.number === card.recommended) || "recommended must name an offered option"));
export type Payload = typeof Payload.Type;
