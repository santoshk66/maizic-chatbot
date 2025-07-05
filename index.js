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

// Expanded FAQ Database (200+ FAQs)
const faqs = {
  // Product-Specific Queries
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
  "emi options amazon": "Amazon offers EMI options for Maizic products, depending on your bank. Check details at https://www.amazon.in/s?k=Maizic+Smarthome or contact Amazon support.",
  // Additional FAQs to reach 200+
  "supercam zoom range": "The Maizic Supercam 12MP 4K offers 4x digital zoom and 360° PTZ for wide coverage. Check it at https://www.maizic.com.",
  "dashcam g-sensor": "The Maizic Dashcam Pro includes a G-sensor for automatic crash detection and file protection. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector no sound": "If your Maizic CineCast Pro 4K has no sound, check the volume settings, ensure Bluetooth/Wi-Fi speakers are connected, or reset the projector. Contact 9871142290 for support.",
  "smartwatch not pairing": "If your Maizic Swift Smartwatch isn’t pairing, ensure Bluetooth is enabled, the companion app is updated, and your device is Android 5.0+ or iOS 10.0+. Call 9871142290 for help.",
  "bulk order discounts": "For bulk orders, contact our team at 9871142290 or visit https://www.maizic.com/contact for customized quotes.",
  "flipkart discount codes": "Check for Maizic discount codes on Flipkart at https://www.flipkart.com/search?q=Maizic+Smarthome or contact Flipkart support for ongoing offers.",
  "can camera see ghosts": "Our Maizic cameras are great at spotting motion, but ghosts might be a bit tricky! 😄 Try the Supercam 12MP for crystal-clear footage: https://www.maizic.com.",
  "is maizic from the future": "Maizic’s AI-powered tech might feel futuristic, but we’re proudly made for today’s smart homes! Explore at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera kaise kharidein": "Maizic camera kharidne ke liye, https://www.maizic.com, Amazon (https://www.amazon.in/s?k=Maizic+Smarthome), ya Flipkart (https://www.flipkart.com/search?q=Maizic+Smarthome) par visit karein. Madad ke liye 9871142290 par sampark karein.",
  "warranty kaise badhayein": "Warranty badhane ke liye, https://www.maizic.com/warranty par visit karein ya 9871142290 par sampark karein. Standard warranty 6 mahine (renewed products) ya 2 saal (select models) ki hai.",
  "camera resolution": "Maizic cameras offer resolutions like 3MP (Mini Fox), 5MP (Gorilla), and 12MP (Supercam 4K). Check specs at https://www.maizic.com.",
  "smart fan speed": "Maizic smart fans offer 3–5 speed settings, adjustable via the Tuya Smart app or remote. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "dashcam installation": "To install the Maizic Dashcam Pro: \n1. Mount on the windshield.\n2. Connect to the car’s power.\n3. Insert an SD card (up to 256GB).\nSee our YouTube guide: https://www.youtube.com/@MaizicSmarthome.",
  "projector connectivity": "The Maizic CineCast Pro 4K supports HDMI, USB, Wi-Fi, and Bluetooth for versatile connectivity. Check details at https://www.maizic.com.",
  "camera battery replacement": "For Maizic solar cameras, batteries are built-in and not user-replaceable. Contact 9871142290 for service options.",
  "smartwatch health features": "The Maizic Swift Smartwatch tracks heart rate, steps, and sleep. Pair with the companion app for full features. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera storage options": "Maizic cameras support SD cards (up to 256GB) and cloud storage via the V380 Pro app. Check plans at https://www.maizic.com.",
  "projector screen size": "The Maizic CineCast Pro 4K projects up to 120 inches, ideal for home theater. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera motion alerts": "Maizic cameras send motion alerts via the V380 Pro or Tuya Smart app. Enable notifications in the app settings.",
  "smartwatch water resistance": "The Maizic Swift Smartwatch is IP67 water-resistant, suitable for splashes but not submersion. Check it at https://www.maizic.com.",
  "camera for pets": "The Maizic Mini Fox 3MP is perfect for pet monitoring with 360° rotation and two-way audio. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "product delivery time": "Delivery times vary by platform: Amazon (2–7 days), Flipkart (2–5 days), maizic.com (3–7 days). Check specific listings for estimates.",
  "camera setup video": "Watch our camera setup videos on YouTube: https://www.youtube.com/@MaizicSmarthome. Example: Supercam 12MP setup (https://www.youtube.com/watch?v=tuBgwalfkEQ).",
  "smart fan compatibility": "Maizic smart fans work with Alexa, Google Home, and the Tuya Smart app. Buy at https://www.maizic.com.",
  "dashcam loop recording": "The Maizic Dashcam Pro supports loop recording, overwriting old footage when the SD card is full. Check at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera firmware update": "Update your Maizic camera firmware via the V380 Pro or Tuya Smart app. Check for updates in the app settings or call 9871142290.",
  "projector brightness": "The Maizic CineCast Pro 4K offers 8000 lumens for bright, clear projections. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smartwatch notifications": "The Maizic Swift Smartwatch displays call, message, and app notifications. Configure via the companion app. Buy at https://www.maizic.com.",
  "camera waterproof rating": "Maizic outdoor cameras like the Supercam 12MP and Gorilla 5MP are IP66 waterproof, suitable for all weather. Check at https://www.maizic.com.",
  "product installation cost": "Maizic products are designed for easy self-installation. For professional installation, contact 9871142290 for local service options.",
  "camera for shop": "The Maizic Gorilla 5MP 4G is great for shop surveillance with 4G SIM support and night vision. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan timer": "Maizic smart fans include a timer feature, adjustable via the Tuya Smart app or remote. Check at https://www.maizic.com.",
  "dashcam night vision": "The Maizic Dashcam Pro has night vision for clear recording in low light. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector remote not working": "If the Maizic CineCast Pro 4K remote isn’t working, replace the batteries or pair it again via Bluetooth. Contact 9871142290 for help.",
  "camera cloud subscription": "Maizic camera cloud subscriptions are managed via the V380 Pro app. Check pricing and plans at https://www.maizic.com.",
  "smartwatch strap replacement": "Replacement straps for the Maizic Swift Smartwatch are available at https://www.maizic.com. Contact 9871142290 for details.",
  "camera for elderly": "The Maizic Mini Fox 3MP is ideal for monitoring elderly loved ones with two-way audio and motion tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "product warranty period": "Maizic products come with a 6-month warranty for renewed items or 2 years for select models. Extend at https://www.maizic.com/warranty.",
  "camera lens cleaning": "Clean your Maizic camera lens with a microfiber cloth to avoid scratches. For persistent issues, call 9871142290.",
  "smart fan voice control": "Maizic smart fans support voice control via Alexa or Google Home through the Tuya Smart app. Buy at https://www.maizic.com.",
  "dashcam sd card format": "Format the SD card for the Maizic Dashcam Pro via the device settings or V380 Pro app. Use a Class 10 SD card up to 256GB.",
  "projector overheating": "To prevent Maizic CineCast Pro 4K overheating, ensure proper ventilation and clean the air vents. Contact 9871142290 for support.",
  "camera for baby monitoring": "The Maizic Mini Fox 3MP is perfect for baby monitoring with night vision and two-way audio. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smartwatch fitness tracking": "The Maizic Swift Smartwatch tracks steps, calories, and heart rate. View data in the companion app. Buy at https://www.maizic.com.",
  "camera installation guide": "Follow our Maizic camera installation guide on YouTube: https://www.youtube.com/@MaizicSmarthome. For support, call 9871142290.",
  "product return process": "To return a Maizic product, check the platform’s policy: Amazon (30 days, https://www.amazon.in/s?k=Maizic+Smarthome), Flipkart (30 days, https://www.flipkart.com/search?q=Maizic+Smarthome), or maizic.com (contact 9871142290).",
  "camera not recording": "If your Maizic camera isn’t recording, check the SD card, ensure cloud storage is active, or reset the camera. Call 9871142290 for help.",
  "smart fan installation": "Install Maizic smart fans using the provided mounting kit and pair with the Tuya Smart app. See our YouTube guide: https://www.youtube.com/@MaizicSmarthome.",
  "dashcam battery life": "The Maizic Dashcam Pro uses car power, with a small backup battery for parking mode. Check at https://www.maizic.com.",
  "projector lamp life": "The Maizic CineCast Pro 4K lamp lasts up to 30,000 hours. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for farm": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for farms with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smartwatch call feature": "The Maizic Swift Smartwatch supports call notifications and Bluetooth calling. Pair with the companion app. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera privacy settings": "Adjust Maizic camera privacy settings in the V380 Pro or Tuya Smart app to disable recording or notifications. Contact 9871142290 for help.",
  "product comparison": "Compare Maizic products at https://www.maizic.com. For example, the Supercam 12MP has 4K resolution, while the Mini Fox 3MP is best for indoor use.",
  "camera for warehouse": "The Maizic Gorilla 5MP 4G is great for warehouses with 4G SIM support and wide-angle coverage. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan warranty": "Maizic smart fans come with a 2-year warranty. Extend it at https://www.maizic.com/warranty or call 9871142290.",
  "dashcam parking mode": "The Maizic Dashcam Pro supports parking mode with motion detection, requiring a hardwire kit. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for presentations": "The Maizic CineCast Pro 4K is great for presentations with HDMI connectivity and 8000 lumens. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for construction site": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for construction sites with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smartwatch battery replacement": "The Maizic Swift Smartwatch battery is not user-replaceable. Contact 9871142290 for service options.",
  "camera multi-device viewing": "Maizic cameras support multi-device viewing via the V380 Pro or Tuya Smart app. Share access in the app settings.",
  "product repair process": "For Maizic product repairs, contact 9871142290 or visit https://www.maizic.com/contact with your order details and issue description.",
  "camera for school": "The Maizic Mini Fox 3MP is ideal for school monitoring with 360° rotation and motion tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smart fan energy consumption": "Maizic smart fans use 40–60W, depending on speed settings. Check specs at https://www.maizic.com.",
  "dashcam video quality": "The Maizic Dashcam Pro records in 1080p HD for clear video. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for outdoor use": "The Maizic CineCast Pro 4K is suitable for outdoor use with proper shelter. Check at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for vacation home": "The Maizic Supercam 12MP 4K Solar Dual Lens is great for vacation homes with solar power and remote access. Buy at https://www.maizic.com.",
  "smartwatch sleep tracking": "The Maizic Swift Smartwatch tracks sleep patterns via the companion app. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera night vision color": "Maizic cameras like the Supercam 12MP offer color night vision using white LEDs. Check it at https://www.maizic.com.",
  "product installation support": "For Maizic product installation support, watch our YouTube guides (https://www.youtube.com/@MaizicSmarthome) or call 9871142290.",
  "camera for retail store": "The Maizic Gorilla 5MP 4G is ideal for retail stores with 4G SIM support and night vision. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan remote range": "Maizic smart fan remotes work up to 10 meters. Use the Tuya Smart app for extended control. Buy at https://www.maizic.com.",
  "dashcam wide angle": "The Maizic Dashcam Pro has a 170° wide-angle lens for comprehensive coverage. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector auto keystone": "The Maizic CineCast Pro 4K features auto keystone correction for easy setup. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for garden": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for gardens with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smartwatch app download": "Download the Maizic Swift Smartwatch companion app from the App Store (iOS) or Google Play (Android). Check at https://www.maizic.com.",
  "camera multi-camera setup": "Set up multiple Maizic cameras via the V380 Pro or Tuya Smart app. Add each camera by scanning its QR code. Call 9871142290 for help.",
  "product troubleshooting guide": "Find troubleshooting guides for Maizic products on our YouTube channel: https://www.youtube.com/@MaizicSmarthome. For support, call 9871142290.",
  "camera for apartment": "The Maizic Mini Fox 3MP is ideal for apartments with 360° rotation and motion tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smart fan noise level": "Maizic smart fans operate at 30–50 dB, depending on speed. Check specs at https://www.maizic.com.",
  "dashcam installation video": "Watch the Maizic Dashcam Pro installation video on YouTube: https://www.youtube.com/@MaizicSmarthome. Call 9871142290 for support.",
  "projector for gaming": "The Maizic CineCast Pro 4K is great for gaming with low input lag and 4K upscaling. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for garage": "The Maizic Gorilla 5MP 4G is perfect for garages with 4G SIM support and night vision. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smartwatch warranty period": "The Maizic Swift Smartwatch comes with a 1-year warranty. Extend it at https://www.maizic.com/warranty or call 9871142290.",
  "camera for outdoor events": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for outdoor events with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "product feedback": "Share your Maizic product feedback at https://www.maizic.com/contact or call 9871142290. We value your input!",
  "camera for parking lot": "The Maizic Gorilla 5MP 4G is great for parking lots with 4G SIM support and wide-angle coverage. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "smart fan installation video": "Watch Maizic smart fan installation videos on YouTube: https://www.youtube.com/@MaizicSmarthome. Call 9871142290 for support.",
  "dashcam for trucks": "The Maizic Dashcam Pro is suitable for trucks with 1080p recording and G-sensor. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for classroom": "The Maizic CineCast Pro 4K is ideal for classrooms with 8000 lumens and HDMI connectivity. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for rooftop": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for rooftops with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smartwatch for kids": "The Maizic Swift Smartwatch is suitable for kids with simple controls and parental monitoring via the app. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for factory": "The Maizic Gorilla 5MP 4G is ideal for factories with 4G SIM support and durable design. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "product demo request": "Request a Maizic product demo by contacting 9871142290 or visiting https://www.maizic.com/contact.",
  "camera for gate": "The Maizic Supercam 12MP 4K Solar Dual Lens is great for gate monitoring with solar power and motion detection. Buy at https://www.maizic.com.",
  "smart fan for office": "Maizic smart fans are suitable for offices with remote control and low noise. Buy at https://www.maizic.com.",
  "dashcam for bikes": "The Maizic Dashcam Pro is adaptable for bikes with a secure mount and 1080p recording. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for events": "The Maizic CineCast Pro 4K is perfect for events with 8000 lumens and portable design. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for driveway": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for driveways with solar power and IP66 waterproofing. Buy at https://www.maizic.com.",
  "smartwatch for seniors": "The Maizic Swift Smartwatch is great for seniors with heart rate monitoring and easy-to-read display. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "camera for backyard": "The Maizic Supercam 12MP 4K Solar Dual Lens is perfect for backyards with solar power and motion detection. Buy at https://www.maizic.com.",
  "product availability": "Check Maizic product availability at https://www.maizic.com, Amazon (https://www.amazon.in/s?k=Maizic+Smarthome), or Flipkart (https://www.flipkart.com/search?q=Maizic+Smarthome).",
  "camera for balcony": "The Maizic Mini Fox 3MP is suitable for balconies with 360° rotation and motion tracking. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "smart fan for bedroom": "Maizic smart fans are ideal for bedrooms with quiet operation and timer settings. Buy at https://www.maizic.com.",
  "dashcam for taxis": "The Maizic Dashcam Pro is great for taxis with 1080p recording and loop recording. Buy at https://www.amazon.in/s?k=Maizic+Smarthome.",
  "projector for home office": "The Maizic CineCast Pro 4K is perfect for home offices with 8000 lumens and HDMI connectivity. Buy at https://www.flipkart.com/search?q=Maizic+Smarthome.",
  "camera for front door": "The Maizic Supercam 12MP 4K Solar Dual Lens is ideal for front doors with solar power and two-way audio. Buy at https://www.maizic.com.",
  "smartwatch for fitness": "The Maizic Swift Smartwatch tracks fitness metrics like steps, calories, and heart rate. Buy at https://www.amazon.in/s?k=Maizic+Smarthome."
};

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
- **Dashcams**: Dashcam Pro with 1080p, night vision, loop recording, G-sensor.
- **Projectors**: CineCast Pro 4K Android with Wi-Fi, Bluetooth, auto keystone correction, 8000 lumens.
- **Kids Cameras & Toys**: Durable, child-friendly designs.
- **Other Devices**: Swift Smartwatch (1.80" HD display, heart rate, sleep tracking), smart fans, microphones, routers, walkie-talkies.

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
