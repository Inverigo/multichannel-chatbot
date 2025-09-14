# Multichannel Chatbot

A real estate chatbot that works across multiple channels: Telegram, WhatsApp, Facebook Messenger, and web chat.

## Features

- Multi-language support (English, Russian, Arabic)
- Real-time chat with operators
- Property search integration
- Telegram channel integration
- WhatsApp Business integration
- Facebook Messenger integration

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run: `npm start`

## Environment Variables

- `TELEGRAM_TOKEN` - Telegram bot token
- `TELEGRAM_CHANNEL` - Telegram channel username
- `FACEBOOK_APP_ID` - Facebook app ID
- `FACEBOOK_APP_SECRET` - Facebook app secret
- `FACEBOOK_VERIFY_TOKEN` - Facebook verify token
- `PORT` - Server port (default: 3000)

## Usage

- Web Chat: `/webchat`
- Operator Panel: `/operator`
- API Endpoints: `/api/*`
