
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
 * Uses gemini-3-flash-preview for basic text summarization.
 */
export const getSpendingInsights = async (transactions: Transaction[], accounts: Account[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  } catch (error) {
    console.error("AI analysis error:", error);
    return "AI analysis currently unavailable.";
  }
};

/**
 * Extracts transaction data from images of bank statements.
 * Uses gemini-3-pro-preview for complex reasoning and data extraction tasks.
 */
export const extractFromImage = async (base64DataArray: string[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Extract all transactions from these bank statement screenshots. 
  IMPORTANT: These are multiple pages. If a transaction starts on one page and ends on another, merge it. Remove exact duplicates if found on page overlaps.
  Always provide a category for each transaction from the allowed list.
  Also find the total amount due (Closing Balance) and the Payment Due Date.`;

  try {
    const imageParts = base64DataArray.map(base64 => ({
      inlineData: { mimeType: "image/jpeg", data: base64 }
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [...imageParts, { text: prompt }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Image extraction error:", error);
    throw error;
  }
};

/**
 * Parses raw text from a bank statement into structured JSON.
 * Uses gemini-3-pro-preview for complex data extraction.
 */
export const extractFromText = async (rawText: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Parse this raw text from a bank statement into structured JSON. Extract all transactions with categories, total balance due, and due date.
  Text: ${rawText}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Text extraction error:", error);
    throw error;
  }
};
