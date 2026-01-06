import express from "express";
import axios from "axios";
import cors from "cors";
import rateLimit from "express-rate-limit";
import "dotenv/config";

const app = express();
app.use(
  cors({
    origin: true, // reflect request origin
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Handle preflight requests explicitly

app.use(express.json());

/* Rate limiting */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false
});

const OPENROUTER_API_URL =
  "https://openrouter.ai/api/v1/chat/completions";

/* Health check */
app.get("/health", (req, res) => {
  res.send("OK");
});

/* STRICT tone ladder: least → most respectful */
const toneInstructions = {
  casual:
    "Rewrite in simple, casual office English. Sound direct and friendly like a teammate. Avoid formal words.",

  polite:
    "Rewrite politely and respectfully. Use 'please' or similar courtesy, but keep it normal and not formal.",

  professional:
    "Rewrite in clear, neutral, professional office English suitable for internal communication.",

  boss:
    "Rewrite in highly respectful, formal, and client-facing English. Use indirect phrasing, professional courtesy, and politeness markers such as 'Kindly', 'Please', or 'We would appreciate if'. Avoid casual language completely."
};

app.post("/fix", limiter, async (req, res) => {
  const { text, tone = "professional" } = req.body;

  const cleanText = text?.trim();

  if (!cleanText || cleanText.length > 400) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const prompt = `
You rewrite short WhatsApp office messages into correct English.

Rules:
- Correct grammar and spelling
- Do NOT explain
- Do NOT add new information
- Keep it concise
- Output ONLY the rewritten message

Tone requirement:
${toneInstructions[tone]}

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

    let output =
      response.data?.choices?.[0]?.message?.content?.trim();

    /* Clean rare model token artifacts */
    if (output?.startsWith("<s>")) {
      output = output.replace("<s>", "").trim();
    }

    res.json({ result: output });

  } catch (error) {
    console.error("OPENROUTER ERROR:", error.response?.data || error.message);

    res.status(500).json({
      error: "AI error",
      details: error.response?.data || error.message
    });
  }
});

app.listen(3000, () => {
  console.log("Backend running on port 3000");
});
