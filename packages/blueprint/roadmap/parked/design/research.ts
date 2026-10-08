import { Schema, Context, Effect } from "effect";
import { Body, Text, Token } from "../../../design/schemas/values.ts";
const Email=Text.pipe(Schema.maxLength(254),Schema.pattern(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/));
export const ResearchFeedback=Schema.Struct({
 interest:Schema.Literal("clicked-buy"),
 useCase:Body,
 sessionLength:Schema.Literal("1–2 days","3–7 days","More than a week"),
 willingness:Schema.Literal("Yes","Maybe","No"),
 contact:Schema.optional(Email),
 consent:Schema.Literal(true),
});
export type ResearchFeedback=typeof ResearchFeedback.Type;
export const FeedbackReceipt=Schema.Struct({receiptId:Token});
export type FeedbackReceipt=typeof FeedbackReceipt.Type;
export interface ResearchFeedbackService {readonly submit:(feedback:ResearchFeedback)=>Effect.Effect<FeedbackReceipt,Error>}
export class ResearchFeedbackApi extends Context.Tag("@agentpager/ResearchFeedbackApi")<ResearchFeedbackApi,ResearchFeedbackService>(){}
export const RESEARCH_ROUTES={pro:{method:"GET",path:"/pro",type:"text/html"},feedback:{method:"POST",path:"/api/research/feedback",type:"application/json"}} as const;
