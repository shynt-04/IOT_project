/**
 * Weather IoT Chatbot Module
 * Xử lý routing câu hỏi và tạo response dựa trên dữ liệu sensor
 * Tích hợp OpenAI-compatible API (OpenAI, vLLM, LocalAI, Ollama, etc.)
 */

class WeatherChatbot {
  constructor(db, config = {}) {
    this.db = db;

    // API Configuration - OpenAI-compatible
    this.apiConfig = {
      baseUrl:
        config.baseUrl ||
        process.env.LLM_API_URL ||
        "https://api.openai.com/v1",
      apiKey:
        config.apiKey ||
        process.env.LLM_API_KEY ||
        process.env.OPENAI_API_KEY ||
        "",
      model: config.model || process.env.LLM_MODEL || "gpt-3.5-turbo",
      maxTokens: config.maxTokens || 1024,
      temperature: config.temperature || 0.7,
    };

    // System prompt cho AI
    this.systemPrompt = `Bạn là Weather Bot, một trợ lý thông minh chuyên về dữ liệu thời tiết từ hệ thống IoT sensor.

Nhiệm vụ của bạn:
1. Trả lời câu hỏi về nhiệt độ, độ ẩm, chất lượng không khí từ dữ liệu sensor
2. Phân tích và đưa ra nhận xét về điều kiện thời tiết
3. Trả lời các câu hỏi chung một cách thân thiện

Quy tắc:
- Trả lời bằng tiếng Việt (trừ khi user hỏi bằng tiếng Anh)
- Sử dụng emoji phù hợp để làm response sinh động
- Khi có dữ liệu sensor, hãy phân tích và đưa ra lời khuyên hữu ích
- Nếu chất lượng không khí > 1.9V là kém, cần cảnh báo
- Nhiệt độ thoải mái: 20-28°C, độ ẩm thoải mái: 40-60%
- Giữ câu trả lời ngắn gọn, dễ hiểu`;

    // Keywords để detect câu hỏi liên quan thời tiết/sensor
    this.weatherKeywords = [
      // Tiếng Việt
      "nhiệt độ",
      "độ ẩm",
      "không khí",
      "thời tiết",
      "nóng",
      "lạnh",
      "ẩm",
      "khô",
      "sensor",
      "cảm biến",
      "đo",
      "trung bình",
      "cao nhất",
      "thấp nhất",
      "hôm nay",
      "hôm qua",
      "tuần",
      "tháng",
      "giờ",
      "phút",
      "chất lượng",
      "ô nhiễm",
      "bụi",
      "air quality",
      // English
      "temperature",
      "humidity",
      "weather",
      "hot",
      "cold",
      "warm",
      "cool",
      "average",
      "max",
      "min",
      "highest",
      "lowest",
      "current",
      "now",
      "today",
      "yesterday",
      "week",
      "month",
      "hour",
      "minute",
    ];

    console.log(
      `Chatbot initialized with LLM: ${this.apiConfig.baseUrl} | Model: ${this.apiConfig.model}`
    );
  }

  /**
   * Kiểm tra câu hỏi có liên quan đến thời tiết/sensor không
   */
  isWeatherRelated(message) {
    const lowerMessage = message.toLowerCase();
    return this.weatherKeywords.some((keyword) =>
      lowerMessage.includes(keyword)
    );
  }

  /**
   * Lấy tất cả dữ liệu sensor để cung cấp context cho LLM
   */
  async getAllSensorContext() {
    try {
      const [current, statistics, recent] = await Promise.all([
        this.db.getLatestData(),
        this.db.getStatistics(24),
        this.db.getRecentData(10),
      ]);

      let context = "=== DỮ LIỆU SENSOR HIỆN TẠI ===\n";

      if (current) {
        context += `\n📊 Dữ liệu mới nhất (${new Date(
          current.timestamp
        ).toLocaleString("vi-VN")}):\n`;
        context += `- Nhiệt độ: ${
          current.temperature?.toFixed(1) ?? "N/A"
        }°C\n`;
        context += `- Độ ẩm: ${current.humidity?.toFixed(1) ?? "N/A"}%\n`;
        context += `- Chất lượng không khí: ${
          current.air_quality?.toFixed(3) ?? "N/A"
        }V`;
        context += current.air_quality > 1.9 ? " (KÉM - cần chú ý!)" : " (TỐT)";
        context += "\n";
      }

      if (statistics) {
        context += `\n📈 Thống kê 24 giờ qua:\n`;
        context += `- Nhiệt độ: TB ${
          statistics.avg_temp?.toFixed(1) ?? "N/A"
        }°C, `;
        context += `Min ${statistics.min_temp?.toFixed(1) ?? "N/A"}°C, `;
        context += `Max ${statistics.max_temp?.toFixed(1) ?? "N/A"}°C\n`;
        context += `- Độ ẩm: TB ${
          statistics.avg_humidity?.toFixed(1) ?? "N/A"
        }%, `;
        context += `Min ${statistics.min_humidity?.toFixed(1) ?? "N/A"}%, `;
        context += `Max ${statistics.max_humidity?.toFixed(1) ?? "N/A"}%\n`;
        context += `- Chất lượng KK: TB ${
          statistics.avg_air?.toFixed(3) ?? "N/A"
        }V\n`;
      }

      if (recent && recent.length > 0) {
        context += `\n📜 ${recent.length} bản ghi gần nhất:\n`;
        recent.slice(0, 5).forEach((r, i) => {
          const time = new Date(r.timestamp).toLocaleTimeString("vi-VN");
          context += `${i + 1}. [${time}] ${r.temperature?.toFixed(
            1
          )}°C | ${r.humidity?.toFixed(1)}% | ${r.air_quality?.toFixed(3)}V\n`;
        });
      }

      return context;
    } catch (error) {
      console.error("Error getting sensor context:", error);
      return "Không thể lấy dữ liệu sensor.";
    }
  }

  /**
   * Gọi OpenAI-compatible API
   */
  async callLLMApi(messages) {
    const url = `${this.apiConfig.baseUrl}/chat/completions`;

    const headers = {
      "Content-Type": "application/json",
    };

    // Thêm API key nếu có (vLLM local có thể không cần)
    if (this.apiConfig.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiConfig.apiKey}`;
    }

    const body = {
      model: this.apiConfig.model,
      messages: messages,
      max_tokens: this.apiConfig.maxTokens,
      temperature: this.apiConfig.temperature,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("LLM API call failed:", error);
      throw error;
    }
  }

  /**
   * Xử lý câu hỏi qua LLM API
   */
  async processWithLLM(
    userMessage,
    sensorContext = null,
    conversationHistory = []
  ) {
    const messages = [
      {
        role: "system",
        content: this.systemPrompt,
      },
    ];

    // Nếu có sensor context, thêm vào
    if (sensorContext) {
      messages.push({
        role: "system",
        content: `Dữ liệu sensor hiện tại để tham khảo:\n${sensorContext}`,
      });
    }

    // Thêm conversation history (các tin nhắn trước đó)
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    // Thêm tin nhắn hiện tại của user
    messages.push({
      role: "user",
      content: userMessage,
    });

    return await this.callLLMApi(messages);
  }

  /**
   * Main chat function
   */
  async chat(message, sessionId = null, conversationHistory = []) {
    const startTime = Date.now();
    let response;
    let isWeatherQuery = false;

    try {
      // Kiểm tra câu hỏi có liên quan thời tiết không
      isWeatherQuery = this.isWeatherRelated(message);

      let sensorContext = null;

      // Nếu liên quan thời tiết, lấy dữ liệu sensor làm context
      if (isWeatherQuery) {
        sensorContext = await this.getAllSensorContext();
      }

      // Gọi LLM API với conversation history
      response = await this.processWithLLM(
        message,
        sensorContext,
        conversationHistory
      );
    } catch (error) {
      console.error("Chat error:", error);

      // Fallback response khi LLM API fail
      if (isWeatherQuery) {
        try {
          // Thử trả về dữ liệu cơ bản từ DB
          const current = await this.db.getLatestData();
          if (current) {
            response = `⚠️ Không thể kết nối AI, đây là dữ liệu cơ bản:\n\n`;
            response += `🌡️ Nhiệt độ: ${
              current.temperature?.toFixed(1) ?? "--"
            }°C\n`;
            response += `💧 Độ ẩm: ${current.humidity?.toFixed(1) ?? "--"}%\n`;
            response += `🌬️ Không khí: ${
              current.air_quality?.toFixed(3) ?? "--"
            }V`;
          } else {
            response = "Xin lỗi, không thể lấy dữ liệu sensor lúc này.";
          }
        } catch (dbError) {
          response = "Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.";
        }
      } else {
        response = `Xin lỗi, tôi đang gặp sự cố kết nối. Lỗi: ${error.message}`;
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      message: response,
      isWeatherQuery,
      processingTime,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = WeatherChatbot;
