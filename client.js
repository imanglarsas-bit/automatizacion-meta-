const welcomeMsg = document.querySelector("#welcomeMsg");
const statusFilter = document.querySelector("#statusFilter");
const conversationList = document.querySelector("#conversationList");
const conversationTitle = document.querySelector("#conversationTitle");
const conversationSummary = document.querySelector("#conversationSummary");
const conversationChannel = document.querySelector("#conversationChannel");
const conversationStatus = document.querySelector("#conversationStatus");
const messageThread = document.querySelector("#messageThread");
const replyForm = document.querySelector("#replyForm");
const replyButton = document.querySelector("#replyButton");
const pendingCount = document.querySelector("#pendingCount");
const answeredCount = document.querySelector("#answeredCount");
const channelCount = document.querySelector("#channelCount");
const clientPipeline = document.querySelector("#clientPipeline");
const crmTaskList = document.querySelector("#crmTaskList");
const clientLeadList = document.querySelector("#clientLeadList");
const clientLeadCount = document.querySelector("#clientLeadCount");
const salesLeadCount = document.querySelector("#salesLeadCount");
const pipelineValue = document.querySelector("#pipelineValue");
const wonValue = document.querySelector("#wonValue");
const leadSearch = document.querySelector("#leadSearch");
const leadStageFilter = document.querySelector("#leadStageFilter");
const leadDialog = document.querySelector("#leadDialog");
const leadSalesForm = document.querySelector("#leadSalesForm");
const leadDialogTitle = document.querySelector("#leadDialogTitle");
const closeLeadDialog = document.querySelector("#closeLeadDialog");
const cancelLeadDialog = document.querySelector("#cancelLeadDialog");
const supportThread = document.querySelector("#supportThread");
const supportEmpty = document.querySelector("#supportEmpty");
const supportForm = document.querySelector("#supportForm");
const supportStatusPill = document.querySelector("#supportStatusPill");
const toast = document.querySelector("#toast");

let activeCompanyId = "";
let conversations = [];
let leads = [];
let activeConversationId = "";
let supportPollTimer = null;

// ── Tabs ──────────────────────────────────────────────────────────────────────

function initTabs() {
  const tabLinks = document.querySelectorAll("nav a[data-tab]");
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

      if (target === "soporte") {
        loadSupportThread();
        startSupportPolling();
      } else {
        stopSupportPolling();
      }
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatStatus(status) {
  return status === "human_required" ? "Pendiente humano" : "Respondida";
}

function formatSender(sender) {
  const labels = { customer: "Cliente", bot: "Bot", human: "Humano", system: "Sistema" };
  return labels[sender] || sender;
}

function channelMeta(channel) {
  const key = String(channel || "").toLowerCase();
  const labels = {
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    facebook: "Facebook",
    messenger: "Messenger",
    webchat: "Chat web",
  };
  return { key, label: labels[key] || channel || "Canal" };
}

function channelBadge(channel) {
  const meta = channelMeta(channel);
  return `<span class="channel-badge ${escapeHTML(meta.key)}">${escapeHTML(meta.label)}</span>`;
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

const salesStages = [
  { key: "new", label: "Nuevo" },
  { key: "contacted", label: "Contactado" },
  { key: "qualified", label: "Calificado" },
  { key: "proposal", label: "Propuesta" },
  { key: "won", label: "Ganado" },
  { key: "lost", label: "Perdido" },
];

function stageLabel(stage) {
  return salesStages.find((item) => item.key === stage)?.label || "Nuevo";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function formatActionDate(value) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function getJSON(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    window.location.href = "/login.html";
    return null;
  }

  if (!response.ok) {
    throw new Error("No se pudo cargar la información.");
  }

  return response.json();
}

// ── Company / welcome ─────────────────────────────────────────────────────────

async function loadCompany() {
  const session = await getJSON("/api/session");
  if (!session?.companyId) return;
  const company = await getJSON(`/api/companies/${encodeURIComponent(session.companyId)}`);
  if (!company) return;
  activeCompanyId = company.companyId;
  welcomeMsg.textContent = `Bienvenido, ${company.name}`;
}

async function loadLeads() {
  const payload = await getJSON(`/api/leads/${encodeURIComponent(activeCompanyId)}`);
  leads = payload?.leads || [];
  renderSalesWorkspace();
}

function renderSalesWorkspace() {
  const openLeads = leads.filter((lead) => !["won", "lost"].includes(lead.salesStage || "new"));
  const openValue = openLeads.reduce((total, lead) => total + (Number(lead.estimatedValue) || 0), 0);
  const closedValue = leads
    .filter((lead) => lead.salesStage === "won")
    .reduce((total, lead) => total + (Number(lead.estimatedValue) || 0), 0);

  salesLeadCount.textContent = openLeads.length;
  pipelineValue.textContent = formatCurrency(openValue);
  wonValue.textContent = formatCurrency(closedValue);
  clientLeadCount.textContent = `${leads.length} lead${leads.length === 1 ? "" : "s"}`;
  renderClientCrmBoard();
  renderLeadList();
}

function getVisibleLeads() {
  const query = String(leadSearch?.value || "").trim().toLowerCase();
  const stage = leadStageFilter?.value || "all";
  return leads.filter((lead) => {
    const matchesStage = stage === "all" || (lead.salesStage || "new") === stage;
    const haystack = [lead.name, lead.business, lead.interest, lead.email, lead.phone]
      .join(" ")
      .toLowerCase();
    return matchesStage && (!query || haystack.includes(query));
  });
}

function renderLeadList() {
  const visibleLeads = getVisibleLeads();
  if (!visibleLeads.length) {
    clientLeadList.innerHTML = `<div class="empty-state">Todavía no hay leads capturados.</div>`;
    return;
  }

  clientLeadList.innerHTML = visibleLeads.map((lead) => {
    const confirmed = lead.status === "whatsapp_received";
    const stage = lead.salesStage || "new";
    return `
      <article class="client-lead-item">
        <div class="lead-identity">
          <div class="lead-status-row">
            <span class="sales-stage stage-${escapeHTML(stage)}">${escapeHTML(stageLabel(stage))}</span>
            <span class="tag ${confirmed ? "" : "warning"}">${confirmed ? "WhatsApp confirmado" : "Contacto web"}</span>
          </div>
          <strong>${escapeHTML(lead.name || "Lead sin nombre")}</strong>
          <p>${escapeHTML(lead.business || lead.interest || "Solicitud comercial")}</p>
          <small>${escapeHTML(lead.interest || "")}</small>
        </div>
        <dl class="lead-contact-data">
          <div><dt>Teléfono</dt><dd><a href="tel:${escapeHTML(lead.phone)}">${escapeHTML(lead.phone)}</a></dd></div>
          <div><dt>Correo</dt><dd><a href="mailto:${escapeHTML(lead.email)}">${escapeHTML(lead.email)}</a></dd></div>
          <div><dt>Valor</dt><dd>${escapeHTML(formatCurrency(lead.estimatedValue))}</dd></div>
          <div><dt>Responsable</dt><dd>${escapeHTML(lead.owner || "Sin asignar")}</dd></div>
        </dl>
        <div class="lead-next-action">
          <span>Próxima acción</span>
          <strong>${escapeHTML(lead.nextAction || "Contactar al lead")}</strong>
          <small>${escapeHTML(formatActionDate(lead.nextActionAt))}</small>
        </div>
        <button class="lead-edit-button" type="button" data-lead-id="${escapeHTML(lead.leadId)}">Gestionar</button>
      </article>
    `;
  }).join("");

  clientLeadList.querySelectorAll(".lead-edit-button").forEach((button) => {
    button.addEventListener("click", () => openLeadEditor(button.dataset.leadId));
  });
}

// ── Conversaciones ────────────────────────────────────────────────────────────

async function loadConversations() {
  const payload = await getJSON(`/api/conversations/${activeCompanyId}`);
  conversations = payload?.conversations || [];

  if (!activeConversationId && conversations.length) {
    activeConversationId = conversations[0].conversationId;
  }

  renderSummary();
  renderConversationList();
  await renderActiveConversation();
}

function renderSummary() {
  const pending = conversations.filter((item) => item.status === "human_required").length;
  const answered = conversations.filter((item) => item.status === "answered").length;
  pendingCount.textContent = pending;
  answeredCount.textContent = answered;
  channelCount.textContent = new Set(conversations.map((item) => item.channel)).size;
}

function renderClientCrmBoard() {
  clientPipeline.innerHTML = salesStages.map((stage) => {
    const stageLeads = leads.filter((lead) => (lead.salesStage || "new") === stage.key);
    const value = stageLeads.reduce((total, lead) => total + (Number(lead.estimatedValue) || 0), 0);
    return `
    <article class="client-stage stage-${escapeHTML(stage.key)}">
      <span>${escapeHTML(stage.label)}</span>
      <strong>${stageLeads.length}</strong>
      <small>${escapeHTML(formatCurrency(value))}</small>
    </article>
  `;
  }).join("");

  const tasks = leads
    .filter((lead) => !["won", "lost"].includes(lead.salesStage || "new"))
    .sort((a, b) => {
      if (!a.nextActionAt) return 1;
      if (!b.nextActionAt) return -1;
      return new Date(a.nextActionAt) - new Date(b.nextActionAt);
    })
    .slice(0, 5);

  if (!tasks.length) {
    crmTaskList.innerHTML = `<div class="empty-state">No hay seguimientos pendientes.</div>`;
    return;
  }

  crmTaskList.innerHTML = tasks.map((item) => `
    <button class="crm-task" type="button" data-lead-id="${escapeHTML(item.leadId)}">
      <span><strong>${escapeHTML(item.name)}</strong> <span class="sales-stage stage-${escapeHTML(item.salesStage || "new")}">${escapeHTML(stageLabel(item.salesStage || "new"))}</span></span>
      <small>${escapeHTML(item.nextAction || "Contactar al lead")} · ${escapeHTML(formatActionDate(item.nextActionAt))}</small>
    </button>
  `).join("");

  crmTaskList.querySelectorAll(".crm-task").forEach((button) => {
    button.addEventListener("click", () => openLeadEditor(button.dataset.leadId));
  });
}

function openLeadEditor(leadId) {
  const lead = leads.find((item) => item.leadId === leadId);
  if (!lead) return;
  leadDialogTitle.textContent = lead.name || "Editar oportunidad";
  leadSalesForm.elements.leadId.value = lead.leadId;
  leadSalesForm.elements.salesStage.value = lead.salesStage || "new";
  leadSalesForm.elements.estimatedValue.value = lead.estimatedValue || "";
  leadSalesForm.elements.owner.value = lead.owner || "";
  leadSalesForm.elements.nextAction.value = lead.nextAction || "";
  leadSalesForm.elements.nextActionAt.value = toLocalDateTime(lead.nextActionAt);
  leadSalesForm.elements.notes.value = lead.notes || "";
  leadDialog.showModal();
}

function renderConversationList() {
  const filter = statusFilter.value;
  const visible = conversations.filter((item) => filter === "all" || item.status === filter);

  if (!visible.length) {
    conversationList.innerHTML = `<div class="empty-state">No hay conversaciones para este filtro.</div>`;
    return;
  }

  conversationList.innerHTML = visible
    .map(
      (conversation) => `
        <button class="conversation-card ${conversation.conversationId === activeConversationId ? "active" : ""}" type="button" data-id="${escapeHTML(conversation.conversationId)}">
          <strong>${escapeHTML(conversation.customerName)}</strong>
          <p>${escapeHTML(conversation.summary)}</p>
          <div class="meta-row">
            ${channelBadge(conversation.channel)}
            <span class="tag">${escapeHTML(conversation.unit)}</span>
            <span class="tag ${conversation.status === "human_required" ? "warning" : ""}">${formatStatus(conversation.status)}</span>
          </div>
        </button>
      `,
    )
    .join("");

  document.querySelectorAll(".conversation-card").forEach((button) => {
    button.addEventListener("click", async () => {
      activeConversationId = button.dataset.id;
      renderConversationList();
      await renderActiveConversation();
    });
  });
}

async function renderActiveConversation() {
  if (!activeConversationId) {
    conversationTitle.textContent = "Selecciona un caso";
    conversationSummary.textContent = "Elige una conversación de la bandeja para ver el historial y responder.";
    messageThread.innerHTML = "";
    replyForm.hidden = true;
    return;
  }

  const conversation = await getJSON(`/api/messages/${activeCompanyId}/${activeConversationId}`);
  if (!conversation) return;

  conversationTitle.textContent = conversation.customerName;
  conversationSummary.textContent = conversation.summary;
  const meta = channelMeta(conversation.channel);
  conversationChannel.innerHTML = `${channelBadge(conversation.channel)} <span>${escapeHTML(conversation.unit)}</span>`;
  conversationStatus.textContent = formatStatus(conversation.status);
  conversationStatus.classList.toggle("warning", conversation.status === "human_required");
  replyButton.textContent = `Enviar por ${meta.label}`;
  replyForm.hidden = conversation.channel === "webchat";

  messageThread.innerHTML = conversation.messages
    .map(
      (message) => `
        <article class="message ${escapeHTML(message.sender)}">
          <small>${formatSender(message.sender)}</small>
          <p>${escapeHTML(message.text)}</p>
        </article>
      `,
    )
    .join("");
}

statusFilter.addEventListener("change", () => {
  renderConversationList();
});

replyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(replyForm);
  const reply = data.get("reply").trim();
  if (!reply || !activeConversationId) return;

  await getJSON(`/api/messages/${activeCompanyId}/${activeConversationId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reply }),
  });

  replyForm.reset();
  showToast("Respuesta enviada desde la plataforma.");
  await loadConversations();
});

leadSearch?.addEventListener("input", renderLeadList);
leadStageFilter?.addEventListener("change", renderLeadList);
closeLeadDialog?.addEventListener("click", () => leadDialog.close());
cancelLeadDialog?.addEventListener("click", () => leadDialog.close());

leadSalesForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(leadSalesForm);
  const leadId = data.get("leadId");

  try {
    await getJSON(`/api/leads/${encodeURIComponent(activeCompanyId)}/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salesStage: data.get("salesStage"),
        estimatedValue: Number(data.get("estimatedValue") || 0),
        owner: data.get("owner"),
        nextAction: data.get("nextAction"),
        nextActionAt: data.get("nextActionAt")
          ? new Date(data.get("nextActionAt")).toISOString()
          : "",
        notes: data.get("notes"),
      }),
    });
    leadDialog.close();
    await loadLeads();
    showToast("Oportunidad comercial actualizada.");
  } catch (error) {
    showToast(error.message);
  }
});

// ── Soporte interno ───────────────────────────────────────────────────────────

async function loadSupportThread() {
  const ticket = await getJSON("/api/support/client");

  if (!ticket || !ticket.messages?.length) {
    supportEmpty.hidden = false;
    supportStatusPill.textContent = "Sin mensajes";
    supportThread.innerHTML = "";
    supportThread.appendChild(supportEmpty);
    return;
  }

  supportEmpty.hidden = true;
  supportStatusPill.textContent = ticket.status === "answered" ? "Respondido" : "Pendiente";
  supportStatusPill.className = `support-status-pill ${ticket.status === "answered" ? "answered" : "open"}`;

  supportThread.innerHTML = ticket.messages
    .map(
      (msg) => `
        <article class="message ${msg.sender === "admin" ? "human" : "customer"}">
          <small>${msg.sender === "admin" ? "iDIGITAL" : "Tú"} · ${formatTime(msg.at)}</small>
          <p>${escapeHTML(msg.text)}</p>
        </article>
      `,
    )
    .join("");

  supportThread.scrollTop = supportThread.scrollHeight;
}

supportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(supportForm);
  const text = data.get("text").trim();
  if (!text) return;

  try {
    await getJSON("/api/support/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    supportForm.reset();
    await loadSupportThread();
  } catch (error) {
    showToast(error.message);
  }
});

function startSupportPolling() {
  stopSupportPolling();
  supportPollTimer = setInterval(loadSupportThread, 10000);
}

function stopSupportPolling() {
  clearInterval(supportPollTimer);
  supportPollTimer = null;
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  initTabs();
  await loadCompany();
  await loadLeads();
  await loadConversations();
}

init().catch(() => {
  showToast("No se pudo cargar el portal del cliente.");
});
