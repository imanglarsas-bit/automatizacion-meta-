const scenarios = {
  precio: {
    customer: "Hola, vi el producto en Instagram. ¿Me pueden confirmar precio y entrega?",
    bot:
      "¡Claro! Te comparto precio, opciones de entrega y disponibilidad. Para darte la mejor opción, ¿en qué ciudad estás?",
  },
  reserva: {
    customer: "Quiero reservar para este viernes. ¿Tienen espacio para cuatro personas?",
    bot:
      "Sí, puedo ayudarte con la reserva. Tengo horarios disponibles a las 7:00 p. m. y 8:30 p. m. ¿Cuál prefieres?",
  },
  soporte: {
    customer: "Compré ayer y no me ha llegado la confirmación. ¿Me ayudan?",
    bot:
      "Lo revisamos de inmediato. Por favor envíame el correo o número de pedido y te conecto con soporte con el caso resumido.",
  },
};

const customerMessage = document.querySelector("#customerMessage");
const botMessage = document.querySelector("#botMessage");
const scenarioButtons = document.querySelectorAll(".scenario");
const leadForm = document.querySelector("#leadForm");
const formNote = document.querySelector("#formNote");
const websiteForm = document.querySelector("#websiteForm");
const websiteFormNote = document.querySelector("#websiteFormNote");
const billingToggle = document.querySelector("[data-billing-toggle]");
const billingButtons = document.querySelectorAll("[data-billing]");
const pricingCards = document.querySelectorAll(".pricing-card");
const saveBadge = document.querySelector("[data-save-badge]");

function setScenario(key) {
  const scenario = scenarios[key];
  customerMessage.textContent = scenario.customer;
  botMessage.textContent = scenario.bot;

  scenarioButtons.forEach((button) => {
    const isActive = button.dataset.scenario === key;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

scenarioButtons.forEach((button) => {
  button.addEventListener("click", () => setScenario(button.dataset.scenario));
});

function setBillingMode(mode) {
  const isAnnual = mode === "annual";

  billingToggle.classList.toggle("annual", isAnnual);
  billingToggle.classList.toggle("monthly", !isAnnual);
  saveBadge.classList.toggle("is-hidden", !isAnnual);

  billingButtons.forEach((button) => {
    const isActive = button.dataset.billing === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  pricingCards.forEach((card) => {
    const price = card.querySelector("[data-price]");
    const note = card.querySelector("[data-note]");

    card.classList.add("price-changing");
    price.textContent = isAnnual ? card.dataset.annualPrice : card.dataset.monthlyPrice;
    note.textContent = isAnnual
      ? "Precio mensual pagando anual."
      : "Pago mensual flexible. Puedes ajustar el plan según tu crecimiento.";

    window.setTimeout(() => {
      card.classList.remove("price-changing");
    }, 180);
  });
}

billingButtons.forEach((button) => {
  button.addEventListener("click", () => setBillingMode(button.dataset.billing));
});

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(leadForm);
  const name = data.get("name");
  const business = data.get("business");
  const channel = data.get("channel");
  const volume = Number(data.get("volume"));
  const message = `Hola, soy ${name} de ${business}. Quiero una demostración de iDIGITAL para ${channel}. Recibimos aproximadamente ${volume} mensajes al día.`;

  formNote.textContent = `${name}, abrimos el asistente para continuar tu solicitud.`;
  window.dispatchEvent(new CustomEvent("idigital:open-chat", { detail: { message } }));
  leadForm.reset();
});

websiteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(websiteForm);
  const name = data.get("name");
  const business = data.get("business");
  const websiteType = data.get("websiteType");
  const message = data.get("message");
  const chatMessage = `Hola, soy ${name}. Quiero una página web para ${business}. Tipo: ${websiteType}. Necesito promocionar: ${message}. Vi la oferta desde $599.000 COP*.`;

  websiteFormNote.textContent = `${name}, listo. Abrimos el asistente para continuar la cotización.`;
  window.dispatchEvent(new CustomEvent("idigital:open-chat", { detail: { message: chatMessage } }));
  websiteForm.reset();
});

setScenario("precio");
setBillingMode("annual");
