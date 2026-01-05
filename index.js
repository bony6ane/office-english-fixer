import express from "express";
import axios from "axios";
import cors from "cors";
import rateLimit from "express-rate-limit";
import "dotenv/config";


const app = express();
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per window
  standardHeaders: true,
  legacyHeaders: false
});

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/* Health check */
app.get("/health", (req, res) => {
  res.send("OK");
});

app.post("/fix", limiter, async (req, res) => {
  const { text, tone = "professional" } = req.body;

  const cleanText = text?.trim();

  if (!cleanText || cleanText.length > 400) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const prompt = `
Rewrite the following WhatsApp office message into clear English.

Tone: ${tone}

Rules:
- Do not explain
- Do not add information
- Keep it short
- Output only the corrected message

Message:
${cleanText}
`;

  try {
    const response = await axios.post(
  OPENROUTER_API_URL,
  {
    model: "mistralai/mistral-7b-instruct",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.4,
    max_tokens: 120
  },
  {
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost",
      "X-Title": "Office English Fixer"
    }
  }
);

    const output =
  response.data?.choices?.[0]?.message?.content?.trim();
    res.json({ result: output });

  } catch (error) {
    console.error("HF ERROR STATUS:", error.response?.status);
    console.error("HF ERROR DATA:", error.response?.data);
    console.error("HF ERROR MESSAGE:", error.message);

    res.status(500).json({
      error: "HF error",
      status: error.response?.status,
      details: error.response?.data || error.message
    });
  }
});

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
});
