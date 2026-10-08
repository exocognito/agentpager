import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { AccountsScreen } from "./AccountsScreen.tsx";
const meta={title:"v2/Accounts draft",component:AccountsScreen} satisfies Meta<typeof AccountsScreen>;export default meta;type Story=StoryObj<typeof meta>;
export const Overview:Story={};
export const SignInNotChosen:Story={play:async({canvas,userEvent})=>{await userEvent.click(canvas.getByRole("button",{name:"Sign in"}));await expect(canvas.getByRole("status")).toHaveTextContent("Account sign-in is not available yet");}};
