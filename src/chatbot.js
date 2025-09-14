const TelegramChannelService = require('./telegram-channel');

class ChatbotService {
  static async processMessage(message, sessionId) {
    console.log(`Обработка сообщения ботом: "${message}"`);
    
    try {
      // Определяем язык сообщения
      const language = this.detectLanguage(message);
      console.log(`Определен язык: ${language}`);
      
      // Проверяем, запрашивает ли пользователь объявления
      const propertiesRequest = this.detectPropertiesRequest(message);
      
      if (propertiesRequest) {
        const properties = await TelegramChannelService.getProperties(propertiesRequest.filters);
        return this.formatPropertiesResponse(properties, language, propertiesRequest.filters);
      }
      
      // Получаем обычный ответ
      return this.getSmartResponse(message, language);
    } catch (error) {
      console.error('Ошибка обработки сообщения ботом:', error);
      return 'Sorry, an error occurred. Please try again.';
    }
  }

  static detectLanguage(message) {
    const lowerMessage = message.toLowerCase();
    
    // Русские слова
    const russianWords = ['привет', 'здравствуйте', 'квартир', 'дом', 'вилл', 'аренд', 'прода', 'цена', 'стоимость', 'спасибо', 'контакт', 'менеджер'];
    // Арабские слова
    const arabicWords = ['مرحبا', 'شقة', 'بيت', 'فيلا', 'إيجار', 'بيع', 'سعر', 'شكرا', 'اتصال', 'مدير'];
    // Немецкие слова
    const germanWords = ['hallo', 'wohnung', 'haus', 'villa', 'miete', 'verkauf', 'preis', 'danke', 'kontakt', 'manager'];
    // Французские слова
    const frenchWords = ['bonjour', 'appartement', 'maison', 'villa', 'location', 'vente', 'prix', 'merci', 'contact', 'gestionnaire'];
    
    // Проверяем наличие слов на разных языках
    if (russianWords.some(word => lowerMessage.includes(word))) {
      return 'ru';
    }
    if (arabicWords.some(word => lowerMessage.includes(word))) {
      return 'ar';
    }
    if (germanWords.some(word => lowerMessage.includes(word))) {
      return 'de';
    }
    if (frenchWords.some(word => lowerMessage.includes(word))) {
      return 'fr';
    }
    
    // По умолчанию английский
    return 'en';
  }

  static detectPropertiesRequest(message) {
    const lowerMessage = message.toLowerCase();
    
    // Ключевые слова для поиска недвижимости
    const propertyKeywords = [
      'apartment', 'flat', 'condo', 'квартир', 'апартамент',
      'villa', 'house', 'home', 'вилл', 'дом',
      'rent', 'rental', 'lease', 'аренд', 'снять',
      'buy', 'purchase', 'sale', 'прода', 'купить',
      'property', 'real estate', 'недвижимость'
    ];
    
    const hasPropertyKeyword = propertyKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (!hasPropertyKeyword) return null;
    
    // Извлекаем фильтры
    const filters = {};
    
    // Тип недвижимости
    if (lowerMessage.includes('apartment') || lowerMessage.includes('квартир') || lowerMessage.includes('апартамент')) {
      filters.type = 'apartment';
    } else if (lowerMessage.includes('villa') || lowerMessage.includes('вилл') || lowerMessage.includes('дом')) {
      filters.type = 'villa';
    } else if (lowerMessage.includes('rent') || lowerMessage.includes('аренд') || lowerMessage.includes('снять')) {
      filters.type = 'rent';
    }
    
    // Количество комнат
    const roomPatterns = [
      /(\d+)\s*(bed|room|комнат|спален)/i,
      /(\d+)\s*br/i,
      /(\d+)\s*bedroom/i
    ];
    
    for (const pattern of roomPatterns) {
      const match = message.match(pattern);
      if (match) {
        filters.rooms = parseInt(match[1]);
        break;
      }
    }
    
    // Цена
    const pricePatterns = [
      /under\s*\$?(\d+(?:,\d{3})*)/i,
      /below\s*\$?(\d+(?:,\d{3})*)/i,
      /до\s*\$?(\d+(?:,\d{3})*)/i,
      /менее\s*\$?(\d+(?:,\d{3})*)/i
    ];
    
    for (const pattern of pricePatterns) {
      const match = message.match(pattern);
      if (match) {
        filters.price_max = parseInt(match[1].replace(/,/g, ''));
        break;
      }
    }
    
    return { filters };
  }

  static async formatPropertiesResponse(properties, language, filters) {
    if (properties.length === 0) {
      return this.getNoPropertiesResponse(language, filters);
    }
    
    const responses = {
      en: this.formatEnglishProperties(properties, filters),
      ru: this.formatRussianProperties(properties, filters),
      ar: this.formatArabicProperties(properties, filters),
      de: this.formatGermanProperties(properties, filters),
      fr: this.formatFrenchProperties(properties, filters)
    };
    
    return responses[language] || responses.en;
  }

  static formatEnglishProperties(properties, filters) {
    let response = `🏠 Found ${properties.length} properties for you:\n\n`;
    
    properties.slice(0, 5).forEach((prop, index) => {
      response += `${index + 1}. ${prop.type === 'apartment' ? '🏢' : prop.type === 'villa' ? '🏖️' : '🏠'} `;
      response += `${prop.type.charAt(0).toUpperCase() + prop.type.slice(1)}`;
            if (prop.rooms) response += ` - ${prop.rooms} bedroom${prop.rooms > 1 ? 's' : ''}`;
      if (prop.price) response += ` - $${prop.price.toLocaleString()}`;
      if (prop.area) response += ` - ${prop.area}`;
      response += `\n${prop.text.substring(0, 100)}...\n\n`;
    });
    
    if (properties.length > 5) {
      response += `... and ${properties.length - 5} more properties available.\n\n`;
    }
    
    response += `Would you like to see more details about any of these properties?`;
    
    return response;
  }

  static formatRussianProperties(properties, filters) {
    let response = `🏠 Найдено ${properties.length} объектов недвижимости:\n\n`;
    
    properties.slice(0, 5).forEach((prop, index) => {
      response += `${index + 1}. ${prop.type === 'apartment' ? '🏢' : prop.type === 'villa' ? '🏖️' : '🏠'} `;
      response += `${prop.type === 'apartment' ? 'Квартира' : prop.type === 'villa' ? 'Вилла' : 'Аренда'}`;
      if (prop.rooms) response += ` - ${prop.rooms} ${prop.rooms === 1 ? 'спальня' : prop.rooms < 5 ? 'спальни' : 'спален'}`;
      if (prop.price) response += ` - $${prop.price.toLocaleString()}`;
      if (prop.area) response += ` - ${prop.area}`;
      response += `\n${prop.text.substring(0, 100)}...\n\n`;
    });
    
    if (properties.length > 5) {
      response += `... и еще ${properties.length - 5} объектов доступно.\n\n`;
    }
    
    response += `Хотите узнать больше деталей о каком-либо из этих объектов?`;
    
    return response;
  }

  static formatArabicProperties(properties, filters) {
    let response = `🏠 تم العثور على ${properties.length} عقار:\n\n`;
    
    properties.slice(0, 5).forEach((prop, index) => {
      response += `${index + 1}. ${prop.type === 'apartment' ? '🏢' : prop.type === 'villa' ? '🏖️' : '🏠'} `;
      response += `${prop.type === 'apartment' ? 'شقة' : prop.type === 'villa' ? 'فيلا' : 'إيجار'}`;
      if (prop.rooms) response += ` - ${prop.rooms} غرفة نوم`;
      if (prop.price) response += ` - $${prop.price.toLocaleString()}`;
      if (prop.area) response += ` - ${prop.area}`;
      response += `\n${prop.text.substring(0, 100)}...\n\n`;
    });
    
    if (properties.length > 5) {
      response += `... و ${properties.length - 5} عقارات أخرى متاحة.\n\n`;
    }
    
    response += `هل تريد معرفة المزيد من التفاصيل عن أي من هذه العقارات؟`;
    
    return response;
  }

  static formatGermanProperties(properties, filters) {
    let response = `🏠 ${properties.length} Immobilien gefunden:\n\n`;
    
    properties.slice(0, 5).forEach((prop, index) => {
      response += `${index + 1}. ${prop.type === 'apartment' ? '🏢' : prop.type === 'villa' ? '🏖️' : '🏠'} `;
      response += `${prop.type === 'apartment' ? 'Wohnung' : prop.type === 'villa' ? 'Villa' : 'Miete'}`;
      if (prop.rooms) response += ` - ${prop.rooms} Schlafzimmer`;
      if (prop.price) response += ` - $${prop.price.toLocaleString()}`;
      if (prop.area) response += ` - ${prop.area}`;
      response += `\n${prop.text.substring(0, 100)}...\n\n`;
    });
    
    if (properties.length > 5) {
      response += `... und ${properties.length - 5} weitere Immobilien verfügbar.\n\n`;
    }
    
    response += `Möchten Sie mehr Details zu einer dieser Immobilien erfahren?`;
    
    return response;
  }

  static formatFrenchProperties(properties, filters) {
    let response = `🏠 ${properties.length} propriétés trouvées:\n\n`;
    
    properties.slice(0, 5).forEach((prop, index) => {
      response += `${index + 1}. ${prop.type === 'apartment' ? '🏢' : prop.type === 'villa' ? '🏖️' : '🏠'} `;
      response += `${prop.type === 'apartment' ? 'Appartement' : prop.type === 'villa' ? 'Villa' : 'Location'}`;
      if (prop.rooms) response += ` - ${prop.rooms} chambre${prop.rooms > 1 ? 's' : ''}`;
      if (prop.price) response += ` - $${prop.price.toLocaleString()}`;
      if (prop.area) response += ` - ${prop.area}`;
      response += `\n${prop.text.substring(0, 100)}...\n\n`;
    });
    
    if (properties.length > 5) {
      response += `... et ${properties.length - 5} autres propriétés disponibles.\n\n`;
    }
    
    response += `Voulez-vous plus de détails sur l'une de ces propriétés?`;
    
    return response;
  }

  static getNoPropertiesResponse(language, filters) {
    const responses = {
      en: `Sorry, I couldn't find any properties matching your criteria. Try adjusting your search parameters or contact our manager for personalized assistance.`,
      ru: `Извините, я не смог найти объекты, соответствующие вашим критериям. Попробуйте изменить параметры поиска или обратитесь к нашему менеджеру за персональной помощью.`,
      ar: `عذراً، لم أتمكن من العثور على عقارات تطابق معاييرك. جرب تعديل معايير البحث أو اتصل بمديرنا للحصول على مساعدة شخصية.`,
      de: `Entschuldigung, ich konnte keine Immobilien finden, die Ihren Kriterien entsprechen. Versuchen Sie, Ihre Suchparameter anzupassen oder kontaktieren Sie unseren Manager für persönliche Hilfe.`,
      fr: `Désolé, je n'ai pas pu trouver de propriétés correspondant à vos critères. Essayez d'ajuster vos paramètres de recherche ou contactez notre gestionnaire pour une assistance personnalisée.`
    };
    
    return responses[language] || responses.en;
  }

  static getSmartResponse(message, language = 'en') {
    const lowerMessage = message.toLowerCase();
    
    // Английские ответы (приоритет)
    if (language === 'en') {
      return this.getEnglishResponse(lowerMessage);
    }
    
    // Русские ответы
    if (language === 'ru') {
      return this.getRussianResponse(lowerMessage);
    }
    
    // Арабские ответы
    if (language === 'ar') {
      return this.getArabicResponse(lowerMessage);
    }
    
    // Немецкие ответы
    if (language === 'de') {
      return this.getGermanResponse(lowerMessage);
    }
    
    // Французские ответы
    if (language === 'fr') {
      return this.getFrenchResponse(lowerMessage);
    }
    
    // Fallback на английский
    return this.getEnglishResponse(lowerMessage);
  }

  static getEnglishResponse(lowerMessage) {
    // Greeting
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return 'Hello! 👋 I\'m Zizu, your real estate assistant in Hurghada. I can help you find apartments, villas, and rental properties. How can I assist you today?';
    }
    
    // Apartments
    if (lowerMessage.includes('apartment') || lowerMessage.includes('flat') || lowerMessage.includes('condo')) {
      return 'Great! I can help you find the perfect apartment. Please tell me:\n• How many bedrooms do you need?\n• Which area do you prefer?\n• What\'s your budget?\n\nOr just say "show me apartments" to see available options!';
    }
    
    // Houses/Villas
    if (lowerMessage.includes('house') || lowerMessage.includes('villa') || lowerMessage.includes('home')) {
      return 'Excellent! We have amazing villas in Hurghada. Please specify:\n• Number of bedrooms\n• Do you need a pool?\n• Distance from the sea\n• Your budget\n\nOr say "show me villas" to see what\'s available!';
    }
    
    // Rent
    if (lowerMessage.includes('rent') || lowerMessage.includes('rental') || lowerMessage.includes('lease')) {
      return 'For rental properties, I need to know:\n• Rental period (short-term/long-term)\n• Number of guests\n• Monthly budget\n• Area preferences\n\nOr say "show me rentals" to see available options!';
    }
    
    // Buy
    if (lowerMessage.includes('buy') || lowerMessage.includes('purchase') || lowerMessage.includes('sale')) {
      return 'I\'ll help you find the perfect property to buy! Please tell me:\n• Property type (apartment/villa)\n• Number of bedrooms\n• Preferred area\n• Your budget\n\nOr say "show me properties for sale" to see what\'s available!';
    }
    
    // Price
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('expensive')) {
      return 'Prices depend on many factors:\n• Property type\n• Location\n• Size\n• Condition\n\nTell me about your requirements, and I\'ll find options within your budget!';
    }
    
    // Contact
    if (lowerMessage.includes('contact') || lowerMessage.includes('phone') || lowerMessage.includes('manager') || lowerMessage.includes('agent')) {
      return 'Of course! I\'ll connect you with our manager right away. They will contact you within 15 minutes with personalized recommendations.';
    }
    
    // Thank you
    if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
      return 'You\'re welcome! 😊 Happy to help. If you have more questions, just ask!';
    }
    
    // Default
    return 'Interesting! I can help you find apartments, villas, and rental properties in Hurghada. What type of property are you looking for?';
  }

  static getRussianResponse(lowerMessage) {
    // Приветствие
    if (lowerMessage.includes('привет') || lowerMessage.includes('здравствуйте') || lowerMessage.includes('добро пожаловать')) {
      return 'Привет! 👋 Я Zizu, ваш помощник по недвижимости в Хургаде. Я помогу найти квартиры, виллы и аренду. Чем могу помочь?';
    }
    
    // Квартиры
    if (lowerMessage.includes('квартир') || lowerMessage.includes('апартамент')) {
      return 'Отлично! Я помогу найти подходящую квартиру. Расскажите:\n• Сколько спален нужно?\n• В каком районе предпочитаете?\n• Какой бюджет?\n\nИли просто скажите "покажи квартиры" для просмотра доступных вариантов!';
    }
    
    // Дома/виллы
    if (lowerMessage.includes('дом') || lowerMessage.includes('вилл') || lowerMessage.includes('villa')) {
      return 'Прекрасно! У нас есть отличные виллы в Хургаде. Уточните:\n• Количество спален\n• Нужен ли бассейн?\n• Близость к морю\n• Бюджет\n\nИли скажите "покажи виллы" для просмотра доступных вариантов!';
    }
    
    // Аренда
    if (lowerMessage.includes('аренд') || lowerMessage.includes('снять') || lowerMessage.includes('rent')) {
      return 'Для аренды недвижимости нужна информация:\n• На какой срок?\n• Количество гостей\n• Бюджет в месяц\n• Предпочтения по району\n\nИли скажите "покажи аренду" для просмотра доступных вариантов!';
    }
    
    // Продажа
    if (lowerMessage.includes('прода') || lowerMessage.includes('купить') || lowerMessage.includes('buy')) {
      return 'Помогу с покупкой недвижимости! Уточните:\n• Тип недвижимости (квартира/вилла)\n• Количество спален\n• Район\n• Бюджет\n\nИли скажите "покажи продажу" для просмотра доступных вариантов!';
    }
    
    // Цена
    if (lowerMessage.includes('цена') || lowerMessage.includes('стоимость') || lowerMessage.includes('price')) {
      return 'Цены зависят от многих факторов:\n• Тип недвижимости\n• Район\n• Размер\n• Состояние\n\nРасскажите о ваших требованиях, и я подберу варианты в вашем бюджете!';
    }
    
    // Контакт
    if (lowerMessage.includes('контакт') || lowerMessage.includes('телефон') || lowerMessage.includes('менеджер')) {
      return 'Конечно! Сейчас передам ваши данные менеджеру. Он свяжется с вами в течение 15 минут с персональными рекомендациями.';
    }
    
    // Спасибо
    if (lowerMessage.includes('спасибо') || lowerMessage.includes('благодарю')) {
      return 'Пожалуйста! �� Рад помочь. Если есть еще вопросы - задавайте!';
    }
    
    // По умолчанию
    return 'Интересно! Я помогу найти квартиры, виллы и аренду в Хургаде. Какой тип недвижимости вас интересует?';
  }

  static getArabicResponse(lowerMessage) {
    // تحية
    if (lowerMessage.includes('مرحبا') || lowerMessage.includes('السلام عليكم') || lowerMessage.includes('أهلا')) {
      return 'مرحبا! 👋 أنا Zizu، مساعدك العقاري في الغردقة. يمكنني مساعدتك في العثور على شقق وفيلات وعقارات للإيجار. كيف يمكنني مساعدتك؟';
    }
    
    // شقق
    if (lowerMessage.includes('شقة') || lowerMessage.includes('شقق') || lowerMessage.includes('أبارتمنت')) {
      return 'ممتاز! يمكنني مساعدتك في العثور على الشقة المناسبة. أخبرني:\n• كم غرفة نوم تحتاج؟\n• أي منطقة تفضل؟\n• ما هو ميزانيتك؟\n\nأو قل ببساطة "أظهر لي الشقق" لرؤية الخيارات المتاحة!';
    }
    
    // فيلات
    if (lowerMessage.includes('فيلا') || lowerMessage.includes('بيت') || lowerMessage.includes('منزل')) {
      return 'رائع! لدينا فيلات رائعة في الغردقة. وضح لي:\n• عدد غرف النوم\n• هل تحتاج مسبح؟\n• القرب من البحر\n• ميزانيتك\n\nأو قل "أظهر لي الفيلات" لرؤية الخيارات المتاحة!';
    }
    
    // إيجار
    if (lowerMessage.includes('إيجار') || lowerMessage.includes('استئجار') || lowerMessage.includes('تأجير')) {
      return 'للعقارات المؤجرة، أحتاج معرفة:\n• مدة الإيجار\n• عدد الضيوف\n• الميزانية الشهرية\n• تفضيلات المنطقة\n\nأو قل "أظهر لي الإيجار" لرؤية الخيارات المتاحة!';
    }
    
    // بيع
    if (lowerMessage.includes('بيع') || lowerMessage.includes('شراء') || lowerMessage.includes('مشتريات')) {
      return 'سأساعدك في العثور على العقار المناسب للشراء! أخبرني:\n• نوع العقار (شقة/فيلا)\n• عدد غرف النوم\n• المنطقة المفضلة\n• ميزانيتك\n\nأو قل "أظهر لي البيع" لرؤية الخيارات المتاحة!';
    }
    
    // سعر
    if (lowerMessage.includes('سعر') || lowerMessage.includes('تكلفة') || lowerMessage.includes('ثمن')) {
      return 'الأسعار تعتمد على عوامل كثيرة:\n• نوع العقار\n• الموقع\n• الحجم\n• الحالة\n\nأخبرني عن متطلباتك وسأجد خيارات تناسب ميزانيتك!';
    }
    
    // اتصال
    if (lowerMessage.includes('اتصال') || lowerMessage.includes('هاتف') || lowerMessage.includes('مدير')) {
      return 'بالطبع! سأوصل لك بمديرنا فوراً. سيتصل بك خلال 15 دقيقة مع توصيات شخصية.';
    }
    
    // شكر
    if (lowerMessage.includes('شكرا') || lowerMessage.includes('شكراً') || lowerMessage.includes('متشكر')) {
      return 'عفواً! 😊 سعيد بمساعدتك. إذا كان لديك المزيد من الأسئلة، فقط اسأل!';
    }
    
    // افتراضي
    return 'مثير للاهتمام! يمكنني مساعدتك في العثور على شقق وفيلات وعقارات للإيجار في الغردقة. أي نوع من العقارات تبحث عنه؟';
  }

  static getGermanResponse(lowerMessage) {
    // Begrüßung
    if (lowerMessage.includes('hallo') || lowerMessage.includes('guten tag') || lowerMessage.includes('hi')) {
      return 'Hallo! 👋 Ich bin Zizu, Ihr Immobilienassistent in Hurghada. Ich kann Ihnen helfen, Wohnungen, Villen und Mietobjekte zu finden. Wie kann ich Ihnen helfen?';
    }
    
    // Wohnungen
    if (lowerMessage.includes('wohnung') || lowerMessage.includes('apartment') || lowerMessage.includes('appartement')) {
      return 'Großartig! Ich kann Ihnen helfen, die perfekte Wohnung zu finden. Bitte sagen Sie mir:\n• Wie viele Schlafzimmer benötigen Sie?\n• Welches Gebiet bevorzugen Sie?\n• Was ist Ihr Budget?\n\nOder sagen Sie einfach "zeige mir Wohnungen" für verfügbare Optionen!';
    }
    
    // Häuser/Villen
    if (lowerMessage.includes('haus') || lowerMessage.includes('villa') || lowerMessage.includes('heim')) {
      return 'Ausgezeichnet! Wir haben wunderbare Villen in Hurghada. Bitte spezifizieren Sie:\n• Anzahl der Schlafzimmer\n• Benötigen Sie einen Pool?\n• Entfernung zum Meer\n• Ihr Budget\n\nOder sagen Sie "zeige mir Villen" für verfügbare Optionen!';
    }
    
    // Miete
    if (lowerMessage.includes('miete') || lowerMessage.includes('vermietung') || lowerMessage.includes('mieten')) {
      return 'Für Mietobjekte muss ich wissen:\n• Mietdauer (kurz-/langfristig)\n• Anzahl der Gäste\n• Monatliches Budget\n• Gebietspräferenzen\n\nOder sagen Sie "zeige mir Mietobjekte" für verfügbare Optionen!';
    }
    
    // Kauf
    if (lowerMessage.includes('kauf') || lowerMessage.includes('kaufen') || lowerMessage.includes('verkauf')) {
      return 'Ich helfe Ihnen, die perfekte Immobilie zum Kaufen zu finden! Bitte sagen Sie mir:\n• Immobilientyp (Wohnung/Villa)\n• Anzahl der Schlafzimmer\n• Bevorzugtes Gebiet\n• Ihr Budget\n\nOder sagen Sie "zeige mir Verkaufsimmobilien" für verfügbare Optionen!';
    }
    
    // Preis
    if (lowerMessage.includes('preis') || lowerMessage.includes('kosten') || lowerMessage.includes('teuer')) {
      return 'Preise hängen von vielen Faktoren ab:\n• Immobilientyp\n• Lage\n• Größe\n• Zustand\n\nErzählen Sie mir von Ihren Anforderungen, und ich finde Optionen in Ihrem Budget!';
    }
    
    // Kontakt
    if (lowerMessage.includes('kontakt') || lowerMessage.includes('telefon') || lowerMessage.includes('manager')) {
      return 'Natürlich! Ich verbinde Sie sofort mit unserem Manager. Er wird Sie innerhalb von 15 Minuten mit personalisierten Empfehlungen kontaktieren.';
    }
    
    // Danke
    if (lowerMessage.includes('danke') || lowerMessage.includes('vielen dank')) {
      return 'Gern geschehen! 😊 Freut mich zu helfen. Wenn Sie weitere Fragen haben, fragen Sie einfach!';
    }
    
    // Standard
    return 'Interessant! Ich kann Ihnen helfen, Wohnungen, Villen und Mietobjekte in Hurghada zu finden. Welche Art von Immobilie suchen Sie?';
  }

  static getFrenchResponse(lowerMessage) {
    // Salutation
    if (lowerMessage.includes('bonjour') || lowerMessage.includes('salut') || lowerMessage.includes('bonsoir')) {
      return 'Bonjour! �� Je suis Zizu, votre assistant immobilier à Hurghada. Je peux vous aider à trouver des appartements, des villas et des locations. Comment puis-je vous aider?';
    }
    
    // Appartements
    if (lowerMessage.includes('appartement') || lowerMessage.includes('appart') || lowerMessage.includes('logement')) {
      return 'Parfait! Je peux vous aider à trouver l\'appartement idéal. Dites-moi:\n• Combien de chambres avez-vous besoin?\n• Quel quartier préférez-vous?\n• Quel est votre budget?\n\nOu dites simplement "montrez-moi des appartements" pour voir les options disponibles!';
    }
    
    // Maisons/Villas
    if (lowerMessage.includes('maison') || lowerMessage.includes('villa') || lowerMessage.includes('demeure')) {
      return 'Excellent! Nous avons de magnifiques villas à Hurghada. Précisez-moi:\n• Nombre de chambres\n• Avez-vous besoin d\'une piscine?\n• Distance de la mer\n• Votre budget\n\nOu dites "montrez-moi des villas" pour voir les options disponibles!';
    }
    
    // Location
    if (lowerMessage.includes('location') || lowerMessage.includes('louer') || lowerMessage.includes('rental')) {
      return 'Pour les biens en location, j\'ai besoin de savoir:\n• Durée de location (court/long terme)\n• Nombre d\'invités\n• Budget mensuel\n• Préférences de quartier\n\nOu dites "montrez-moi des locations" pour voir les options disponibles!';
    }
    
    // Achat
    if (lowerMessage.includes('achat') || lowerMessage.includes('acheter') || lowerMessage.includes('vente')) {
      return 'Je vous aiderai à trouver la propriété parfaite à acheter! Dites-moi:\n• Type de propriété (appartement/villa)\n• Nombre de chambres\n• Quartier préféré\n• Votre budget\n\nOu dites "montrez-moi des ventes" pour voir les options disponibles!';
    }
    
    // Prix
    if (lowerMessage.includes('prix') || lowerMessage.includes('coût') || lowerMessage.includes('cher')) {
      return 'Les prix dépendent de nombreux facteurs:\n• Type de propriété\n• Emplacement\n• Taille\n• État\n\nParlez-moi de vos exigences, et je trouverai des options dans votre budget!';
    }
    
    // Contact
    if (lowerMessage.includes('contact') || lowerMessage.includes('téléphone') || lowerMessage.includes('gestionnaire')) {
      return 'Bien sûr! Je vous connecte immédiatement avec notre gestionnaire. Il vous contactera dans les 15 minutes avec des recommandations personnalisées.';
    }
    
    // Merci
    if (lowerMessage.includes('merci') || lowerMessage.includes('remerciement')) {
      return 'De rien! 😊 Heureux de vous aider. Si vous avez d\'autres questions, demandez simplement!';
    }
    
    // Par défaut
    return 'Intéressant! Je peux vous aider à trouver des appartements, des villas et des locations à Hurghada. Quel type de propriété recherchez-vous?';
  }
}

module.exports = ChatbotService;