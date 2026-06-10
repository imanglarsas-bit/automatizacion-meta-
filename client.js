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
const supportThread = document.querySelector("#supportThread");
const supportEmpty = document.querySelector("#supportEmpty");
const supportForm = document.querySelector("#supportForm");
const supportStatusPill = document.querySelector("#supportStatusPill");
const toast = document.querySelector("#toast");

let activeCompanyId = "";
let conversations = [];
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
  const leads = payload?.leads || [];
  clientLeadCount.textContent = `${leads.length} lead${leads.length === 1 ? "" : "s"}`;

  if (!leads.length) {
    clientLeadList.innerHTML = `<div class="empty-state">Todavía no hay leads capturados.</div>`;
    return;
  }

  clientLeadList.innerHTML = leads.map((lead) => {
    const confirmed = lead.status === "whatsapp_received";
    return `
      <article class="client-lead-item">
        <div>
          <span class="tag ${confirmed ? "" : "warning"}">${confirmed ? "Recibido por WhatsApp" : "Esperando WhatsApp"}</span>
          <strong>${escapeHTML(lead.name)}</strong>
          <p>${escapeHTML(lead.interest || "Solicitud comercial")}</p>
        </div>
        <dl>
          <div><dt>Teléfono</dt><dd><a href="tel:${escapeHTML(lead.phone)}">${escapeHTML(lead.phone)}</a></dd></div>
          <div><dt>Correo</dt><dd><a href="mailto:${escapeHTML(lead.email)}">${escapeHTML(lead.email)}</a></dd></div>
          <div><dt>Ciudad</dt><dd>${escapeHTML(lead.city)}</dd></div>
          <div><dt>Empresa</dt><dd>${escapeHTML(lead.business || "No indicada")}</dd></div>
        </dl>
      </article>
    `;
  }).join("");
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
  renderClientCrmBoard({ pending, answered });
}

function renderClientCrmBoard({ pending, answered }) {
  const highPriority = conversations.filter((item) => item.priority === "alta").length;
  const channels = new Set(conversations.map((item) => item.channel)).size;

  clientPipeline.innerHTML = [
    { label: "Nuevos / pendientes", value: pending, note: "requieren respuesta humana" },
    { label: "Alta prioridad", value: highPriority, note: "atender primero" },
    { label: "Respondidos", value: answered, note: "cerrados o gestionados" },
    { label: "Canales activos", value: channels, note: "fuentes de conversación" },
  ].map((item) => `
    <article class="client-stage">
      <span>${escapeHTML(item.label)}</span>
      <strong>${item.value}</strong>
      <small>${escapeHTML(item.note)}</small>
    </article>
  `).join("");

  const tasks = conversations
    .filter((item) => item.status === "human_required")
    .sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority))
    .slice(0, 4);

  if (!tasks.length) {
    crmTaskList.innerHTML = `<div class="empty-state">No hay tareas pendientes por ahora.</div>`;
    return;
  }

  crmTaskList.innerHTML = tasks.map((item) => `
    <button class="crm-task" type="button" data-id="${escapeHTML(item.conversationId)}">
      <span>${channelBadge(item.channel)} <strong>${escapeHTML(item.customerName)}</strong></span>
      <small>${escapeHTML(item.summary)}</small>
    </button>
  `).join("");

  crmTaskList.querySelectorAll(".crm-task").forEach((button) => {
    button.addEventListener("click", async () => {
      activeConversationId = button.dataset.id;
      renderConversationList();
      await renderActiveConversation();
      document.querySelector("#conversacion")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function priorityScore(priority) {
  return { alta: 3, media: 2, baja: 1 }[priority] || 0;
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
