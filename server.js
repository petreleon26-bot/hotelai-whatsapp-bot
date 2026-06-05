const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");
const path = require("path");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const HOTEL_FAQ = `
Hotel: Mountain View Hotel

Check-in: 3:00 PM
Check-out: 11:00 AM
Breakfast: Yes, breakfast is included.
Wi-Fi: Free Wi-Fi is available throughout the hotel.
Parking: Free parking is available for guests.
Pets: Pets are allowed with prior approval.
Pool: The hotel has an outdoor pool.
Reception: Reception is open 24/7.
Airport transfer: Airport transfers can be arranged upon request.
`;

app.get("/", (req, res) => {
  res.status(200).send("HotelAI WhatsApp Bot is running.");
});

app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "privacy.html"));
});

app.get("/webhook", (req, res) => {
  console.log("WEBHOOK VERIFY REQUEST:");
  console.log(req.query);

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFIED");
    return res.status(200).send(challenge);
  }

  console.log("WEBHOOK VERIFICATION FAILED");
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  console.log("WEBHOOK RECEIVED:");
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log("NO MESSAGE FOUND IN WEBHOOK. POSSIBLY STATUS UPDATE.");
      return res.sendStatus(200);
    }

    if (message.type !== "text") {
      console.log("NON-TEXT MESSAGE RECEIVED:", message.type);
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body || "";

    console.log("MESSAGE FROM:", from);
    console.log("MESSAGE TEXT:", text);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a polite AI hotel receptionist. Answer only using the hotel FAQ. Keep answers short, friendly and professional. If the answer is not found in the FAQ, say you don't have that information and suggest contacting reception.",
        },
        {
          role: "user",
          content: `Guest question: ${text}\n\nFAQ:\n${HOTEL_FAQ}`,
        },
      ],
    });

    const reply = completion.choices[0].message.content;

    console.log("AI REPLY:", reply);

    const whatsappResponse = await axios.post(
      `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: {
          body: reply,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("WHATSAPP SEND OK:");
    console.log(JSON.stringify(whatsappResponse.data, null, 2));

    return res.sendStatus(200);
  } catch (error) {
    console.log("ERROR CAUGHT:");
    console.log(JSON.stringify(error.response?.data || error.message, null, 2));
    return res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
