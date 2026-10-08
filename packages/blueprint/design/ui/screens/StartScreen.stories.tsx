import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MCP_TOOLS } from '../../schemas/exchange.ts';
import { HTTP_STATUS, ROUTES } from '../../effects/session.ts';
import { START, StartScreen, startDocument } from './StartScreen.tsx';
const meta = { title: 'v1/Start', component: StartScreen } satisfies Meta<typeof StartScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

// Not a machine state: /start has no machine. The owner reviews the words here; an agent reads the same document as text.
export const Start: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(START.title);
    const document = startDocument();
    for (const route of Object.values(ROUTES)) if (route.caller.includes('agent')) expect(document).toContain(`${route.method} ${route.path}`);
    for (const name of Object.keys(MCP_TOOLS)) expect(document).toContain(`| ${name} |`);
    for (const [tag, status] of Object.entries(HTTP_STATUS)) expect(document).toContain(`| ${tag} | ${status} |`);
    for (const line of START.conduct) expect(document).toContain(line);
    expect(startDocument('http://127.0.0.1:8787')).toContain('http://127.0.0.1:8787/mcp');
    expect(startDocument('http://127.0.0.1:8787')).not.toContain('https://agentpager.me/api');
  },
};
