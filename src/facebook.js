const express = require('express');

class FacebookService {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Верификация webhook
    this.router.get('/webhook', (req, res) => {
      const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'your_verify_token';
      
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      console.log('Facebook webhook verification attempt:', { mode, token });

      if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
          console.log('✅ Facebook webhook verified');
          res.status(200).send(challenge);
        } else {
          console.log('❌ Facebook webhook verification failed');
          res.sendStatus(403);
        }
      } else {
        res.sendStatus(400);
      }
    });

    // Обработка входящих сообщений
    this.router.post('/webhook', (req, res) => {
      const body = req.body;
      console.log('Facebook webhook received:', JSON.stringify(body, null, 2));

      if (body.object === 'page') {
        body.entry.forEach(entry => {
          entry.messaging.forEach(event => {
            if (event.message && !event.message.is_echo) {
              this.handleMessage(event);
            }
          });
        });
        res.status(200).send('EVENT_RECEIVED');
      } else {
        res.sendStatus(404);
      }
    });
  }

  handleMessage(event) {
    const userInfo = {
      name: 'Facebook User',
      id: event.sender.id
    };

    console.log(`Получено сообщение в Facebook от ${event.sender.id}: ${event.message.text}`);

    // Эмитируем событие для центрального сервера
    if (global.io) {
      global.io.emit('incomingMessage', {
        channel: 'facebook',
        userId: event.sender.id,
        message: event.message.text,
        userInfo: userInfo,
        timestamp: Date.now()
      });
    }
  }

  async sendMessage(userId, message) {
    console.log(`Отправка в Facebook ${userId}: ${message}`);
    return true;
  }

  getRouter() {
    return this.router;
  }
}

module.exports = FacebookService;