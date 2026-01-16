
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Account } from "../types.ts";

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transactions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "YYYY-MM-DD format" },
          description: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          category: { type: Type.STRING, description: "One of: Groceries, Shopping, Transport, Dining, Utilities, Entertainment, Health, General" }
        },
        required: ["date", "description", "amount", "category"]
      }
    },
    statementBalance: { type: Type.NUMBER, description: "Total outstanding amount/closing balance" },
    dueDate: { type: Type.STRING, description: "YYYY-MM-DD format" }
  },
  required: ["transactions"]
};

/**
 * Summarizes spending and provides card recommendations.
 * Uses gemini-3-flash-preview for efficiency.
 */
export const getSpendingInsights = async (transactions: Transaction[], accounts: Account[]) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "API_KEY not configured in environment.";

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Analyze these ${transactions.length} transactions and these card rewards: ${JSON.stringify(accounts.map(a => ({name: a.name, rules: a.benefits.rules})))}.
  Provide: 
  1. Top 3 categories where the user is spending most.
  2. Recommendation on which card is best for their top categories.
  3. One habit change to save money.
  Be concise and use bullet points.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error: any) {
    console.error("AI analysis error:", error);
    return `Analysis failed: ${error.message || 'Unknown error'}`;
  }
};

/**
 * Extracts transaction data from images.
 * Switched to gemini-3-flash-preview for high speed and reliability in OCR tasks.
 */
export const extractFromImage = async (dataUrls: string[]) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY is missing. Please check your Vercel environment variables.");

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Extract all transactions from these bank statement screenshots. 
  IMPORTANT: These are multiple pages. If a transaction starts on one page and ends on another, merge it. 
  Always provide a category for each transaction from the allowed list.
  Also find the total amount due (Closing Balance) and the Payment Due Date (YYYY-MM-DD).`;

  try {
    const imageParts = dataUrls.map(dataUrl => {
      // Extract mime type and base64 data from DataURL
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
      return {
        inlineData: { mimeType, data: base64 }
      };
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [...imageParts, { text: prompt }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("Model returned empty response.");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Image extraction error:", error);
    // Return detailed error for UI debugging
    throw new Error(error.message || "Failed to extract data from image.");
  }
};

/**
 * Parses raw text from a bank statement.
 */
export const extractFromText = async (rawText: string) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY is missing.");

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Parse this raw text from a bank statement into structured JSON. Extract all transactions with categories, total balance due, and due date.
  Text: ${rawText}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA
      }
    });
    const text = response.text;
    if (!text) throw new Error("Model returned empty response.");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Text extraction error:", error);
    throw new Error(error.message || "Failed to parse statement text.");
  }
};
