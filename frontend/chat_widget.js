/**
 * Weather Chat Widget - Enhanced Version
 * Chatbot widget với tính năng:
 * - Tạo cuộc hội thoại mới
 * - Resize/Expand kích thước cửa sổ chat
 * - Fullscreen mode
 */

class ChatWidget {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || "/api/chat";
    this.sessionId = this.getOrCreateSession();
    this.isOpen = false;
    this.isTyping = false;
    this.isExpanded = false;
    this.isFullscreen = false;

    // Lưu size preferences
    this.sizeMode = localStorage.getItem("chat_size_mode") || "normal"; // normal, expanded, fullscreen

    this.init();
  }

  getOrCreateSession() {
    let sessionId = localStorage.getItem("chat_session_id");
    if (!sessionId) {
      sessionId = this.generateSessionId();
      localStorage.setItem("chat_session_id", sessionId);
    }
    return sessionId;
  }

  generateSessionId() {
    return (
      "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    );
  }

  init() {
    this.createWidget();
    this.bindEvents();
    this.loadHistory();
    this.applySizeMode();
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
          <div class="chat-header-left">
            <div class="chat-avatar">🌤️</div>
            <div class="chat-info">
              <h4>Weather Bot</h4>
              <span class="chat-status">
                <span class="chat-status-dot"></span>
                Online
              </span>
            </div>
          </div>
          
          <!-- Header Actions -->
          <div class="chat-header-actions">
            <!-- New Chat Button -->
            <button class="header-action-btn" id="newChatBtn" title="Cuộc hội thoại mới">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
            
            <!-- Resize Button -->
            <button class="header-action-btn" id="expandBtn" title="Mở rộng">
              <svg class="expand-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
              <svg class="shrink-icon" viewBox="0 0 24 24" width="18" height="18" style="display:none">
                <path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              </svg>
            </button>
            
            <!-- Fullscreen Button -->
            <button class="header-action-btn" id="fullscreenBtn" title="Toàn màn hình">
              <svg class="fullscreen-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M5 5h5V3H3v7h2V5zm9-2v2h5v5h2V3h-7zm7 14h-2v5h-5v2h7v-7zM5 19v-5H3v7h7v-2H5z"/>
              </svg>
              <svg class="exit-fullscreen-icon" viewBox="0 0 24 24" width="18" height="18" style="display:none">
                <path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              </svg>
            </button>
            
            <!-- Close Button (for expanded/fullscreen) -->
            <button class="header-action-btn close-chat-btn" id="closeChatBtn" title="Đóng">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
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
        
        <!-- Resize handle cho drag resize -->
        <div class="resize-handle" id="resizeHandle">
          <svg viewBox="0 0 24 24" width="12" height="12">
            <path fill="currentColor" d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z"/>
          </svg>
        </div>
      </div>
      
      <!-- New Chat Confirmation Modal -->
      <div class="chat-modal-overlay" id="newChatModal">
        <div class="chat-modal">
          <div class="chat-modal-icon">💬</div>
          <h3>Tạo cuộc hội thoại mới?</h3>
          <p>Cuộc hội thoại hiện tại sẽ được lưu lại và bạn sẽ bắt đầu một cuộc trò chuyện mới.</p>
          <div class="chat-modal-actions">
            <button class="modal-btn modal-btn-cancel" id="cancelNewChat">Hủy</button>
            <button class="modal-btn modal-btn-confirm" id="confirmNewChat">Tạo mới</button>
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
      newChatBtn: document.getElementById("newChatBtn"),
      expandBtn: document.getElementById("expandBtn"),
      fullscreenBtn: document.getElementById("fullscreenBtn"),
      closeChatBtn: document.getElementById("closeChatBtn"),
      resizeHandle: document.getElementById("resizeHandle"),
      newChatModal: document.getElementById("newChatModal"),
      cancelNewChat: document.getElementById("cancelNewChat"),
      confirmNewChat: document.getElementById("confirmNewChat"),
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
      if (e.key === "Escape") {
        if (this.elements.newChatModal.classList.contains("show")) {
          this.hideNewChatModal();
        } else if (this.isOpen) {
          this.close();
        }
      }
    });

    // New Chat Button
    this.elements.newChatBtn.addEventListener("click", () => {
      this.showNewChatModal();
    });

    // Modal events
    this.elements.cancelNewChat.addEventListener("click", () => {
      this.hideNewChatModal();
    });

    this.elements.confirmNewChat.addEventListener("click", () => {
      this.newSession();
      this.hideNewChatModal();
    });

    // Click outside modal to close
    this.elements.newChatModal.addEventListener("click", (e) => {
      if (e.target === this.elements.newChatModal) {
        this.hideNewChatModal();
      }
    });

    // Expand Button
    this.elements.expandBtn.addEventListener("click", () => {
      this.toggleExpand();
    });

    // Fullscreen Button
    this.elements.fullscreenBtn.addEventListener("click", () => {
      this.toggleFullscreen();
    });

    // Close Button (in header)
    this.elements.closeChatBtn.addEventListener("click", () => {
      this.close();
    });

    // Drag resize
    this.initDragResize();
  }

  // ==================== SIZE CONTROL ====================

  initDragResize() {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    this.elements.resizeHandle.addEventListener("mousedown", (e) => {
      if (this.isFullscreen) return;

      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.elements.container.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;

      document.body.style.cursor = "nwse-resize";
      document.body.style.userSelect = "none";

      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;

      // Resize từ góc trên trái (vì chat ở góc dưới phải)
      const deltaX = startX - e.clientX;
      const deltaY = startY - e.clientY;

      const newWidth = Math.max(320, Math.min(800, startWidth + deltaX));
      const newHeight = Math.max(400, Math.min(900, startHeight + deltaY));

      this.elements.container.style.width = newWidth + "px";
      this.elements.container.style.height = newHeight + "px";
    });

    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        // Lưu custom size
        const rect = this.elements.container.getBoundingClientRect();
        localStorage.setItem(
          "chat_custom_size",
          JSON.stringify({
            width: rect.width,
            height: rect.height,
          })
        );
      }
    });

    // Touch support cho mobile
    this.elements.resizeHandle.addEventListener(
      "touchstart",
      (e) => {
        if (this.isFullscreen) return;

        const touch = e.touches[0];
        isResizing = true;
        startX = touch.clientX;
        startY = touch.clientY;

        const rect = this.elements.container.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;

        e.preventDefault();
      },
      { passive: false }
    );

    document.addEventListener(
      "touchmove",
      (e) => {
        if (!isResizing) return;

        const touch = e.touches[0];
        const deltaX = startX - touch.clientX;
        const deltaY = startY - touch.clientY;

        const newWidth = Math.max(
          280,
          Math.min(window.innerWidth - 32, startWidth + deltaX)
        );
        const newHeight = Math.max(
          350,
          Math.min(window.innerHeight - 100, startHeight + deltaY)
        );

        this.elements.container.style.width = newWidth + "px";
        this.elements.container.style.height = newHeight + "px";
      },
      { passive: false }
    );

    document.addEventListener("touchend", () => {
      if (isResizing) {
        isResizing = false;
        const rect = this.elements.container.getBoundingClientRect();
        localStorage.setItem(
          "chat_custom_size",
          JSON.stringify({
            width: rect.width,
            height: rect.height,
          })
        );
      }
    });
  }

  toggleExpand() {
    if (this.isFullscreen) {
      this.exitFullscreen();
    }

    this.isExpanded = !this.isExpanded;
    this.elements.container.classList.toggle("expanded", this.isExpanded);

    // Toggle icons
    const expandIcon = this.elements.expandBtn.querySelector(".expand-icon");
    const shrinkIcon = this.elements.expandBtn.querySelector(".shrink-icon");

    if (this.isExpanded) {
      expandIcon.style.display = "none";
      shrinkIcon.style.display = "block";
      this.elements.expandBtn.title = "Thu nhỏ";
      this.sizeMode = "expanded";
    } else {
      expandIcon.style.display = "block";
      shrinkIcon.style.display = "none";
      this.elements.expandBtn.title = "Mở rộng";
      this.sizeMode = "normal";

      // Reset custom size
      this.elements.container.style.width = "";
      this.elements.container.style.height = "";
    }

    localStorage.setItem("chat_size_mode", this.sizeMode);
    this.scrollToBottom();
  }

  toggleFullscreen() {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  enterFullscreen() {
    this.isFullscreen = true;
    this.isExpanded = false;
    this.elements.container.classList.remove("expanded");
    this.elements.container.classList.add("fullscreen");

    // Update icons
    this.elements.fullscreenBtn.querySelector(
      ".fullscreen-icon"
    ).style.display = "none";
    this.elements.fullscreenBtn.querySelector(
      ".exit-fullscreen-icon"
    ).style.display = "block";
    this.elements.fullscreenBtn.title = "Thoát toàn màn hình";

    // Reset expand button
    this.elements.expandBtn.querySelector(".expand-icon").style.display =
      "block";
    this.elements.expandBtn.querySelector(".shrink-icon").style.display =
      "none";

    this.sizeMode = "fullscreen";
    localStorage.setItem("chat_size_mode", this.sizeMode);

    // Hide toggle button in fullscreen
    this.elements.toggle.style.display = "none";

    this.scrollToBottom();
  }

  exitFullscreen() {
    this.isFullscreen = false;
    this.elements.container.classList.remove("fullscreen");

    // Update icons
    this.elements.fullscreenBtn.querySelector(
      ".fullscreen-icon"
    ).style.display = "block";
    this.elements.fullscreenBtn.querySelector(
      ".exit-fullscreen-icon"
    ).style.display = "none";
    this.elements.fullscreenBtn.title = "Toàn màn hình";

    this.sizeMode = "normal";
    localStorage.setItem("chat_size_mode", this.sizeMode);

    // Show toggle button
    this.elements.toggle.style.display = "flex";

    // Reset custom size
    this.elements.container.style.width = "";
    this.elements.container.style.height = "";

    this.scrollToBottom();
  }

  applySizeMode() {
    const savedMode = localStorage.getItem("chat_size_mode") || "normal";

    if (savedMode === "expanded") {
      this.isExpanded = true;
      this.elements.container.classList.add("expanded");
      this.elements.expandBtn.querySelector(".expand-icon").style.display =
        "none";
      this.elements.expandBtn.querySelector(".shrink-icon").style.display =
        "block";
      this.elements.expandBtn.title = "Thu nhỏ";
    }

    // Load custom size nếu có
    const customSize = localStorage.getItem("chat_custom_size");
    if (customSize && savedMode !== "fullscreen") {
      try {
        const size = JSON.parse(customSize);
        this.elements.container.style.width = size.width + "px";
        this.elements.container.style.height = size.height + "px";
      } catch (e) {
        // Ignore
      }
    }
  }

  // ==================== NEW CHAT MODAL ====================

  showNewChatModal() {
    this.elements.newChatModal.classList.add("show");
  }

  hideNewChatModal() {
    this.elements.newChatModal.classList.remove("show");
  }

  // ==================== CORE FUNCTIONS ====================

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
    // Exit fullscreen first if active
    if (this.isFullscreen) {
      this.exitFullscreen();
    }

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
    this.sessionId = this.generateSessionId();
    localStorage.setItem("chat_session_id", this.sessionId);

    // Clear messages with animation
    const messages = this.elements.messages.querySelectorAll(".message");
    messages.forEach((msg, index) => {
      msg.style.animation = `fadeOut 0.2s ease ${index * 0.05}s forwards`;
    });

    // Show welcome after animation
    setTimeout(() => {
      this.elements.messages.innerHTML = `
        <div class="welcome-message">
          <div class="new-chat-indicator">✨ Cuộc hội thoại mới</div>
          <h3>👋 Xin chào!</h3>
          <p>Tôi là Weather Bot. Hãy hỏi tôi về nhiệt độ, độ ẩm, chất lượng không khí!</p>
        </div>
      `;
    }, messages.length * 50 + 200);
  }

  // Get current session ID (for external use)
  getSessionId() {
    return this.sessionId;
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
