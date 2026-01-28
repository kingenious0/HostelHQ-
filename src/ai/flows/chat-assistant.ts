import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getHostels, getHostel } from '@/lib/data';
import { HOSTELHQ_KNOWLEDGE, HOSTIE_PERSONALITY } from '@/ai/knowledge-base';

// --- Tools ---

const searchHostelsTool = ai.defineTool(
  {
    name: 'searchHostels',
    description: 'Search for hostels by location, price, institution, or gender.',
    inputSchema: z.object({
      location: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      institution: z.string().optional(),
      gender: z.string().optional(),
    }),
    outputSchema: z.array(z.any()),
  },
  async (input) => {
    console.log('[AI Tool] Searching hostels with input:', input);
    const hostels = await getHostels({
      location: input.location,
      institution: input.institution,
      gender: input.gender,
    });

    // Filter by price if provided since getHostels doesn't support it directly
    return hostels.filter(h => {
      const minMatch = input.minPrice ? h.priceRange.min >= input.minPrice : true;
      const maxMatch = input.maxPrice ? h.priceRange.max <= input.maxPrice : true;
      return minMatch && maxMatch;
    }).slice(0, 5); // Return top 5 matches
  }
);

const getHostelDetailsTool = ai.defineTool(
  {
    name: 'getHostelDetails',
    description: 'Get detailed information about a specific hostel by its ID.',
    inputSchema: z.object({
      hostelId: z.string(),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    console.log('[AI Tool] Fetching hostel details for:', input.hostelId);
    return await getHostel(input.hostelId);
  }
);

// --- Prompt ---

const ChatAssistantInputSchema = z.object({
  message: z.string().describe('The user\'s message or question'),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
  userContext: z
    .object({
      isLoggedIn: z.boolean().optional(),
      currentPage: z.string().optional(),
      hostelId: z.string().optional(),
      roomId: z.string().optional(),
    })
    .optional(),
});

const ChatAssistantOutputSchema = z.object({
  response: z.string().describe('The AI assistant\'s response to the user'),
  suggestedActions: z
    .array(
      z.object({
        label: z.string(),
        action: z.string(),
        url: z.string().optional(),
      })
    )
    .optional(),
});

const prompt = ai.definePrompt({
  name: 'chatAssistantPrompt',
  model: 'googleai/gemini-2.0-flash',
  config: {
    temperature: 0.5,
  },
  input: { schema: ChatAssistantInputSchema },
  output: { schema: ChatAssistantOutputSchema },
  tools: [searchHostelsTool, getHostelDetailsTool],
  prompt: `You are Hostie, the helpful AI assistant for HostelHQ.
  
  **About HostelHQ:**
  ${HOSTELHQ_KNOWLEDGE.platform.description}
  
  **How to help:**
  - If they want to find hostels, use 'searchHostels'.
  - If they want details about a hostel, use 'getHostelDetails'.
  - Provide friendly, clear advice based on the HostelHQ Knowledge Base.
  
  **Context:**
  - Current Page: {{userContext.currentPage}}
  {{#if userContext.hostelId}} - Viewing Hostel: {{userContext.hostelId}}{{/if}}
  
  **History:**
  {{#each conversationHistory}}
  {{role}}: {{content}}
  {{/each}}
  
  **User:** {{{message}}}
  
  **JSON Output:**
  Respond with a JSON object containing:
  - "response": your message to the user
  - "suggestedActions": array of {label, action, url} (optional)`,
});

// --- Flow ---

export const chatAssistantFlow = ai.defineFlow(
  {
    name: 'chatAssistantFlow',
    inputSchema: ChatAssistantInputSchema,
    outputSchema: ChatAssistantOutputSchema,
  },
  async (input) => {
    try {
      console.log('Running chatAssistantFlow with message:', input.message);
      const { output } = await prompt(input);
      console.log('AI Response generated successfully');
      return output!;
    } catch (error) {
      console.error('Error in chatAssistantFlow:', error);
      throw error;
    }
  }
);

export async function chatAssistant(input: z.infer<typeof ChatAssistantInputSchema>) {
  return await chatAssistantFlow(input);
}


