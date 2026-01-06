/**
 * Weather Chat Widget
 * Chatbot widget ở góc dưới phải màn hình
 */

class ChatWidget {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || "/api/chat";
    this.sessionId = this.getOrCreateSession();
    this.isOpen = false;
    this.isTyping = false;

    this.init();
  }

  getOrCreateSession() {
    let sessionId = localStorage.getItem("chat_session_id");
    if (!sessionId) {
      sessionId =
        "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("chat_session_id", sessionId);
    }
    return sessionId;
  }

  init() {
    this.createWidget();
    this.bindEvents();
    this.loadHistory();
  }

  createWidget() {
    // Container chính
    const widget = document.createElement("div");
    widget.id = "chat-widget";
    widget.innerHTML = `
      <!-- Nút toggle -->
      <button class="chat-toggle" id="chatToggle" aria-label="Mở chat">
        <svg class="chat-icon" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
          <path d="M7 9h10v2H7zm0-3h10v2H7zm0 6h7v2H7z"/>
        </svg>
        <svg class="close-icon" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
        <span class="chat-badge" id="chatBadge">1</span>
      </button>

      <!-- Chat container -->
      <div class="chat-container" id="chatContainer">
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-avatar">🌤️</div>
          <div class="chat-info">
            <h4>Weather Bot</h4>
            <span class="chat-status">
              <span class="chat-status-dot"></span>
              Online
            </span>
          </div>
        </div>

        <!-- Messages -->
        <div class="chat-messages" id="chatMessages">
          <div class="welcome-message">
            <h3>👋 Xin chào!</h3>
            <p>Tôi là Weather Bot. Hãy hỏi tôi về nhiệt độ, độ ẩm, chất lượng không khí!</p>
          </div>
        </div>

        <!-- Quick actions -->
        <div class="quick-actions" id="quickActions">
          <button class="quick-action" data-message="Nhiệt độ hiện tại">🌡️ Nhiệt độ</button>
          <button class="quick-action" data-message="Độ ẩm hiện tại">💧 Độ ẩm</button>
          <button class="quick-action" data-message="Chất lượng không khí">🌬️ Không khí</button>
          <button class="quick-action" data-message="Thống kê hôm nay">📊 Thống kê</button>
        </div>

        <!-- Input -->
        <div class="chat-input-container">
          <div class="chat-input-wrapper">
            <textarea 
              class="chat-input" 
              id="chatInput" 
              placeholder="Nhập tin nhắn..." 
              rows="1"
            ></textarea>
            <button class="chat-send" id="chatSend" aria-label="Gửi">
              <svg viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // Cache elements
    this.elements = {
      toggle: document.getElementById("chatToggle"),
      container: document.getElementById("chatContainer"),
      messages: document.getElementById("chatMessages"),
      input: document.getElementById("chatInput"),
      send: document.getElementById("chatSend"),
      badge: document.getElementById("chatBadge"),
      quickActions: document.getElementById("quickActions"),
    };
  }

  bindEvents() {
    // Toggle chat
    this.elements.toggle.addEventListener("click", () => this.toggle());

    // Send message
    this.elements.send.addEventListener("click", () => this.sendMessage());

    // Enter to send (Shift+Enter for new line)
    this.elements.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.elements.input.addEventListener("input", () => {
      this.elements.input.style.height = "auto";
      this.elements.input.style.height =
        Math.min(this.elements.input.scrollHeight, 100) + "px";
    });

    // Quick actions
    this.elements.quickActions.addEventListener("click", (e) => {
      if (e.target.classList.contains("quick-action")) {
        const message = e.target.dataset.message;
        if (message) {
          this.elements.input.value = message;
          this.sendMessage();
        }
      }
    });

    // Close on escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.elements.container.classList.add("open");
    this.elements.toggle.classList.add("active");
    this.elements.badge.classList.remove("show");
    this.elements.input.focus();
    this.scrollToBottom();
  }

  close() {
    this.isOpen = false;
    this.elements.container.classList.remove("open");
    this.elements.toggle.classList.remove("active");
  }

  async sendMessage() {
    const message = this.elements.input.value.trim();
    if (!message || this.isTyping) return;

    // Clear input
    this.elements.input.value = "";
    this.elements.input.style.height = "auto";

    // Add user message
    this.addMessage(message, "user");

    // Show typing indicator
    this.showTyping();

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          sessionId: this.sessionId,
        }),
      });

      const data = await response.json();

      // Hide typing
      this.hideTyping();

      if (data.success) {
        this.addMessage(data.response, "assistant");

        // Update session if new
        if (data.sessionId) {
          this.sessionId = data.sessionId;
          localStorage.setItem("chat_session_id", data.sessionId);
        }
      } else {
        this.addMessage(
          "Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại.",
          "assistant"
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      this.hideTyping();
      this.addMessage(
        "Không thể kết nối đến server. Vui lòng kiểm tra kết nối.",
        "assistant"
      );
    }
  }

  addMessage(content, role) {
    // Remove welcome message if exists
    const welcome = this.elements.messages.querySelector(".welcome-message");
    if (welcome) {
      welcome.remove();
    }

    const messageEl = document.createElement("div");
    messageEl.className = `message ${role}`;

    const avatar = role === "user" ? "👤" : "🤖";

    // Format content (basic markdown)
    const formattedContent = this.formatMessage(content);

    messageEl.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">${formattedContent}</div>
    `;

    this.elements.messages.appendChild(messageEl);
    this.scrollToBottom();
  }

  formatMessage(content) {
    // Basic markdown formatting
    return (
      content
        // Bold: **text** or __text__
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/__(.*?)__/g, "<strong>$1</strong>")
        // Italic: *text* or _text_
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/_(.*?)_/g, "<em>$1</em>")
        // Code: `text`
        .replace(/`(.*?)`/g, "<code>$1</code>")
        // Line breaks
        .replace(/\n/g, "<br>")
    );
  }

  showTyping() {
    this.isTyping = true;
    this.elements.send.disabled = true;

    const typingEl = document.createElement("div");
    typingEl.className = "message assistant";
    typingEl.id = "typingIndicator";
    typingEl.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;

    this.elements.messages.appendChild(typingEl);
    this.scrollToBottom();
  }

  hideTyping() {
    this.isTyping = false;
    this.elements.send.disabled = false;

    const typingEl = document.getElementById("typingIndicator");
    if (typingEl) {
      typingEl.remove();
    }
  }

  scrollToBottom() {
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
  }

  async loadHistory() {
    try {
      const response = await fetch(
        `${this.apiUrl}/history/${this.sessionId}?limit=20`
      );
      const data = await response.json();

      if (data.success && data.messages && data.messages.length > 0) {
        // Remove welcome message
        const welcome =
          this.elements.messages.querySelector(".welcome-message");
        if (welcome) {
          welcome.remove();
        }

        // Add historical messages
        data.messages.forEach((msg) => {
          const messageEl = document.createElement("div");
          messageEl.className = `message ${msg.role}`;
          const avatar = msg.role === "user" ? "👤" : "🤖";
          const formattedContent = this.formatMessage(msg.message);

          messageEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${formattedContent}</div>
          `;
          messageEl.style.animation = "none"; // Disable animation for history

          this.elements.messages.appendChild(messageEl);
        });

        this.scrollToBottom();
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  }

  // Public method to show notification badge
  showBadge(count = 1) {
    this.elements.badge.textContent = count;
    this.elements.badge.classList.add("show");
  }

  // Public method to programmatically send a message
  async send(message) {
    this.elements.input.value = message;
    await this.sendMessage();
  }

  // Start new session
  newSession() {
    this.sessionId =
      "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("chat_session_id", this.sessionId);

    // Clear messages
    this.elements.messages.innerHTML = `
      <div class="welcome-message">
        <h3>👋 Xin chào!</h3>
        <p>Tôi là Weather Bot. Hãy hỏi tôi về nhiệt độ, độ ẩm, chất lượng không khí!</p>
      </div>
    `;
  }
}

// Auto-init when DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.chatWidget = new ChatWidget();
  });
} else {
  window.chatWidget = new ChatWidget();
}
