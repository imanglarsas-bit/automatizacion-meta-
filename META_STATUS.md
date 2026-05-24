# Estado de integracion Meta

Ultima actualizacion: 2026-05-23

## Estado actual

- Dominio de app: `https://app.imanglar.com`
- Webhook Meta: `https://app.imanglar.com/webhook/meta`
- Verify token usado en AWS: `idigital_meta_2026`
- Cliente de prueba principal: `inversiones-manglar`
- WhatsApp Phone Number ID de prueba de Meta: `1185645557954638`
- La plataforma ya enruta mensajes entrantes por `Phone Number ID`.
- Inversiones Manglar ya esta preparado para recibir los mensajes del numero de prueba.

## Pendiente en Meta

Meta esta solicitando verificacion de empresa. Esto puede tardar y es normal cuando se quiere pasar de pruebas a integraciones reales.

Mientras la verificacion no este completa:

- Puedes probar con el numero de prueba de Meta.
- El boton `Conectar con Meta` puede pedir permisos o acceso adicional.
- Para clientes reales aun no conviene prometer conexion automatica desde la plataforma.

## Cuando retomemos

1. Completar o revisar la verificacion de empresa en Meta.
2. Confirmar que el caso de uso `Connect with customers through WhatsApp` este activo.
3. Revisar en Meta el `Phone Number ID`, `WhatsApp Business Account ID` y token.
4. Confirmar webhook:
   - Callback URL: `https://app.imanglar.com/webhook/meta`
   - Verify token: `idigital_meta_2026`
5. En iDIGITAL admin:
   - Cliente activo: `Inversiones Manglar`
   - Canales
   - Confirmar que WhatsApp aparece como conectado/enrutado.
6. Probar desde la pagina web de Manglar con un enlace a WhatsApp.
7. Revisar logs en AWS:

```bash
pm2 logs idigital --lines 80
```

## Variables importantes en AWS

Estas variables deben mantenerse al reiniciar PM2:

```bash
DATA_DIR=/var/lib/idigital-data
PORT=3000
PUBLIC_BASE_URL=https://app.imanglar.com
META_VERIFY_TOKEN=idigital_meta_2026
META_LIVE_MODE=true
META_DEFAULT_COMPANY_ID=inversiones-manglar
META_PHONE_NUMBER_ID=1185645557954638
GRAPH_API_VERSION=v25.0
```

`META_ACCESS_TOKEN` tambien debe existir en AWS, pero no debe guardarse en archivos del proyecto.

## Comando de actualizacion en AWS

```bash
cd ~/automatizacion-meta-
git pull
DATA_DIR=/var/lib/idigital-data npm run sync:defaults
pm2 restart idigital --update-env
pm2 save
```

## Nota de seguridad

No guardar contrasenas de Meta ni tokens en el repositorio. El cliente siempre debe autorizar en Meta o entregar tokens por un canal seguro.
