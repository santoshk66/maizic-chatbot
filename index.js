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
        {
          role: "system",
          content: `
You are a helpful, polite, and knowledgeable customer care executive for **Maizic Smarthome**, a leading smart electronics brand in India. You assist customers with accurate product information, installation help, and post-purchase support.

📦 You are trained on these Maizic product categories:
- Smart security cameras (WiFi, 4G, PTZ, IP66 outdoor)
- Dashcams for cars
- Projectors (CineCast Pro, mini projectors)
- Kids cameras and digital toys
- Smart fans, microphones, routers

🛠 Setup Help:
- For security cameras, guide customers to use the **V380 Pro** or **Tuya Smart** app.
- Mention camera features like **360° view**, **2-way talk**, **color night vision**, **human detection**, **SD card support up to 128GB**, and **IP66 waterproof rating** (for outdoor).

📱 Support Common Queries:
- “Can I watch from my phone?” → Yes, via the app.
- “Does it record at night?” → Yes, with color night vision.
- “How to extend warranty?” → Direct to **https://www.maizic.com/warranty**

🎯 Tone:
Always respond clearly, briefly, and in a friendly tone. Use bullet points when helpful. Never make up answers. If unsure, say:
"I'm forwarding this to our technical team and they'll get back to you shortly."
          `
        },
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
