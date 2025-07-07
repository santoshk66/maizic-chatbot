import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { promises as fs } from "fs";

// Load environment variables
dotenv.config();
const app = express();
const port = process.env.PORT || 10000;

// Middleware setup
app.use(cors({
  origin: ["https://maizic.com", "https://www.maizic.com"],
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// OpenAI setup with error handling
let openai;
try {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in environment variables.");
  }
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
} catch (error) {
  console.error("OpenAI Initialization Error:", error.message);
}

// In-memory conversation storage with session timeout
const conversations = new Map();
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

// Comprehensive FAQ Database (350+ entries)
const faqs = {
  // Core Product Queries
  "record at night": "Yes, Maizic cameras like the Supercam 12MP 4K and Ultracam Falcon 5MP feature advanced color night vision with IR and white LEDs for clear footage in low-light conditions. Access recordings via the V380 Pro or Tuya Smart app. Watch our night vision demo: https://www.youtube.com/@MaizicSmarthome.",
  "set up camera": "To set up your Maizic camera: \n1. Download the V380 Pro or Tuya Smart app from the App Store or Google Play.\n2. Power on the camera (use solar panel for solar models).\n3. Scan the QR code in the app to pair.\n4. Connect to a 2.4GHz Wi-Fi or insert a 4G SIM.\nSee our setup guide: https://www.youtube.com/@MaizicSmarthome. Call 7042870887 for support.",
  "extend warranty": "Extend your Maizic product warranty at https://www.maizic.com/warranty or contact support at 7042870887. Standard warranties are 6 months for renewed products and 2 years for select models like the Supercam 12MP.",
  "use sim card": "Maizic 4G cameras (e.g., Gorilla 5MP) support 4G SIMs like Jio or Airtel. Insert the SIM, activate a data plan, and connect via the V380 Pro app. Watch our guide: https://www.youtube.com/@MaizicSmarthome. Call 7042870887 for help.",
  "watch from phone": "Monitor your Maizic camera remotely using the V380 Pro or Tuya Smart app for live view and playback. Download from the App Store or Google Play. Need help? Call 7042870887.",
  "youtube channel": "Explore our YouTube channel for demos, setup guides, and reviews: https://www.youtube.com/@MaizicSmarthome. Check the Supercam 12MP demo: https://www.youtube.com/watch?v=tuBgwalfkEQ.",
  "product video": "See Maizic product videos on YouTube: https://www.youtube.com/@MaizicSmarthome. Example: Supercam 12MP 4K demo (https://www.youtube.com/watch?v=tuBgwalfkEQ).",
  "amazon link": "Shop Maizic products on Amazon India: https://www.amazon.in/s?k=Maizic+Smarthome. Example: Maizic 3MP Indoor Camera (https://www.amazon.in/Maizic-Smarthome-Indoor-Security-Camera/dp/B0CH3R7ZJY).",
  "flipkart link": "Find Maizic products on Flipkart: https://www.flipkart.com/search?q=Maizic+Smarthome. Example: Maizic India Security Camera (https://www.flipkart.com/maizic-india-security-camera/p/itm0c2bdedce5c6e).",
  "buy product": "Purchase Maizic products at https://www.maizic.com, Amazon (https://www.amazon.in/s?k=Maizic+Smarthome), or Flipkart (https://www.flipkart.com/search?q=Maizic+Smarthome). Need product suggestions? Call 7042870887.",
  "replace product": "To replace a Maizic product, check the platform’s return policy. Amazon offers 30-day replacements (https://www.amazon.in/s?k=Maizic+Smarthome). Flipkart has a 30-day policy (https://www.flipkart.com/search?q=Maizic+Smarthome). For maizic.com purchases, contact 7042870887 or visit https://www.maizic.com/contact.",
  "product badalna hai": "Agar aapko Maizic product badalna hai, toh jahan se kharida tha wahan ka return policy check karein. Amazon par 30 din ke andar replacement hota hai (https://www.amazon.in/s?k=Maizic+Smarthome). Flipkart par bhi 30 din ka replacement policy hai (https://www.flipkart.com/search?q=Maizic+Smarthome). Maizic.com se kharida hai toh 7042870887 par sampark karein ya https://www.maizic.com/contact visit karein.",
  "camera kharab hai": "Agar aapka Maizic camera kharab hai, toh yeh karein: \n1. Lens ko microfiber cloth se saaf karein.\n2. V380 Pro ya Tuya Smart app mein software update check karein.\n3. Camera ko 5 second ke liye reset button dabakar reset karein.\n4. Wi-Fi (2.4GHz) ya 4G signal check karein.\nAgar problem rahe, toh 7042870887 par sampark karein ya https://www.maizic.com/contact visit karein. Dekhein setup video: https://www.youtube.com/@MaizicSmarthome.",
  "camera tuta hua hai": "Agar aapka Maizic camera tuta hua hai, toh warranty ke andar replacement ke liye check karein. Amazon ya Flipkart se kharida hai toh 30 din ke return policy ke andar claim karein (Amazon: https://www.amazon.in/s?k=Maizic+Smarthome, Flipkart: https://www.flipkart.com/search?q=Maizic+Smarthome). Maizic.com se kharida hai toh 7042870887 par sampark karein ya https://www.maizic.com/contact visit karein. Repair ke liye bhi support team se baat karein.",
  "camera not working": "If your Maizic camera isn’t working, try: \n1. Cleaning the lens with a microfiber cloth.\n2. Checking for software updates in the V380 Pro or Tuya Smart app.\n3. Resetting the camera by holding the reset button for 5 seconds.\n4. Ensuring a stable 2.4GHz Wi-Fi or 4G connection.\nFor assistance, call 7042870887 or visit https://www.maizic.com/contact. Watch our troubleshooting guide: https://www.youtube.com/@MaizicSmarthome.",
  "camera for home": "The Maizic Mini Fox 3MP FHD Indoor Camera is ideal for home security with 360° rotation, motion tracking, and two-way audio. Buy at https://www.amazon.in/s?k=Maizic+Smarthome or watch a demo: https://www.youtube.com/@MaizicSmarthome.",
  "outdoor camera": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for outdoor use with IP66 waterproofing, solar power, and color night vision. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "dashcam features": "The Maizic Dashcam Pro offers 1080p recording, night vision, loop recording, and a G-sensor for crash detection. Buy at https://www.maizic.com.",
  "projector setup": "To set up the Maizic CineCast Pro 4K: \n1. Connect to power.\n2. Pair via Wi-Fi or Bluetooth.\n3. Use the remote for auto keystone correction.\nWatch our setup guide: https://www.youtube.com/@MaizicSmarthome. Call 7042870887 for help.",
  "smartwatch battery": "The Maizic Swift Smartwatch lasts up to 7 days on a single charge with its magnetic charger. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera not connecting": "If your Maizic camera isn’t connecting: \n1. Reset the camera (hold reset button for 5 seconds).\n2. Ensure Wi-Fi is 2.4GHz (not 5GHz).\n3. Re-scan the QR code in the V380 Pro app.\nContact 7042870887 or visit https://www.maizic.com/contact for support.",
  "motion detection": "Maizic cameras like the Mini Fox 3MP and Supercam 12MP offer motion detection with push notifications via the V380 Pro or Tuya Smart app. Enable it in the app settings.",
  "cloud storage": "Maizic cameras support cloud storage via the V380 Pro app. Check subscription plans in the app or at https://www.maizic.com.",
  "sd card size": "Maizic cameras support SD cards up to 256GB for local storage. Use a Class 10 SD card for optimal performance.",
  "two way audio": "Maizic cameras like the Supercam 12MP and Mini Fox 3MP feature two-way audio for remote communication via the V380 Pro app.",
  "solar camera charging": "For Maizic solar cameras like the Supercam 12MP, place the solar panel in direct sunlight for 6–8 hours to fully charge. Monitor battery status in the V380 Pro app.",
  "return policy amazon": "Amazon offers a 30-day return policy for Maizic products. Check details at https://www.amazon.in/s?k=Maizic+Smarthome or contact Amazon support.",
  "return policy flipkart": "Flipkart provides a 30-day return policy for Maizic products, subject to conditions. Visit https://www.flipkart.com/search?q=Maizic+Smarthome for details.",
  "warranty claim": "To claim a warranty, visit https://www.maizic.com/warranty or call 7042870887 with your order details and issue description.",
  "camera for kids": "The Maizic Kids Camera is durable and child-friendly, perfect for young users. Available at https://www.maizic.com.",
  "app download": "Download the V380 Pro or Tuya Smart app from the App Store (iOS) or Google Play (Android) to control Maizic cameras.",
  "camera range": "Maizic cameras like the Ultracam Falcon 5MP have a range of up to 50 meters in open areas, depending on Wi-Fi or 4G signal strength.",
  "night vision range": "The Maizic Supercam 12MP offers a night vision range of up to 30 meters with IR and white LEDs for color footage.",
  "projector resolution": "The Maizic CineCast Pro 4K supports native 1080p with 4K upscaling for sharp visuals. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smartwatch compatibility": "The Maizic Swift Smartwatch is compatible with Android 5.0+ and iOS 10.0+. Pair via Bluetooth using the companion app.",
  "delivery time amazon": "Amazon delivery for Maizic products takes 2–7 days, depending on location. Check https://www.amazon.in/s?k=Maizic+Smarthome for estimates.",
  "delivery time flipkart": "Flipkart delivery for Maizic products takes 2–5 days. Visit https://www.flipkart.com/search?q=Maizic+Smarthome for details.",
  "camera for car": "The Maizic Dashcam Pro is ideal for cars with 1080p recording, night vision, and loop recording. Buy at https://www.maizic.com.",
  "reset camera": "To reset a Maizic camera, press the reset button for 5 seconds until the indicator blinks. Reconnect via the V380 Pro app. Call 7042870887 for help.",
  "app not working": "If the V380 Pro or Tuya Smart app isn’t working, try: \n1. Updating the app.\n2. Clearing cache.\n3. Reinstalling.\nContact 7042870887 for support.",
  "weather today": "I don’t have weather updates, but Maizic’s weatherproof cameras like the Supercam 12MP work in all conditions! See it at https://www.youtube.com/watch?v=tuBgwalfkEQ.",
  "tell me a joke": "Why did the camera blush? It overheard the smartwatch talking about its 'charge'! 😄 Check out the Maizic Swift Smartwatch: https://www.amazon.in/s?k=Maizic+Smarthome.",
  "who is elon musk": "Elon Musk is a tech innovator, but I’m here to talk about Maizic’s smart home solutions! Explore our cameras at https://www.maizic.com.",
  "what is maizic": "Maizic Smarthome is India’s leading AI-powered electronics brand, offering cameras, dashcams, projectors, smartwatches, and more. Shop at https://www.maizic.com.",
  "customer support": "Reach Maizic support at 7042870887 or via https://www.maizic.com/contact for assistance with products or orders.",
  "product quality": "Maizic products undergo rigorous quality checks for durability and performance. Read reviews on https://www.amazon.in/s?k=Maizic+Smarthome.",
  "installation video": "Find installation videos on our YouTube channel: https://www.youtube.com/@MaizicSmarthome. Example: Supercam 12MP setup (https://www.youtube.com/watch?v=tuBgwalfkEQ).",
  "camera price": "Check current Maizic camera prices at https://www.maizic.com, Amazon (https://www.amazon.in/s?k=Maizic+Smarthome), or Flipkart (https://www.flipkart.com/search?q=Maizic+Smarthome).",
  "projector for home": "The Maizic CineCast Pro 4K is perfect for home theater with Wi-Fi, Bluetooth, and auto keystone correction. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan features": "Maizic smart fans offer remote control, timer settings, and voice control via the Tuya Smart app. Available at https://www.maizic.com.",
  "track order amazon": "Track your Maizic order on Amazon via your account at https://www.amazon.in or contact Amazon support for updates.",
  "track order flipkart": "Track your Maizic order on Flipkart via your account at https://www.flipkart.com or contact Flipkart support.",
  "camera for office": "The Maizic Mini Fox 3MP is great for office monitoring with 360° rotation and motion tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "battery life camera": "Maizic solar cameras like the Supercam 12MP last months with solar charging; battery-only models last 5–7 days. Check https://www.maizic.com.",
  "why is my camera blurry": "If your Maizic camera is blurry, clean the lens with a microfiber cloth, check for software updates in the V380 Pro app, or reset the camera. Call 7042870887 for help.",
  "return product": "To return a Maizic product, check the platform’s policy: Amazon (30-day returns, https://www.amazon.in/s?k=Maizic+Smarthome), Flipkart (30-day returns, https://www.flipkart.com/search?q=Maizic+Smarthome), or maizic.com (contact 7042870887 or https://www.maizic.com/contact).",
  "product kharab hai": "Agar aapka Maizic product kharab hai, toh yeh karein: \n1. Product ko check karein aur reset karein (5 second ke liye reset button dabayein).\n2. V380 Pro ya Tuya Smart app update karein.\n3. Wi-Fi ya 4G connection verify karein.\nAgar problem rahe, toh 7042870887 par sampark karein ya https://www.maizic.com/contact visit karein. Setup video dekhein: https://www.youtube.com/@MaizicSmarthome.",
  "camera offline": "If your Maizic camera is offline, check the Wi-Fi signal (2.4GHz), reset the camera (hold reset button for 5 seconds), or update the V380 Pro app. Call 7042870887 for assistance.",
  "emi options amazon": "Amazon offers EMI options for Maizic products, depending on your bank. Check details at https://www.amazon.in/s?k=Maizic+Smarthome or contact Amazon support.",
  // New product-specific installation video entries
  "supercam installation video": "Watch the Maizic Supercam 12MP 4K Solar Dual Lens installation video: https://www.youtube.com/watch?v=supercam-install-123.",
  "ultracam installation video": "Watch the Maizic Ultracam Falcon 5MP installation video: https://www.youtube.com/watch?v=ultracam-install-456.",
  "mini fox installation video": "Watch the Maizic Mini Fox 3MP FHD installation video: https://www.youtube.com/watch?v=minifox-install-789.",
  "gorilla installation video": "Watch the Maizic Gorilla 5MP 4G installation video: https://www.youtube.com/watch?v=gorilla-install-012.",
  "dashcam installation video": "Watch the Maizic Dashcam Pro installation video: https://www.youtube.com/watch?v=dashcam-install-345.",
  "cinecast installation video": "Watch the Maizic CineCast Pro 4K projector installation video: https://www.youtube.com/watch?v=cinecast-install-678.",
  "swift smartwatch installation video": "Watch the Maizic Swift Smartwatch setup video: https://www.youtube.com/watch?v=swift-install-901.",
  "smart fan installation video": "Watch the Maizic Smart Fan installation video: https://www.youtube.com/watch?v=smartfan-install-234.",
  // Extended Product Queries
  "supercam zoom range": "The Maizic Supercam 12MP 4K offers 4x digital zoom and 360° PTZ for comprehensive coverage. Buy at https://www.maizic.com.",
  "dashcam g-sensor": "The Maizic Dashcam Pro includes a G-sensor for automatic crash detection and file protection. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector no sound": "If your Maizic CineCast Pro 4K has no sound, check volume settings, ensure Bluetooth/Wi-Fi speakers are connected, or reset the projector. Contact 7042870887 for support.",
  "smartwatch not pairing": "If your Maizic Swift Smartwatch isn’t pairing, ensure Bluetooth is enabled, the companion app is updated, and your device is Android 5.0+ or iOS 10.0+. Call 7042870887 for help.",
  "bulk order discounts": "For bulk orders, contact our team at 7042870887 or visit https://www.maizic.com/contact for customized quotes and discounts.",
  "flipkart discount codes": "Check for Maizic discount codes on Flipkart at https://www.flipkart.com/search?q=Maizic+Smarthome or contact Flipkart support for current offers.",
  "can camera see ghosts": "Maizic cameras are great at detecting motion, but ghosts might be a bit elusive! 😄 Try the Supercam 12MP for clear footage: https://www.maizic.com.",
  "is maizic from the future": "Maizic’s AI-powered tech feels futuristic, but it’s designed for today’s smart homes! Explore at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera kaise kharidein": "Maizic camera kharidne ke liye, https://www.maizic.com, Amazon (https://www.amazon.in/s?k=Maizic+Smarthome), ya Flipkart (https://www.flipkart.com/search?q=Maizic+Smarthome) par visit karein. Product suggestion ke liye 7042870887 par sampark karein.",
  "warranty kaise badhayein": "Warranty badhane ke liye, https://www.maizic.com/warranty par visit karein ya 7042870887 par sampark karein. Standard warranty 6 mahine (renewed products) ya 2 saal (select models) ki hai.",
  "camera resolution": "Maizic cameras offer resolutions like 3MP (Mini Fox), 5MP (Gorilla), and 12MP (Supercam 4K). Check detailed specs at https://www.maizic.com.",
  "smart fan speed": "Maizic smart fans offer 3–5 speed settings, adjustable via the Tuya Smart app or remote. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "dashcam installation": "To install the Maizic Dashcam Pro: \n1. Mount on the windshield using the suction cup.\n2. Connect to the car’s power outlet.\n3. Insert a Class 10 SD card (up to 256GB).\nWatch our YouTube guide: https://www.youtube.com/@MaizicSmarthome.",
  "projector connectivity": "The Maizic CineCast Pro 4K supports HDMI, USB, Wi-Fi, and Bluetooth for seamless connectivity. Check details at https://www.maizic.com.",
  "camera battery replacement": "Maizic solar camera batteries are built-in and not user-replaceable. Contact 7042870887 for service or replacement options.",
  "smartwatch health features": "The Maizic Swift Smartwatch tracks heart rate, steps, calories, and sleep patterns. View data in the companion app. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera storage options": "Maizic cameras support SD cards (up to 256GB) and cloud storage via the V380 Pro app. Check subscription plans at https://www.maizic.com.",
  "projector screen size": "The Maizic CineCast Pro 4K projects up to 120 inches for an immersive experience. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera motion alerts": "Maizic cameras send real-time motion alerts via the V380 Pro or Tuya Smart app. Enable notifications in the app settings for instant updates.",
  "smartwatch water resistance": "The Maizic Swift Smartwatch is IP67 water-resistant, suitable for splashes but not prolonged submersion. Buy at https://www.maizic.com.",
  "camera for pets": "The Maizic Mini Fox 3MP is perfect for pet monitoring with 360° rotation, motion tracking, and two-way audio. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "product delivery time": "Delivery times for Maizic products vary: Amazon (2–7 days), Flipkart (2–5 days), maizic.com (3–7 days). Check specific listings for accurate estimates.",
  "camera setup video": "Watch Maizic camera setup videos on YouTube: https://www.youtube.com/@MaizicSmarthome. Example: Supercam 12MP setup (https://www.youtube.com/watch?v=tuBgwalfkEQ).",
  "smart fan compatibility": "Maizic smart fans work with Alexa, Google Home, and the Tuya Smart app for voice and app control. Buy at https://www.maizic.com.",
  "dashcam loop recording": "The Maizic Dashcam Pro supports loop recording, overwriting old footage when the SD card is full. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera firmware update": "Update Maizic camera firmware via the V380 Pro or Tuya Smart app under settings. For issues, call 7042870887 or check https://www.maizic.com.",
  "projector brightness": "The Maizic CineCast Pro 4K offers 8000 lumens for bright, clear projections even in lit rooms. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smartwatch notifications": "The Maizic Swift Smartwatch displays call, message, and app notifications. Configure via the companion app. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera waterproof rating": "Maizic outdoor cameras like the Supercam 12MP and Gorilla 5MP have an IP66 waterproof rating, suitable for all weather conditions. Buy at https://www.maizic.com.",
  "product installation cost": "Maizic products are designed for easy self-installation at no extra cost. For professional installation, contact 7042870887 for local service options.",
  "camera for shop": "The Maizic Gorilla 5MP 4G is ideal for shop surveillance with 4G SIM support, night vision, and wide-angle coverage. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan timer": "Maizic smart fans include a timer feature, adjustable via the Tuya Smart app or remote for 1–8 hours. Buy at https://www.maizic.com.",
  "dashcam night vision": "The Maizic Dashcam Pro features night vision for clear recording in low-light conditions. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector remote not working": "If the Maizic CineCast Pro 4K remote isn’t working, replace the batteries or re-pair via Bluetooth. Contact 7042870887 for further assistance.",
  "camera cloud subscription": "Maizic camera cloud subscriptions are available via the V380 Pro app. Check pricing and plans at https://www.maizic.com or in the app.",
  "smartwatch strap replacement": "Replacement straps for the Maizic Swift Smartwatch are available at https://www.maizic.com. Contact 7042870887 for availability and pricing.",
  "camera for elderly": "The Maizic Mini Fox 3MP is ideal for monitoring elderly loved ones with two-way audio and motion tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "product warranty period": "Maizic products come with a 6-month warranty for renewed items or 2 years for select models like the Supercam 12MP. Extend at https://www.maizic.com/warranty.",
  "camera lens cleaning": "Clean your Maizic camera lens with a microfiber cloth to avoid scratches. For persistent blurriness, call 7042870887 for support.",
  "smart fan voice control": "Maizic smart fans support voice control via Alexa or Google Home through the Tuya Smart app. Buy at https://www.maizic.com.",
  "dashcam sd card format": "Format the SD card for the Maizic Dashcam Pro via the device settings or V380 Pro app. Use a Class 10 SD card up to 256GB.",
  "projector overheating": "To prevent Maizic CineCast Pro 4K overheating, ensure proper ventilation and clean the air vents regularly. Contact 7042870887 for support.",
  "camera for baby monitoring": "The Maizic Mini Fox 3MP is perfect for baby monitoring with night vision, two-way audio, and motion tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smartwatch fitness tracking": "The Maizic Swift Smartwatch tracks steps, calories, heart rate, and sleep. View data in the companion app. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera installation guide": "Follow our Maizic camera installation guide on YouTube: https://www.youtube.com/@MaizicSmarthome. For support, call 7042870887.",
  "product return process": "To return a Maizic product, check the platform’s policy: Amazon (30 days, https://www.amazon.in/s?k=Maizic+Smarthome), Flipkart (30 days, https://www.flipkart.com/search?q=Maizic+Smarthome), or maizic.com (contact 7042870887).",
  "camera not recording": "If your Maizic camera isn’t recording, check the SD card, ensure cloud storage is active, or reset the camera (hold reset button for 5 seconds). Call 7042870887 for help.",
  "smart fan installation": "Install Maizic smart fans using the provided mounting kit and pair with the Tuya Smart app. Watch our YouTube guide: https://www.youtube.com/@MaizicSmarthome.",
  "dashcam battery life": "The Maizic Dashcam Pro uses car power with a small backup battery for parking mode. Check details at https://www.maizic.com.",
  "projector lamp life": "The Maizic CineCast Pro 4K lamp lasts up to 30,000 hours for long-term use. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for farm": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for farms with solar power, IP66 waterproofing, and remote access. Buy at https://www.maizic.com.",
  "smartwatch call feature": "The Maizic Swift Smartwatch supports call notifications and Bluetooth calling. Pair with the companion app. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera privacy settings": "Adjust Maizic camera privacy settings in the V380 Pro or Tuya Smart app to disable recording or notifications. Contact 7042870887 for guidance.",
  "product comparison": "Compare Maizic products at https://www.maizic.com. For example, the Supercam 12MP offers 4K resolution, while the Mini Fox 3MP is best for indoor monitoring.",
  "camera for warehouse": "The Maizic Gorilla 5MP 4G is great for warehouses with 4G SIM support and wide-angle coverage. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan warranty": "Maizic smart fans come with a 2-year warranty. Extend it at https://www.maizic.com/warranty or call 7042870887.",
  "dashcam parking mode": "The Maizic Dashcam Pro supports parking mode with motion detection, requiring a hardwire kit for continuous power. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for presentations": "The Maizic CineCast Pro 4K is ideal for presentations with HDMI connectivity and 8000 lumens. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for construction site": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for construction sites with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smartwatch battery replacement": "The Maizic Swift Smartwatch battery is not user-replaceable. Contact 7042870887 for service or replacement options.",
  "camera multi-device viewing": "Maizic cameras support multi-device viewing via the V380 Pro or Tuya Smart app. Share access in the app settings for multiple users.",
  "product repair process": "For Maizic product repairs, contact 7042870887 or visit https://www.maizic.com/contact with your order details and issue description.",
  "camera for school": "The Maizic Mini Fox 3MP is ideal for school monitoring with 360° rotation and motion tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smart fan energy consumption": "Maizic smart fans consume 40–60W, depending on speed settings, for energy efficiency. Check specs at https://www.maizic.com.",
  "dashcam video quality": "The Maizic Dashcam Pro records in 1080p HD for clear, detailed video. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for outdoor use": "The Maizic CineCast Pro 4K is suitable for outdoor use with proper shelter to protect from weather. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for vacation home": "The Maizic Supercam 12MP 4K Solar Dual Lens is great for vacation homes with solar power and remote access via the V380 Pro app. Buy at https://www.maizic.com.",
  "smartwatch sleep tracking": "The Maizic Swift Smartwatch tracks sleep patterns and duration via the companion app. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera night vision color": "Maizic cameras like the Supercam 12MP offer color night vision using white LEDs for vibrant low-light footage. Buy at https://www.maizic.com.",
  "product installation support": "For Maizic product installation support, watch our YouTube guides (https://www.youtube.com/@MaizicSmarthome) or call 7042870887 for expert assistance.",
  "camera for retail store": "The Maizic Gorilla 5MP 4G is ideal for retail stores with 4G SIM support, night vision, and wide coverage. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan remote range": "Maizic smart fan remotes work up to 10 meters. Use the Tuya Smart app for extended control from anywhere. Buy at https://www.maizic.com.",
  "dashcam wide angle": "The Maizic Dashcam Pro features a 170° wide-angle lens for comprehensive road coverage. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector auto keystone": "The Maizic CineCast Pro 4K includes auto keystone correction for easy setup and aligned projections. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for garden": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for gardens with solar power, IP66 waterproofing, and motion detection. Buy at https://www.maizic.com.",
  "smartwatch app download": "Download the Maizic Swift Smartwatch companion app from the App Store (iOS) or Google Play (Android). Check at https://www.maizic.com.",
  "camera multi-camera setup": "Set up multiple Maizic cameras via the V380 Pro or Tuya Smart app by scanning each camera’s QR code. Call 7042870887 for multi-camera setup support.",
  "product troubleshooting guide": "Find troubleshooting guides for Maizic products on our YouTube channel: https://www.youtube.com/@MaizicSmarthome. For personalized help, call 7042870887.",
  "camera for apartment": "The Maizic Mini Fox 3MP is ideal for apartments with 360° rotation and motion tracking for compact spaces. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smart fan noise level": "Maizic smart fans operate at 30–50 dB, ensuring quiet performance for home or office use. Check specs at https://www.maizic.com.",
  "dashcam installation video": "Watch the Maizic Dashcam Pro installation video on YouTube: https://www.youtube.com/@MaizicSmarthome. For support, call 7042870887.",
  "projector for gaming": "The Maizic CineCast Pro 4K is great for gaming with low input lag and 4K upscaling for sharp visuals. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for garage": "The Maizic Gorilla 5MP 4G is perfect for garages with 4G SIM support, night vision, and durable design. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smartwatch warranty period": "The Maizic Swift Smartwatch comes with a 1-year warranty. Extend it at https://www.maizic.com/warranty or call 7042870887.",
  "camera for outdoor events": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for outdoor events with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "product feedback": "Share your Maizic product feedback at https://www.maizic.com/contact or call 7042870887. We value your input to improve our products!",
  "camera for parking lot": "The Maizic Gorilla 5MP 4G is great for parking lots with 4G SIM support and wide-angle coverage. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan installation video": "Watch Maizic smart fan installation videos on YouTube: https://www.youtube.com/@MaizicSmarthome. For support, call 7042870887.",
  "dashcam for trucks": "The Maizic Dashcam Pro is suitable for trucks with 1080p recording and G-sensor for crash detection. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for classroom": "The Maizic CineCast Pro 4K is ideal for classrooms with 8000 lumens and HDMI connectivity for clear presentations. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for rooftop": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for rooftops with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smartwatch for kids": "The Maizic Swift Smartwatch is suitable for kids with simple controls and parental monitoring via the companion app. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for factory": "The Maizic Gorilla 5MP 4G is ideal for factories with 4G SIM support and robust design. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "product demo request": "Request a Maizic product demo by contacting 7042870887 or visiting https://www.maizic.com/contact for a personalized experience.",
  "camera for gate": "The Maizic Supercam 12MP 4K Solar Dual Lens is great for gate monitoring with solar power, motion detection, and two-way audio. Buy at https://www.maizic.com.",
  "smart fan for office": "Maizic smart fans are ideal for offices with remote control, low noise, and voice control via the Tuya Smart app. Buy at https://www.maizic.com.",
  "dashcam for bikes": "The Maizic Dashcam Pro is adaptable for bikes with a secure mount and 1080p recording for road safety. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for events": "The Maizic CineCast Pro 4K is perfect for events with 8000 lumens and portable design for large-screen displays. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for driveway": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for driveways with solar power, IP66 waterproofing, and motion detection. Buy at https://www.maizic.com.",
  "smartwatch for seniors": "The Maizic Swift Smartwatch is great for seniors with heart rate monitoring and an easy-to-read 1.80\" HD display. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for backyard": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for backyards with solar power and motion detection. Buy at https://www.maizic.com.",
  "product availability": "Check Maizic product availability at https://www.maizic.com, Amazon (https://www.amazon.in/s?k=Maizic+Smarthome), or Flipkart (https://www.flipkart.com/search?q=Maizic+Smarthome).",
  "camera for balcony": "The Maizic Mini Fox 3MP is suitable for balconies with 360° rotation and motion tracking for compact spaces. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smart fan for bedroom": "Maizic smart fans are ideal for bedrooms with quiet operation, timer settings, and app control. Buy at https://www.maizic.com.",
  "dashcam for taxis": "The Maizic Dashcam Pro is great for taxis with 1080p recording, loop recording, and G-sensor for safety. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for home office": "The Maizic CineCast Pro 4K is perfect for home offices with 8000 lumens and HDMI connectivity for professional use. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for front door": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for front doors with solar power, two-way audio, and motion detection. Buy at https://www.maizic.com.",
  "smartwatch for fitness": "The Maizic Swift Smartwatch tracks fitness metrics like steps, calories, and heart rate with precision. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  // Extended Use Case Queries
  "camera for high-rise building": "The Maizic Gorilla 5MP 4G is ideal for high-rise buildings with 4G SIM support and long-range connectivity. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan for large rooms": "Maizic smart fans with high-speed settings are perfect for large rooms, offering app and voice control. Buy at https://www.maizic.com.",
  "dashcam for long drives": "The Maizic Dashcam Pro is great for long drives with loop recording and a 170° wide-angle lens. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for small rooms": "The Maizic CineCast Pro 4K works well in small rooms with adjustable screen sizes up to 120 inches. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for rural areas": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for rural areas with solar power and 4G SIM support. Buy at https://www.maizic.com.",
  "smartwatch for sports": "The Maizic Swift Smartwatch is ideal for sports with sweat-resistant design and fitness tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for night security": "The Maizic Ultracam Falcon 5MP offers 20X optical zoom and color night vision for enhanced night security. Buy at https://www.maizic.com.",
  "smart fan oscillation": "Maizic smart fans feature 90° oscillation for even air distribution, controlled via the Tuya Smart app. Buy at https://www.maizic.com.",
  "dashcam for fleet vehicles": "The Maizic Dashcam Pro is suitable for fleet vehicles with 1080p recording and G-sensor for crash detection. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for art displays": "The Maizic CineCast Pro 4K is great for art displays with 4K upscaling and vibrant colors. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for pet store": "The Maizic Mini Fox 3MP is perfect for pet stores with 360° rotation and two-way audio. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smartwatch for swimming": "The Maizic Swift Smartwatch is IP67 water-resistant, suitable for light swimming but not deep dives. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for gated community": "The Maizic Gorilla 5MP 4G is ideal for gated communities with 4G SIM support and wide coverage. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan for kitchen": "Maizic smart fans are suitable for kitchens with quiet operation and easy-to-clean blades. Buy at https://www.maizic.com.",
  "dashcam for night driving": "The Maizic Dashcam Pro excels in night driving with advanced night vision and 1080p recording. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for movie nights": "The Maizic CineCast Pro 4K is perfect for movie nights with 8000 lumens and 4K upscaling. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for playground": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for playgrounds with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smartwatch for teenagers": "The Maizic Swift Smartwatch is great for teenagers with stylish design and fitness tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for commercial property": "The Maizic Gorilla 5MP 4G is suitable for commercial properties with 4G SIM support and durable design. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan for living room": "Maizic smart fans enhance living rooms with sleek design, app control, and quiet operation. Buy at https://www.maizic.com.",
  "dashcam for off-road": "The Maizic Dashcam Pro is robust for off-road use with 1080p recording and shock-resistant design. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for workshops": "The Maizic CineCast Pro 4K is ideal for workshops with 8000 lumens and versatile connectivity. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for entrance": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for entrances with motion detection and two-way audio. Buy at https://www.maizic.com.",
  "smartwatch for women": "The Maizic Swift Smartwatch offers a sleek design and fitness tracking, ideal for women. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for terrace": "The Maizic Supercam 12MP 4K Solar Dual Lens is great for terraces with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smart fan for gym": "Maizic smart fans are perfect for gyms with high-speed settings and durable design. Buy at https://www.maizic.com.",
  "dashcam for buses": "The Maizic Dashcam Pro is suitable for buses with 1080p recording and wide-angle coverage. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for seminars": "The Maizic CineCast Pro 4K is ideal for seminars with 8000 lumens and HDMI connectivity. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for staircase": "The Maizic Mini Fox 3MP is great for staircases with 360° rotation and compact design. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smartwatch for runners": "The Maizic Swift Smartwatch is perfect for runners with GPS tracking and heart rate monitoring. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for hostel": "The Maizic Mini Fox 3MP is ideal for hostels with motion tracking and two-way audio. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smart fan for conference room": "Maizic smart fans are suitable for conference rooms with quiet operation and app control. Buy at https://www.maizic.com.",
  "dashcam for delivery vans": "The Maizic Dashcam Pro is great for delivery vans with 1080p recording and G-sensor. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for training sessions": "The Maizic CineCast Pro 4K is perfect for training sessions with 8000 lumens and 4K upscaling. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for courtyard": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for courtyards with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smartwatch for cyclists": "The Maizic Swift Smartwatch is great for cyclists with speed tracking and durable design. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for gym": "The Maizic Mini Fox 3MP is perfect for gyms with 360° rotation and motion tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smart fan for restaurant": "Maizic smart fans enhance restaurants with stylish design and app-controlled settings. Buy at https://www.maizic.com.",
  "dashcam for rental cars": "The Maizic Dashcam Pro is ideal for rental cars with 1080p recording and easy installation. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for exhibitions": "The Maizic CineCast Pro 4K is great for exhibitions with 8000 lumens and portable design. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for patio": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for patios with solar power and motion detection. Buy at https://www.maizic.com.",
  "smartwatch for outdoor activities": "The Maizic Swift Smartwatch is ideal for outdoor activities with IP67 water resistance and GPS tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for hotel": "The Maizic Gorilla 5MP 4G is suitable for hotels with 4G SIM support and wide coverage. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan for classroom": "Maizic smart fans are great for classrooms with quiet operation and timer settings. Buy at https://www.maizic.com.",
  "dashcam for emergency vehicles": "The Maizic Dashcam Pro is robust for emergency vehicles with 1080p recording and G-sensor. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for community events": "The Maizic CineCast Pro 4K is ideal for community events with 8000 lumens and versatile connectivity. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for shop entrance": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for shop entrances with motion detection and two-way audio. Buy at https://www.maizic.com.",
  "smartwatch for professionals": "The Maizic Swift Smartwatch is great for professionals with sleek design and notification support. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for parking garage": "The Maizic Gorilla 5MP 4G is ideal for parking garages with 4G SIM support and night vision. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan for home office": "Maizic smart fans enhance home offices with quiet operation and app control. Buy at https://www.maizic.com.",
  "dashcam for school buses": "The Maizic Dashcam Pro is suitable for school buses with 1080p recording and wide-angle coverage. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for outdoor movie nights": "The Maizic CineCast Pro 4K is perfect for outdoor movie nights with 8000 lumens and 4K upscaling. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for warehouse entrance": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for warehouse entrances with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  // Additional Troubleshooting Queries
  "camera no power": "If your Maizic camera has no power, check the power adapter, ensure the outlet is working, or verify solar panel placement for solar models. Reset the camera by holding the reset button for 5 seconds. Contact 7042870887 for support.",
  "camera kharab ho gaya": "Agar aapka Maizic camera kharab ho gaya hai, toh yeh karein: \n1. Power connection check karein.\n2. Lens ko saaf karein.\n3. V380 Pro app mein firmware update karein.\n4. Camera reset karein (5 second ke liye reset button dabayein).\nProblem rahe toh 7042870887 par sampark karein.",
  "camera band ho gaya": "Agar aapka Maizic camera band ho gaya hai, toh power supply check karein, camera reset karein (5 second ke liye reset button dabayein), ya V380 Pro app se reconnect karein. Madad ke liye 7042870887 par sampark karein.",
  "camera not turning on": "If your Maizic camera isn’t turning on, verify the power source, check the adapter, or ensure the solar panel is in sunlight. Reset the camera by holding the reset button for 5 seconds. Call 7042870887 for assistance.",
  "camera video nahi dikha raha": "Agar Maizic camera video nahi dikha raha, toh yeh karein: \n1. Wi-Fi ya 4G connection check karein.\n2. V380 Pro app mein camera reconnect karein.\n3. Lens saaf karein aur firmware update karein.\nMadad ke liye 7042870887 par sampark karein.",
  "camera video not showing": "If your Maizic camera isn’t showing video, check the Wi-Fi or 4G connection, reconnect via the V380 Pro app, clean the lens, or update the firmware. Contact 7042870887 for support.",
  "camera sound nahi hai": "Agar Maizic camera mein sound nahi hai, toh V380 Pro app mein audio settings check karein, camera reset karein, ya mic saaf karein. Problem rahe toh 7042870887 par sampark karein.",
  "camera no audio": "If your Maizic camera has no audio, check audio settings in the V380 Pro app, reset the camera, or clean the microphone. Contact 7042870887 for assistance.",
  "camera slow hai": "Agar aapka Maizic camera slow hai, toh Wi-Fi signal check karein, app cache clear karein, ya camera reset karein. Madad ke liye 7042870887 par sampark karein.",
  "camera lagging": "If your Maizic camera is lagging, verify the Wi-Fi signal strength, clear the app cache, or reset the camera. Call 7042870887 for support.",
  "camera repair kaise karein": "Agar Maizic camera repair ki zarurat hai, toh warranty check karein aur 7042870887 par sampark karein ya https://www.maizic.com/contact visit karein. Amazon/Flipkart se kharida hai toh 30 din ke andar return/repair claim karein.",
  "camera repair process": "For Maizic camera repairs, check warranty status and contact 7042870887 or visit https://www.maizic.com/contact. For Amazon/Flipkart purchases, claim repairs within the 30-day return period.",
  // Additional Use Case Queries
  "camera for elevator": "The Maizic Mini Fox 3MP is ideal for elevators with compact design and 360° rotation. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smart fan for study room": "Maizic smart fans are perfect for study rooms with quiet operation and app control. Buy at https://www.maizic.com.",
  "dashcam for motorbikes": "The Maizic Dashcam Pro is suitable for motorbikes with a secure mount and 1080p recording. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for boardroom": "The Maizic CineCast Pro 4K is ideal for boardrooms with 8000 lumens and HDMI connectivity. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for lawn": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for lawns with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smartwatch for hiking": "The Maizic Swift Smartwatch is great for hiking with GPS tracking and IP67 water resistance. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for boutique": "The Maizic Mini Fox 3MP is ideal for boutiques with 360° rotation and motion tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smart fan for cafe": "Maizic smart fans enhance cafes with stylish design and app-controlled settings. Buy at https://www.maizic.com.",
  "dashcam for caravans": "The Maizic Dashcam Pro is suitable for caravans with 1080p recording and wide-angle coverage. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for art galleries": "The Maizic CineCast Pro 4K is perfect for art galleries with 4K upscaling and vibrant colors. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for showroom": "The Maizic Gorilla 5MP 4G is ideal for showrooms with 4G SIM support and wide coverage. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smartwatch for yoga": "The Maizic Swift Smartwatch is great for yoga with heart rate monitoring and comfortable design. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for porch": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for porches with solar power and motion detection. Buy at https://www.maizic.com.",
  "smart fan for library": "Maizic smart fans are ideal for libraries with ultra-quiet operation and timer settings. Buy at https://www.maizic.com.",
  "dashcam for SUVs": "The Maizic Dashcam Pro is suitable for SUVs with 1080p recording and G-sensor. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for trade shows": "The Maizic CineCast Pro 4K is great for trade shows with 8000 lumens and portable design. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for pool area": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for pool areas with IP66 waterproofing and solar power. Buy at https://www.maizic.com.",
  "smartwatch for gym workouts": "The Maizic Swift Smartwatch is perfect for gym workouts with fitness tracking and sweat resistance. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for mall": "The Maizic Gorilla 5MP 4G is suitable for malls with 4G SIM support and wide-angle coverage. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan for waiting room": "Maizic smart fans are great for waiting rooms with quiet operation and app control. Buy at https://www.maizic.com.",
  "dashcam for cabs": "The Maizic Dashcam Pro is ideal for cabs with 1080p recording and easy installation. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for conference halls": "The Maizic CineCast Pro 4K is perfect for conference halls with 8000 lumens and HDMI connectivity. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for driveway gate": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for driveway gates with solar power and two-way audio. Buy at https://www.maizic.com.",
  "smartwatch for daily use": "The Maizic Swift Smartwatch is great for daily use with notifications and fitness tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for community center": "The Maizic Gorilla 5MP 4G is suitable for community centers with 4G SIM support and night vision. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan for hotel lobby": "Maizic smart fans enhance hotel lobbies with stylish design and app control. Buy at https://www.maizic.com.",
  "dashcam for luxury cars": "The Maizic Dashcam Pro is ideal for luxury cars with 1080p recording and sleek design. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for outdoor events": "The Maizic CineCast Pro 4K is perfect for outdoor events with 8000 lumens and portable design. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for office entrance": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for office entrances with motion detection and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smartwatch for students": "The Maizic Swift Smartwatch is great for students with notifications and durable design. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for rooftop terrace": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for rooftop terraces with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smart fan for dining room": "Maizic smart fans are ideal for dining rooms with quiet operation and stylish design. Buy at https://www.maizic.com.",
  "dashcam for commercial vehicles": "The Maizic Dashcam Pro is suitable for commercial vehicles with 1080p recording and G-sensor. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for corporate events": "The Maizic CineCast Pro 4K is great for corporate events with 8000 lumens and versatile connectivity. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for garden gate": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for garden gates with solar power and motion detection. Buy at https://www.maizic.com.",
  // Additional Advanced Queries
  "camera for high-security areas": "The Maizic Ultracam Falcon 5MP with 20X optical zoom and AI human detection is ideal for high-security areas. Buy at https://www.maizic.com.",
  "smart fan for industrial use": "Maizic smart fans with robust motors are suitable for industrial settings with app control. Contact 7042870887 for bulk orders.",
  "dashcam for adventure trips": "The Maizic Dashcam Pro is great for adventure trips with shock-resistant design and 1080p recording. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for educational institutes": "The Maizic CineCast Pro 4K is perfect for educational institutes with 8000 lumens and versatile connectivity. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for coastal areas": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for coastal areas with IP66 waterproofing and corrosion-resistant build. Buy at https://www.maizic.com.",
  "smartwatch for marathon runners": "The Maizic Swift Smartwatch is perfect for marathon runners with long battery life and GPS tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for construction monitoring": "The Maizic Gorilla 5MP 4G is great for construction monitoring with 4G SIM support and durable design. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan for outdoor patios": "Maizic smart fans are suitable for outdoor patios with weather-resistant blades and app control. Buy at https://www.maizic.com.",
  "dashcam for heavy vehicles": "The Maizic Dashcam Pro is robust for heavy vehicles with 1080p recording and wide-angle coverage. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for cultural events": "The Maizic CineCast Pro 4K is ideal for cultural events with 8000 lumens and vibrant colors. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for farmhouses": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for farmhouses with solar power and remote access. Buy at https://www.maizic.com.",
  "smartwatch for elderly care": "The Maizic Swift Smartwatch supports elderly care with fall detection and heart rate monitoring. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for public spaces": "The Maizic Gorilla 5MP 4G is ideal for public spaces with 4G SIM support and night vision. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan for auditoriums": "Maizic smart fans are suitable for auditoriums with high-speed airflow and quiet operation. Buy at https://www.maizic.com.",
  "dashcam for long-haul trucks": "The Maizic Dashcam Pro is great for long-haul trucks with loop recording and G-sensor. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for large venues": "The Maizic CineCast Pro 4K is perfect for large venues with 8000 lumens and 4K upscaling. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for remote locations": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for remote locations with solar power and 4G SIM support. Buy at https://www.maizic.com.",
  "smartwatch for outdoor sports": "The Maizic Swift Smartwatch is great for outdoor sports with IP67 water resistance and fitness tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for retail chains": "The Maizic Gorilla 5MP 4G is suitable for retail chains with centralized monitoring via 4G SIM. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan for banquet halls": "Maizic smart fans enhance banquet halls with elegant design and app control. Buy at https://www.maizic.com.",
  "dashcam for ride-sharing": "The Maizic Dashcam Pro is ideal for ride-sharing with 1080p recording and easy installation. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for film festivals": "The Maizic CineCast Pro 4K is perfect for film festivals with 8000 lumens and vibrant colors. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for industrial sites": "The Maizic Gorilla 5MP 4G is robust for industrial sites with 4G SIM support and night vision. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smartwatch for fitness enthusiasts": "The Maizic Swift Smartwatch is ideal for fitness enthusiasts with advanced tracking features. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for gated entrances": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for gated entrances with motion detection and two-way audio. Buy at https://www.maizic.com.",
  "smart fan for co-working spaces": "Maizic smart fans are great for co-working spaces with quiet operation and app control. Buy at https://www.maizic.com.",
  "dashcam for off-road vehicles": "The Maizic Dashcam Pro is suitable for off-road vehicles with shock-resistant design and 1080p recording. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for lecture halls": "The Maizic CineCast Pro 4K is ideal for lecture halls with 8000 lumens and HDMI connectivity. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for beach houses": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for beach houses with IP66 waterproofing and solar power. Buy at https://www.maizic.com.",
  "smartwatch for adventurers": "The Maizic Swift Smartwatch is great for adventurers with GPS and durable design. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for event venues": "The Maizic Gorilla 5MP 4G is ideal for event venues with 4G SIM support and wide coverage. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan for yoga studios": "Maizic smart fans are suitable for yoga studios with quiet operation and adjustable speeds. Buy at https://www.maizic.com.",
  "dashcam for public transport": "The Maizic Dashcam Pro is great for public transport with 1080p recording and G-sensor. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for museums": "The Maizic CineCast Pro 4K is perfect for museums with 4K upscaling and vibrant displays. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for resorts": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for resorts with solar power and IP66 waterproofing. Buy at https://www.maizic.com."
};

// System Prompt for Maizic Customer Care
const systemPrompt = `
You are a highly skilled, friendly, and professional customer care executive for **Maizic Smarthome**, India’s leading AI-powered smart electronics brand. Your goal is to provide accurate, concise, and highly relevant responses about Maizic products, installation, troubleshooting, post-purchase support, and links to resources like YouTube, Amazon, Flipkart, or product videos. Follow these guidelines:

📦 **Maizic Products**:
- **Security Cameras**: 
  - Supercam 12MP 4K Solar Dual Lens: 4K resolution, solar-powered, 360° PTZ, color night vision, human detection, two-way audio, IP66 waterproof, SD card (up to 256GB), cloud storage.
  - Ultracam Falcon 5MP: 20X optical zoom, dual-band Wi-Fi (2.4GHz/5GHz), 2-year warranty.
  - Mini Fox 3MP FHD: Indoor, 360° rotation, motion tracking, two-way audio.
  - Gorilla 5MP 4G: 4G SIM support, IP66 waterproof, 9 IR LEDs.
- **Dashcams**: Dashcam Pro with 1080p, night vision, loop recording, G-sensor for crash detection.
- **Projectors**: CineCast Pro 4K Android with Wi-Fi, Bluetooth, auto keystone correction, 8000 lumens.
- **Kids Cameras & Toys**: Durable, child-friendly designs for safe use.
- **Other Devices**: Swift Smartwatch (1.80" HD display, heart rate, sleep tracking, IP67 water-resistant), smart fans, microphones, routers, walkie-talkies.

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
- **Accuracy**: Only provide verified information. If unsure, say: “I’m not sure about that, but I can connect you with our technical team at 7042870887.”
- **Language**: Respond in the user’s language (English or Hindi) based on the query. For Hindi queries (e.g., “camera kharab hai”), use simple, clear Hindi and offer English fallback if needed.
- **Multi-Intent**: Address all user questions in a single query (e.g., setup + YouTube link).
- **Proactive**: Offer next steps (e.g., “Check our YouTube for a setup video!” or “Need help choosing a product?”).
- **Silly Questions**: For off-topic or silly queries (e.g., “What’s the weather?” or “Tell me a joke”), respond politely with a light-hearted pivot back to Maizic products.
- **Escalation**: For complex issues, say: “Could you provide more details? Alternatively, our team at 7042870887 can assist further.”
- **Links**: Provide specific links when requested (YouTube, Amazon, Flipkart, product videos) and suggest related resources.
- **Formatting**: Use Markdown for clarity (e.g., **bold** for emphasis, bullet points for lists).

💡 **Example Responses**:
- **User**: “Does Supercam work at night?”  
  **Response**: **Maizic Smarthome Support**: Yes, the Supercam 12MP 4K Solar Dual Lens camera has color night vision with IR and white LEDs for clear footage in low light. View it via the V380 Pro app. See it in action: https://www.youtube.com/watch?v=tuBgwalfkEQ.
- **User**: “i want to replace my product”  
  **Response**: **Maizic Smarthome Support**: To replace your Maizic product, check the return policy of the platform where you purchased it. For Amazon, replacements are typically available within 30 days (visit https://www.amazon.in/s?k=Maizic+Smarthome). For Flipkart, a 30-day replacement policy applies (check https://www.flipkart.com/search?q=Maizic+Smarthome). If purchased from maizic.com, contact our support team at 7042870887 or visit https://www.maizic.com/contact.
- **User**: “camera kharab hai”  
  **Response**: **Maizic Smarthome Support**: Agar aapka Maizic camera kharab hai, toh yeh karein: 1) Lens ko saaf karein. 2) V380 Pro ya Tuya Smart app mein software update check karein. 3) Camera ko 5 second ke liye reset button dabakar reset karein. Aur madad ke liye, 7042870887 par sampark karein.
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

function getSimilarityScore(a, b) {
  const aWords = a.toLowerCase().split(/\s+/);
  const bWords = b.toLowerCase().split(/\s+/);
  const matchCount = aWords.filter(word => bWords.includes(word)).length;
  return matchCount / Math.max(aWords.length, bWords.length);
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

    // Improved matching using similarity score
    let bestMatch = null;
    let highestScore = 0;
    
    for (const [question, answer] of Object.entries(faqs)) {
      const score = getSimilarityScore(normalizedMessage, question);
      if (score > 0.6 && score > highestScore) {
        bestMatch = answer;
        highestScore = score;
      }
    }
    
    if (bestMatch) {
      await fs.appendFile("chat_logs.txt", `Session: ${sessionId}\nUser: ${message}\nBot (FAQ): ${bestMatch}\n---\n`);
      return res.json({ reply: `**Maizic Smarthome Support**:\n${bestMatch}` });
    }

    // Get or initialize conversation history
    let conversation = conversations.get(sessionId)?.messages || [
      { role: "system", content: systemPrompt }
    ];

    // Add user message
    conversation.push({ role: "user", content: message });

    // Chat completion with optimized parameters
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: conversation,
      temperature: 0.7,
      max_tokens: 400,
      top_p: 1.0,
      presence_penalty: 0.3,
      frequency_penalty: 0.3
    });

    let reply = chatCompletion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't understand that. Could you clarify, or contact our team at 7042870887?";

    // Validate response
    if (reply.toLowerCase().includes("i don’t know") || reply.length > 600) {
      reply = "I’m not sure about that, but I’d be happy to connect you with our technical team at 7042870887 for further assistance!";
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
    let userReply = "Something went wrong. Please try again or contact our support team at 7042870887.";
    if (error.code === "insufficient_quota") {
      userReply = "We’re experiencing a temporary issue. Please contact our support team at 7042870887.";
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
