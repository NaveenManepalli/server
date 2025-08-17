// File: server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { PRODUCT_CATALOG } from "./catalog.js"; // centralized catalog

dotenv.config();

const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ✅ Log on startup
console.log("🔑 GEMINI_API_KEY present:", !!GEMINI_API_KEY);
console.log("📦 Catalog loaded:", Array.isArray(PRODUCT_CATALOG) ? PRODUCT_CATALOG.length : "NOT AN ARRAY");

// Proxy endpoint
app.post("/recommend", async (req, res) => {
  try {
    const { query, topK = 3 } = req.body;   // 👈 only accept query + topK
    console.log("📩 Incoming request:", { query, topK });

    // ✅ Always use centralized PRODUCT_CATALOG
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

Do not add extra text, only return valid JSON.
`;

    console.log("📝 Prompt sent to Gemini:\n", prompt.slice(0, 1000), "...\n"); // log only first 1000 chars

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await geminiRes.json();
    console.log("📥 Raw Gemini response:", JSON.stringify(data, null, 2));

    if (!geminiRes.ok) {
      console.error("❌ Gemini API error:", data);
      return res
        .status(500)
        .json({ error: "Gemini API call failed", details: data });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("📜 Gemini text output:", text);

    let recommendations = [];
    try {
      // clean possible ```json fences
      const cleaned = text.replace(/```json|```/g, "").trim();
      recommendations = JSON.parse(cleaned);
      console.log("✅ Parsed recommendations:", recommendations);
    } catch (err) {
      console.error("⚠️ Failed to parse Gemini response:", text, err);
      recommendations = [];
    }

    res.json({ recommendations });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Use Render’s PORT
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Gemini proxy running at http://localhost:${PORT}/recommend`);
});
