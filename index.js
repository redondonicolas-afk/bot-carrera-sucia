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
// PERSISTENCIA
// =============================================

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const CONVERSACIONES_FILE = path.join(DATA_DIR, 'conversaciones.json');
const MODOS_FILE = path.join(DATA_DIR, 'modos.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.log('No se pudo crear DATA_DIR'); }
}

// --- Conversaciones ---
let conversaciones = {};

function cargarConversaciones() {
    try {
        if (fs.existsSync(CONVERSACIONES_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONVERSACIONES_FILE, 'utf8'));
            const migrated = {};
            for (const [key, value] of Object.entries(data)) {
                if (Array.isArray(value)) {
                    const newKey = key.startsWith('wa_') ? key : `wa_${key}`;
                    migrated[newKey] = { channel: 'wa', phone: key.replace('wa_', ''), name: null, messages: value };
                } else {
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
    try { fs.writeFileSync(CONVERSACIONES_FILE, JSON.stringify(conversaciones, null, 2)); } catch (e) { console.error('Error guardando conversaciones:', e.message); }
}

// --- Modos ---
let modos = {};

function cargarModos() {
    try {
        if (fs.existsSync(MODOS_FILE)) {
            modos = JSON.parse(fs.readFileSync(MODOS_FILE, 'utf8'));
            console.log(`🔀 ${Object.keys(modos).length} modos cargados`);
        }
    } catch (e) { console.error('Error cargando modos:', e.message); modos = {}; }
}

function guardarModos() {
    try { fs.writeFileSync(MODOS_FILE, JSON.stringify(modos, null, 2)); } catch (e) { console.error('Error guardando modos:', e.message); }
}

function getMode(convId) { return modos[convId]?.mode || 'ai'; }

function setMode(convId, mode, assignedTo) {
    modos[convId] = { mode, assignedTo: mode === 'human' ? assignedTo : undefined };
    guardarModos();
}

// --- Config ---
const DEFAULT_CONFIG = {
    evento: {
        nombre: "Carrera Sucia",
        fecha: "2026-03-29",
        lugar: "Florencio Parravicini y Juan Mermoz, Escobar, Provincia de Buenos Aires",
        maps: "https://maps.app.goo.gl/escobar-carrerasucia",
        inscripcion: "www.carrerasucia.com.ar",
        descripcion_adultos: "5K con +20 obstáculos",
        descripcion_kids: "1.5K con 6 obstáculos (5-12 años)"
    },
    precios: {
        individual: 65000,
        grupo_precio: 260000,
        grupo_cantidad: 4,
        kids: 32000,
        elite: 70000,
        remera: 14000
    },
    horarios: [
        { hora: "9:30", categoria: "ELITE", cupo: 50, vendidos: 0 },
        { hora: "9:30", categoria: "ADULTOS", cupo: 100, vendidos: 0 },
        { hora: "10:00", categoria: "ADULTOS", cupo: 100, vendidos: 0 },
        { hora: "10:30", categoria: "ADULTOS", cupo: 100, vendidos: 0 },
        { hora: "10:30", categoria: "KIDS", cupo: 50, vendidos: 0 },
        { hora: "11:00", categoria: "ADULTOS", cupo: 100, vendidos: 0 },
        { hora: "11:30", categoria: "ADULTOS", cupo: 100, vendidos: 0 },
        { hora: "12:00", categoria: "ADULTOS", cupo: 100, vendidos: 0 },
        { hora: "12:30", categoria: "ADULTOS", cupo: 100, vendidos: 0 },
        { hora: "13:00", categoria: "ADULTOS", cupo: 100, vendidos: 0 },
        { hora: "13:30", categoria: "ADULTOS", cupo: 100, vendidos: 0 },
        { hora: "13:30", categoria: "KIDS", cupo: 50, vendidos: 0 }
    ],
    contacto: {
        email: "corredor@carrerasucia.com",
        instagram: "@carrerasucia"
    },
    servicios: ["duchas", "vestuarios", "guardarropa", "estacionamiento"],
    notas: "",
    personalidad: {
        nombre: "CERDÍN",
        tono: "Amigable, divertido, entusiasta",
        idioma: "Español argentino (vos, tenés, podés)",
        emojis: "Moderados",
        cierre: "¡Oink!",
        derivar_a_humano: "facturación, grupos grandes +10, corporativos, prensa, problemas con pagos"
    }
};

let config = {};

function cargarConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            config = { ...DEFAULT_CONFIG, ...saved };
            config.evento = { ...DEFAULT_CONFIG.evento, ...saved.evento };
            config.precios = { ...DEFAULT_CONFIG.precios, ...saved.precios };
            config.contacto = { ...DEFAULT_CONFIG.contacto, ...saved.contacto };
            config.personalidad = { ...DEFAULT_CONFIG.personalidad, ...saved.personalidad };
            if (saved.horarios) config.horarios = saved.horarios;
            console.log(`⚙️  Config cargada`);
        } else {
            config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            guardarConfig();
            console.log(`⚙️  Config por defecto creada`);
        }
    } catch (e) {
        console.error('Error cargando config:', e.message);
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
}

function guardarConfig() {
    try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch (e) { console.error('Error guardando config:', e.message); }
}

// =============================================
// SYSTEM PROMPT DINÁMICO
// =============================================

function generarSystemPrompt() {
    const fechaHoy = new Date().toLocaleDateString('es-AR');
    const fechaCarrera = new Date(config.evento.fecha);
    const diasFaltantes = Math.ceil((fechaCarrera - new Date()) / (1000 * 60 * 60 * 24));

    const p = config.precios;
    const e = config.evento;
    const c = config.contacto;
    const per = config.personalidad;

    // Generar info de horarios con disponibilidad
    let horariosText = '';
    const categorias = {};
    config.horarios.forEach(h => {
        if (!categorias[h.categoria]) categorias[h.categoria] = [];
        const disponibles = h.cupo - h.vendidos;
        const estado = disponibles <= 0 ? '❌ AGOTADO' : disponibles <= 10 ? `⚠️ últimos ${disponibles} lugares!` : `✅ disponible (${disponibles} lugares)`;
        categorias[h.categoria].push(`  ${h.hora} → ${estado}`);
    });
    for (const [cat, lines] of Object.entries(categorias)) {
        horariosText += `${cat}:\n${lines.join('\n')}\n`;
    }

    const serviciosText = config.servicios.length > 0 ? `HAY: ${config.servicios.join(', ')}.` : '';

    return `Sos ${per.nombre} 🐷, el asistente virtual de ${e.nombre}.

PERSONALIDAD:
- ${per.tono}
- ${per.idioma}
- Emojis moderados
- Terminás con "${per.cierre}"
- Conciso pero completo

FECHA: ${fechaHoy} | FALTAN: ${diasFaltantes} días para la carrera

PRÓXIMA CARRERA - ${e.fecha}:
- Lugar: ${e.lugar}
- Google Maps: ${e.maps}
- Adultos: ${e.descripcion_adultos}
- KIDS: ${e.descripcion_kids}

HORARIOS Y DISPONIBILIDAD:
${horariosText}
IMPORTANTE SOBRE DISPONIBILIDAD:
- Si un horario dice AGOTADO, NO lo ofrezcas. Sugerí los horarios que tienen disponibilidad.
- Si dice "últimos X lugares", avisale al cliente que quedan pocos y que se apure.
- Nunca inventes disponibilidad, usá solo la info de arriba.

PRECIOS:
- Individual: $${p.individual.toLocaleString('es-AR')}
- Grupo (${p.grupo_cantidad} personas): $${p.grupo_precio.toLocaleString('es-AR')}
- KIDS: $${p.kids.toLocaleString('es-AR')} (incluye remera)
- ELITE: $${p.elite.toLocaleString('es-AR')}
- Remera adicional: $${p.remera.toLocaleString('es-AR')}

INSCRIPCIÓN: ${e.inscripcion}

CONTACTO: ${c.email}
Instagram: ${c.instagram}

${serviciosText}
SE CORRE LLUEVA O TRUENE.

${config.notas ? 'NOTA IMPORTANTE: ' + config.notas : ''}

Si alguien pregunta algo que NO sabés o necesita atención personalizada (${per.derivar_a_humano}), respondé amablemente y decí que lo vas a derivar con el equipo humano.`;
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
        return '¡Uy! Tuve un problemita técnico. Escribinos a ' + config.contacto.email + '. Oink! 🐷';
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
                headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
            }
        );
        if (!response.ok) { const error = await response.json(); console.error('❌ Meta API:', JSON.stringify(error)); return false; }
        return true;
    } catch (error) { console.error('❌ Error WhatsApp:', error.message); return false; }
}

// =============================================
// GUARDAR MENSAJE
// =============================================

function guardarMensaje(convId, role, content, extra = {}) {
    if (!conversaciones[convId]) {
        conversaciones[convId] = {
            channel: convId.startsWith('ig_') ? 'ig' : 'wa',
            phone: convId.startsWith('wa_') ? convId.replace('wa_', '') : null,
            username: convId.startsWith('ig_') ? convId.replace('ig_', '') : null,
            name: null, messages: []
        };
    }
    conversaciones[convId].messages.push({ role, content, timestamp: new Date().toISOString(), ...extra });
    if (conversaciones[convId].messages.length > 100) conversaciones[convId].messages = conversaciones[convId].messages.slice(-100);
    guardarConversaciones();
}

// =============================================
// WEBHOOK - WhatsApp
// =============================================

app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) { console.log('✅ Webhook verificado'); res.status(200).send(challenge); }
    else res.sendStatus(403);
});

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

        const contactName = value.contacts?.[0]?.profile?.name;
        if (contactName && conversaciones[convId]) conversaciones[convId].name = contactName;

        if (message.type !== 'text') {
            guardarMensaje(convId, 'user', `[${message.type}]`);
            await enviarMensajeWhatsApp(from, '¡Hola! Por ahora solo puedo leer mensajes de texto 🐷 Escribime tu consulta y te ayudo. Oink!');
            return;
        }

        const texto = message.text.body;
        console.log(`📩 [WA] ${from}: ${texto.substring(0, 80)}`);
        guardarMensaje(convId, 'user', texto);

        const mode = getMode(convId);
        if (mode === 'human') { console.log(`⏸️  [WA] ${from}: Modo HUMANO`); return; }

        const respuesta = await consultarClaude(convId, texto);
        guardarMensaje(convId, 'assistant', respuesta);
        await enviarMensajeWhatsApp(from, respuesta);
        console.log(`🐷 [WA] → ${from}`);
    } catch (error) { console.error('❌ Error webhook:', error.message); }
});

// =============================================
// API - Dashboard
// =============================================

app.get('/api/conversaciones', (req, res) => {
    const result = {};
    for (const [id, conv] of Object.entries(conversaciones)) {
        const modo = modos[id] || { mode: 'ai' };
        result[id] = { ...conv, mode: modo.mode, assignedTo: modo.assignedTo, unread: 0 };
    }
    res.json(result);
});

app.get('/api/stats', (req, res) => {
    const all = Object.entries(conversaciones);
    let totalMsgs = 0, totalUserMsgs = 0;
    all.forEach(([_, conv]) => { totalMsgs += conv.messages?.length || 0; totalUserMsgs += (conv.messages || []).filter(m => m.role === 'user').length; });
    res.json({
        conversaciones: all.length, whatsapp: all.filter(([id]) => id.startsWith('wa_')).length,
        instagram: all.filter(([id]) => id.startsWith('ig_')).length,
        modo_ia: all.filter(([id]) => getMode(id) === 'ai').length,
        modo_humano: all.filter(([id]) => getMode(id) === 'human').length,
        mensajes_total: totalMsgs, mensajes_clientes: totalUserMsgs,
        bot_activo: true, ultima_actualizacion: new Date().toISOString()
    });
});

app.post('/api/modo', (req, res) => {
    const { convId, mode, assignedTo } = req.body;
    if (!convId || !mode || !['ai', 'human'].includes(mode)) return res.status(400).json({ error: 'convId y mode requeridos' });
    if (mode === 'human' && !assignedTo) return res.status(400).json({ error: 'assignedTo requerido' });
    setMode(convId, mode, assignedTo);
    console.log(`🔀 ${convId}: ${mode}${assignedTo ? ` (${assignedTo})` : ''}`);
    res.json({ ok: true, convId, mode, assignedTo });
});

app.post('/api/enviar', async (req, res) => {
    const { convId, message, agent } = req.body;
    if (!convId || !message || !agent) return res.status(400).json({ error: 'convId, message y agent requeridos' });
    if (getMode(convId) !== 'human') return res.status(400).json({ error: 'Debe estar en modo humano' });
    guardarMensaje(convId, 'human', message, { agent });
    const conv = conversaciones[convId];
    let enviado = false;
    if (conv?.channel === 'wa' && conv?.phone) enviado = await enviarMensajeWhatsApp(conv.phone, message);
    console.log(`💬 [${agent}] → ${convId}: ${message.substring(0, 50)}...`);
    res.json({ ok: true, enviado, convId, agent });
});

// =============================================
// API - Config
// =============================================

app.get('/api/config', (req, res) => { res.json(config); });

app.post('/api/config', (req, res) => {
    const n = req.body;
    if (!n) return res.status(400).json({ error: 'Config requerida' });
    if (n.evento) config.evento = { ...config.evento, ...n.evento };
    if (n.precios) config.precios = { ...config.precios, ...n.precios };
    if (n.contacto) config.contacto = { ...config.contacto, ...n.contacto };
    if (n.personalidad) config.personalidad = { ...config.personalidad, ...n.personalidad };
    if (n.horarios) config.horarios = n.horarios;
    if (n.servicios) config.servicios = n.servicios;
    if (n.notas !== undefined) config.notas = n.notas;
    guardarConfig();
    console.log(`⚙️  Config actualizada`);
    res.json({ ok: true, config });
});

app.post('/api/horario', (req, res) => {
    const { index, vendidos, cupo } = req.body;
    if (index === undefined) return res.status(400).json({ error: 'index requerido' });
    if (!config.horarios[index]) return res.status(400).json({ error: 'Horario no encontrado' });
    if (vendidos !== undefined) config.horarios[index].vendidos = parseInt(vendidos);
    if (cupo !== undefined) config.horarios[index].cupo = parseInt(cupo);
    guardarConfig();
    const h = config.horarios[index];
    console.log(`🎫 ${h.hora} ${h.categoria}: ${h.vendidos}/${h.cupo}`);
    res.json({ ok: true, horario: h });
});

// =============================================
// DASHBOARD
// =============================================

app.get('/dashboard', (req, res) => { res.sendFile(path.join(__dirname, 'dashboard.html')); });
app.get('/', (req, res) => { res.send('🐷 CERDÍN - Bot Carrera Sucia - Activo | <a href="/dashboard">Ver Dashboard</a>'); });

// =============================================
// INICIAR
// =============================================

cargarConversaciones();
cargarModos();
cargarConfig();

app.listen(PORT, () => {
    console.log('');
    console.log('🐷 CERDÍN – BOT CARRERA SUCIA v4');
    console.log('=================================');
    console.log(`✅ Puerto ${PORT}`);
    console.log(`📱 Phone: ${PHONE_NUMBER_ID}`);
    console.log(`🤖 Claude: ${ANTHROPIC_API_KEY ? '✅' : '❌'}`);
    console.log(`🔑 Meta: ${WHATSAPP_TOKEN ? '✅' : '❌'}`);
    console.log(`💾 Datos: ${DATA_DIR}`);
    console.log(`⚙️  Config: ✅`);
    console.log(`🎫 Horarios: ${config.horarios.length}`);
    console.log(`💬 Convos: ${Object.keys(conversaciones).length}`);
    console.log('');
    console.log('  GET  /dashboard /api/conversaciones /api/stats /api/config');
    console.log('  POST /api/modo /api/enviar /api/config /api/horario /webhook');
    console.log('');
});
