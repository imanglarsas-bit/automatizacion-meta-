(() => {
  const script = document.currentScript;
  const companyId = script?.dataset.companyId || "inversiones-manglar";
  const sourceUrl = new URL(script?.src || window.location.href, window.location.href);
  const apiBase = script?.dataset.apiBase || sourceUrl.origin;
  const pageContext = script?.dataset.pageContext || detectPageContext();
  const contextConfig = getContextConfig(pageContext);
  const storageKey = `idigital-webchat:${companyId}:${pageContext}`;
  const sessionKey = `${storageKey}:session`;
  const sessionId = localStorage.getItem(sessionKey) || createSessionId();
  localStorage.setItem(sessionKey, sessionId);

  const host = document.createElement("div");
  host.id = "idigital-webchat";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }
      .launcher {
        position: fixed; right: 22px; bottom: 22px; z-index: 2147483000;
        width: 58px; height: 58px; border: 0; border-radius: 50%;
        display: grid; place-items: center; cursor: pointer;
        background: #071b2d; color: #fff;
        box-shadow: 0 16px 40px rgba(7, 27, 45, .28);
      }
      .launcher svg { width: 27px; height: 27px; }
      .panel {
        position: fixed; right: 22px; bottom: 92px; z-index: 2147483000;
        width: min(380px, calc(100vw - 28px)); height: min(610px, calc(100vh - 120px));
        display: none; grid-template-rows: auto 1fr auto; overflow: hidden;
        border: 1px solid #dce5eb; border-radius: 12px; background: #fff;
        box-shadow: 0 24px 70px rgba(7, 27, 45, .24);
        font-family: Inter, Arial, sans-serif; color: #15212b;
      }
      .panel.open { display: grid; }
      .header {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 15px 16px; background: #071b2d; color: #fff;
      }
      .identity { display: flex; align-items: center; gap: 10px; }
      .mark {
        width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px;
        background: linear-gradient(135deg, #7dba2e, #00aeef); color: #071b2d; font-weight: 900;
      }
      .header strong, .header small { display: block; }
      .header strong { font-size: 14px; }
      .header small { margin-top: 2px; color: #bcd0dc; font-size: 11px; }
      .close { border: 0; background: transparent; color: #fff; font-size: 24px; cursor: pointer; }
      .messages {
        display: flex; flex-direction: column; gap: 10px; overflow-y: auto;
        padding: 16px; background: #f4f7f9;
      }
      .message {
        max-width: 84%; padding: 10px 12px; border-radius: 9px;
        white-space: pre-wrap; font-size: 14px; line-height: 1.45;
      }
      .bot { align-self: flex-start; border: 1px solid #dce5eb; background: #fff; }
      .user { align-self: flex-end; background: #08766b; color: #fff; }
      .handoff {
        display: grid; gap: 8px; padding: 12px; border: 1px solid #b7dfd9;
        border-radius: 9px; background: #e8f7f5; font-size: 13px;
      }
      .handoff a {
        display: inline-flex; justify-content: center; padding: 10px 12px; border-radius: 7px;
        background: #08766b; color: #fff; text-decoration: none; font-weight: 800;
      }
      .form { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 12px; border-top: 1px solid #dce5eb; }
      .form input {
        width: 100%; min-width: 0; border: 1px solid #cdd8df; border-radius: 8px;
        padding: 11px 12px; color: #15212b; font: inherit; outline: none;
      }
      .form input:focus { border-color: #00aeef; box-shadow: 0 0 0 3px rgba(0, 174, 239, .13); }
      .send {
        width: 44px; border: 0; border-radius: 8px; background: #7dba2e;
        color: #071b2d; font-size: 20px; font-weight: 900; cursor: pointer;
      }
      .send:disabled { opacity: .55; cursor: wait; }
      @media (max-width: 520px) {
        .launcher { right: 14px; bottom: 14px; }
        .panel { inset: 12px; width: auto; height: auto; max-height: none; }
      }
    </style>
    <button class="launcher" type="button" aria-label="Abrir chat" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
      </svg>
    </button>
    <section class="panel" aria-label="${contextConfig.ariaLabel}">
      <header class="header">
        <div class="identity">
          <span class="mark">iD</span>
          <span><strong>${contextConfig.title}</strong><small>${contextConfig.subtitle}</small></span>
        </div>
        <button class="close" type="button" aria-label="Cerrar chat">×</button>
      </header>
      <div class="messages" aria-live="polite"></div>
      <form class="form">
        <input name="message" maxlength="1200" autocomplete="off" placeholder="Escribe tu mensaje..." aria-label="Mensaje" required />
        <button class="send" type="submit" aria-label="Enviar">›</button>
      </form>
    </section>
  `;

  const launcher = root.querySelector(".launcher");
  const panel = root.querySelector(".panel");
  const close = root.querySelector(".close");
  const messages = root.querySelector(".messages");
  const form = root.querySelector(".form");
  const input = form.elements.message;
  const send = root.querySelector(".send");
  let history = loadHistory();

  if (!history.length) {
    history = [{
      sender: "bot",
      text: contextConfig.greeting,
    }];
    saveHistory();
  }
  renderHistory();

  launcher.addEventListener("click", () => togglePanel(true));
  close.addEventListener("click", () => togglePanel(false));
  form.addEventListener("submit", sendMessage);

  async function sendMessage(event) {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    appendMessage("user", text);
    input.value = "";
    send.disabled = true;

    try {
      const response = await fetch(`${apiBase}/api/web-chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, sessionId, message: text, pageContext }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No fue posible responder.");

      appendMessage("bot", payload.reply);
      if (payload.handoff && payload.whatsappUrl) {
        appendHandoff(payload.whatsappUrl);
      }
    } catch {
      appendMessage("bot", "No pude conectarme en este momento. Puedes continuar directamente por WhatsApp.");
      appendHandoff("https://wa.me/573224591377?text=Hola%2C%20vengo%20del%20chat%20de%20imanglar.com.");
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  function appendMessage(sender, text) {
    history.push({ sender, text });
    history = history.slice(-30);
    saveHistory();
    renderHistory();
  }

  function appendHandoff(url) {
    const box = document.createElement("div");
    box.className = "handoff";
    box.innerHTML = "<strong>Un asesor continuará contigo</strong><span>El resumen del chat está listo para enviarse.</span>";
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Continuar por WhatsApp";
    box.appendChild(link);
    messages.appendChild(box);
    messages.scrollTop = messages.scrollHeight;
  }

  function renderHistory() {
    messages.innerHTML = "";
    history.forEach((item) => {
      const bubble = document.createElement("div");
      bubble.className = `message ${item.sender}`;
      bubble.textContent = item.text;
      messages.appendChild(bubble);
    });
    messages.scrollTop = messages.scrollHeight;
  }

  function togglePanel(open) {
    panel.classList.toggle("open", open);
    launcher.setAttribute("aria-expanded", String(open));
    if (open) input.focus();
  }

  function loadHistory() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    localStorage.setItem(storageKey, JSON.stringify(history));
  }

  function createSessionId() {
    return globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function detectPageContext() {
    const page = `${window.location.pathname} ${document.title}`.toLowerCase();
    if (page.includes("cardenas") || page.includes("cárdenas") || page.includes("abogado")) {
      return "cardenas-romero";
    }
    if (page.includes("src") || page.includes("consulting") || page.includes("upme")) {
      return "src-consulting";
    }
    return "inversiones-manglar";
  }

  function getContextConfig(context) {
    if (context === "cardenas-romero") {
      return {
        title: "Asistente jurídico",
        subtitle: "Cárdenas Romero Abogados",
        ariaLabel: "Chat de Cárdenas Romero Abogados",
        greeting: "Hola. Soy el asistente de Cárdenas Romero Abogados. Cuéntame si necesitas asesoría jurídica, revisión de documentos, información de un proceso o conocer nuestros planes.",
      };
    }

    if (context === "src-consulting") {
      return {
        title: "Asistente de consultoría",
        subtitle: "SRC Consulting",
        ariaLabel: "Chat de SRC Consulting",
        greeting: "Hola. Soy el asistente de SRC Consulting. Puedo orientarte sobre trámites UPME, devolución de IVA, finalización de pagos, movilidad eléctrica y otros trámites.",
      };
    }

    return {
      title: "Asistente iDIGITAL",
      subtitle: "Inversiones Manglar",
      ariaLabel: "Chat de Inversiones Manglar",
      greeting: "Hola. Soy el asistente de Inversiones Manglar. Cuéntame si necesitas asesoría jurídica, trámites UPME, movilidad eléctrica u otro servicio.",
    };
  }
})();
