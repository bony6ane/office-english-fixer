import express from "express";
import axios from "axios";
import rateLimit from "express-rate-limit";
import "dotenv/config";

const app = express();

/* ---------- MUST COME FIRST ---------- */
app.use(express.json());

/* ---------- MANUAL CORS (GLOBAL) ---------- */
app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://subtle-gumdrop-b9bbea.netlify.app"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

/* ---------- RATE LIMIT ---------- */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50
});

/* ---------- HEALTH CHECK ---------- */
app.get("/health", (req, res) => {
  res.send("OK");
});

/* ---------- FIX ENDPOINT ---------- */
app.post("/fix", limiter, async (req, res) => {
  const { text, tone = "professional" } = req.body;

  if (!text || text.length > 400) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const toneMap = {
    casual:
      "Rewrite casually like a teammate. Direct and informal.",
    polite:
      "Rewrite politely with basic courtesy.",
    professional:
      "Rewrite in clear professional office English.",
    boss:
      "Rewrite in highly respectful, formal, client-facing English. Use words like Kindly, Please, or We would appreciate."
  };

  const prompt = `
Rewrite this WhatsApp office message into correct English.

Rules:
- Do not explain
- Do not add information
- Output only the corrected message

Tone requirement:
${toneMap[tone]}

Message:
${text}
`;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 120
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let output = response.data.choices[0].message.content.trim();
    if (output.startsWith("<s>")) {
      output = output.replace("<s>", "").trim();
    }

    res.json({ result: output });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "AI error" });
  }
});

/* ---------- START SERVER ---------- */
app.listen(3000, () => {
  console.log("Backend running on port 3000");
});
