import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { llama33x70bVersatile } from 'genkitx-groq';
import { getHostels, getHostel } from '@/lib/data';
import { HOSTELHQ_KNOWLEDGE, HOSTIE_PERSONALITY } from '@/ai/knowledge-base';

// --- Tools ---

const searchHostelsTool = ai.defineTool(
  {
    name: 'searchHostels',
    description: 'Search for hostels by location, price, institution, or gender.',
    inputSchema: z.object({
      location: z.string().optional(),
      minPrice: z.coerce.number().optional(),
      maxPrice: z.coerce.number().optional(),
      institution: z.string().optional(),
      gender: z.string().optional(),
    }),
    outputSchema: z.array(z.any()),
  },
  async (input) => {
    console.log('[AI Tool] Searching hostels with input:', input);

    const hostels = await getHostels({
      location: input.location?.trim() || undefined,
      institution: input.institution?.trim() || undefined,
      gender: input.gender?.trim() || undefined,
    });

    // Filter by price if provided
    return hostels.filter(h => {
      const minMatch = input.minPrice !== undefined ? h.priceRange.min >= input.minPrice : true;
      const maxMatch = input.maxPrice !== undefined ? h.priceRange.max <= input.maxPrice : true;
      return minMatch && maxMatch;
    }).slice(0, 5);
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
  model: llama33x70bVersatile,
  input: { schema: ChatAssistantInputSchema },
  output: { schema: ChatAssistantOutputSchema },
  tools: [searchHostelsTool, getHostelDetailsTool],
  prompt: `You are Hostie, the helpful AI assistant for HostelHQ.
  
  **About HostelHQ:**
  ${HOSTELHQ_KNOWLEDGE.platform.description}
  
  **Available Tools:**
  - searchHostels: Use this to search for hostels.
  - getHostelDetails: Use this to get full info on a specific hostel.
  
  **Task:**
  1. If the user is asking for hostels or recommendations, use 'searchHostels'.
  2. If the user mentions a specific hostel, use 'getHostelDetails'.
  3. Respond only with a tool call if you need tools.
  4. Once you have tool results, generate a friendly 'response' and provide any 'suggestedActions'.
  5. Your final response MUST be a JSON object matching the required schema.
  
  **Current Context:**
  - Page: {{userContext.currentPage}}
  
  **Conversation History:**
  {{#each conversationHistory}}
  {{role}}: {{content}}
  {{/each}}
  
  **User Message:** {{{message}}}
  `,
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


