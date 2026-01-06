/**
 * Chat History Database Extension
 * Thêm vào DatabaseManager hiện có hoặc dùng riêng
 */

const sqlite3 = require("sqlite3").verbose();

class ChatDatabase {
  constructor(dbFile = "./chat_history.db") {
    this.db = new sqlite3.Database(dbFile);
    this.initTable();
  }

  initTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        message TEXT NOT NULL,
        is_weather_query INTEGER DEFAULT 0,
        processing_time INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_session_id ON chat_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON chat_history(created_at);
    `;

    this.db.exec(sql, (err) => {
      if (err) {
        console.error("Error creating chat_history table:", err);
      } else {
        console.log("Chat history table ready");
      }
    });
  }

  /**
   * Lưu một message vào history
   */
  saveMessage(
    sessionId,
    role,
    message,
    isWeatherQuery = false,
    processingTime = null
  ) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO chat_history (session_id, role, message, is_weather_query, processing_time)
        VALUES (?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [sessionId, role, message, isWeatherQuery ? 1 : 0, processingTime],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  /**
   * Lấy lịch sử chat của một session
   */
  getSessionHistory(sessionId, limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM chat_history 
        WHERE session_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;

      this.db.all(sql, [sessionId, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.reverse()); // Return in chronological order
      });
    });
  }

  /**
   * Lấy tất cả sessions
   */
  getAllSessions(limit = 20) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          session_id,
          MIN(created_at) as started_at,
          MAX(created_at) as last_activity,
          COUNT(*) as message_count
        FROM chat_history 
        GROUP BY session_id 
        ORDER BY last_activity DESC 
        LIMIT ?
      `;

      this.db.all(sql, [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Xóa lịch sử cũ hơn X ngày
   */
  deleteOldHistory(days = 30) {
    return new Promise((resolve, reject) => {
      const sql = `
        DELETE FROM chat_history 
        WHERE created_at < datetime('now', '-' || ? || ' days')
      `;

      this.db.run(sql, [days], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * Đóng connection
   */
  close() {
    this.db.close();
  }
}

module.exports = ChatDatabase;
