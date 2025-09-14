const TelegramBot = require('node-telegram-bot-api');

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
    this.setupHandlers();
    console.log('Telegram бот инициализирован');
  }

  setupHandlers() {
    this.bot.on('message', (msg) => {
      console.log('Получено сообщение в Telegram:', msg.text);
      
      const userInfo = {
        name: msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : ''),
        username: msg.from.username,
        id: msg.from.id
      };

      // Эмитируем событие для центрального сервера
      if (global.io) {
        global.io.emit('incomingMessage', {
          channel: 'telegram',
          userId: msg.chat.id.toString(),
          message: msg.text,
          userInfo: userInfo,
          timestamp: Date.now()
        });
      }
    });

    this.bot.on('error', (error) => {
      console.error('Ошибка Telegram бота:', error);
    });
  }

  async sendMessage(chatId, message) {
    try {
      await this.bot.sendMessage(chatId, message);
      console.log(`Сообщение отправлено в Telegram ${chatId}: ${message}`);
      return true;
    } catch (error) {
      console.error('Ошибка отправки в Telegram:', error);
      return false;
    }
  }
}

module.exports = TelegramService;