# Despliegue en AWS para iDIGITAL

Este proyecto ya puede moverse a AWS. La app corre con Node.js, sirve la landing, el panel administrador, el portal cliente y las APIs desde el mismo servidor.

## Ruta recomendada ahora

Para esta etapa recomiendo AWS Lightsail o una instancia EC2 pequeña con Ubuntu.

Motivo: hoy la plataforma guarda empresas, planes, usuarios, entrenamiento, embudos y conversaciones en archivos JSON. Eso funciona bien para empezar, pero necesita una carpeta persistente para que los datos no se pierdan al reiniciar.

Cuando ya tengas clientes activos, el siguiente paso profesional será migrar esos JSON a una base de datos como RDS, DynamoDB o PostgreSQL.

## Variables necesarias

Configura estas variables en AWS:

```bash
PORT=3000
PUBLIC_BASE_URL=https://app.imanglar.com
ADMIN_PASSWORD=pon_una_clave_segura

META_VERIFY_TOKEN=pon_un_token_de_verificacion
GRAPH_API_VERSION=v22.0
META_APP_ID=
META_APP_SECRET=
META_LOGIN_CONFIG_ID=
META_OAUTH_REDIRECT_URI=https://app.imanglar.com/meta/oauth/callback
META_LIVE_MODE=false
META_ACCESS_TOKEN=
META_PHONE_NUMBER_ID=

ANTHROPIC_API_KEY=
OPENAI_API_KEY=

DATA_DIR=/var/lib/idigital-data
```

`DATA_DIR` es la carpeta donde quedarán guardados los cambios reales de la plataforma.

## Preparar el servidor

En una instancia Ubuntu de AWS:

```bash
sudo apt update
sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx
sudo mkdir -p /var/lib/idigital-data
sudo chown -R ubuntu:ubuntu /var/lib/idigital-data
```

Clona el proyecto:

```bash
git clone https://github.com/imanglarsas-bit/automatizacion-meta-.git
cd automatizacion-meta-
npm install --omit=dev
```

Prueba que arranque:

```bash
PORT=3000 DATA_DIR=/var/lib/idigital-data ADMIN_PASSWORD=tu_clave npm start
```

Abre en el navegador:

```text
http://IP_PUBLICA_DE_AWS:3000/health
```

Debe responder algo como:

```json
{"ok":true,"service":"idigital-platform","uptime":12}
```

## Dejarlo corriendo con PM2

```bash
sudo npm install -g pm2
DATA_DIR=/var/lib/idigital-data ADMIN_PASSWORD=tu_clave pm2 start backend/server.mjs --name idigital
pm2 save
pm2 startup
```

## Conectar dominio

En el DNS de `imanglar.com`, apunta:

```text
app.imanglar.com -> IP publica de AWS
```

Puede ser un registro `A` si usas EC2/Lightsail.

## Configurar Nginx

Crea un archivo para la app:

```bash
sudo nano /etc/nginx/sites-available/idigital
```

Contenido:

```nginx
server {
  listen 80;
  server_name app.imanglar.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Activa el sitio:

```bash
sudo ln -s /etc/nginx/sites-available/idigital /etc/nginx/sites-enabled/idigital
sudo nginx -t
sudo systemctl reload nginx
```

## Activar HTTPS

```bash
sudo certbot --nginx -d app.imanglar.com
```

## Webhook de Meta

Cuando el dominio esté activo, en Meta configura:

```text
https://app.imanglar.com/webhook/meta
```

El token de verificación debe ser el mismo valor de `META_VERIFY_TOKEN`.

## Conectar cuentas de Meta desde el panel

Para que el botón `Conectar con Meta` abra el flujo real de Meta, debes crear una app en Meta for Developers y configurar estas variables en AWS:

```bash
META_APP_ID=tu_app_id_de_meta
META_APP_SECRET=tu_app_secret_de_meta
META_LOGIN_CONFIG_ID=tu_configuracion_de_facebook_login_for_business
META_OAUTH_REDIRECT_URI=https://app.imanglar.com/meta/oauth/callback
PUBLIC_BASE_URL=https://app.imanglar.com
```

En Meta, agrega esta URL como redirect OAuth válido:

```text
https://app.imanglar.com/meta/oauth/callback
```

Después reinicia la app:

```bash
pm2 restart idigital --update-env
pm2 save
```

Sin esas variables, el panel no puede abrir Meta porque Meta exige saber qué app está solicitando permisos.

## Sincronizar datos base sin borrar clientes

Si agregas perfiles base en el repositorio, como EV Car Electricol, y AWS ya tiene datos persistentes en `DATA_DIR`, ejecuta:

```bash
git pull
DATA_DIR=/var/lib/idigital-data npm run sync:defaults
pm2 restart idigital --update-env
```

Esto agrega empresas, usuarios y conversaciones base que falten, y actualiza las definiciones comerciales de los planes `Start`, `Pro` y `Business` sin borrar clientes creados en producción.

## Opción con Docker

El proyecto incluye `Dockerfile`, así que también se puede subir a servicios como Elastic Beanstalk, ECS o App Runner.

Para probar localmente:

```bash
docker build -t idigital-platform .
docker run -p 3000:3000 -e DATA_DIR=/app/runtime-data -e ADMIN_PASSWORD=tu_clave idigital-platform
```

En Docker productivo debes montar un volumen persistente para `DATA_DIR`.
