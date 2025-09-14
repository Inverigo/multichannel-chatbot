const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppService {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: "whatsapp-client"
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });
    
    this.setupEvents();
  }

  setupEvents() {
    this.client.on('qr', (qr) => {
      console.log('📱 WhatsApp QR Code:');
      qrcode.generate(qr, {small: true});
      console.log('Отсканируйте этот QR-код в WhatsApp на телефоне');
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp клиент готов!');
    });

    this.client.on('message', (message) => {
      this.handleMessage(message);
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Ошибка авторизации WhatsApp:', msg);
    });

    this.client.on('disconnected', (reason) => {
      console.log('⚠️ WhatsApp отключен:', reason);
    });
  }

  async handleMessage(message) {
    try {
      const contact = await message.getContact();
      const userInfo = {
        name: contact.name || contact.pushname || 'Unknown',
        phone: contact.number
      };

      console.log(`Получено сообщение в WhatsApp от ${userInfo.name}: ${message.body}`);

      // Эмитируем событие для центрального сервера
      if (global.io) {
        global.io.emit('incomingMessage', {
          channel: 'whatsapp',
          userId: message.from,
          message: message.body,
          userInfo: userInfo,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения WhatsApp:', error);
    }
  }

  async sendMessage(to, message) {
    try {
      await this.client.sendMessage(to, message);
      console.log(`Сообщение отправлено в WhatsApp ${to}: ${message}`);
      return true;
    } catch (error) {
      console.error('Ошибка отправки в WhatsApp:', error);
      return false;
    }
  }

  async initialize() {
    try {
      await this.client.initialize();
      console.log('WhatsApp клиент инициализирован');
    } catch (error) {
      console.error('Ошибка инициализации WhatsApp:', error);
    }
  }
}

module.exports = WhatsAppService;