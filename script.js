// ============================================
// MOBILE NAV
// ============================================
const navToggle = document.getElementById("nav-toggle");
const mainNav = document.getElementById("main-nav");

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// ============================================
// CONFIG — edite aqui para ajustar preços
// ============================================
const CONFIG = {
  resinPricePerKg: 290,      // preço médio do kg de resina (sua faixa: 250–350)
  resinEspecialMultiplier: 1.15,
  minimumOrder: 150,
  whatsappNumber: "5511958626251", // WhatsApp: +55 (11) 95862-6251
};

// Categorias e tamanhos com peso estimado de resina (gramas), já incluindo suportes
const CATEGORIES = {
  funko: {
    label: "Funko Pop personalizado",
    sizes: [
      { id: "padrao", label: "Tamanho médio padrão (~10cm, igual ao original)", weight: 150 },
    ],
  },
  escultura: {
    label: "Escultura",
    sizes: [
      { id: "p", label: "Pequena (até 10cm)", weight: 90 },
      { id: "m", label: "Média (10–20cm)", weight: 220 },
      { id: "g", label: "Grande (20–30cm)", weight: 420 },
      { id: "gg", label: "Muito grande (30cm+)", weight: null, consult: true },
    ],
  },
  quadro: {
    label: "Quadro / relevo personalizado",
    sizes: [
      { id: "a5", label: "Pequeno (~A5)", weight: 70 },
      { id: "a4", label: "Médio (~A4)", weight: 140 },
      { id: "a3", label: "Grande (~A3)", weight: 250 },
    ],
  },
  portachaves: {
    label: "Porta-chaves / chaveiro",
    sizes: [
      { id: "unico", label: "Tamanho único", weight: 18 },
    ],
  },
  outro: {
    label: "Outro / vou descrever no pedido",
    sizes: [
      { id: "consulta", label: "Avaliação sob consulta", weight: null, consult: true },
    ],
  },
};

const COMPLEXITY_LABELS = {
  "3.5": "simples",
  "4": "médio",
  "5": "complexo",
};

// ============================================
// STATE
// ============================================
let cart = []; // { id, title, detail, price (number|null) }
let itemCounter = 0;

// ============================================
// DOM REFS
// ============================================
const categoriaSel = document.getElementById("categoria");
const tamanhoSel = document.getElementById("tamanho");
const pesoManualToggle = document.getElementById("peso-manual-toggle");
const pesoManualInput = document.getElementById("peso-manual");
const complexidadeSel = document.getElementById("complexidade");
const resinaEspecialCheck = document.getElementById("resina-especial");
const quantidadeInput = document.getElementById("quantidade");
const estimateReadout = document.getElementById("estimate-readout");
const addItemBtn = document.getElementById("add-item-btn");

const cartListEl = document.getElementById("cart-list");
const cartEmptyEl = document.getElementById("cart-empty");
const cartSubtotalEl = document.getElementById("cart-subtotal");
const cartTotalEl = document.getElementById("cart-total");
const minimoRow = document.getElementById("minimo-row");
const cartMinimoEl = document.getElementById("cart-minimo");

const vatFillEl = document.getElementById("vat-fill");
const vatStatusText = document.getElementById("vat-status-text");

// ============================================
// INIT SELECTS
// ============================================
function initCategorias() {
  Object.entries(CATEGORIES).forEach(([id, cat]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = cat.label;
    categoriaSel.appendChild(opt);
  });
  updateTamanhos();
}

function updateTamanhos() {
  const cat = CATEGORIES[categoriaSel.value];
  tamanhoSel.innerHTML = "";
  cat.sizes.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    tamanhoSel.appendChild(opt);
  });
  updateEstimateReadout();
}

function currentSize() {
  const cat = CATEGORIES[categoriaSel.value];
  return cat.sizes.find((s) => s.id === tamanhoSel.value) || cat.sizes[0];
}

function getEffectiveWeight() {
  if (pesoManualToggle.checked && pesoManualInput.value) {
    return parseFloat(pesoManualInput.value);
  }
  const size = currentSize();
  return size.weight;
}

function getResinPrice() {
  const base = CONFIG.resinPricePerKg;
  return resinaEspecialCheck.checked ? base * CONFIG.resinEspecialMultiplier : base;
}

function computeUnitPrice(weightG, complexityMult) {
  if (!weightG) return null;
  const raw = (weightG / 1000) * getResinPrice() * complexityMult;
  return Math.max(5, Math.round(raw / 5) * 5);
}

function updateEstimateReadout() {
  const size = currentSize();
  const isConsult = size.consult && !(pesoManualToggle.checked && pesoManualInput.value);
  const complexityMult = parseFloat(complexidadeSel.value);
  const qty = Math.max(1, parseInt(quantidadeInput.value || "1", 10));

  if (isConsult) {
    estimateReadout.textContent =
      "Sem peso de referência pra esse item — ele entra como \"sob consulta\" e avaliamos pela descrição e pelas referências que você enviar.";
    return;
  }

  const weight = getEffectiveWeight();
  const unitPrice = computeUnitPrice(weight, complexityMult);
  const totalPrice = unitPrice * qty;
  estimateReadout.innerHTML =
    `~${weight}g de resina por peça · acabamento ${COMPLEXITY_LABELS[String(complexityMult)]} → ` +
    `<strong>R$ ${unitPrice}</strong> cada` +
    (qty > 1 ? ` · ${qty}x = <strong>R$ ${totalPrice}</strong>` : "");
}

// ============================================
// CART
// ============================================
function addItem() {
  const cat = CATEGORIES[categoriaSel.value];
  const size = currentSize();
  const complexityMult = parseFloat(complexidadeSel.value);
  const qty = Math.max(1, parseInt(quantidadeInput.value || "1", 10));
  const manualWeight = pesoManualToggle.checked && pesoManualInput.value ? parseFloat(pesoManualInput.value) : null;
  const isConsult = size.consult && !manualWeight;

  itemCounter++;

  if (isConsult) {
    cart.push({
      id: itemCounter,
      title: `${cat.label}`,
      detail: `${size.label} · ${qty}x · sob consulta`,
      price: null,
      qty,
    });
  } else {
    const weight = manualWeight || size.weight;
    const unitPrice = computeUnitPrice(weight, complexityMult);
    cart.push({
      id: itemCounter,
      title: `${cat.label}`,
      detail: `${size.label} · ~${weight}g · acabamento ${COMPLEXITY_LABELS[String(complexityMult)]}${resinaEspecialCheck.checked ? " · resina especial" : ""} · ${qty}x`,
      price: unitPrice * qty,
      qty,
    });
  }

  renderCart();
  quantidadeInput.value = 1;
}

function removeItem(id) {
  cart = cart.filter((i) => i.id !== id);
  renderCart();
}

function renderCart() {
  cartListEl.querySelectorAll(".cart-item").forEach((el) => el.remove());
  cartEmptyEl.hidden = cart.length > 0;

  cart.forEach((item) => {
    const li = document.createElement("li");
    li.className = "cart-item";
    li.innerHTML = `
      <div class="cart-item-info">
        <strong>${item.title}</strong>
        <span>${item.detail}</span>
      </div>
      <div class="cart-item-right">
        <span class="cart-item-price">${item.price !== null ? "R$ " + item.price : "sob consulta"}</span>
        <button class="cart-remove" type="button" aria-label="Remover item" data-id="${item.id}">✕</button>
      </div>
    `;
    cartListEl.appendChild(li);
  });

  cartListEl.querySelectorAll(".cart-remove").forEach((btn) => {
    btn.addEventListener("click", () => removeItem(parseInt(btn.dataset.id, 10)));
  });

  const subtotal = cart.reduce((sum, i) => sum + (i.price || 0), 0);
  const hasConsultOnly = cart.length > 0 && subtotal === 0;
  const total = subtotal > 0 ? Math.max(CONFIG.minimumOrder, subtotal) : (cart.length > 0 ? CONFIG.minimumOrder : 0);
  const minimoAplicado = subtotal > 0 && subtotal < CONFIG.minimumOrder;

  cartSubtotalEl.textContent = `R$ ${subtotal}`;
  minimoRow.hidden = !minimoAplicado;
  if (minimoAplicado) {
    cartMinimoEl.textContent = `+ R$ ${CONFIG.minimumOrder - subtotal}`;
  }
  cartTotalEl.textContent = hasConsultOnly ? "sob consulta" : `R$ ${total}`;

  updateVat(subtotal, hasConsultOnly, cart.length > 0);
  updateOrderSummary();
}

function updateVat(subtotal, hasConsultOnly, hasItems) {
  const pct = Math.min((subtotal / CONFIG.minimumOrder) * 100, 100);
  vatFillEl.style.height = (hasItems ? Math.max(pct, 8) : 8) + "%";

  const cured = subtotal >= CONFIG.minimumOrder;
  vatFillEl.classList.toggle("is-cured", cured);

  if (!hasItems) {
    vatStatusText.textContent = "Adicione itens pra começar";
  } else if (hasConsultOnly) {
    vatStatusText.textContent = "Itens sob consulta — valor mínimo de R$ 150 ainda se aplica";
  } else if (cured) {
    vatStatusText.textContent = "Pedido curado ✓ valor mínimo atingido";
  } else {
    vatStatusText.textContent = `Faltam R$ ${CONFIG.minimumOrder - subtotal} pro mínimo de R$ ${CONFIG.minimumOrder}`;
  }
}

// ============================================
// ORDER FORM
// ============================================
const resumoBox = document.getElementById("resumo-orcamento");
const orderSummaryBox = document.getElementById("order-summary-box");
const arquivosInput = document.getElementById("arquivos");
const arquivosHint = document.getElementById("arquivos-hint");
const orderForm = document.getElementById("order-form");

function buildSummaryText() {
  if (cart.length === 0) return null;
  const lines = cart.map((i) => `• ${i.title} — ${i.detail} — ${i.price !== null ? "R$ " + i.price : "sob consulta"}`);
  const subtotal = cart.reduce((sum, i) => sum + (i.price || 0), 0);
  const total = subtotal > 0 ? Math.max(CONFIG.minimumOrder, subtotal) : CONFIG.minimumOrder;
  lines.push("");
  lines.push(`Total estimado: ${subtotal > 0 ? "R$ " + total : "sob consulta (mínimo R$ " + CONFIG.minimumOrder + ")"}`);
  return lines.join("\n");
}

function updateOrderSummary() {
  const text = buildSummaryText();
  if (text) {
    resumoBox.hidden = false;
    orderSummaryBox.textContent = text;
  } else {
    resumoBox.hidden = true;
  }
}

arquivosInput.addEventListener("change", () => {
  const n = arquivosInput.files.length;
  arquivosHint.textContent = n === 0
    ? "Nenhum arquivo selecionado ainda."
    : `${n} arquivo${n > 1 ? "s" : ""} selecionado${n > 1 ? "s" : ""} — lembre de anexar no WhatsApp.`;
});

orderForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const nome = document.getElementById("nome").value.trim();
  const whatsapp = document.getElementById("whatsapp").value.trim();
  const descricao = document.getElementById("descricao").value.trim();
  const resumo = buildSummaryText();

  let msg = `Olá! Quero fazer um pedido na Memora Studio.\n\n`;
  msg += `Nome: ${nome}\nContato: ${whatsapp}\n\n`;
  msg += `Descrição:\n${descricao}\n\n`;
  if (resumo) {
    msg += `Pré-orçamento calculado no site:\n${resumo}\n\n`;
  }
  msg += `(Vou anexar fotos/vídeos/arquivo 3D aqui na conversa)`;

  const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
});

// ============================================
// EVENTS
// ============================================
categoriaSel.addEventListener("change", updateTamanhos);
tamanhoSel.addEventListener("change", updateEstimateReadout);
complexidadeSel.addEventListener("change", updateEstimateReadout);
resinaEspecialCheck.addEventListener("change", updateEstimateReadout);
quantidadeInput.addEventListener("input", updateEstimateReadout);
pesoManualToggle.addEventListener("change", () => {
  pesoManualInput.disabled = !pesoManualToggle.checked;
  updateEstimateReadout();
});
pesoManualInput.addEventListener("input", updateEstimateReadout);
addItemBtn.addEventListener("click", addItem);

// ============================================
// INIT
// ============================================
initCategorias();
document.getElementById("ano").textContent = new Date().getFullYear();
