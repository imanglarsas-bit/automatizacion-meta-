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
  funnels: [
    {
      id: "default-demo",
      name: "Solicitud de demo",
      trigger: "demo, asesoría, llamada, reunión, agendar",
      action: "human",
      priority: "alta",
      response: "Gracias. Te conecto con un asesor para coordinar la demo y avanzar con tu solicitud.",
    },
  ],
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
  settings: {
    channels: {},
    training: defaultTraining,
    confidence: 75,
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
    return this.settings.channels || {};
  },
  set channels(value) {
    this.settings = { ...this.settings, channels: value || {} };
  },
  get training() {
    return this.settings.training || defaultTraining;
  },
  set training(value) {
    this.settings = { ...this.settings, training: value || [] };
  },
  leadRules: defaultLeadRules,
  get confidence() {
    return Number(this.settings.confidence || 75);
  },
  set confidence(value) {
    this.settings = { ...this.settings, confidence: Number(value) || 75 };
  },
};

const planEditorGrid = document.querySelector("#planEditorGrid");
const subscriptionList = document.querySelector("#subscriptionList");
const clientSelect = document.querySelector("#clientSelect");
const clientName = document.querySelector("#clientName");
const clientDescription = document.querySelector("#clientDescription");
const clientForm = document.querySelector("#clientForm");
const planSelect = document.querySelector("#planSelect");
const clientUserList = document.querySelector("#clientUserList");
const connectionGrid = document.querySelector("#connectionGrid");
const metaRoutingForm = document.querySelector("#metaRoutingForm");
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
const liveMetaTestForm = document.querySelector("#liveMetaTestForm");
const liveMetaPreview = document.querySelector("#liveMetaPreview");
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
  const metaConnections = storage.settings.metaConnections || {};
  const activeMeta = storage.activeClient.meta || {};
  const plan = getPlan(storage.activeClient.plan || "business");
  const allowedChannels = new Set(plan.channels || []);

  metaRoutingForm.whatsappPhoneNumberIds.value = (activeMeta.whatsappPhoneNumberIds || []).join(", ");
  metaRoutingForm.instagramAccountIds.value = (activeMeta.instagramAccountIds || []).join(", ");
  metaRoutingForm.facebookPageIds.value = (activeMeta.facebookPageIds || []).join(", ");

  connectionGrid.innerHTML = channels
    .map((channel) => {
      const isConnected = Boolean(connected[channel.key]);
      const metaStatus = metaConnections[channel.key]?.status;
      const isAllowed = allowedChannels.has(channel.key);
      const buttonText = metaStatus === "connected" || isConnected ? "Actualizar conexión" : "Conectar con Meta";
      const statusText = metaStatus === "connected"
        ? "Autorizado por Meta"
        : isConnected
          ? "Marcado como conectado"
          : channel.requirement;
      return `
        <article class="connection-card ${isAllowed ? "" : "locked"}">
          <div class="connection-top">
            <img class="channel-dot" src="${channel.logo}" alt="${channel.name}" />
            <button class="connect-button ${isConnected ? "connected" : ""}" type="button" data-channel="${channel.key}" ${isAllowed ? "" : "disabled"}>
              ${isAllowed ? buttonText : "No incluido"}
            </button>
          </div>
          <div>
            <h3>${channel.name}</h3>
            <p>${channel.description}</p>
          </div>
          <small>${isAllowed ? statusText : `Disponible al mejorar el plan. Plan actual: ${plan.name}`}</small>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".connect-button").forEach((button) => {
    button.addEventListener("click", () => {
      const channel = button.dataset.channel;
      startMetaConnection(channel);
    });
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
  saveCompanySettings({ channels: connected })
    .then(() => showToast(connected[key] ? "Canal guardado como conectado." : "Canal desactivado y guardado."))
    .catch((error) => showToast(error.message));
}

async function startMetaConnection(key) {
  const plan = getPlan(storage.activeClient.plan || "business");
  if (!plan.channels?.includes(key)) {
    showToast(`Este canal no está incluido en el plan ${plan.name}.`);
    return;
  }

  const query = new URLSearchParams({
    companyId: storage.activeClient.companyId,
    channel: key,
  });

  try {
    const result = await getJSON(`/api/meta/connect-url?${query.toString()}`);
    if (!result?.connectUrl) return;

    window.open(result.connectUrl, "meta-connect", "width=760,height=760,noopener,noreferrer");
    showToast("Abrimos Meta para autorizar la conexión.");
  } catch (error) {
    showToast(error.message);
  }
}

metaRoutingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(metaRoutingForm);
  const payload = {
    whatsappPhoneNumberIds: splitIds(data.get("whatsappPhoneNumberIds")),
    instagramAccountIds: splitIds(data.get("instagramAccountIds")),
    facebookPageIds: splitIds(data.get("facebookPageIds")),
  };

  try {
    const updated = await getJSON(`/api/companies/${encodeURIComponent(storage.activeClientId)}/meta`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const index = storage.clients.findIndex((client) => client.companyId === updated.companyId);
    if (index >= 0) {
      storage.clients[index] = updated;
    }
    renderClients();
    renderConnections();
    showToast("IDs de Meta guardados para este cliente.");
  } catch (error) {
    showToast(error.message);
  }
});

function splitIds(value) {
  return String(value || "")
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
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
    <div class="funnel-list">
      ${(rules.funnels || []).map((funnel) => `
        <article class="funnel-item ${escapeHTML(funnel.priority)}">
          <div>
            <strong>${escapeHTML(funnel.name)}</strong>
            <span>${funnel.action === "human" ? "Envía a humano" : "Respuesta automática"} · prioridad ${escapeHTML(funnel.priority)}</span>
          </div>
          <p>${escapeHTML(funnel.trigger)}</p>
          ${funnel.response ? `<small>${escapeHTML(funnel.response)}</small>` : ""}
          ${funnel.options?.length ? `
            <ol class="funnel-options">
              ${funnel.options.map((option) => `
                <li>
                  <strong>${escapeHTML(option.number)}. ${escapeHTML(option.label)}</strong>
                  <span>${option.nextFunnelId ? "Abre otro menú" : option.action === "human" ? "Pasa a humano" : "Respuesta automática"}</span>
                </li>
              `).join("")}
            </ol>
          ` : ""}
          <button class="delete-funnel" type="button" data-id="${escapeHTML(funnel.id)}">Eliminar embudo</button>
        </article>
      `).join("") || `<div class="empty-state">Todavía no hay embudos configurados.</div>`}
    </div>
  `;

  leadRuleList.querySelectorAll(".delete-funnel").forEach((button) => {
    button.addEventListener("click", () => deleteFunnel(button.dataset.id));
  });
}

const PLAN_BADGE = {
  start: { label: "Start", cls: "badge-start" },
  pro: { label: "Pro", cls: "badge-pro" },
  business: { label: "Business", cls: "badge-business" },
};

function planBadge(planKey) {
  const p = PLAN_BADGE[planKey] || { label: planKey, cls: "badge-start" };
  return `<span class="plan-badge ${p.cls}">${escapeHTML(p.label)}</span>`;
}

function renderSubscriptions() {
  if (!subscriptionList) return;
  const companies = storage.clients;
  const plans = storage.plans;

  if (!companies.length) {
    subscriptionList.innerHTML = `<div class="empty-state">No hay clientes registrados.</div>`;
    return;
  }

  subscriptionList.innerHTML = companies.map((company) => {
    const plan = plans.find((p) => p.key === company.plan) || plans[0];
    const featureList = [
      plan?.features?.aiApi ? "IA completa" : null,
      plan?.features?.limitedAiApi ? "IA limitada" : null,
      plan?.features?.advancedAutomations ? "Automatizaciones avanzadas" : null,
      plan?.features?.businessDashboard ? "Dashboard empresarial" : null,
      plan?.features?.multiUser ? "Múltiples usuarios" : null,
    ].filter(Boolean);

    return `
      <article class="subscription-card" data-company-id="${escapeHTML(company.companyId)}">
        <div class="subscription-main">
          <div class="subscription-info">
            <strong class="subscription-name">${escapeHTML(company.name)}</strong>
            <span class="subscription-meta">${escapeHTML(company.contact?.email || company.companyId)}</span>
            <div class="subscription-features">
              ${featureList.map((f) => `<span class="feature-pill">${escapeHTML(f)}</span>`).join("")}
              <span class="feature-pill limit">${formatLimit(plan?.monthlyMessageLimit)} mensajes/mes</span>
            </div>
          </div>
          <div class="subscription-status-col">
            ${planBadge(company.plan || "start")}
            <span class="status-dot ${company.active ? "active" : "inactive"}">${company.active ? "Activo" : "Inactivo"}</span>
            ${company.planUpdatedAt ? `<span class="subscription-date">Actualizado ${new Date(company.planUpdatedAt).toLocaleDateString("es-CO")}</span>` : ""}
          </div>
          <div class="subscription-actions">
            <button class="ghost-button change-plan-btn" type="button" data-company-id="${escapeHTML(company.companyId)}">
              Cambiar plan
            </button>
          </div>
        </div>
        <div class="plan-changer" id="changer-${escapeHTML(company.companyId)}" hidden>
          <div class="plan-changer-inner">
            <label class="plan-changer-label">
              Nuevo plan
              <select class="plan-changer-select" data-company-id="${escapeHTML(company.companyId)}">
                ${plans.map((p) => `<option value="${escapeHTML(p.key)}" ${p.key === company.plan ? "selected" : ""}>${escapeHTML(p.name)} · ${formatLimit(p.monthlyMessageLimit)} mensajes/mes</option>`).join("")}
              </select>
            </label>
            <div class="plan-changer-preview" id="preview-${escapeHTML(company.companyId)}">
              ${buildPlanPreview(plan)}
            </div>
            <div class="plan-changer-actions">
              <button class="solid-button apply-plan-btn" type="button" data-company-id="${escapeHTML(company.companyId)}">Aplicar cambio</button>
              <button class="ghost-button cancel-plan-btn" type="button" data-company-id="${escapeHTML(company.companyId)}">Cancelar</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  subscriptionList.querySelectorAll(".change-plan-btn").forEach((btn) => {
    btn.addEventListener("click", () => togglePlanChanger(btn.dataset.companyId));
  });

  subscriptionList.querySelectorAll(".cancel-plan-btn").forEach((btn) => {
    btn.addEventListener("click", () => togglePlanChanger(btn.dataset.companyId, false));
  });

  subscriptionList.querySelectorAll(".plan-changer-select").forEach((select) => {
    select.addEventListener("change", () => {
      const plan = storage.plans.find((p) => p.key === select.value);
      const preview = document.querySelector(`#preview-${select.dataset.companyId}`);
      if (preview && plan) preview.innerHTML = buildPlanPreview(plan);
    });
  });

  subscriptionList.querySelectorAll(".apply-plan-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyPlanChange(btn.dataset.companyId));
  });
}

function buildPlanPreview(plan) {
  if (!plan) return "";
  const features = [
    { key: "aiApi", label: "IA completa" },
    { key: "limitedAiApi", label: "IA limitada" },
    { key: "advancedAutomations", label: "Automatizaciones avanzadas" },
    { key: "advancedIntegrations", label: "Integraciones avanzadas" },
    { key: "businessDashboard", label: "Dashboard empresarial" },
    { key: "multiUser", label: "Múltiples usuarios" },
  ];
  return `
    <div class="plan-preview-grid">
      <div class="plan-preview-limits">
        <span>Mensajes/mes: <strong>${formatLimit(plan.monthlyMessageLimit)}</strong></span>
        <span>Solicitudes IA/mes: <strong>${plan.monthlyAiRequestLimit === null ? "sin límite" : plan.monthlyAiRequestLimit || "No incluido"}</strong></span>
        <span>Usuarios: <strong>${formatLimit(plan.userLimit)}</strong></span>
      </div>
      <div class="plan-preview-features">
        ${features.map((f) => `
          <span class="preview-feature ${plan.features?.[f.key] ? "on" : "off"}">
            ${plan.features?.[f.key] ? "✓" : "✗"} ${escapeHTML(f.label)}
          </span>
        `).join("")}
      </div>
    </div>
  `;
}

function togglePlanChanger(companyId, forceState) {
  const changer = document.querySelector(`#changer-${companyId}`);
  if (!changer) return;
  const isHidden = changer.hidden;
  const next = forceState !== undefined ? !forceState : isHidden;
  changer.hidden = !next;
}

async function applyPlanChange(companyId) {
  const select = subscriptionList.querySelector(`.plan-changer-select[data-company-id="${companyId}"]`);
  if (!select) return;
  const newPlanKey = select.value;

  try {
    const updated = await getJSON(`/api/companies/${encodeURIComponent(companyId)}/plan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: newPlanKey }),
    });

    const idx = storage.clients.findIndex((c) => c.companyId === companyId);
    if (idx !== -1) storage.clients[idx] = { ...storage.clients[idx], ...updated };

    renderSubscriptions();
    renderClients();
    renderPlanOptions();
    renderConnections();

    const planName = storage.plans.find((p) => p.key === newPlanKey)?.name || newPlanKey;
    showToast(`Plan de ${updated.name} cambiado a ${planName}.`);
  } catch (error) {
    showToast(error.message);
  }
}

const FEATURE_LABELS = {
  aiApi: "IA completa (API)",
  limitedAiApi: "IA limitada",
  advancedAutomations: "Automatizaciones avanzadas",
  advancedIntegrations: "Integraciones avanzadas",
  businessDashboard: "Dashboard empresarial",
  multiUser: "Múltiples usuarios",
};

function renderPlanEditor() {
  if (!planEditorGrid) return;

  planEditorGrid.innerHTML = storage.plans
    .map((plan) => `
      <article class="plan-editor-card">
        <form class="plan-editor-form" data-plan-key="${escapeHTML(plan.key)}">
          <h3>${escapeHTML(plan.name)}</h3>
          <label>
            Nombre del plan
            <input name="name" type="text" value="${escapeHTML(plan.name)}" required />
          </label>
          <label>
            Descripción
            <textarea name="description" rows="2">${escapeHTML(plan.description || "")}</textarea>
          </label>
          <div class="form-row">
            <label>
              Mensajes/mes
              <input name="monthlyMessageLimit" type="number" min="0" value="${plan.monthlyMessageLimit ?? ""}" placeholder="sin límite" />
            </label>
            <label>
              Solicitudes IA/mes
              <input name="monthlyAiRequestLimit" type="number" min="0" value="${plan.monthlyAiRequestLimit ?? ""}" placeholder="sin límite" />
            </label>
          </div>
          <label>
            Usuarios máximos
            <input name="userLimit" type="number" min="1" value="${plan.userLimit ?? ""}" placeholder="sin límite" />
          </label>
          <fieldset class="feature-checks">
            <legend>Funciones incluidas</legend>
            ${Object.entries(FEATURE_LABELS).map(([key, label]) => `
              <label class="check-row">
                <input type="checkbox" name="feature_${key}" ${plan.features?.[key] ? "checked" : ""} />
                ${escapeHTML(label)}
              </label>
            `).join("")}
          </fieldset>
          <button class="solid-button full" type="submit">Guardar plan ${escapeHTML(plan.name)}</button>
        </form>
      </article>
    `)
    .join("");

  planEditorGrid.querySelectorAll(".plan-editor-form").forEach((form) => {
    form.addEventListener("submit", handlePlanFormSubmit);
  });
}

async function handlePlanFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const planKey = form.dataset.planKey;
  const data = new FormData(form);

  const features = {};
  Object.keys(FEATURE_LABELS).forEach((key) => {
    features[key] = form.querySelector(`[name="feature_${key}"]`)?.checked || false;
  });

  const payload = {
    name: data.get("name").trim(),
    description: data.get("description").trim(),
    monthlyMessageLimit: data.get("monthlyMessageLimit") || null,
    monthlyAiRequestLimit: data.get("monthlyAiRequestLimit") || null,
    userLimit: data.get("userLimit") || null,
    features,
  };

  try {
    const updated = await getJSON(`/api/plans/${encodeURIComponent(planKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const idx = storage.plans.findIndex((p) => p.key === planKey);
    if (idx !== -1) storage.plans[idx] = updated;
    renderPlanEditor();
    renderPlanOptions();
    showToast(`Plan ${updated.name} guardado.`);
  } catch (error) {
    showToast(error.message);
  }
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
  renderSubscriptions();
  renderPlanEditor();
  renderConnections();
  renderTraining();
  renderLeadRules();
  renderMetrics();
}

clientSelect.addEventListener("change", async () => {
  storage.activeClientId = clientSelect.value;
  await loadCompanySettings();
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
    storage.settings = {
      channels: {},
      training: defaultTraining,
      confidence: 75,
    };
    await saveCompanySettings(storage.settings);
    await loadLeadRules();
    clientForm.reset();
    renderAll();
    showToast(`Cliente creado. Usuario: ${result.user.username}`);
  } catch (error) {
    showToast(error.message);
  }
});

async function deleteTraining(id) {
  const training = storage.training.filter((item) => item.id !== id);
  storage.training = training;
  renderAll();
  try {
    await saveCompanySettings({ training });
    showToast("Entrenamiento eliminado y guardado.");
  } catch (error) {
    showToast(error.message);
  }
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

trainingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(trainingForm);
  const nextTraining = {
    id: createId(),
    question: data.get("question").trim(),
    answer: data.get("answer").trim(),
    category: data.get("category"),
    channel: data.get("channel"),
  };

  const training = [nextTraining, ...storage.training];
  storage.training = training;

  try {
    await saveCompanySettings({ training });
    trainingForm.reset();
    renderAll();
    showToast("Respuesta añadida y guardada en el servidor.");
  } catch (error) {
    showToast(error.message);
  }
});

clearTraining.addEventListener("click", async () => {
  storage.training = [];
  renderAll();
  try {
    await saveCompanySettings({ training: [] });
    showToast("Base de conocimiento limpiada y guardada.");
  } catch (error) {
    showToast(error.message);
  }
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
    funnels: [...(storage.leadRules.funnels || [])],
  };

  const funnelName = data.get("funnelName").trim();
  const funnelTrigger = data.get("funnelTrigger").trim();
  if (funnelName && funnelTrigger) {
    rules.funnels.unshift({
      id: createId(),
      name: funnelName,
      trigger: funnelTrigger,
      action: data.get("funnelAction"),
      priority: data.get("funnelPriority"),
      response: data.get("funnelResponse").trim(),
    });
  }

  try {
    const result = await getJSON(`/api/lead-rules/${encodeURIComponent(storage.activeClientId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rules),
    });
    storage.leadRules = result.rules;
    leadTrainingForm.funnelName.value = "";
    leadTrainingForm.funnelTrigger.value = "";
    leadTrainingForm.funnelResponse.value = "";
    renderLeadRules();
    showToast("Reglas de leads guardadas en el servidor.");
  } catch (error) {
    showToast(error.message);
  }
});

async function deleteFunnel(funnelId) {
  const rules = {
    ...storage.leadRules,
    funnels: (storage.leadRules.funnels || []).filter((funnel) => funnel.id !== funnelId),
  };

  try {
    const result = await getJSON(`/api/lead-rules/${encodeURIComponent(storage.activeClientId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rules),
    });
    storage.leadRules = result.rules;
    renderLeadRules();
    showToast("Embudo eliminado.");
  } catch (error) {
    showToast(error.message);
  }
}

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
  const funnelHint = matchFunnel(prompt, leadRules);
  botPreview.textContent = match
    ? `${planPrefix}${match.answer} ${leadHint} ${funnelHint}`
    : `${planPrefix}No encontré una respuesta entrenada para esa pregunta. ${leadHint} ${funnelHint} Recomendación: pedir ${leadRules.requiredData.toLowerCase()} y guardar esta intención en la base de conocimiento.`;
});

liveMetaTestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(liveMetaTestForm);
  const to = String(formData.get("to") || "").trim();
  const text = String(formData.get("text") || "").trim();
  const mode = String(formData.get("mode") || "template").trim();

  liveMetaPreview.textContent = "Enviando mensaje por Meta...";

  try {
    const result = await getJSON("/api/meta/send-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: storage.activeClientId, channel: "whatsapp", to, text, mode }),
    });

    const messageId = result?.meta?.messages?.[0]?.id;
    liveMetaPreview.textContent = messageId
      ? `Mensaje enviado correctamente. ID Meta: ${messageId}`
      : "Mensaje procesado. Revisa WhatsApp y los logs si no llega.";
    showToast("Prueba enviada por WhatsApp.");
  } catch (error) {
    liveMetaPreview.textContent = error.message;
    showToast(error.message);
  }
});

function matchFunnel(prompt, rules) {
  const normalizedPrompt = normalize(prompt);
  const funnel = (rules.funnels || []).find((item) =>
    item.trigger
      .split(/[,;\n]+/)
      .map((keyword) => normalize(keyword).trim())
      .filter(Boolean)
      .some((keyword) => normalizedPrompt.includes(keyword)),
  );

  if (!funnel) {
    return "Embudo: sin coincidencia.";
  }

  return funnel.action === "human"
    ? `Embudo: ${funnel.name}. Acción: enviar directamente a humano.`
    : `Embudo: ${funnel.name}. Acción: continuar respuesta automática.`;
}

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

if (publishButton) {
  publishButton.addEventListener("click", () => {
    showToast("Las configuraciones del panel se guardan automáticamente en el servidor.");
  });
}

confidenceRange.addEventListener("input", () => {
  storage.confidence = confidenceRange.value;
  renderMetrics();
  queueCompanySettingsSave({ confidence: storage.confidence });
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

  await loadCompanySettings();
  await loadLeadRules();
  renderAll();
  await renderClientUsers();
}

async function loadCompanySettings() {
  const result = await getJSON(`/api/company-settings/${encodeURIComponent(storage.activeClientId)}`);
  storage.settings = result?.settings || {
    channels: {},
    training: defaultTraining,
    confidence: 75,
  };
}

async function saveCompanySettings(patch) {
  const result = await getJSON(`/api/company-settings/${encodeURIComponent(storage.activeClientId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...storage.settings,
      ...patch,
    }),
  });

  storage.settings = result?.settings || storage.settings;
  return storage.settings;
}

function queueCompanySettingsSave(patch) {
  window.clearTimeout(queueCompanySettingsSave.timer);
  queueCompanySettingsSave.timer = window.setTimeout(async () => {
    try {
      await saveCompanySettings(patch);
      showToast("Configuración guardada.");
    } catch (error) {
      showToast(error.message);
    }
  }, 450);
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

function initTabs() {
  const tabLinks = document.querySelectorAll(".side-nav a[data-tab]");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.dataset.tab;
      tabPanes.forEach((pane) => { pane.hidden = true; });
      const pane = document.querySelector(`.tab-pane[data-pane="${target}"]`);
      if (pane) pane.hidden = false;
      tabLinks.forEach((a) => a.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

initTabs();

init().catch((error) => {
  showToast(error.message || "No se pudo cargar la plataforma.");
  renderAll();
});
