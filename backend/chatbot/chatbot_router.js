/**
 * Chat API Router
 * Thêm vào server.js bằng: app.use('/api/chat', require('./chat-router')(db))
 */

const express = require("express");
const { randomUUID } = require("crypto");
const WeatherChatbot = require("./chatbot");
const ChatDatabase = require("./chatbot_db");

function createChatRouter(sensorDb, config = {}) {
  const router = express.Router();
  const chatDb = new ChatDatabase(
    process.env.CHAT_DB_FILE || "./chat_history.db"
  );
  const chatbot = new WeatherChatbot(sensorDb, config);

  // Số lượng tin nhắn trước đó để giữ làm context
  const CONTEXT_MESSAGE_COUNT =
    config.contextMessages || parseInt(process.env.CHAT_CONTEXT_MESSAGES) || 10;

  /**
   * POST /api/chat
   * Gửi message và nhận response
   */
  router.post("/", async (req, res) => {
    try {
      const { message, sessionId } = req.body;

      if (!message || typeof message !== "string" || message.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Message is required",
        });
      }

      // Tạo session ID nếu chưa có
      const session = sessionId || randomUUID();
      const userMessage = message.trim();

      // Lấy lịch sử chat trước đó để làm context
      let conversationHistory = [];
      try {
        const history = await chatDb.getSessionHistory(
          session,
          CONTEXT_MESSAGE_COUNT
        );
        conversationHistory = history.map((msg) => ({
          role: msg.role,
          content: msg.message,
        }));
      } catch (historyError) {
        console.error("Error loading chat history:", historyError);
        // Tiếp tục không có history
      }

      // Lưu user message
      await chatDb.saveMessage(session, "user", userMessage);

      // Xử lý chat với conversation history
      const result = await chatbot.chat(
        userMessage,
        session,
        conversationHistory
      );

      // Lưu bot response
      await chatDb.saveMessage(
        session,
        "assistant",
        result.message,
        result.isWeatherQuery,
        result.processingTime
      );

      res.json({
        success: true,
        sessionId: session,
        response: result.message,
        isWeatherQuery: result.isWeatherQuery,
        processingTime: result.processingTime,
        timestamp: result.timestamp,
        contextMessages: conversationHistory.length,
      });
    } catch (error) {
      console.error("Chat API error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/chat/history/:sessionId
   * Lấy lịch sử chat của session
   */
  router.get("/history/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const limit = parseInt(req.query.limit) || 50;

      const history = await chatDb.getSessionHistory(sessionId, limit);

      res.json({
        success: true,
        sessionId,
        count: history.length,
        messages: history,
      });
    } catch (error) {
      console.error("Get history error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/chat/sessions
   * Lấy danh sách các sessions
   */
  router.get("/sessions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const sessions = await chatDb.getAllSessions(limit);

      res.json({
        success: true,
        count: sessions.length,
        sessions,
      });
    } catch (error) {
      console.error("Get sessions error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * DELETE /api/chat/cleanup/:days
   * Xóa lịch sử cũ
   */
  router.delete("/cleanup/:days?", async (req, res) => {
    try {
      const days = parseInt(req.params.days) || 30;
      const deleted = await chatDb.deleteOldHistory(days);

      res.json({
        success: true,
        message: `Deleted ${deleted} messages older than ${days} days`,
      });
    } catch (error) {
      console.error("Cleanup error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}

module.exports = createChatRouter;
