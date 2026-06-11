/* ═══════════════════════════════════════════════════════════════════════
   iDIGITAL — Admin Conversations Inbox
   Muestra SOLO las conversaciones del cliente activo seleccionado en el
   header (clientSelect), igual que el resto de secciones del panel admin.
   NO modifica platform.js ni endpoints existentes.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ── DOM refs ─────────────────────────────────────────────────────── */
  const inboxList          = document.getElementById("inboxList");
  const inboxSearch        = document.getElementById("inboxSearch");
  const inboxChannelFilters= document.getElementById("inboxChannelFilters");
  const inboxChatHeader    = document.getElementById("inboxChatHeader");
  const inboxMessages      = document.getElementById("inboxMessages");
  const inboxReplyForm     = document.getElementById("inboxReplyForm");
  const inboxReplyBtn      = document.getElementById("inboxReplyBtn");
  const inboxReplyChannel  = document.getElementById("inboxReplyChannel");
  const inboxProfile       = document.getElementById("inboxProfile");
  const clientSelect       = document.getElementById("clientSelect");   // from platform.js

  if (!inboxList) return;

  /* ── State ────────────────────────────────────────────────────────── */
  let allConversations = [];
  let allLeads         = [];
  let activeConv       = null;
  let activeChannel    = "all";
  let inboxPollTimer   = null;

  /* ── Helpers ──────────────────────────────────────────────────────── */
  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    if (now - d < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-CO", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function channelLabel(ch) {
    const m = { whatsapp:"WhatsApp", instagram:"Instagram", facebook:"Facebook", messenger:"Messenger", webchat:"Web" };
    return m[ch] || ch || "Desconocido";
  }

  function channelIcon(ch) {
    const icons = {
      whatsapp:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.48A11.8 11.8 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.12.55 4.18 1.6 6L0 24l6.3-1.65A11.9 11.9 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.22-3.48-8.52zM12 22c-1.85 0-3.67-.5-5.26-1.44l-.38-.22-3.88 1.02 1.03-3.78-.25-.4A9.94 9.94 0 0 1 2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm5.5-7.5c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15s-.77.97-.94 1.17c-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37s-1.04 1.02-1.04 2.48c0 1.47 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.27.5 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z"/></svg>`,
      instagram: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`,
      facebook:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>`,
      messenger: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"/></svg>`,
      webchat:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21l4-4 4 4"/></svg>`,
    };
    return icons[ch] || `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
  }

  function statusLabel(s) {
    return s === "human_required" ? "Pendiente humano" : s === "answered" ? "Respondida" : s || "—";
  }

  function salesStageLabel(s) {
    const m = { new:"Nuevo", contacted:"Contactado", qualified:"Calificado", proposal:"Propuesta", won:"Ganado", lost:"Perdido" };
    return m[s] || s || "Nuevo";
  }

  async function getJSON(url) {
    const response = await fetch(url);
    if (response.status === 401) {
      window.location.href = "/admin-login.html";
      return null;
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "No se pudo cargar la información." }));
      throw new Error(error.error || "No se pudo cargar la información.");
    }
    return response.json();
  }

  /* ── Get active company from clientSelect (same source platform.js uses) */
  function getActiveCompanyId() {
    return clientSelect?.value || localStorage.getItem("r360_active_client") || "";
  }

  /* ── Find matching lead for a conversation ─────────────────────────── */
  function findLead(conv) {
    if (!conv) return null;
    let lead = allLeads.find((l) => l.leadId === conv.conversationId && l.companyId === conv.companyId);
    if (lead) return lead;
    if (conv.customerId) {
      const phone = conv.customerId.replace(/\D/g, "");
      lead = allLeads.find((l) =>
        l.companyId === conv.companyId &&
        l.phone &&
        l.phone.replace(/\D/g, "").endsWith(phone.slice(-9))
      );
    }
    return lead || null;
  }

  /* ── Reset panel to empty state ───────────────────────────────────── */
  function resetChat() {
    activeConv = null;
    inboxChatHeader.innerHTML = `
      <div class="inbox-chat-placeholder">
        <svg width="40" height="40" fill="none" stroke="#CBD5E1" stroke-width="1.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <p>Selecciona una conversación para ver el historial</p>
      </div>`;
    inboxMessages.innerHTML = "";
    inboxReplyForm.hidden = true;
    inboxProfile.innerHTML = `
      <div class="inbox-profile-placeholder">
        <svg width="36" height="36" fill="none" stroke="#CBD5E1" stroke-width="1.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <p>Selecciona una conversación para ver el perfil comercial</p>
      </div>`;
  }

  /* ── Load data for active company ─────────────────────────────────── */
  async function loadAll({ silent = false } = {}) {
    const companyId = getActiveCompanyId();
    if (!companyId) {
      inboxList.innerHTML = `<div class="empty-state">Selecciona un cliente activo en el selector de arriba.</div>`;
      return;
    }

    if (!silent) {
      inboxList.innerHTML = `<div class="inbox-loading">Cargando conversaciones de ${esc(companyId)}…</div>`;
      resetChat();
    }

    try {
      const [convRes, leadsRes] = await Promise.all([
        getJSON(`/api/conversations/${encodeURIComponent(companyId)}`),
        getJSON(`/api/leads/${encodeURIComponent(companyId)}`),
      ]);

      allConversations = (convRes.conversations || []).sort((a, b) =>
        new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
      );

      const raw = leadsRes.leads ?? leadsRes;
      allLeads = Array.isArray(raw) ? raw : [];

      if (activeConv) {
        activeConv = allConversations.find(
          (conversation) =>
            conversation.companyId === activeConv.companyId &&
            conversation.conversationId === activeConv.conversationId,
        ) || null;
      }
      renderList();
    } catch (err) {
      if (!silent) {
        inboxList.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
      }
    }
  }

  function stopInboxPolling() {
    window.clearInterval(inboxPollTimer);
    inboxPollTimer = null;
  }

  function startInboxPolling() {
    stopInboxPolling();
    inboxPollTimer = window.setInterval(() => {
      const pane = document.querySelector('.tab-pane[data-pane="conversaciones"]');
      if (pane && !pane.hidden && document.visibilityState === "visible") {
        loadAll({ silent: true });
      }
    }, 10000);
  }

  /* ── Render conversation list ─────────────────────────────────────── */
  function renderList() {
    const query   = (inboxSearch?.value || "").toLowerCase().trim();
    const channel = activeChannel;

    let items = allConversations;
    if (channel !== "all") items = items.filter((c) => c.channel === channel);

    if (query) {
      items = items.filter((c) => {
        const lead = findLead(c);
        return [c.customerName, c.summary, c.unit, lead?.email, lead?.phone, lead?.business]
          .filter(Boolean).join(" ").toLowerCase().includes(query);
      });
    }

    if (!items.length) {
      inboxList.innerHTML = `<div class="empty-state">No hay conversaciones para estos filtros.</div>`;
      return;
    }

    inboxList.innerHTML = items.map((conv) => {
      const lead    = findLead(conv);
      const isActive= activeConv?.conversationId === conv.conversationId;
      const unread  = conv.status === "human_required";
      return `
        <button class="inbox-item${isActive ? " active" : ""}${unread ? " unread" : ""}"
          data-conv-id="${esc(conv.conversationId)}"
          data-company-id="${esc(conv.companyId)}"
          type="button">
          <div class="inbox-item-top">
            <span class="inbox-item-name">${esc(conv.customerName || "Visitante")}</span>
            <span class="inbox-item-time">${esc(fmtTime(conv.lastMessageAt))}</span>
          </div>
          <div class="inbox-item-meta">
            <span class="inbox-channel-badge channel-${esc(conv.channel)}">${channelIcon(conv.channel)}${esc(channelLabel(conv.channel))}</span>
            ${lead?.email ? `<span class="inbox-item-detail">${esc(lead.email)}</span>` : ""}
          </div>
          <p class="inbox-item-preview">${esc(conv.summary || "Sin resumen")}</p>
          ${unread ? `<span class="inbox-unread-dot" aria-label="Sin respuesta"></span>` : ""}
        </button>`;
    }).join("");

    inboxList.querySelectorAll(".inbox-item").forEach((btn) => {
      btn.addEventListener("click", () => openConversation(btn.dataset.companyId, btn.dataset.convId));
    });
  }

  /* ── Open conversation ────────────────────────────────────────────── */
  async function openConversation(companyId, conversationId) {
    const meta = allConversations.find(
      (c) => c.companyId === companyId && c.conversationId === conversationId
    );
    if (!meta) return;

    activeConv = meta;
    renderList();

    inboxChatHeader.innerHTML = `
      <div class="inbox-chat-info">
        <div class="inbox-chat-avatar">${esc((meta.customerName || "?")[0].toUpperCase())}</div>
        <div>
          <strong>${esc(meta.customerName || "Visitante")}</strong>
          <small>${esc(channelLabel(meta.channel))} · ${esc(meta.unit || "")}</small>
        </div>
        <span class="inbox-status-badge status-${esc(meta.status)}">${esc(statusLabel(meta.status))}</span>
      </div>`;

    inboxMessages.innerHTML = `<div class="inbox-loading">Cargando mensajes…</div>`;
    inboxReplyForm.hidden = true;

    try {
      const full = await getJSON(
        `/api/messages/${encodeURIComponent(companyId)}/${encodeURIComponent(conversationId)}`
      );
      renderMessages(full);
      renderProfile(full, findLead(full));
    } catch (err) {
      inboxMessages.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
    }
  }

  /* ── Render messages ──────────────────────────────────────────────── */
  function renderMessages(conv) {
    const msgs = conv.messages || [];

    if (!msgs.length) {
      inboxMessages.innerHTML = `<div class="empty-state">No hay mensajes en esta conversación.</div>`;
    } else {
      inboxMessages.innerHTML = msgs.map((msg) => {
        const cls   = msg.sender === "human"  ? "msg-human"   :
                      msg.sender === "bot"    ? "msg-bot"     :
                      msg.sender === "system" ? "msg-system"  : "msg-customer";
        const label = msg.sender === "human"  ? "Asesor"      :
                      msg.sender === "bot"    ? "Bot iDIGITAL":
                      msg.sender === "system" ? "Sistema"     : conv.customerName || "Cliente";
        return `
          <div class="inbox-msg ${cls}">
            <div class="inbox-msg-bubble"><p>${esc(msg.text)}</p></div>
            <div class="inbox-msg-meta">
              <span>${esc(label)}</span>
              <span>${esc(fmtDateTime(msg.createdAt))}</span>
            </div>
          </div>`;
      }).join("");
    }

    requestAnimationFrame(() => { inboxMessages.scrollTop = inboxMessages.scrollHeight; });

    inboxReplyChannel.textContent = channelLabel(conv.channel);
    inboxReplyForm.dataset.companyId = conv.companyId;
    inboxReplyForm.dataset.convId    = conv.conversationId;
    inboxReplyForm.hidden = false;
    inboxReplyForm.querySelector("textarea").value = "";
  }

  /* ── Render lead profile (col 3) ─────────────────────────────────── */
  function renderProfile(conv, lead) {
    const leadsLink = lead
      ? `<button class="inbox-profile-link" data-action="goto-crm" data-company-id="${esc(lead.companyId)}" data-lead-id="${esc(lead.leadId)}" type="button">Ver en CRM</button>`
      : "";

    inboxProfile.innerHTML = `
      <div class="inbox-profile-inner">
        <div class="inbox-profile-hero">
          <div class="inbox-profile-avatar">${esc((conv.customerName || "?")[0].toUpperCase())}</div>
          <div>
            <strong class="inbox-profile-name">${esc(conv.customerName || "Visitante")}</strong>
            <span class="inbox-channel-badge channel-${esc(conv.channel)}">${channelIcon(conv.channel)}${esc(channelLabel(conv.channel))}</span>
          </div>
        </div>

        <section class="inbox-profile-section">
          <h4 class="inbox-profile-section-title">Información general</h4>
          <dl class="inbox-profile-dl">
            <div><dt>Empresa</dt><dd>${esc(lead?.business || conv.unit || "—")}</dd></div>
            <div><dt>Correo</dt><dd>${lead?.email ? `<a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>` : "—"}</dd></div>
            <div><dt>Teléfono</dt><dd>${lead?.phone ? `<a href="tel:${esc(lead.phone)}">${esc(lead.phone)}</a>` : esc(conv.customerId || "—")}</dd></div>
            <div><dt>Ciudad</dt><dd>${esc(lead?.city || "—")}</dd></div>
            <div><dt>Canal</dt><dd>${esc(channelLabel(conv.channel))}</dd></div>
          </dl>
        </section>

        <section class="inbox-profile-section">
          <h4 class="inbox-profile-section-title">Estado comercial</h4>
          <dl class="inbox-profile-dl">
            <div><dt>Etapa</dt><dd><span class="sales-stage stage-${esc(lead?.salesStage || "new")}">${esc(salesStageLabel(lead?.salesStage || "new"))}</span></dd></div>
            <div><dt>Valor</dt><dd>${lead?.estimatedValue ? `$${Number(lead.estimatedValue).toLocaleString("es-CO")}` : "—"}</dd></div>
            <div><dt>Responsable</dt><dd>${esc(lead?.owner || "Sin asignar")}</dd></div>
            <div><dt>Próxima acción</dt><dd>${esc(lead?.nextAction || "—")}</dd></div>
            <div><dt>Seguimiento</dt><dd>${esc(fmtDateTime(lead?.nextActionAt))}</dd></div>
          </dl>
        </section>

        <section class="inbox-profile-section">
          <h4 class="inbox-profile-section-title">Actividad</h4>
          <dl class="inbox-profile-dl">
            <div><dt>Ingresó</dt><dd>${esc(fmtDateTime(lead?.capturedAt || conv.lastMessageAt))}</dd></div>
            <div><dt>Última act.</dt><dd>${esc(fmtDateTime(conv.lastMessageAt || lead?.updatedAt))}</dd></div>
            <div><dt>Mensajes</dt><dd>${esc(String(conv.messageCount ?? (conv.messages?.length ?? "—")))}</dd></div>
            <div><dt>Estado</dt><dd><span class="inbox-status-badge status-${esc(conv.status)}">${esc(statusLabel(conv.status))}</span></dd></div>
          </dl>
        </section>

        ${lead?.notes ? `<section class="inbox-profile-section"><h4 class="inbox-profile-section-title">Notas comerciales</h4><p class="inbox-profile-notes">${esc(lead.notes)}</p></section>` : ""}
        ${lead?.interest || conv.summary ? `<section class="inbox-profile-section"><h4 class="inbox-profile-section-title">Resumen</h4><p class="inbox-profile-notes">${esc(lead?.interest || conv.summary)}</p></section>` : ""}
        ${leadsLink ? `<div class="inbox-profile-actions">${leadsLink}</div>` : ""}
      </div>`;

    inboxProfile.querySelectorAll("[data-action='goto-crm']").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelector(".side-nav a[data-tab='clientes']")?.click();
        setTimeout(() => {
          document.querySelector(`.manage-admin-lead[data-company-id="${btn.dataset.companyId}"][data-lead-id="${btn.dataset.leadId}"]`)?.click();
        }, 200);
      });
    });
  }

  /* ── Reply ────────────────────────────────────────────────────────── */
  inboxReplyForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { companyId, convId } = inboxReplyForm.dataset;
    const textarea = inboxReplyForm.querySelector("textarea");
    const reply    = textarea.value.trim();
    if (!reply) return;

    inboxReplyBtn.disabled = true;
    inboxReplyBtn.textContent = "Enviando…";

    try {
      const res  = await fetch(`/api/messages/${encodeURIComponent(companyId)}/${encodeURIComponent(convId)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      renderMessages(data.conversation);
      const idx = allConversations.findIndex((c) => c.companyId === companyId && c.conversationId === convId);
      if (idx !== -1) {
        allConversations[idx].status = "answered";
        allConversations[idx].lastMessageAt = data.conversation.lastMessageAt;
      }
      renderList();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      inboxReplyBtn.disabled = false;
      inboxReplyBtn.textContent = "Enviar respuesta";
    }
  });

  /* ── Channel filter ───────────────────────────────────────────────── */
  inboxChannelFilters?.addEventListener("click", (e) => {
    const btn = e.target.closest(".inbox-channel-btn");
    if (!btn) return;
    inboxChannelFilters.querySelectorAll(".inbox-channel-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeChannel = btn.dataset.channel;
    renderList();
  });

  /* ── Search ───────────────────────────────────────────────────────── */
  inboxSearch?.addEventListener("input", renderList);

  /* ── Reload when active client changes (respects clientSelect) ────── */
  clientSelect?.addEventListener("change", () => {
    allConversations = [];
    allLeads = [];
    activeChannel = "all";
    inboxChannelFilters?.querySelectorAll(".inbox-channel-btn").forEach((b) => b.classList.remove("active"));
    inboxChannelFilters?.querySelector("[data-channel='all']")?.classList.add("active");
    if (inboxSearch) inboxSearch.value = "";
    resetChat();
    // Only reload if the tab is currently visible
    const pane = document.querySelector('.tab-pane[data-pane="conversaciones"]');
    if (pane && !pane.hidden) loadAll();
  });

  /* ── Load when tab becomes visible ───────────────────────────────── */
  document.querySelectorAll(".side-nav a[data-tab]").forEach((link) => {
    link.addEventListener("click", () => {
      if (link.dataset.tab === "conversaciones") {
        loadAll();
        startInboxPolling();
      } else {
        stopInboxPolling();
      }
    });
  });

  // Load if already on this tab at page load
  const pane = document.querySelector('.tab-pane[data-pane="conversaciones"]');
  if (pane && !pane.hidden) {
    loadAll();
    startInboxPolling();
  }

  window.addEventListener("beforeunload", stopInboxPolling);

})();
