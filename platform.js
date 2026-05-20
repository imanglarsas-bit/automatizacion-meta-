const channels = [
  {
    key: "instagram",
    name: "Instagram",
    logo: "assets/logo-instagram.svg",
    description: "Mensajes directos, comentarios y respuestas a historias.",
    requirement: "Instagram Messaging API",
  },
  {
    key: "facebook",
    name: "Facebook",
    logo: "assets/logo-facebook.svg",
    description: "Inbox de páginas, comentarios y consultas desde anuncios.",
    requirement: "Pages API y webhooks",
  },
  {
    key: "messenger",
    name: "Messenger",
    logo: "assets/logo-messenger.svg",
    description: "Conversaciones guiadas y derivación a asesores.",
    requirement: "Messenger Platform",
  },
  {
    key: "whatsapp",
    name: "WhatsApp Business",
    logo: "assets/logo-whatsapp.svg",
    description: "Soporte, ventas, pedidos y seguimiento postventa.",
    requirement: "WhatsApp Business Platform",
  },
];

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const defaultTraining = [
  {
    id: createId(),
    question: "precio, costo, valor, plan",
    answer:
      "Tenemos planes según el volumen de mensajes y los canales que quieras conectar. ¿Cuántos mensajes reciben al día y cuál es tu canal principal?",
    category: "Ventas",
    channel: "Todos",
  },
  {
    id: createId(),
    question: "horario, atienden, abierto",
    answer:
      "Atendemos de lunes a viernes de 8:00 a. m. a 6:00 p. m. El bot puede recibir tus datos ahora y un asesor continuará el caso.",
    category: "Soporte",
    channel: "Todos",
  },
];

const storage = {
  get channels() {
    return JSON.parse(localStorage.getItem("r360_channels") || "{}");
  },
  set channels(value) {
    localStorage.setItem("r360_channels", JSON.stringify(value));
  },
  get training() {
    const saved = localStorage.getItem("r360_training");
    return saved ? JSON.parse(saved) : defaultTraining;
  },
  set training(value) {
    localStorage.setItem("r360_training", JSON.stringify(value));
  },
  get confidence() {
    return Number(localStorage.getItem("r360_confidence") || 75);
  },
  set confidence(value) {
    localStorage.setItem("r360_confidence", String(value));
  },
};

const connectionGrid = document.querySelector("#connectionGrid");
const activeChannels = document.querySelector("#activeChannels");
const trainedAnswers = document.querySelector("#trainedAnswers");
const confidenceLabel = document.querySelector("#confidenceLabel");
const trainingForm = document.querySelector("#trainingForm");
const answerList = document.querySelector("#answerList");
const clearTraining = document.querySelector("#clearTraining");
const testForm = document.querySelector("#testForm");
const botPreview = document.querySelector("#botPreview");
const publishButton = document.querySelector("#publishButton");
const confidenceRange = document.querySelector("#confidenceRange");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderConnections() {
  const connected = storage.channels;
  connectionGrid.innerHTML = channels
    .map((channel) => {
      const isConnected = Boolean(connected[channel.key]);
      return `
        <article class="connection-card">
          <div class="connection-top">
            <img class="channel-dot" src="${channel.logo}" alt="${channel.name}" />
            <button class="connect-button ${isConnected ? "connected" : ""}" type="button" data-channel="${channel.key}">
              ${isConnected ? "Conectado" : "Conectar"}
            </button>
          </div>
          <div>
            <h3>${channel.name}</h3>
            <p>${channel.description}</p>
          </div>
          <small>${channel.requirement}</small>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".connect-button").forEach((button) => {
    button.addEventListener("click", () => toggleConnection(button.dataset.channel));
  });
}

function toggleConnection(key) {
  const connected = storage.channels;
  connected[key] = !connected[key];
  storage.channels = connected;
  renderAll();
  showToast(connected[key] ? "Canal marcado como conectado." : "Canal desactivado.");
}

function renderTraining() {
  const training = storage.training;
  if (!training.length) {
    answerList.innerHTML = `<div class="empty-state">Todavía no hay respuestas entrenadas.</div>`;
    return;
  }

  answerList.innerHTML = training
    .map(
      (item) => `
        <article class="answer-item">
          <header>
            <strong>${escapeHTML(item.question)}</strong>
            <button class="delete-answer" type="button" data-id="${item.id}" aria-label="Eliminar entrenamiento">Eliminar</button>
          </header>
          <p>${escapeHTML(item.answer)}</p>
          <div class="tag-row">
            <span class="tag">${escapeHTML(item.category)}</span>
            <span class="tag">${escapeHTML(item.channel)}</span>
          </div>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll(".delete-answer").forEach((button) => {
    button.addEventListener("click", () => deleteTraining(button.dataset.id));
  });
}

function renderMetrics() {
  const connectedCount = Object.values(storage.channels).filter(Boolean).length;
  activeChannels.textContent = connectedCount;
  trainedAnswers.textContent = storage.training.length;
  confidenceRange.value = storage.confidence;
  confidenceLabel.textContent = `${storage.confidence}%`;
}

function renderAll() {
  renderConnections();
  renderTraining();
  renderMetrics();
}

function deleteTraining(id) {
  storage.training = storage.training.filter((item) => item.id !== id);
  renderAll();
  showToast("Entrenamiento eliminado.");
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function scoreAnswer(prompt, item) {
  const promptWords = normalize(prompt).split(/\W+/).filter(Boolean);
  const questionWords = normalize(item.question).split(/\W+/).filter(Boolean);
  return questionWords.filter((word) => promptWords.includes(word)).length;
}

function findBestAnswer(prompt) {
  const ranked = storage.training
    .map((item) => ({ item, score: scoreAnswer(prompt, item) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score > 0 ? ranked[0].item : null;
}

trainingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(trainingForm);
  const nextTraining = {
    id: createId(),
    question: data.get("question").trim(),
    answer: data.get("answer").trim(),
    category: data.get("category"),
    channel: data.get("channel"),
  };

  storage.training = [nextTraining, ...storage.training];
  trainingForm.reset();
  renderAll();
  showToast("Respuesta añadida al entrenamiento.");
});

clearTraining.addEventListener("click", () => {
  storage.training = [];
  renderAll();
  showToast("Base de conocimiento limpiada.");
});

testForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const prompt = new FormData(testForm).get("prompt");
  const match = findBestAnswer(prompt);
  botPreview.textContent = match
    ? match.answer
    : "No encontré una respuesta entrenada para esa pregunta. Recomendación: derivar a un asesor y guardar esta intención en la base de conocimiento.";
});

publishButton.addEventListener("click", () => {
  showToast("Cambios listos para publicar. La integración real requiere backend y app de Meta.");
});

confidenceRange.addEventListener("input", () => {
  storage.confidence = confidenceRange.value;
  renderMetrics();
});

renderAll();
