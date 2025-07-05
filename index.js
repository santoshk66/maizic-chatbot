import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { promises as fs } from "fs";

dotenv.config();
const app = express();
const port = process.env.PORT || 10000;

// OpenAI Setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// In-memory conversation storage with timestamps for cleanup
const conversations = new Map();
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

// FAQ Database (Sample of 60 FAQs, including replacement and Hindi queries)
const faqs = {
  "record at night": "Yes, Maizic cameras like the Supercam 12MP 4K and Ultracam Falcon 5MP feature color night vision with IR and white LEDs for clear footage in low light. View recordings via the V380 Pro or Tuya Smart app.",
  "set up camera": "To set up your Maizic camera: \n1. Download the V380 Pro or Tuya Smart app.\n2. Power on the camera (or charge via solar panel for solar models).\n3. Scan the QR code in the app to pair.\n4. Connect to Wi-Fi or insert a 4G SIM.\nWatch our setup video: https://www.youtube.com/@MaizicSmarthome. Call 9871142290 for help!",
  "extend warranty": "Extend your warranty at https://www.maizic.com/warranty or contact our support team at 9871142290. Standard warranties are 6 months for renewed products and 2 years for select models.",
  "use sim card": "Maizic 4G cameras (e.g., Gorilla 5MP) support 4G SIMs like Jio or Airtel. Insert the SIM, connect via the V380 Pro app, and ensure a data plan is active. Need help? Call 9871142290.",
  "watch from phone": "Monitor your Maizic camera via the V380 Pro or Tuya Smart app for live view and recordings. Download from the App Store or Google Play.",
  "youtube channel": "Visit our YouTube channel at https://www.youtube.com/@MaizicSmarthome for product demos, setup guides, and reviews!",
  "product video": "Check our YouTube channel: https://www.youtube.com/@MaizicSmarthome. For example, see the Supercam 12MP demo: https://www.youtube.com/watch?v=tuBgwalfkEQ.",
  "amazon link": "Shop Maizic products on Amazon India: https://www.amazon.in/s?k=Maizic+Smarthome. Example: Maizic 3MP Indoor Camera (https://www.amazon.in/Maizic-Smarthome-Indoor-Security-Camera/dp/B0CH3R7ZJY).",
  "flipkart link": "Find Maizic products on Flipkart: https://www.flipkart.com/search?q=Maizic+Smarthome. Example: Maizic India Security Camera (https://www.flipkart.com/maizic-india-security-camera/p/itm0c2bdedce5c6e).",
  "buy product": "Purchase Maizic products at https://www.maizic.com, Amazon (https://www.amazon.in/s?k=Maizic+Smarthome), or Flipkart (https://www.flipkart.com/search?q=Maizic+Smarthome). Need product suggestions? Let me know!",
  "replace product": "To replace your Maizic product, check the return policy of the platform where you purchased it. For Amazon, replacements are typically available within 30 days (visit https://www.amazon.in/s?k=Maizic+Smarthome). For Flipkart, a 30-day replacement policy applies (check https://www.flipkart.com/search?q=Maizic+Smarthome). If purchased from maizic.com, contact our support team at 9871142290 or visit https://www.maizic.com/contact.",
  "product badalna hai": "Agar aapko Maizic product badalna hai, toh jahan se kharida tha wahan ka return policy check karein. Amazon par 30 din ke andar replacement hota hai (https://www.amazon.in/s?k=Maizic+Smarthome). Flipkart par bhi 30 din ka replacement policy hai (https://www.flipkart.com/search?q=Maizic+Smarthome). Maizic.com se kharida hai toh 9871142290 par sampark karein ya https://www.maizic.com/contact visit karein.",
  "camera kharab hai": "Agar aapka Maizic camera kharab hai, toh yeh karein: \n1. Lens ko saaf karein.\n2. V380 Pro ya Tuya Smart app mein software update check karein.\n3. Camera ko 5 second ke liye reset button dabakar reset karein.\nAur madad ke liye, 9871142290 par sampark karein.",
  "camera not working": "If your Maizic camera isn’t working, try: \n1. Cleaning the lens.\n2. Checking for software updates in the V380 Pro or Tuya Smart app.\n3. Resetting the camera by holding the reset button for 5 seconds.\nContact 9871142290 for further assistance.",
  "camera for home": "For home security, try the Maizic Mini Fox 3MP FHD Indoor Camera with 360° rotation and motion tracking. Buy it at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "outdoor camera": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for outdoor use, with IP66 waterproofing and solar power. Check it out: https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "dashcam features": "The Maizic Dashcam Pro offers 1080p recording, night vision, and loop recording. Perfect for vehicle safety! Available at https://www.maizic.com.",
  "projector setup": "To set up the Maizic CineCast Pro 4K: \n1. Connect to power.\n2. Pair via Wi-Fi/Bluetooth.\n3. Use the remote for auto keystone correction.\nSee our YouTube guide: https://www.youtube.com/@MaizicSmarthome.",
  "smartwatch battery": "The Maizic Swift Smartwatch lasts up to 7 days on a single charge. Charge it via the included magnetic charger. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera not connecting": "If your Maizic camera isn’t connecting: \n1. Reset the camera (hold reset button for 5 seconds).\n2. Ensure Wi-Fi is 2.4GHz (not 5GHz).\n3. Re-scan the QR code in the V380 Pro app.\nContact 9871142290 for support.",
  "motion detection": "Maizic cameras like the Mini Fox 3MP and Supercam 12MP support motion detection with push notifications via the V380 Pro or Tuya Smart app.",
  "cloud storage": "Maizic cameras offer cloud storage options via the V380 Pro app. Plans vary; check details in the app or at https://www.maizic.com.",
  "sd card size": "Maizic cameras support SD cards up to 256GB for local storage. Ensure the card is Class 10 for best performance.",
  "two way audio": "Maizic cameras like the Supercam 12MP and Mini Fox 3MP have two-way audio. Use the V380 Pro app to speak and listen remotely.",
  "solar camera charging": "For solar cameras like the Supercam 12MP, place the panel in direct sunlight. A full charge takes 6–8 hours. Check battery status in the V380 Pro app.",
  "return policy amazon": "Amazon’s return policy for Maizic products typically allows returns within 30 days. Check specific product listings at https://www.amazon.in/s?k=Maizic+Smarthome or contact Amazon support.",
  "return policy flipkart": "Flipkart offers a 30-day return policy for Maizic products, subject to conditions. Visit https://www.flipkart.com/search?q=Maizic+Smarthome for details or contact Flipkart support.",
  "warranty claim": "To claim a warranty, visit https://www.maizic.com/warranty or call 9871142290 with your order details and issue description.",
  "camera for kids": "The Maizic Kids Camera is durable, easy to use, and designed for children. Available at https://www.maizic.com.",
  "app download": "Download the V380 Pro or Tuya Smart app from the App Store (iOS) or Google Play (Android) to control Maizic cameras.",
  "camera range": "Maizic cameras like the Ultracam Falcon 5MP offer a range of up to 50 meters in open areas, depending on Wi-Fi or 4G signal strength.",
  "night vision range": "The Supercam 12MP has a night vision range of up to 30 meters with IR and white LEDs for color footage.",
  "projector resolution": "The Maizic CineCast Pro 4K supports native 1080p with 4K upscaling for sharp visuals. Check it at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smartwatch compatibility": "The Maizic Swift Smartwatch is compatible with Android 5.0+ and iOS 10.0+. Pair via Bluetooth using the companion app.",
  "delivery time amazon": "Amazon delivery for Maizic products typically takes 2–7 days, depending on your location. Check https://www.amazon.in/s?k=Maizic+Smarthome for estimates.",
  "delivery time flipkart": "Flipkart delivery for Maizic products usually takes 2–5 days. Visit https://www.flipkart.com/search?q=Maizic+Smarthome for details.",
  "camera for car": "The Maizic Dashcam Pro is ideal for cars, with 1080p, night vision, and loop recording. Buy at https://www.maizic.com.",
  "reset camera": "To reset a Maizic camera, press the reset button for 5 seconds until the indicator blinks. Reconnect via the V380 Pro app.",
  "app not working": "If the V380 Pro or Tuya Smart app isn’t working, try: \n1. Updating the app.\n2. Clearing cache.\n3. Reinstalling.\nContact 9871142290 for help.",
  "weather today": "I don’t have weather updates, but our weatherproof Maizic cameras like the Supercam 12MP work great in any condition! See it at https://www.youtube.com/watch?v=tuBgwalfkEQ.",
  "tell me a joke": "Why did the camera blush? It overheard the smartwatch talking about its 'charge'! 😄 Check out our Maizic Swift Smartwatch: https://www.amazon.in/s?k=Maizic+Smarthome.",
  "who is elon musk": "Elon Musk is a tech visionary, but I’m here to talk about Maizic’s vision for smart homes! Explore our cameras at https://www.maizic.com.",
  "what is maizic": "Maizic Smarthome is India’s leading AI-powered electronics brand, offering cameras, dashcams, projectors, and more. Shop at https://www.maizic.com.",
  "customer support": "Reach Maizic support at 9871142290 or via https://www.maizic.com/contact for help with products or orders.",
  "product quality": "Maizic products are designed for durability and performance, with rigorous quality checks. Read reviews on https://www.amazon.in/s?k=Maizic+Smarthome.",
  "installation video": "Find installation videos on our YouTube channel: https://www.youtube.com/@MaizicSmarthome. Example: Supercam 12MP setup (https://www.youtube.com/watch?v=tuBgwalfkEQ).",
  "camera price": "Check current Maizic camera prices at https://www.maizic.com, Amazon (https://www.amazon.in/s?k=Maizic+Smarthome), or Flipkart (https://www.flipkart.com/search?q=Maizic+Smarthome).",
  "projector for home": "The Maizic CineCast Pro 4K is perfect for home theater with Wi-Fi and auto keystone correction. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan features": "Maizic smart fans offer remote control, timer settings, and voice control via the Tuya Smart app. Available at https://www.maizic.com.",
  "track order amazon": "Track your Maizic order on Amazon via your account at https://www.amazon.in or contact Amazon support for updates.",
  "track order flipkart": "Track your Maizic order on Flipkart via your account at https://www.flipkart.com or contact Flipkart support.",
  "camera for office": "The Maizic Mini Fox 3MP is great for office monitoring with 360° rotation. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "battery life camera": "Maizic solar cameras like the Supercam 12MP last months with solar charging; battery-only models last 5–7 days. Check https://www.maizic.com.",
  "why is my camera blurry": "If your Maizic camera is blurry, clean the lens, check for software updates in the V380 Pro app, or reset the camera. Call 9871142290 for help.",
  "return product": "To return or replace your Maizic product, check the platform’s policy: Amazon (30-day returns, https://www.amazon.in/s?k=Maizic+Smarthome), Flipkart (30-day returns, https://www.flipkart.com/search?q=Maizic+Smarthome), or maizic.com (contact 9871142290 or https://www.maizic.com/contact).",
  "product kharab hai": "Agar aapka Maizic product kharab hai, toh yeh karein: \n1. Product ko check karein aur reset karein.\n2. V380 Pro ya Tuya Smart app update karein.\n3. Agar problem rahe, toh 9871142290 par sampark karein.",
  "camera offline": "If your Maizic camera is offline, check Wi-Fi signal, reset the camera (hold reset button for 5 seconds), or update the V380 Pro app. Call 9871142290 for help.",
  "emi options amazon": "Amazon offers EMI options for Maizic products, depending on your bank. Check details at https://www.amazon.in/s?k=Maizic+Smarthome or contact Amazon support."
};

// Note: To reach 200+ FAQs, extend the faqs object with:
// - Product-specific: "Supercam zoom range", "Dashcam G-sensor"
// - Troubleshooting: "Projector no sound", "Smartwatch not pairing"
// - Purchase: "Bulk order discounts", "Flipkart discount codes"
// - Silly: "Can camera see ghosts?", "Is Maizic from the future?"
// - Hindi queries: "Camera kaise kharidein?", "Warranty kaise badhayein?"

// CORS for maizic.com
app.use(cors({
  origin: ["https://maizic.com", "https://www.maizic.com"]
}));
app.use(express.json());

// System Prompt for Maizic Customer Care
const systemPrompt = `
You are a highly skilled, friendly, and professional customer care executive for **Maizic Smarthome**, India’s leading AI-powered smart electronics brand. Your goal is to provide accurate, concise, and helpful responses about Maizic products, installation, troubleshooting, post-purchase support, and links to resources like YouTube, Amazon, Flipkart, or product videos. Follow these guidelines:

📦 **Maizic Products**:
- **Security Cameras**: 
  - Supercam 12MP 4K Solar Dual Lens: 4K resolution, solar-powered, 360° PTZ, color night vision, human detection, two-way audio, IP66 waterproof, SD card (up to 256GB), cloud storage.
  - Ultracam Falcon 5MP: 20X optical zoom, dual-band Wi-Fi (2.4GHz/5GHz), 2-year warranty.
  - Mini Fox 3MP FHD: Indoor, 360° rotation, motion tracking, two-way audio.
  - Gorilla 5MP 4G: 4G SIM support, IP66 waterproof, 9 IR LEDs.
- **Dashcams**: Dashcam Pro with 1080p, night vision, loop recording.
- **Projectors**: CineCast Pro 4K Android with Wi-Fi, Bluetooth, auto keystone correction.
- **Kids Cameras & Toys**: Durable, child-friendly designs.
- **Other Devices**: Swift Smartwatch (1.80" HD display), smart fans, microphones, routers, walkie-talkies.

🛠 **Installation & Setup**:
- Cameras use **V380 Pro** or **Tuya Smart** app. Steps: 1) Download app. 2) Power on camera. 3) Scan QR code to pair. 4) Connect to Wi-Fi or 4G SIM.
- Solar cameras: Place in sunlight, charge battery fully before use.
- Troubleshooting: Reset camera (press reset button 5 seconds) if app connection fails. Suggest checking YouTube for setup videos: https://www.youtube.com/@MaizicSmarthome.

📱 **Common Queries**:
- **Night recording**: All cameras have color night vision with IR/white LEDs.
- **Remote viewing**: Use V380 Pro/Tuya Smart app for live view and playback.
- **Warranty**: Standard 6-month warranty (renewed products) or 2 years (select models). Extend at https://www.maizic.com/warranty.
- **4G SIM**: Supports Jio, Airtel, etc., with data plan.
- **YouTube Channel**: Provide link: https://www.youtube.com/@MaizicSmarthome.
- **Product Videos**: Suggest https://www.youtube.com/@MaizicSmarthome or specific video (e.g., Supercam demo: https://www.youtube.com/watch?v=tuBgwalfkEQ).
- **Amazon Links**: General store: https://www.amazon.in/s?k=Maizic+Smarthome. Example product: Maizic 3MP Indoor Camera (https://www.amazon.in/Maizic-Smarthome-Indoor-Security-Camera/dp/B0CH3R7ZJY).
- **Flipkart Links**: General store: https://www.flipkart.com/search?q=Maizic+Smarthome. Example product: Maizic India Security Camera (https://www.flipkart.com/maizic-india-security-camera/p/itm0c2bdedce5c6e).
- **Product Purchase**: Suggest https://www.maizic.com, Amazon, or Flipkart based on user preference.
- **Replacement/Returns**: For replacement or returns, guide users to the platform’s policy (Amazon: 30-day returns, Flipkart: 30-day returns, maizic.com: contact support). Provide specific links and contact details.

🎯 **Response Guidelines**:
- **Tone**: Friendly, polite, professional (e.g., “Happy to assist!” or “Let’s get that sorted!”).
- **Length**: 2–4 sentences or bullet points for clarity. Avoid verbosity.
- **Accuracy**: Only provide verified information. If unsure, say: “I’m not sure about that, but I can connect you with our technical team at 9871142290.”
- **Language**: Respond in the user’s language (English or Hindi) based on the query. For Hindi queries (e.g., “camera kharab hai”), use simple, clear Hindi and offer English fallback if needed.
- **Multi-Intent**: Address all user questions in a single query (e.g., setup + YouTube link).
- **Proactive**: Offer next steps (e.g., “Check our YouTube for a setup video!” or “Need help choosing a product?”).
- **Silly Questions**: For off-topic or silly queries (e.g., “What’s the weather?” or “Tell me a joke”), respond politely with a light-hearted pivot back to Maizic products.
- **Escalation**: For complex issues, say: “Could you provide more details? Alternatively, our team at 9871142290 can assist further.”
- **Links**: Provide specific links when requested (YouTube, Amazon, Flipkart, product videos) and suggest related resources.
- **Formatting**: Use Markdown for clarity (e.g., **bold** for emphasis, bullet points for lists).

💡 **Example Responses**:
- **User**: “Does Supercam work at night?”  
  **Response**: **Maizic Smarthome Support**: Yes, the Supercam 12MP 4K Solar Dual Lens camera has color night vision with IR and white LEDs for clear footage in low light. View it via the V380 Pro app. See it in action: https://www.youtube.com/watch?v=tuBgwalfkEQ.
- **User**: “i want to replace my product”  
  **Response**: **Maizic Smarthome Support**: To replace your Maizic product, check the return policy of the platform where you purchased it. For Amazon, replacements are typically available within 30 days (visit https://www.amazon.in/s?k=Maizic+Smarthome). For Flipkart, a 30-day replacement policy applies (check https://www.flipkart.com/search?q=Maizic+Smarthome). If purchased from maizic.com, contact our support team at 9871142290 or visit https://www.maizic.com/contact.
- **User**: “camera kharab hai”  
  **Response**: **Maizic Smarthome Support**: Agar aapka Maizic camera kharab hai, toh yeh karein: 1) Lens ko saaf karein. 2) V380 Pro ya Tuya Smart app mein software update check karein. 3) Camera ko 5 second ke liye reset button dabakar reset karein. Aur madad ke liye, 9871142290 par sampark karein.
- **User**: “What’s the meaning of life?”  
  **Response**: **Maizic Smarthome Support**: That’s a big question! While I ponder that, how about keeping life secure with a Maizic Supercam 12MP? Check it out: https://www.amazon.in/s?k=Maizic+Smarthome.

Never invent product details, pricing, or unavailable features. If asked about pricing, say: “Please check current pricing at https://www.maizic.com, Amazon (https://www.amazon.in/s?k=Maizic+Smarthome), or Flipkart (https://www.flipkart.com/search?q=Maizic+Smarthome).”
`;

// Root endpoint
app.get("/", (req, res) => {
  res.send("✅ Maizic Smarthome Chatbot is ready to assist!");
});

// Debug endpoint
app.get("/debug", (req, res) => {
  const valid = !!process.env.OPENAI_API_KEY;
  res.json({ openai: { apiKeyValid: valid }, activeSessions: conversations.size, faqCount: Object.keys(faqs).length });
});

// Session cleanup middleware
app.use((req, res, next) => {
  const now = Date.now();
  for (const [sessionId, { lastActive }] of conversations) {
    if (now - lastActive > SESSION_TIMEOUT) {
      conversations.delete(sessionId);
    }
  }
  next();
});

// Simple fuzzy matching for FAQ search
function fuzzyMatch(query, faqKey) {
  const qWords = query.toLowerCase().split(/\s+/);
  const kWords = faqKey.toLowerCase().split(/\s+/);
  return qWords.some(qw => kWords.some(kw => kw.includes(qw) || qw.includes(kw)));
}

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId = "default" } = req.body;
    if (!message || message.length > 1000) {
      return res.status(400).json({ reply: "**Maizic Smarthome Support**:\nMessage too long or empty. Please keep it under 1000 characters!" });
    }

    // Normalize user message for FAQ matching
    const normalizedMessage = message.toLowerCase().trim();

    // Check FAQ database with fuzzy matching
    for (const [question, answer] of Object.entries(faqs)) {
      if (normalizedMessage.includes(question) || fuzzyMatch(normalizedMessage, question)) {
        await fs.appendFile("chat_logs.txt", `Session: ${sessionId}\nUser: ${message}\nBot (FAQ): ${answer}\n---\n`);
        return res.json({ reply: `**Maizic Smarthome Support**:\n${answer}` });
      }
    }

    // Get or initialize conversation history
    let conversation = conversations.get(sessionId)?.messages || [
      { role: "system", content: systemPrompt }
    ];

    // Add user message
    conversation.push({ role: "user", content: message });

    // Chat completion with optimized parameters
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: conversation,
      temperature: 0.7,
      max_tokens: 400,
      top_p: 1.0,
      presence_penalty: 0.3,
      frequency_penalty: 0.3
    });

    let reply = chatCompletion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't understand that. Could you clarify, or contact our team at 9871142290?";

    // Validate response
    if (reply.toLowerCase().includes("i don’t know") || reply.length > 600) {
      reply = "I’m not sure about that, but I’d be happy to connect you with our technical team at 9871142290 for further assistance!";
    }

    // Format response as Markdown
    reply = `**Maizic Smarthome Support**:\n${reply}`;

    // Update conversation history
    conversation.push({ role: "assistant", content: reply });
    if (conversation.length > 10) {
      conversation = [conversation[0], ...conversation.slice(-9)];
    }
    conversations.set(sessionId, { messages: conversation, lastActive: Date.now() });

    // Log interaction
    await fs.appendFile("chat_logs.txt", `Session: ${sessionId}\nUser: ${message}\nBot: ${reply}\n---\n`);

    res.json({ reply });
  } catch (error) {
    console.error("Chatbot Error:", error);
    let userReply = "Something went wrong. Please try again or contact our support team at 9871142290.";
    if (error.code === "insufficient_quota") {
      userReply = "We’re experiencing a temporary issue. Please contact our support team at 9871142290.";
    }
    await fs.appendFile("chat_logs.txt", `Session: ${req.body.sessionId || "default"}\nUser: ${req.body.message}\nError: ${error.message}\n---\n`);
    res.status(500).json({ reply: `**Maizic Smarthome Support**:\n${userReply}` });
  }
});

// Clear conversation history
app.post("/clear-session", (req, res) => {
  const { sessionId = "default" } = req.body;
  conversations.delete(sessionId);
  res.json({ reply: "**Maizic Smarthome Support**:\nSession cleared successfully." });
});

app.listen(port, () => {
  console.log(`🚀 Maizic Smarthome Chatbot running at http://localhost:${port}`);
});
