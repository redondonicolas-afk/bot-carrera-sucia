const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// =============================================
// PERSISTENCIA EN DISCO
// =============================================
const DATA_DIR = path.join(__dirname, 'data');
const CONVERSACIONES_FILE = path.join(DATA_DIR, 'conversaciones.json');

// Crear carpeta data si no existe
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 Carpeta data creada');
}

// Cargar conversaciones guardadas
let conversaciones = {};
try {
    if (fs.existsSync(CONVERSACIONES_FILE)) {
        const datos = fs.readFileSync(CONVERSACIONES_FILE, 'utf8');
        conversaciones = JSON.parse(datos);
        const numConvos = Object.keys(conversaciones).length;
        let numMsgs = 0;
        Object.values(conversaciones).forEach(msgs => numMsgs += msgs.length);
        console.log(`📂 Conversaciones cargadas: ${numConvos} chats, ${numMsgs} mensajes`);
    } else {
        console.log('📂 Sin conversaciones previas, empezando de cero');
    }
} catch (error) {
    console.error('⚠️ Error cargando conversaciones:', error.message);
    conversaciones = {};
}

// Guardar a disco (con debounce para no escribir en cada mensaje)
let guardarTimeout = null;
function guardarADisco() {
    if (guardarTimeout) clearTimeout(guardarTimeout);
    guardarTimeout = setTimeout(() => {
        try {
            fs.writeFileSync(CONVERSACIONES_FILE, JSON.stringify(conversaciones, null, 2), 'utf8');
        } catch (error) {
            console.error('⚠️ Error guardando conversaciones:', error.message);
        }
    }, 1000);
}

function obtenerHistorial(telefono, limite = 10) {
    const historial = conversaciones[telefono] || [];
    return historial.slice(-limite);
}

function guardarMensaje(telefono, rol, contenido) {
    if (!conversaciones[telefono]) {
        conversaciones[telefono] = [];
    }
    conversaciones[telefono].push({
        role: rol,
        content: contenido,
        timestamp: new Date().toISOString()
    });
    if (conversaciones[telefono].length > 50) {
        conversaciones[telefono] = conversaciones[telefono].slice(-50);
    }
    guardarADisco();
}

function generarSystemPrompt() {
    const fechaHoy = new Date().toLocaleDateString('es-AR');
    const fechaCarrera = new Date('2026-03-29');
    const diasFaltantes = Math.ceil((fechaCarrera - new Date()) / (1000 * 60 * 60 * 24));

    return `Sos CERDÍN 🐷, el asistente virtual de CARRERA SUCIA.

PERSONALIDAD:
- Amigable, divertido, entusiasta
- Español argentino (vos, tenés, podés)
- Emojis moderados
- Terminás con "Oink!" de vez en cuando
- Conciso pero completo
- Respuestas cortas, ideales para WhatsApp (máximo 3-4 párrafos)

FECHA: ${fechaHoy} | FALTAN: ${diasFaltantes} días

PRÓXIMA CARRERA - 29 MARZO 2026:
- Lugar: Escobar, Provincia de Buenos Aires
- Adultos: 5K con +20 obstáculos
- KIDS: 1.5K con 6 obstáculos (5-12 años)

HORARIOS:
- ADULTOS: Cada 30 min de 9:30 a 13:30
- ELITE: 9:30 (competitiva, cronometrada)
- KIDS: 10:30 y 13:30

PRECIOS 2026:
EARLY BIRD (hasta 9 marzo):
- Sin remera: $54,000
- Con remera: $68,000

NORMAL:
- Sin remera: $65,000
- Con remera: $79,000

KIDS: $32,000 (early) / $37,000 (normal)
ELITE: +$5,000

INSCRIPCIÓN: www.carrerasucia.com.ar
- Cupos limitados
- Cierre: 23 marzo

CONTACTO: info@carrerasucia.com
Instagram: @carrerasucia

Si no sabés algo, decí que no tenés esa info y sugerí escribir a info@carrerasucia.com.`;
}

async function consultarClaude(telefono, mensajeUsuario) {
    const historial = obtenerHistorial(telefono, 10);
    const mensajes = historial.map(m => ({ role: m.role, content: m.content }));
    mensajes.push({ role: 'user', content: mensajeUsuario });

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            system: generarSystemPrompt(),
            messages: mensajes
        });

        const respuesta = response.content[0].text;
        guardarMensaje(telefono, 'user', mensajeUsuario);
        guardarMensaje(telefono, 'assistant', respuesta);
        return respuesta;
    } catch (error) {
        console.error('❌ Error Claude:', error.message);
        return '¡Uy! Tuve un problemita técnico. Intentá de nuevo en unos segundos o escribí a info@carrerasucia.com 🐷';
    }
}

async function enviarMensajeWhatsApp(to, texto) {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'text',
                    text: { body: texto }
                }),
            }
        );
        const data = await response.json();
        if (data.error) {
            console.error('❌ Error Meta API:', JSON.stringify(data.error));
        } else {
            console.log(`✅ Mensaje enviado a ${to}`);
        }
        return data;
    } catch (error) {
        console.error('❌ Error enviando mensaje:', error.message);
    }
}

// Webhook verification (GET)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verificado');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Verificación fallida');
        res.sendStatus(403);
    }
});

// Receive messages (POST)
app.post('/webhook', async (req, res) => {
    res.sendStatus(200);

    try {
        const body = req.body;

        if (body.object !== 'whatsapp_business_account') return;

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (!value?.messages) return;

        const message = value.messages[0];
        const from = message.from;

        if (message.type !== 'text') {
            await enviarMensajeWhatsApp(from, '¡Hola! Por ahora solo puedo leer mensajes de texto 🐷 Escribime tu consulta y te ayudo. Oink!');
            return;
        }

        const texto = message.text.body;
        console.log(`📩 Mensaje de ${from}: ${texto.substring(0, 80)}`);

        const respuesta = await consultarClaude(from, texto);
        await enviarMensajeWhatsApp(from, respuesta);

    } catch (error) {
        console.error('❌ Error procesando webhook:', error.message);
    }
});

// =============================================
// DASHBOARD - Ver conversaciones del bot
// =============================================

// API: devuelve todas las conversaciones en JSON
app.get('/api/conversaciones', (req, res) => {
    res.json(conversaciones);
});

// API: stats rápidas
app.get('/api/stats', (req, res) => {
    const totalConvos = Object.keys(conversaciones).length;
    let totalMsgs = 0;
    let totalUserMsgs = 0;

    Object.values(conversaciones).forEach(msgs => {
        totalMsgs += msgs.length;
        totalUserMsgs += msgs.filter(m => m.role === 'user').length;
    });

    res.json({
        conversaciones: totalConvos,
        mensajes_total: totalMsgs,
        mensajes_clientes: totalUserMsgs,
        mensajes_bot: totalMsgs - totalUserMsgs,
        bot_activo: true,
        ultima_actualizacion: new Date().toISOString()
    });
});

// Dashboard HTML
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Health check
app.get('/', (req, res) => {
    res.send('🐷 CERDÍN - Bot Carrera Sucia - Activo | <a href="/dashboard">Ver Dashboard</a>');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('');
    console.log('🐷 CERDÍN – BOT CARRERA SUCIA');
    console.log('==============================');
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Phone Number ID: ${PHONE_NUMBER_ID}`);
    console.log(`🤖 Claude AI: Activo`);
    console.log(`📊 Dashboard: /dashboard`);
    console.log(`💾 Persistencia: ${CONVERSACIONES_FILE}`);
    console.log(`🔑 Token Meta: ${WHATSAPP_TOKEN ? '✅ Configurado' : '❌ FALTA'}`);
    console.log(`🔑 Token Claude: ${ANTHROPIC_API_KEY ? '✅ Configurado' : '❌ FALTA'}`);
    console.log('');
    console.log('Esperando mensajes...');
    console.log('');
});
