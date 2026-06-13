import { GoogleGenAI } from "@google/genai";
import { toast } from "sonner";

// Retrieve keys dynamically from environment and local storage
const getApiKeys = () => {
  const env = (import.meta as any).env || {};
  return {
    geminiKeys: [
      env.GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || "",
      env.GEMINI_API_KEY_2 || localStorage.getItem('gemini_api_key_2') || "",
      env.GEMINI_API_KEY_3 || localStorage.getItem('gemini_api_key_3') || "",
      env.GEMINI_API_KEY_4 || localStorage.getItem('gemini_api_key_4') || "",
    ].filter(k => k && k !== "MY_GEMINI_API_KEY"),
    groqKey: env.GROQ_API_KEY || localStorage.getItem('groq_api_key') || ""
  };
};

async function makeAiCall(prompt: string, systemInstruction?: string): Promise<string> {
  const { geminiKeys, groqKey } = getApiKeys();

  if (geminiKeys.length === 0 && !groqKey) {
    throw new Error("No API key configured. Please set GEMINI_API_KEY or GROQ_API_KEY in settings.");
  }

  // 1. Try Gemini API keys in rotation
  for (let i = 0; i < geminiKeys.length; i++) {
    const key = geminiKeys[i];
    try {
      console.log(`[AI Rotation] Attempting call with Gemini Key #${i + 1}`);
      const genAI = new GoogleGenAI({ apiKey: key });
      const contents = [{ role: "user", parts: [{ text: prompt }] }];
      
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        ...(systemInstruction ? { config: { systemInstruction } } : {})
      });

      if (result.text) {
        return result.text;
      }
    } catch (err: any) {
      console.error(`[AI Rotation] Gemini Key #${i + 1} failed:`, err);
      
      // Notify the user on the screen that we're rotating keys
      toast.warning(`Gemini API Key #${i + 1} limits/quota reached. Rotating to backup credentials...`);
      
      if (i === geminiKeys.length - 1 && !groqKey) {
        throw err;
      }
    }
  }

  // 2. Try Groq fallback if all Gemini keys fail
  if (groqKey) {
    try {
      console.log(`[AI Rotation] All Gemini keys exhausted. Falling back to Groq Llama-3...`);
      toast.warning("Primary Gemini engines exhausted. Activating Groq Llama-3 backup model...");
      
      const messages = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
      }
      messages.push({ role: "user", content: prompt });

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Groq API responded with status ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return content;
      }
    } catch (err: any) {
      console.error(`[AI Rotation] Groq Fallback failed:`, err);
      toast.error(`Groq API fallback engine also failed: ${err.message}`);
      throw err;
    }
  }

  throw new Error("All AI providers failed to resolve the request.");
}

export const aiService = {
  generateIssueDescription: async (title: string): Promise<string> => {
    try {
      return await makeAiCall(
        `Write a professional, concise, and actionable issue description for a project management task titled: "${title}". Use bullet points if necessary. Keep it under 100 words.`,
        "You are a helpful project management assistant."
      );
    } catch (error) {
      console.error("AI Generation Error:", error);
      return "Failed to generate description. Please check your AI API credentials.";
    }
  },

  suggestPriority: async (title: string, description: string): Promise<string> => {
    try {
      const result = await makeAiCall(
        `Based on the title "${title}" and description "${description}", suggest one of the following priority levels: LOW, MEDIUM, HIGH, URGENT. Return only the level name in uppercase.`,
        "You are a helpful assistant. Only return LOW, MEDIUM, HIGH or URGENT in uppercase, nothing else."
      );
      const priority = result.trim().toUpperCase();
      if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
        return priority;
      }
      return "MEDIUM";
    } catch (error) {
      return "MEDIUM";
    }
  },

  getProjectInsights: async (stats: any): Promise<string> => {
    try {
      return await makeAiCall(
        `Analyze these project statistics: ${JSON.stringify(stats)}. Provide the analysis with two sections:
### Health Summary
[Provide a short, 2-sentence summary of the overall health here]

### Actionable Advice
- [Provide one clear, actionable advice here]`,
        "You are a helpful project analyst. Format the response strictly using the markdown headers (### Health Summary and ### Actionable Advice) and bullet points."
      );
    } catch (error) {
      return "### Error\nUnable to generate insights at this time. Please check your AI API credentials.";
    }
  },

  decomposeTaskIntoSubtasks: async (title: string, description: string): Promise<string[]> => {
    try {
      const result = await makeAiCall(
        `Decompose this project management task into 3-6 actionable, short checklist items (under 10 words each). Title: "${title}". Description: "${description}". Return the list strictly as a valid JSON array of strings: ["task 1", "task 2", ...]. Do not include markdown code block tags like \`\`\`json.`,
        "You are a project manager. Return JSON array of checklist items only."
      );
      const text = result.trim();
      const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const items = JSON.parse(cleanedText);
      if (Array.isArray(items)) {
        return items.map(i => String(i));
      }
      return ["Task analysis", "Detailed design", "Implementation", "Testing & QA"];
    } catch (error) {
      console.error("AI Decompose Error:", error);
      return ["Task analysis", "Detailed design", "Implementation", "Testing & QA"];
    }
  },

  generateDailyStandup: async (completed: string[], inProgress: string[], blockers: string[]): Promise<string> => {
    try {
      return await makeAiCall(
        `Generate a professional markdown-formatted Daily Standup Update. 
Completed tasks (Yesterday): ${JSON.stringify(completed)}. 
Tasks in progress (Today): ${JSON.stringify(inProgress)}. 
Blockers/issues (Obstacles): ${JSON.stringify(blockers)}. 
Format with sections: **Yesterday**, **Today**, and **Blockers**. Keep it concise, friendly, and structured.`,
        "You are a developer drafting a standup update."
      );
    } catch (error) {
      console.error("AI Standup Error:", error);
      return "Failed to generate standup update. Please check your AI API credentials.";
    }
  },

  askProjectAssistant: async (query: string, projectContext: any): Promise<string> => {
    try {
      return await makeAiCall(
        `Here is the full JSON state of projects, issues, comments, and members in the current workspace:
${JSON.stringify(projectContext)}

Based on this data, answer the user's question: "${query}".
Keep your response professional, precise, direct, and directly actionable. Use bullet points or charts if relevant.`,
        `You are an expert context-aware AI Project Management Assistant for the "Emergent" platform.`
      );
    } catch (error) {
      console.error("AI Assistant Error:", error);
      return "Sorry, I had an error reading your project data. Please verify your API keys are valid.";
    }
  }
};
