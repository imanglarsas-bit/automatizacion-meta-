# Chat de iDIGITAL en imanglar.com

El chat se sirve desde `app.imanglar.com` y se puede insertar en WordPress sin copiar su lógica.

## Insertar en WordPress

Agrega este código antes del cierre de `</body>` usando el área de código personalizado del tema
o un plugin de encabezados y pies de página:

```html
<script
  src="https://app.imanglar.com/chat-widget.js"
  data-company-id="inversiones-manglar"
  data-api-base="https://app.imanglar.com"
  defer
></script>
```

## Funcionamiento

- Las respuestas usan los embudos y automatizaciones de Inversiones Manglar.
- No consume APIs de inteligencia artificial.
- Cada conversación se guarda como canal `Chat web`.
- Los casos que requieren una persona aparecen en el CRM como pendientes.
- El botón `Continuar por WhatsApp` abre el número configurado para Inversiones Manglar con el
  resumen de la conversación listo para enviar.
