'use server';

/**
 * @fileOverview AI Chat Assistant for HostelHQ that helps users with hostel-related questions,
 * booking assistance, and general support.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatAssistantInputSchema = z.object({
  message: z.string().describe('The user\'s message or question'),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional()
    .describe('Previous conversation history for context'),
  userContext: z
    .object({
      isLoggedIn: z.boolean().optional(),
      currentPage: z.string().optional(),
      hostelId: z.string().optional(),
      roomId: z.string().optional(),
    })
    .optional()
    .describe('Current user context and page information'),
});

export type ChatAssistantInput = z.infer<typeof ChatAssistantInputSchema>;

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
    .optional()
    .describe('Suggested actions the user can take'),
});

export type ChatAssistantOutput = z.infer<typeof ChatAssistantOutputSchema>;

export async function chatAssistant(
  input: ChatAssistantInput
): Promise<ChatAssistantOutput> {
  return chatAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatAssistantPrompt',
  input: {schema: ChatAssistantInputSchema},
  output: {schema: ChatAssistantOutputSchema},
  prompt: `You are HostelHQ Assistant, a helpful AI assistant for HostelHQ - Ghana's trusted student housing platform. You help students find, book, and secure hostel accommodations.

**Your Role & Personality:**
- Friendly, knowledgeable, and supportive
- Focused on helping Ghanaian students with accommodation needs
- Provide clear, actionable advice
- Always prioritize user safety and verified information

**Key Information about HostelHQ:**
- Platform for Ghanaian students to find trusted hostels
- Serves 5+ cities, 70+ verified hostels, 20K+ students
- Features: transparent pricing, digital tenancy, roommate matching
- Process: Browse → Visit → Book → Secure → Move In
- 24/7 support available

**What you can help with:**
1. **Hostel Search & Discovery**
   - Finding hostels by location, price, amenities
   - Explaining room types and features
   - Comparing different options

2. **Booking Process**
   - How to book a visit
   - Securing a room after visit
   - Payment processes and options
   - Required documents

3. **Room & Amenities**
   - Explaining room features and amenities
   - Occupancy and availability
   - Gender-specific accommodations

4. **General Support**
   - Platform navigation
   - Account management
   - Troubleshooting issues

**Current Context:**
{{#if userContext}}
- User logged in: {{userContext.isLoggedIn}}
- Current page: {{userContext.currentPage}}
{{#if userContext.hostelId}}
- Viewing hostel: {{userContext.hostelId}}
{{/if}}
{{#if userContext.roomId}}
- Viewing room: {{userContext.roomId}}
{{/if}}
{{/if}}

**Conversation History:**
{{#if conversationHistory}}
{{#each conversationHistory}}
{{role}}: {{content}}
{{/each}}
{{/if}}

**User Message:** {{{message}}}

**Instructions:**
- Provide helpful, accurate responses about HostelHQ and student housing
- If asked about specific hostels/rooms, reference the current context if available
- Suggest relevant actions when appropriate (e.g., "Book a Visit", "View Hostels")
- For complex issues, recommend contacting support
- Keep responses concise but informative
- Use friendly, conversational tone
- If you don't know something specific, be honest and suggest alternatives

**Response Format:**
- Provide a helpful response to the user's question
- Include suggested actions when relevant (max 3 actions)
- Actions should have clear labels and appropriate URLs when applicable`,
});

const chatAssistantFlow = ai.defineFlow(
  {
    name: 'chatAssistantFlow',
    inputSchema: ChatAssistantInputSchema,
    outputSchema: ChatAssistantOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
