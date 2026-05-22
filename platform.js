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

const fallbackPlans = [
  {
    key: "start",
    name: "Start",
    monthlyMessageLimit: 1000,
    monthlyAiRequestLimit: 0,
    userLimit: 1,
    channels: ["whatsapp", "instagram", "facebook"],
    description: "Automatizaciones, respuestas rápidas y formularios sin APIs de IA.",
    features: { aiApi: false, limitedAiApi: false, advancedAutomations: false },
  },
  {
    key: "pro",
    name: "Pro",
    monthlyMessageLimit: 5000,
    monthlyAiRequestLimit: 150,
    userLimit: 3,
    channels: ["whatsapp", "instagram", "facebook", "messenger"],
    description: "Automatizaciones avanzadas con API limitada y controlada.",
    features: { aiApi: true, limitedAiApi: true, advancedAutomations: true },
  },
  {
    key: "business",
    name: "Business",
    monthlyMessageLimit: 15000,
    monthlyAiRequestLimit: null,
    userLimit: null,
    channels: ["whatsapp", "instagram", "facebook", "messenger"],
    description: "Acceso completo a APIs, IA e integraciones empresariales.",
    features: { aiApi: true, limitedAiApi: false, advancedAutomations: true },
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

const defaultLeadRules = {
  requiredData: "Nombre, teléfono, empresa, canal de contacto y necesidad principal.",
  qualificationQuestions:
    "¿Qué necesitas automatizar? ¿Cuántos mensajes recibes al día? ¿Cuándo quieres implementar la solución?",
  hotLead: "Compra inmediata, solicita precio, pide demo, quiere agendar llamada o tiene urgencia.",
  warmLead: "Compara opciones, pregunta beneficios, está evaluando proveedores o quiere más información.",
  handoffRules: "Pasar a humano si pide negociación, descuento, soporte sensible, queja o cierre comercial.",
};

const defaultClients = [
  {
    companyId: "inversiones-manglar",
    name: "Inversiones Manglar",
    description: "Perfil principal para pruebas de automatización y conexión con Meta.",
  },
];

const storage = {
  companies: defaultClients,
  plans: fallbackPlans,
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
  leadRules: defaultLeadRules,
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
const planSelect = document.querySelector("#planSelect");
const clientUserList = document.querySelector("#clientUserList");
const connectionGrid = document.querySelector("#connectionGrid");
const activeChannels = document.querySelector("#activeChannels");
const trainedAnswers = document.querySelector("#trainedAnswers");
const confidenceLabel = document.querySelector("#confidenceLabel");
const trainingForm = document.querySelector("#trainingForm");
const answerList = document.querySelector("#answerList");
const clearTraining = document.querySelector("#clearTraining");
const leadTrainingForm = document.querySelector("#leadTrainingForm");
const leadRuleList = document.querySelector("#leadRuleList");
const resetLeadRules = document.querySelector("#resetLeadRules");
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

function getPlan(planKey) {
  return storage.plans.find((plan) => plan.key === planKey) || storage.plans[0];
}

function formatLimit(value) {
  return value === null || value === undefined ? "sin límite fijo" : Number(value).toLocaleString("es-CO");
}

function renderClients() {
  const clients = storage.clients;
  const activeClient = storage.activeClient;
  const activePlan = getPlan(activeClient.plan || "business");

  clientSelect.innerHTML = clients
    .map(
      (client) =>
        `<option value="${escapeHTML(client.companyId)}" ${client.companyId === activeClient.companyId ? "selected" : ""}>${escapeHTML(client.name)}</option>`,
    )
    .join("");

  clientName.textContent = activeClient.name;
  clientDescription.textContent = `${activePlan.name} · ${formatLimit(activePlan.monthlyMessageLimit)} mensajes/mes · IA ${
    activePlan.features?.aiApi ? (activePlan.features?.limitedAiApi ? "limitada" : "completa") : "no incluida"
  }`;
}

function renderPlanOptions() {
  planSelect.innerHTML = [
    `<option value="">Selecciona un plan</option>`,
    ...storage.plans.map((plan) => {
      const aiLabel = plan.features?.aiApi ? (plan.features?.limitedAiApi ? "IA limitada" : "IA completa") : "sin IA";
      return `<option value="${escapeHTML(plan.key)}">${escapeHTML(plan.name)} · ${formatLimit(plan.monthlyMessageLimit)} mensajes · ${aiLabel}</option>`;
    }),
  ].join("");
}

async function renderClientUsers() {
  const users = await getJSON("/api/client-users");
  if (!users?.length) {
    clientUserList.innerHTML = `<div class="empty-state">Todavía no hay usuarios cliente.</div>`;
    return;
  }

  const companyById = new Map(storage.clients.map((company) => [company.companyId, company.name]));
  clientUserList.innerHTML = users
    .map(
      (user) => `
        <article class="client-user-item">
          <div>
            <strong>${escapeHTML(user.username)}</strong>
            <span>${escapeHTML(companyById.get(user.companyId) || user.name || user.companyId)}</span>
          </div>
          <button class="delete-user-button" type="button" data-username="${escapeHTML(user.username)}">Eliminar</button>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll(".delete-user-button").forEach((button) => {
    button.addEventListener("click", () => deleteClientUser(button.dataset.username));
  });
}

function renderConnections() {
  const connected = storage.channels;
  const plan = getPlan(storage.activeClient.plan || "business");
  const allowedChannels = new Set(plan.channels || []);

  connectionGrid.innerHTML = channels
    .map((channel) => {
      const isConnected = Boolean(connected[channel.key]);
      const isAllowed = allowedChannels.has(channel.key);
      return `
        <article class="connection-card ${isAllowed ? "" : "locked"}">
          <div class="connection-top">
            <img class="channel-dot" src="${channel.logo}" alt="${channel.name}" />
            <button class="connect-button ${isConnected ? "connected" : ""}" type="button" data-channel="${channel.key}" ${isAllowed ? "" : "disabled"}>
              ${isAllowed ? (isConnected ? "Conectado" : "Conectar") : "No incluido"}
            </button>
          </div>
          <div>
            <h3>${channel.name}</h3>
            <p>${channel.description}</p>
          </div>
          <small>${isAllowed ? channel.requirement : `Disponible al mejorar el plan. Plan actual: ${plan.name}`}</small>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".connect-button").forEach((button) => {
    button.addEventListener("click", () => toggleConnection(button.dataset.channel));
  });
}

function toggleConnection(key) {
  const plan = getPlan(storage.activeClient.plan || "business");
  if (!plan.channels?.includes(key)) {
    showToast(`Este canal no está incluido en el plan ${plan.name}.`);
    return;
  }

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

function renderLeadRules() {
  const rules = storage.leadRules;

  leadTrainingForm.requiredData.value = rules.requiredData || "";
  leadTrainingForm.qualificationQuestions.value = rules.qualificationQuestions || "";
  leadTrainingForm.hotLead.value = rules.hotLead || "";
  leadTrainingForm.warmLead.value = rules.warmLead || "";
  leadTrainingForm.handoffRules.value = rules.handoffRules || "";

  leadRuleList.innerHTML = `
    <article class="lead-rule-item">
      <span>Datos obligatorios</span>
      <p>${escapeHTML(rules.requiredData)}</p>
    </article>
    <article class="lead-rule-item hot">
      <span>Lead caliente</span>
      <p>${escapeHTML(rules.hotLead)}</p>
    </article>
    <article class="lead-rule-item warm">
      <span>Lead medio</span>
      <p>${escapeHTML(rules.warmLead)}</p>
    </article>
    <article class="lead-rule-item">
      <span>Preguntas de calificación</span>
      <p>${escapeHTML(rules.qualificationQuestions)}</p>
    </article>
    <article class="lead-rule-item">
      <span>Derivación humana</span>
      <p>${escapeHTML(rules.handoffRules)}</p>
    </article>
  `;
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
  renderPlanOptions();
  renderConnections();
  renderTraining();
  renderLeadRules();
  renderMetrics();
}

clientSelect.addEventListener("change", async () => {
  storage.activeClientId = clientSelect.value;
  await loadLeadRules();
  renderAll();
  showToast("Perfil de cliente cambiado.");
});

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(clientForm);
  const name = data.get("clientName").trim();
  const username = data.get("username").trim();
  const password = data.get("password").trim();
  const plan = data.get("plan");

  try {
    const result = await getJSON("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password, plan }),
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

leadTrainingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(leadTrainingForm);

  const rules = {
    requiredData: data.get("requiredData").trim(),
    qualificationQuestions: data.get("qualificationQuestions").trim(),
    hotLead: data.get("hotLead").trim(),
    warmLead: data.get("warmLead").trim(),
    handoffRules: data.get("handoffRules").trim(),
  };

  try {
    const result = await getJSON(`/api/lead-rules/${encodeURIComponent(storage.activeClientId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rules),
    });
    storage.leadRules = result.rules;
    renderLeadRules();
    showToast("Reglas de leads guardadas en el servidor.");
  } catch (error) {
    showToast(error.message);
  }
});

resetLeadRules.addEventListener("click", async () => {
  try {
    const result = await getJSON(`/api/lead-rules/${encodeURIComponent(storage.activeClientId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaultLeadRules),
    });
    storage.leadRules = result.rules;
    renderLeadRules();
    showToast("Reglas de leads restauradas en el servidor.");
  } catch (error) {
    showToast(error.message);
  }
});

testForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const prompt = new FormData(testForm).get("prompt");
  const match = findBestAnswer(prompt);
  const plan = getPlan(storage.activeClient.plan || "business");
  const leadRules = storage.leadRules;
  const planPrefix = plan.features?.aiApi
    ? ""
    : "Plan Start: esta respuesta sale de automatizaciones preconfiguradas, sin consumir APIs de IA. ";
  const leadHint = classifyLead(prompt, leadRules);
  botPreview.textContent = match
    ? `${planPrefix}${match.answer} ${leadHint}`
    : `${planPrefix}No encontré una respuesta entrenada para esa pregunta. ${leadHint} Recomendación: pedir ${leadRules.requiredData.toLowerCase()} y guardar esta intención en la base de conocimiento.`;
});

function classifyLead(prompt, rules) {
  const normalizedPrompt = normalize(prompt);
  const hotWords = normalize(rules.hotLead).split(/\W+/).filter((word) => word.length > 3);
  const warmWords = normalize(rules.warmLead).split(/\W+/).filter((word) => word.length > 3);
  const handoffWords = normalize(rules.handoffRules).split(/\W+/).filter((word) => word.length > 3);

  if (handoffWords.some((word) => normalizedPrompt.includes(word))) {
    return "Clasificación: derivar a humano por regla comercial.";
  }

  if (hotWords.some((word) => normalizedPrompt.includes(word))) {
    return "Clasificación: lead caliente. Priorizar seguimiento comercial.";
  }

  if (warmWords.some((word) => normalizedPrompt.includes(word))) {
    return "Clasificación: lead medio. Nutrir con preguntas de calificación.";
  }

  return "Clasificación: lead frío o sin datos suficientes.";
}

publishButton.addEventListener("click", () => {
  showToast("Cambios listos para publicar. La integración real requiere backend y app de Meta.");
});

confidenceRange.addEventListener("input", () => {
  storage.confidence = confidenceRange.value;
  renderMetrics();
});

async function init() {
  const plans = await getJSON("/api/plans");
  if (plans?.length) {
    storage.plans = plans;
  }

  const companies = await getJSON("/api/companies");
  if (companies?.length) {
    storage.clients = companies;
  }

  if (!storage.clients.some((client) => client.companyId === storage.activeClientId)) {
    storage.activeClientId = storage.clients[0].companyId;
  }

  await loadLeadRules();
  renderAll();
  await renderClientUsers();
}

async function loadLeadRules() {
  const result = await getJSON(`/api/lead-rules/${encodeURIComponent(storage.activeClientId)}`);
  storage.leadRules = result?.rules || defaultLeadRules;
}

async function deleteClientUser(username) {
  const confirmed = window.confirm(`¿Eliminar el usuario cliente "${username}"?`);
  if (!confirmed) {
    return;
  }

  try {
    await getJSON(`/api/client-users/${encodeURIComponent(username)}`, {
      method: "DELETE",
    });
    await renderClientUsers();
    showToast("Usuario cliente eliminado.");
  } catch (error) {
    showToast(error.message);
  }
}

init().catch((error) => {
  showToast(error.message || "No se pudo cargar la plataforma.");
  renderAll();
});
