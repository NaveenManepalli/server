// File: server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

// Proxy endpoint
app.post("/recommend", async (req, res) => {
  try {
    const { query, catalog, topK = 3 } = req.body;

    const prompt = `
You are a product recommendation AI.
The catalog of products is below:
${catalog
  .map(
    (p) => `- ${p.id}: ${p.name} (${p.category}) - ${p.description}`
  )
  .join("\n")}

User query: "${query}"

Return the top ${topK} matching products in JSON:
[
  { "id": "...", "name": "...", "reason": "...", "score": 0.0 }
]
`;

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let recommendations = [];
    try {
      recommendations = JSON.parse(text);
    } catch {
      recommendations = [];
    }

    res.json({ recommendations });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error talking to Gemini");
  }
});

app.listen(3001, () => {
  console.log("✅ Gemini proxy running at http://localhost:3001/recommend");
});
