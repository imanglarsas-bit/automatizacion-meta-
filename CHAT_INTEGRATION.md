# Chat de iDIGITAL en imanglar.com

El chat se sirve desde el proyecto web y procesa las conversaciones en `app.imanglar.com`.

## Integración general

Agrega este código antes del cierre de `</body>` en la plantilla compartida por las páginas:

```html
<script
  src="https://TU-DOMINIO-RENDER/chat-widget.js"
  data-company-id="inversiones-manglar"
  data-api-base="https://app.imanglar.com"
  defer
></script>
```

El módulo detecta automáticamente la unidad usando la URL y el título de la página.

## Contexto explícito por página

En la página de Cárdenas Romero:

```html
<script
  src="https://TU-DOMINIO-RENDER/chat-widget.js"
  data-company-id="inversiones-manglar"
  data-page-context="cardenas-romero"
  data-api-base="https://app.imanglar.com"
  defer
></script>
```

En la página de SRC Consulting:

```html
<script
  src="https://TU-DOMINIO-RENDER/chat-widget.js"
  data-company-id="inversiones-manglar"
  data-page-context="src-consulting"
  data-api-base="https://app.imanglar.com"
  defer
></script>
```

## Funcionamiento

- No muestra un botón flotante directo de WhatsApp.
- Usa los embudos configurados para cada unidad.
- No consume APIs de inteligencia artificial.
- Guarda las conversaciones como canal `Chat web`.
- Los casos derivados aparecen en el CRM como pendientes.
- Antes de derivar solicita nombre, teléfono, correo, ciudad y empresa u organización.
- Exige autorización de tratamiento de datos.
- Los datos quedan guardados en la conversación del CRM.
- WhatsApp se ofrece dentro del chat únicamente después de registrar los datos del lead.
