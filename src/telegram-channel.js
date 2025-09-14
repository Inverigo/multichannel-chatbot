const TelegramBot = require('node-telegram-bot-api');
const DatabaseService = require('./database');

class TelegramChannelService {
  constructor() {
    this.bot = null;
    this.channelId = process.env.TELEGRAM_CHANNEL;
    this.properties = new Map();
  }

  async initialize() {
    try {
      // Создаем отдельный экземпляр бота для чтения канала
      this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
      
      // Настраиваем обработчики для канала
      this.setupChannelHandlers();
      
      console.log('✅ Telegram канал инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации Telegram канала:', error);
    }
  }

  setupChannelHandlers() {
    // Обработчик новых сообщений в канале
    this.bot.on('channel_post', (msg) => {
      this.processChannelMessage(msg);
    });

    // Обработчик обновлений канала
    this.bot.on('edited_channel_post', (msg) => {
      this.processChannelMessage(msg);
    });
  }

  async processChannelMessage(msg) {
    try {
      if (!msg.text) return;

      const text = msg.text;
      const messageId = msg.message_id;

      console.log(`📢 Новое сообщение в канале: ${text.substring(0, 100)}...`);

      // Парсим объявление
      const property = this.parseProperty(text);
      
      if (property) {
        // Сохраняем в базу данных
        await DatabaseService.saveProperty(
          messageId,
          text,
          property.type,
          property.rooms,
          property.price,
          property.area
        );

        // Сохраняем в память для быстрого доступа
        this.properties.set(messageId, property);
        
        console.log(`✅ Объявление обработано: ${property.type} ${property.rooms} комнат, ${property.price}$`);
      }
    } catch (error) {
      console.error('❌ Ошибка обработки сообщения канала:', error);
    }
  }

  parseProperty(text) {
    try {
      const lowerText = text.toLowerCase();
      
      // Определяем тип недвижимости
      let type = 'unknown';
      if (lowerText.includes('apartment') || lowerText.includes('апартамент') || lowerText.includes('квартир')) {
        type = 'apartment';
      } else if (lowerText.includes('villa') || lowerText.includes('вилл') || lowerText.includes('дом')) {
        type = 'villa';
      } else if (lowerText.includes('rent') || lowerText.includes('аренд') || lowerText.includes('снять')) {
        type = 'rent';
      }

      // Извлекаем количество комнат
      let rooms = null;
      const roomPatterns = [
        /(\d+)\s*(bed|room|комнат|спален)/i,
        /(\d+)\s*br/i,
        /(\d+)\s*bedroom/i
      ];
      
      for (const pattern of roomPatterns) {
        const match = text.match(pattern);
        if (match) {
          rooms = parseInt(match[1]);
          break;
        }
      }

      // Извлекаем цену
      let price = null;
      const pricePatterns = [
        /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/,
        /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*usd/i,
        /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*доллар/i,
        /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$/m
      ];
      
      for (const pattern of pricePatterns) {
        const match = text.match(pattern);
        if (match) {
          price = parseInt(match[1].replace(/,/g, ''));
          break;
        }
      }

      // Извлекаем район
      let area = null;
      const areaPatterns = [
        /in\s+([^,\n]+)/i,
        /в\s+([^,\n]+)/i,
        /area:\s*([^,\n]+)/i,
        /район:\s*([^,\n]+)/i
      ];
      
      for (const pattern of areaPatterns) {
        const match = text.match(pattern);
        if (match) {
          area = match[1].trim();
          break;
        }
      }

      return {
        type,
        rooms,
        price,
        area,
        text: text.substring(0, 200) + (text.length > 200 ? '...' : '')
      };
    } catch (error) {
      console.error('❌ Ошибка парсинга объявления:', error);
      return null;
    }
  }

  async getProperties(filters = {}) {
    try {
      // Сначала пытаемся получить из базы данных
      const dbProperties = await DatabaseService.getProperties(filters);
      
      if (dbProperties.length > 0) {
        return dbProperties.map(prop => ({
          id: prop.id,
          messageId: prop.message_id,
          text: prop.text,
          type: prop.type,
          rooms: prop.rooms,
          price: prop.price,
          area: prop.area,
          parsedAt: prop.parsed_at
        }));
      }

      // Если в БД нет данных, возвращаем примеры
      return this.getSampleProperties(filters);
    } catch (error) {
      console.error('❌ Ошибка получения объявлений:', error);
      return this.getSampleProperties(filters);
    }
  }

  getSampleProperties(filters = {}) {
    const sampleProperties = [
      {
        id: 1,
        messageId: 1001,
        text: "🏠 Beautiful 2-bedroom apartment in Sahl Hasheesh\n💰 Price: $45,000\n�� Area: Sahl Hasheesh\n🛏️ 2 bedrooms, 2 bathrooms\n✨ Sea view, fully furnished",
        type: "apartment",
        rooms: 2,
        price: 45000,
        area: "Sahl Hasheesh",
        parsedAt: new Date().toISOString()
      },
      {
        id: 2,
        messageId: 1002,
        text: "🏖️ Luxury 3-bedroom villa in El Gouna\n💰 Price: $120,000\n�� Area: El Gouna\n🛏️ 3 bedrooms, 3 bathrooms\n�� Private pool, garden",
        type: "villa",
        rooms: 3,
        price: 120000,
        area: "El Gouna",
        parsedAt: new Date().toISOString()
      },
      {
        id: 3,
        messageId: 1003,
        text: "🏠 Cozy 1-bedroom apartment for rent\n�� Price: $400/month\n�� Area: Hurghada Center\n🛏️ 1 bedroom, 1 bathroom\n✨ Near the beach",
        type: "rent",
        rooms: 1,
        price: 400,
        area: "Hurghada Center",
        parsedAt: new Date().toISOString()
      }
    ];

    // Фильтруем по параметрам
    return sampleProperties.filter(prop => {
      if (filters.type && prop.type !== filters.type) return false;
      if (filters.rooms && prop.rooms !== parseInt(filters.rooms)) return false;
      if (filters.price_min && prop.price < parseInt(filters.price_min)) return false;
      if (filters.price_max && prop.price > parseInt(filters.price_max)) return false;
      return true;
    });
  }

  async searchProperties(query) {
    try {
      const properties = await this.getProperties();
      const lowerQuery = query.toLowerCase();
      
      return properties.filter(prop => 
        prop.text.toLowerCase().includes(lowerQuery) ||
        prop.area?.toLowerCase().includes(lowerQuery) ||
        prop.type?.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('❌ Ошибка поиска объявлений:', error);
      return [];
    }
  }
}

module.exports = new TelegramChannelService();