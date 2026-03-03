
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// =============================================
// CONFIGURACIÓN
// =============================================

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'carrera_sucia_2026';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 8080;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// =============================================
// PERSISTENCIA - Conversaciones y Modos
// =============================================

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const CONVERSACIONES_FILE = path.join(DATA_DIR, 'conversaciones.json');
const MODOS_FILE = path.join(DATA_DIR, 'modos.json');

// Asegurar que el directorio existe
if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.log('No se pudo crear DATA_DIR, usando directorio actual'); }
}

// Conversaciones: { "wa_5491145678901": { channel, name, phone, messages: [...] } }
let conversaciones = {};

function cargarConversaciones() {
    try {
        if (fs.existsSync(CONVERSACIONES_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONVERSACIONES_FILE, 'utf8'));
            // Migrar formato viejo (sin channel) al nuevo
            const migrated = {};
            for (const [key, value] of Object.entries(data)) {
                if (Array.isArray(value)) {
                    // Formato viejo: { "5491145678901": [messages] }
                    const newKey = key.startsWith('wa_') ? key : `wa_${key}`;
                    migrated[newKey] = {
                        channel: 'wa',
                        phone: key.replace('wa_', ''),
                        name: null,
                        messages: value
                    };
                } else {
                    // Formato nuevo
                    migrated[key] = value;
                }
            }
            conversaciones = migrated;
            console.log(`💾 ${Object.keys(conversaciones).length} conversaciones cargadas`);
        }
    } catch (e) {
        console.error('Error cargando conversaciones:', e.message);
        conversaciones = {};
    }
}

function guardarConversaciones() {
    try {
        fs.writeFileSync(CONVERSACIONES_FILE, JSON.stringify(conversaciones, null, 2));
    } catch (e) {
        console.error('Error guardando conversaciones:', e.message);
    }
}

// Modos: { "wa_5491145678901": { mode: "ai"|"human", assignedTo: "Abril" } }
let modos = {};

function cargarModos() {
    try {
        if (fs.existsSync(MODOS_FILE)) {
            modos = JSON.parse(fs.readFileSync(MODOS_FILE, 'utf8'));
            console.log(`🔀 ${Object.keys(modos).length} modos cargados`);
        }
    } catch (e) {
        console.error('Error cargando modos:', e.message);
        modos = {};
    }
}

function guardarModos() {
    try {
        fs.writeFileSync(MODOS_FILE, JSON.stringify(modos, null, 2));
    } catch (e) {
        console.error('Error guardando modos:', e.message);
    }
}

function getMode(convId) {
    return modos[convId]?.mode || 'ai';
}

function setMode(convId, mode, assignedTo) {
    modos[convId] = { mode, assignedTo: mode === 'human' ? assignedTo : undefined };
    guardarModos();
}

// =============================================
// SYSTEM PROMPT
// =============================================

function generarSystemPrompt() {
    const fechaHoy = new Date().toLocaleDateString('es-AR');
    const fechaCarrera = new Date('2026-03-29');
    const diasFaltantes = Math.ceil((fechaCarrera - new Date()) / (1000 * 60 * 60 * 24));

    return `Sos CERDÍN 🐷, el asistente virtual de CARRERA SUCIA.

PERSONALIDAD:
- Amigable, divertido, entusiasta
- Español argentino (vos, tenés, podés)
- Emojis moderados
- Terminás con "Oink!"
- Conciso pero completo

FECHA: ${fechaHoy} | FALTAN: ${diasFaltantes} días para la carrera

PRÓXIMA CARRERA - 29 MARZO 2026:
- Lugar: Florencio Parravicini y Juan Mermoz, Escobar, Provincia de Buenos Aires
- Google Maps: https://maps.app.goo.gl/escobar-carrerasucia
- Adultos: 5K con +20 obstáculos
- KIDS: 1.5K con 6 obstáculos (5-12 años)

HORARIOS:
- ADULTOS: Cada 30 min de 9:30 a 13:30
- ELITE: 9:30 (competitiva, cronometrada)
- KIDS: 10:30 y 13:30

PRECIOS 2026:
- Individual: $65,000
- Grupo (4 personas): $260,000
- KIDS: $32,000 (incluye remera)
- ELITE: $70,000
- Remera adicional: $14,000

INSCRIPCIÓN: www.carrerasucia.com.ar

CONTACTO: corredor@carrerasucia.com
Instagram: @carrerasucia

HAY: duchas, vestuarios, guardarropa, estacionamiento.
SE CORRE LLUEVA O TRUENE.

Si alguien pregunta algo que NO sabés o necesita atención personalizada (facturación, grupos grandes +10, corporativos, prensa, problemas con pagos), respondé amablemente y decí que lo vas a derivar con el equipo humano.`;
}

// =============================================
// CLAUDE AI
// =============================================

async function consultarClaude(convId, mensajeUsuario) {
    const conv = conversaciones[convId];
    if (!conv) return 'Uy! Tuve un problemita. Oink! 🐷';

    const historial = conv.messages.slice(-10).map(m => ({
        role: m.role === 'human' ? 'assistant' : m.role,
        content: m.content
    }));

    historial.push({ role: 'user', content: mensajeUsuario });

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: generarSystemPrompt(),
            messages: historial
        });

        return response.content[0].text;
    } catch (error) {
        console.error('❌ Error Claude:', error.message);
        return '¡Uy! Tuve un problemita técnico. Escribinos a corredor@carrerasucia.com. Oink! 🐷';
    }
}

// =============================================
// ENVIAR MENSAJE WHATSAPP
// =============================================

async function enviarMensajeWhatsApp(to, text) {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'text',
                    text: { body: text }
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            console.error('❌ Error Meta API:', JSON.stringify(error));
            return false;
        }
        return true;
    } catch (error) {
        console.error('❌ Error enviando WhatsApp:', error.message);
        return false;
    }
}

// =============================================
// GUARDAR MENSAJE EN CONVERSACIÓN
// =============================================

function guardarMensaje(convId, role, content, extra = {}) {
    if (!conversaciones[convId]) {
        conversaciones[convId] = {
            channel: convId.startsWith('ig_') ? 'ig' : 'wa',
            phone: convId.startsWith('wa_') ? convId.replace('wa_', '') : null,
            username: convId.startsWith('ig_') ? convId.replace('ig_', '') : null,
            name: null,
            messages: []
        };
    }

    conversaciones[convId].messages.push({
        role,
        content,
        timestamp: new Date().toISOString(),
        ...extra
    });

    // Limitar a 100 mensajes por conversación
    if (conversaciones[convId].messages.length > 100) {
        conversaciones[convId].messages = conversaciones[convId].messages.slice(-100);
    }

    guardarConversaciones();
}

// =============================================
// WEBHOOK - WhatsApp (Meta)
// =============================================

// Verificación
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verificado');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Recibir mensajes
app.post('/webhook', async (req, res) => {
    res.sendStatus(200);

    try {
        const entry = req.body?.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (!value?.messages) return;

        const message = value.messages[0];
        const from = message.from;
        const convId = `wa_${from}`;

        // Guardar nombre del contacto si viene
        const contactName = value.contacts?.[0]?.profile?.name;
        if (contactName && conversaciones[convId]) {
            conversaciones[convId].name = contactName;
        }

        if (message.type !== 'text') {
            guardarMensaje(convId, 'user', `[${message.type}]`);
            await enviarMensajeWhatsApp(from, '¡Hola! Por ahora solo puedo leer mensajes de texto 🐷 Escribime tu consulta y te ayudo. Oink!');
            return;
        }

        const texto = message.text.body;
        console.log(`📩 [WA] ${from}: ${texto.substring(0, 80)}`);

        // Guardar mensaje del usuario
        guardarMensaje(convId, 'user', texto);

        // Chequear modo: si está en modo humano, NO responder con IA
        const mode = getMode(convId);
        if (mode === 'human') {
            console.log(`⏸️  [WA] ${from}: Modo HUMANO - IA no responde`);
            return;
        }

        // Modo IA: generar respuesta
        const respuesta = await consultarClaude(convId, texto);
        guardarMensaje(convId, 'assistant', respuesta);
        await enviarMensajeWhatsApp(from, respuesta);
        console.log(`🐷 [WA] Respondido a ${from}`);

    } catch (error) {
        console.error('❌ Error procesando webhook:', error.message);
    }
});

// =============================================
// API - Dashboard
// =============================================

// Obtener todas las conversaciones con su modo
app.get('/api/conversaciones', (req, res) => {
    const result = {};
    for (const [id, conv] of Object.entries(conversaciones)) {
        const modo = modos[id] || { mode: 'ai' };
        result[id] = {
            ...conv,
            mode: modo.mode,
            assignedTo: modo.assignedTo,
            unread: 0 // TODO: implementar conteo real de no leídos
        };
    }
    res.json(result);
});

// Obtener stats
app.get('/api/stats', (req, res) => {
    const all = Object.entries(conversaciones);
    let totalMsgs = 0;
    let totalUserMsgs = 0;
    all.forEach(([_, conv]) => {
        totalMsgs += conv.messages?.length || 0;
        totalUserMsgs += (conv.messages || []).filter(m => m.role === 'user').length;
    });

    const waCount = all.filter(([id]) => id.startsWith('wa_')).length;
    const igCount = all.filter(([id]) => id.startsWith('ig_')).length;
    const aiCount = all.filter(([id]) => getMode(id) === 'ai').length;
    const humanCount = all.filter(([id]) => getMode(id) === 'human').length;

    res.json({
        conversaciones: all.length,
        whatsapp: waCount,
        instagram: igCount,
        modo_ia: aiCount,
        modo_humano: humanCount,
        mensajes_total: totalMsgs,
        mensajes_clientes: totalUserMsgs,
        bot_activo: true,
        ultima_actualizacion: new Date().toISOString()
    });
});

// Cambiar modo de una conversación
app.post('/api/modo', (req, res) => {
    const { convId, mode, assignedTo } = req.body;

    if (!convId || !mode || !['ai', 'human'].includes(mode)) {
        return res.status(400).json({ error: 'convId y mode (ai|human) requeridos' });
    }

    if (mode === 'human' && !assignedTo) {
        return res.status(400).json({ error: 'assignedTo requerido para modo humano' });
    }

    setMode(convId, mode, assignedTo);

    console.log(`🔀 ${convId}: modo cambiado a ${mode}${assignedTo ? ` (${assignedTo})` : ''}`);
    res.json({ ok: true, convId, mode, assignedTo });
});

// Enviar mensaje humano desde dashboard
app.post('/api/enviar', async (req, res) => {
    const { convId, message, agent } = req.body;

    if (!convId || !message || !agent) {
        return res.status(400).json({ error: 'convId, message y agent requeridos' });
    }

    // Verificar que está en modo humano
    const mode = getMode(convId);
    if (mode !== 'human') {
        return res.status(400).json({ error: 'La conversación debe estar en modo humano para enviar mensajes manuales' });
    }

    // Guardar el mensaje en el historial
    guardarMensaje(convId, 'human', message, { agent });

    // Enviar por el canal correspondiente
    const conv = conversaciones[convId];
    let enviado = false;

    if (conv?.channel === 'wa' && conv?.phone) {
        enviado = await enviarMensajeWhatsApp(conv.phone, message);
    } else if (conv?.channel === 'ig') {
        // TODO: Implementar envío por Instagram
        console.log(`📸 [IG] Envío por Instagram pendiente de implementar`);
        enviado = false;
    }

    console.log(`💬 [${agent}] → ${convId}: ${message.substring(0, 50)}...`);
    res.json({ ok: true, enviado, convId, agent });
});

// =============================================
// DASHBOARD
// =============================================

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Health check
app.get('/', (req, res) => {
    res.send('🐷 CERDÍN - Bot Carrera Sucia - Activo | <a href="/dashboard">Ver Dashboard</a>');
});

// =============================================
// INICIAR
// =============================================

cargarConversaciones();
cargarModos();

app.listen(PORT, () => {
    console.log('');
    console.log('🐷 CERDÍN – BOT CARRERA SUCIA v3');
    console.log('=================================');
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Phone Number ID: ${PHONE_NUMBER_ID}`);
    console.log(`🤖 Claude AI: Activo`);
    console.log(`📊 Dashboard: /dashboard`);
    console.log(`💾 Datos: ${DATA_DIR}`);
    console.log(`🔀 Modos: ${Object.keys(modos).length} configurados`);
    console.log(`💬 Conversaciones: ${Object.keys(conversaciones).length}`);
    console.log(`🔑 Token Meta: ${WHATSAPP_TOKEN ? '✅' : '❌ FALTA'}`);
    console.log(`🔑 Token Claude: ${ANTHROPIC_API_KEY ? '✅' : '❌ FALTA'}`);
    console.log('');
    console.log('Endpoints:');
    console.log('  GET  /dashboard          → Dashboard web');
    console.log('  GET  /api/conversaciones → Todas las conversaciones');
    console.log('  GET  /api/stats          → Estadísticas');
    console.log('  POST /api/modo           → Cambiar modo (ai/human)');
    console.log('  POST /api/enviar         → Enviar mensaje humano');
    console.log('  POST /webhook            → Webhook de Meta');
    console.log('');
    console.log('Esperando mensajes...');
    console.log('');
});
