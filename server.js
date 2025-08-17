// File: server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ✅ Correct model & endpoint
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Proxy endpoint
app.post("/recommend", async (req, res) => {
  try {
    const { query, catalog = [], topK = 3 } = req.body;

    // ✅ Strong JSON-only prompt
    const prompt = `
You are a product recommendation AI. 
Your ONLY job is to return JSON, nothing else.

Catalog of products:
${catalog
  .map(
    (p) => `- ${p.id}: ${p.name} (${p.category}) - ${p.description}`
  )
  .join("\n")}

User query: "${query}"

Return exactly ${topK} matches in strict JSON format:
[
  { "id": "string", "name": "string", "reason": "string", "score": number }
]

Do not add extra text, only return valid JSON.
`;

    // Call Gemini
    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error("❌ Gemini API error:", data);
      return res
        .status(500)
        .json({ error: "Gemini API call failed", details: data });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let recommendations = [];
    try {
      // ✅ Clean out ```json ... ```
      const cleaned = text.replace(/```json|```/g, "").trim();
      recommendations = JSON.parse(cleaned);
    } catch (err) {
      console.error("⚠️ Failed to parse Gemini response:", text);
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
