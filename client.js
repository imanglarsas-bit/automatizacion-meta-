const companySelect = document.querySelector("#companySelect");
const statusFilter = document.querySelector("#statusFilter");
const conversationList = document.querySelector("#conversationList");
const conversationTitle = document.querySelector("#conversationTitle");
const conversationSummary = document.querySelector("#conversationSummary");
const conversationChannel = document.querySelector("#conversationChannel");
const conversationStatus = document.querySelector("#conversationStatus");
const messageThread = document.querySelector("#messageThread");
const replyForm = document.querySelector("#replyForm");
const pendingCount = document.querySelector("#pendingCount");
const answeredCount = document.querySelector("#answeredCount");
const channelCount = document.querySelector("#channelCount");
const toast = document.querySelector("#toast");

let companies = [];
let conversations = [];
let activeCompanyId = localStorage.getItem("r360_client_company") || "";
let activeConversationId = "";

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
  const labels = {
    customer: "Cliente",
    bot: "Bot",
    human: "Humano",
    system: "Sistema",
  };
  return labels[sender] || sender;
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

async function loadCompanies() {
  companies = await getJSON("/api/companies");
  if (!companies?.length) {
    return;
  }

  if (!activeCompanyId) {
    activeCompanyId = companies[0].companyId;
  }

  companySelect.innerHTML = companies
    .map(
      (company) =>
        `<option value="${escapeHTML(company.companyId)}" ${company.companyId === activeCompanyId ? "selected" : ""}>${escapeHTML(company.name)}</option>`,
    )
    .join("");
}

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
  pendingCount.textContent = conversations.filter((item) => item.status === "human_required").length;
  answeredCount.textContent = conversations.filter((item) => item.status === "answered").length;
  channelCount.textContent = new Set(conversations.map((item) => item.channel)).size;
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
            <span class="tag">${escapeHTML(conversation.channel)}</span>
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
  if (!conversation) {
    return;
  }

  conversationTitle.textContent = conversation.customerName;
  conversationSummary.textContent = conversation.summary;
  conversationChannel.textContent = `${conversation.channel} · ${conversation.unit}`;
  conversationStatus.textContent = formatStatus(conversation.status);
  conversationStatus.classList.toggle("warning", conversation.status === "human_required");
  replyForm.hidden = false;

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

companySelect.addEventListener("change", async () => {
  activeCompanyId = companySelect.value;
  localStorage.setItem("r360_client_company", activeCompanyId);
  activeConversationId = "";
  await loadConversations();
});

statusFilter.addEventListener("change", () => {
  renderConversationList();
});

replyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(replyForm);
  const reply = data.get("reply").trim();
  if (!reply || !activeConversationId) {
    return;
  }

  await getJSON(`/api/messages/${activeCompanyId}/${activeConversationId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reply }),
  });

  replyForm.reset();
  showToast("Respuesta enviada desde la plataforma.");
  await loadConversations();
});

async function init() {
  await loadCompanies();
  await loadConversations();
}

init().catch(() => {
  showToast("No se pudo cargar el portal del cliente.");
});
