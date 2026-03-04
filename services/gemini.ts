import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

/**
 * Detects if a user message requires web search.
 * Uses a fast, low-token prompt to classify the need for real-time information.
 */
async function requiresWebSearch(message: string): Promise<boolean> {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Does the following query require real-time web search or recent news to answer accurately? Answer only "YES" or "NO". Query: "${message}"`,
      config: {
        temperature: 0.1, // Low temperature for deterministic classification
        maxOutputTokens: 5 // We only need "YES" or "NO"
      }
    });
    
    const answer = response.text?.trim().toUpperCase();
    return answer === 'YES';
  } catch (error) {
    console.error('Error detecting web search need:', error);
    return false; // Default to no search on error to save tokens
  }
}

/**
 * Generates a chat response using Gemini 2.5 Flash Lite.
 * Orchestrates reasoning, legal drafting, and optional web search.
 */
export async function generateChatResponse(message: string): Promise<string> {
  // 1. Determine if web search is needed
  const needsSearch = await requiresWebSearch(message);
  
  // 2. Configure the model call
  const config: any = {
    temperature: 0.7, // Balanced for reasoning and creativity in legal drafting
    maxOutputTokens: 1024, // Reasonable limit to optimize token cost
    systemInstruction: `You are an expert legal AI assistant. Provide clear, accurate, and professional legal drafting and advice. Reason step-by-step before providing the final answer.`
  };

  // 3. Enable built-in Google Search grounding if needed
  if (needsSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  // 4. Call the model with a timeout
  try {
    const ai = getAiClient();
    // We use Promise.race to implement a timeout for the Gemini API call
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Gemini API timeout')), 25000)
    );
    
    const apiCallPromise = ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: message,
      config
    });

    const response = await Promise.race([apiCallPromise, timeoutPromise]);
    
    if (!response.text) {
      throw new Error('Empty response from Gemini');
    }
    
    return response.text;
  } catch (error) {
    console.error('Gemini Generation Error:', error);
    throw new Error('Failed to generate response from AI orchestrator');
  }
}
