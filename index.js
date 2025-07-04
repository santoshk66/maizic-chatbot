import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { promises as fs } from "fs";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// OpenAI Setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// In-memory conversation storage (use Redis or MongoDB for production)
const conversations = new Map();

// FAQ Database for common queries
const faqs = {
  "record at night": "Yes, Maizic cameras like the Supercam 12MP 4K and Ultracam Falcon 5MP feature color night vision with IR and white LEDs for clear footage in low light. View recordings via the V380 Pro or Tuya Smart app.",
  "set up camera": "To set up your Maizic camera: 1) Download the V380 Pro or Tuya Smart app from the App Store or Google Play. 2) Power on the camera (or charge via solar panel for solar models). 3) Open the app, tap 'Add Device,' and scan the QR code on the camera. 4) Follow prompts to connect to Wi-Fi or insert a 4G SIM. Need more help? Call 9871142290!",
  "extend warranty": "To extend your warranty, visit https://www.maizic.com/warranty or contact our support team at 9871142290 for assistance.",
  "use sim card": "Maizic 4G cameras, like the Gorilla 5MP, support any 4G SIM (e.g., Jio, Airtel) with a data plan. Insert the SIM, connect via the V380 Pro app, and you’re set!",
  "watch from phone": "Yes, you can monitor your Maizic camera from your phone using the V380 Pro or Tuya Smart app, which supports live view and recordings."
};

// CORS for maizic.com
app.use(cors({
  origin: ["https://maizic.com", "https://www.maizic.com"]
}));
app.use(express.json());

// System Prompt for Maizic Customer Care
const systemPrompt = `
You are a highly skilled, friendly, and professional customer care executive for **Maizic Smarthome**, India’s leading AI-powered smart electronics brand. Your goal is to provide accurate, concise, and helpful responses about Maizic products, installation, troubleshooting, and post-purchase support. Follow these guidelines:

📦 **Maizic Products**:
- **Security Cameras**: 
  - Supercam 12MP 4K Solar Dual Lens: 4K resolution, solar-powered, 360° PTZ, color night vision, human detection, two-way audio, IP66 waterproof, SD card (up to 256GB), cloud storage.
  - Ultracam Falcon 5MP: 20X optical zoom, dual-band Wi-Fi, 2-year warranty.
  - Mini Fox 3MP FHD: Indoor, 360° rotation, motion tracking.
  - Gorilla 5MP 4G: 4G SIM support, IP66 waterproof, 9 IR LEDs.
- **Dashcams**: Dashcam Pro with 1080p, night vision, loop recording.
- **Projectors**: CineCast Pro 4K Android with Wi-Fi, Bluetooth, auto keystone correction.
- **Kids Cameras & Toys**: Durable, child-friendly designs.
- **Other Devices**: Swift Smartwatch (1.80" HD display), smart fans, microphones, routers.

🛠 **Installation & Setup**:
- Cameras use **V380 Pro** or **Tuya Smart** app. Steps: 1) Download app. 2) Power on camera. 3) Scan QR code to pair. 4) Connect to Wi-Fi or 4G SIM.
- Solar cameras: Place in sunlight, charge battery fully before use.
- Troubleshooting: Reset camera (press reset button 5 seconds) if app connection fails.

📱 **Common Queries**:
- **Night recording**: All cameras have color night vision with IR/white LEDs.
- **Remote viewing**: Use V380 Pro/Tuya Smart app for live view and playback.
- **Warranty**: Standard 6-month warranty (renewed products) or 2 years (select models). Extend at https://www.maizic.com/warranty.
- **4G SIM**: Supports Jio, Airtel, etc., with data plan.

🎯 **Response Guidelines**:
- **Tone**: Friendly, polite, and professional (e.g., “Happy to assist!” or “Let’s get that sorted!”).
- **Length**: 2–4 sentences or bullet points for clarity. Avoid verbosity.
- **Accuracy**: Only provide verified information. If unsure, say: “I’m not sure about that, but I can connect you with our technical team at 9871142290.”
- **Multi-Intent**: Address all user questions in a single query (e.g., setup + warranty).
- **Proactive**: Offer next steps (e.g., “Need help with setup?”).
- **Escalation**: For complex issues, say: “Could you provide more details? Alternatively, our team at 9871142290 can assist further.”

💡 **Example Responses**:
- **User**: “Does Supercam work at night?”  
  **Response**: “Yes, the Supercam 12MP 4K Solar Dual Lens camera has color night vision with IR and white LEDs for clear footage in low light. View it via the V380 Pro app. Need help accessing recordings?”
- **User**: “How to set up camera and what’s the warranty?”  
  **Response**: “To set up your Maizic camera: 1) Download V380 Pro app. 2) Power on and scan QR code. 3) Connect to Wi-Fi/4G. The warranty is 2 years for most cameras, or 6 months for renewed products—extend it at https://www.maizic.com/warranty!”

Never invent product details, pricing, or unavailable features. If asked about pricing, say: “Please check current pricing at https://www.maizic.com or contact 9871142290.”
`;

// Root endpoint
app.get("/", (req, res) => {
  res.send("✅ Maizic Chatbot Backend is running!");
});

// Debug endpoint
app.get("/debug", (req, res) => {
  const valid = !!process.env.OPENAI_API_KEY;
  res.json({ openai: { apiKeyValid: valid } });
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId = "default" } = req.body;
    if (!message || message.length > 1000) {
      return res.status(400).json({ reply: "Message too long or empty." });
    }

    // Normalize user message for FAQ matching
    const normalizedMessage = message.toLowerCase().trim();

    // Check FAQ database first
    for (const [question, answer] of Object.entries(faqs)) {
      if (normalizedMessage.includes(question)) {
        // Log FAQ hit
        await fs.appendFile("chat_logs.txt", `User: ${message}\nBot (FAQ): ${answer}\n---\n`);
        return res.json({ reply: answer });
      }
    }

    // Get or initialize conversation history
    let conversation = conversations.get(sessionId) || [
      { role: "system", content: systemPrompt }
    ];

    // Add user message
    conversation.push({ role: "user", content: message });

    // Chat completion with optimized parameters
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: conversation,
      temperature: 0.7, // Balanced creativity and consistency
      max_tokens: 300, // Limit response length
      top_p: 1.0, // Default nucleus sampling
      presence_penalty: 0.2, // Encourage new topics
      frequency_penalty: 0.2 // Reduce repetition
    });

    let reply = chatCompletion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't understand that. Could you clarify, or contact our team at 9871142290?";

    // Validate response to ensure it’s on-brand and not speculative
    if (reply.toLowerCase().includes("i don’t know") || reply.length > 500) {
      reply = "I’m not sure about that, but I’d be happy to connect you with our technical team at 9871142290 for further assistance!";
    }

    // Add assistant response to conversation
    conversation.push({ role: "assistant", content: reply });

    // Limit conversation history to 10 messages to avoid token overflow
    if (conversation.length > 10) {
      conversation = [conversation[0], ...conversation.slice(-9)]; // Keep system prompt + last 9
    }

    conversations.set(sessionId, conversation);

    // Log interaction
    await fs.appendFile("chat_logs.txt", `User: ${message}\nBot: ${reply}\n---\n`);

    res.json({ reply });
  } catch (error) {
    console.error("Chatbot Error:", error);
    let userReply = "Something went wrong. Please try again or contact our support team at 9871142290.";
    if (error.code === "insufficient_quota") {
      userReply = "We’re experiencing a temporary issue. Please contact our support team at 9871142290.";
    }
    await fs.appendFile("chat_logs.txt", `User: ${req.body.message}\nError: ${error.message}\n---\n`);
    res.status(500).json({ reply: userReply });
  }
});

// Clear conversation history (optional endpoint for testing)
app.post("/clear-session", (req, res) => {
  const { sessionId = "default" } = req.body;
  conversations.delete(sessionId);
  res.json({ message: "Session cleared." });
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
