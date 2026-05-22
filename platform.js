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

const defaultClients = [
  {
    companyId: "inversiones-manglar",
    name: "Inversiones Manglar",
    description: "Perfil principal para pruebas de automatización y conexión con Meta.",
  },
];

const storage = {
  companies: defaultClients,
  get clients() {
    return this.companies;
  },
  set clients(value) {
    this.companies = value;
  },
  get activeClientId() {
    return localStorage.getItem("r360_active_client") || this.clients[0].companyId;
  },
  set activeClientId(value) {
    localStorage.setItem("r360_active_client", value);
  },
  get activeClient() {
    return this.clients.find((client) => client.companyId === this.activeClientId) || this.clients[0];
  },
  key(name) {
    return `r360_${this.activeClientId}_${name}`;
  },
  get channels() {
    return JSON.parse(localStorage.getItem(this.key("channels")) || "{}");
  },
  set channels(value) {
    localStorage.setItem(this.key("channels"), JSON.stringify(value));
  },
  get training() {
    const saved = localStorage.getItem(this.key("training"));
    return saved ? JSON.parse(saved) : defaultTraining;
  },
  set training(value) {
    localStorage.setItem(this.key("training"), JSON.stringify(value));
  },
  get confidence() {
    return Number(localStorage.getItem(this.key("confidence")) || 75);
  },
  set confidence(value) {
    localStorage.setItem(this.key("confidence"), String(value));
  },
};

const clientSelect = document.querySelector("#clientSelect");
const clientName = document.querySelector("#clientName");
const clientDescription = document.querySelector("#clientDescription");
const clientForm = document.querySelector("#clientForm");
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

async function getJSON(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    window.location.href = "/admin-login.html";
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "No se pudo completar la acción." }));
    throw new Error(error.error || "No se pudo completar la acción.");
  }

  return response.json();
}

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

function slugify(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function renderClients() {
  const clients = storage.clients;
  const activeClient = storage.activeClient;

  clientSelect.innerHTML = clients
    .map(
      (client) =>
        `<option value="${escapeHTML(client.companyId)}" ${client.companyId === activeClient.companyId ? "selected" : ""}>${escapeHTML(client.name)}</option>`,
    )
    .join("");

  clientName.textContent = activeClient.name;
  clientDescription.textContent = `${activeClient.plan || "business"} · ${activeClient.channels?.join(", ") || "sin canales"}`;
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
  renderClients();
  renderConnections();
  renderTraining();
  renderMetrics();
}

clientSelect.addEventListener("change", () => {
  storage.activeClientId = clientSelect.value;
  renderAll();
  showToast("Perfil de cliente cambiado.");
});

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(clientForm);
  const name = data.get("clientName").trim();
  const username = data.get("username").trim();
  const password = data.get("password").trim();

  try {
    const result = await getJSON("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password }),
    });

    storage.clients = [...storage.clients, result.company];
    storage.activeClientId = result.company.companyId;
    clientForm.reset();
    renderAll();
    showToast(`Cliente creado. Usuario: ${result.user.username}`);
  } catch (error) {
    showToast(error.message);
  }
});

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

async function init() {
  const companies = await getJSON("/api/companies");
  if (companies?.length) {
    storage.clients = companies;
  }

  if (!storage.clients.some((client) => client.companyId === storage.activeClientId)) {
    storage.activeClientId = storage.clients[0].companyId;
  }

  renderAll();
}

init().catch((error) => {
  showToast(error.message || "No se pudo cargar la plataforma.");
  renderAll();
});
