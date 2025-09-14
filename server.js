const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Импорт наших сервисов
//const TelegramService = require('./src/telegram');
const WhatsAppService = require('./src/whatsapp');
const FacebookService = require('./src/facebook');
const DatabaseService = require('./src/database');
const ChatbotService = require('./src/chatbot');
const TelegramChannelService = require('./src/telegram-channel');

class CentralServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.activeSessions = new Map();
    this.operators = new Set();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocket();
    this.initializeServices();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  setupRoutes() {
    // Главная страница
    this.app.get('/', (req, res) => {
      res.redirect('/operator');
    });

    // API для получения статистики
    this.app.get('/api/stats', (req, res) => {
      res.json({
        activeSessions: this.activeSessions.size,
        channels: {
          whatsapp: Array.from(this.activeSessions.values()).filter(s => s.channel === 'whatsapp').length,
          telegram: Array.from(this.activeSessions.values()).filter(s => s.channel === 'telegram').length,
          facebook: Array.from(this.activeSessions.values()).filter(s => s.channel === 'facebook').length,
          web: Array.from(this.activeSessions.values()).filter(s => s.channel === 'web').length
        }
      });
    });

    // API для получения активных сессий
    this.app.get('/api/sessions', (req, res) => {
      const sessions = Array.from(this.activeSessions.entries()).map(([id, session]) => ({
        id,
        ...session,
        lastMessage: session.messages[session.messages.length - 1]
      }));
      res.json(sessions);
    });

    // API для получения объявлений
    this.app.get('/api/properties', async (req, res) => {
      try {
        const { type, rooms, price_min, price_max } = req.query;
        const properties = await TelegramChannelService.getProperties({ type, rooms, price_min, price_max });
        res.json(properties);
      } catch (error) {
        console.error('Ошибка получения объявлений:', error);
        res.status(500).json({ error: 'Ошибка получения объявлений' });
      }
    });
  }

  setupSocket() {
    this.io.on('connection', (socket) => {
      console.log('Оператор подключился:', socket.id);
      this.operators.add(socket.id);

      // Отправляем текущие сессии новому оператору
      socket.emit('sessionsUpdate', Array.from(this.activeSessions.entries()));

      // Обработка входящих сообщений
      socket.on('incomingMessage', (data) => {
        this.handleIncomingMessage(data);
      });

      // Оператор берет сессию
      socket.on('operatorTakeOver', (sessionId) => {
        this.operatorTakeOver(sessionId, socket.id);
      });

      // Сообщение от оператора
      socket.on('operatorMessage', (data) => {
        this.sendOperatorMessage(data);
      });

      // Возврат к боту
      socket.on('returnToBot', (sessionId) => {
        this.returnToBot(sessionId);
      });

      socket.on('disconnect', () => {
        console.log('Оператор отключился:', socket.id);
        this.operators.delete(socket.id);
      });
    });

    // Делаем io доступным глобально для сервисов
    global.io = this.io;
  }

  async handleIncomingMessage(data) {
    const { channel, userId, message, userInfo } = data;
    const sessionId = `${channel}_${userId}`;

    console.log(`Новое сообщение из ${channel}:`, message);

    // Создаем или обновляем сессию
    if (!this.activeSessions.has(sessionId)) {
      this.activeSessions.set(sessionId, {
        channel,
        userId,
        userInfo,
        isOperatorActive: false,
        operatorId: null,
        messages: [],
        createdAt: Date.now(),
        lastActivity: Date.now()
      });
    }

    const session = this.activeSessions.get(sessionId);
    session.messages.push({
      from: 'user',
      text: message,
      timestamp: Date.now()
    });
    session.lastActivity = Date.now();

    // Сохраняем в базу данных
    try {
      await DatabaseService.saveMessage(sessionId, 'user', message);
    } catch (error) {
      console.error('Ошибка сохранения в БД:', error);
    }

    // Если оператор не активен - отвечает бот
    if (!session.isOperatorActive) {
      try {
        const botResponse = await ChatbotService.processMessage(message, sessionId);
        await this.sendToChannel(channel, userId, botResponse);
        
        session.messages.push({
          from: 'bot',
          text: botResponse,
          timestamp: Date.now()
        });

        await DatabaseService.saveMessage(sessionId, 'bot', botResponse);
      } catch (error) {
        console.error('Ошибка обработки ботом:', error);
        const fallbackResponse = 'Sorry, an error occurred. Please try again.';
        await this.sendToChannel(channel, userId, fallbackResponse);
      }
    }

    // Уведомляем всех операторов
    this.io.emit('newMessage', {
      sessionId,
      channel,
      userId,
      message,
      userInfo,
      timestamp: Date.now()
    });
  }

  async sendToChannel(channel, userId, message) {
    console.log(`Отправка в ${channel}:`, message);
    
    switch (channel) {
      case 'whatsapp':
        return await this.whatsappService.sendMessage(userId, message);
      case 'telegram':
  	console.log('Telegram отключен временно');
 	 return true;
        //return await this.telegramService.sendMessage(userId, message);
      case 'facebook':
        return await this.facebookService.sendMessage(userId, message);
      case 'web':
        return this.io.emit('webMessage', { userId, message });
    }
  }

  operatorTakeOver(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isOperatorActive = true;
      this.io.emit('sessionTakenOver', { sessionId });
      console.log(`Оператор взял сессию: ${sessionId}`);
    }
  }

  async sendOperatorMessage(data) {
    const { sessionId, message } = data;
    const session = this.activeSessions.get(sessionId);
    
    if (session && session.isOperatorActive) {
      await this.sendToChannel(session.channel, session.userId, message);
      
      session.messages.push({
        from: 'operator',
        text: message,
        timestamp: Date.now()
      });

      try {
        await DatabaseService.saveMessage(sessionId, 'operator', message);
      } catch (error) {
        console.error('Ошибка сохранения сообщения оператора:', error);
      }
      
      this.io.emit('operatorMessageSent', { sessionId, message });
    }
  }

  returnToBot(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isOperatorActive = false;
      this.io.emit('sessionReturnedToBot', { sessionId });
      console.log(`Сессия возвращена боту: ${sessionId}`);
    }
  }

  async initializeServices() {
    try {
      console.log('Инициализация сервисов...');
      
      // Инициализация базы данных
      await DatabaseService.initialize();
      console.log('✅ База данных инициализирована');
      
      // Инициализация сервисов
      //this.telegramService = new TelegramService();
      //console.log('✅ Telegram сервис создан');
      
      this.whatsappService = new WhatsAppService();
      console.log('✅ WhatsApp сервис создан');
      
      this.facebookService = new FacebookService();
      console.log('✅ Facebook сервис создан');
      
      // Добавляем Facebook routes
      this.app.use('/facebook', this.facebookService.getRouter());
      
      // Инициализация WhatsApp
      //await this.whatsappService.initialize();
      //console.log('✅ WhatsApp клиент инициализирован');
      
      // Инициализация Telegram канала
      await TelegramChannelService.initialize();
      console.log('✅ Telegram канал инициализирован');
      
      console.log('�� Все сервисы инициализированы успешно!');
    } catch (error) {
      console.error('❌ Ошибка инициализации сервисов:', error);
    }
  }

  start() {
    const PORT = process.env.PORT || 3000;
    this.server.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`👨‍�� Панель оператора: http://localhost:${PORT}/operator`);
      console.log(`�� Веб-чат: http://localhost:${PORT}/webchat`);
    });
  }
}

// Запуск сервера
const server = new CentralServer();

server.start();
