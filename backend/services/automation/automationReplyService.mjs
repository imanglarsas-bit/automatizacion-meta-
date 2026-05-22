const DEFAULT_REPLY =
  "Gracias por escribirnos. Recibimos tu mensaje y un asesor continuará el proceso. Para ayudarte mejor, compártenos tu nombre, teléfono y necesidad principal.";

const QUICK_REPLIES = [
  {
    keywords: ["precio", "costo", "valor", "plan", "cotizar", "cotizacion"],
    text:
      "Tenemos varias opciones según tu necesidad. Para orientarte mejor, cuéntanos qué servicio buscas, ciudad y volumen aproximado de mensajes.",
  },
  {
    keywords: ["horario", "atienden", "abierto", "disponible"],
    text:
      "Nuestro equipo recibe tu solicitud y la revisa en horario laboral. Puedes dejar tus datos y motivo de consulta para avanzar el proceso.",
  },
  {
    keywords: ["soporte", "ayuda", "problema", "fallo", "error"],
    text:
      "Vamos a revisar tu caso. Por favor envíanos una breve descripción del problema, tu nombre y un dato de contacto para seguimiento.",
  },
  {
    keywords: ["demo", "asesoria", "reunion", "llamada"],
    text:
      "Claro, podemos coordinar una asesoría. Compártenos nombre, empresa, teléfono y el canal principal que quieres automatizar.",
  },
];

export function buildAutomationReply({ message, company }) {
  const normalized = normalize(message);
  const match = QUICK_REPLIES.find((reply) => reply.keywords.some((keyword) => normalized.includes(keyword)));
  const contactHint = company?.contact?.whatsapp ? ` También puedes escribir al WhatsApp ${company.contact.whatsapp}.` : "";

  return {
    text: `${match?.text || DEFAULT_REPLY}${contactHint}`,
    provider: "automation",
    model: "preconfigured-flow",
    estimatedCostUSD: 0,
    mock: false,
    planBlockedAi: true,
  };
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
