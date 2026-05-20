# Respuesta360

Proyecto inicial para una plataforma de automatización de respuestas en canales de Meta.

## Páginas

- `index.html`: página comercial para captar clientes.
- `plataforma.html`: panel operativo para conectar canales, entrenar respuestas y probar el bot.
- `backend/server.mjs`: servidor Node inicial para servir la web, recibir webhooks de Meta y responder mensajes.
- `DEPLOYMENT.md`: pasos para publicar con `evcarcol.com`.

## Qué incluye la plataforma

- Estado de conexión para Instagram, Facebook, Messenger y WhatsApp Business.
- Base de conocimiento editable para entrenar respuestas.
- Simulador que busca la mejor respuesta entrenada según el mensaje del cliente.
- Reglas de seguridad para derivación humana y confianza mínima.
- Guardado local en el navegador mediante `localStorage`.
- Logos SVG locales para los canales de Meta.

## Cómo manejaría respuestas con API

1. Meta envía un evento a tu webhook cuando llega un mensaje, comentario o actualización.
2. El backend valida el webhook, identifica canal, cliente y conversación.
3. El backend consulta la base entrenada del negocio y decide si responde el bot o deriva a un asesor.
4. Si responde el bot, el backend llama al endpoint oficial del canal mediante Graph API.
5. La conversación y el resultado se guardan para auditoría, métricas y mejora del entrenamiento.

## Siguiente fase técnica

Para que la conexión con Meta sea real, la plataforma necesita un backend que maneje:

- App de Meta Developers.
- Permisos oficiales por canal.
- Webhooks para recibir mensajes y comentarios.
- Tokens de acceso guardados de forma segura.
- Envío de respuestas desde el servidor.
- Motor de IA conectado a la base de conocimiento del negocio.

Ya existe una primera base en `backend/server.mjs`. Para correrla:

```bash
npm start
```
