/* Patio Olivas — on-page pickup cart; pay online with ATH Móvil */
(function () {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const cfg = window.PATIO_OLIVAS_ORDER || {};
  const ATH_PATH = cfg.athPath || "Patiolivaspr";
  const STORAGE = "patioOlivasCart";
  const MAX_QTY = 20;
  const PICKUP_SECTIONS = ["#tapeo", "#sides", "#bebidas"];
  const SKIP_NAMES = /piña colada/i;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
  const money = (n) => "$" + Number(n).toFixed(2);
  const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");

  const loadCart = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      return Array.isArray(raw) ? raw.filter((i) => i && i.id && i.name && i.qty > 0) : [];
    } catch {
      return [];
    }
  };
  const saveCart = (items) => localStorage.setItem(STORAGE, JSON.stringify(items));

  let cart = loadCart();
  let view = "list";

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
          <p class="cart__pay-hint">En línea se paga con ATH Móvil a <strong>${esc(ATH_PATH)}</strong>. Efectivo y tarjetas, en el patio.</p>
          <button class="btn btn--light" type="button" data-cart-checkout>Confirmar datos</button>
        </div>
      </div>
      <form class="cart__body cart-form" data-cart-view="checkout" hidden>
        <p class="eyebrow">Para recoger</p>
        <h2 class="cart__title">Confirma tu pedido</h2>
        <button class="cart__back" type="button" data-cart-back>← Volver al pedido</button>
        <div class="cart__confirm" data-cart-summary></div>
        <div class="cart__total"><span>Total a pagar</span><strong data-checkout-total>$0.00</strong></div>
        <p class="cart__pay-hint">ATH Móvil · pATH <strong>${esc(ATH_PATH)}</strong></p>
        <label>Nombre<input name="nombre" type="text" autocomplete="name" required></label>
        <label>Teléfono<input name="telefono" type="tel" autocomplete="tel" required></label>
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
      <div class="cart__body" data-cart-view="done" hidden>
        <p class="eyebrow">ATH Móvil</p>
        <h2 class="cart__title">Completa el pago</h2>
        <p class="cart__thanks" data-cart-thanks></p>
        <p class="cart__ath-box">
          <span>pATH</span><strong>${esc(ATH_PATH)}</strong>
          <span>Total</span><strong data-done-total>$0.00</strong>
        </p>
        <p class="cart__pay-hint">Si ATH Móvil no se abrió: Pagar a un negocio → <strong>${esc(ATH_PATH)}</strong> → el total → Pagar Ahora.</p>
        <button class="btn btn--light" type="button" data-open-ath>Abrir ATH Móvil</button>
        <button class="btn btn--ghost cart__done-close" type="button" data-cart-close>Cerrar</button>
      </div>
    </aside>
  `;
  document.body.appendChild(root);

  const panel = $("#cartPanel", root);
  const backdrop = $(".cart-backdrop", root);
  const form = $("form", root);
  let lastTotal = 0;

  const setView = (next) => {
    view = next;
    $$("[data-cart-view]", root).forEach((el) => {
      el.hidden = el.getAttribute("data-cart-view") !== next;
    });
  };

  const totalOf = (items) => items.reduce((sum, i) => sum + i.price * i.qty, 0);

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
    lastTotal = total;
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
    lastTotal = total;
    box.innerHTML = cart.map((i) => `
      <div class="cart-line cart-line--static">
        <p class="cart-line__name">${i.qty} × ${esc(i.name)}</p>
        <p class="cart-line__price">${money(i.price * i.qty)}</p>
      </div>
    `).join("");
    if (totalEl) totalEl.textContent = money(total);
    if (payBtn) payBtn.textContent = "Pagar ahora " + money(total);
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

  const openATHMovil = (totalNumber) => {
    const amount = Number(totalNumber).toFixed(2);
    try { navigator.clipboard.writeText(amount); } catch (_) { /* ignore */ }
    const params = `path=${encodeURIComponent(ATH_PATH)}&amount=${encodeURIComponent(amount)}`;
    const android = /Android/i.test(navigator.userAgent || "");
    const url = android
      ? `intent://pay-business?${params}#Intent;scheme=athmovil;package=com.evertec.athmovil.android;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.evertec.athmovil.android;end`
      : `athmovil://pay-business?${params}`;
    window.location.href = url;
  };

  const openCart = () => {
    closeOverlayIfAny();
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;
    document.body.classList.add("cart-open");
    if (view === "done") setView("list");
    renderLines();
  };

  const closeCart = () => {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    document.body.classList.remove("cart-open");
    setView("list");
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
    if (!$("#tapeo") && cart.length === 0) {
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

  $("[data-cart-lines]", root).addEventListener("click", (e) => {
    const btn = e.target.closest("[data-qty]");
    if (!btn) return;
    const id = btn.closest(".cart-line")?.dataset.id;
    const delta = Number(btn.dataset.qty);
    if (id) changeQty(id, delta);
  });

  $("[data-cart-checkout]", root).addEventListener("click", () => {
    if (!cart.length) return;
    const day = form.elements.dia;
    if (day) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      day.min = today;
      if (!day.value) day.value = today;
    }
    renderSummary();
    setView("checkout");
    form.elements.nombre?.focus();
  });
  $("[data-cart-back]", root).addEventListener("click", () => setView("list"));
  $("[data-open-ath]", root).addEventListener("click", () => openATHMovil(lastTotal));
  root.addEventListener("click", (e) => {
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("[data-cart-error]", root);
    const submit = $("[data-cart-submit]", root);
    err.hidden = true;
    if (!cart.length) {
      err.textContent = "Tu pedido está vacío.";
      err.hidden = false;
      return;
    }
    const data = new FormData(form);
    if (data.get("_honey")) return;
    const totalNum = totalOf(cart);
    lastTotal = totalNum;
    const total = money(totalNum);
    const orderText = cart.map((i) => `${i.qty} × ${i.name} (${money(i.price)})`).join("\n");
    const payload = {
      _subject: "Pedido para recoger — Patio Olivas (ATH Móvil)",
      _template: "table",
      _captcha: "false",
      nombre: data.get("nombre"),
      telefono: data.get("telefono"),
      correo: data.get("correo") || "",
      dia: data.get("dia"),
      hora: data.get("hora"),
      pago: "ATH Móvil",
      path: ATH_PATH,
      notas: data.get("notas") || "",
      pedido: orderText,
      total,
    };
    submit.disabled = true;
    submit.textContent = "Abriendo ATH Móvil…";
    try {
      await fetch(cfg.submitUrl || "https://formsubmit.co/ajax/" + (cfg.email || ""), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (_) {
      /* Still open ATH Móvil so the customer can pay. */
    }
    const thanks = $("[data-cart-thanks]", root);
    const doneTotal = $("[data-done-total]", root);
    thanks.textContent = `Gracias, ${payload.nombre}. Recoges el ${payload.dia} a las ${payload.hora}. Paga ${total} a ${ATH_PATH} en ATH Móvil.`;
    if (doneTotal) doneTotal.textContent = total;
    cart = [];
    saveCart(cart);
    renderLines();
    form.reset();
    setView("done");
    if (isMobile()) openATHMovil(totalNum);
    submit.disabled = false;
    submit.textContent = "Pagar ahora";
  });

  wireMenuItems();
  renderLines();
  if (location.hash === "#pedido") openCart();
})();
