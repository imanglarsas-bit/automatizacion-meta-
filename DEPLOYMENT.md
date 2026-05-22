# Ruta para publicar y conectar `evcarcol.com`

Esta es la ruta recomendada para pasar del prototipo local a una integración real con Meta.

## 1. Elegir estructura del dominio

Recomendado:

- `evcarcol.com`: página comercial.
- `app.evcarcol.com`: plataforma y backend.
- `app.evcarcol.com/webhooks/meta`: webhook que registrarás en Meta Developers.

También puedes usar todo en `evcarcol.com`, pero separar `app` deja más ordenado el producto.

## 2. Subir el proyecto a un hosting Node

Necesitas un hosting que permita servidor Node.js con HTTPS. Opciones comunes:

- Render
- Railway
- Fly.io
- VPS propio con Nginx
- DigitalOcean App Platform

Comando de inicio:

```bash
npm start
```

Variables de entorno necesarias:

```txt
PORT=3000
PUBLIC_BASE_URL=https://app.evcarcol.com
META_VERIFY_TOKEN=una_frase_privada_larga
GRAPH_API_VERSION=v22.0
WHATSAPP_ACCESS_TOKEN=token_real
WHATSAPP_PHONE_NUMBER_ID=id_real
PAGE_ACCESS_TOKEN=token_real
PAGE_ID=id_real
ADMIN_PASSWORD=una_contraseña_privada_para_admin
DATA_DIR=/var/data
```

## 3. Configurar DNS

En el panel donde compraste `evcarcol.com`:

- Crea un registro `CNAME` para `app.evcarcol.com` apuntando al hosting.
- Si usarás la raíz `evcarcol.com`, configura el registro que pida tu proveedor.
- Activa HTTPS/SSL en el hosting.

Meta exige una URL pública HTTPS para webhooks.

## 4. Crear la app en Meta Developers

En Meta Developers:

1. Crea una app de negocio.
2. Agrega los productos que necesites:
   - WhatsApp
   - Messenger
   - Instagram
   - Webhooks
3. Configura el webhook:
   - Callback URL: `https://app.evcarcol.com/webhooks/meta`
   - Verify token: el mismo valor de `META_VERIFY_TOKEN`
4. Suscribe los campos de mensajes del canal correspondiente.

## 5. Cómo viaja un mensaje real

```txt
Cliente escribe en Meta
  ↓
Meta envía POST a /webhooks/meta
  ↓
El backend identifica canal, usuario y texto
  ↓
Busca una respuesta entrenada en backend/data/training.json
  ↓
Responde usando Graph API
```

## 6. Prueba inicial

Local:

```bash
npm start
```

Luego abre:

- `http://localhost:3000`
- `http://localhost:3000/plataforma.html`

Producción:

- `https://app.evcarcol.com`
- `https://app.evcarcol.com/login.html`
- `https://app.evcarcol.com/cliente.html` portal privado para responder conversaciones humanas
- `https://app.evcarcol.com/admin-login.html` acceso discreto de administración
- `https://app.evcarcol.com/plataforma.html` panel admin protegido por contraseña
- `https://app.evcarcol.com/webhooks/meta`

## 7. Importante para producción

### Guardar perfiles creados en Render

Los perfiles de clientes, usuarios, entrenamientos y métricas no deben depender de los archivos del repositorio, porque Render puede reiniciar o redeployar el servicio y volver al estado inicial.

Para que queden guardados:

1. En Render, abre tu servicio.
2. Entra a la sección de discos o almacenamiento persistente.
3. Crea un Persistent Disk.
4. Usa como ruta de montaje: `/var/data`.
5. En Environment Variables agrega:

```txt
DATA_DIR=/var/data
```

Desde ese momento, los perfiles nuevos se guardan en esa carpeta persistente. Si no configuras `DATA_DIR` con un disco persistente, los perfiles pueden perderse después de reinicios o nuevos deploys.

Antes de clientes reales, falta endurecer:

- Base de datos real o disco persistente para datos operativos.
- Login de usuarios.
- Cifrado y rotación de tokens.
- Validación de firma de webhooks de Meta.
- Panel para conversaciones humanas.
- Auditoría de respuestas enviadas.
- Revisión de permisos de Meta App Review.
