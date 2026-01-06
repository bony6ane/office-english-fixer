import express from "express";
import axios from "axios";
import rateLimit from "express-rate-limit";
import "dotenv/config";

const app = express();

/* -------------------- BASIC SETUP -------------------- */
app.use(express.json());

/* -------------------- CORS (GLOBAL & EXPLICIT) -------------------- */
const FRONTEND_ORIGIN = "https://subtle-gumdrop-b9bbea.netlify.app";

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

/* -------------------- RATE LIMIT (SKIP OPTIONS) -------------------- */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50
});

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return next(); // never rate-limit preflight
  }
  limiter(req, res, next);
});

/* -------------------- HEALTH CHECK -------------------- */
app.get("/health", (req, res) => {
  res.send("OK");
});

/* -------------------- FIX ENDPOINT -------------------- */
app.post("/fix", async (req, res) => {
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
      "Rewrite in clear, neutral professional office English.",
    boss:
      "Rewrite in highly respectful, formal, client-facing English. Use words like Kindly, Please, or We would appreciate."
  };

  const prompt = `
Rewrite the following WhatsApp office message into correct English.

Rules:
- Do not explain
- Do not add information
- Keep it concise
- Output only the rewritten message

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

    let output =
      response.data.choices[0].message.content.trim();

    // Clean rare model artifacts
    if (output.startsWith("<s>")) {
      output = output.replace("<s>", "").trim();
    }

    res.json({ result: output });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "AI error" });
  }
});

/* -------------------- START SERVER -------------------- */
app.listen(3000, () => {
  console.log("Backend running on port 3000");
});
