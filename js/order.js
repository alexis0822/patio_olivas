/* Patio Olivas — pickup cart. ATH Móvil is charged first.
   The restaurant email is sent only after that payment is confirmed. */
(function () {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const cfg = () => window.PATIO_OLIVAS_ORDER || {};
  const ATH_PATH = cfg().athPath || "Patiolivaspr";
  const ATH_API = "https://payments.athmovil.com/api/business-transaction/ecommerce";
  const STORAGE = "patioOlivasCart";
  const PAY_KEY = "patioOlivasAthPay";
  const UNSENT_KEY = "patioOlivasUnsent";
  const MAX_QTY = 20;
  const PICKUP_SECTIONS = ["#tapeo", "#sides", "#bebidas"];
  const SKIP_NAMES = /piña colada/i;
  const PHONE = "(939) 343-9664";

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
  const money = (n) => "$" + Number(n).toFixed(2);
  const cents = (n) => Math.round(Number(n) * 100);
  const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const publicToken = () => String(cfg().athPublicToken || "").trim();

  const athPhone = (raw) => {
    let digits = String(raw || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
    return /^\d{10}$/.test(digits) ? digits : "";
  };

  const loadCart = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      return Array.isArray(raw) ? raw.filter((i) => i && i.id && i.name && i.qty > 0) : [];
    } catch {
      return [];
    }
  };
  const saveCart = (items) => localStorage.setItem(STORAGE, JSON.stringify(items));
  const readJson = (key) => {
    try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch { return null; }
  };

  let cart = loadCart();
  let view = "list";
  let active = null;
  let payGen = 0;

  const root = document.createElement("div");
  root.className = "cart-root";
  root.innerHTML = `
    <div class="cart-backdrop" data-cart-close hidden></div>
    <aside class="cart" id="cartPanel" role="dialog" aria-modal="true" aria-labelledby="cartTitle" aria-hidden="true">
      <button class="cart__close" type="button" data-cart-close aria-label="Cerrar pedido">&times;</button>
      <div class="cart__body" data-cart-view="list">
        <p class="eyebrow">Para recoger</p>
        <h2 class="cart__title" id="cartTitle">Tu pedido</h2>
        <div class="cart__lines" data-cart-lines></div>
        <p class="cart__empty" data-cart-empty>Añade tapeo, sides o bebidas desde el menú. Cócteles, cervezas y vinos se sirven en el patio.</p>
        <div class="cart__footer" data-cart-footer hidden>
          <div class="cart__total"><span>Total</span><strong data-cart-total>$0.00</strong></div>
          <p class="cart__pay-hint">El pago es con ATH Móvil antes de enviar el pedido. Efectivo y tarjetas, en el patio.</p>
          <button class="btn btn--light" type="button" data-cart-checkout>Confirmar datos</button>
        </div>
      </div>
      <form class="cart__body cart-form" data-cart-view="checkout" hidden>
        <p class="eyebrow">Para recoger</p>
        <h2 class="cart__title">Confirma tu pedido</h2>
        <button class="cart__back" type="button" data-cart-back>← Volver al pedido</button>
        <div class="cart__confirm" data-cart-summary></div>
        <div class="cart__total"><span>Total a pagar</span><strong data-checkout-total>$0.00</strong></div>
        <p class="cart__pay-hint">ATH Móvil envía este total a tu teléfono. El restaurante recibe el pedido cuando ese cobro queda confirmado.</p>
        <label>Nombre<input name="nombre" type="text" autocomplete="name" required></label>
        <label>Teléfono de ATH Móvil<input name="telefono" type="tel" inputmode="tel" autocomplete="tel" required></label>
        <label>Correo (opcional)<input name="correo" type="email" autocomplete="email"></label>
        <div class="cart-form__row">
          <label>Día<input name="dia" type="date" required></label>
          <label>Hora<input name="hora" type="time" required></label>
        </div>
        <label>Notas (alergias, etc.)<textarea name="notas" rows="3"></textarea></label>
        <input type="text" name="_honey" class="cart-form__honey" tabindex="-1" autocomplete="off">
        <p class="cart__error" data-cart-error hidden></p>
        <button class="btn btn--light" type="submit" data-cart-submit>Pagar ahora</button>
      </form>
      <div class="cart__body" data-cart-view="paying" hidden>
        <p class="eyebrow">ATH Móvil</p>
        <h2 class="cart__title">Confirma en la app</h2>
        <p class="cart__status" data-pay-status aria-live="polite"></p>
        <p class="cart__ath-box">
          <span>Negocio</span><strong>${esc(ATH_PATH)}</strong>
          <span>Total</span><strong data-pay-total>$0.00</strong>
        </p>
        <p class="cart__pay-hint">Abre la notificación de ATH Móvil y confirma este cobro. El pedido no se envía hasta entonces.</p>
        <button class="btn btn--light" type="button" data-pay-check>Ya confirmé en ATH Móvil</button>
        <button class="btn btn--ghost cart__done-close" type="button" data-pay-cancel>Cancelar pago</button>
      </div>
      <div class="cart__body" data-cart-view="done" hidden>
        <p class="eyebrow">ATH Móvil</p>
        <h2 class="cart__title" data-done-title>Pedido enviado</h2>
        <p class="cart__thanks" data-cart-thanks></p>
        <p class="cart__ath-box">
          <span>Referencia</span><strong class="cart__ref" data-ath-ref></strong>
        </p>
        <p class="cart__error" data-send-error hidden></p>
        <button class="btn btn--light" type="button" data-resend hidden>Reenviar pedido</button>
        <button class="btn btn--ghost cart__done-close" type="button" data-done-dismiss>Cerrar</button>
      </div>
    </aside>
  `;
  document.body.appendChild(root);

  const panel = $("#cartPanel", root);
  const backdrop = $(".cart-backdrop", root);
  const form = $("form", root);

  const setView = (next) => {
    view = next;
    $$("[data-cart-view]", root).forEach((el) => {
      el.hidden = el.getAttribute("data-cart-view") !== next;
    });
  };

  const showError = (msg) => {
    const err = $("[data-cart-error]", root);
    err.textContent = msg;
    err.hidden = false;
  };

  const setStatus = (msg) => {
    const el = $("[data-pay-status]", root);
    if (el) el.textContent = msg;
  };

  const resetSubmit = () => {
    const submit = $("[data-cart-submit]", root);
    if (!submit) return;
    submit.disabled = false;
    submit.textContent = cart.length ? "Pagar ahora " + money(totalOf(cart)) : "Pagar ahora";
  };

  const totalOf = (items) => items.reduce((sum, i) => sum + cents(i.price) * i.qty, 0) / 100;

  const renderCounts = () => {
    const n = cart.reduce((sum, i) => sum + i.qty, 0);
    $$("[data-cart-count]").forEach((el) => {
      el.textContent = String(n);
      el.hidden = n === 0;
    });
  };

  const renderLines = () => {
    const box = $("[data-cart-lines]", root);
    const empty = $("[data-cart-empty]", root);
    const footer = $("[data-cart-footer]", root);
    const totalEl = $("[data-cart-total]", root);
    const total = totalOf(cart);
    box.innerHTML = cart.map((i) => `
      <div class="cart-line" data-id="${esc(i.id)}">
        <div>
          <p class="cart-line__name">${esc(i.name)}</p>
          <p class="cart-line__price">${i.qty} × ${money(i.price)}</p>
        </div>
        <div class="cart-line__qty">
          <button type="button" data-qty="-1" aria-label="Quitar">−</button>
          <span>${i.qty}</span>
          <button type="button" data-qty="1" aria-label="Añadir">+</button>
        </div>
      </div>
    `).join("");
    empty.hidden = cart.length > 0;
    footer.hidden = cart.length === 0;
    if (totalEl) totalEl.textContent = money(total);
    renderCounts();
  };

  const renderSummary = () => {
    const box = $("[data-cart-summary]", root);
    const totalEl = $("[data-checkout-total]", root);
    const payBtn = $("[data-cart-submit]", root);
    const total = totalOf(cart);
    box.innerHTML = cart.map((i) => `
      <div class="cart-line cart-line--static">
        <p class="cart-line__name">${i.qty} × ${esc(i.name)}</p>
        <p class="cart-line__price">${money(i.price * i.qty)}</p>
      </div>
    `).join("");
    if (totalEl) totalEl.textContent = money(total);
    if (payBtn && !payBtn.disabled) payBtn.textContent = "Pagar ahora " + money(total);
  };

  const addItem = (id, name, price) => {
    const found = cart.find((i) => i.id === id);
    if (found) found.qty = Math.min(MAX_QTY, found.qty + 1);
    else cart.push({ id, name, price, qty: 1 });
    saveCart(cart);
    renderLines();
  };

  const changeQty = (id, delta) => {
    cart = cart.map((i) => i.id === id ? { ...i, qty: i.qty + delta } : i).filter((i) => i.qty > 0 && i.qty <= MAX_QTY);
    saveCart(cart);
    renderLines();
  };

  const ensureCartOpen = () => {
    closeOverlayIfAny();
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;
    document.body.classList.add("cart-open");
  };

  const openCart = () => {
    ensureCartOpen();
    if (view === "list") renderLines();
  };

  const closeCart = () => {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    document.body.classList.remove("cart-open");
    if (view === "checkout") setView("list");
  };

  const closeOverlayIfAny = () => {
    const overlay = $("#overlay");
    if (overlay && overlay.classList.contains("is-open")) {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("menu-open");
    }
  };

  const handleOpen = (e) => {
    e.preventDefault();
    if (!$("#tapeo") && cart.length === 0 && view === "list") {
      window.location.href = "menu.html#pedido";
      return;
    }
    openCart();
  };

  const wireMenuItems = () => {
    PICKUP_SECTIONS.forEach((sel) => {
      $$(sel + " .item").forEach((el) => {
        if (el.dataset.dineIn != null) return;
        const name = (el.querySelector(".item__name")?.textContent || "").replace(/\s+/g, " ").trim();
        const priceText = (el.querySelector(".item__price")?.textContent || "").replace(",", ".").trim();
        const price = parseFloat(priceText);
        if (!name || SKIP_NAMES.test(name) || !Number.isFinite(price)) return;
        makeOrderable(el, name, price);
      });
    });
  };

  const makeOrderable = (el, name, price) => {
    const row = el.querySelector(".item__row");
    if (!row || row.querySelector(".item__add")) return;
    const id = el.dataset.id || slug(name);
    el.dataset.id = id;
    const tools = document.createElement("div");
    tools.className = "item__tools";
    const priceEl = row.querySelector(".item__price");
    if (priceEl) tools.appendChild(priceEl);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item__add";
    btn.setAttribute("aria-label", "Añadir " + name + " al pedido");
    btn.textContent = "+";
    btn.addEventListener("click", () => {
      addItem(id, name, price);
      openCart();
    });
    tools.appendChild(btn);
    row.appendChild(tools);
  };

  const athFetch = async (path, { method = "POST", body, token, timeout = 20000 } = {}) => {
    let res;
    try {
      const headers = { Accept: "application/json", "Content-Type": "application/json" };
      if (token) headers.Authorization = "Bearer " + token;
      res = await fetch(ATH_API + path, {
        method,
        headers,
        body: JSON.stringify(body || {}),
        signal: AbortSignal.timeout(timeout),
      });
    } catch {
      const err = new Error("No hay conexión con ATH Móvil.");
      err.network = true;
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === "error") {
      const err = new Error(data.message || "ATH Móvil rechazó el cobro.");
      err.code = data.errorcode || data.errorCode || "";
      throw err;
    }
    return data;
  };

  const statusOf = (json) => {
    const data = json && json.data;
    if (!data || typeof data !== "object") return "";
    return String(data.ecommerceStatus || "").toUpperCase();
  };

  const clearPay = () => {
    try { sessionStorage.removeItem(PAY_KEY); } catch { /* ignore */ }
  };

  const savePay = (pay) => {
    try {
      sessionStorage.setItem(PAY_KEY, JSON.stringify({
        ecommerceId: pay.ecommerceId,
        authToken: pay.authToken,
        expectedCents: pay.expectedCents,
        totalLabel: pay.totalLabel,
        payload: pay.payload,
        deadline: pay.deadline,
      }));
    } catch { /* ignore */ }
  };

  const sendToRestaurant = async (payload) => {
    const url = cfg().submitUrl || ("https://formsubmit.co/ajax/" + (cfg().email || ""));
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || String(body.success) === "false") {
      throw new Error(body.message || "No se pudo avisar al restaurante.");
    }
  };

  const showReceipt = (payload, sent, detail) => {
    ensureCartOpen();
    const title = $("[data-done-title]", root);
    const thanks = $("[data-cart-thanks]", root);
    const refEl = $("[data-ath-ref]", root);
    const err = $("[data-send-error]", root);
    const resend = $("[data-resend]", root);
    if (title) title.textContent = sent ? "Pedido enviado" : "Pago confirmado";
    if (refEl) refEl.textContent = payload.referencia || "";
    if (thanks) {
      thanks.textContent = sent
        ? `Gracias, ${payload.nombre}. El pago quedó confirmado y el pedido ya se envió. Recoges el ${payload.dia} a las ${payload.hora}.`
        : `El pago de ${payload.total} quedó confirmado, pero el restaurante todavía no recibió el aviso.`;
    }
    if (err) {
      err.hidden = sent;
      err.textContent = sent ? "" : (detail || `Toca reenviar, o llama al ${PHONE} y da la referencia.`);
    }
    if (resend) resend.hidden = sent;
    setView("done");
  };

  const deliver = async (payload) => {
    try {
      await sendToRestaurant(payload);
      try { sessionStorage.removeItem(UNSENT_KEY); } catch { /* ignore */ }
      showReceipt(payload, true);
    } catch (e) {
      showReceipt(payload, false, e.message);
    }
  };

  const failPayment = (msg) => {
    if (active) active.done = true;
    clearPay();
    active = null;
    setView("checkout");
    showError(msg);
    resetSubmit();
    ensureCartOpen();
  };

  const acceptPayment = async (pay, data) => {
    if (!pay || pay.done) return;
    const status = String(data.ecommerceStatus || "").toUpperCase();
    const ref = String(data.referenceNumber || data.reference_number || "").trim();
    const paid = Math.round(Number(data.total) * 100);
    const sameTicket = !data.ecommerceId || data.ecommerceId === pay.ecommerceId;
    if (!sameTicket || status !== "COMPLETED" || !ref || paid !== pay.expectedCents) {
      pay.done = true;
      clearPay();
      active = null;
      setView("checkout");
      if (ref && paid !== pay.expectedCents) {
        showError(`ATH Móvil confirmó ${money(paid / 100)} y este pedido es ${pay.totalLabel}. No se envió. Referencia ${ref}. Llama al ${PHONE}.`);
      } else {
        showError("El pago de este pedido no quedó confirmado. No se envió.");
      }
      resetSubmit();
      ensureCartOpen();
      return;
    }
    pay.done = true;
    const payload = {
      ...pay.payload,
      referencia: ref,
      ecommerceId: pay.ecommerceId,
      cuenta: data.businessPath || ATH_PATH,
      estado: "COMPLETED",
      _subject: "Pedido pagado " + ref + " — Patio Olivas",
    };
    try { sessionStorage.setItem(UNSENT_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
    clearPay();
    active = null;
    cart = [];
    saveCart(cart);
    renderLines();
    form.reset();
    await deliver(payload);
  };

  const tick = async () => {
    const pay = active;
    if (!pay || pay.done || pay.ticking) return;
    pay.ticking = true;
    try {
      if (Date.now() > pay.deadline) {
        failPayment("Se agotó el tiempo para pagar. El pedido no se envió.");
        return;
      }
      let found;
      try {
        found = await athFetch("/business/findPayment", {
          body: { ecommerceId: pay.ecommerceId, publicToken: publicToken() },
        });
      } catch (e) {
        if (active === pay && !pay.done) {
          setStatus(e.network
            ? "Sin conexión. Seguimos esperando la confirmación de ATH Móvil…"
            : "Esperando la confirmación en ATH Móvil…");
        }
        return;
      }
      if (active !== pay || pay.done) return;
      const status = statusOf(found);
      if (status === "CANCEL") {
        failPayment("El pago se canceló. El pedido no se envió.");
        return;
      }
      if (status === "EXPIRED") {
        failPayment("El pago expiró. El pedido no se envió.");
        return;
      }
      if (status === "COMPLETED") {
        await acceptPayment(pay, found.data || {});
        return;
      }
      if (status === "CONFIRM") {
        pay.authorizing = true;
        setStatus("ATH Móvil recibió la confirmación. Verificando el cobro…");
        try {
          const auth = await athFetch("/authorization", { token: pay.authToken, body: {} });
          if (active !== pay || pay.done) return;
          await acceptPayment(pay, auth.data || {});
        } catch (e) {
          pay.authorizing = false;
          if (active !== pay || pay.done) return;
          if (e.code === "BTRA_0037") {
            failPayment("El pago se canceló. El pedido no se envió.");
            return;
          }
          if (e.code === "BTRA_0039") {
            failPayment("El pago expiró. El pedido no se envió.");
            return;
          }
          setStatus(e.code === "BTRA_0032"
            ? "Esperando la confirmación en ATH Móvil…"
            : "Todavía no pudimos verificar el pago. " + e.message);
        }
        return;
      }
      setStatus(`Abre la notificación de ATH Móvil y confirma el pago de ${pay.totalLabel}. El pedido se envía cuando ese cobro quede confirmado.`);
    } finally {
      if (pay) pay.ticking = false;
    }
  };

  const poll = async (gen) => {
    while (active && active.gen === gen && !active.done) {
      await sleep(2500);
      if (!active || active.gen !== gen || active.done) return;
      await tick();
    }
  };

  const beginWait = (record) => {
    active = record;
    savePay(record);
    const totalEl = $("[data-pay-total]", root);
    if (totalEl) totalEl.textContent = record.totalLabel;
    setStatus(`Enviamos el cobro de ${record.totalLabel} a tu ATH Móvil. Abre la notificación y confirma el pago.`);
    setView("paying");
    ensureCartOpen();
    resetSubmit();
    poll(record.gen);
    tick();
  };

  $("[data-cart-lines]", root).addEventListener("click", (e) => {
    const btn = e.target.closest("[data-qty]");
    if (!btn) return;
    const id = btn.closest(".cart-line")?.dataset.id;
    const delta = Number(btn.dataset.qty);
    if (id) changeQty(id, delta);
  });

  $("[data-cart-checkout]", root).addEventListener("click", () => {
    if (!cart.length || (active && !active.done)) return;
    const day = form.elements.dia;
    if (day) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      day.min = today;
      if (!day.value || day.value < today) day.value = today;
    }
    renderSummary();
    setView("checkout");
    form.elements.nombre?.focus();
  });
  $("[data-cart-back]", root).addEventListener("click", () => setView("list"));

  $("[data-pay-check]", root).addEventListener("click", () => { tick(); });
  $("[data-pay-cancel]", root).addEventListener("click", async () => {
    const pay = active;
    if (!pay || pay.done) return;
    if (pay.authorizing) {
      setStatus("Estamos verificando el pago con ATH Móvil…");
      return;
    }
    pay.done = true;
    try {
      await athFetch("/business/cancel", {
        body: { ecommerceId: pay.ecommerceId, publicToken: publicToken() },
      });
    } catch { /* The wait still stops. The charge expires if ATH already closed it. */ }
    if (active === pay) failPayment("Pago cancelado. El pedido no se envió.");
  });

  $("[data-resend]", root).addEventListener("click", async () => {
    const btn = $("[data-resend]", root);
    const payload = readJson(UNSENT_KEY);
    if (!payload || !btn) return;
    btn.disabled = true;
    btn.textContent = "Reenviando…";
    try {
      await sendToRestaurant(payload);
      try { sessionStorage.removeItem(UNSENT_KEY); } catch { /* ignore */ }
      showReceipt(payload, true);
    } catch (e) {
      showReceipt(payload, false, e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Reenviar pedido";
    }
  });

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-done-dismiss]")) {
      setView("list");
      closeCart();
      return;
    }
    if (e.target.closest("[data-cart-close]")) closeCart();
  });

  $$("[data-open-cart], [data-order-pickup]").forEach((el) => {
    el.addEventListener("click", handleOpen);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("is-open")) {
      e.stopPropagation();
      closeCart();
    }
  }, true);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("[data-cart-error]", root);
    const submit = $("[data-cart-submit]", root);
    err.hidden = true;
    if (active && !active.done) {
      setView("paying");
      return;
    }
    if (!cart.length) {
      showError("Tu pedido está vacío.");
      return;
    }
    const data = new FormData(form);
    if (data.get("_honey")) return;
    const phone = athPhone(data.get("telefono"));
    const totalCents = cart.reduce((sum, i) => sum + cents(i.price) * i.qty, 0);
    const total = totalCents / 100;
    if (!String(data.get("nombre") || "").trim()) {
      showError("Escribe tu nombre.");
      return;
    }
    if (!phone) {
      showError("Escribe el teléfono de 10 dígitos registrado en ATH Móvil.");
      return;
    }
    if (!data.get("dia") || !data.get("hora")) {
      showError("Elige el día y la hora para recoger.");
      return;
    }
    if (totalCents < 100 || totalCents > 150000) {
      showError("ATH Móvil cobra entre $1.00 y $1,500.00.");
      return;
    }
    if (!publicToken()) {
      showError("Falta el token público de ATH Móvil Business (Ajustes → Token público). El pedido no se envió.");
      return;
    }
    const orderText = cart.map((i) => `${i.qty} × ${i.name} (${money(i.price)})`).join("\n");
    const payload = {
      _subject: "Pedido pagado — Patio Olivas",
      _template: "table",
      _captcha: "false",
      nombre: String(data.get("nombre")).trim(),
      telefono: phone,
      correo: data.get("correo") || "",
      dia: data.get("dia"),
      hora: data.get("hora"),
      notas: data.get("notas") || "",
      pedido: orderText,
      total: money(total),
      pago: "ATH Móvil",
    };
    const items = cart.map((i) => ({
      name: i.name.slice(0, 80),
      description: `${i.qty} × ${i.name}`.slice(0, 80),
      quantity: String(i.qty),
      price: (cents(i.price) / 100).toFixed(2),
      tax: "0.00",
      metadata: "",
    }));
    submit.disabled = true;
    submit.textContent = "Enviando cobro a ATH Móvil…";
    let created;
    try {
      created = await athFetch("/payment", {
        body: {
          env: "production",
          publicToken: publicToken(),
          timeout: 600,
          total,
          subtotal: total,
          tax: 0,
          metadata1: "Patio Olivas",
          metadata2: ("PO" + Date.now().toString(36)).slice(0, 40),
          phoneNumber: phone,
          items,
        },
      });
    } catch (error) {
      showError(error.message + " El pedido no se envió.");
      resetSubmit();
      return;
    }
    const ecommerceId = created.data && created.data.ecommerceId;
    const authToken = created.data && (created.data.auth_token || created.data.authToken);
    if (!ecommerceId || !authToken) {
      showError("ATH Móvil no creó el cobro. El pedido no se envió.");
      resetSubmit();
      return;
    }
    try {
      await athFetch("/business/updatePhoneNumber", {
        method: "PUT",
        token: authToken,
        body: { ecommerceId, phoneNumber: phone },
      });
    } catch (error) {
      if (!error.network) {
        try {
          await athFetch("/business/cancel", { body: { ecommerceId, publicToken: publicToken() } });
        } catch { /* ignore */ }
        showError(error.message + " El pedido no se envió.");
        resetSubmit();
        return;
      }
    }
    beginWait({
      gen: ++payGen,
      ecommerceId,
      authToken,
      expectedCents: totalCents,
      totalLabel: money(total),
      payload,
      deadline: Date.now() + 600000,
      done: false,
      ticking: false,
      authorizing: false,
    });
  });

  const resumeUnsent = () => {
    const payload = readJson(UNSENT_KEY);
    if (!payload || !payload.referencia) return false;
    deliver(payload);
    return true;
  };

  const resumePayment = () => {
    const saved = readJson(PAY_KEY);
    if (!saved || !saved.ecommerceId || !saved.authToken) return false;
    if (!saved.deadline || Date.now() > saved.deadline) {
      clearPay();
      return false;
    }
    beginWait({
      gen: ++payGen,
      ecommerceId: saved.ecommerceId,
      authToken: saved.authToken,
      expectedCents: saved.expectedCents,
      totalLabel: saved.totalLabel,
      payload: saved.payload,
      deadline: saved.deadline,
      done: false,
      ticking: false,
      authorizing: false,
    });
    setStatus("Seguimos esperando que confirmes el pago en ATH Móvil.");
    return true;
  };

  wireMenuItems();
  renderLines();
  if (!resumeUnsent() && !resumePayment() && location.hash === "#pedido") openCart();
})();
