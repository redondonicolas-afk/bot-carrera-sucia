# 🐷 CERDÍN - Bot WhatsApp Carrera Sucia

Bot de WhatsApp con inteligencia artificial (Claude) para atención automática 24/7.

## 📋 Requisitos

- Node.js v18 o superior
- ngrok (para desarrollo local)
- Cuenta de Meta for Developers
- API Key de Anthropic (Claude)

## 🚀 Instalación

```bash
# 1. Ir a la carpeta del bot
cd bot-meta

# 2. Instalar dependencias
npm install

# 3. Copiar archivo de configuración
cp .env.example .env

# 4. Editar .env con tus credenciales
nano .env
```

## ⚙️ Configuración

Editá el archivo `.env` con:

```
VERIFY_TOKEN=carrera_sucia_2026
WHATSAPP_TOKEN=EAAxxxxxx (de Meta)
PHONE_NUMBER_ID=123456789 (de Meta)
ANTHROPIC_API_KEY=sk-ant-xxx (de Anthropic)
```

## 🏃 Ejecutar

```bash
# Terminal 1: Iniciar el bot
npm start

# Terminal 2: Exponer con ngrok
ngrok http 3000
```

## 🔗 Configurar Webhook en Meta

1. Copiar la URL de ngrok (ej: https://abc123.ngrok.io)
2. Ir a Meta for Developers > Tu App > WhatsApp > Configuración
3. Webhook URL: `https://abc123.ngrok.io/webhook`
4. Verify Token: `carrera_sucia_2026`
5. Suscribirse a: `messages`

## 🧪 Probar

Mandá un mensaje al número de WhatsApp de Carrera Sucia y Cerdín te responde!

## 📁 Estructura

```
bot-meta/
├── index.js        # Servidor principal
├── package.json    # Dependencias
├── .env.example    # Template de configuración
├── .env            # Tu configuración (no commitear!)
└── README.md       # Este archivo
```

## 🐷 Oink!
