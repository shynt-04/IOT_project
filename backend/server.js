require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mqtt = require("mqtt");
const DatabaseManager = require("./database");
const createChatRouter = require("./chatbot/chatbot_router");
const createVoiceRouter = require("./chatbot/voice-router");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const db = new DatabaseManager(process.env.DB_FILE || "./iot_data.db");

// ==================== CHATBOT & VOICE ROUTES ====================

// Chatbot routes
const chatRouter = createChatRouter(db);
app.use("/api/chat", chatRouter);

// Voice routes (TTS/STT)
const voiceRouter = createVoiceRouter({
  openaiApiKey: process.env.OPENAI_API_KEY,
  googleApiKey: process.env.GOOGLE_API_KEY,
  ttsProvider: process.env.TTS_PROVIDER || "openai", // openai hoặc google
  sttProvider: process.env.STT_PROVIDER || "whisper",
});
app.use("/api/voice", voiceRouter);

// ==================== MQTT CONNECTION ====================

let latestData = {
  temperature: null,
  humidity: null,
  airQuality: null,
  lastUpdate: null,
};

const mqttClient = mqtt.connect(process.env.MQTT_BROKER, {
  username: process.env.MQTT_USERNAME || "",
  password: process.env.MQTT_PASSWORD || "",
});

mqttClient.on("connect", () => {
  console.log("Connected to MQTT Broker");

  // Subscribe to all sensor topics
  mqttClient.subscribe(process.env.TOPIC_TEMPERATURE, (err) => {
    if (!err) console.log(`Subscribed to ${process.env.TOPIC_TEMPERATURE}`);
  });

  mqttClient.subscribe(process.env.TOPIC_HUMIDITY, (err) => {
    if (!err) console.log(`Subscribed to ${process.env.TOPIC_HUMIDITY}`);
  });

  mqttClient.subscribe(process.env.TOPIC_AIR_QUALITY, (err) => {
    if (!err) console.log(`Subscribed to ${process.env.TOPIC_AIR_QUALITY}`);
  });

  mqttClient.subscribe(process.env.TOPIC_STATUS, (err) => {
    if (!err) console.log(`Subscribed to ${process.env.TOPIC_STATUS}`);
  });
});

mqttClient.on("message", (topic, message) => {
  const value = message.toString();
  console.log(`Received: ${topic} = ${value}`);

  if (topic === process.env.TOPIC_TEMPERATURE) {
    latestData.temperature = parseFloat(value);
  } else if (topic === process.env.TOPIC_HUMIDITY) {
    latestData.humidity = parseFloat(value);
  } else if (topic === process.env.TOPIC_AIR_QUALITY) {
    latestData.airQuality = parseFloat(value);
  } else if (topic === process.env.TOPIC_STATUS) {
    console.log(`Device Status: ${value}`);
  }

  latestData.lastUpdate = new Date();

  if (
    latestData.temperature !== null &&
    latestData.humidity !== null &&
    latestData.airQuality !== null
  ) {
    db.insertSensorData(
      latestData.temperature,
      latestData.humidity,
      latestData.airQuality,
      new Date().toLocaleString("sv-SE")
    )
      .then(() => {
        console.log("Data saved to database");
      })
      .catch((error) => {
        console.error("Database error:", error);
      });
  }
});

mqttClient.on("error", (error) => {
  console.error("MQTT Error:", error);
});

// ==================== REST API ENDPOINTS ====================

app.get("/api/latest", async (req, res) => {
  try {
    const dbData = await db.getLatestData();
    res.json({
      success: true,
      data: dbData || latestData,
      realtime: latestData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/recent/:limit?", async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 100;
    const data = await db.getRecentData(limit);
    res.json({
      success: true,
      count: data.length,
      data: data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/statistics/:hours?", async (req, res) => {
  try {
    const hours = parseInt(req.params.hours) || 24;
    const stats = await db.getStatistics(hours);
    res.json({
      success: true,
      period: `${hours} hours`,
      statistics: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/range", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: "Please provide start and end parameters",
      });
    }

    const data = await db.getDataByTimeRange(start, end);
    res.json({
      success: true,
      count: data.length,
      data: data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.delete("/api/cleanup/:days?", async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 30;
    const deleted = await db.deleteOldData(days);
    res.json({
      success: true,
      message: `Deleted ${deleted} records older than ${days} days`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "running",
    mqtt: mqttClient.connected ? "connected" : "disconnected",
    uptime: process.uptime(),
    features: {
      chat: true,
      voice: {
        tts: !!process.env.OPENAI_API_KEY || !!process.env.GOOGLE_API_KEY,
        stt: !!process.env.OPENAI_API_KEY,
        provider: {
          tts: process.env.TTS_PROVIDER || "openai",
          stt: process.env.STT_PROVIDER || "whisper",
        },
      },
    },
  });
});

// ==================== STATIC FILES ====================

app.use(express.static("../frontend"));

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`\n🚀 Backend Server running on http://localhost:${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`  GET  /api/latest            - Get latest sensor data`);
  console.log(`  GET  /api/recent/:limit     - Get recent N records`);
  console.log(`  GET  /api/statistics/:hours - Get statistics`);
  console.log(`  GET  /api/range?start=&end= - Get data by time range`);
  console.log(`  GET  /api/health            - Server health check`);
  console.log(`\n💬 Chat endpoints:`);
  console.log(`  POST /api/chat              - Send chat message`);
  console.log(`  GET  /api/chat/history/:id  - Get chat history`);
  console.log(`  GET  /api/chat/sessions     - Get all sessions`);
  console.log(`\n🎤 Voice endpoints:`);
  console.log(`  POST /api/voice/tts         - Text-to-Speech`);
  console.log(`  POST /api/voice/stt         - Speech-to-Text`);
  console.log(`  GET  /api/voice/voices      - Get available voices`);
  console.log(`  GET  /api/voice/config      - Get voice config`);

  // Check API keys
  console.log(`\n🔑 API Keys Status:`);
  console.log(
    `  OpenAI: ${process.env.OPENAI_API_KEY ? "✅ Configured" : "❌ Not set"}`
  );
  console.log(
    `  Google: ${process.env.GOOGLE_API_KEY ? "✅ Configured" : "❌ Not set"}`
  );

  if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
    console.log(`\n⚠️  Warning: No voice API keys configured.`);
    console.log(`   Voice features will use browser's Web Speech API only.`);
    console.log(
      `   Add OPENAI_API_KEY or GOOGLE_API_KEY to .env for better quality.`
    );
  }
});

// ==================== GRACEFUL SHUTDOWN ====================

process.on("SIGINT", () => {
  console.log("\n👋 Shutting down gracefully...");
  mqttClient.end();
  db.close();
  process.exit(0);
});
