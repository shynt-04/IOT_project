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

    // System prompt cho AI - Đã cải thiện
    this.systemPrompt = `Bạn là Weather Bot, trợ lý thông minh chuyên phân tích dữ liệu thời tiết từ hệ thống IoT sensor.

NHIỆM VỤ CHÍNH:
1. Phân tích và báo cáo dữ liệu nhiệt độ, độ ẩm, chất lượng không khí từ sensor
2. Đưa ra đánh giá, nhận xét chuyên môn về điều kiện môi trường
3. Cung cấp lời khuyên thực tế, hữu ích dựa trên dữ liệu
4. Trả lời các câu hỏi chung một cách chuyên nghiệp

QUY TẮC BẮT BUỘC:
- KHÔNG sử dụng emoji, icon, sticker trong câu trả lời
- Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng, đi thẳng vào vấn đề
- Sử dụng ngôn ngữ chuyên nghiệp nhưng dễ hiểu
- Khi trình bày số liệu, định dạng gọn gàng và có cấu trúc
- Luôn đưa ra lời khuyên cụ thể khi có dữ liệu bất thường

TIÊU CHUẨN ĐÁNH GIÁ MÔI TRƯỜNG:

Nhiệt độ:
- Dưới 18 độ C: Lạnh, cần giữ ấm
- 18-24 độ C: Mát mẻ, lý tưởng
- 24-28 độ C: Ấm áp, thoải mái
- 28-32 độ C: Nóng, cần thông gió
- Trên 32 độ C: Rất nóng, cần làm mát

Độ ẩm:
- Dưới 30%: Quá khô, cần tăng độ ẩm
- 30-40%: Hơi khô
- 40-60%: Lý tưởng, thoải mái
- 60-70%: Hơi ẩm
- Trên 70%: Quá ẩm, cần hút ẩm hoặc thông gió

Chất lượng không khí (đo bằng điện áp V):
- Dưới 1.0V: Rất tốt
- 1.0-1.5V: Tốt
- 1.5-1.9V: Trung bình, chấp nhận được
- 1.9-2.5V: Kém, cần cải thiện thông gió
- Trên 2.5V: Xấu, cần xử lý ngay

ĐỊNH DẠNG TRẢ LỜI:
- Với câu hỏi về dữ liệu hiện tại: Báo số liệu + đánh giá + lời khuyên (nếu cần)
- Với câu hỏi về thống kê: Tóm tắt xu hướng + nhận xét
- Với câu hỏi chung: Trả lời trực tiếp, không vòng vo

VÍ DỤ CÁCH TRẢ LỜI:

Câu hỏi: "Nhiệt độ hiện tại?"
Trả lời: "Nhiệt độ hiện tại: 28.5 độ C. Mức này hơi cao, bạn nên bật quạt hoặc điều hòa để thoải mái hơn."

Câu hỏi: "Chất lượng không khí thế nào?"
Trả lời: "Chất lượng không khí: 1.2V - Mức tốt. Không khí trong lành, phù hợp cho các hoạt động trong nhà."

Câu hỏi: "Tóm tắt tình hình?"
Trả lời: 
"Tình hình môi trường hiện tại:
- Nhiệt độ: 26.3 độ C (thoải mái)
- Độ ẩm: 65% (hơi cao)
- Không khí: 1.4V (tốt)

Khuyến nghị: Độ ẩm đang cao hơn mức lý tưởng. Nên mở cửa sổ hoặc bật quạt thông gió để giảm độ ẩm."`;

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
      "môi trường",
      "tình hình",
      "tóm tắt",
      "báo cáo",
      "thống kê",
      "dữ liệu",
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
      "report",
      "summary",
      "status",
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

      let context = "=== DU LIEU SENSOR HIEN TAI ===\n";

      if (current) {
        const timestamp = current.timestamp
          ? new Date(current.timestamp).toLocaleString("vi-VN")
          : "Khong xac dinh";

        context += `\nDU LIEU MOI NHAT (${timestamp}):\n`;
        context += `- Nhiet do: ${
          current.temperature?.toFixed(1) ?? "Khong co"
        } do C\n`;
        context += `- Do am: ${current.humidity?.toFixed(1) ?? "Khong co"}%\n`;
        context += `- Chat luong khong khi: ${
          current.air_quality?.toFixed(3) ?? "Khong co"
        }V`;

        if (current.air_quality !== null && current.air_quality !== undefined) {
          if (current.air_quality > 2.5) {
            context += " (MUC XAU - can xu ly ngay)";
          } else if (current.air_quality > 1.9) {
            context += " (MUC KEM - can cai thien)";
          } else if (current.air_quality > 1.5) {
            context += " (MUC TRUNG BINH)";
          } else if (current.air_quality > 1.0) {
            context += " (MUC TOT)";
          } else {
            context += " (MUC RAT TOT)";
          }
        }
        context += "\n";
      } else {
        context += "\nKhong co du lieu sensor hien tai.\n";
      }

      if (statistics) {
        context += `\nTHONG KE 24 GIO QUA:\n`;
        context += `- Nhiet do: Trung binh ${
          statistics.avg_temp?.toFixed(1) ?? "N/A"
        } do C, `;
        context += `Thap nhat ${
          statistics.min_temp?.toFixed(1) ?? "N/A"
        } do C, `;
        context += `Cao nhat ${
          statistics.max_temp?.toFixed(1) ?? "N/A"
        } do C\n`;
        context += `- Do am: Trung binh ${
          statistics.avg_humidity?.toFixed(1) ?? "N/A"
        }%, `;
        context += `Thap nhat ${
          statistics.min_humidity?.toFixed(1) ?? "N/A"
        }%, `;
        context += `Cao nhat ${
          statistics.max_humidity?.toFixed(1) ?? "N/A"
        }%\n`;
        context += `- Chat luong KK: Trung binh ${
          statistics.avg_air_quality?.toFixed(3) ?? "N/A"
        }V\n`;
        context += `- Tong so ban ghi: ${statistics.total_records ?? 0}\n`;
      }

      if (recent && recent.length > 0) {
        context += `\n${recent.length} BAN GHI GAN NHAT:\n`;
        recent.slice(0, 5).forEach((r, i) => {
          const time = r.timestamp
            ? new Date(r.timestamp).toLocaleTimeString("vi-VN")
            : "N/A";
          context += `${i + 1}. [${time}] Nhiet do: ${
            r.temperature?.toFixed(1) ?? "N/A"
          } do C | `;
          context += `Do am: ${r.humidity?.toFixed(1) ?? "N/A"}% | `;
          context += `Khong khi: ${r.air_quality?.toFixed(3) ?? "N/A"}V\n`;
        });
      }

      return context;
    } catch (error) {
      console.error("Error getting sensor context:", error);
      return "Loi: Khong the lay du lieu sensor.";
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
        content: `Du lieu sensor hien tai de tham khao (KHONG dung emoji khi tra loi):\n${sensorContext}`,
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
   * Tạo fallback response khi không có LLM
   */
  createFallbackResponse(data, type = "current") {
    if (!data) {
      return "Xin loi, khong the lay du lieu sensor luc nay. Vui long thu lai sau.";
    }

    let response = "";

    if (type === "current") {
      response = "Du lieu sensor hien tai:\n\n";
      response += `- Nhiet do: ${data.temperature?.toFixed(1) ?? "--"} do C`;

      // Đánh giá nhiệt độ
      if (data.temperature !== null && data.temperature !== undefined) {
        if (data.temperature < 18) {
          response += " (lanh)";
        } else if (data.temperature <= 28) {
          response += " (thoai mai)";
        } else {
          response += " (nong)";
        }
      }
      response += "\n";

      response += `- Do am: ${data.humidity?.toFixed(1) ?? "--"}%`;

      // Đánh giá độ ẩm
      if (data.humidity !== null && data.humidity !== undefined) {
        if (data.humidity < 40) {
          response += " (kho)";
        } else if (data.humidity <= 60) {
          response += " (ly tuong)";
        } else {
          response += " (am cao)";
        }
      }
      response += "\n";

      response += `- Chat luong khong khi: ${
        data.air_quality?.toFixed(3) ?? "--"
      }V`;

      // Đánh giá không khí
      if (data.air_quality !== null && data.air_quality !== undefined) {
        if (data.air_quality <= 1.5) {
          response += " (tot)";
        } else if (data.air_quality <= 1.9) {
          response += " (trung binh)";
        } else {
          response += " (kem - can cai thien thong gio)";
        }
      }

      // Thêm khuyến nghị nếu có vấn đề
      const issues = [];
      if (data.temperature > 30) issues.push("nhiet do cao");
      if (data.humidity > 70) issues.push("do am cao");
      if (data.air_quality > 1.9) issues.push("chat luong khong khi kem");

      if (issues.length > 0) {
        response += `\n\nKhuyen nghi: Can chu y ${issues.join(
          ", "
        )}. Nen mo cua so hoac bat quat thong gio.`;
      }
    }

    return response;
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
          response = this.createFallbackResponse(current, "current");
          response = "[Che do offline] " + response;
        } catch (dbError) {
          response = "Xin loi, da co loi xay ra. Vui long thu lai sau.";
        }
      } else {
        response = `Xin loi, toi dang gap su co ket noi. Vui long thu lai sau.`;
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
