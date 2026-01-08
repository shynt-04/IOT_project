/**
 * Weather Chat Widget - Enhanced Version with Voice Support
 * Chatbot widget với tính năng:
 * - Tạo cuộc hội thoại mới
 * - Resize/Expand kích thước cửa sổ chat
 * - Fullscreen mode
 * - Voice Input (Speech-to-Text)
 * - Voice Output (Text-to-Speech)
 * - Hỗ trợ cả tiếng Việt và tiếng Anh
 */

class ChatWidget {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || "/api/chat";
    this.sessionId = this.getOrCreateSession();
    this.isOpen = false;
    this.isTyping = false;
    this.isExpanded = false;
    this.isFullscreen = false;

    // Voice settings
    this.voiceEnabled = localStorage.getItem("chat_voice_enabled") !== "false";
    this.autoSpeak = localStorage.getItem("chat_auto_speak") === "true";
    this.isListening = false;
    this.isSpeaking = false;
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.preferredVoice = null;
    this.voiceLanguage = localStorage.getItem("chat_voice_lang") || "vi-VN";

    // External TTS API (optional)
    this.ttsApiUrl = options.ttsApiUrl || null; // e.g., '/api/tts'
    this.sttApiUrl = options.sttApiUrl || null; // e.g., '/api/stt'

    // Lưu size preferences
    this.sizeMode = localStorage.getItem("chat_size_mode") || "normal";

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
    this.initVoice();
    this.loadHistory();
    this.applySizeMode();
  }

  // ==================== VOICE INITIALIZATION ====================

  initVoice() {
    // Initialize Speech Recognition
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = this.voiceLanguage;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.updateVoiceUI();
        this.showVoiceStatus("Đang nghe...", "listening");
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Show interim results in input
        if (interimTranscript) {
          this.elements.input.value = interimTranscript;
          this.elements.input.classList.add("voice-interim");
        }

        // Process final result
        if (finalTranscript) {
          this.elements.input.value = finalTranscript;
          this.elements.input.classList.remove("voice-interim");
          this.showVoiceStatus(
            "Đã nhận: " + finalTranscript.substring(0, 30) + "...",
            "success"
          );
        }
      };

      this.recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        this.isListening = false;
        this.updateVoiceUI();

        let errorMsg = "Lỗi nhận dạng giọng nói";
        switch (event.error) {
          case "no-speech":
            errorMsg = "Không nghe thấy giọng nói";
            break;
          case "audio-capture":
            errorMsg = "Không tìm thấy microphone";
            break;
          case "not-allowed":
            errorMsg = "Vui lòng cho phép truy cập microphone";
            break;
          case "network":
            errorMsg = "Lỗi kết nối mạng";
            break;
        }
        this.showVoiceStatus(errorMsg, "error");
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.updateVoiceUI();

        // Auto-send if we have text
        const text = this.elements.input.value.trim();
        if (text && !this.elements.input.classList.contains("voice-interim")) {
          setTimeout(() => this.sendMessage(), 300);
        }
      };
    }

    // Initialize Text-to-Speech voices
    if (this.synthesis) {
      // Load voices
      this.loadVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    const voices = this.synthesis.getVoices();

    // Prefer Vietnamese voice, fallback to English
    this.preferredVoice =
      voices.find((v) => v.lang.startsWith("vi")) ||
      voices.find((v) => v.lang.startsWith("en")) ||
      voices[0];

    console.log(
      "Available voices:",
      voices.length,
      "| Selected:",
      this.preferredVoice?.name
    );
  }

  // ==================== WIDGET CREATION ====================

  createWidget() {
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
            <!-- Voice Settings -->
            <button class="header-action-btn" id="voiceSettingsBtn" title="Cài đặt giọng nói">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
                <path fill="currentColor" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
            
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
            
            <!-- Close Button -->
            <button class="header-action-btn close-chat-btn" id="closeChatBtn" title="Đóng">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Voice Status Bar -->
        <div class="voice-status-bar" id="voiceStatusBar">
          <div class="voice-status-content">
            <span class="voice-status-icon">🎤</span>
            <span class="voice-status-text" id="voiceStatusText">Sẵn sàng</span>
          </div>
          <div class="voice-visualizer" id="voiceVisualizer">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>

        <!-- Messages -->
        <div class="chat-messages" id="chatMessages">
          <div class="welcome-message">
            <h3>👋 Xin chào!</h3>
            <p>Tôi là Weather Bot. Hãy hỏi tôi về nhiệt độ, độ ẩm, chất lượng không khí!</p>
            <p class="voice-hint">💡 Nhấn nút 🎤 để nói chuyện bằng giọng nói</p>
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
            <!-- Voice Input Button -->
            <button class="voice-input-btn" id="voiceInputBtn" title="Nhấn để nói">
              <svg class="mic-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path fill="currentColor" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
              <svg class="mic-off-icon" viewBox="0 0 24 24" width="20" height="20" style="display:none">
                <path fill="currentColor" d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
              </svg>
              <div class="voice-pulse"></div>
            </button>
            
            <textarea 
              class="chat-input" 
              id="chatInput" 
              placeholder="Nhập tin nhắn hoặc nhấn 🎤 để nói..." 
              rows="1"
            ></textarea>
            
            <button class="chat-send" id="chatSend" aria-label="Gửi">
              <svg viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
          
          <!-- Voice Output Toggle -->
          <div class="voice-output-toggle">
            <label class="toggle-switch">
              <input type="checkbox" id="autoSpeakToggle" ${
                this.autoSpeak ? "checked" : ""
              }>
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">🔊 Tự động đọc phản hồi</span>
          </div>
        </div>
        
        <!-- Resize handle -->
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
      
      <!-- Voice Settings Modal -->
      <div class="chat-modal-overlay" id="voiceSettingsModal">
        <div class="chat-modal voice-settings-modal">
          <div class="chat-modal-icon">🎙️</div>
          <h3>Cài đặt giọng nói</h3>
          
          <div class="voice-settings-content">
            <!-- Language Selection -->
            <div class="setting-group">
              <label>Ngôn ngữ nhận dạng:</label>
              <select id="voiceLangSelect" class="setting-select">
                <option value="vi-VN">🇻🇳 Tiếng Việt</option>
                <option value="en-US">🇺🇸 English (US)</option>
                <option value="en-GB">🇬🇧 English (UK)</option>
                <option value="ja-JP">🇯🇵 日本語</option>
                <option value="ko-KR">🇰🇷 한국어</option>
                <option value="zh-CN">🇨🇳 中文</option>
              </select>
            </div>
            
            <!-- TTS Voice Selection -->
            <div class="setting-group">
              <label>Giọng đọc:</label>
              <select id="ttsVoiceSelect" class="setting-select">
                <option value="">Mặc định</option>
              </select>
            </div>
            
            <!-- Speech Rate -->
            <div class="setting-group">
              <label>Tốc độ đọc: <span id="speechRateValue">1.0</span>x</label>
              <input type="range" id="speechRateSlider" min="0.5" max="2" step="0.1" value="1" class="setting-slider">
            </div>
            
            <!-- Test Voice -->
            <button class="modal-btn modal-btn-test" id="testVoiceBtn">
              🔊 Thử giọng đọc
            </button>
          </div>
          
          <div class="chat-modal-actions">
            <button class="modal-btn modal-btn-cancel" id="closeVoiceSettings">Đóng</button>
            <button class="modal-btn modal-btn-confirm" id="saveVoiceSettings">Lưu</button>
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
      // Voice elements
      voiceInputBtn: document.getElementById("voiceInputBtn"),
      voiceStatusBar: document.getElementById("voiceStatusBar"),
      voiceStatusText: document.getElementById("voiceStatusText"),
      voiceVisualizer: document.getElementById("voiceVisualizer"),
      autoSpeakToggle: document.getElementById("autoSpeakToggle"),
      voiceSettingsBtn: document.getElementById("voiceSettingsBtn"),
      voiceSettingsModal: document.getElementById("voiceSettingsModal"),
      voiceLangSelect: document.getElementById("voiceLangSelect"),
      ttsVoiceSelect: document.getElementById("ttsVoiceSelect"),
      speechRateSlider: document.getElementById("speechRateSlider"),
      speechRateValue: document.getElementById("speechRateValue"),
      testVoiceBtn: document.getElementById("testVoiceBtn"),
      closeVoiceSettings: document.getElementById("closeVoiceSettings"),
      saveVoiceSettings: document.getElementById("saveVoiceSettings"),
    };

    // Set initial language
    this.elements.voiceLangSelect.value = this.voiceLanguage;
  }

  bindEvents() {
    // Toggle chat
    this.elements.toggle.addEventListener("click", () => this.toggle());

    // Send message
    this.elements.send.addEventListener("click", () => this.sendMessage());

    // Enter to send
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

    // Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.isListening) {
          this.stopListening();
        } else if (this.elements.newChatModal.classList.contains("show")) {
          this.hideNewChatModal();
        } else if (
          this.elements.voiceSettingsModal.classList.contains("show")
        ) {
          this.hideVoiceSettingsModal();
        } else if (this.isOpen) {
          this.close();
        }
      }
    });

    // New Chat
    this.elements.newChatBtn.addEventListener("click", () =>
      this.showNewChatModal()
    );
    this.elements.cancelNewChat.addEventListener("click", () =>
      this.hideNewChatModal()
    );
    this.elements.confirmNewChat.addEventListener("click", () => {
      this.newSession();
      this.hideNewChatModal();
    });
    this.elements.newChatModal.addEventListener("click", (e) => {
      if (e.target === this.elements.newChatModal) this.hideNewChatModal();
    });

    // Size controls
    this.elements.expandBtn.addEventListener("click", () =>
      this.toggleExpand()
    );
    this.elements.fullscreenBtn.addEventListener("click", () =>
      this.toggleFullscreen()
    );
    this.elements.closeChatBtn.addEventListener("click", () => this.close());

    // Voice Input Button
    this.elements.voiceInputBtn.addEventListener("click", () =>
      this.toggleVoiceInput()
    );

    // Auto Speak Toggle
    this.elements.autoSpeakToggle.addEventListener("change", (e) => {
      this.autoSpeak = e.target.checked;
      localStorage.setItem("chat_auto_speak", this.autoSpeak);
    });

    // Voice Settings
    this.elements.voiceSettingsBtn.addEventListener("click", () =>
      this.showVoiceSettingsModal()
    );
    this.elements.closeVoiceSettings.addEventListener("click", () =>
      this.hideVoiceSettingsModal()
    );
    this.elements.saveVoiceSettings.addEventListener("click", () =>
      this.saveVoiceSettings()
    );
    this.elements.voiceSettingsModal.addEventListener("click", (e) => {
      if (e.target === this.elements.voiceSettingsModal)
        this.hideVoiceSettingsModal();
    });

    // Speech rate slider
    this.elements.speechRateSlider.addEventListener("input", (e) => {
      this.elements.speechRateValue.textContent = e.target.value;
    });

    // Test voice
    this.elements.testVoiceBtn.addEventListener("click", () => {
      this.speak("Xin chào! Đây là giọng đọc thử nghiệm của Weather Bot.");
    });

    // Populate TTS voices when modal opens
    this.elements.voiceSettingsBtn.addEventListener("click", () => {
      this.populateTTSVoices();
    });

    // Drag resize
    this.initDragResize();
  }

  // ==================== VOICE FUNCTIONS ====================

  toggleVoiceInput() {
    if (!this.recognition) {
      this.showVoiceStatus(
        "Trình duyệt không hỗ trợ nhận dạng giọng nói",
        "error"
      );
      return;
    }

    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  startListening() {
    if (!this.recognition) return;

    // Stop any ongoing speech
    if (this.isSpeaking) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }

    try {
      this.recognition.lang = this.voiceLanguage;
      this.recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      // Already started, try to stop and restart
      this.recognition.stop();
      setTimeout(() => {
        try {
          this.recognition.start();
        } catch (e2) {
          console.error("Failed to restart recognition:", e2);
        }
      }, 100);
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  updateVoiceUI() {
    const btn = this.elements.voiceInputBtn;
    const micIcon = btn.querySelector(".mic-icon");
    const micOffIcon = btn.querySelector(".mic-off-icon");

    if (this.isListening) {
      btn.classList.add("listening");
      micIcon.style.display = "none";
      micOffIcon.style.display = "block";
      this.elements.voiceStatusBar.classList.add("active");
      this.elements.voiceVisualizer.classList.add("active");
    } else {
      btn.classList.remove("listening");
      micIcon.style.display = "block";
      micOffIcon.style.display = "none";
      this.elements.voiceVisualizer.classList.remove("active");

      // Hide status bar after delay
      setTimeout(() => {
        if (!this.isListening) {
          this.elements.voiceStatusBar.classList.remove("active");
        }
      }, 2000);
    }
  }

  showVoiceStatus(text, type = "info") {
    this.elements.voiceStatusText.textContent = text;
    this.elements.voiceStatusBar.className = "voice-status-bar active " + type;
  }

  // Text-to-Speech
  async speak(text) {
    if (!this.synthesis || !text) return;

    // Cancel any ongoing speech
    this.synthesis.cancel();

    // Clean text for speech
    const cleanText = text
      .replace(/[*_`#]/g, "") // Remove markdown
      .replace(/\n+/g, ". ") // Convert newlines to pauses
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();

    // Check if we should use external TTS API
    if (this.ttsApiUrl) {
      await this.speakWithAPI(cleanText);
      return;
    }

    // Use Web Speech API
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = this.preferredVoice;
    utterance.lang = this.voiceLanguage;
    utterance.rate = parseFloat(
      localStorage.getItem("chat_speech_rate") || "1"
    );
    utterance.pitch = 1;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.showVoiceStatus("Đang đọc...", "speaking");
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.elements.voiceStatusBar.classList.remove("active");
    };

    utterance.onerror = (e) => {
      console.error("Speech error:", e);
      this.isSpeaking = false;
    };

    this.synthesis.speak(utterance);
  }

  // External TTS API call
  async speakWithAPI(text) {
    try {
      const response = await fetch(this.ttsApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          language: this.voiceLanguage,
        }),
      });

      if (!response.ok) throw new Error("TTS API error");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      this.isSpeaking = true;
      this.showVoiceStatus("Đang đọc...", "speaking");

      audio.onended = () => {
        this.isSpeaking = false;
        this.elements.voiceStatusBar.classList.remove("active");
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error("TTS API error:", error);
      // Fallback to Web Speech API
      const utterance = new SpeechSynthesisUtterance(text);
      this.synthesis.speak(utterance);
    }
  }

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  // Voice Settings Modal
  showVoiceSettingsModal() {
    this.elements.voiceSettingsModal.classList.add("show");
    this.populateTTSVoices();
  }

  hideVoiceSettingsModal() {
    this.elements.voiceSettingsModal.classList.remove("show");
  }

  populateTTSVoices() {
    const select = this.elements.ttsVoiceSelect;
    const voices = this.synthesis.getVoices();

    select.innerHTML = '<option value="">Mặc định</option>';

    voices.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `${voice.name} (${voice.lang})`;
      if (voice === this.preferredVoice) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  saveVoiceSettings() {
    // Save language
    this.voiceLanguage = this.elements.voiceLangSelect.value;
    localStorage.setItem("chat_voice_lang", this.voiceLanguage);

    if (this.recognition) {
      this.recognition.lang = this.voiceLanguage;
    }

    // Save TTS voice
    const voiceIndex = this.elements.ttsVoiceSelect.value;
    if (voiceIndex !== "") {
      const voices = this.synthesis.getVoices();
      this.preferredVoice = voices[parseInt(voiceIndex)];
      localStorage.setItem("chat_tts_voice", voiceIndex);
    }

    // Save speech rate
    const rate = this.elements.speechRateSlider.value;
    localStorage.setItem("chat_speech_rate", rate);

    this.hideVoiceSettingsModal();
    this.showVoiceStatus("Đã lưu cài đặt!", "success");
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
        const rect = this.elements.container.getBoundingClientRect();
        localStorage.setItem(
          "chat_custom_size",
          JSON.stringify({ width: rect.width, height: rect.height })
        );
      }
    });
  }

  toggleExpand() {
    if (this.isFullscreen) this.exitFullscreen();

    this.isExpanded = !this.isExpanded;
    this.elements.container.classList.toggle("expanded", this.isExpanded);

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

    this.elements.fullscreenBtn.querySelector(
      ".fullscreen-icon"
    ).style.display = "none";
    this.elements.fullscreenBtn.querySelector(
      ".exit-fullscreen-icon"
    ).style.display = "block";
    this.elements.fullscreenBtn.title = "Thoát toàn màn hình";

    this.elements.expandBtn.querySelector(".expand-icon").style.display =
      "block";
    this.elements.expandBtn.querySelector(".shrink-icon").style.display =
      "none";

    this.sizeMode = "fullscreen";
    localStorage.setItem("chat_size_mode", this.sizeMode);
    this.elements.toggle.style.display = "none";
    this.scrollToBottom();
  }

  exitFullscreen() {
    this.isFullscreen = false;
    this.elements.container.classList.remove("fullscreen");

    this.elements.fullscreenBtn.querySelector(
      ".fullscreen-icon"
    ).style.display = "block";
    this.elements.fullscreenBtn.querySelector(
      ".exit-fullscreen-icon"
    ).style.display = "none";
    this.elements.fullscreenBtn.title = "Toàn màn hình";

    this.sizeMode = "normal";
    localStorage.setItem("chat_size_mode", this.sizeMode);
    this.elements.toggle.style.display = "flex";
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

    const customSize = localStorage.getItem("chat_custom_size");
    if (customSize && savedMode !== "fullscreen") {
      try {
        const size = JSON.parse(customSize);
        this.elements.container.style.width = size.width + "px";
        this.elements.container.style.height = size.height + "px";
      } catch (e) {}
    }

    // Load speech rate
    const savedRate = localStorage.getItem("chat_speech_rate");
    if (savedRate) {
      this.elements.speechRateSlider.value = savedRate;
      this.elements.speechRateValue.textContent = savedRate;
    }
  }

  // ==================== MODAL FUNCTIONS ====================

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
    if (this.isFullscreen) this.exitFullscreen();
    if (this.isListening) this.stopListening();
    if (this.isSpeaking) this.stopSpeaking();

    this.isOpen = false;
    this.elements.container.classList.remove("open");
    this.elements.toggle.classList.remove("active");
  }

  async sendMessage() {
    const message = this.elements.input.value.trim();
    if (!message || this.isTyping) return;

    this.elements.input.value = "";
    this.elements.input.style.height = "auto";
    this.elements.input.classList.remove("voice-interim");

    this.addMessage(message, "user");
    this.showTyping();

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId: this.sessionId,
        }),
      });

      const data = await response.json();
      this.hideTyping();

      if (data.success) {
        this.addMessage(data.response, "assistant");

        if (data.sessionId) {
          this.sessionId = data.sessionId;
          localStorage.setItem("chat_session_id", data.sessionId);
        }

        // Auto-speak response if enabled
        if (this.autoSpeak) {
          this.speak(data.response);
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
    const welcome = this.elements.messages.querySelector(".welcome-message");
    if (welcome) welcome.remove();

    const messageEl = document.createElement("div");
    messageEl.className = `message ${role}`;

    const avatar = role === "user" ? "👤" : "🤖";
    const formattedContent = this.formatMessage(content);

    // Add speak button for assistant messages
    const speakBtn =
      role === "assistant"
        ? `<button class="message-speak-btn" title="Đọc tin nhắn">🔊</button>`
        : "";

    messageEl.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-bubble">
        <div class="message-content">${formattedContent}</div>
        ${speakBtn}
      </div>
    `;

    // Bind speak button
    if (role === "assistant") {
      const btn = messageEl.querySelector(".message-speak-btn");
      btn.addEventListener("click", () => this.speak(content));
    }

    this.elements.messages.appendChild(messageEl);
    this.scrollToBottom();
  }

  formatMessage(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.*?)__/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/_(.*?)_/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
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
        <span></span><span></span><span></span>
      </div>
    `;

    this.elements.messages.appendChild(typingEl);
    this.scrollToBottom();
  }

  hideTyping() {
    this.isTyping = false;
    this.elements.send.disabled = false;
    const typingEl = document.getElementById("typingIndicator");
    if (typingEl) typingEl.remove();
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
        const welcome =
          this.elements.messages.querySelector(".welcome-message");
        if (welcome) welcome.remove();

        data.messages.forEach((msg) => {
          const messageEl = document.createElement("div");
          messageEl.className = `message ${msg.role}`;
          const avatar = msg.role === "user" ? "👤" : "🤖";
          const formattedContent = this.formatMessage(msg.message);

          const speakBtn =
            msg.role === "assistant"
              ? `<button class="message-speak-btn" title="Đọc tin nhắn">🔊</button>`
              : "";

          messageEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-bubble">
              <div class="message-content">${formattedContent}</div>
              ${speakBtn}
            </div>
          `;
          messageEl.style.animation = "none";

          if (msg.role === "assistant") {
            const btn = messageEl.querySelector(".message-speak-btn");
            btn.addEventListener("click", () => this.speak(msg.message));
          }

          this.elements.messages.appendChild(messageEl);
        });

        this.scrollToBottom();
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  }

  showBadge(count = 1) {
    this.elements.badge.textContent = count;
    this.elements.badge.classList.add("show");
  }

  async send(message) {
    this.elements.input.value = message;
    await this.sendMessage();
  }

  newSession() {
    this.sessionId = this.generateSessionId();
    localStorage.setItem("chat_session_id", this.sessionId);

    const messages = this.elements.messages.querySelectorAll(".message");
    messages.forEach((msg, index) => {
      msg.style.animation = `fadeOut 0.2s ease ${index * 0.05}s forwards`;
    });

    setTimeout(() => {
      this.elements.messages.innerHTML = `
        <div class="welcome-message">
          <div class="new-chat-indicator">✨ Cuộc hội thoại mới</div>
          <h3>👋 Xin chào!</h3>
          <p>Tôi là Weather Bot. Hãy hỏi tôi về nhiệt độ, độ ẩm, chất lượng không khí!</p>
          <p class="voice-hint">💡 Nhấn nút 🎤 để nói chuyện bằng giọng nói</p>
        </div>
      `;
    }, messages.length * 50 + 200);
  }

  getSessionId() {
    return this.sessionId;
  }
}

// Auto-init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.chatWidget = new ChatWidget();
  });
} else {
  window.chatWidget = new ChatWidget();
}
