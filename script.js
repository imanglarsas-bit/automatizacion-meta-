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

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(leadForm);
  const name = data.get("name");
  const channel = data.get("channel");
  const volume = Number(data.get("volume"));
  const responseTime = volume > 60 ? "priorizar respuestas automáticas y derivación comercial" : "empezar con preguntas frecuentes y captación de datos";

  formNote.textContent = `${name}, listo. Para ${channel}, conviene ${responseTime}.`;
  leadForm.reset();
});

setScenario("precio");
