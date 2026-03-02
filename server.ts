import express from "express";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import axios from "axios";
import { GoogleGenAI, Modality } from "@google/genai";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();


// 1. Tell Express to serve the static files from the "dist" folder
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Ensure that any page refresh redirects to index.html (important for React apps)
app.get('/*path', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/nexus-justice";
mongoose.connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// Database Schema
const ChatMessageSchema = new mongoose.Schema({
  role: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
});
const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);

// Helper function to call Sarvam AI for text chat
async function callSarvamChat(messages: any[]) {
  try {
    // Note: Replace with actual Sarvam API endpoint and payload structure
    // Since Sarvam API details might vary, we simulate a call or use a known endpoint
    // Assuming Sarvam has an OpenAI-compatible endpoint or similar
    const response = await axios.post(
      "https://api.sarvam.ai/chat/completions",
      {
        model: "sarvam-1",
        messages: messages
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.SARVAM_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Sarvam Chat Error:", error);
    throw error;
  }
}

// Helper function to call Gemini as fallback
async function callGeminiFallback(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Fallback Error:", error);
    throw error;
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/chat/history", async (req, res) => {
  try {
    const history = await ChatMessage.find().sort({ timestamp: 1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message, useWebSearch } = req.body;

  try {
    // Save user message
    await new ChatMessage({ role: "user", content: message }).save();

    let reply = "";

    if (useWebSearch) {
      // Use Gemini 2.5 Flash Lite for Web Search
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: message,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      reply = response.text || "No response generated.";
    } else {
      // Orchestrator: Try Sarvam first, fallback to Gemini
      try {
        const history = await ChatMessage.find().sort({ timestamp: 1 }).limit(10);
        const messages = history.map(msg => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        }));
        reply = await callSarvamChat(messages);
      } catch (sarvamError) {
        console.log("Falling back to Gemini 2.5 Flash Lite...");
        reply = await callGeminiFallback(message);
      }
    }

    // Save assistant message
    await new ChatMessage({ role: "assistant", content: reply }).save();

    res.json({ reply });
  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: "Failed to process chat" });
  }
});

app.post("/api/draft", async (req, res) => {
  const { topic } = req.body;
  const prompt = `Draft a comprehensive document about: ${topic}`;

  try {
    let draft = "";
    try {
      draft = await callSarvamChat([{ role: "user", content: prompt }]);
    } catch (sarvamError) {
      console.log("Drafting: Falling back to Gemini 2.5 Flash Lite...");
      draft = await callGeminiFallback(prompt);
    }
    res.json({ draft });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate draft" });
  }
});

app.post("/api/stt", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided" });
  }

  try {
    // Try Sarvam STT
    let transcript = "";
    try {
      const formData = new FormData();
      const fileBuffer = fs.readFileSync(req.file.path);
      const blob = new Blob([fileBuffer], { type: req.file.mimetype });
      formData.append("file", blob, req.file.originalname);
      formData.append("model", "sarvam-stt");

      const response = await axios.post(
        "https://api.sarvam.ai/speech-to-text",
        formData,
        {
          headers: {
            "Authorization": `Bearer ${process.env.SARVAM_API_KEY}`,
            "Content-Type": "multipart/form-data"
          }
        }
      );
      transcript = response.data.transcript;
    } catch (sarvamError) {
      console.log("STT: Falling back to Gemini 2.5 Flash Lite...");
      // Gemini natively supports audio
      const audioData = fs.readFileSync(req.file.path).toString("base64");
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: [
          {
            inlineData: {
              mimeType: req.file.mimetype || "audio/mp3",
              data: audioData
            }
          },
          "Transcribe this audio exactly as spoken."
        ]
      });
      transcript = response.text || "";
    }

    // Cleanup
    fs.unlinkSync(req.file.path);

    res.json({ transcript });
  } catch (error) {
    console.error("STT Error:", error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to process speech to text" });
  }
});

app.post("/api/tts", async (req, res) => {
  const { text } = req.body;

  try {
    let audioBase64 = "";
    try {
      // Try Sarvam TTS
      const response = await axios.post(
        "https://api.sarvam.ai/text-to-speech",
        {
          inputs: [text],
          target_language_code: "hi-IN",
          speaker: "meera",
          pitch: 0,
          pace: 1.0,
          loudness: 1.5,
          speech_sample_rate: 8000,
          enable_preprocessing: true,
          model: "bulbul:v1"
        },
        {
          headers: {
            "Authorization": `Bearer ${process.env.SARVAM_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
      audioBase64 = response.data.audios[0];
    } catch (sarvamError) {
      console.log("TTS: Falling back to Gemini TTS...");
      // Fallback to Gemini TTS
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" }
            }
          }
        }
      });
      audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
    }

    res.json({ audio: audioBase64 });
  } catch (error) {
    console.error("TTS Error:", error);
    res.status(500).json({ error: "Failed to generate speech" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("/*path", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
