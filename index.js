require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

// ============================================
// CERDÍN - Bot WhatsApp Carrera Sucia
// Meta Cloud API + Claude AI
// ============================================

const app = express();
app.use(express.json());

// --- CONFIGURACIÓN ---
const PORT = process.env.PORT || 8080;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'carrera_sucia_2026';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// --- CLAUDE AI ---
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// --- HISTORIAL DE CONVERSACIONES (en memoria) ---
const conversaciones = {};

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
    // Limitar historial a 50 mensajes por número
    if (conversaciones[telefono].length > 50) {
        conversaciones[telefono] = conversaciones[telefono].slice(-50);
    }
}

// --- SYSTEM PROMPT ---
function generarSystemPrompt() {
    const fechaHoy = new Date().toLocaleDateString('es-AR');
    const fechaCarrera = new Date('2026-03-29');
    const diasFaltantes = Math.ceil((fechaCarrera - new Date()) / (1000 * 60 * 60 * 24));

    return `Sos CERDÍN, el asistente virtual de CARRERA SUCIA. 🐷

PERSONALIDAD:
- Amigable, divertido, entusiasta
- Español argentino (vos, tenés, podés)
- Emojis moderados (🐷 🏃 💪 😄)
- Terminás mensajes con "Oink! 🐷" 
- Conciso pero completo. No te vayas por las ramas.
- Si no sabés algo, decilo honestamente y derivá a info@carrerasucia.com

FECHA DE HOY: ${fechaHoy} | FALTAN: ${diasFaltantes} días para la carrera

PRÓXIMA CARRERA - 29 DE MARZO 2026:
- Lugar: Escobar, Provincia de Buenos Aires
- Circuito adultos: 5K con más de 20 obstáculos
- Circuito KIDS: 1.5K con 6 obstáculos (5-12 años)
- Podés correr solo/a o en equipos de hasta 4 personas

HORARIOS DE LARGADA:
- ADULTOS: Cada 30 minutos de 9:30 a 13:30
- ELITE: 9:30 (competitiva, cronometrada, todos los obstáculos obligatorios)
- KIDS: 10:30 y 13:30

PRECIOS 2026:
EARLY BIRD (hasta 9 de marzo):
- Sin remera: $54,000
- Con remera: $68,000
PRECIO NORMAL:
- Sin remera: $65,000
- Con remera: $79,000
KIDS: Early Bird $32,000 / Normal $37,000
ELITE: +$5,000 adicional al precio de adulto

INSCRIPCIÓN:
- Link: www.carrerasucia.com.ar
- Cupos limitados
- Cierre inscripción: 23 de marzo
- Plazo para pagar: 2 días después de pre-inscribirte (luego el sistema elimina automáticamente)
- Forma de pago: Pago electrónico en la web

POLÍTICA DE DEVOLUCIÓN:
- NO hay devolución
- Transferencia a otra persona: permitida hasta 20 días antes, costo $6,000
- Cambios: solo dentro de misma categoría/horario, escribir a info@carrerasucia.com

SERVICIOS EN EL PREDIO:
- Carpas vestuario y duchas exteriores
- Guardarropa sin cargo
- Estacionamiento GRATIS
- Retiro de kit: el día de la carrera, presentarse 1 hora y media antes de la largada

QUÉ INCLUYE LA INSCRIPCIÓN:
- Derecho de participación
- Número tyveck
- Medalla finisher
- Hidratación
- Uso de baños, duchas, carpas vestuario y guardarropas
- Estacionamiento gratis
- Pulsera, Bolsa y Remera (solo si la seleccionaste al inscribirte)

CATEGORÍA KIDS (5-12 años):
- Acompañados por personal de la organización
- Si el adulto quiere acompañar, puede hacerlo sin costo (1 adulto por chico)
- La remera, medalla e hidratación son para el niño
- Menores de 5: pueden correr pero OBLIGATORIO acompañados por un adulto responsable

NO SE SUSPENDE POR LLUVIA.

DESCUENTOS: Grupos de +15 personas → escribir a corredor@carrerasucia.com

FOTOS: En las historias destacadas de Instagram @carrerasucia
DIRECCIÓN: En el perfil de Instagram y en historias destacadas (mapa de cómo llegar)

CONTACTO:
- Email general: info@carrerasucia.com  
- Email grupos: corredor@carrerasucia.com
- Instagram: @carrerasucia
- Facebook: @carrerasucia
- TikTok: @carrerasucia

REGLAS IMPORTANTES:
1. Respondé SOLO sobre Carrera Sucia. Si preguntan otra cosa, decí amablemente que solo manejás info de la carrera.
2. Sé breve. Mensajes de WhatsApp, no ensayos.
3. Si la consulta es compleja o no tenés la info, derivá a info@carrerasucia.com
4. No inventes información que no tenés.`;
}

// --- CONSULTAR CLAUDE ---
async function consultarClaude(telefono, mensajeUsuario) {
    const historial = obtenerHistorial(telefono, 10);

    const mensajes = historial.map(m => ({
        role: m.role,
        content: m.content
    }));
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
        console.error('[CLAUDE ERROR]', error.message);
        return '¡Uy! Tuve un problemita técnico 😅 Intentá de nuevo en unos segundos, o escribí a info@carrerasucia.com. Oink! 🐷';
    }
}

// --- ENVIAR MENSAJE POR META API ---
async function enviarMensaje(telefono, texto) {
    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: telefono,
                type: 'text',
                text: { body: texto }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[META API ERROR]', JSON.stringify(data));
            return false;
        }

        console.log(`[ENVIADO] a ${telefono}`);
        return true;
    } catch (error) {
        console.error('[ENVIO ERROR]', error.message);
        return false;
    }
}

// ============================================
// RUTAS
// ============================================

// Health check - CRÍTICO para que Railway no mate el container
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'ok',
        bot: 'Cerdín - Carrera Sucia',
        uptime: process.uptime()
    });
});

// Webhook verification (GET) - Meta lo usa para verificar
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[WEBHOOK] Verificado ✅');
        return res.status(200).send(challenge);
    }

    console.warn('[WEBHOOK] Verificación fallida');
    return res.sendStatus(403);
});

// Webhook mensajes entrantes (POST) - Meta manda los mensajes acá
app.post('/webhook', async (req, res) => {
    // IMPORTANTE: Responder 200 INMEDIATAMENTE para que Meta no reintente
    res.sendStatus(200);

    try {
        const body = req.body;

        if (body.object !== 'whatsapp_business_account') return;

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        // Ignorar si no hay mensajes (puede ser status update, etc)
        if (!value?.messages) return;

        const message = value.messages[0];

        // Solo procesar mensajes de texto
        if (message.type !== 'text') {
            console.log(`[IGNORADO] Tipo: ${message.type}`);
            return;
        }

        const telefono = message.from;
        const texto = message.text.body;

        console.log(`[RECIBIDO] ${telefono}: ${texto.substring(0, 80)}`);

        // Consultar Claude AI
        const respuesta = await consultarClaude(telefono, texto);

        // Enviar respuesta
        const enviado = await enviarMensaje(telefono, respuesta);

        if (enviado) {
            console.log(`[OK] Respondido a ${telefono}`);
        } else {
            console.error(`[FAIL] No se pudo enviar a ${telefono}`);
        }

    } catch (error) {
        console.error('[WEBHOOK ERROR]', error.message);
    }
});

// ============================================
// INICIAR SERVIDOR
// ============================================

// CLAVE: Iniciar el servidor PRIMERO, antes que cualquier otra cosa
// Railway mata el container si no detecta el puerto abierto rápido
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🐷 CERDÍN - BOT CARRERA SUCIA');
    console.log('============================');
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Phone Number ID: ${PHONE_NUMBER_ID}`);
    console.log(`🤖 Claude AI: Activo`);
    console.log(`🔑 Token Meta: ${WHATSAPP_TOKEN ? '✅ Configurado' : '❌ FALTA'}`);
    console.log(`🔑 Token Claude: ${ANTHROPIC_API_KEY ? '✅ Configurado' : '❌ FALTA'}`);
    console.log('');
    console.log('Esperando mensajes...');
    console.log('');
});

// Manejar errores del servidor
server.on('error', (error) => {
    console.error('[SERVER ERROR]', error.message);
});

// Manejar señales de cierre gracefully
process.on('SIGTERM', () => {
    console.log('[SIGTERM] Cerrando gracefully...');
    server.close(() => {
        console.log('[CLOSED] Servidor cerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[SIGINT] Cerrando...');
    server.close(() => process.exit(0));
});

// Capturar errores no manejados para que NO crashee
process.on('uncaughtException', (error) => {
    console.error('[UNCAUGHT EXCEPTION]', error.message);
    // NO hacer process.exit() - queremos que siga corriendo
});

process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED REJECTION]', reason);
    // NO hacer process.exit() - queremos que siga corriendo
});
