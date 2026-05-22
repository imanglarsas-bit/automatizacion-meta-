# Respuesta360

Plataforma SaaS multiempresa de automatización conversacional con IA para canales de Meta (WhatsApp, Instagram, Messenger, Facebook).

**Empresa piloto:** Inversiones Manglar (Cárdenas Romero Abogados · SRC Consulting · Mucuba Hotel & Glamping)

---

## Cómo correr el proyecto

```bash
npm install
cp .env.example .env   # edita con tus credenciales reales
npm start              # http://localhost:3000
```

El portal cliente se abre en `/login.html` y entra a `/cliente.html`.
Los usuarios cliente están temporalmente en `backend/data/client-users.mock.json`.
Cuando el admin crea una empresa desde el panel, también se crea su usuario cliente.

El panel administrador se abre en `/admin-login.html` y entra a `/plataforma.html`.
Configúralo con:

```env
ADMIN_PASSWORD=tu_contraseña_admin
```

La landing (`/`) sigue siendo pública. El panel admin, el portal cliente y las APIs internas quedan protegidas por sesión.

El portal cliente muestra la bandeja humana: conversaciones derivadas por el bot, historial y formulario para responder desde la plataforma.

Usuarios cliente iniciales de prueba:

```txt
manglar / manglar123
evcar / evcar123
```

---

## Endpoints disponibles

### Legados (compatibilidad total)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/training` | Lista base de entrenamiento |
| POST | `/api/training` | Añade una respuesta entrenada |
| POST | `/api/test` | Prueba la base keyword-matching |
| GET | `/webhooks/meta` | Verificación webhook Meta (legacy) |
| POST | `/webhooks/meta` | Eventos entrantes Meta (legacy) |

### SaaS (nuevos)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/test-message` | Prueba el flujo completo con IA |
| GET | `/api/companies` | Lista todas las empresas |
| GET | `/api/companies/:id` | Empresa por companyId |
| GET | `/api/metrics/company/:id` | Métricas de consumo |
| GET | `/api/conversations/:companyId` | Historial (pendiente DB) |
| GET | `/webhook/meta` | Verificación Meta (SaaS) |
| POST | `/webhook/meta` | Eventos Meta (SaaS) |
| GET | `/api/messages/:companyId/:conversationId` | Historial de una conversación |
| POST | `/api/messages/:companyId/:conversationId/reply` | Respuesta humana desde la plataforma |

---

## Cómo probar el endpoint principal

```bash
curl -X POST http://localhost:3000/api/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "inversiones-manglar",
    "channel": "whatsapp",
    "from": "573223543251",
    "message": "Necesito instalar cargadores eléctricos"
  }'
```

Respuesta esperada:
```json
{
  "companyId": "inversiones-manglar",
  "channel": "whatsapp",
  "unit": "SRC Consulting",
  "unitType": "consulting",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "mock": true,
  "reply": "..."
}
```

---

## Cómo agregar una nueva empresa

1. Abre `backend/data/companies.mock.json`.
2. Copia el bloque de `inversiones-manglar` y ajusta `companyId`, `name`, `units`, `channels`, etc.
3. Crea el archivo de prompt en `backend/prompts/<companyId>.txt`.
4. Reinicia el servidor (`npm start`).

En la interfaz también puedes crear perfiles de cliente desde el panel. Cada perfil mantiene separados sus canales, respuestas entrenadas y reglas en el navegador.

---

## Cómo cambiar prompts

Edita el archivo de texto en `backend/prompts/`. El nombre debe coincidir con el campo `promptFile` de la empresa en `companies.mock.json`. Los cambios se recargan automáticamente en el siguiente mensaje.

---

## Proveedores de IA

### Anthropic (por defecto en Inversiones Manglar)

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Sin API key, el sistema responde en modo mock. Con key, usa `claude-3-5-sonnet` para mensajes complejos y `claude-haiku` para mensajes simples (optimización de costos automática).

### OpenAI (fallback)

```env
OPENAI_API_KEY=sk-...
```

Sin API key, también opera en modo mock. Se activa automáticamente si Anthropic falla.

### Fallback inteligente

Si el proveedor primario falla → intenta el fallback → si ambos fallan → respuesta genérica. Todo queda registrado en logs.

---

## Configuración IA por empresa

En `companies.mock.json`:

```json
{
  "aiProvider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "fallbackProvider": "openai",
  "fallbackModel": "gpt-4o-mini"
}
```

---

## Router inteligente de unidades (Inversiones Manglar)

El sistema detecta automáticamente a qué unidad enviar según palabras clave:

| Unidad | Palabras clave ejemplo |
|---|---|
| Cárdenas Romero | demanda, UGPP, tutela, electoral, seguro, administrativo |
| SRC Consulting | DIAN, ANLA, UPME, cargador eléctrico, importación EV, IVA |
| Mucuba | glamping, hospedaje, Guatavita, reserva, inversión, membresía |

---

## Cómo funciona Meta Business (cuando esté listo)

1. Crear App en Meta Developers con permisos WhatsApp/Messenger/Instagram.
2. Registrar webhook: `https://app.imanglar.com/webhook/meta`
3. Configurar `META_VERIFY_TOKEN` en Render.
4. Activar `META_LIVE_MODE=true` y configurar `META_ACCESS_TOKEN`.
5. Los mensajes entrantes se procesarán automáticamente con IA y responderán en el canal correspondiente.

---

## Planes SaaS

| Plan | Conversaciones/mes | Precio USD |
|---|---|---|
| Starter | 100 | $29 |
| Business | 500 | $79 |
| Premium | 2000 | $199 |

---

## Estructura del proyecto

```
backend/
├── server.mjs                    # Servidor principal (legado + SaaS)
├── routes/                       # Handlers de rutas SaaS
├── services/
│   ├── ai/                       # Anthropic, OpenAI, router, promptBuilder
│   ├── billing/                  # Planes, cuotas, consumo, precios
│   ├── company/                  # Configuración multiempresa
│   ├── meta/                     # Envío Meta (mock / real)
│   └── router/                   # Router inteligente de unidades
├── flows/                        # Flujos por unidad de negocio
├── prompts/                      # Prompts base por empresa
├── data/                         # Mocks (companies, usage, training)
└── utils/                        # Logger
```

---

## Despliegue en Render

1. Sube el proyecto a GitHub.
2. Crea un Web Service en Render conectado al repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Configura las variables de entorno desde `.env.example`.
6. Asigna el dominio personalizado `app.imanglar.com` en Render.
7. En Namecheap, crea un registro CNAME: `app → tu-servicio.onrender.com`.
