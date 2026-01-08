/**
 * Voice API Router (Optional)
 * Xử lý Text-to-Speech và Speech-to-Text qua external APIs
 * Hỗ trợ: OpenAI Whisper (STT), OpenAI TTS, Google Cloud
 *
 * Sử dụng: app.use('/api/voice', require('./voice-router')())
 */

const express = require("express");

function createVoiceRouter(config = {}) {
  const router = express.Router();

  const voiceConfig = {
    openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
    googleApiKey: config.googleApiKey || process.env.GOOGLE_API_KEY,
    ttsProvider: config.ttsProvider || process.env.TTS_PROVIDER || "openai", // openai, google
    sttProvider: config.sttProvider || process.env.STT_PROVIDER || "whisper",
  };

  /**
   * POST /api/voice/tts
   * Text-to-Speech
   * Body: { text: string, voice?: string }
   * Returns: audio/mpeg
   */
  router.post("/tts", async (req, res) => {
    try {
      const { text, voice = "nova" } = req.body;

      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      if (voiceConfig.ttsProvider === "openai") {
        const audioBuffer = await openaiTTS(text, voice, voiceConfig);
        res.set("Content-Type", "audio/mpeg");
        res.send(audioBuffer);
      } else if (voiceConfig.ttsProvider === "google") {
        const audioBuffer = await googleTTS(
          text,
          req.body.language || "vi-VN",
          voiceConfig
        );
        res.set("Content-Type", "audio/mpeg");
        res.send(audioBuffer);
      } else {
        res.status(400).json({ error: "Invalid TTS provider" });
      }
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/voice/stt
   * Speech-to-Text với OpenAI Whisper
   * Body: multipart/form-data với field 'audio' hoặc raw audio
   */
  router.post(
    "/stt",
    express.raw({
      type: ["audio/*", "application/octet-stream"],
      limit: "25mb",
    }),
    async (req, res) => {
      try {
        const audioBuffer = req.body;
        const language = req.query.language || "vi";

        if (!audioBuffer || audioBuffer.length === 0) {
          return res.status(400).json({ error: "Audio data is required" });
        }

        const result = await whisperSTT(audioBuffer, language, voiceConfig);
        res.json(result);
      } catch (error) {
        console.error("STT error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  /**
   * GET /api/voice/voices
   * Lấy danh sách voices
   */
  router.get("/voices", (req, res) => {
    const voices = {
      openai: [
        { id: "alloy", name: "Alloy", description: "Neutral" },
        { id: "echo", name: "Echo", description: "Male" },
        { id: "fable", name: "Fable", description: "British" },
        { id: "onyx", name: "Onyx", description: "Deep male" },
        { id: "nova", name: "Nova", description: "Female (recommended)" },
        { id: "shimmer", name: "Shimmer", description: "Soft female" },
      ],
      google: [
        { id: "vi-VN-Neural2-A", name: "Vietnamese Female" },
        { id: "vi-VN-Neural2-D", name: "Vietnamese Male" },
        { id: "en-US-Neural2-J", name: "English US Male" },
        { id: "en-US-Neural2-F", name: "English US Female" },
      ],
    };

    res.json({
      provider: voiceConfig.ttsProvider,
      voices: voices[voiceConfig.ttsProvider] || [],
    });
  });

  /**
   * GET /api/voice/config
   */
  router.get("/config", (req, res) => {
    res.json({
      ttsProvider: voiceConfig.ttsProvider,
      sttProvider: voiceConfig.sttProvider,
      hasOpenAIKey: !!voiceConfig.openaiApiKey,
      hasGoogleKey: !!voiceConfig.googleApiKey,
    });
  });

  return router;
}

// ==================== OPENAI TTS ====================

async function openaiTTS(text, voice, config) {
  if (!config.openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: voice, // alloy, echo, fable, onyx, nova, shimmer
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS error: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ==================== OPENAI WHISPER STT ====================

async function whisperSTT(audioBuffer, language, config) {
  if (!config.openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  // Tạo FormData
  const boundary =
    "----WebKitFormBoundary" + Math.random().toString(36).substring(2);

  const formParts = [];

  // File part
  formParts.push(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n` +
      `Content-Type: audio/webm\r\n\r\n`
  );

  const filePartEnd = `\r\n`;

  // Model part
  const modelPart =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model"\r\n\r\n` +
    `whisper-1\r\n`;

  // Language part
  const langPart =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="language"\r\n\r\n` +
    `${language}\r\n`;

  // End boundary
  const endBoundary = `--${boundary}--\r\n`;

  // Combine all parts
  const bodyParts = [
    Buffer.from(formParts[0]),
    audioBuffer,
    Buffer.from(filePartEnd + modelPart + langPart + endBoundary),
  ];

  const body = Buffer.concat(bodyParts);

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper STT error: ${error}`);
  }

  const data = await response.json();
  return {
    text: data.text,
    language: language,
  };
}

// ==================== GOOGLE CLOUD TTS ====================

async function googleTTS(text, language, config) {
  if (!config.googleApiKey) {
    throw new Error("Google API key not configured");
  }

  const voiceMap = {
    "vi-VN": { languageCode: "vi-VN", name: "vi-VN-Neural2-A" },
    "en-US": { languageCode: "en-US", name: "en-US-Neural2-J" },
    "en-GB": { languageCode: "en-GB", name: "en-GB-Neural2-B" },
    "ja-JP": { languageCode: "ja-JP", name: "ja-JP-Neural2-B" },
  };

  const voice = voiceMap[language] || voiceMap["vi-VN"];

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.googleApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: voice,
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google TTS error: ${error}`);
  }

  const data = await response.json();
  return Buffer.from(data.audioContent, "base64");
}

module.exports = createVoiceRouter;
