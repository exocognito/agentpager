import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ProScreen } from "./ProScreen.tsx";
const meta={title:"v3/Pro research preview",component:ProScreen,args:{submitFeedback:async()=>({receiptId:"r".repeat(32)})}} satisfies Meta<typeof ProScreen>;
export default meta;
type Story=StoryObj<typeof meta>;
export const Offer:Story={};
export const BuyThenSurvey:Story={play:async({canvas,userEvent})=>{
 await expect(canvas.queryByText("$2.99 / month")).not.toBeNull();
 await userEvent.click(canvas.getByRole("button",{name:"Buy Pro"}));
 await expect(canvas.getByText(/Pro is not implemented yet/)).toBeVisible();
 await expect(canvas.getByText(/No payment was taken/)).toBeVisible();
 await expect(canvas.getByRole("textbox",{name:"What would a longer session let you do?"})).toBeVisible();
}};
export const ConsentedSubmission:Story={play:async({mount,userEvent})=>{
 const calls:unknown[]=[];const canvas=await mount(<ProScreen submitFeedback={async feedback=>{calls.push(feedback);return {receiptId:'r'.repeat(32)}}}/>);
 await userEvent.click(canvas.getByRole('button',{name:'Buy Pro'}));expect(calls).toHaveLength(0);
 await userEvent.type(canvas.getByRole('textbox',{name:'What would a longer session let you do?'}),'Finish a long research task.');
 await expect(canvas.getByRole('button',{name:'Send feedback'})).toBeDisabled();
 await userEvent.click(canvas.getByRole('checkbox'));expect(calls).toHaveLength(0);
 await userEvent.click(canvas.getByRole('button',{name:'Send feedback'}));
 await expect(await canvas.findByRole('status')).toHaveTextContent('Feedback received');
 expect(calls).toEqual([{interest:'clicked-buy',useCase:'Finish a long research task.',sessionLength:'1–2 days',willingness:'Maybe',consent:true}]);
}};
export const FailedSubmissionKeepsDraft:Story={play:async({mount,userEvent})=>{
 const canvas=await mount(<ProScreen submitFeedback={async()=>{throw new Error('unavailable')}}/>);
 await userEvent.click(canvas.getByRole('button',{name:'Buy Pro'}));
 await userEvent.type(canvas.getByRole('textbox',{name:'What would a longer session let you do?'}),'Finish a long research task.');
 await userEvent.click(canvas.getByRole('checkbox'));await userEvent.click(canvas.getByRole('button',{name:'Send feedback'}));
 await expect(await canvas.findByRole('alert')).toHaveTextContent('not confirmed');
 await expect(canvas.getByRole('textbox',{name:'What would a longer session let you do?'})).toHaveValue('Finish a long research task.');
}};
