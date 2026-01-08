const sqlite3 = require("sqlite3").verbose();
const path = require("path");

class DatabaseManager {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Database connection error:", err);
      } else {
        console.log("Connected to SQLite database");
        this.initDatabase();
      }
    });
  }

  initDatabase() {
    // Sử dụng serialize để đảm bảo các lệnh chạy theo thứ tự
    this.db.serialize(() => {
      // 1. Sensor data table
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS sensor_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          temperature REAL,
          humidity REAL,
          air_quality REAL,
          timestamp TEXT
        )
        `,
        (err) => {
          if (err) {
            console.error("Error creating sensor_data table:", err);
          }
        }
      );

      // 2. Sensor data index
      this.db.run(
        `
        CREATE INDEX IF NOT EXISTS idx_timestamp 
        ON sensor_data(timestamp DESC)
        `,
        (err) => {
          if (err) {
            console.error("Error creating sensor_data index:", err);
          }
        }
      );

      // 3. Voice interaction logs table
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS voice_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT,
          type TEXT CHECK(type IN ('stt', 'tts')),
          input_text TEXT,
          output_text TEXT,
          language TEXT,
          duration_ms INTEGER,
          provider TEXT,
          success INTEGER DEFAULT 1,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        `,
        (err) => {
          if (err) {
            console.error("Error creating voice_logs table:", err);
          }
        }
      );

      // 4. Voice logs index (chạy sau khi table được tạo nhờ serialize)
      this.db.run(
        `
        CREATE INDEX IF NOT EXISTS idx_voice_session 
        ON voice_logs(session_id)
        `,
        (err) => {
          if (err) {
            console.error("Error creating voice_logs index:", err);
          } else {
            console.log("Database initialized successfully");
          }
        }
      );
    });
  }

  // ==================== SENSOR DATA METHODS ====================

  insertSensorData(temperature, humidity, airQuality, timestamp) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO sensor_data (temperature, humidity, air_quality, timestamp)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run([temperature, humidity, airQuality, timestamp], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });

      stmt.finalize();
    });
  }

  getLatestData() {
    return new Promise((resolve, reject) => {
      this.db.get(
        `
        SELECT * FROM sensor_data 
        ORDER BY timestamp DESC 
        LIMIT 1
        `,
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  getRecentData(limit = 100) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT * FROM sensor_data 
        ORDER BY timestamp DESC 
        LIMIT ?
        `,
        [limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  getDataByTimeRange(startTime, endTime) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT * FROM sensor_data 
        WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp DESC
        `,
        [startTime, endTime],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  getStatistics(hours = 24) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `
        SELECT 
          AVG(temperature) as avg_temp,
          MIN(temperature) as min_temp,
          MAX(temperature) as max_temp,
          AVG(humidity) as avg_humidity,
          MIN(humidity) as min_humidity,
          MAX(humidity) as max_humidity,
          AVG(air_quality) as avg_air_quality,
          MAX(air_quality) as max_air_quality,
          COUNT(*) as total_records
        FROM sensor_data
        WHERE timestamp >= datetime('now', '-' || ? || ' hours')
        `,
        [hours],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  deleteOldData(days = 30) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
        DELETE FROM sensor_data 
        WHERE timestamp < datetime('now', '-' || ? || ' days')
        `,
        [days],
        function (err) {
          if (err) {
            reject(err);
          } else {
            console.log(`🗑️  Deleted ${this.changes} old records`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  // ==================== VOICE LOG METHODS ====================

  /**
   * Lưu log của voice interaction (STT/TTS)
   */
  logVoiceInteraction(data) {
    return new Promise((resolve, reject) => {
      const {
        sessionId,
        type, // 'stt' or 'tts'
        inputText,
        outputText,
        language,
        durationMs,
        provider,
        success = true,
        errorMessage = null,
      } = data;

      const stmt = this.db.prepare(`
        INSERT INTO voice_logs 
        (session_id, type, input_text, output_text, language, duration_ms, provider, success, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        [
          sessionId,
          type,
          inputText,
          outputText,
          language,
          durationMs,
          provider,
          success ? 1 : 0,
          errorMessage,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );

      stmt.finalize();
    });
  }

  /**
   * Lấy voice logs theo session
   */
  getVoiceLogsBySession(sessionId, limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT * FROM voice_logs 
        WHERE session_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
        `,
        [sessionId, limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  /**
   * Lấy thống kê voice usage
   */
  getVoiceStatistics(hours = 24) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN type = 'stt' THEN 1 ELSE 0 END) as stt_count,
          SUM(CASE WHEN type = 'tts' THEN 1 ELSE 0 END) as tts_count,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count,
          AVG(duration_ms) as avg_duration_ms,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM voice_logs
        WHERE created_at >= datetime('now', '-' || ? || ' hours')
        `,
        [hours],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  /**
   * Xóa voice logs cũ
   */
  deleteOldVoiceLogs(days = 7) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
        DELETE FROM voice_logs 
        WHERE created_at < datetime('now', '-' || ? || ' days')
        `,
        [days],
        function (err) {
          if (err) {
            reject(err);
          } else {
            console.log(`🗑️  Deleted ${this.changes} old voice logs`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Chạy raw SQL query (cho advanced use cases)
   */
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Lấy database stats
   */
  getDatabaseStats() {
    return new Promise((resolve, reject) => {
      const stats = {};

      this.db.get(`SELECT COUNT(*) as count FROM sensor_data`, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        stats.sensorRecords = row.count;

        this.db.get(`SELECT COUNT(*) as count FROM voice_logs`, (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          stats.voiceLogs = row.count;

          // Get database file size
          this.db.get(
            `SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`,
            (err, row) => {
              if (err) {
                stats.dbSize = "unknown";
              } else {
                stats.dbSize = row
                  ? `${(row.size / 1024 / 1024).toFixed(2)} MB`
                  : "unknown";
              }
              resolve(stats);
            }
          );
        });
      });
    });
  }

  close() {
    this.db.close((err) => {
      if (err) {
        console.error("Error closing database:", err);
      } else {
        console.log("Database connection closed");
      }
    });
  }
}

module.exports = DatabaseManager;
