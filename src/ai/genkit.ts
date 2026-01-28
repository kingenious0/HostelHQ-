import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
  })],
});

// Log the API key status for debugging (without exposing the key)
console.log('Genkit AI Configuration status:');
console.log('- GEMINI_API_KEY:', !!process.env.GEMINI_API_KEY);
console.log('- GOOGLE_GENAI_API_KEY:', !!process.env.GOOGLE_GENAI_API_KEY);
console.log('- GOOGLE_API_KEY:', !!process.env.GOOGLE_API_KEY);
console.log('- Final API Key determined:', !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY));

