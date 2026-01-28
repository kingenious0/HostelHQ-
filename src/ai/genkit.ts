import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { groq } from 'genkitx-groq';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
    }),
    groq({
      apiKey: process.env.GROQ_API_KEY,
    })
  ],
});

console.log('Genkit AI: Native Groq and Google AI integrated.');
