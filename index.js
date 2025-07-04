import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// OpenAI Setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// CORS for maizic.com
app.use(cors({
  origin: ["https://maizic.com", "https://www.maizic.com"]
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ Maizic Chatbot Backend is running!");
});

app.get("/debug", (req, res) => {
  const valid = !!process.env.OPENAI_API_KEY;
  res.json({ openai: { apiKeyValid: valid } });
});

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage || userMessage.length > 1000) {
      return res.status(400).json({ reply: "Message too long or empty." });
    }

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are Maizic support assistant." },
        { role: "user", content: userMessage }
      ]
    });

    const reply = chatCompletion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't understand that.";
    res.json({ reply });
  } catch (error) {
    console.error("Chatbot Error:", error);
    res.status(500).json({
      reply: "Something went wrong.",
      errorDetails: { message: error.message }
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});