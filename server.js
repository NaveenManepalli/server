// server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";   // 👈 add this
import { PRODUCT_CATALOG } from "./catalog.js"; // centralized catalog

dotenv.config();

const app = express();
app.use(express.json());

app.use(cors({
  origin: "*",  // or "https://snack.expo.dev" if you want to lock it down
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 🔍 Debug: show first 5 catalog items
console.log("📦 Catalog sample:", PRODUCT_CATALOG.slice(0, 5));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Proxy endpoint
app.post("/recommend", async (req, res) => {
  try {
    const { query, topK = 3 } = req.body;

    console.log("🔎 Incoming request:", { query, topK });

    const prompt = `
You are a product recommendation AI. 
Your ONLY job is to return JSON, nothing else.

Catalog of products:
${PRODUCT_CATALOG.map(
  (p) => `- ${p.id}: ${p.name} (${p.category}) - ${p.description}`
).join("\n")}

User query: "${query}"

Return exactly ${topK} matches in strict JSON format:
[
  { "id": "string", "name": "string", "reason": "string", "score": number }
]
`;

    console.log("📝 Prompt sent to Gemini:\n", prompt.substring(0, 1000), "...");

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const data = await geminiRes.json();
    console.log("📥 Raw Gemini response:", JSON.stringify(data, null, 2));

    if (!geminiRes.ok) {
      console.error("❌ Gemini API error:", data);
      return res.status(500).json({ error: "Gemini API call failed", details: data });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("📜 Gemini text output:", text);

    let recommendations = [];
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      recommendations = JSON.parse(cleaned);
    } catch (err) {
      console.error("⚠️ Failed to parse Gemini response:", text);
      recommendations = [];
    }

    console.log("✅ Parsed recommendations:", recommendations);
    res.json({ recommendations });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Gemini proxy running at http://localhost:${PORT}/recommend`);
});
