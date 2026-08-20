'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatInputSchema = z.object({
  message: z.string().describe('The user\'s message or question'),
  context: z.string().optional().describe('Additional context about the user or page'),
});

export type ChatInput = z.infer<typeof ChatInputSchema>;

const ChatOutputSchema = z.object({
  response: z.string().describe('The AI assistant\'s response to the user'),
  actions: z.array(z.object({
    label: z.string(),
    action: z.string(),
    url: z.string().optional(),
  })).optional().describe('Suggested actions for the user'),
});

export type ChatOutput = z.infer<typeof ChatOutputSchema>;

export async function chatAssistantSimple(input: ChatInput): Promise<ChatOutput> {
  return chatAssistantFlow(input);
}

const chatPrompt = ai.definePrompt({
  name: 'chatAssistantPrompt',
  input: {schema: ChatInputSchema},
  output: {schema: ChatOutputSchema},
  prompt: `You are HostelHQ Assistant, a helpful AI for Ghana's trusted student housing platform.

**About HostelHQ:**
- Platform for Ghanaian students to find verified hostels
- Serves 5+ cities, 70+ hostels, 20K+ students  
- Features: transparent pricing, digital tenancy, roommate matching
- Process: Browse → Visit → Book → Secure → Move In

**User Message:** {{{message}}}
{{#if context}}
**Context:** {{{context}}}
{{/if}}

**Your Role:**
- Be friendly, helpful, and knowledgeable about student housing
- Provide clear, actionable advice about HostelHQ
- Focus on helping with booking, payments, amenities, roommates
- Suggest relevant actions when appropriate

**Response Guidelines:**
- Keep responses concise but informative (2-3 sentences max)
- Always include 1-3 helpful action suggestions
- Use friendly, conversational tone
- If unsure, direct to support team

Provide a helpful response and suggest relevant actions.`,
});

const chatAssistantFlow = ai.defineFlow(
  {
    name: 'chatAssistantFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async input => {
    const {output} = await chatPrompt(input);
    return output!;
  }
);
