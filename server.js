const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Импорт наших сервисов
const TelegramService = require('./src/telegram');
const WhatsAppService = require('./src/whatsapp');
const FacebookService = require('./src/facebook');
const ChatbotService = require('./src/chatbot');
const DatabaseService = require('./src/database');
const TelegramChannelService = require('./src/telegram-channel');

class MultichannelChatbot {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.port = process.env.PORT || 3000;
        this.sessions = new Map();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
    }

    setupRoutes() {
        // Главная страница
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'webchat.html'));
        });

        // Маршруты для HTML страниц
        this.app.get('/operator', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'operator.html'));
        });

        this.app.get('/webchat', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'webchat.html'));
        });

        // API маршруты
        this.app.post('/api/chat', async (req, res) => {
            try {
                const { message, sessionId } = req.body;
                const response = await this.handleMessage(message, sessionId);
                res.json({ response, sessionId });
            } catch (error) {
                console.error('Ошибка обработки сообщения:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        this.app.post('/api/lead', async (req, res) => {
            try {
                const { name, phone, email, message } = req.body;
                // Здесь можно добавить логику сохранения лида
                console.log('Новый лид:', { name, phone, email, message });
                res.json({ success: true });
            } catch (error) {
                console.error('Ошибка сохранения лида:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Webhook для Facebook
        this.app.get('/webhook', (req, res) => {
            const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN;
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            if (mode && token) {
                if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                    console.log('Facebook webhook verified');
                    res.status(200).send(challenge);
                } else {
                    res.sendStatus(403);
                }
            }
        });

        this.app.post('/webhook', (req, res) => {
            const body = req.body;

            if (body.object === 'page') {
                body.entry.forEach(entry => {
                    const webhookEvent = entry.messaging[0];
                    console.log('Facebook webhook event:', webhookEvent);
                    
                    if (webhookEvent.message) {
                        this.handleFacebookMessage(webhookEvent);
                    }
                });

                res.status(200).send('EVENT_RECEIVED');
            } else {
                res.sendStatus(404);
            }
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('Новое подключение:', socket.id);

            // Обработка сообщений от пользователей
            socket.on('user-message', async (data) => {
                try {
                    const { message, sessionId } = data;
                    const response = await this.handleMessage(message, sessionId || socket.id);
                    
                    socket.emit('bot-response', {
                        message: response,
                        sessionId: sessionId || socket.id
                    });
                } catch (error) {
                    console.error('Ошибка обработки сообщения:', error);
                    socket.emit('error', { message: 'Произошла ошибка' });
                }
            });

            // Обработка сообщений от оператора
            socket.on('operator-message', async (data) => {
                try {
                    const { message, sessionId } = data;
                    await this.sendToChannel('web', sessionId, message, 'operator');
                    
                    // Отправляем сообщение пользователю
                    socket.to(sessionId).emit('operator-response', {
                        message: message,
                        sender: 'operator'
                    });
                } catch (error) {
                    console.error('Ошибка отправки сообщения оператора:', error);
                }
            });

            // Отключение
            socket.on('disconnect', () => {
                console.log('Пользователь отключился:', socket.id);
            });
        });
    }

    async handleMessage(message, sessionId) {
        console.log(`Обработка сообщения: "${message}" от сессии: ${sessionId}`);
        
        // Получаем или создаем сессию
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                id: sessionId,
                messages: [],
                userInfo: {},
                channel: 'web',
                isActive: true,
                lastActivity: new Date()
            });
        }

        const session = this.sessions.get(sessionId);
        session.messages.push({
            text: message,
            sender: 'user',
            timestamp: new Date()
        });
        session.lastActivity = new Date();

        // Обрабатываем сообщение через чатбот
        const response = await ChatbotService.processMessage(message, sessionId);
        
        // Сохраняем ответ бота
        session.messages.push({
            text: response,
            sender: 'bot',
            timestamp: new Date()
        });

        // Отправляем обновление операторам
        this.io.emit('sessions', Object.fromEntries(this.sessions));

        return response;
    }

    async sendToChannel(channel, sessionId, message, sender = 'bot') {
        try {
            switch (channel) {
                case 'telegram':
                    if (this.telegramService) {
                        await this.telegramService.sendMessage(sessionId, message);
                    }
                    break;
                case 'whatsapp':
                    if (this.whatsappService) {
                        await this.whatsappService.sendMessage(sessionId, message);
                    }
                    break;
                case 'facebook':
                    if (this.facebookService) {
                        await this.facebookService.sendMessage(sessionId, message);
                    }
                    break;
                case 'web':
                    // Отправляем через Socket.IO
                    this.io.to(sessionId).emit('message', {
                        message: message,
                        sender: sender,
                        sessionId: sessionId
                    });
                    break;
            }
        } catch (error) {
            console.error(`Ошибка отправки в канал ${channel}:`, error);
        }
    }

    async handleFacebookMessage(webhookEvent) {
        const senderId = webhookEvent.sender.id;
        const message = webhookEvent.message.text;

        if (message) {
            const response = await this.handleMessage(message, senderId);
            await this.sendToChannel('facebook', senderId, response);
        }
    }

    async initialize() {
        try {
            console.log('Инициализация сервисов...');

            // Инициализация базы данных
            await DatabaseService.initialize();
            console.log('✅ База данных инициализирована');

            // Инициализация сервисов
            this.telegramService = new TelegramService();
            console.log('✅ Telegram сервис создан');

            // Временно отключаем WhatsApp для стабильной работы
            // this.whatsappService = new WhatsAppService();
            // await this.whatsappService.initialize();
            // console.log('✅ WhatsApp клиент инициализирован');

            this.facebookService = new FacebookService();
            console.log('✅ Facebook сервис создан');

            // Инициализация Telegram канала
            this.telegramChannelService = new TelegramChannelService();
            console.log('✅ Telegram канал инициализирован');

            console.log('🎉 Все сервисы инициализированы успешно!');

        } catch (error) {
            console.error('Ошибка инициализации:', error);
        }
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`🚀 Сервер запущен на порту ${this.port}`);
            console.log(`👨‍�� Панель оператора: http://localhost:${this.port}/operator`);
            console.log(`💬 Веб-чат: http://localhost:${this.port}/webchat`);
        });
    }
}

// Создаем и запускаем приложение
const app = new MultichannelChatbot();

// Инициализируем и запускаем
app.initialize().then(() => {
    app.start();
}).catch(error => {
    console.error('Критическая ошибка:', error);
    process.exit(1);
});

module.exports = MultichannelChatbot;
