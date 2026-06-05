const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

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

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body || "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a polite AI hotel receptionist. Answer only using the hotel FAQ. If the answer is not found, say you don't have that information."
        },
        {
          role: "user",
          content: `Guest question: ${text}\n\nFAQ:\n${HOTEL_FAQ}`
        }
      ]
    });

    const reply = completion.choices[0].message.content;

    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.sendStatus(200);
  }
});

app.get("/", (req, res) => {
  res.send("HotelAI WhatsApp Bot is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
