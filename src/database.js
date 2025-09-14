const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(path.join(__dirname, '../database/chatbot.db'), (err) => {
        if (err) {
          console.error('❌ Ошибка подключения к базе данных:', err);
          reject(err);
        } else {
          console.log('✅ Подключено к SQLite базе данных');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const createMessagesTable = `
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          from_user BOOLEAN NOT NULL,
          message TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          channel TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_info TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createPropertiesTable = `
        CREATE TABLE IF NOT EXISTS properties (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id INTEGER UNIQUE,
          text TEXT NOT NULL,
          type TEXT,
          rooms INTEGER,
          price INTEGER,
          area TEXT,
          parsed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      this.db.run(createMessagesTable, (err) => {
        if (err) {
          console.error('❌ Ошибка создания таблицы messages:', err);
          reject(err);
        } else {
          console.log('✅ Таблица messages создана');
          this.db.run(createSessionsTable, (err) => {
            if (err) {
              console.error('❌ Ошибка создания таблицы sessions:', err);
              reject(err);
            } else {
              console.log('✅ Таблица sessions создана');
              this.db.run(createPropertiesTable, (err) => {
                if (err) {
                  console.error('❌ Ошибка создания таблицы properties:', err);
                  reject(err);
                } else {
                  console.log('✅ Таблица properties создана');
                  resolve();
                }
              });
            }
          });
        }
      });
    });
  }

  async saveMessage(sessionId, from, message) {
    return new Promise((resolve, reject) => {
      const fromUser = from === 'user' ? 1 : 0;
      this.db.run(
        'INSERT INTO messages (session_id, from_user, message) VALUES (?, ?, ?)',
        [sessionId, fromUser, message],
        function(err) {
          if (err) {
            console.error('❌ Ошибка сохранения сообщения:', err);
            reject(err);
          } else {
            console.log(`✅ Сообщение сохранено в БД: ${message.substring(0, 50)}...`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async saveProperty(messageId, text, type, rooms, price, area) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO properties (message_id, text, type, rooms, price, area) VALUES (?, ?, ?, ?, ?, ?)',
        [messageId, text, type, rooms, price, area],
        function(err) {
          if (err) {
            console.error('❌ Ошибка сохранения объявления:', err);
            reject(err);
          } else {
            console.log(`✅ Объявление сохранено в БД: ${text.substring(0, 50)}...`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async getProperties(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM properties WHERE 1=1';
      const params = [];

      if (filters.type) {
        query += ' AND type = ?';
        params.push(filters.type);
      }

      if (filters.rooms) {
        query += ' AND rooms = ?';
        params.push(filters.rooms);
      }

      if (filters.price_min) {
        query += ' AND price >= ?';
        params.push(filters.price_min);
      }

      if (filters.price_max) {
        query += ' AND price <= ?';
        params.push(filters.price_max);
      }

      query += ' ORDER BY parsed_at DESC LIMIT 20';

      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('❌ Ошибка получения объявлений:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getSessionMessages(sessionId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
        [sessionId],
        (err, rows) => {
          if (err) {
            console.error('❌ Ошибка получения сообщений:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }
}

module.exports = new DatabaseService();