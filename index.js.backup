require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());

// ============================================
// 🐷 CERDÍN - BOT CARRERA SUCIA
// Meta WhatsApp Business API + Claude AI
// ============================================

const PORT = process.env.PORT || 3000;

// Verificar variables de entorno
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'carrera_sucia_2026';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Inicializar Claude
const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY
});

// Memoria de conversaciones (en producción usar base de datos)
const conversaciones = {};

// ============================================
// SYSTEM PROMPT PARA CERDÍN
// ============================================
function generarSystemPrompt() {
    const fechaHoy = new Date().toLocaleDateString('es-AR');
    const fechaCarrera = new Date('2026-03-29');
    const hoy = new Date();
    const diasFaltantes = Math.ceil((fechaCarrera - hoy) / (1000 * 60 * 60 * 24));
    
    return `Sos CERDÍN, el asistente virtual de CARRERA SUCIA 🐷

PERSONALIDAD:
- Súper amigable, divertido, entusiasta
- Hablás en español argentino (vos, tenés, podés)
- Usás emojis con moderación
- SIEMPRE terminás tus mensajes con "Oink! 🐷"
- Sos conciso pero completo
- Si no sabés algo, derivás a info@carrerasucia.com

FECHA DE HOY: ${fechaHoy}
FALTAN: ${diasFaltantes} días para la carrera

═══════════════════════════════════════
PRÓXIMA CARRERA - 29 DE MARZO 2026
═══════════════════════════════════════
📍 Lugar: Escobar, Provincia de Buenos Aires
🏃 Adultos: Circuito 5K con +20 obstáculos
👶 KIDS: Circuito 1.5K con 6 obstáculos (5-12 años)

⏰ HORARIOS DE LARGADA:
- ADULTOS: Cada 30 min de 9:30 a 13:30
- ELITE: 9:30 (competitiva, cronometrada, todos los obstáculos obligatorios)
- KIDS: 10:30 y 13:30

💰 PRECIOS 2026:

EARLY BIRD (hasta 9 de marzo):
- Sin remera: $54,000
- Con remera: $68,000

PRECIO NORMAL:
- Sin remera: $65,000
- Con remera: $79,000

KIDS (5-12 años):
- Early Bird: $32,000
- Normal: $37,000

ELITE: +$5,000 adicional

═══════════════════════════════════════
INSCRIPCIÓN Y PAGOS
═══════════════════════════════════════
🌐 Web: www.carrerasucia.com.ar
📅 Inscripción hasta: 23 de marzo
⏰ Plazo para pagar: 2 días después de pre-inscribirte
❌ Devoluciones: No hay. Transferencia a otra persona hasta 20 días antes ($6,000)

═══════════════════════════════════════
SERVICIOS EN EL PREDIO
═══════════════════════════════════════
🚿 Duchas exteriores
🏕️ Carpas vestuario
🎒 Guardarropa GRATIS
🅿️ Estacionamiento GRATIS

═══════════════════════════════════════
CATEGORÍA KIDS
═══════════════════════════════════════
Para chicos de 5 a 12 años.
- Circuito: 1.5K con 6 obstáculos
- Horarios: 10:30 y 13:30
- Un adulto puede acompañar SIN CARGO
- Menores de 5 años: pueden correr OBLIGATORIAMENTE acompañados por un adulto

═══════════════════════════════════════
CATEGORÍA ELITE
═══════════════════════════════════════
- Salida: 9:30
- Cronometrada con premios
- Todos los obstáculos son OBLIGATORIOS
- Costo adicional: $5,000

═══════════════════════════════════════
GRUPOS (+15 personas)
═══════════════════════════════════════
Hay descuentos! Escribir a: corredor@carrerasucia.com

═══════════════════════════════════════
RETIRO DE KIT
═══════════════════════════════════════
Se retira el día de la carrera.
Presentarse 1 hora y media ANTES del horario de largada.

═══════════════════════════════════════
LLUVIA
═══════════════════════════════════════
¡NO SE SUSPENDE POR LLUVIA! La carrera se hace igual 💪

═══════════════════════════════════════
CONTACTO Y REDES
═══════════════════════════════════════
📧 General: info@carrerasucia.com
📧 Grupos: corredor@carrerasucia.com
📱 Instagram: @carrerasucia
📘 Facebook: @carrerasucia

═══════════════════════════════════════
REGLAS DE CONVERSACIÓN
═══════════════════════════════════════
1. Si te saludan, presentate brevemente y preguntá en qué podés ayudar
2. Sé directo y útil, no des vueltas
3. Si preguntan algo que no sabés, derivá a info@carrerasucia.com
4. Si quieren hablar con un humano, dales el mail de contacto
5. Recordá SIEMPRE terminar con "Oink! 🐷"`;
}

// ============================================
// FUNCIONES DE MEMORIA
// ============================================
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
    // Mantener máximo 50 mensajes por conversación
    if (conversaciones[telefono].length > 50) {
        conversaciones[telefono] = conversaciones[telefono].slice(-50);
    }
}

// ============================================
// CONSULTAR A CLAUDE
// ============================================
async function consultarClaude(telefono, mensajeUsuario) {
    const historial = obtenerHistorial(telefono, 10);
    
    const mensajes = historial.map(m => ({
        role: m.role,
        content: m.content
    }));
    
    mensajes.push({ role: 'user', content: mensajeUsuario });
    
    try {
        console.log(`🧠 Consultando Claude para ${telefono}...`);
        
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: generarSystemPrompt(),
            messages: mensajes
        });
        
        const respuesta = response.content[0].text;
        
        // Guardar en memoria
        guardarMensaje(telefono, 'user', mensajeUsuario);
        guardarMensaje(telefono, 'assistant', respuesta);
        
        console.log(`✅ Respuesta generada para ${telefono}`);
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error Claude:', error.message);
        return '¡Uy! Tuve un problemita técnico 😅 Intentá de nuevo en unos segundos, o escribí a info@carrerasucia.com si sigue fallando. Oink! 🐷';
    }
}

// ============================================
// ENVIAR MENSAJE VIA META API
// ============================================
async function enviarMensaje(telefono, mensaje) {
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
    
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
                text: { body: mensaje }
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error('❌ Error enviando mensaje:', data.error);
            return false;
        }
        
        console.log(`📤 Mensaje enviado a ${telefono}`);
        return true;
        
    } catch (error) {
        console.error('❌ Error en envío:', error.message);
        return false;
    }
}

// ============================================
// WEBHOOK - VERIFICACIÓN (GET)
// ============================================
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    console.log('🔐 Verificación webhook recibida');
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verificado correctamente');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Verificación fallida');
        res.sendStatus(403);
    }
});

// ============================================
// WEBHOOK - MENSAJES ENTRANTES (POST)
// ============================================
app.post('/webhook', async (req, res) => {
    // Responder inmediatamente a Meta (tienen timeout de 20 seg)
    res.sendStatus(200);
    
    try {
        const body = req.body;
        
        // Verificar que sea un mensaje de WhatsApp
        if (body.object !== 'whatsapp_business_account') return;
        
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        
        // Verificar que haya mensajes
        if (!value?.messages) return;
        
        const message = value.messages[0];
        const telefono = message.from;
        
        // Solo procesar mensajes de texto
        if (message.type !== 'text') {
            console.log(`⚠️ Mensaje no-texto de ${telefono}: ${message.type}`);
            await enviarMensaje(telefono, 'Por ahora solo puedo leer mensajes de texto 😅 ¿En qué te puedo ayudar? Oink! 🐷');
            return;
        }
        
        const textoUsuario = message.text.body;
        console.log(`\n📩 Mensaje de ${telefono}: ${textoUsuario}`);
        
        // Consultar a Claude y responder
        const respuesta = await consultarClaude(telefono, textoUsuario);
        await enviarMensaje(telefono, respuesta);
        
    } catch (error) {
        console.error('❌ Error procesando mensaje:', error);
    }
});

// ============================================
// RUTA DE SALUD
// ============================================
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        bot: '🐷 CERDÍN - Bot Carrera Sucia',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║  🐷 CERDÍN - BOT CARRERA SUCIA           ║
║  Meta WhatsApp Business API + Claude AI   ║
╠═══════════════════════════════════════════╣
║  Servidor corriendo en puerto ${PORT}          ║
║  Webhook: http://localhost:${PORT}/webhook    ║
╚═══════════════════════════════════════════╝
    `);
    
    // Verificar configuración
    if (!WHATSAPP_TOKEN) console.log('⚠️  WHATSAPP_TOKEN no configurado');
    if (!PHONE_NUMBER_ID) console.log('⚠️  PHONE_NUMBER_ID no configurado');
    if (!ANTHROPIC_API_KEY) console.log('⚠️  ANTHROPIC_API_KEY no configurado');
});
