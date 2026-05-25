const SUPABASE_URL = "https://gbzmqlamuimtiunofgxu.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_RWnWRlA_Do1Yb4N9uibZkA_nr1RMx7f";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const PLACEHOLDER_IMAGE =
  "https://placehold.co/600x400/111111/FFFFFF?text=TANIDIK";

const STORAGE_BUCKET = "tanidik-images";
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_VENUE_GALLERY_IMAGES = 10;
const MAX_PRODUCT_GALLERY_IMAGES = 5;
const MAX_PROFILE_AVATAR_IMAGES = 1;

const businessMediaState = {
  venueGallery: {
    photos: [],
    pendingFiles: [],
    removedPhotoIds: [],
  },
  productGallery: {
    photos: [],
    pendingFiles: [],
    removedPhotoIds: [],
  },
};
const VENUE_CATEGORIES = [
  ["night_club", "Night Club"],
  ["bar", "Bar"],
  ["restaurant", "Restaurant"],
  ["cafe", "Cafe"],
  ["beach", "Beach"],
  ["hotel", "Hotel"],
  ["live_music", "Live Music"],
  ["event_venue", "Event Venue"],
  ["sports_fitness", "Sports / Fitness"],
  ["wellness", "Wellness"],
  ["other", "Other"],
];
const DEFAULT_VENUE_CATEGORY = "other";
const BOOKING_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const email = document.getElementById("email");
const password = document.getElementById("password");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");

const createVenueBtn =
  document.getElementById("createVenueBtn");

const createEventBtn =
  document.getElementById("createEventBtn");

const detailFavoriteBtn =
  document.getElementById("detailFavoriteBtn");

let allVenues = [];
let allEvents = [];
let venueStatsById = {};
let eventAttendeeCountsById = {};
let businessDashboardState = {
  session: null,
  businesses: [],
  venues: [],
  events: [],
  reservations: [],
  storeOrders: [],
};
let venueReservationSlotState = {
  venueId: null,
  date: "",
  slots: [],
  selectedSlotTime: "",
  fallbackMode: true,
};
let venueStoreProductsState = [];
let activeVenueStoreProduct = null;
let activeVenueStoreProductTrigger = null;

function getBusinessStatus(business) {
  return safeText(business.status).toLowerCase().trim();
}

function safeText(value) {
  return value || "";
}

function getVenueCategoryValue(venue) {
  const category = safeText(venue && venue.category)
    .toLowerCase()
    .trim();

  return VENUE_CATEGORIES.some(([value]) => value === category)
    ? category
    : DEFAULT_VENUE_CATEGORY;
}

function getVenueCategoryLabel(venue) {
  const category = getVenueCategoryValue(venue);
  const match = VENUE_CATEGORIES.find(
    ([value]) => value === category
  );

  return match ? match[1] : "Other";
}

function getVenueMetaLabel(venue) {
  return [safeText(venue.city), getVenueCategoryLabel(venue)]
    .filter(Boolean)
    .join(" / ");
}

function getImage(image) {
  return image || PLACEHOLDER_IMAGE;
}

async function runSafeInitializer(name, initializer) {
  try {
    await initializer();
  } catch (error) {
    console.log(`${name} failed`, error);
  }
}

function setTextIfPresent(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.innerText = safeText(value);
  }
}

function setImageIfPresent(id, image, fallback) {
  const element = document.getElementById(id);

  if (!element) return;

  element.src = getImage(image);
  element.addEventListener(
    "error",
    () => {
      element.src = fallback || PLACEHOLDER_IMAGE;
    },
    { once: true }
  );
}

function createGalleryPhotoLink(photo) {
  const imageUrl = safeText(photo.image_url || photo.image);

  if (!imageUrl) return null;

  const link = document.createElement("a");
  link.href = imageUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "venue-gallery-item";

  const image = document.createElement("img");
  image.src = getImage(imageUrl);
  image.alt = "Venue gallery photo";
  image.loading = "lazy";
  image.addEventListener(
    "error",
    () => {
      image.src = PLACEHOLDER_IMAGE;
    },
    { once: true }
  );

  link.appendChild(image);
  return link;
}

function renderVenueGallery(photos) {
  const gallery = document.getElementById("venueGallery");

  if (!gallery) return;

  gallery.innerHTML = "";

  const validPhotos = (photos || []).filter((photo) =>
    safeText(photo.image_url || photo.image)
  );

  if (validPhotos.length === 0) {
    gallery.hidden = true;
    return;
  }

  gallery.hidden = false;

  validPhotos.forEach((photo) => {
    const item = createGalleryPhotoLink(photo);

    if (item) {
      gallery.appendChild(item);
    }
  });
}

function setupVenueMenuToggle() {
  const toggle = document.getElementById("venueMenuToggle");
  const panel = document.getElementById("venueMenu");

  if (!toggle || !panel || toggle.dataset.bound === "true") {
    return;
  }

  toggle.dataset.bound = "true";
  toggle.addEventListener("click", () => {
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    toggle.classList.toggle("is-active", !isOpen);
    toggle.setAttribute("aria-expanded", String(!isOpen));
  });
}

function setupVenueStoreToggle() {
  const toggle = document.getElementById("venueStoreToggle");
  const panel = document.getElementById("venueStore");

  if (!toggle || !panel || toggle.dataset.bound === "true") {
    return;
  }

  toggle.dataset.bound = "true";
  toggle.addEventListener("click", () => {
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    toggle.classList.toggle("is-active", !isOpen);
    toggle.setAttribute("aria-expanded", String(!isOpen));
  });
}

function setupVenueStoreAllLink(venueId) {
  const link = document.getElementById("venueStoreAllLink");

  if (!link || !venueId) return;

  link.href = `./store.html?venue=${encodeURIComponent(venueId)}`;
  link.hidden = false;
}

function formatMenuPrice(item) {
  if (item.price === null || item.price === undefined || item.price === "") {
    return "";
  }

  const amount = Number(item.price);

  if (Number.isNaN(amount)) {
    return "";
  }

  return `${amount.toFixed(2)} ${safeText(item.currency) || "TRY"}`;
}

function escapeStoreHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));
}

function getVenueStoreProductById(productId) {
  return venueStoreProductsState.find(
    (product) => String(product.id) === String(productId)
  );
}

const STORE_CART_STOCK_FIELDS = [
  "stock_quantity",
  "stock",
  "inventory",
  "quantity",
];

function getStoreCartProductStockField(product) {
  if (!product) return "";

  return STORE_CART_STOCK_FIELDS.find((field) =>
    Object.prototype.hasOwnProperty.call(product, field)
  ) || "";
}

function getStoreCartProductStockValue(product) {
  const field = getStoreCartProductStockField(product);

  if (!field || !product) return null;

  const value = product[field];

  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isStoreCartProductOutOfStock(product) {
  const stockValue = getStoreCartProductStockValue(product);
  return stockValue !== null && stockValue <= 0;
}

function focusSafely(element) {
  if (!element || typeof element.focus !== "function") return;

  try {
    element.focus({ preventScroll: true });
  } catch (error) {
    element.focus();
  }
}

function ensureVenueStoreCartDrawer() {
  if (!document.getElementById("venueStore")) return null;

  let fab = document.getElementById("storeCartFab");
  let drawer = document.getElementById("storeCartDrawer");
  let backdrop = document.getElementById("storeCartBackdrop");

  if (!fab) {
    fab = document.createElement("button");
    fab.type = "button";
    fab.id = "storeCartFab";
    fab.className = "store-cart-fab";
    fab.setAttribute("aria-label", "Sepeti aç");
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-controls", "storeCartDrawer");
    fab.hidden = true;
    fab.innerHTML =
      '<span class="store-cart-fab-icon" aria-hidden="true">B</span>' +
      '<span class="store-cart-fab-count" id="storeCartCount">0</span>';
    document.body.appendChild(fab);
  }

  if (!drawer) {
    drawer = document.createElement("aside");
    drawer.id = "storeCartDrawer";
    drawer.className = "store-cart-drawer";
    drawer.setAttribute("aria-label", "Shopping cart");
    drawer.hidden = true;
    drawer.innerHTML =
      '<div class="store-cart-inner">' +
        '<div class="store-cart-head">' +
          '<span class="store-kicker">Store Cart</span>' +
          '<h2>Sepet</h2>' +
          '<button class="store-cart-close" id="storeCartClose" type="button" aria-label="Sepeti kapat">×</button>' +
        '</div>' +
        '<div class="store-cart-items" id="storeCartItems"></div>' +
        '<div class="store-cart-footer">' +
          '<div class="store-cart-total">' +
            '<span>Toplam</span>' +
            '<strong id="storeCartTotal">₺0</strong>' +
          '</div>' +
          '<button class="store-checkout-btn" id="venueStoreCartViewBtn" type="button">Sepeti Gör</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(drawer);
  }

  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "storeCartBackdrop";
    backdrop.className = "store-cart-backdrop";
    backdrop.hidden = true;
    document.body.appendChild(backdrop);
  }

  const closeButton = document.getElementById("storeCartClose");
  const viewButton = document.getElementById("venueStoreCartViewBtn");

  if (fab.dataset.venueCartBound !== "true") {
    fab.dataset.venueCartBound = "true";
    fab.addEventListener("click", openVenueStoreCart);
  }

  if (closeButton && closeButton.dataset.venueCartBound !== "true") {
    closeButton.dataset.venueCartBound = "true";
    closeButton.addEventListener("click", closeVenueStoreCart);
  }

  if (backdrop.dataset.venueCartBound !== "true") {
    backdrop.dataset.venueCartBound = "true";
    backdrop.addEventListener("click", closeVenueStoreCart);
  }

  if (viewButton && viewButton.dataset.venueCartBound !== "true") {
    viewButton.dataset.venueCartBound = "true";
    viewButton.addEventListener("click", () => {
      window.location.href = "./store.html";
    });
  }

  return { fab, drawer, backdrop };
}

function readStoreCartStorage() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem("tanidik_store_cart") || "{}"
    );

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    return {};
  }
}

function writeStoreCartStorage(cart) {
  try {
    localStorage.setItem("tanidik_store_cart", JSON.stringify(cart));
  } catch (error) {
    showToast("Sepet kaydedilemedi");
  }
}

function formatStoreProductPrice(price, currency = "TRY") {
  const amount = Number(price || 0);
  const symbols = {
    TRY: "₺",
    USD: "$",
    EUR: "€",
  };

  return `${symbols[currency] || currency}${amount.toLocaleString("tr-TR", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function getVenueStoreProductCartPayload(product) {
  if (!product || !product.id) return null;

  const venue = product.venues || {};
  const business = venue.businesses || {};

  return {
    id: safeText(product.id),
    name: safeText(product.name),
    price:
      product.price === null ||
      product.price === undefined ||
      product.price === ""
        ? null
        : Number(product.price),
    currency: safeText(product.currency) || "TRY",
    image_url: safeText(product.image_url || product.image),
    venue_id: safeText(product.venue_id || venue.id),
    venue_name: safeText(venue.name),
    business_id: safeText(product.business_id || venue.business_id || business.id),
    owner_id: safeText(product.owner_id || product.business_owner_id || business.owner_id),
    quantity: 1,
  };
}

function getVenueStoreCartItems() {
  const cart = readStoreCartStorage();

  return Object.keys(cart)
    .map((id) => {
      const item = cart[id] || {};
      const quantity = typeof item === "number" ? item : item.quantity;

      return {
        ...item,
        id: safeText(item.id || id),
        quantity: Math.max(0, Number(quantity || 0)),
      };
    })
    .filter((item) => item.id && item.quantity > 0);
}

function updateVenueStoreCartUI() {
  const refs = ensureVenueStoreCartDrawer();

  if (!refs) return;

  const items = getVenueStoreCartItems();
  const count = items.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );
  const countElement = document.getElementById("storeCartCount");
  const itemsElement = document.getElementById("storeCartItems");
  const totalElement = document.getElementById("storeCartTotal");
  let total = 0;

  if (countElement) countElement.textContent = String(count);
  refs.fab.hidden = count === 0;

  if (!itemsElement || !totalElement) return;

  itemsElement.innerHTML = "";

  if (items.length === 0) {
    itemsElement.innerHTML =
      '<p class="store-cart-empty">Sepetiniz boş.</p>';
    totalElement.textContent = formatStoreProductPrice(0);
    return;
  }

  items.forEach((item) => {
    const quantity = Number(item.quantity || 0);
    const lineTotal = Number(item.price || 0) * quantity;
    const row = document.createElement("div");
    total += lineTotal;
    row.className = "store-cart-row";
    row.innerHTML =
      (item.image_url
        ? `<img class="store-cart-row-img" src="${escapeStoreHtml(item.image_url)}" alt="" loading="lazy" />`
        : '<span class="store-cart-row-img store-cart-row-img--empty" aria-hidden="true"></span>') +
      '<div class="store-cart-row-info">' +
        `<strong>${escapeStoreHtml(item.name)}</strong>` +
        (item.venue_name ? `<span>${escapeStoreHtml(item.venue_name)}</span>` : "") +
        `<span>${escapeStoreHtml(formatStoreProductPrice(lineTotal, item.currency))}</span>` +
      '</div>' +
      '<div class="store-cart-qty" aria-label="Quantity controls">' +
        `<button class="store-cart-qty-btn" type="button" data-action="decrease" data-id="${escapeStoreHtml(item.id)}" aria-label="Azalt">−</button>` +
        `<span>${quantity}</span>` +
        `<button class="store-cart-qty-btn" type="button" data-action="increase" data-id="${escapeStoreHtml(item.id)}" aria-label="Artır">+</button>` +
      '</div>' +
      `<button class="store-cart-remove" type="button" data-id="${escapeStoreHtml(item.id)}" aria-label="Kaldır">×</button>`;
    itemsElement.appendChild(row);
  });

  totalElement.textContent = formatStoreProductPrice(total);

  itemsElement.querySelectorAll(".store-cart-remove").forEach((button) => {
    button.addEventListener("click", () => {
      removeVenueStoreCartItem(button.dataset.id);
    });
  });

  itemsElement.querySelectorAll(".store-cart-qty-btn").forEach((button) => {
    button.addEventListener("click", () => {
      adjustVenueStoreCartQuantity(
        button.dataset.id,
        button.dataset.action === "increase" ? 1 : -1
      );
    });
  });
}

function setVenueStoreCartQuantity(productId, quantity) {
  const cart = readStoreCartStorage();
  const nextQuantity = Math.max(0, Number(quantity) || 0);
  const product = getVenueStoreProductById(productId);
  const stockValue = getStoreCartProductStockValue(product);

  if (nextQuantity <= 0) {
    delete cart[productId];
  } else if (stockValue !== null && stockValue <= 0) {
    showToast("Ürün stokta yok");
    return;
  } else if (stockValue !== null && nextQuantity > stockValue) {
    showToast("Stok miktarı aşılamaz");
    return;
  } else {
    const existing = cart[productId] || { id: productId };
    cart[productId] = {
      ...existing,
      quantity: nextQuantity,
    };
  }

  writeStoreCartStorage(cart);
  updateVenueStoreCartUI();
}

function adjustVenueStoreCartQuantity(productId, delta) {
  const item = getVenueStoreCartItems().find(
    (cartItem) => String(cartItem.id) === String(productId)
  );

  setVenueStoreCartQuantity(
    productId,
    Number(item && item.quantity ? item.quantity : 0) + delta
  );
}

function removeVenueStoreCartItem(productId) {
  setVenueStoreCartQuantity(productId, 0);
}

function openVenueStoreCart() {
  const refs = ensureVenueStoreCartDrawer();

  if (!refs) return;

  refs.drawer.hidden = false;
  refs.backdrop.hidden = false;
  refs.fab.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    refs.drawer.classList.add("store-cart-drawer--open");
    refs.backdrop.classList.add("store-cart-backdrop--visible");
  });
}

function closeVenueStoreCart() {
  const refs = ensureVenueStoreCartDrawer();

  if (!refs) return;

  refs.drawer.classList.remove("store-cart-drawer--open");
  refs.backdrop.classList.remove("store-cart-backdrop--visible");
  refs.fab.setAttribute("aria-expanded", "false");
  setTimeout(() => {
    refs.drawer.hidden = true;
    refs.backdrop.hidden = true;
  }, 260);
}

function addVenueStoreProductToCart(product) {
  if (isStoreCartProductOutOfStock(product)) {
    showToast("Ürün stokta yok");
    return false;
  }

  const item = getVenueStoreProductCartPayload(product);

  if (!item) {
    showToast("Ürün sepete eklenemedi");
    return false;
  }

  const cart = readStoreCartStorage();
  const existing = cart[item.id] || item;
  const existingQuantity =
    typeof existing === "number" ? existing : existing.quantity;
  const nextQuantity = Math.max(0, Number(existingQuantity || 0)) + 1;
  const stockValue = getStoreCartProductStockValue(product);

  if (stockValue !== null && nextQuantity > stockValue) {
    showToast("Stok miktarı aşılamaz");
    return false;
  }

  cart[item.id] = {
    ...existing,
    ...item,
    quantity: nextQuantity,
  };

  writeStoreCartStorage(cart);
  updateVenueStoreCartUI();
  showToast("Ürün sepete eklendi");
  openVenueStoreCart();
  return true;
}

function addUniqueStoreProductImageUrl(urls, value) {
  const url = safeText(value).trim();

  if (url && !urls.includes(url)) {
    urls.push(url);
  }
}

function collectStoreProductImageUrls(value, urls) {
  if (!value) return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectStoreProductImageUrls(item, urls));
    return;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return;

    if (trimmed.charAt(0) === "[" || trimmed.charAt(0) === "{") {
      try {
        collectStoreProductImageUrls(JSON.parse(trimmed), urls);
        return;
      } catch (error) {
        // Plain URL strings continue below.
      }
    }

    if (trimmed.indexOf("data:") !== 0 && /[\n,]/.test(trimmed)) {
      trimmed.split(/[\n,]/).forEach((item) => {
        addUniqueStoreProductImageUrl(urls, item);
      });
      return;
    }

    addUniqueStoreProductImageUrl(urls, trimmed);
    return;
  }

  if (typeof value === "object") {
    [
      "image_url",
      "image",
      "url",
      "src",
      "publicUrl",
      "path",
      "images",
      "product_images",
      "gallery",
      "gallery_images",
      "image_urls",
    ].forEach((key) => {
      collectStoreProductImageUrls(value[key], urls);
    });
  }
}

function getVenueStoreProductImageUrls(product, extraImages = []) {
  const urls = [];

  [
    "image_url",
    "image",
    "images",
    "product_images",
    "gallery",
    "gallery_images",
    "image_urls",
  ].forEach((key) => {
    collectStoreProductImageUrls(product && product[key], urls);
  });

  collectStoreProductImageUrls(extraImages, urls);
  return urls;
}

function ensureVenueStoreModal() {
  if (!document.getElementById("venueStore")) return null;

  let modalBackdrop = document.getElementById("storeModalBackdrop");
  let modal = document.getElementById("storeModal");

  if (!modalBackdrop) {
    modalBackdrop = document.createElement("div");
    modalBackdrop.id = "storeModalBackdrop";
    modalBackdrop.className = "store-cart-backdrop store-modal-backdrop";
    modalBackdrop.hidden = true;
    document.body.appendChild(modalBackdrop);
  }

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "storeModal";
    modal.className = "store-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "storeModalName");
    modal.hidden = true;
    modal.innerHTML =
      '<div class="store-modal-inner">' +
        '<button class="store-modal-close" id="storeModalClose" type="button" aria-label="Ürün detayını kapat">×</button>' +
        '<div class="store-modal-img" id="storeModalImg"></div>' +
        '<div class="store-modal-body">' +
          '<div class="store-modal-badges" id="storeModalBadges">' +
            '<span class="store-modal-cat" id="storeModalCat"></span>' +
            '<span class="store-modal-stock-badge" id="storeModalStockBadge"></span>' +
          '</div>' +
          '<h2 class="store-modal-name" id="storeModalName"></h2>' +
          '<p class="store-modal-desc" id="storeModalDesc"></p>' +
          '<div class="store-modal-meta">' +
            '<div class="store-modal-meta-row"><span>Fiyat</span><strong id="storeModalPrice"></strong></div>' +
            '<div class="store-modal-meta-row" id="storeModalStockRow"><span>Stok</span><strong id="storeModalStock"></strong></div>' +
            '<div class="store-modal-meta-row" id="storeModalVenueRow"><span>İşletme</span><strong id="storeModalVenue"></strong></div>' +
          '</div>' +
          '<div class="store-modal-actions">' +
            '<button class="store-modal-cta" id="storeModalAddToCart" type="button">Sepete ekle</button>' +
            '<button class="store-modal-message-btn" id="storeModalMessageBtn" type="button">İşletmeye mesaj gönder</button>' +
            '<button class="store-modal-share-btn" id="storeModalShareBtn" type="button">Paylaş</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  const closeButton = document.getElementById("storeModalClose");
  const addButton = document.getElementById("storeModalAddToCart");
  const messageButton = document.getElementById("storeModalMessageBtn");
  const shareButton = document.getElementById("storeModalShareBtn");

  if (closeButton && closeButton.dataset.venueModalBound !== "true") {
    closeButton.dataset.venueModalBound = "true";
    closeButton.addEventListener("click", closeVenueStoreProductModal);
  }

  if (modalBackdrop.dataset.venueModalBound !== "true") {
    modalBackdrop.dataset.venueModalBound = "true";
    modalBackdrop.addEventListener("click", closeVenueStoreProductModal);
  }

  if (addButton && addButton.dataset.venueModalBound !== "true") {
    addButton.dataset.venueModalBound = "true";
    addButton.addEventListener("click", () => {
      if (!activeVenueStoreProduct) {
        showToast("Ürün sepete eklenemedi");
        return;
      }

      if (addVenueStoreProductToCart(activeVenueStoreProduct)) {
        closeVenueStoreProductModal();
      }
    });
  }

  if (messageButton && messageButton.dataset.venueModalBound !== "true") {
    messageButton.dataset.venueModalBound = "true";
    messageButton.addEventListener("click", async () => {
      if (!activeVenueStoreProduct) {
        showToast("İşletmeye mesaj gönderilemedi");
        return;
      }

      messageButton.disabled = true;
      messageButton.textContent = "Açılıyor...";

      try {
        await openStoreProductConversation(activeVenueStoreProduct);
      } catch (error) {
        showToast("İşletmeye mesaj gönderilemedi");
      } finally {
        messageButton.disabled = false;
        messageButton.textContent = "İşletmeye mesaj gönder";
      }
    });
  }

  if (shareButton && shareButton.dataset.venueModalBound !== "true") {
    shareButton.dataset.venueModalBound = "true";
    shareButton.addEventListener("click", async () => {
      shareButton.disabled = true;

      try {
        await shareVenueStoreProduct(activeVenueStoreProduct);
      } finally {
        shareButton.disabled = false;
      }
    });
  }

  if (document.body.dataset.venueStoreModalEscBound !== "true") {
    document.body.dataset.venueStoreModalEscBound = "true";
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        modal &&
        !modal.hidden &&
        document.getElementById("venueStore")
      ) {
        closeVenueStoreProductModal();
      }
    });
  }

  return { modal, modalBackdrop };
}

function renderVenueStoreModalImage(imageUrl, productName) {
  const imageSlot = document.getElementById("storeModalImg");

  if (!imageSlot) return;

  imageSlot.innerHTML = imageUrl
    ? `<img src="${escapeStoreHtml(imageUrl)}" alt="${escapeStoreHtml(productName)}" class="store-modal-main-img" />`
    : '<div class="store-modal-img-placeholder" aria-label="TANIDIK ürün görseli"></div>';

  const image = imageSlot.querySelector("img");

  if (image) {
    image.addEventListener(
      "error",
      () => {
        imageSlot.innerHTML =
          '<div class="store-modal-img-placeholder" aria-label="TANIDIK ürün görseli"></div>';
      },
      { once: true }
    );
  }
}

function renderVenueStoreModalGallery(imageUrls, productName, activeIndex = 0) {
  const imageSlot = document.getElementById("storeModalImg");
  const urls = (imageUrls || []).filter(Boolean);
  let currentIndex = Math.max(
    0,
    Math.min(Number(activeIndex) || 0, Math.max(urls.length - 1, 0))
  );

  if (!imageSlot) return;

  if (urls.length === 0) {
    renderVenueStoreModalImage("", productName);
    return;
  }

  const hasControls = urls.length > 1;

  imageSlot.innerHTML =
    '<div class="store-modal-gallery">' +
      '<div class="store-modal-gallery-main">' +
        `<img src="${escapeStoreHtml(urls[currentIndex])}" class="store-modal-main-img" alt="${escapeStoreHtml(productName)}" />` +
        (hasControls
          ? '<button class="store-gallery-nav store-gallery-nav--prev" type="button" aria-label="Önceki">‹</button>' +
            '<button class="store-gallery-nav store-gallery-nav--next" type="button" aria-label="Sonraki">›</button>'
          : "") +
      '</div>' +
      (hasControls
        ? '<div class="store-modal-thumbs" role="list" aria-label="Ürün görselleri">' +
            urls.map((url, index) =>
              '<button class="store-modal-thumb-btn' +
              (index === currentIndex ? ' store-modal-thumb-btn--active' : '') +
              `" type="button" data-idx="${index}" role="listitem" aria-current="${index === currentIndex ? "true" : "false"}">` +
                `<img src="${escapeStoreHtml(url)}" class="store-modal-thumb" alt="" loading="lazy" />` +
              '</button>'
            ).join("") +
          '</div>'
        : "") +
    '</div>';

  const mainImage = imageSlot.querySelector(".store-modal-main-img");
  const thumbButtons = [
    ...imageSlot.querySelectorAll(".store-modal-thumb-btn"),
  ];

  function setActiveImage(index) {
    currentIndex = (index + urls.length) % urls.length;

    if (mainImage) {
      mainImage.src = urls[currentIndex];
      mainImage.alt = productName || "TANIDIK ürün görseli";
    }

    thumbButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === currentIndex;
      button.classList.toggle("store-modal-thumb-btn--active", isActive);
      button.setAttribute("aria-current", isActive ? "true" : "false");
    });
  }

  if (mainImage) {
    mainImage.addEventListener(
      "error",
      () => {
        renderVenueStoreModalImage("", productName);
      },
      { once: true }
    );
  }

  thumbButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveImage(Number(button.dataset.idx) || 0);
    });
  });

  const previous = imageSlot.querySelector(".store-gallery-nav--prev");
  const next = imageSlot.querySelector(".store-gallery-nav--next");

  if (previous) {
    previous.addEventListener("click", () => setActiveImage(currentIndex - 1));
  }

  if (next) {
    next.addEventListener("click", () => setActiveImage(currentIndex + 1));
  }
}

function getVenueStoreProductShareUrl(product) {
  const url = new URL(window.location.href);
  url.searchParams.set("product", safeText(product && product.id));
  return url.toString();
}

function copyStoreTextFallback(text) {
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "readonly");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  }

  input.remove();
  return copied;
}

async function shareVenueStoreProduct(product) {
  if (!product) {
    showToast("Ürün linki hazırlanamadı");
    return;
  }

  const shareUrl = getVenueStoreProductShareUrl(product);
  const shareTitle = safeText(product.name) || "TANIDIK Store";

  if (navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: `${shareTitle} - TANIDIK Store`,
        url: shareUrl,
      });
      showToast("Paylaşım hazır");
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Ürün linki kopyalandı");
      return;
    }

    showToast(
      copyStoreTextFallback(shareUrl)
        ? "Ürün linki kopyalandı"
        : "Ürün linki kopyalanamadı"
    );
  } catch (error) {
    showToast("Ürün linki kopyalanamadı");
  }
}

function getVenueStoreProductStockLabel(product) {
  const value = getStoreCartProductStockValue(product);

  if (value === null) return "";

  return value > 0 ? `${value} adet` : "Stokta yok";
}

async function loadVenueStoreProductGalleryImages(product) {
  if (!product || !product.id) return [];

  try {
    const { data, error } = await supabaseClient
      .from("venue_product_images")
      .select("image_url, sort_order")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return [];

    return data || [];
  } catch (error) {
    return [];
  }
}

async function openVenueStoreProductModal(productOrId) {
  const product = typeof productOrId === "object"
    ? productOrId
    : getVenueStoreProductById(productOrId);
  const refs = ensureVenueStoreModal();

  if (!product || !refs) return;

  activeVenueStoreProduct = product;
  activeVenueStoreProductTrigger = document.activeElement;

  const categoryName = safeText(
    product.venue_product_categories &&
      product.venue_product_categories.name
  );
  const stockLabel = getVenueStoreProductStockLabel(product);
  const outOfStock = isStoreCartProductOutOfStock(product);
  const venueName = safeText(
    product.venue_name ||
      (product.venues && product.venues.name)
  );
  const modalCat = document.getElementById("storeModalCat");
  const modalStockBadge = document.getElementById("storeModalStockBadge");
  const modalBadges = document.getElementById("storeModalBadges");
  const modalName = document.getElementById("storeModalName");
  const modalDesc = document.getElementById("storeModalDesc");
  const modalPrice = document.getElementById("storeModalPrice");
  const modalStock = document.getElementById("storeModalStock");
  const modalStockRow = document.getElementById("storeModalStockRow");
  const modalVenue = document.getElementById("storeModalVenue");
  const modalVenueRow = document.getElementById("storeModalVenueRow");
  const modalClose = document.getElementById("storeModalClose");
  const modalAddToCart = document.getElementById("storeModalAddToCart");

  renderVenueStoreModalGallery(
    getVenueStoreProductImageUrls(product),
    safeText(product.name)
  );

  if (modalCat) {
    modalCat.textContent = categoryName;
    modalCat.hidden = !categoryName;
  }

  if (modalStockBadge) {
    modalStockBadge.textContent = stockLabel;
    modalStockBadge.hidden = !stockLabel;
    modalStockBadge.classList.toggle(
      "store-modal-badge--soldout",
      outOfStock
    );
  }

  if (modalBadges) modalBadges.hidden = !categoryName && !stockLabel;
  if (modalName) modalName.textContent = safeText(product.name);
  if (modalDesc) {
    modalDesc.textContent =
      safeText(product.description).trim() ||
      "Bu ürün için açıklama yakında eklenecek.";
  }
  if (modalPrice) {
    const hasPrice =
      product.price !== null &&
      product.price !== undefined &&
      product.price !== "";
    modalPrice.textContent = hasPrice
      ? formatStoreProductPrice(product.price, product.currency || "TRY")
      : "Fiyat yakında";
  }

  if (modalStock && modalStockRow) {
    modalStock.textContent = stockLabel;
    modalStockRow.hidden = !stockLabel;
  }

  if (modalAddToCart) {
    modalAddToCart.disabled = outOfStock;
    modalAddToCart.textContent = outOfStock ? "Stokta yok" : "Sepete ekle";
  }

  if (modalVenue && modalVenueRow) {
    modalVenue.textContent = venueName;
    modalVenueRow.hidden = !venueName;
  }

  refs.modal.hidden = false;
  refs.modalBackdrop.hidden = false;
  requestAnimationFrame(() => {
    refs.modal.classList.add("store-modal--open");
    refs.modalBackdrop.classList.add("store-cart-backdrop--visible");
  });
  document.body.style.overflow = "hidden";
  setTimeout(() => focusSafely(modalClose), 0);

  const tableImages = await loadVenueStoreProductGalleryImages(product);

  if (
    activeVenueStoreProduct &&
    String(activeVenueStoreProduct.id) === String(product.id)
  ) {
    const allImages = getVenueStoreProductImageUrls(product, tableImages);

    if (allImages.length > 0) {
      renderVenueStoreModalGallery(allImages, safeText(product.name));
    }
  }
}

function closeVenueStoreProductModal() {
  const modal = document.getElementById("storeModal");
  const backdrop = document.getElementById("storeModalBackdrop");

  if (!modal || modal.hidden) return;

  modal.classList.remove("store-modal--open");
  if (backdrop) {
    backdrop.classList.remove("store-cart-backdrop--visible");
  }
  document.body.style.overflow = "";

  setTimeout(() => {
    modal.hidden = true;
    if (backdrop) backdrop.hidden = true;
    activeVenueStoreProduct = null;
    focusSafely(activeVenueStoreProductTrigger);
    activeVenueStoreProductTrigger = null;
  }, 280);
}

function bindVenueStoreProductCards() {
  document.querySelectorAll(".venue-product-card").forEach((card) => {
    if (card.dataset.venueProductBound === "true") return;

    card.dataset.venueProductBound = "true";
    card.addEventListener("click", () => {
      openVenueStoreProductModal(card.dataset.productId);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openVenueStoreProductModal(card.dataset.productId);
    });
  });
}

function openVenueStoreProductFromUrl() {
  const productId = new URLSearchParams(window.location.search).get("product");

  if (!productId) return;

  const product = getVenueStoreProductById(productId);

  if (product) {
    openVenueStoreProductModal(product);
  }
}

function initVenueStoreProductExperience() {
  if (!document.getElementById("venueStore")) return;

  ensureVenueStoreCartDrawer();
  ensureVenueStoreModal();
  bindVenueStoreProductCards();
  updateVenueStoreCartUI();
  openVenueStoreProductFromUrl();
}

function isStoreProductRecordVisible(product) {
  if (!product || product.deleted_at) return false;

  if (Object.prototype.hasOwnProperty.call(product, "is_active")) {
    return product.is_active !== false;
  }

  if (Object.prototype.hasOwnProperty.call(product, "active")) {
    return product.active !== false;
  }

  if (Object.prototype.hasOwnProperty.call(product, "status")) {
    return !["inactive", "hidden", "disabled", "deleted"].includes(
      safeText(product.status).toLowerCase().trim()
    );
  }

  return true;
}

function isStoreProductMissingFieldError(error, field) {
  const text = [
    error && error.message,
    error && error.details,
    error && error.hint,
    error && error.code,
  ].filter(Boolean).join(" ").toLowerCase();

  return Boolean(
    field &&
    text.includes(String(field).toLowerCase()) &&
    (
      text.includes("column") ||
      text.includes("schema cache") ||
      text.includes("not found")
    )
  );
}

async function fetchDiscoverStorePreviewProducts() {
  const attempts = [
    { field: "is_active", value: true },
    { field: "active", value: true },
    { field: "status", value: "active" },
    null,
  ];

  for (const attempt of attempts) {
    let query = supabaseClient
      .from("venue_products")
      .select("*, venue_product_categories(id, name), venues(id, name, business_id)")
      .order("created_at", { ascending: false })
      .limit(8);

    if (attempt) {
      query = query.eq(attempt.field, attempt.value);
    }

    const result = await query;

    if (!result.error) {
      return {
        data: (result.data || []).filter(isStoreProductRecordVisible),
        error: null,
      };
    }

    if (!attempt || !isStoreProductMissingFieldError(result.error, attempt.field)) {
      return result;
    }
  }

  return { data: [], error: null };
}

function getDiscoverStoreProductCategory(product) {
  return product && product.venue_product_categories
    ? product.venue_product_categories
    : null;
}

function getDiscoverStoreProductVenueName(product) {
  return safeText(
    product &&
      (
        product.venue_name ||
        (product.venues && product.venues.name)
      )
  );
}

function createDiscoverStoreProductCard(product) {
  const card = document.createElement("article");
  const category = getDiscoverStoreProductCategory(product);
  const venueName = getDiscoverStoreProductVenueName(product);
  const imageUrl = safeText(product.image_url || product.image);

  card.className = "discover-store-card";
  card.dataset.productId = safeText(product.id);
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute(
    "aria-label",
    `${safeText(product.name) || "Ürün"} mağaza detayını aç`
  );

  const imageWrap = document.createElement("div");
  imageWrap.className = "discover-store-card-img";

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = getImage(imageUrl);
    image.alt = safeText(product.name);
    image.loading = "lazy";
    image.addEventListener(
      "error",
      () => {
        image.remove();
        imageWrap.classList.add("discover-store-card-img--empty");
      },
      { once: true }
    );
    imageWrap.appendChild(image);
  } else {
    imageWrap.classList.add("discover-store-card-img--empty");
  }

  const body = document.createElement("div");
  body.className = "discover-store-card-body";

  if (category && category.name) {
    const categoryLabel = document.createElement("span");
    categoryLabel.className = "discover-store-card-cat";
    categoryLabel.textContent = safeText(category.name);
    body.appendChild(categoryLabel);
  }

  const title = document.createElement("h3");
  title.textContent = safeText(product.name) || "TANIDIK Store ürünü";
  body.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "discover-store-card-meta";

  const price = document.createElement("strong");
  price.textContent =
    product.price === null ||
    product.price === undefined ||
    product.price === ""
      ? "Fiyat yakında"
      : formatStoreProductPrice(product.price, product.currency || "TRY");
  meta.appendChild(price);

  if (venueName) {
    const venue = document.createElement("span");
    venue.textContent = venueName;
    meta.appendChild(venue);
  }

  body.appendChild(meta);
  card.appendChild(imageWrap);
  card.appendChild(body);

  card.addEventListener("click", () => {
    window.location.href =
      `./store.html?product=${encodeURIComponent(product.id)}`;
  });
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    window.location.href =
      `./store.html?product=${encodeURIComponent(product.id)}`;
  });

  return card;
}

function renderDiscoverStoreCategoryChips(products) {
  const chips = document.getElementById("discoverStoreCategoryChips");

  if (!chips) return;

  chips.innerHTML = "";

  const categories = [];
  const seen = new Set();

  (products || []).forEach((product) => {
    const category = getDiscoverStoreProductCategory(product);
    const id = safeText(category && category.id);

    if (!id || seen.has(id)) return;

    seen.add(id);
    categories.push({
      id,
      name: safeText(category.name) || "Kategori",
    });
  });

  if (categories.length === 0) {
    chips.hidden = true;
    return;
  }

  chips.hidden = false;

  categories.slice(0, 6).forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "discover-store-chip";
    button.textContent = category.name;
    button.addEventListener("click", () => {
      window.location.href =
        `./store.html?category=${encodeURIComponent(category.id)}`;
    });
    chips.appendChild(button);
  });
}

function renderDiscoverStorePreview(products) {
  const section = document.getElementById("discoverShopSection");
  const preview = document.getElementById("discoverStorePreview");

  if (!section || !preview) return;

  preview.innerHTML = "";

  if (!products || products.length === 0) {
    renderEmptyState(
      preview,
      "Mağazada henüz ürün yok.",
      "Yeni ürünler eklendiğinde burada görünecek."
    );
    renderDiscoverStoreCategoryChips([]);
    return;
  }

  renderDiscoverStoreCategoryChips(products);

  const fragment = document.createDocumentFragment();

  products.slice(0, 8).forEach((product) => {
    fragment.appendChild(createDiscoverStoreProductCard(product));
  });

  preview.appendChild(fragment);
}

async function initDiscoverStorePreview() {
  const section = document.getElementById("discoverShopSection");
  const preview = document.getElementById("discoverStorePreview");

  if (!section || !preview) return;

  renderEmptyState(preview, "Mağaza ürünleri yükleniyor...");

  try {
    const result = await fetchDiscoverStorePreviewProducts();

    if (result.error) {
      console.warn("Discover store preview could not be loaded.", result.error);
      section.hidden = true;
      return;
    }

    renderDiscoverStorePreview(result.data || []);
  } catch (error) {
    console.warn("Discover store preview could not be loaded.", error);
    section.hidden = true;
  }
}

function createVenueProductCard(product) {
  const card = document.createElement("article");
  const stockValue = getStoreCartProductStockValue(product);
  const outOfStock = isStoreCartProductOutOfStock(product);
  card.className =
    "venue-menu-item venue-product-card" +
    (outOfStock ? " venue-product-card--out-of-stock" : "");
  card.dataset.productId = safeText(product.id);
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute(
    "aria-label",
    `${safeText(product.name) || "Ürün"} detayını aç`
  );

  if (product.image_url) {
    card.classList.add("venue-menu-item--with-image");
    const image = document.createElement("img");
    image.src = getImage(product.image_url);
    image.alt = safeText(product.name);
    image.loading = "lazy";
    card.appendChild(image);
  }

  const content = document.createElement("div");
  const header = document.createElement("div");
  header.className = "venue-menu-item-header";

  const title = document.createElement("h4");
  title.textContent = safeText(product.name);
  header.appendChild(title);

  const price = formatMenuPrice(product);

  if (price) {
    const priceElement = document.createElement("strong");
    priceElement.textContent = price;
    header.appendChild(priceElement);
  }

  content.appendChild(header);

  if (product.description) {
    const description = document.createElement("p");
    description.textContent = safeText(product.description);
    content.appendChild(description);
  }

  if (stockValue !== null) {
    const stock = document.createElement("span");
    stock.className =
      "venue-product-stock" +
      (outOfStock ? " venue-product-stock--out" : "");
    stock.textContent = outOfStock ? "Stokta yok" : `${stockValue} in stock`;
    content.appendChild(stock);
  }

  card.appendChild(content);
  return card;
}

function renderVenueStore(productData) {
  const panel = document.getElementById("venueStore");

  if (!panel) return;

  panel.innerHTML = "";

  const categories = productData.categories || [];
  const products = (productData.products || []).map((product) => ({
    ...product,
    venue_product_categories:
      categories.find(
        (category) => String(category.id) === String(product.category_id || "")
      ) || null,
  }));
  venueStoreProductsState = products;

  if (categories.length === 0 && products.length === 0) {
    renderEmptyState(panel, "No products yet.", "Products will appear here when available.");
    initVenueStoreProductExperience();
    return;
  }

  categories.forEach((category) => {
    const group = document.createElement("section");
    group.className = "venue-menu-group venue-product-group";

    const title = document.createElement("h3");
    title.textContent = safeText(category.name);
    group.appendChild(title);

    const groupProducts = products.filter(
      (product) => String(product.category_id || "") === String(category.id)
    );

    if (groupProducts.length === 0) {
      renderEmptyState(group, "No products yet.");
    } else {
      groupProducts.forEach((product) => {
        group.appendChild(createVenueProductCard(product));
      });
    }

    panel.appendChild(group);
  });

  const uncategorized = products.filter((product) => !product.category_id);

  if (uncategorized.length > 0) {
    const group = document.createElement("section");
    group.className = "venue-menu-group venue-product-group";

    const title = document.createElement("h3");
    title.textContent = "Store";
    group.appendChild(title);

    uncategorized.forEach((product) => {
      group.appendChild(createVenueProductCard(product));
    });

    panel.appendChild(group);
  }

  initVenueStoreProductExperience();
}

async function loadVenueProducts(venueId) {
  if (!venueId) return { categories: [], products: [] };

  try {
    const [categoriesResult, productsResult] = await Promise.all([
      supabaseClient
        .from("venue_product_categories")
        .select("*")
        .eq("venue_id", venueId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabaseClient
        .from("venue_products")
        .select("*")
        .eq("venue_id", venueId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (categoriesResult.error || productsResult.error) {
      console.warn(
        "Venue products could not be loaded.",
        categoriesResult.error || productsResult.error
      );
      return { categories: [], products: [] };
    }

    return {
      categories: categoriesResult.data || [],
      products: (productsResult.data || []).filter(
        (product) => !product.deleted_at
      ),
    };
  } catch (error) {
    console.warn("Venue products could not be loaded.", error);
    return { categories: [], products: [] };
  }
}

function createVenueMenuItem(item) {
  const card = document.createElement("article");
  card.className = "venue-menu-item";

  if (item.image_url) {
    card.classList.add("venue-menu-item--with-image");
    const image = document.createElement("img");
    image.src = getImage(item.image_url);
    image.alt = safeText(item.name);
    image.loading = "lazy";
    card.appendChild(image);
  }

  const content = document.createElement("div");

  const header = document.createElement("div");
  header.className = "venue-menu-item-header";

  const title = document.createElement("h4");
  title.textContent = safeText(item.name);
  header.appendChild(title);

  const price = formatMenuPrice(item);

  if (price) {
    const priceElement = document.createElement("strong");
    priceElement.textContent = price;
    header.appendChild(priceElement);
  }

  content.appendChild(header);

  if (item.description) {
    const description = document.createElement("p");
    description.textContent = safeText(item.description);
    content.appendChild(description);
  }

  card.appendChild(content);
  return card;
}

function renderVenueMenu(menuData) {
  const panel = document.getElementById("venueMenu");

  if (!panel) return;

  panel.innerHTML = "";

  const categories = menuData.categories || [];
  const items = menuData.items || [];

  if (categories.length === 0 && items.length === 0) {
    renderEmptyState(panel, "No menu yet.", "Menu items will appear here when available.");
    return;
  }

  categories.forEach((category) => {
    const group = document.createElement("section");
    group.className = "venue-menu-group";

    const title = document.createElement("h3");
    title.textContent = safeText(category.name);
    group.appendChild(title);

    const groupItems = items.filter(
      (item) => String(item.category_id || "") === String(category.id)
    );

    if (groupItems.length === 0) {
      renderEmptyState(group, "No items yet.");
    } else {
      groupItems.forEach((item) => {
        group.appendChild(createVenueMenuItem(item));
      });
    }

    panel.appendChild(group);
  });

  const uncategorized = items.filter((item) => !item.category_id);

  if (uncategorized.length > 0) {
    const group = document.createElement("section");
    group.className = "venue-menu-group";

    const title = document.createElement("h3");
    title.textContent = "Menu";
    group.appendChild(title);

    uncategorized.forEach((item) => {
      group.appendChild(createVenueMenuItem(item));
    });

    panel.appendChild(group);
  }
}

async function loadVenueMenu(venueId) {
  if (!venueId) return { categories: [], items: [] };

  try {
    const [categoriesResult, itemsResult] = await Promise.all([
      supabaseClient
        .from("venue_menu_categories")
        .select("*")
        .eq("venue_id", venueId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabaseClient
        .from("venue_menu_items")
        .select("*")
        .eq("venue_id", venueId)
        .eq("is_available", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (categoriesResult.error || itemsResult.error) {
      console.warn(
        "Venue menu could not be loaded.",
        categoriesResult.error || itemsResult.error
      );
      return { categories: [], items: [] };
    }

    return {
      categories: categoriesResult.data || [],
      items: itemsResult.data || [],
    };
  } catch (error) {
    console.warn("Venue menu could not be loaded.", error);
    return { categories: [], items: [] };
  }
}

function renderDetailUnavailable(title, message) {
  const detail =
    document.querySelector(".venue-details") ||
    document.querySelector("main");

  if (detail) {
    renderEmptyState(detail, title, message);
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  const authMessage = document.getElementById("authMessage");

  if (authMessage) {
    authMessage.textContent = safeText(message);
  }

  if (!toast) {
    alert(message);
    return;
  }

  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function showSafeError(error, fallback) {
  if (error) {
    console.log(error);
  }

  showToast(fallback || "Something went wrong. Please try again.");
}

async function getSafeSession() {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    return session;
  } catch (error) {
    console.log(error);
    showToast("Session unavailable. Please login again.");
    return null;
  }
}

async function runGuardedFormSubmit(event, handler) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!form || form.dataset.submitting === "true") {
    return;
  }

  const buttons = form.querySelectorAll("button");
  form.dataset.submitting = "true";
  buttons.forEach((button) => {
    button.disabled = true;
  });

  try {
    await handler(event);
  } finally {
    form.dataset.submitting = "false";
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

async function createNotification(
  userId,
  type,
  title,
  message = "",
  linkUrl = ""
) {
  if (!userId) return false;

  const payloads = [
    {
      target_user_id: userId,
      type,
      title,
      message,
      link_url: linkUrl,
    },
    {
      target_user_id: userId,
      notification_type: type,
      title,
      message,
      link_url: linkUrl,
    },
    {
      user_id: userId,
      notification_type: type,
      title,
      message,
      link_url: linkUrl,
    },
  ];

  let lastError = null;

  for (const payload of payloads) {
    let error = null;

    try {
      ({ error } = await supabaseClient.rpc(
        "create_notification",
        payload
      ));
    } catch (rpcError) {
      error = rpcError;
    }

    if (!error) return true;

    lastError = error;
  }

  if (lastError) {
    console.warn(lastError);
  }

  return false;
}

async function createStoreOrderNotification(
  userId,
  type,
  title,
  message = "",
  linkUrl = "",
  metadata = {}
) {
  if (!userId) return false;

  try {
    const { error } = await supabaseClient.rpc(
      "create_store_order_notification",
      {
        target_user_id: userId,
        notification_type: type,
        notification_title: title,
        notification_message: message,
        notification_link_url: linkUrl,
        notification_metadata:
          metadata && typeof metadata === "object" ? metadata : {},
      }
    );

    if (!error) return true;
  } catch (error) {
    // Optional SQL may not be installed; fall back to the existing notification helper.
  }

  return createNotification(userId, type, title, message, linkUrl);
}

function showMessage(message) {
  const favoritesMessage =
    document.getElementById("favoritesMessage");

  if (favoritesMessage) {
    favoritesMessage.innerText = message;
  }
}

function renderEmptyState(container, title, message) {
  container.innerHTML = "";

  const emptyState = document.createElement("div");
  emptyState.className = "empty-state";

  const heading = document.createElement("h2");
  heading.textContent = title;
  emptyState.appendChild(heading);

  if (message) {
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    emptyState.appendChild(paragraph);
  }

  container.appendChild(emptyState);
}

function createCardImage(image, altText) {
  const imageElement = document.createElement("img");
  imageElement.src = getImage(image);
  imageElement.alt = altText || "";
  imageElement.addEventListener(
    "error",
    () => {
      imageElement.src = PLACEHOLDER_IMAGE;
    },
    { once: true }
  );

  return imageElement;
}

function getEmptyVenueStats() {
  return {
    averageRating: 0,
    reviewCount: 0,
    favoriteCount: 0,
  };
}

function getVenueStats(venueId) {
  return (
    venueStatsById[String(venueId)] || getEmptyVenueStats()
  );
}

function createVenueStatsBadges(stats) {
  const venueStats = {
    ...getEmptyVenueStats(),
    ...(stats || {}),
  };

  const statsRow = document.createElement("div");
  statsRow.className = "venue-stats";

  const ratingBadge = document.createElement("span");
  ratingBadge.className = "venue-stat-badge";
  ratingBadge.textContent = venueStats.reviewCount
    ? `${venueStats.averageRating.toFixed(1)} / 5`
    : "No ratings";
  statsRow.appendChild(ratingBadge);

  const favoriteBadge = document.createElement("span");
  favoriteBadge.className = "venue-stat-badge";
  const favoriteLabel =
    venueStats.favoriteCount === 1
      ? "favorite"
      : "favorites";
  favoriteBadge.textContent =
    `${venueStats.favoriteCount} ${favoriteLabel}`;
  statsRow.appendChild(favoriteBadge);

  return statsRow;
}

function createVenueCard(venue, options = {}) {
  const card = document.createElement("div");
  card.className = "venue-card";

  if (options.favoriteCardId) {
    card.id = `favorite-${venue.id}`;
  }

  card.addEventListener("click", () => {
    openVenue(venue.id);
  });

  card.appendChild(
    createCardImage(venue.image, safeText(venue.name))
  );

  const content = document.createElement("div");
  content.className = "venue-content";

  const title = document.createElement("h2");
  title.textContent = safeText(venue.name);
  content.appendChild(title);

  const meta = document.createElement("span");
  meta.className = "venue-meta";
  meta.textContent = getVenueMetaLabel(venue);
  content.appendChild(meta);

  if (options.stats) {
    content.appendChild(
      createVenueStatsBadges(options.stats)
    );
  }

  const description = document.createElement("p");
  description.textContent = safeText(venue.description);
  content.appendChild(description);

  if (options.showFavoriteButton) {
    const favoriteButton = document.createElement("button");
    favoriteButton.className = "btn";
    favoriteButton.textContent = "Favorite";
    favoriteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      addFavorite(venue.id);
    });
    content.appendChild(favoriteButton);
  }

  if (options.showRemoveButton) {
    const removeButton = document.createElement("button");
    removeButton.className = "favorite-remove-btn";
    removeButton.textContent = "Remove Favorite";
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removeFavorite(venue.id);
    });
    content.appendChild(removeButton);
  }

  card.appendChild(content);

  return card;
}

function createEventCard(eventItem, options = {}) {
  const card = document.createElement("div");
  card.className = "venue-card";

  card.addEventListener("click", () => {
    openEvent(eventItem.id);
  });

  card.appendChild(
    createCardImage(eventItem.image, safeText(eventItem.title))
  );

  const content = document.createElement("div");
  content.className = "venue-content";

  const title = document.createElement("h2");
  title.textContent = safeText(eventItem.title);
  content.appendChild(title);

  const meta = document.createElement("span");
  meta.className = "venue-meta";
  const dateFallback =
    Object.prototype.hasOwnProperty.call(
      options,
      "dateFallback"
    )
      ? options.dateFallback
      : "Date not set";
  meta.textContent =
    safeText(eventItem.event_date) || dateFallback;
  content.appendChild(meta);
  content.appendChild(
    createEventCountdownBadge(eventItem.event_date)
  );
  content.appendChild(
    createEventAttendeeBadge(eventItem.id)
  );

  const description = document.createElement("p");
  description.textContent = safeText(eventItem.description);
  content.appendChild(description);

  card.appendChild(content);

  return card;
}

function getEventCountdownLabel(eventDate) {
  if (!eventDate) return "Date not set";

  const event = new Date(eventDate);

  if (Number.isNaN(event.getTime())) {
    return "Date not set";
  }

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const eventStart = new Date(
    event.getFullYear(),
    event.getMonth(),
    event.getDate()
  );

  const diffDays = Math.round(
    (eventStart - todayStart) / 86400000
  );

  if (diffDays < 0) return "Past event";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";

  return `${diffDays} days left`;
}

function createEventCountdownBadge(eventDate) {
  const badge = document.createElement("span");
  badge.className = "event-countdown-badge";
  badge.textContent = getEventCountdownLabel(eventDate);

  return badge;
}

function getEventAttendeeCount(eventId) {
  return eventAttendeeCountsById[String(eventId)] || 0;
}

function createEventAttendeeBadge(eventId) {
  const count = getEventAttendeeCount(eventId);
  const badge = document.createElement("span");
  badge.className = "event-attendee-badge";
  badge.textContent = `${count} attending`;

  return badge;
}

function hasValidCoordinate(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function getMapQuery(venue) {
  if (hasValidCoordinate(venue.latitude, venue.longitude)) {
    return `${Number(venue.latitude)},${Number(venue.longitude)}`;
  }

  if (venue.address) {
    return venue.address;
  }

  return "";
}

function renderVenueLocation(venue) {
  const section =
    document.getElementById("venueLocationSection");

  if (!section) return;

  const query = getMapQuery(venue);

  if (!query) {
    section.style.display = "none";
    return;
  }

  const encodedQuery = encodeURIComponent(query);
  const address = document.getElementById("venueAddress");
  const map = document.getElementById("venueMap");
  const link = document.getElementById("venueMapsLink");

  section.style.display = "";

  if (address) {
    address.innerText =
      safeText(venue.address) || query;
  }

  if (map) {
    map.src =
      `https://www.google.com/maps?q=${encodedQuery}&output=embed`;
    map.title =
      `${safeText(venue.name) || "Venue"} location`;
  }

  if (link) {
    link.href =
      `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  }
}

async function loadEventAttendeeCounts(eventIds) {
  const uniqueEventIds = [
    ...new Set(eventIds.filter(Boolean)),
  ];

  if (uniqueEventIds.length === 0) {
    return {};
  }

  let data = [];
  let error = null;

  try {
    ({ data, error } = await supabaseClient
      .from("event_attendees")
      .select("event_id")
      .in("event_id", uniqueEventIds));
  } catch (requestError) {
    error = requestError;
  }

  if (error) {
    showSafeError(error, "Attendance unavailable.");
    return {};
  }

  const counts = {};

  uniqueEventIds.forEach((eventId) => {
    counts[String(eventId)] = 0;
  });

  (data || []).forEach((attendee) => {
    const eventId = String(attendee.event_id);

    if (Object.prototype.hasOwnProperty.call(counts, eventId)) {
      counts[eventId] += 1;
    }
  });

  return counts;
}

async function getEventAttendanceState(eventId) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  const count = getEventAttendeeCount(eventId);

  if (!session) {
    return {
      count,
      isAttending: false,
      session: null,
    };
  }

  const { data, error } =
    await supabaseClient
      .from("event_attendees")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", session.user.id)
      .maybeSingle();

  if (error) {
    showSafeError(error, "Attendance status could not be loaded.");
  }

  return {
    count,
    isAttending: Boolean(data),
    session,
  };
}

function renderEventAttendance(eventId, state) {
  const attendanceContainer =
    document.getElementById("eventAttendance");

  if (!attendanceContainer) return;

  attendanceContainer.innerHTML = "";

  const badge = createEventAttendeeBadge(eventId);
  attendanceContainer.appendChild(badge);

  const button = document.createElement("button");
  button.type = "button";
  button.className = state.isAttending
    ? "secondary-btn"
    : "btn";
  button.textContent = state.isAttending
    ? "Cancel attending"
    : "I'm attending";
  button.addEventListener("click", () => {
    if (state.isAttending) {
      cancelEventAttendance(eventId);
    } else {
      attendEvent(eventId);
    }
  });

  attendanceContainer.appendChild(button);
}

async function refreshEventAttendance(eventId) {
  eventAttendeeCountsById = {
    ...eventAttendeeCountsById,
    ...(await loadEventAttendeeCounts([eventId])),
  };

  const state = await getEventAttendanceState(eventId);
  renderEventAttendance(eventId, state);
}

async function attendEvent(eventId) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    showToast("Login required");
    return;
  }

  const { error } =
    await supabaseClient
      .from("event_attendees")
      .upsert(
        {
          event_id: eventId,
          user_id: session.user.id,
        },
        {
          onConflict: "event_id,user_id",
        }
      );

  if (error) {
    showSafeError(error, "Attendance could not be saved.");
    return;
  }

  showToast("You're attending");
  await refreshEventAttendance(eventId);
}

async function cancelEventAttendance(eventId) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    showToast("Login required");
    return;
  }

  const { error } =
    await supabaseClient
      .from("event_attendees")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", session.user.id);

  if (error) {
    showSafeError(error, "Attendance could not be canceled.");
    return;
  }

  showToast("Attendance canceled");
  await refreshEventAttendance(eventId);
}

function formatReviewDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString();
}

function updateAverageRating(reviews) {
  const averageRating =
    document.getElementById("venueAverageRating");

  if (!averageRating) return;

  const venueId = averageRating.dataset.venueId;
  const stats = venueId
    ? getVenueStats(venueId)
    : getEmptyVenueStats();

  averageRating.innerHTML = "";
  averageRating.appendChild(createVenueStatsBadges(stats));
}

function renderVenueReviews(reviews) {
  const reviewsContainer =
    document.getElementById("venueReviews");

  if (!reviewsContainer) return;

  reviewsContainer.innerHTML = "";

  if (!reviews || reviews.length === 0) {
    renderEmptyState(
      reviewsContainer,
      "No reviews yet",
      "Be the first to review this venue."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  reviews.forEach((review) => {
    const card = document.createElement("div");
    card.className = "review-card";

    const header = document.createElement("div");
    header.className = "review-card-header";

    const rating = document.createElement("span");
    rating.className = "review-rating";
    rating.textContent = `${review.rating} / 5`;
    header.appendChild(rating);

    const date = document.createElement("span");
    date.className = "review-date";
    date.textContent = formatReviewDate(review.created_at);
    header.appendChild(date);

    const text = document.createElement("p");
    text.textContent = safeText(review.review);

    card.appendChild(header);
    card.appendChild(text);

    if (review.user_id) {
      const profileLink = createUserProfileLink(review.user_id);

      if (profileLink) {
        card.appendChild(profileLink);
      }
    }

    fragment.appendChild(card);
  });

  reviewsContainer.appendChild(fragment);
}

function buildVenueStats(venueIds, reviews, favorites) {
  const statsById = {};

  venueIds.forEach((venueId) => {
    statsById[String(venueId)] = getEmptyVenueStats();
  });

  (reviews || []).forEach((review) => {
    const venueId = String(review.venue_id);
    const stats = statsById[venueId];

    if (!stats) return;

    stats.reviewCount += 1;
    stats.averageRating += Number(review.rating || 0);
  });

  Object.values(statsById).forEach((stats) => {
    if (stats.reviewCount > 0) {
      stats.averageRating =
        stats.averageRating / stats.reviewCount;
    }
  });

  (favorites || []).forEach((favorite) => {
    const venueId = String(favorite.venue_id);
    const stats = statsById[venueId];

    if (!stats) return;

    stats.favoriteCount += 1;
  });

  return statsById;
}

async function loadVenueStats(venueIds) {
  const uniqueVenueIds = [
    ...new Set(venueIds.filter(Boolean)),
  ];

  if (uniqueVenueIds.length === 0) {
    return {};
  }

  let reviewsResult = { data: [], error: null };
  let favoritesResult = { data: [], error: null };

  try {
    [reviewsResult, favoritesResult] = await Promise.all([
      supabaseClient
        .from("venue_reviews")
        .select("venue_id, rating")
        .in("venue_id", uniqueVenueIds),
      supabaseClient
        .from("favorites")
        .select("venue_id")
        .in("venue_id", uniqueVenueIds),
    ]);
  } catch (requestError) {
    console.log(requestError);
    showToast(requestError.message || "Venue stats unavailable");
    return buildVenueStats(uniqueVenueIds, [], []);
  }

  if (reviewsResult.error) {
    showSafeError(reviewsResult.error, "Venue stats could not be loaded.");
  }

  if (favoritesResult.error) {
    showSafeError(favoritesResult.error, "Venue stats could not be loaded.");
  }

  return buildVenueStats(
    uniqueVenueIds,
    reviewsResult.data || [],
    favoritesResult.data || []
  );
}

async function loadVenueReviews(venueId) {
  const reviewsContainer =
    document.getElementById("venueReviews");

  if (!reviewsContainer) return;

  renderEmptyState(reviewsContainer, "Loading reviews...");

  const { data: reviews, error } =
    await supabaseClient
      .from("venue_reviews")
      .select("*")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false });

  if (error) {
    showSafeError(error, "Reviews could not be loaded.");
    return;
  }

  updateAverageRating(reviews || []);
  renderVenueReviews(reviews || []);
}

async function setupVenueReviewForm(venueId) {
  const reviewForm = document.getElementById("reviewForm");
  const reviewRating =
    document.getElementById("reviewRating");
  const reviewText = document.getElementById("reviewText");
  const reviewMessage =
    document.getElementById("reviewMessage");

  if (!reviewForm || !reviewRating || !reviewText) return;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    if (reviewMessage) {
      reviewMessage.innerText =
        "Login to write a review.";
    }
  } else if (reviewMessage) {
    reviewMessage.innerText =
      "Submit again to update your review.";
  }

  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!session) {
      showToast("Login required");
      return;
    }

    const rating = Number(reviewRating.value);
    const review = reviewText.value.trim();

    if (rating < 1 || rating > 5) {
      showToast("Choose a rating from 1 to 5");
      return;
    }

    if (!review) {
      showToast("Write a short review");
      return;
    }

    const { error } =
      await supabaseClient
        .from("venue_reviews")
        .upsert(
          {
            venue_id: venueId,
            user_id: session.user.id,
            rating,
            review,
          },
          {
            onConflict: "venue_id,user_id",
          }
        );

    if (error) {
      showSafeError(error, "Review could not be saved.");
      return;
    }

    showToast("Review saved");
    venueStatsById = {
      ...venueStatsById,
      ...(await loadVenueStats([venueId])),
    };
    await loadVenueReviews(venueId);
  });
}

function getReservationStatusClass(status) {
  return `status-${getReservationStatusValue(status)}`;
}

function getReservationStatusValue(status) {
  const value =
    safeText(status).toLowerCase().trim() || "pending";

  return ["pending", "approved", "rejected", "cancelled"]
    .includes(value)
    ? value
    : "pending";
}

function getReservationStatusLabel(status) {
  const value = getReservationStatusValue(status);
  const labels = {
    pending: "Waiting approval",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };

  return labels[value] || value.charAt(0).toUpperCase() + value.slice(1);
}

function createStatusBadge(status) {
  const badge = document.createElement("span");
  badge.className =
    `status-badge ${getReservationStatusClass(status)}`;
  badge.textContent = getReservationStatusLabel(status);

  return badge;
}

function isPendingReservation(reservation) {
  return getReservationStatusValue(reservation.status) === "pending";
}

function getReservationTitle(reservation, options = {}) {
  if (options.showVenue && reservation.venue_name) {
    return safeText(reservation.venue_name);
  }

  return "Reservation request";
}

function createReservationMeta(label, value) {
  const item = document.createElement("div");
  item.className = "reservation-meta-item";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  item.appendChild(labelElement);

  const valueElement = document.createElement("strong");
  valueElement.textContent = safeText(value) || "Not set";
  item.appendChild(valueElement);

  return item;
}

function getReservationGuestLabel(reservation) {
  return (
    safeText(reservation.customer_name) ||
    safeText(reservation.guest_name) ||
    safeText(reservation.full_name) ||
    safeText(reservation.name) ||
    safeText(reservation.customer_email) ||
    safeText(reservation.guest_email) ||
    safeText(reservation.user_email) ||
    safeText(reservation.email) ||
    (reservation.user_id
      ? `Guest #${String(reservation.user_id).slice(0, 8)}`
      : "Guest")
  );
}

function createReservationNote(noteText) {
  const note = document.createElement("div");
  note.className = "reservation-note";

  const label = document.createElement("span");
  label.textContent = "Request";
  note.appendChild(label);

  const text = document.createElement("p");
  text.textContent = safeText(noteText);
  note.appendChild(text);

  return note;
}

function createReservationActions() {
  const actions = document.createElement("div");
  actions.className = "reservation-actions admin-item-actions";

  return actions;
}

function bindReservationAction(button, action) {
  button.addEventListener("click", async () => {
    if (button.disabled) return;

    button.disabled = true;

    try {
      await action();
    } finally {
      button.disabled = false;
    }
  });
}

function createReservationCard(reservation, options = {}) {
  const card = document.createElement("div");
  card.className =
    `reservation-card ${getReservationStatusClass(
      reservation.status
    )}`;

  const header = document.createElement("div");
  header.className = "reservation-card-header";

  const title = document.createElement("h3");
  title.textContent = getReservationTitle(
    reservation,
    options
  );
  header.appendChild(title);
  header.appendChild(createStatusBadge(reservation.status));

  const meta = document.createElement("div");
  meta.className = "reservation-meta-grid";
  meta.appendChild(
    createReservationMeta(
      "Date",
      reservation.reservation_date
    )
  );
  meta.appendChild(
    createReservationMeta(
      "Time",
      reservation.reservation_time
    )
  );
  meta.appendChild(
    createReservationMeta(
      "Guests",
      `${reservation.party_size || 0}`
    )
  );

  card.appendChild(header);
  card.appendChild(meta);

  if (reservation.note) {
    card.appendChild(createReservationNote(reservation.note));
  }

  if (reservation.user_id) {
    const actions = createReservationActions();
    const profileLink = createUserProfileLink(
      reservation.user_id
    );

    if (profileLink) {
      actions.appendChild(profileLink);
      card.appendChild(actions);
    }
  }

  if (options.allowCancel && isPendingReservation(reservation)) {
    const actions =
      card.querySelector(".reservation-actions") ||
      createReservationActions();
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "reservation-cancel-btn";
    cancelButton.textContent = "Cancel";
    bindReservationAction(cancelButton, () => {
      cancelUserReservation(
        reservation.id,
        options.onCancel
      );
    });
    actions.appendChild(cancelButton);

    if (!actions.parentElement) {
      card.appendChild(actions);
    }
  }

  return card;
}

function renderUserReservations(reservations) {
  const reservationsContainer =
    document.getElementById("userReservations");

  if (!reservationsContainer) return;

  reservationsContainer.innerHTML = "";

  if (!reservations || reservations.length === 0) {
    renderEmptyState(
      reservationsContainer,
      "No reservations yet",
      "Your reservation requests for this venue will appear here."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  reservations.forEach((reservation) => {
    fragment.appendChild(
      createReservationCard(reservation, {
        allowCancel: true,
        onCancel: () => loadUserReservations(reservation.venue_id),
      })
    );
  });

  reservationsContainer.appendChild(fragment);
}

async function cancelUserReservation(
  reservationId,
  onComplete
) {
  if (!confirm("Cancel this reservation?")) return;

  let error = null;

  try {
    ({ error } = await supabaseClient.rpc(
      "cancel_pending_reservation",
      {
        reservation_id: reservationId,
      }
    ));
  } catch (rpcError) {
    error = rpcError;
  }

  if (error) {
    console.log(error);
    showToast(error.message || "Reservation unavailable");
    return;
  }

  showToast("Reservation cancelled");

  if (onComplete) {
    await onComplete();
  }
}

function getReservationNotificationTitle(status) {
  return status === "approved"
    ? "Reservation approved"
    : "Reservation rejected";
}

function getReservationOwnerId(reservation) {
  return (
    reservation &&
    (reservation.user_id ||
      reservation.customer_id ||
      reservation.profile_id)
  );
}

function getReservationNotificationMessage(status) {
  return status === "approved"
    ? "Your reservation has been approved."
    : "Your reservation was rejected.";
}

async function notifyUserReservationStatus(
  reservation,
  status
) {
  const userId = getReservationOwnerId(reservation);

  if (!reservation || !userId) return;

  const title = getReservationNotificationTitle(status);
  const message = getReservationNotificationMessage(status);

  try {
    const created = await createNotification(
      userId,
      `reservation_${status}`,
      title,
      message,
      `./venue.html?id=${reservation.venue_id}`
    );

    if (!created) {
      console.warn("Reservation status notification was not created.");
    }
  } catch (error) {
    console.warn(error);
  }
}

async function notifyBusinessOwnerReservationRequest(venueId) {
  const { data: venue, error: venueError } =
    await supabaseClient
      .from("venues")
      .select("id, name, business_id")
      .eq("id", venueId)
      .maybeSingle();

  if (venueError || !venue || !venue.business_id) {
    if (venueError) {
      console.log(venueError);
    }
    return;
  }

  const { data: business, error: businessError } =
    await supabaseClient
      .from("businesses")
      .select("owner_id, status")
      .eq("id", venue.business_id)
      .maybeSingle();

  if (businessError || !business || !business.owner_id) {
    if (businessError) {
      console.log(businessError);
    }
    return;
  }

  if (getBusinessStatus(business) !== "approved") {
    return;
  }

  await createNotification(
    business.owner_id,
    "reservation_requested",
    "New reservation request",
    `A new reservation request arrived for ${safeText(
      venue.name
    )}.`,
    "./business.html"
  );
}

async function loadUserReservations(venueId) {
  const reservationsContainer =
    document.getElementById("userReservations");
  const reservationMessage =
    document.getElementById("reservationMessage");

  if (!reservationsContainer) return;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    if (reservationMessage) {
      reservationMessage.innerText =
        "Login to request a reservation.";
    }
    renderEmptyState(
      reservationsContainer,
      "Login required",
      "Your reservation statuses will appear here after login."
    );
    return;
  }

  if (reservationMessage) {
    reservationMessage.innerText =
      "Reservation requests start as pending.";
  }

  const { data, error } =
    await supabaseClient
      .from("reservations")
      .select("*")
      .eq("venue_id", venueId)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

  if (error) {
    showSafeError(error, "Reservations could not be loaded.");
    return;
  }

  renderUserReservations(data || []);
}

function setVenueSlotMessage(message, type = "info") {
  const messageElement =
    document.getElementById("venueSlotMessage");

  if (!messageElement) return;

  messageElement.textContent = message || "";
  messageElement.dataset.status = type;
  messageElement.style.display = message ? "" : "none";
}

function getVenueSlotTimeValue(slot) {
  return normalizeReservationTime(
    slot && (slot.slot_time || slot.time || slot.reservation_time)
  );
}

function getVenueSlotMetaLabel(slot) {
  const reservationCount =
    Number(slot && slot.reservation_count) || 0;
  const maxReservations =
    Number(slot && slot.max_reservations) || 0;
  const guestCount = Number(slot && slot.guest_count) || 0;
  const maxGuests = Number(slot && slot.max_guests) || 0;
  const parts = [];

  if (maxReservations > 0) {
    parts.push(`${reservationCount}/${maxReservations} bookings`);
  } else if (reservationCount > 0) {
    parts.push(`${reservationCount} bookings`);
  }

  if (maxGuests > 0) {
    parts.push(`${guestCount}/${maxGuests} guests`);
  } else if (guestCount > 0) {
    parts.push(`${guestCount} guests`);
  }

  return parts.join(" - ");
}

function isVenueSlotAvailableForParty(slot, partySize = 0) {
  if (!slot || slot.is_available === false) return false;

  const maxGuests = Number(slot.max_guests) || 0;
  const guestCount = Number(slot.guest_count) || 0;

  if (maxGuests > 0 && partySize > 0) {
    return guestCount + partySize <= maxGuests;
  }

  return true;
}

async function getVenueBookingSettingsForDate(venueId, reservationDate) {
  if (!venueId || !reservationDate) return null;

  const dayOfWeek =
    new Date(`${reservationDate}T12:00:00`).getDay();

  try {
    const [hoursResult, rulesResult, blackoutResult] =
      await Promise.all([
        supabaseClient
          .from("venue_operating_hours")
          .select("day_of_week, opens_at, closes_at, is_closed")
          .eq("venue_id", venueId)
          .eq("day_of_week", dayOfWeek)
          .maybeSingle(),
        supabaseClient
          .from("venue_booking_rules")
          .select("venue_id")
          .eq("venue_id", venueId)
          .maybeSingle(),
        supabaseClient
          .from("venue_blackout_dates")
          .select("id, reason")
          .eq("venue_id", venueId)
          .eq("blackout_date", reservationDate)
          .maybeSingle(),
      ]);

    if (hoursResult.error) throw hoursResult.error;
    if (rulesResult.error) throw rulesResult.error;
    if (blackoutResult.error) throw blackoutResult.error;

    return {
      hours: hoursResult.data || null,
      rules: rulesResult.data || null,
      blackout: blackoutResult.data || null,
    };
  } catch (error) {
    console.warn("Venue booking settings diagnostic failed.", {
      venueId,
      reservationDate,
      error,
    });
    return null;
  }
}

function getVenueEmptySlotMessage(settings) {
  if (settings && settings.blackout) {
    return "This venue is unavailable on the selected date.";
  }

  if (settings && settings.hours) {
    if (
      settings.hours.is_closed ||
      !settings.hours.opens_at ||
      !settings.hours.closes_at
    ) {
      return "This venue is closed on the selected date.";
    }
  }

  return "Slot settings are not available for this venue yet.";
}

function formatVenueAvailabilityDate(value) {
  if (!value) return "Select a date";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getVenueOpenHoursLabel(settings) {
  const hours = settings && settings.hours;

  if (!hours) return "Booking hours not set yet";

  if (hours.is_closed || !hours.opens_at || !hours.closes_at) {
    return "Closed on this date";
  }

  return `${getReservationTimeLabel(
    normalizeReservationTime(hours.opens_at)
  )} - ${getReservationTimeLabel(
    normalizeReservationTime(hours.closes_at)
  )}`;
}

function updateVenueAvailabilitySummary(
  reservationDate,
  slots = [],
  settings = null,
  emptyMessage = ""
) {
  const summary =
    document.getElementById("venueAvailabilitySummary");

  if (!summary) return;

  const availableCount = (slots || []).filter(
    (slot) => slot && slot.is_available !== false
  ).length;
  const fullCount = (slots || []).filter(
    (slot) => slot && slot.is_available === false
  ).length;
  const hasSlots = Boolean(slots && slots.length);
  const statusLabel = hasSlots
    ? `${availableCount} available - ${fullCount} full`
    : emptyMessage || "Choose a date to see availability";

  summary.innerHTML = "";
  summary.dataset.status =
    !hasSlots &&
    (
      statusLabel.toLowerCase().includes("closed") ||
      statusLabel.toLowerCase().includes("unavailable")
    )
      ? "warning"
      : "info";

  const items = [
    ["Date", formatVenueAvailabilityDate(reservationDate)],
    ["Hours", getVenueOpenHoursLabel(settings)],
    ["Slots", statusLabel],
  ];

  items.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "venue-availability-summary-item";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    item.appendChild(labelElement);

    const valueElement = document.createElement("strong");
    valueElement.textContent = value;
    item.appendChild(valueElement);

    summary.appendChild(item);
  });
}

async function loadVenueAvailableSlots(venueId, reservationDate) {
  const slotContainer =
    document.getElementById("venueAvailableSlots");

  if (!slotContainer || !venueId || !reservationDate) {
    renderVenueAvailableSlots([]);
    return [];
  }

  console.log("Loading venue reservation slots", {
    venueId,
    reservationDate,
  });

  venueReservationSlotState = {
    venueId,
    date: reservationDate,
    slots: [],
    selectedSlotTime: "",
    fallbackMode: true,
  };
  setVenueSlotMessage("Loading available times...");
  updateVenueAvailabilitySummary(
    reservationDate,
    [],
    null,
    "Loading availability..."
  );

  try {
    const bookingSettings =
      await getVenueBookingSettingsForDate(
        venueId,
        reservationDate
      );

    console.log("Venue booking settings diagnostic", {
      venueId,
      reservationDate,
      bookingSettings,
    });

    const { data, error } = await supabaseClient.rpc(
      "get_venue_available_slots",
      {
        p_venue_id: Number(venueId),
        p_date: reservationDate,
      }
    );

    console.log("Venue available slots RPC result", {
      venueId,
      reservationDate,
      data,
      error,
    });

    if (error) {
      console.warn("Venue available slots RPC error", {
        venueId,
        reservationDate,
        error,
      });
      throw error;
    }

    const slots = Array.isArray(data)
      ? data.filter((slot) => getVenueSlotTimeValue(slot))
      : [];

    venueReservationSlotState = {
      venueId,
      date: reservationDate,
      slots,
      selectedSlotTime: "",
      fallbackMode: slots.length === 0,
    };

    const emptyMessage = getVenueEmptySlotMessage(bookingSettings);

    updateVenueAvailabilitySummary(
      reservationDate,
      slots,
      bookingSettings,
      emptyMessage
    );

    renderVenueAvailableSlots(
      slots,
      emptyMessage
    );
    return slots;
  } catch (error) {
    console.warn("Available reservation slots unavailable.", {
      venueId,
      reservationDate,
      error,
    });
    venueReservationSlotState = {
      venueId,
      date: reservationDate,
      slots: [],
      selectedSlotTime: "",
      fallbackMode: true,
    };
    renderVenueAvailableSlots([]);
    updateVenueAvailabilitySummary(
      reservationDate,
      [],
      null,
      "Booking hours not set yet"
    );
    setVenueSlotMessage(
      "Slot settings are not available for this venue yet."
    );
    return [];
  }
}

function renderVenueAvailableSlots(
  slots,
  emptyMessage = "Slot settings are not available for this venue yet."
) {
  const slotContainer =
    document.getElementById("venueAvailableSlots");

  if (!slotContainer) return;

  slotContainer.innerHTML = "";

  if (!slots || slots.length === 0) {
    const messageStatus = emptyMessage.toLowerCase().includes("closed") ||
      emptyMessage.toLowerCase().includes("unavailable")
      ? "error"
      : "info";
    setVenueSlotMessage(emptyMessage, messageStatus);
    return;
  }

  setVenueSlotMessage("Choose an available reservation time.");

  const heading = document.createElement("span");
  heading.className = "venue-slot-picker-label";
  heading.textContent = "Available times";
  slotContainer.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "venue-slot-grid";

  slots.forEach((slot) => {
    const slotTime = getVenueSlotTimeValue(slot);
    if (!slotTime) return;

    const button = document.createElement("button");
    const isAvailable = slot.is_available !== false;
    const metaLabel = getVenueSlotMetaLabel(slot);
    button.type = "button";
    button.className = isAvailable
      ? "venue-slot-button is-available"
      : "venue-slot-button is-unavailable";
    button.dataset.slotTime = slotTime;
    button.disabled = !isAvailable;
    button.setAttribute("aria-pressed", "false");

    const time = document.createElement("strong");
    time.textContent = getReservationTimeLabel(slotTime);
    button.appendChild(time);

    const state = document.createElement("em");
    state.className = "venue-slot-state";
    state.textContent = isAvailable ? "Available" : "Full";
    button.appendChild(state);

    if (metaLabel) {
      const meta = document.createElement("span");
      meta.textContent = metaLabel;
      button.appendChild(meta);
    }

    if (!isAvailable) {
      button.setAttribute("aria-label", `${time.textContent} full`);
    } else {
      button.setAttribute(
        "aria-label",
        `${time.textContent} available`
      );
    }

    button.addEventListener("click", () => {
      selectVenueReservationSlot(slotTime);
    });

    grid.appendChild(button);
  });

  slotContainer.appendChild(grid);
}

function selectVenueReservationSlot(slotTime) {
  const normalizedTime = normalizeReservationTime(slotTime);
  const timeInput =
    document.getElementById("reservationTime");

  if (!normalizedTime || !timeInput) return;

  const slot = venueReservationSlotState.slots.find(
    (item) => getVenueSlotTimeValue(item) === normalizedTime
  );

  if (
    venueReservationSlotState.slots.length > 0 &&
    !isVenueSlotAvailableForParty(slot)
  ) {
    setVenueSlotMessage(
      "That time is full. Please choose another slot.",
      "error"
    );
    return;
  }

  timeInput.value = normalizedTime;
  venueReservationSlotState.selectedSlotTime = normalizedTime;

  document
    .querySelectorAll(".venue-slot-button")
    .forEach((button) => {
      const isSelected = button.dataset.slotTime === normalizedTime;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute(
        "aria-pressed",
        isSelected ? "true" : "false"
      );
    });

  setVenueSlotMessage("Reservation time selected.");
}

function validateSelectedReservationSlotBeforeSubmit() {
  if (venueReservationSlotState.fallbackMode) return true;

  const timeInput =
    document.getElementById("reservationTime");
  const partySizeInput =
    document.getElementById("reservationPartySize");
  const selectedTime = normalizeReservationTime(
    timeInput ? timeInput.value : ""
  );
  const partySize = Number(
    partySizeInput ? partySizeInput.value : 0
  );

  if (!selectedTime) {
    setVenueSlotMessage("Choose an available reservation time.", "error");
    return false;
  }

  const slot = venueReservationSlotState.slots.find(
    (item) => getVenueSlotTimeValue(item) === selectedTime
  );

  if (!slot || !isVenueSlotAvailableForParty(slot, partySize)) {
    setVenueSlotMessage(
      "That time is no longer available. Please choose another slot.",
      "error"
    );
    return false;
  }

  return true;
}

async function getVenueReservationInitialStatus(venueId) {
  if (!venueId) return "pending";

  try {
    const { data, error } = await supabaseClient
      .from("venue_booking_rules")
      .select("auto_approve")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (error) throw error;

    return data && data.auto_approve ? "approved" : "pending";
  } catch (error) {
    console.warn("Reservation auto approval unavailable.", {
      venueId,
      error,
    });
    return "pending";
  }
}

function isReservationCapacityRpcUnavailable(error) {
  const code = safeText(error && error.code).toUpperCase();
  const message = safeText(error && error.message).toLowerCase();
  const details = safeText(error && error.details).toLowerCase();
  const combined = `${message} ${details}`;

  return (
    code === "PGRST202" ||
    code === "42883" ||
    combined.includes("could not find the function") ||
    combined.includes("function public.create_reservation_with_capacity_check") ||
    combined.includes("does not exist") ||
    combined.includes("schema cache")
  );
}

function getReservationCapacityErrorMessage(error) {
  const message = safeText(error && error.message).toLowerCase();
  const details = safeText(error && error.details).toLowerCase();
  const hint = safeText(error && error.hint).toLowerCase();
  const combined = `${message} ${details} ${hint}`;

  if (combined.includes("login required")) {
    return "Login required";
  }

  if (
    combined.includes("unavailable on the selected date") ||
    combined.includes("blackout")
  ) {
    return "This venue is unavailable on the selected date.";
  }

  if (
    combined.includes("closed on the selected date") ||
    combined.includes("closed day")
  ) {
    return "This venue is closed on the selected date.";
  }

  if (
    combined.includes("outside operating hours") ||
    combined.includes("outside hours")
  ) {
    return "Reservation time is outside operating hours.";
  }

  if (
    combined.includes("not an available slot") ||
    combined.includes("not available slot")
  ) {
    return "Please choose an available reservation time.";
  }

  if (
    combined.includes("guest capacity") ||
    combined.includes("enough guest capacity")
  ) {
    return "That time does not have enough guest capacity.";
  }

  if (
    combined.includes("slot is full") ||
    combined.includes("slot full") ||
    combined.includes("reservation slot is full")
  ) {
    return "That reservation slot is full.";
  }

  return "Reservation could not be requested.";
}

async function createReservationWithCapacityCheck(payload) {
  const { data, error } = await supabaseClient.rpc(
    "create_reservation_with_capacity_check",
    {
      p_venue_id: Number(payload.venue_id),
      p_reservation_date: payload.reservation_date,
      p_reservation_time: payload.reservation_time,
      p_party_size: Number(payload.party_size),
      p_note: payload.note || null,
    }
  );

  return { data, error };
}

async function setupReservationForm(venueId) {
  const reservationForm =
    document.getElementById("reservationForm");

  if (!reservationForm) return;

  const dateInput =
    document.getElementById("reservationDate");
  const timeInput =
    document.getElementById("reservationTime");

  if (dateInput && dateInput.dataset.slotsBound !== "true") {
    dateInput.dataset.slotsBound = "true";
    dateInput.addEventListener("change", () => {
      console.log("Reservation date changed", {
        venueId,
        reservationDate: dateInput.value,
      });

      if (timeInput) {
        timeInput.value = "";
      }

      if (dateInput.value) {
        loadVenueAvailableSlots(venueId, dateInput.value);
      } else {
        venueReservationSlotState = {
          venueId,
          date: "",
          slots: [],
          selectedSlotTime: "",
          fallbackMode: true,
        };
        renderVenueAvailableSlots([]);
        updateVenueAvailabilitySummary(
          "",
          [],
          null,
          "Choose a date to see availability"
        );
        setVenueSlotMessage("");
      }
    });
  }

  if (timeInput && timeInput.dataset.slotsBound !== "true") {
    timeInput.dataset.slotsBound = "true";
    timeInput.addEventListener("change", () => {
      const normalizedTime = normalizeReservationTime(timeInput.value);
      venueReservationSlotState.selectedSlotTime = normalizedTime;
      document
        .querySelectorAll(".venue-slot-button")
        .forEach((button) => {
          const isSelected =
            button.dataset.slotTime === normalizedTime;
          button.classList.toggle("is-selected", isSelected);
          button.setAttribute(
            "aria-pressed",
            isSelected ? "true" : "false"
          );
        });
    });
  }

  if (dateInput && dateInput.value) {
    await loadVenueAvailableSlots(venueId, dateInput.value);
  }

  reservationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (reservationForm.dataset.submitting === "true") {
      return;
    }

    reservationForm.dataset.submitting = "true";

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session) {
        showToast("Login required");
        return;
      }

      const partySizeInput =
        document.getElementById("reservationPartySize");
      const dateInput =
        document.getElementById("reservationDate");
      const timeInput =
        document.getElementById("reservationTime");
      const noteInput =
        document.getElementById("reservationNote");

      if (!partySizeInput || !dateInput || !timeInput) {
        showToast("Reservation form unavailable");
        return;
      }

      const partySize = Number(partySizeInput.value);

      if (partySize < 1 || partySize > 20) {
        showToast("Party size must be between 1 and 20");
        return;
      }

      if (!validateSelectedReservationSlotBeforeSubmit()) {
        return;
      }

      const payload = {
        venue_id: venueId,
        user_id: session.user.id,
        reservation_date: dateInput.value,
        reservation_time: timeInput.value,
        party_size: partySize,
        note: noteInput ? noteInput.value.trim() : "",
      };

      let createdReservation = null;
      const rpcResult =
        await createReservationWithCapacityCheck(payload);

      if (rpcResult.error) {
        if (
          !isReservationCapacityRpcUnavailable(rpcResult.error)
        ) {
          const friendlyMessage =
            getReservationCapacityErrorMessage(rpcResult.error);
          setVenueSlotMessage(friendlyMessage, "error");
          showToast(friendlyMessage);
          return;
        }

        console.warn(
          "Reservation capacity RPC unavailable; falling back to direct insert.",
          rpcResult.error
        );

        const initialStatus =
          await getVenueReservationInitialStatus(venueId);
        const fallbackPayload = {
          ...payload,
          status: initialStatus,
        };

        const { data, error } =
          await supabaseClient
            .from("reservations")
            .insert([fallbackPayload])
            .select("*")
            .maybeSingle();

        if (error) {
          showSafeError(
            error,
            "Reservation could not be requested."
          );
          return;
        }

        createdReservation = data;
      } else {
        createdReservation = Array.isArray(rpcResult.data)
          ? rpcResult.data[0]
          : rpcResult.data;
      }

      const createdVenueId =
        createdReservation && createdReservation.venue_id
          ? createdReservation.venue_id
          : venueId;

      showToast("Reservation requested");
      await notifyBusinessOwnerReservationRequest(createdVenueId);
      reservationForm.reset();
      venueReservationSlotState = {
        venueId,
        date: "",
        slots: [],
        selectedSlotTime: "",
        fallbackMode: true,
      };
      renderVenueAvailableSlots([]);
      setVenueSlotMessage("");
      await loadUserReservations(createdVenueId);
    } catch (error) {
      console.log(error);
      showToast(error.message || "Reservation unavailable");
    } finally {
      reservationForm.dataset.submitting = "false";
    }
  });
}

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    if (loginBtn.disabled) return;

    if (!email || !password) {
      showToast("Login form unavailable");
      return;
    }

    loginBtn.disabled = true;

    try {
      const { error } =
        await supabaseClient.auth.signInWithPassword({
          email: email.value,
          password: password.value,
        });

      if (error) {
        showToast(error.message);
        return;
      }

      window.location.href = "./index.html";
    } catch (error) {
      console.log(error);
      showToast(error.message || "Login unavailable");
    } finally {
      loginBtn.disabled = false;
    }
  });
}

if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    if (registerBtn.disabled) return;

    if (!email || !password) {
      showToast("Registration form unavailable");
      return;
    }

    registerBtn.disabled = true;

    try {
      const { error } =
        await supabaseClient.auth.signUp({
          email: email.value,
          password: password.value,
        });

      if (error) {
        showToast(error.message);
        return;
      }

      showToast("Register successful");
    } catch (error) {
      console.log(error);
      showToast(error.message || "Registration unavailable");
    } finally {
      registerBtn.disabled = false;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "./auth.html";
  });
}

if (createVenueBtn) {
  createVenueBtn.addEventListener("click", async () => {
    const name =
      document.getElementById("venueNameInput").value;

    const city =
      document.getElementById("venueCityInput").value;

    const image =
      document.getElementById("venueImageInput").value;

    const description =
      document.getElementById("venueDescriptionInput").value;

    const { error } =
      await supabaseClient.from("venues").insert([
        {
          name,
          city,
          image,
          description,
        },
      ]);

    if (error) {
      showSafeError(error, "Venue could not be created.");
      return;
    }

    showToast("Venue created");

    setTimeout(() => {
      window.location.href = "./discover.html";
    }, 800);
  });
}

if (createEventBtn) {
  createEventBtn.addEventListener("click", async () => {
    const venue_id =
      document.getElementById("eventVenueId").value;

    const title =
      document.getElementById("eventTitle").value;

    const event_date =
      document.getElementById("eventDate").value;

    const image =
      document.getElementById("eventImage").value;

    const description =
      document.getElementById("eventDescription").value;

    const { error } =
      await supabaseClient.from("events").insert([
        {
          venue_id,
          title,
          event_date,
          image,
          description,
        },
      ]);

    if (error) {
      showSafeError(error, "Event could not be created.");
      return;
    }

    showToast("Event created");
  });
}

async function checkUser() {
  const session = await getSafeSession();

  const authLink =
    document.getElementById("authLink");

  if (session && authLink) {
    authLink.innerText = "Profile";
    authLink.href = "./profile.html";
  }

  const userEmail =
    document.getElementById("userEmail");

  if (userEmail) {
    if (!session) {
      window.location.href = "./auth.html";
      return;
    }

    userEmail.innerText = session.user.email;
    ensureBusinessApplicationSection();
    setupProfileMobilePanels();
    setupProfileAvatarUpload();
    setupProfileStoreOrdersLoader(session.user.id);
    setupBusinessApplicationForm(session.user.id);
    await hydrateProfileAvatar(session);
    await loadProfileStats(session.user.id);
  }
}

function setupProfileMobilePanels() {
  const buttons =
    document.querySelectorAll("[data-profile-panel]");
  const panels =
    document.querySelectorAll(".profile-mobile-panel");

  if (!buttons.length || !panels.length) return;

  buttons.forEach((button) => {
    const panelName = button.dataset.profilePanel;
    const matchingPanels =
      document.querySelectorAll(
        `.profile-mobile-panel[data-panel="${panelName}"]`
      );
    const isOpen = [...matchingPanels].some((panel) =>
      panel.classList.contains("is-open")
    );

    button.classList.toggle("is-active", isOpen);
    button.setAttribute(
      "aria-expanded",
      isOpen ? "true" : "false"
    );
  });

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const panelName = button.dataset.profilePanel;
      const matchingPanels =
        document.querySelectorAll(
          `.profile-mobile-panel[data-panel="${panelName}"]`
        );

      if (!matchingPanels.length) return;

      const shouldOpen = ![...matchingPanels].some((panel) =>
        panel.classList.contains("is-open")
      );

      panels.forEach((panel) => {
        panel.classList.remove("is-open");
      });

      buttons.forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-expanded", "false");
      });

      if (shouldOpen) {
        matchingPanels.forEach((panel) => {
          panel.classList.add("is-open");
        });
        button.classList.add("is-active");
        button.setAttribute("aria-expanded", "true");

        if (panelName === "orders") {
          loadProfileStoreOrdersFromSession();
        }
      }
    });
  });
}

function setupProfileStoreOrdersLoader(userId) {
  const list = document.getElementById("profileStoreOrdersList");

  if (!list || list.dataset.profileOrdersLoaderBound === "true") {
    return;
  }

  list.dataset.profileOrdersLoaderBound = "true";

  const loadOrders = () => {
    loadProfileStoreOrders(userId);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadOrders, {
      once: true,
    });
  } else {
    loadOrders();
  }
}

function ensureBusinessApplicationSection() {
  if (document.querySelector(".profile-business-section")) {
    return;
  }

  const profileDashboard =
    document.querySelector(".profile-dashboard");
  const reservationsSection =
    document.querySelector(".profile-reservations-section");
  const businessLink =
    document.getElementById("businessDashboardLink");

  if (!profileDashboard) return;

  const section = document.createElement("section");
  section.className =
    "profile-business-section dashboard-section dashboard-section--approvals dashboard-section--forms profile-mobile-panel";
  section.dataset.panel = "business";

  const heading = document.createElement("h2");
  heading.textContent = "Business Application";
  section.appendChild(heading);

  const applicationsList = document.createElement("div");
  applicationsList.id = "profileBusinessApplications";
  applicationsList.className = "business-list";
  section.appendChild(applicationsList);

  const form = document.createElement("form");
  form.id = "businessApplicationForm";
  form.className = "admin-form";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.id = "businessApplicationName";
  nameInput.placeholder = "Business Name";
  nameInput.required = true;
  form.appendChild(nameInput);

  const phoneInput = document.createElement("input");
  phoneInput.type = "tel";
  phoneInput.id = "businessApplicationPhone";
  phoneInput.placeholder = "Phone";
  form.appendChild(phoneInput);

  const addressInput = document.createElement("input");
  addressInput.type = "text";
  addressInput.id = "businessApplicationAddress";
  addressInput.placeholder = "Address";
  form.appendChild(addressInput);

  const descriptionInput = document.createElement("textarea");
  descriptionInput.id = "businessApplicationDescription";
  descriptionInput.placeholder = "Tell us about your business";
  descriptionInput.required = true;
  form.appendChild(descriptionInput);

  const actions = document.createElement("div");
  actions.className = "admin-form-actions";

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "btn";
  submitButton.textContent = "Apply";
  actions.appendChild(submitButton);

  form.appendChild(actions);
  section.appendChild(form);

  profileDashboard.insertBefore(
    section,
    reservationsSection || businessLink || null
  );
}

async function loadProfileStats(userId) {
  const favoritesCount =
    document.getElementById("profileFavoritesCount");
  const reviewsCount =
    document.getElementById("profileReviewsCount");
  const reservationsCount =
    document.getElementById("profileReservationsCount");

  if (!favoritesCount && !reviewsCount && !reservationsCount) {
    return;
  }

  const [
    favoritesResult,
    reviewsResult,
    reservationsResult,
  ] =
    await Promise.all([
      supabaseClient
        .from("favorites")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", userId),
      supabaseClient
        .from("venue_reviews")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", userId),
      supabaseClient
        .from("reservations")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", userId),
    ]);

  if (favoritesResult.error) {
    showSafeError(favoritesResult.error, "Profile stats could not be loaded.");
  } else if (favoritesCount) {
    favoritesCount.innerText =
      favoritesResult.count || 0;
  }

  if (reviewsResult.error) {
    showSafeError(reviewsResult.error, "Profile stats could not be loaded.");
  } else if (reviewsCount) {
    reviewsCount.innerText = reviewsResult.count || 0;
  }

  if (reservationsResult.error) {
    showSafeError(reservationsResult.error, "Profile stats could not be loaded.");
  } else if (reservationsCount) {
    reservationsCount.innerText =
      reservationsResult.count || 0;
  }

  await loadProfileNotifications(userId);
  await loadProfileStoreOrders(userId);
  await loadProfileBusinessApplications(userId);
  await setupBusinessProfileLink(userId);
}

const STORE_ORDER_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "completed",
];

function getStoreOrderStatusValue(status) {
  const value = safeText(status).toLowerCase().trim() || "pending";

  return STORE_ORDER_STATUSES.includes(value) ? value : "pending";
}

function getStoreOrderStatusLabel(status) {
  const labels = {
    pending: "Beklemede",
    accepted: "Kabul edildi",
    rejected: "Reddedildi",
    completed: "Tamamlandı",
  };
  const value = getStoreOrderStatusValue(status);

  return labels[value] || value;
}

function createStoreOrderStatusBadge(status) {
  const badge = document.createElement("span");
  const value = getStoreOrderStatusValue(status);

  badge.className = `store-order-badge status-${value}`;
  badge.textContent = getStoreOrderStatusLabel(value);

  return badge;
}

const STORE_ORDER_STATUS_NOTIFICATION_TEXT = {
  accepted: "Siparişiniz kabul edildi",
  rejected: "Siparişiniz reddedildi",
  completed: "Siparişiniz tamamlandı",
};

function getBusinessStoreOrderById(orderId) {
  return (businessDashboardState.storeOrders || []).find(
    (order) => String(order.id) === String(orderId)
  );
}

async function fetchStoreOrderForNotification(orderId) {
  if (!orderId) return null;

  try {
    const { data, error } = await supabaseClient
      .from("store_orders")
      .select("id, user_id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (error) return null;
    return data || null;
  } catch (error) {
    return null;
  }
}

async function notifyStoreOrderOwnerStatusChange(order, status) {
  const nextStatus = getStoreOrderStatusValue(status);
  const text = STORE_ORDER_STATUS_NOTIFICATION_TEXT[nextStatus];

  if (!text) return false;

  const targetOrder =
    order && order.user_id
      ? order
      : await fetchStoreOrderForNotification(order && order.id);

  if (!targetOrder || !targetOrder.user_id) return false;

  return createStoreOrderNotification(
    targetOrder.user_id,
    `store_order_${nextStatus}`,
    text,
    text,
    "./profile.html",
    {
      order_id: targetOrder.id,
      status: nextStatus,
    }
  );
}

function formatStoreOrderAmount(value, currency = "TRY") {
  const amount = Number(value || 0);
  const symbols = {
    TRY: "₺",
    USD: "$",
    EUR: "€",
  };

  return `${symbols[currency] || currency} ${amount.toLocaleString("tr-TR", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function getStoreOrderItems(order) {
  const items = order && order.store_order_items;

  if (Array.isArray(items)) return items;
  if (items) return [items];
  return [];
}

function getStoreOrderTitle(order) {
  const id = safeText(order && order.id);

  return id ? `Sipariş #${id.slice(0, 8)}` : "Sipariş";
}

function createStoreOrderItemsList(items) {
  const list = document.createElement("div");
  list.className = "store-order-items";

  if (!items || items.length === 0) {
    const empty = document.createElement("span");
    empty.textContent = "Ürün detayı yok.";
    list.appendChild(empty);
    return list;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "store-order-item";

    const name = document.createElement("strong");
    name.textContent = safeText(item.product_name) || "Store ürünü";
    row.appendChild(name);

    const meta = document.createElement("span");
    meta.textContent =
      `${Number(item.quantity || 0)} adet · ${formatStoreOrderAmount(
        item.total_price
      )}`;
    row.appendChild(meta);

    list.appendChild(row);
  });

  return list;
}

function renderStoreOrdersUnavailable(list) {
  if (!list) return;

  renderEmptyState(
    list,
    "Siparişler henüz hazır değil.",
    "Checkout için sql/store_orders.sql dosyasını Supabase üzerinde çalıştırın."
  );
}

function logProfileOrdersIssue(message, detail = {}) {
  console.warn("[TANIDIK profile orders]", message, detail);
}

function renderProfileStoreOrdersError(message) {
  const list = document.getElementById("profileStoreOrdersList");

  if (!list) return;

  renderEmptyState(
    list,
    "Siparişler yüklenemedi.",
    message || "Lütfen birazdan tekrar deneyin."
  );
}

async function loadProfileStoreOrdersFromSession() {
  const list = document.getElementById("profileStoreOrdersList");

  if (!list) return;

  try {
    const session = await getSafeSession();
    const userId = session && session.user ? session.user.id : "";

    if (!userId) {
      renderProfileStoreOrdersError("Siparişleri görmek için giriş yapın.");
      return;
    }

    await loadProfileStoreOrders(userId);
  } catch (error) {
    logProfileOrdersIssue("Session lookup failed.", error);
    renderProfileStoreOrdersError();
  }
}

async function loadProfileStoreOrdersWithItemsFallback(userId) {
  const ordersResult = await supabaseClient
    .from("store_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (ordersResult.error) {
    logProfileOrdersIssue("Orders fallback query failed.", {
      userId,
      error: ordersResult.error,
    });
    return { data: [], error: ordersResult.error };
  }

  const orders = ordersResult.data || [];
  const orderIds = orders.map((order) => order.id).filter(Boolean);

  if (orderIds.length === 0) {
    return { data: orders, error: null };
  }

  const itemsResult = await supabaseClient
    .from("store_order_items")
    .select("*")
    .in("order_id", orderIds);

  if (itemsResult.error) {
    logProfileOrdersIssue(
      "Order items fallback query failed. Rendering orders without items.",
      { userId, orderIds, error: itemsResult.error }
    );
    return { data: orders, error: null };
  }

  const itemsByOrderId = {};

  (itemsResult.data || []).forEach((item) => {
    const orderId = String(item.order_id || "");

    if (!orderId) return;

    itemsByOrderId[orderId] = itemsByOrderId[orderId] || [];
    itemsByOrderId[orderId].push(item);
  });

  return {
    data: orders.map((order) => ({
      ...order,
      store_order_items: itemsByOrderId[String(order.id)] || [],
    })),
    error: null,
  };
}

async function loadProfileStoreOrders(userId) {
  const list = document.getElementById("profileStoreOrdersList");

  if (!list || !userId) return;

  try {
    const session = await getSafeSession();
    const sessionUserId = session && session.user ? session.user.id : "";

    if (sessionUserId && String(sessionUserId) !== String(userId)) {
      logProfileOrdersIssue("Session user does not match requested orders user.", {
        sessionUserId,
        requestedUserId: userId,
      });
    }

    const { data, error } = await supabaseClient
      .from("store_orders")
      .select("*, store_order_items(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      logProfileOrdersIssue(
        "Joined orders query failed. Trying orders/items fallback.",
        { userId, error }
      );

      const fallbackResult =
        await loadProfileStoreOrdersWithItemsFallback(userId);

      if (fallbackResult.error) {
        renderProfileStoreOrdersError(
          "Sipariş kayıtları okunamadı. RLS veya tablo ilişkilerini kontrol edin."
        );
        showToast("Siparişler yüklenemedi");
        return;
      }

      renderProfileStoreOrders(fallbackResult.data || []);
      return;
    }

    if (!data || data.length === 0) {
      logProfileOrdersIssue(
        "Orders query returned no rows. If an order exists, check store_orders.user_id and RLS.",
        { userId, sessionUserId }
      );
    }

    renderProfileStoreOrders(data || []);
  } catch (error) {
    logProfileOrdersIssue("Orders load failed unexpectedly.", {
      userId,
      error,
    });
    renderProfileStoreOrdersError();
    showToast("Siparişler yüklenemedi");
  }
}

function renderProfileStoreOrders(orders) {
  const list = document.getElementById("profileStoreOrdersList");

  if (!list) return;

  list.innerHTML = "";

  if (!orders || orders.length === 0) {
    renderEmptyState(
      list,
      "Henüz sipariş yok.",
      "Store üzerinden verdiğiniz siparişler burada görünecek."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  orders.forEach((order) => {
    const card = document.createElement("article");
    card.className = "store-order-card profile-store-order-card";

    const header = document.createElement("div");
    header.className = "store-order-card-header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = getStoreOrderTitle(order);
    titleWrap.appendChild(title);

    const createdAt = document.createElement("span");
    createdAt.textContent = formatNotificationDate(order.created_at);
    titleWrap.appendChild(createdAt);

    header.appendChild(titleWrap);
    header.appendChild(createStoreOrderStatusBadge(order.status));
    card.appendChild(header);

    card.appendChild(createStoreOrderItemsList(getStoreOrderItems(order)));

    const footer = document.createElement("div");
    footer.className = "store-order-meta";

    const total = document.createElement("strong");
    total.textContent = formatStoreOrderAmount(order.total_amount);
    footer.appendChild(total);

    if (order.customer_note) {
      const note = document.createElement("span");
      note.textContent = safeText(order.customer_note);
      footer.appendChild(note);
    }

    card.appendChild(footer);
    fragment.appendChild(card);
  });

  list.appendChild(fragment);
}

function formatNotificationDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function renderProfileNotifications(notifications) {
  const list =
    document.getElementById("profileNotificationsList");

  if (!list) return;

  businessStoreProductState = {
    categories: productData.categories || [],
    products: productData.products || [],
  };

  list.innerHTML = "";

  if (!notifications || notifications.length === 0) {
    renderEmptyState(
      list,
      "No notifications yet.",
      "Reservation and business updates will appear here."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  notifications.forEach((notification) => {
    const item = document.createElement("div");
    const normalizedTitle = String(notification.title || "")
      .trim()
      .toLowerCase();
    const notificationClasses = [
      "profile-card",
      "notification-card",
    ];

    if (!notification.is_read) {
      notificationClasses.push("unread");
    }

    if (normalizedTitle.includes("reservation approved")) {
      notificationClasses.push("notification-card--success");
    }

    if (normalizedTitle.includes("reservation rejected")) {
      notificationClasses.push("notification-card--danger");
    }

    item.className = notificationClasses.join(" ");

    const status = document.createElement("span");
    status.className = "notification-status";
    status.textContent = notification.is_read
      ? "Read"
      : "Unread";
    item.appendChild(status);

    const title = document.createElement("strong");
    title.className = "notification-title";
    title.textContent = safeText(notification.title);
    item.appendChild(title);

    if (notification.message) {
      const message = document.createElement("p");
      message.className = "notification-message";
      message.textContent = notification.message;
      item.appendChild(message);
    }

    const date = formatNotificationDate(
      notification.created_at
    );

    if (date) {
      const dateElement = document.createElement("p");
      dateElement.className = "notification-date";
      dateElement.textContent = date;
      item.appendChild(dateElement);
    }

    const actions = document.createElement("div");
    actions.className = "notification-actions";

    if (notification.link_url) {
      const link = document.createElement("a");
      link.href = notification.link_url;
      link.className = "secondary-btn";
      link.textContent = "Open";
      actions.appendChild(link);
    }

    if (!notification.is_read) {
      const readButton = document.createElement("button");
      readButton.type = "button";
      readButton.className = "secondary-btn";
      readButton.textContent = "Mark as read";
      readButton.addEventListener("click", () => {
        markNotificationRead(notification.id);
      });
      actions.appendChild(readButton);
    }

    if (actions.children.length > 0) {
      item.appendChild(actions);
    }

    fragment.appendChild(item);
  });

  list.appendChild(fragment);
}

async function loadProfileNotifications(userId) {
  const list =
    document.getElementById("profileNotificationsList");

  if (!list) return;

  renderEmptyState(list, "Loading notifications...");

  const { data, error } =
    await supabaseClient
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);

  if (error) {
    showSafeError(error, "Notifications could not be loaded.");
    return;
  }

  renderProfileNotifications(data || []);
}

async function markNotificationRead(notificationId) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    showToast("Login required");
    return;
  }

  const { error } =
    await supabaseClient
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", session.user.id);

  if (error) {
    showSafeError(error, "Notification could not be updated.");
    return;
  }

  await loadProfileNotifications(session.user.id);
}

function renderProfileBusinessApplications(businesses) {
  const list =
    document.getElementById("profileBusinessApplications");
  const form =
    document.getElementById("businessApplicationForm");

  if (!list) return;

  list.innerHTML = "";

  const records = businesses || [];
  const hasPendingOrApproved = records.some((business) =>
    ["pending", "approved"].includes(
      getBusinessStatus(business)
    )
  );

  if (form) {
    form.style.display = hasPendingOrApproved ? "none" : "";
  }

  if (records.length === 0) {
    renderEmptyState(
      list,
      "No application yet",
      "Apply to manage your business on TANIDIK."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  records.forEach((business) => {
    const item = document.createElement("div");
    item.className = "business-card";

    const title = document.createElement("h3");
    title.textContent = safeText(business.name);
    item.appendChild(title);

    item.appendChild(createStatusBadge(business.status));

    if (business.description) {
      const description = document.createElement("p");
      description.textContent = business.description;
      item.appendChild(description);
    }

    if (business.phone) {
      const phone = document.createElement("p");
      phone.textContent = `Phone: ${business.phone}`;
      item.appendChild(phone);
    }

    if (business.address) {
      const address = document.createElement("p");
      address.textContent = `Address: ${business.address}`;
      item.appendChild(address);
    }

    if (business.rejection_reason) {
      const reason = document.createElement("p");
      reason.textContent =
        `Reason: ${business.rejection_reason}`;
      item.appendChild(reason);
    }

    fragment.appendChild(item);
  });

  list.appendChild(fragment);
}

async function loadProfileBusinessApplications(userId) {
  const list =
    document.getElementById("profileBusinessApplications");

  if (!list) return;

  renderEmptyState(list, "Loading applications...");

  const { data, error } =
    await supabaseClient
      .from("businesses")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

  if (error) {
    showSafeError(error, "Applications could not be loaded.");
    return;
  }

  renderProfileBusinessApplications(data || []);
}

function clearBusinessApplicationForm() {
  setAdminValue("businessApplicationName", "");
  setAdminValue("businessApplicationPhone", "");
  setAdminValue("businessApplicationAddress", "");
  setAdminValue("businessApplicationDescription", "");
}

function setupBusinessApplicationForm(userId) {
  const form =
    document.getElementById("businessApplicationForm");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (form.dataset.submitting === "true") {
      return;
    }

    form.dataset.submitting = "true";

    try {
    const payload = {
      owner_id: userId,
      name: getAdminValue("businessApplicationName"),
      phone: getAdminValue("businessApplicationPhone"),
      address: getAdminValue("businessApplicationAddress"),
      description: getAdminValue(
        "businessApplicationDescription"
      ),
      status: "pending",
      rejection_reason: "",
    };

    const { error } =
      await supabaseClient
        .from("businesses")
        .insert([payload]);

    if (error) {
      showSafeError(error, "Application could not be submitted.");
      return;
    }

    showToast("Application submitted");
    clearBusinessApplicationForm();
    await loadProfileBusinessApplications(userId);
    await setupBusinessProfileLink(userId);
    } catch (error) {
      showSafeError(error, "Application could not be submitted.");
    } finally {
      form.dataset.submitting = "false";
    }
  });
}

async function loadProfileReservations(userId, options = {}) {
  const reservationsList =
    document.getElementById("profileReservationsList");

  if (!reservationsList) return;

  renderEmptyState(
    reservationsList,
    "Loading reservations..."
  );

  let query = supabaseClient
      .from("reservations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

  if (options.limit !== null) {
    query = query.limit(options.limit || 8);
  }

  const { data: reservations, error } = await query;

  if (error) {
    showSafeError(error, "Reservations could not be loaded.");
    return;
  }

  const recentReservations = reservations || [];

  if (recentReservations.length === 0) {
    renderEmptyState(
      reservationsList,
      "No reservations yet."
    );
    return;
  }

  const venueIds = [
    ...new Set(
      recentReservations
        .map((reservation) => reservation.venue_id)
        .filter(Boolean)
    ),
  ];

  let venuesById = new Map();

  if (venueIds.length > 0) {
    const { data: venues, error: venuesError } =
      await supabaseClient
        .from("venues")
        .select("id, name")
        .in("id", venueIds);

    if (venuesError) {
      console.log(venuesError);
      showToast(venuesError.message);
    } else {
      venuesById = new Map(
        (venues || []).map((venue) => [
          String(venue.id),
          venue,
        ])
      );
    }
  }

  reservationsList.innerHTML = "";

  const fragment = document.createDocumentFragment();

  recentReservations.forEach((reservation) => {
    const venue = venuesById.get(String(reservation.venue_id));

    fragment.appendChild(
      createReservationCard(
        {
          ...reservation,
          venue_name: venue ? venue.name : "",
        },
        {
          allowCancel: true,
          showVenue: true,
          onCancel:
            options.onCancel ||
            (() => loadProfileReservations(userId, options)),
        }
      )
    );
  });

  reservationsList.appendChild(fragment);
}

function renderProfileReviews(reviews, venuesById = new Map()) {
  const reviewsList =
    document.getElementById("profileReviewsList");

  if (!reviewsList) return;

  reviewsList.innerHTML = "";

  if (!reviews || reviews.length === 0) {
    renderEmptyState(
      reviewsList,
      "No reviews yet.",
      "Reviews you leave on venue pages will appear here."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  reviews.forEach((review) => {
    const venue = venuesById.get(String(review.venue_id));
    const card = document.createElement("article");
    card.className = "review-card profile-review-card";

    const header = document.createElement("div");
    header.className = "review-card-header";

    const title = document.createElement("h3");
    title.textContent =
      safeText(venue && venue.name) ||
      `Venue #${safeText(review.venue_id)}`;
    header.appendChild(title);

    const rating = document.createElement("span");
    rating.className = "review-rating";
    rating.textContent = `${review.rating || 0} / 5`;
    header.appendChild(rating);

    card.appendChild(header);

    const date = document.createElement("p");
    date.className = "review-date";
    date.textContent = formatReviewDate(review.created_at);
    card.appendChild(date);

    if (review.review) {
      const text = document.createElement("p");
      text.textContent = review.review;
      card.appendChild(text);
    }

    const actions = document.createElement("div");
    actions.className = "reservation-actions";

    if (review.venue_id) {
      const link = document.createElement("a");
      link.href = `./venue.html?id=${review.venue_id}`;
      link.className = "secondary-btn";
      link.textContent = "View Venue";
      actions.appendChild(link);
    }

    if (actions.children.length > 0) {
      card.appendChild(actions);
    }

    fragment.appendChild(card);
  });

  reviewsList.appendChild(fragment);
}

async function loadProfileReviews(userId) {
  const reviewsList =
    document.getElementById("profileReviewsList");

  if (!reviewsList) return;

  renderEmptyState(reviewsList, "Loading reviews...");

  const { data: reviews, error } =
    await supabaseClient
      .from("venue_reviews")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

  if (error) {
    showSafeError(error, "Reviews could not be loaded.");
    return;
  }

  const venueIds = [
    ...new Set(
      (reviews || [])
        .map((review) => review.venue_id)
        .filter(Boolean)
    ),
  ];
  let venuesById = new Map();

  if (venueIds.length > 0) {
    const { data: venues, error: venuesError } =
      await supabaseClient
        .from("venues")
        .select("id, name")
        .in("id", venueIds);

    if (venuesError) {
      console.warn("Review venue names could not be loaded.", venuesError);
    } else {
      venuesById = new Map(
        (venues || []).map((venue) => [
          String(venue.id),
          venue,
        ])
      );
    }
  }

  renderProfileReviews(reviews || [], venuesById);
}

async function initMyReservationsPage() {
  const page =
    document.getElementById("myReservationsPage");

  if (!page) return;

  const session = await getSafeSession();

  if (!session) {
    window.location.href = "./auth.html";
    return;
  }

  await loadProfileReservations(session.user.id, {
    limit: null,
  });
}

async function initMyReviewsPage() {
  const page =
    document.getElementById("myReviewsPage");

  if (!page) return;

  const session = await getSafeSession();

  if (!session) {
    window.location.href = "./auth.html";
    return;
  }

  await loadProfileReviews(session.user.id);
}

async function setupBusinessProfileLink(userId) {
  const businessLink =
    document.getElementById("businessDashboardLink");

  if (!businessLink) return;

  businessLink.style.display = "none";

  const { count, error } =
    await supabaseClient
      .from("businesses")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("owner_id", userId)
      .eq("status", "approved");

  if (error) {
    console.log(error);
    return;
  }

  if (count && count > 0) {
    businessLink.style.display = "inline-block";
  }
}

async function addFavorite(venueId) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    showToast("Login required");
    return;
  }

  const { data: existingFavorite } =
    await supabaseClient
      .from("favorites")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("venue_id", venueId)
      .maybeSingle();

  if (existingFavorite) {
    showToast("Already in favorites");
    return;
  }

  const { error } =
    await supabaseClient.from("favorites").insert([
      {
        user_id: session.user.id,
        venue_id: venueId,
      },
    ]);

  if (error) {
    showSafeError(error, "Favorite could not be added.");
    return;
  }

  showToast("Added to favorites");

  const averageRating =
    document.getElementById("venueAverageRating");

  if (
    averageRating &&
    String(averageRating.dataset.venueId) ===
      String(venueId)
  ) {
    venueStatsById = {
      ...venueStatsById,
      ...(await loadVenueStats([venueId])),
    };
    updateAverageRating([]);
  }
}

async function removeFavorite(venueId) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    showToast("Login required");
    return;
  }

  const { error } = await supabaseClient
    .from("favorites")
    .delete()
    .eq("user_id", session.user.id)
    .eq("venue_id", venueId);

  if (error) {
    showSafeError(error, "Favorite could not be removed.");
    return;
  }

  const card = document.getElementById(
    `favorite-${venueId}`
  );

  if (card) {
    card.remove();
  }

  const favoritesContainer =
    document.getElementById("favoritesContainer");

  if (
    favoritesContainer &&
    favoritesContainer.children.length === 0
  ) {
    renderEmptyState(
      favoritesContainer,
      "No favorites yet",
      "Start exploring venues and add your favorites."
    );
  }

  showMessage("Removed from favorites");
  showToast("Removed from favorites");
}

async function loadVenues() {
  const venuesContainer =
    document.getElementById("venuesContainer");

  if (!venuesContainer) return;

  renderEmptyState(venuesContainer, "Loading venues...");

  const { data, error } =
    await supabaseClient
      .from("venues")
      .select("*");

  if (error) {
    showSafeError(error, "Venues could not be loaded.");
    return;
  }

  allVenues = data || [];
  venueStatsById = await loadVenueStats(
    allVenues.map((venue) => venue.id)
  );

  renderVenues(allVenues);
  renderCityFilters(allVenues);
  renderCategoryFilters();
  setupVenueSearch();
}

function renderVenues(venues) {
  const venuesContainer =
    document.getElementById("venuesContainer");

  if (!venuesContainer) return;

  venuesContainer.innerHTML = "";

  if (!venues || venues.length === 0) {
    renderEmptyState(
      venuesContainer,
      "No venues found",
      "Try searching another venue or city."
    );

    return;
  }

  const fragment = document.createDocumentFragment();

  venues.forEach((venue) => {
    fragment.appendChild(
      createVenueCard(venue, {
        showFavoriteButton: true,
        stats: getVenueStats(venue.id),
      })
    );
  });

  venuesContainer.appendChild(fragment);
}

function renderCityFilters(venues) {
  const cityFilters =
    document.getElementById("cityFilters");

  if (!cityFilters) return;

  const cities = [
    "All",
    ...new Set(
      venues
        .map((venue) => venue.city)
        .filter(Boolean)
    ),
  ];

  cityFilters.innerHTML = "";

  cities.forEach((city) => {
    const button = document.createElement("button");
    button.className = "city-filter-btn";
    button.textContent = city;
    button.addEventListener("click", () => {
      filterByCity(city);
    });

    cityFilters.appendChild(button);
  });
}

function renderCategoryFilters() {
  const categoryFilters =
    document.getElementById("categoryFilters");

  if (!categoryFilters) return;

  const categories = [["All", "All"], ...VENUE_CATEGORIES];
  categoryFilters.innerHTML = "";

  categories.forEach(([value, label]) => {
    const button = document.createElement("button");
    button.className = "category-filter-btn";
    button.dataset.category = value;
    button.textContent = label;
    button.addEventListener("click", () => {
      filterByCategory(value);
    });

    if ((window.selectedCategory || "All") === value) {
      button.classList.add("active-filter");
    }

    categoryFilters.appendChild(button);
  });
}

function setupVenueSearch() {
  const venueSearchInput =
    document.getElementById("venueSearchInput");

  if (!venueSearchInput) return;

  venueSearchInput.addEventListener("input", () => {
    applyVenueFilters();
  });
}

function filterByCity(city) {
  const cityFilters =
    document.querySelectorAll(".city-filter-btn");

  cityFilters.forEach((button) => {
    button.classList.remove("active-filter");
  });

  cityFilters.forEach((button) => {
    if (button.innerText === city) {
      button.classList.add("active-filter");
    }
  });

  window.selectedCity = city;

  applyVenueFilters();
}

function filterByCategory(category) {
  const categoryFilters =
    document.querySelectorAll(".category-filter-btn");

  categoryFilters.forEach((button) => {
    button.classList.remove("active-filter");
  });

  categoryFilters.forEach((button) => {
    if (button.dataset.category === category) {
      button.classList.add("active-filter");
    }
  });

  window.selectedCategory = category;

  applyVenueFilters();
}

function applyVenueFilters() {
  const searchInput =
    document.getElementById("venueSearchInput");

  const searchValue = searchInput
    ? searchInput.value.toLowerCase()
    : "";

  const selectedCity =
    window.selectedCity || "All";
  const selectedCategory =
    window.selectedCategory || "All";

  let filtered = [...allVenues];

  if (selectedCity !== "All") {
    filtered = filtered.filter(
      (venue) => venue.city === selectedCity
    );
  }

  if (selectedCategory !== "All") {
    filtered = filtered.filter(
      (venue) =>
        getVenueCategoryValue(venue) === selectedCategory
    );
  }

  if (searchValue) {
    filtered = filtered.filter((venue) => {
      const name = safeText(venue.name).toLowerCase();
      const city = safeText(venue.city).toLowerCase();
      const description =
        safeText(venue.description).toLowerCase();
      const category =
        getVenueCategoryLabel(venue).toLowerCase();

      return (
        name.includes(searchValue) ||
        city.includes(searchValue) ||
        description.includes(searchValue) ||
        category.includes(searchValue)
      );
    });
  }

  renderVenues(filtered);
}

async function loadFavorites() {
  const favoritesContainer =
    document.getElementById("favoritesContainer");

  if (!favoritesContainer) return;

  renderEmptyState(favoritesContainer, "Loading favorites...");

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    showMessage("Login to see favorites");
    renderEmptyState(
      favoritesContainer,
      "Login required",
      "Please login to see your favorites."
    );
    return;
  }

  const { data: favorites, error } =
    await supabaseClient
      .from("favorites")
      .select("*")
      .eq("user_id", session.user.id);

  if (error) {
    showSafeError(error, "Favorites could not be loaded.");
    return;
  }

  favoritesContainer.innerHTML = "";

  if (!favorites || favorites.length === 0) {
    renderEmptyState(
      favoritesContainer,
      "No favorites yet",
      "Start exploring venues and add your favorites."
    );

    return;
  }

  const venueIds = favorites
    .map((favorite) => favorite.venue_id)
    .filter(Boolean);

  if (venueIds.length === 0) {
    renderEmptyState(
      favoritesContainer,
      "No favorites yet",
      "Start exploring venues and add your favorites."
    );
    return;
  }

  const { data: venues, error: venuesError } =
    await supabaseClient
      .from("venues")
      .select("*")
      .in("id", venueIds);

  if (venuesError) {
    showSafeError(venuesError, "Favorite venues could not be loaded.");
    return;
  }

  const venuesById = new Map(
    (venues || []).map((venue) => [String(venue.id), venue])
  );

  const fragment = document.createDocumentFragment();

  venueIds.forEach((venueId) => {
    const venue = venuesById.get(String(venueId));

    if (!venue) return;

    fragment.appendChild(
      createVenueCard(venue, {
        favoriteCardId: true,
        showRemoveButton: true,
      })
    );
  });

  if (fragment.children.length === 0) {
    renderEmptyState(
      favoritesContainer,
      "No favorites yet",
      "Start exploring venues and add your favorites."
    );
    return;
  }

  favoritesContainer.appendChild(fragment);
}

async function loadEvents() {
  const eventsContainer =
    document.getElementById("eventsContainer");

  if (!eventsContainer) return;

  renderEmptyState(eventsContainer, "Loading events...");

  const { data: events, error } =
    await supabaseClient
      .from("events")
      .select("*");

  if (error) {
    showSafeError(error, "Events could not be loaded.");
    return;
  }

  allEvents = events || [];
  eventAttendeeCountsById =
    await loadEventAttendeeCounts(
      allEvents.map((event) => event.id)
    );

  sortEventsUpcoming();
  setupEventSearch();
  setupEventSortButtons();
}

function renderEvents(events) {
  const eventsContainer =
    document.getElementById("eventsContainer");

  if (!eventsContainer) return;

  eventsContainer.innerHTML = "";

  if (!events || events.length === 0) {
    renderEmptyState(
      eventsContainer,
      "No events found",
      "Try searching another event."
    );

    return;
  }

  const fragment = document.createDocumentFragment();

  events.forEach((event) => {
    fragment.appendChild(createEventCard(event));
  });

  eventsContainer.appendChild(fragment);
}

function sortEventsUpcoming() {
  const sortedEvents = [...allEvents].sort((a, b) => {
    return new Date(a.event_date) - new Date(b.event_date);
  });

  renderEvents(sortedEvents);
}

function sortEventsLatest() {
  const sortedEvents = [...allEvents].sort((a, b) => {
    return new Date(b.event_date) - new Date(a.event_date);
  });

  renderEvents(sortedEvents);
}

function setupEventSearch() {
  const eventSearchInput =
    document.getElementById("eventSearchInput");

  if (!eventSearchInput) return;

  eventSearchInput.addEventListener("input", () => {
    const value =
      eventSearchInput.value.toLowerCase();

    const filtered = allEvents.filter((event) => {
      const title =
        safeText(event.title).toLowerCase();

      const description =
        safeText(event.description).toLowerCase();

      const date =
        safeText(event.event_date).toLowerCase();

      return (
        title.includes(value) ||
        description.includes(value) ||
        date.includes(value)
      );
    });

    renderEvents(filtered);
  });
}

function setupEventSortButtons() {
  const upcomingEventsBtn =
    document.getElementById("upcomingEventsBtn");

  const latestEventsBtn =
    document.getElementById("latestEventsBtn");

  if (upcomingEventsBtn) {
    upcomingEventsBtn.addEventListener("click", () => {
      sortEventsUpcoming();
    });
  }

  if (latestEventsBtn) {
    latestEventsBtn.addEventListener("click", () => {
      sortEventsLatest();
    });
  }
}

function openVenue(id) {
  window.location.href = `./venue.html?id=${id}`;
}

function openEvent(id) {
  window.location.href = `./event.html?id=${id}`;
}

function setupVenueMobilePanels() {
  const actions =
    document.querySelectorAll("[data-open-panel]");
  const panels =
    document.querySelectorAll(".venue-mobile-panel");

  if (!actions.length || !panels.length) return;

  actions.forEach((button) => {
    const panelName = button.dataset.openPanel;
    const panel = document.querySelector(
      `.venue-mobile-panel[data-panel="${panelName}"]`
    );

    if (panel && panel.classList.contains("is-open")) {
      button.classList.add("is-active");
      button.setAttribute("aria-expanded", "true");
    } else {
      button.setAttribute("aria-expanded", "false");
    }
  });

  actions.forEach((button) => {
    button.addEventListener("click", () => {
      const panelName = button.dataset.openPanel;
      const panel = document.querySelector(
        `.venue-mobile-panel[data-panel="${panelName}"]`
      );

      if (!panel) return;

      const shouldOpen =
        !panel.classList.contains("is-open");

      panels.forEach((item) => {
        item.classList.remove("is-open");
      });

      actions.forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-expanded", "false");
      });

      if (shouldOpen) {
        panel.classList.add("is-open");
        button.classList.add("is-active");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });
}

function setupEventMobilePanels() {
  const actions =
    document.querySelectorAll("[data-event-panel]");
  const panels =
    document.querySelectorAll(".event-mobile-panel");

  if (!actions.length || !panels.length) return;

  actions.forEach((button) => {
    const panelName = button.dataset.eventPanel;
    const panel = document.querySelector(
      `.event-mobile-panel[data-panel="${panelName}"]`
    );

    if (panel && panel.classList.contains("is-open")) {
      button.classList.add("is-active");
      button.setAttribute("aria-expanded", "true");
    } else {
      button.setAttribute("aria-expanded", "false");
    }
  });

  actions.forEach((button) => {
    button.addEventListener("click", () => {
      const panelName = button.dataset.eventPanel;
      const panel = document.querySelector(
        `.event-mobile-panel[data-panel="${panelName}"]`
      );

      if (!panel) return;

      const shouldOpen =
        !panel.classList.contains("is-open");

      panels.forEach((item) => {
        item.classList.remove("is-open");
      });

      actions.forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-expanded", "false");
      });

      if (shouldOpen) {
        panel.classList.add("is-open");
        button.classList.add("is-active");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });
}

async function loadVenueDetails() {
  const venueName =
    document.getElementById("venueName");

  if (!venueName) return;

  setupVenueMobilePanels();
  setupVenueMenuToggle();
  setupVenueStoreToggle();

  const params = new URLSearchParams(
    window.location.search
  );

  const id = params.get("id");

  if (!id) {
    renderDetailUnavailable(
      "Venue unavailable",
      "This venue link is missing an ID."
    );
    return;
  }

  let venue = null;
  let error = null;

  try {
    ({ data: venue, error } = await supabaseClient
      .from("venues")
      .select("*")
      .eq("id", id)
      .maybeSingle());
  } catch (requestError) {
    error = requestError;
  }

  if (error || !venue) {
    console.log(error);
    renderDetailUnavailable(
      "Venue unavailable",
      "This venue does not exist or cannot be loaded right now."
    );
    if (error) {
      showToast(error.message || "Venue unavailable");
    }
    return;
  }

  setImageIfPresent("venueImage", venue.image);
  setTextIfPresent("venueName", venue.name);
  setTextIfPresent("venueCity", venue.city);
  setTextIfPresent("venueCategory", getVenueCategoryLabel(venue));
  setTextIfPresent("venueDescription", venue.description);

  const venueGalleryPhotos = await loadVenueGalleryPhotos(venue.id);
  renderVenueGallery(
    venueGalleryPhotos.length > 0
      ? venueGalleryPhotos
      : venue.image
        ? [{ image_url: venue.image }]
        : []
  );
  renderVenueMenu(await loadVenueMenu(venue.id));
  const venueProducts = await loadVenueProducts(venue.id);
  venueProducts.products = (venueProducts.products || []).map((product) => ({
    ...product,
    venues: {
      id: venue.id,
      name: venue.name,
      business_id: venue.business_id,
      owner_id: venue.owner_id,
      business_owner_id: venue.business_owner_id,
    },
    venue_name: venue.name,
  }));
  renderVenueStore(venueProducts);
  setupVenueStoreAllLink(venue.id);

  renderVenueLocation(venue);

  const averageRating =
    document.getElementById("venueAverageRating");

  if (averageRating) {
    averageRating.dataset.venueId = venue.id;
  }

  venueStatsById = {
    ...venueStatsById,
    ...(await loadVenueStats([venue.id])),
  };
  updateAverageRating([]);

  if (detailFavoriteBtn) {
    detailFavoriteBtn.addEventListener("click", () => {
      addFavorite(venue.id);
    });
  }

  await loadVenueReviews(venue.id);
  await setupVenueReviewForm(venue.id);
  await loadUserReservations(venue.id);
  await setupReservationForm(venue.id);

  let events = [];
  let eventsError = null;

  try {
    ({ data: events, error: eventsError } = await supabaseClient
      .from("events")
      .select("*")
      .eq("venue_id", venue.id));
  } catch (requestError) {
    eventsError = requestError;
  }

  const venueEvents =
    document.getElementById("venueEvents");

  if (venueEvents) {
    venueEvents.innerHTML = "";

    if (eventsError) {
      console.log(eventsError);
      renderEmptyState(
        venueEvents,
        "Events unavailable",
        "Events for this venue could not be loaded."
      );
      return;
    }

    if (!events || events.length === 0) {
      renderEmptyState(
        venueEvents,
        "No events yet",
        "This venue has no events right now."
      );
      return;
    }

    const fragment = document.createDocumentFragment();

    events.forEach((event) => {
      fragment.appendChild(
        createEventCard(event, {
          dateFallback: "",
        })
      );
    });

    venueEvents.appendChild(fragment);
  }
}

async function loadEventDetails() {
  const eventTitle =
    document.getElementById("eventTitle");

  if (!eventTitle) return;

  setupEventMobilePanels();

  const params = new URLSearchParams(
    window.location.search
  );

  const id = params.get("id");

  if (!id) {
    renderDetailUnavailable(
      "Event unavailable",
      "This event link is missing an ID."
    );
    return;
  }

  let event = null;
  let error = null;

  try {
    ({ data: event, error } = await supabaseClient
      .from("events")
      .select("*")
      .eq("id", id)
      .maybeSingle());
  } catch (requestError) {
    error = requestError;
  }

  if (error || !event) {
    console.log(error);
    renderDetailUnavailable(
      "Event unavailable",
      "This event does not exist or cannot be loaded right now."
    );
    if (error) {
      showToast(error.message || "Event unavailable");
    }
    return;
  }

  setImageIfPresent("eventImage", event.image);
  setTextIfPresent("eventTitle", event.title);
  setTextIfPresent("eventDate", event.event_date);

  const eventDate = document.getElementById("eventDate");

  if (eventDate) {
    eventDate.insertAdjacentElement(
      "afterend",
      createEventCountdownBadge(event.event_date)
    );
  }

  await refreshEventAttendance(event.id);

  setTextIfPresent("eventDescription", event.description);

  let venue = null;
  let venueError = null;

  try {
    ({ data: venue, error: venueError } = await supabaseClient
      .from("venues")
      .select("*")
      .eq("id", event.venue_id)
      .maybeSingle());
  } catch (requestError) {
    venueError = requestError;
  }

  if (venueError) {
    console.log(venueError);
  }

  const eventVenue =
    document.getElementById("eventVenue");

  if (eventVenue && venue) {
    eventVenue.innerText = safeText(venue.name);
  }

  const eventLocation =
    document.getElementById("eventLocation");

  if (eventLocation && venue) {
    eventLocation.innerText =
      safeText(venue.city) ||
      safeText(venue.address) ||
      safeText(venue.name) ||
      "Location details are connected to the venue.";
  }
}

async function checkAdminAccess() {
  const adminPage = document.getElementById("adminPage");

  if (!adminPage) return null;

  const session = await getSafeSession();

  if (!session) {
    window.location.href = "./auth.html";
    return null;
  }

  const { data, error } =
    await supabaseClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

  if (error || !data) {
    if (error) {
      console.log(error);
    }

    showToast("Admin access required");

    setTimeout(() => {
      window.location.href = "./index.html";
    }, 800);

    return null;
  }

  return session;
}

function getAdminValue(id) {
  const element = document.getElementById(id);

  return element ? element.value.trim() : "";
}

function setAdminValue(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.value = value || "";
  }
}

function getAdminFile(id) {
  const element = document.getElementById(id);

  if (!element || !element.files.length) {
    return null;
  }

  return element.files[0];
}

function getAdminFiles(id) {
  const element = document.getElementById(id);

  if (!element || !element.files || !element.files.length) {
    return [];
  }

  return Array.from(element.files);
}

function clearAdminFile(id) {
  const element = document.getElementById(id);

  if (element) {
    element.value = "";
  }
}

function getVenueGalleryUrls(inputId) {
  return getAdminValue(inputId)
    .split(/\r?\n|,/)
    .map((url) => safeText(url).trim())
    .filter(Boolean);
}

async function uploadVenueGalleryFiles(files, venueId) {
  const sourceFiles =
    files ||
    businessMediaState.venueGallery.pendingFiles.map(
      (pending) => pending.file
    );

  if (!sourceFiles.length) return [];

  const urls = [];

  for (const file of sourceFiles) {
    const uploadedUrl = await uploadMediaImage(file, "venues", {
      venueId,
    });

    if (!uploadedUrl) {
      return [];
    }

    urls.push(uploadedUrl);
  }

  return urls;
}

async function saveVenueGalleryPhotos(venueId, imageUrls, startOrder = 0) {
  if (!venueId || !imageUrls || imageUrls.length === 0) {
    return [];
  }

  const rows = imageUrls.map((imageUrl, index) => ({
    venue_id: venueId,
    image_url: imageUrl,
    sort_order: startOrder + index,
  }));

  try {
    const { data, error } = await supabaseClient
      .from("venue_photos")
      .insert(rows)
      .select("id, image_url, sort_order");

    if (error) {
      showToast("Venue galeri fotoğrafları kaydedilemedi");
      return [];
    }

    return data || [];
  } catch (error) {
    showToast("Venue galeri fotoğrafları kaydedilemedi");
    return [];
  }
}

async function getVenueGalleryPhotoCount(venueId) {
  if (!venueId) return 0;

  try {
    const { count, error } = await supabaseClient
      .from("venue_photos")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);

    return error ? 0 : count || 0;
  } catch (error) {
    return 0;
  }
}

async function persistBusinessVenueGalleryChanges(venueId) {
  if (!venueId) return { savedUrls: [], primaryImage: "" };

  const removedIds = [
    ...new Set(businessMediaState.venueGallery.removedPhotoIds),
  ];
  const keptPhotos = businessMediaState.venueGallery.photos.filter(
    (photo) => !removedIds.includes(String(photo.id))
  );
  const existingCount = await getVenueGalleryPhotoCount(venueId);
  const pendingCount =
    businessMediaState.venueGallery.pendingFiles.length;
  const projectedCount =
    existingCount - removedIds.length + pendingCount;

  if (projectedCount > MAX_VENUE_GALLERY_IMAGES) {
    showToast(`En fazla ${MAX_VENUE_GALLERY_IMAGES} venue fotoğrafı`);
    return { savedUrls: [], primaryImage: "" };
  }

  await deleteVenueGalleryPhotoRows(removedIds);

  const uploadedUrls = await uploadVenueGalleryFiles(
    null,
    venueId
  );
  const urlRows = getVenueGalleryUrls("businessVenueGalleryUrls");
  const allNewUrls = [...urlRows, ...uploadedUrls];
  const startOrder = Math.max(
    keptPhotos.reduce(
      (max, photo) => Math.max(max, Number(photo.sort_order) || 0),
      -1
    ) + 1,
    existingCount - removedIds.length,
    0
  );
  const insertedRows = await saveVenueGalleryPhotos(
    venueId,
    allNewUrls,
    startOrder
  );
  const savedUrls = insertedRows.map((row) => row.image_url);
  const primaryImage =
    keptPhotos[0] && keptPhotos[0].image_url
      ? keptPhotos[0].image_url
      : savedUrls[0] || "";

  if (primaryImage) {
    await syncVenuePrimaryImage(venueId, primaryImage);
  }

  resetBusinessVenueGalleryState();
  await loadBusinessVenueGalleryState(venueId);

  return { savedUrls, primaryImage };
}

async function loadVenueGalleryPhotos(venueId) {
  if (!venueId) return [];

  try {
    const { data, error } = await supabaseClient
      .from("venue_photos")
      .select("id, image_url, sort_order, created_at")
      .eq("venue_id", venueId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return [];
    }

    return data || [];
  } catch (error) {
    return [];
  }
}

function validateMediaImageFile(file) {
  if (!file) return true;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    showToast("Sadece JPEG, PNG veya WebP yükleyebilirsiniz");
    return false;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    showToast("Görsel en fazla 4 MB olabilir");
    return false;
  }

  return true;
}

function validateAdminImage(file) {
  return validateMediaImageFile(file);
}

function getMediaFileExtension(file) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensions[file.type] || "jpg";
}

function getSafeFileName(fileName) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");

  return safeName || "image";
}

function buildMediaStoragePath(folder, file, context = {}) {
  const timestamp = Date.now();
  const safeName = getSafeFileName(file.name);
  const extension = getMediaFileExtension(file);

  if (folder === "avatars" && context.userId) {
    return `avatars/${context.userId}/avatar-${timestamp}.${extension}`;
  }

  if (
    (folder === "venues" || folder === "venue-gallery") &&
    context.venueId
  ) {
    return `venues/${context.venueId}/${timestamp}-${safeName}`;
  }

  if (
    (folder === "products" || folder === "product-gallery") &&
    context.productId
  ) {
    return `products/${context.productId}/${timestamp}-${safeName}`;
  }

  return `${folder}/${timestamp}-${safeName}`;
}

async function uploadMediaImage(file, folder, context = {}) {
  if (!file) return "";

  if (!validateMediaImageFile(file)) {
    return "";
  }

  const filePath = buildMediaStoragePath(folder, file, context);
  let error = null;

  try {
    ({ error } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        upsert: folder === "avatars",
      }));
  } catch (uploadError) {
    error = uploadError;
  }

  if (error) {
    showToast(error.message || "Görsel yüklenemedi");
    return "";
  }

  const { data } = supabaseClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function uploadAdminImage(file, folder, context = {}) {
  return uploadMediaImage(file, folder, context);
}

function getProfileInitials(profile, session) {
  const source =
    getProfileDisplayName(profile) ||
    safeText(session && session.user && session.user.email) ||
    "T";

  const parts = source.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  return (parts[0] || "T").slice(0, 2).toUpperCase();
}

function renderProfileAvatar(session, profile) {
  const avatarWrap = document.querySelector(
    ".profile-avatar-wrap .profile-avatar"
  );
  const avatarImage = document.getElementById("profileAvatarImage");
  const avatarInitials = document.getElementById("profileAvatarInitials");

  if (!avatarWrap) return;

  const avatarUrl = getProfileAvatar(profile);
  const initials = getProfileInitials(profile, session);

  if (avatarInitials) {
    avatarInitials.textContent = initials;
  } else if (!avatarImage) {
    avatarWrap.textContent = initials;
  }

  if (avatarImage) {
    if (avatarUrl) {
      avatarImage.src = avatarUrl;
      avatarImage.hidden = false;
      avatarWrap.classList.add("has-image");
      if (avatarInitials) avatarInitials.hidden = true;
      avatarImage.addEventListener(
        "error",
        () => {
          avatarImage.hidden = true;
          avatarWrap.classList.remove("has-image");
          if (avatarInitials) {
            avatarInitials.hidden = false;
            avatarInitials.textContent = initials;
          }
        },
        { once: true }
      );
    } else {
      avatarImage.removeAttribute("src");
      avatarImage.hidden = true;
      avatarWrap.classList.remove("has-image");
      if (avatarInitials) avatarInitials.hidden = false;
    }
  }
}

async function saveProfileAvatarUrl(userId, avatarUrl) {
  if (!userId || !avatarUrl) return false;

  const payload = {
    id: userId,
    avatar_url: avatarUrl,
  };

  try {
    const { error } = await supabaseClient
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      showSafeError(error, "Profil fotoğrafı kaydedilemedi.");
      return false;
    }

    return true;
  } catch (error) {
    showSafeError(error, "Profil fotoğrafı kaydedilemedi.");
    return false;
  }
}

async function uploadProfileAvatar(file, session) {
  if (!file || !session || !session.user) return "";

  if (!validateMediaImageFile(file)) {
    return "";
  }

  const uploadedUrl = await uploadMediaImage(file, "avatars", {
    userId: session.user.id,
  });

  if (!uploadedUrl) return "";

  const saved = await saveProfileAvatarUrl(
    session.user.id,
    uploadedUrl
  );

  return saved ? uploadedUrl : "";
}

async function hydrateProfileAvatar(session) {
  if (!session || !session.user) return;

  const profile = await loadProfileRecordByUserId(session.user.id);
  renderProfileAvatar(session, profile);
}

function setupProfileAvatarUpload() {
  const input = document.getElementById("profileAvatarInput");
  const button = document.getElementById("profileAvatarChangeBtn");

  if (!input || input.dataset.bound === "true") return;

  input.dataset.bound = "true";

  const openPicker = () => input.click();

  if (button) {
    button.addEventListener("click", openPicker);
  }

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];

    input.value = "";

    if (!file) return;

    if (!validateMediaImageFile(file)) return;

    const session = await getSafeSession();

    if (!session) {
      showToast("Oturum açmanız gerekiyor");
      return;
    }

    const uploadedUrl = await uploadProfileAvatar(file, session);

    if (!uploadedUrl) return;

    renderProfileAvatar(session, { avatar_url: uploadedUrl });
    showToast("Profil fotoğrafı güncellendi");
  });
}

function revokeMediaPreviewUrls(items) {
  (items || []).forEach((item) => {
    if (item && item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
}

function resetBusinessVenueGalleryState() {
  revokeMediaPreviewUrls(businessMediaState.venueGallery.pendingFiles);
  businessMediaState.venueGallery = {
    photos: [],
    pendingFiles: [],
    removedPhotoIds: [],
  };
  renderBusinessVenueGalleryPreview();
}

function resetBusinessProductGalleryState() {
  revokeMediaPreviewUrls(businessMediaState.productGallery.pendingFiles);
  businessMediaState.productGallery = {
    photos: [],
    pendingFiles: [],
    removedPhotoIds: [],
  };
  renderBusinessProductGalleryPreview();
}

function createMediaPreviewThumb(options) {
  const {
    imageUrl,
    label = "",
    onDelete,
    isPending = false,
  } = options;
  const item = document.createElement("div");
  item.className = "media-preview-thumb";

  if (isPending) {
    item.classList.add("media-preview-thumb--pending");
  }

  const image = document.createElement("img");
  image.src = getImage(imageUrl);
  image.alt = label || "Preview";
  image.loading = "lazy";
  item.appendChild(image);

  if (onDelete) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "media-preview-delete";
    deleteButton.setAttribute("aria-label", "Görseli sil");
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", onDelete);
    item.appendChild(deleteButton);
  }

  return item;
}

function renderBusinessVenueGalleryPreview() {
  const grid = document.getElementById("businessVenueGalleryPreview");
  const status = document.getElementById("businessVenueGalleryStatus");

  if (!grid) return;

  grid.innerHTML = "";

  const keptPhotos = businessMediaState.venueGallery.photos.filter(
    (photo) =>
      !businessMediaState.venueGallery.removedPhotoIds.includes(
        String(photo.id)
      )
  );
  const totalCount =
    keptPhotos.length +
    businessMediaState.venueGallery.pendingFiles.length;

  if (status) {
    status.textContent = `${totalCount}/${MAX_VENUE_GALLERY_IMAGES} fotoğraf`;
  }

  keptPhotos.forEach((photo) => {
    grid.appendChild(
      createMediaPreviewThumb({
        imageUrl: photo.image_url,
        label: "Venue photo",
        onDelete: () => {
          businessMediaState.venueGallery.removedPhotoIds.push(
            String(photo.id)
          );
          renderBusinessVenueGalleryPreview();
        },
      })
    );
  });

  businessMediaState.venueGallery.pendingFiles.forEach(
    (pending, index) => {
      grid.appendChild(
        createMediaPreviewThumb({
          imageUrl: pending.previewUrl,
          label: "Pending venue photo",
          isPending: true,
          onDelete: () => {
            const removed = businessMediaState.venueGallery.pendingFiles.splice(
              index,
              1
            )[0];

            if (removed && removed.previewUrl) {
              URL.revokeObjectURL(removed.previewUrl);
            }

            renderBusinessVenueGalleryPreview();
          },
        })
      );
    }
  );
}

function renderBusinessProductGalleryPreview() {
  const grid = document.getElementById("businessProductGalleryPreview");
  const status = document.getElementById("businessProductGalleryStatus");

  if (!grid) return;

  grid.innerHTML = "";

  const keptPhotos = businessMediaState.productGallery.photos.filter(
    (photo) =>
      !businessMediaState.productGallery.removedPhotoIds.includes(
        String(photo.id)
      )
  );
  const totalCount =
    keptPhotos.length +
    businessMediaState.productGallery.pendingFiles.length;

  if (status) {
    status.textContent = `${totalCount}/${MAX_PRODUCT_GALLERY_IMAGES} fotoğraf`;
  }

  keptPhotos.forEach((photo) => {
    grid.appendChild(
      createMediaPreviewThumb({
        imageUrl: photo.image_url,
        label: "Product photo",
        onDelete: () => {
          businessMediaState.productGallery.removedPhotoIds.push(
            String(photo.id)
          );
          renderBusinessProductGalleryPreview();
        },
      })
    );
  });

  businessMediaState.productGallery.pendingFiles.forEach(
    (pending, index) => {
      grid.appendChild(
        createMediaPreviewThumb({
          imageUrl: pending.previewUrl,
          label: "Pending product photo",
          isPending: true,
          onDelete: () => {
            const removed =
              businessMediaState.productGallery.pendingFiles.splice(
                index,
                1
              )[0];

            if (removed && removed.previewUrl) {
              URL.revokeObjectURL(removed.previewUrl);
            }

            renderBusinessProductGalleryPreview();
          },
        })
      );
    }
  );
}

async function loadBusinessVenueGalleryState(venueId) {
  resetBusinessVenueGalleryState();

  if (!venueId) return;

  businessMediaState.venueGallery.photos =
    await loadVenueGalleryPhotos(venueId);
  renderBusinessVenueGalleryPreview();
}

async function loadBusinessProductGalleryState(productId) {
  resetBusinessProductGalleryState();

  if (!productId) return;

  try {
    const { data, error } = await supabaseClient
      .from("venue_product_images")
      .select("id, image_url, sort_order, created_at")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error) {
      businessMediaState.productGallery.photos = data || [];
    }
  } catch (error) {
    businessMediaState.productGallery.photos = [];
  }

  renderBusinessProductGalleryPreview();
}

function queueBusinessVenueGalleryFiles(files) {
  const keptCount = businessMediaState.venueGallery.photos.filter(
    (photo) =>
      !businessMediaState.venueGallery.removedPhotoIds.includes(
        String(photo.id)
      )
  ).length;
  const availableSlots =
    MAX_VENUE_GALLERY_IMAGES -
    keptCount -
    businessMediaState.venueGallery.pendingFiles.length;

  if (availableSlots <= 0) {
    showToast(`En fazla ${MAX_VENUE_GALLERY_IMAGES} venue fotoğrafı`);
    return;
  }

  Array.from(files || [])
    .slice(0, availableSlots)
    .forEach((file) => {
      if (!validateMediaImageFile(file)) return;

      businessMediaState.venueGallery.pendingFiles.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

  if ((files || []).length > availableSlots) {
    showToast(`En fazla ${MAX_VENUE_GALLERY_IMAGES} venue fotoğrafı`);
  }

  renderBusinessVenueGalleryPreview();
}

function queueBusinessProductGalleryFiles(files) {
  const keptCount = businessMediaState.productGallery.photos.filter(
    (photo) =>
      !businessMediaState.productGallery.removedPhotoIds.includes(
        String(photo.id)
      )
  ).length;
  const availableSlots =
    MAX_PRODUCT_GALLERY_IMAGES -
    keptCount -
    businessMediaState.productGallery.pendingFiles.length;

  if (availableSlots <= 0) {
    showToast(`En fazla ${MAX_PRODUCT_GALLERY_IMAGES} ürün fotoğrafı`);
    return;
  }

  Array.from(files || [])
    .slice(0, availableSlots)
    .forEach((file) => {
      if (!validateMediaImageFile(file)) return;

      businessMediaState.productGallery.pendingFiles.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

  if ((files || []).length > availableSlots) {
    showToast(`En fazla ${MAX_PRODUCT_GALLERY_IMAGES} ürün fotoğrafı`);
  }

  renderBusinessProductGalleryPreview();
}

async function deleteVenueGalleryPhotoRows(photoIds) {
  if (!photoIds || photoIds.length === 0) return true;

  try {
    const { error } = await supabaseClient
      .from("venue_photos")
      .delete()
      .in("id", photoIds);

    return !error;
  } catch (error) {
    return false;
  }
}

async function deleteProductGalleryPhotoRows(photoIds) {
  if (!photoIds || photoIds.length === 0) return true;

  try {
    const { error } = await supabaseClient
      .from("venue_product_images")
      .delete()
      .in("id", photoIds);

    return !error;
  } catch (error) {
    return false;
  }
}

async function syncVenuePrimaryImage(venueId, imageUrl) {
  if (!venueId || !imageUrl) return;

  try {
    await supabaseClient
      .from("venues")
      .update({ image: imageUrl })
      .eq("id", venueId);
  } catch (error) {
    // Keep venue save successful even if cover sync fails.
  }
}

async function syncProductPrimaryImage(productId, imageUrl) {
  if (!productId || !imageUrl) return;

  try {
    await supabaseClient
      .from("venue_products")
      .update({ image_url: imageUrl })
      .eq("id", productId);
  } catch (error) {
    // Keep product save successful even if cover sync fails.
  }
}

function setupBusinessVenueGalleryUpload() {
  const fileInput = document.getElementById("businessVenueGalleryFiles");

  if (!fileInput || fileInput.dataset.bound === "true") return;

  fileInput.dataset.bound = "true";
  fileInput.addEventListener("change", () => {
    queueBusinessVenueGalleryFiles(fileInput.files);
    fileInput.value = "";
  });
}

function setupBusinessProductGalleryUpload() {
  const fileInput = document.getElementById("businessProductGalleryFiles");

  if (!fileInput || fileInput.dataset.bound === "true") return;

  fileInput.dataset.bound = "true";
  fileInput.addEventListener("change", () => {
    queueBusinessProductGalleryFiles(fileInput.files);
    fileInput.value = "";
  });
}

function setupBusinessProductGalleryManager() {
  const productSelect = document.getElementById("pgProductSelect");
  const currentPhotos = document.getElementById("pgCurrentPhotos");
  const fileInput = document.getElementById("pgFileInput");
  const status = document.getElementById("pgStatus");
  const manager = document.getElementById("productGalleryManager");

  if (!manager || manager.dataset.bound === "true") return;

  manager.dataset.bound = "true";

  function setStatus(message, isError) {
    if (!status) return;

    status.textContent = message;
    status.style.color = isError
      ? "rgba(220,80,60,0.80)"
      : "rgba(240,192,96,0.70)";
  }

  async function populateProductSelect() {
    if (!productSelect) return;

    const venueSelect = document.getElementById("businessStoreVenueSelect");
    const venueId = venueSelect ? venueSelect.value : "";

    productSelect.innerHTML =
      '<option value="">— Ürün seç —</option>';

    if (currentPhotos) currentPhotos.innerHTML = "";

    if (!venueId) {
      setStatus("Önce yukarıdan venue seçin.");
      return;
    }

    setStatus("");

    const { data, error } = await supabaseClient
      .from("venue_products")
      .select("id, name, deleted_at")
      .eq("venue_id", venueId)
      .order("sort_order", { ascending: true });

    if (error || !data) return;

    data
      .filter((product) => !product.deleted_at)
      .forEach((product) => {
        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = safeText(product.name);
        productSelect.appendChild(option);
      });
  }

  async function loadGallery(productId) {
    if (!currentPhotos) return;

    currentPhotos.innerHTML = "";

    if (!productId) return;

    const { data, error } = await supabaseClient
      .from("venue_product_images")
      .select("id, image_url, sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setStatus("Fotoğraflar yüklenemedi.", true);
      return;
    }

    if (!data || data.length === 0) {
      setStatus("Henüz ek fotoğraf yok.");
      return;
    }

    setStatus(`${data.length}/${MAX_PRODUCT_GALLERY_IMAGES} fotoğraf`);

    data.forEach((image, index) => {
      const wrap = createMediaPreviewThumb({
        imageUrl: image.image_url,
        label: "Product gallery photo",
        onDelete: async () => {
          const { error: deleteError } = await supabaseClient
            .from("venue_product_images")
            .delete()
            .eq("id", image.id);

          if (deleteError) {
            setStatus("Silinemedi.", true);
            return;
          }

          if (index === 0) {
            const nextImage = data[1];
            await syncProductPrimaryImage(
              productId,
              nextImage ? nextImage.image_url : ""
            );
          }

          setStatus("Silindi.");
          await loadGallery(productId);
        },
      });

      currentPhotos.appendChild(wrap);
    });
  }

  async function uploadFiles(files, productId) {
    if (!files || !files.length || !productId) return;

    const { data: existing, error: countError } = await supabaseClient
      .from("venue_product_images")
      .select("id")
      .eq("product_id", productId);

    if (countError) {
      setStatus("Fotoğraflar kontrol edilemedi.", true);
      return;
    }

    const availableSlots =
      MAX_PRODUCT_GALLERY_IMAGES - (existing || []).length;

    if (availableSlots <= 0) {
      setStatus(
        `En fazla ${MAX_PRODUCT_GALLERY_IMAGES} ürün fotoğrafı`,
        true
      );
      return;
    }

    setStatus("Yükleniyor…");

    const session = await getSafeSession();

    if (!session) {
      setStatus("Oturum açık değil.", true);
      return;
    }

    let success = 0;
    const filesToUpload = Array.from(files).slice(0, availableSlots);

    for (let index = 0; index < filesToUpload.length; index += 1) {
      const file = filesToUpload[index];

      if (!validateMediaImageFile(file)) continue;

      const uploadedUrl = await uploadMediaImage(
        file,
        "products",
        { productId }
      );

      if (!uploadedUrl) continue;

      const sortOrder = (existing || []).length + success;
      const { error: insertError } = await supabaseClient
        .from("venue_product_images")
        .insert([
          {
            product_id: productId,
            image_url: uploadedUrl,
            sort_order: sortOrder,
          },
        ]);

      if (insertError) {
        setStatus("Kayıt hatası.", true);
        continue;
      }

      if (sortOrder === 0) {
        await syncProductPrimaryImage(productId, uploadedUrl);
      }

      success += 1;
    }

    if (fileInput) fileInput.value = "";

    setStatus(`${success} fotoğraf eklendi.`);
    await loadGallery(productId);
  }

  const venueSelect = document.getElementById("businessStoreVenueSelect");

  if (venueSelect) {
    venueSelect.addEventListener("change", populateProductSelect);
  }

  window.addEventListener(
    "business-store-products-refreshed",
    populateProductSelect
  );

  if (productSelect) {
    productSelect.addEventListener("change", () => {
      loadGallery(productSelect.value);
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      uploadFiles(fileInput.files, productSelect.value);
    });
  }

  populateProductSelect();
}

function clearAdminVenueForm() {
  setAdminValue("adminVenueId", "");
  setAdminValue("adminVenueName", "");
  setAdminValue("adminVenueCity", "");
  setAdminValue("adminVenueCategory", DEFAULT_VENUE_CATEGORY);
  setAdminValue("adminVenueImage", "");
  clearAdminFile("adminVenueImageFile");
  setAdminValue("adminVenueAddress", "");
  setAdminValue("adminVenueLatitude", "");
  setAdminValue("adminVenueLongitude", "");
  setAdminValue("adminVenueDescription", "");
}

function clearAdminEventForm() {
  setAdminValue("adminEventId", "");
  setAdminValue("adminEventVenueId", "");
  setAdminValue("adminEventTitle", "");
  setAdminValue("adminEventDate", "");
  setAdminValue("adminEventImage", "");
  clearAdminFile("adminEventImageFile");
  setAdminValue("adminEventDescription", "");
}

function createAdminActions(onEdit, onDelete) {
  const actions = document.createElement("div");
  actions.className = "admin-item-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "secondary-btn";
  editButton.textContent = "Edit";
  bindReservationAction(editButton, onEdit);
  actions.appendChild(editButton);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "admin-delete-btn";
  deleteButton.textContent = "Delete";
  bindReservationAction(deleteButton, onDelete);
  actions.appendChild(deleteButton);

  return actions;
}

function renderAdminVenues(venues) {
  const adminVenuesList =
    document.getElementById("adminVenuesList");

  if (!adminVenuesList) return;

  adminVenuesList.innerHTML = "";

  if (!venues || venues.length === 0) {
    renderEmptyState(
      adminVenuesList,
      "No venues yet",
      "Create a venue to get started."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  venues.forEach((venue) => {
    const item = document.createElement("div");
    item.className = "admin-item";

    const content = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = safeText(venue.name);
    content.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "venue-meta";
    meta.textContent =
      `#${venue.id} ${getVenueMetaLabel(venue)}`;
    content.appendChild(meta);

    const description = document.createElement("p");
    description.textContent =
      safeText(venue.description);
    content.appendChild(description);

    item.appendChild(content);
    item.appendChild(
      createAdminActions(
        () => {
          setAdminValue("adminVenueId", venue.id);
          setAdminValue("adminVenueName", venue.name);
          setAdminValue("adminVenueCity", venue.city);
          setAdminValue(
            "adminVenueCategory",
            getVenueCategoryValue(venue)
          );
          setAdminValue("adminVenueImage", venue.image);
          setAdminValue(
            "adminVenueAddress",
            venue.address
          );
          setAdminValue(
            "adminVenueLatitude",
            venue.latitude
          );
          setAdminValue(
            "adminVenueLongitude",
            venue.longitude
          );
          setAdminValue(
            "adminVenueDescription",
            venue.description
          );
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        () => deleteAdminVenue(venue.id)
      )
    );

    fragment.appendChild(item);
  });

  adminVenuesList.appendChild(fragment);
}

function renderAdminEvents(events) {
  const adminEventsList =
    document.getElementById("adminEventsList");

  if (!adminEventsList) return;

  adminEventsList.innerHTML = "";

  if (!events || events.length === 0) {
    renderEmptyState(
      adminEventsList,
      "No events yet",
      "Create an event to get started."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  events.forEach((eventItem) => {
    const item = document.createElement("div");
    item.className = "admin-item";

    const content = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = safeText(eventItem.title);
    content.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "venue-meta";
    meta.textContent =
      `#${eventItem.id} Venue #${safeText(
        eventItem.venue_id
      )} ${safeText(eventItem.event_date)}`;
    content.appendChild(meta);

    const description = document.createElement("p");
    description.textContent =
      safeText(eventItem.description);
    content.appendChild(description);

    item.appendChild(content);
    item.appendChild(
      createAdminActions(
        () => {
          setAdminValue("adminEventId", eventItem.id);
          setAdminValue(
            "adminEventVenueId",
            eventItem.venue_id
          );
          setAdminValue("adminEventTitle", eventItem.title);
          setAdminValue(
            "adminEventDate",
            eventItem.event_date
          );
          setAdminValue("adminEventImage", eventItem.image);
          setAdminValue(
            "adminEventDescription",
            eventItem.description
          );
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        () => deleteAdminEvent(eventItem.id)
      )
    );

    fragment.appendChild(item);
  });

  adminEventsList.appendChild(fragment);
}

function renderAdminReservations(reservations) {
  const adminReservationsList =
    document.getElementById("adminReservationsList");

  if (!adminReservationsList) return;

  adminReservationsList.innerHTML = "";

  if (!reservations || reservations.length === 0) {
    renderEmptyState(
      adminReservationsList,
      "No reservations yet",
      "Reservation requests will appear here."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  reservations.forEach((reservation) => {
    const item = document.createElement("div");
    item.className =
      `admin-item reservation-management-card ${getReservationStatusClass(
        reservation.status
      )}`;

    const content = document.createElement("div");
    content.className = "reservation-management-content";

    const header = document.createElement("div");
    header.className = "reservation-card-header";

    const title = document.createElement("h3");
    title.textContent =
      `Venue #${safeText(reservation.venue_id)}`;
    header.appendChild(title);
    header.appendChild(createStatusBadge(reservation.status));
    content.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "reservation-meta-grid";
    meta.appendChild(
      createReservationMeta(
        "Date",
        reservation.reservation_date
      )
    );
    meta.appendChild(
      createReservationMeta(
        "Time",
        reservation.reservation_time
      )
    );
    meta.appendChild(
      createReservationMeta(
        "Guests",
        `${reservation.party_size || 0}`
      )
    );
    content.appendChild(meta);

    const user = document.createElement("p");
    user.className = "reservation-note";
    user.textContent =
      `User: ${safeText(reservation.user_id)}`;
    content.appendChild(user);

    if (reservation.note) {
      const note = document.createElement("p");
      note.className = "reservation-note";
      note.textContent = reservation.note;
      content.appendChild(note);
    }

    const actions = createReservationActions();

    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "btn";
    approveButton.textContent = "Approve";
    bindReservationAction(approveButton, () => {
      updateReservationStatus(reservation.id, "approved");
    });
    actions.appendChild(approveButton);

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "admin-delete-btn";
    rejectButton.textContent = "Reject";
    bindReservationAction(rejectButton, () => {
      updateReservationStatus(reservation.id, "rejected");
    });
    actions.appendChild(rejectButton);

    item.appendChild(content);
    item.appendChild(actions);
    fragment.appendChild(item);
  });

  adminReservationsList.appendChild(fragment);
}

function renderAdminBusinessApplications(businesses) {
  const list =
    document.getElementById("adminBusinessApplicationsList");

  if (!list) return;

  list.innerHTML = "";

  if (!businesses || businesses.length === 0) {
    renderEmptyState(
      list,
      "No pending applications",
      "Business applications waiting for review will appear here."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  businesses.forEach((business) => {
    const item = document.createElement("div");
    item.className = "admin-item";

    const content = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = safeText(business.name);
    content.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "venue-meta";
    meta.textContent = `Owner: ${safeText(
      business.owner_id
    )}`;
    content.appendChild(meta);

    content.appendChild(createStatusBadge(business.status));

    if (business.description) {
      const description = document.createElement("p");
      description.textContent = business.description;
      content.appendChild(description);
    }

    if (business.phone) {
      const phone = document.createElement("p");
      phone.textContent = `Phone: ${business.phone}`;
      content.appendChild(phone);
    }

    if (business.address) {
      const address = document.createElement("p");
      address.textContent = `Address: ${business.address}`;
      content.appendChild(address);
    }

    const actions = document.createElement("div");
    actions.className = "admin-item-actions";

    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "btn";
    approveButton.textContent = "Approve";
    bindReservationAction(approveButton, () => {
      updateBusinessApplicationStatus(
        business.id,
        "approved"
      );
    });
    actions.appendChild(approveButton);

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "admin-delete-btn";
    rejectButton.textContent = "Reject";
    bindReservationAction(rejectButton, () => {
      const reason = prompt("Rejection reason");

      if (reason === null) return;

      if (!reason.trim()) {
        showToast("Rejection reason required");
        return;
      }

      updateBusinessApplicationStatus(
        business.id,
        "rejected",
        reason
      );
    });
    actions.appendChild(rejectButton);

    item.appendChild(content);
    item.appendChild(actions);
    fragment.appendChild(item);
  });

  list.appendChild(fragment);
}

async function loadAdminVenues() {
  const adminVenuesList =
    document.getElementById("adminVenuesList");

  if (!adminVenuesList) return;

  renderEmptyState(adminVenuesList, "Loading venues...");

  const { data, error } =
    await supabaseClient
      .from("venues")
      .select("*")
      .order("id", { ascending: false });

  if (error) {
    showSafeError(error, "Venues could not be loaded.");
    return;
  }

  renderAdminVenues(data || []);
}

async function loadAdminEvents() {
  const adminEventsList =
    document.getElementById("adminEventsList");

  if (!adminEventsList) return;

  renderEmptyState(adminEventsList, "Loading events...");

  const { data, error } =
    await supabaseClient
      .from("events")
      .select("*")
      .order("id", { ascending: false });

  if (error) {
    showSafeError(error, "Events could not be loaded.");
    return;
  }

  renderAdminEvents(data || []);
}

async function loadAdminReservations() {
  const adminReservationsList =
    document.getElementById("adminReservationsList");

  if (!adminReservationsList) return;

  renderEmptyState(
    adminReservationsList,
    "Loading reservations..."
  );

  const { data, error } =
    await supabaseClient
      .from("reservations")
      .select("*")
      .order("created_at", { ascending: false });

  if (error) {
    showSafeError(error, "Reservations could not be loaded.");
    return;
  }

  renderAdminReservations(data || []);
}

async function loadAdminBusinessApplications() {
  const list =
    document.getElementById("adminBusinessApplicationsList");

  if (!list) return;

  renderEmptyState(list, "Loading applications...");

  const { data, error } =
    await supabaseClient
      .from("businesses")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

  if (error) {
    showSafeError(error, "Applications could not be loaded.");
    return;
  }

  renderAdminBusinessApplications(data || []);
}

async function saveAdminVenue(event) {
  event.preventDefault();

  const id = getAdminValue("adminVenueId");
  const latitudeValue = getAdminValue("adminVenueLatitude");
  const longitudeValue = getAdminValue("adminVenueLongitude");
  const hasLatitude = latitudeValue !== "";
  const hasLongitude = longitudeValue !== "";

  if (hasLatitude !== hasLongitude) {
    showToast("Enter both latitude and longitude");
    return;
  }

  if (
    hasLatitude &&
    !hasValidCoordinate(latitudeValue, longitudeValue)
  ) {
    showToast("Latitude or longitude is out of range");
    return;
  }

  const imageFile = getAdminFile("adminVenueImageFile");
  const uploadedImage = imageFile
    ? await uploadAdminImage(imageFile, "venues")
    : "";

  if (imageFile && !uploadedImage) return;

  const payload = {
    name: getAdminValue("adminVenueName"),
    city: getAdminValue("adminVenueCity"),
    category: getVenueCategoryValue({
      category: getAdminValue("adminVenueCategory"),
    }),
    image: uploadedImage || getAdminValue("adminVenueImage"),
    address: getAdminValue("adminVenueAddress"),
    latitude: hasLatitude ? Number(latitudeValue) : null,
    longitude: hasLongitude ? Number(longitudeValue) : null,
    description: getAdminValue("adminVenueDescription"),
  };

  const request = id
    ? supabaseClient
        .from("venues")
        .update(payload)
        .eq("id", id)
    : supabaseClient.from("venues").insert([payload]);

  const { error } = await request;

  if (error) {
    showSafeError(error, "Venue could not be saved.");
    return;
  }

  showToast(id ? "Venue updated" : "Venue created");
  clearAdminVenueForm();
  await loadAdminVenues();
}

async function saveAdminEvent(event) {
  event.preventDefault();

  const id = getAdminValue("adminEventId");
  const imageFile = getAdminFile("adminEventImageFile");
  const uploadedImage = imageFile
    ? await uploadAdminImage(imageFile, "events")
    : "";

  if (imageFile && !uploadedImage) return;

  const payload = {
    venue_id: getAdminValue("adminEventVenueId"),
    title: getAdminValue("adminEventTitle"),
    event_date: getAdminValue("adminEventDate"),
    image: uploadedImage || getAdminValue("adminEventImage"),
    description: getAdminValue("adminEventDescription"),
  };

  const request = id
    ? supabaseClient
        .from("events")
        .update(payload)
        .eq("id", id)
    : supabaseClient.from("events").insert([payload]);

  const { error } = await request;

  if (error) {
    showSafeError(error, "Event could not be saved.");
    return;
  }

  showToast(id ? "Event updated" : "Event created");
  clearAdminEventForm();
  await loadAdminEvents();
}

async function deleteAdminVenue(id) {
  if (!confirm("Delete this venue?")) return;

  const { error } =
    await supabaseClient
      .from("venues")
      .delete()
      .eq("id", id);

  if (error) {
    showSafeError(error, "Venue could not be deleted.");
    return;
  }

  showToast("Venue deleted");
  await loadAdminVenues();
  await loadAdminEvents();
}

async function deleteAdminEvent(id) {
  if (!confirm("Delete this event?")) return;

  const { error } =
    await supabaseClient
      .from("events")
      .delete()
      .eq("id", id);

  if (error) {
    showSafeError(error, "Event could not be deleted.");
    return;
  }

  showToast("Event deleted");
  await loadAdminEvents();
}

async function updateReservationStatus(id, status) {
  const { data: reservation, error: reservationError } =
    await supabaseClient
      .from("reservations")
      .select(
        "id, user_id, venue_id, reservation_date, reservation_time"
      )
      .eq("id", id)
      .maybeSingle();

  if (reservationError) {
    console.log(reservationError);
  }

  const { error } =
    await supabaseClient
      .from("reservations")
      .update({ status })
      .eq("id", id);

  if (error) {
    showSafeError(error, "Reservation status could not be updated.");
    return;
  }

  showToast(`Reservation ${status}`);
  await notifyUserReservationStatus(reservation, status);
  await loadAdminReservations();
}

async function updateBusinessApplicationStatus(
  id,
  status,
  rejectionReason = ""
) {
  const { data: business, error: businessError } =
    await supabaseClient
      .from("businesses")
      .select("id, owner_id, name")
      .eq("id", id)
      .maybeSingle();

  if (businessError) {
    console.log(businessError);
  }

  const payload = {
    status,
    rejection_reason:
      status === "rejected" ? rejectionReason.trim() : "",
  };

  const { error } =
    await supabaseClient
      .from("businesses")
      .update(payload)
      .eq("id", id);

  if (error) {
    showSafeError(error, "Application status could not be updated.");
    return;
  }

  showToast(`Application ${status}`);
  if (business && business.owner_id) {
    const title =
      status === "approved"
        ? "Business application approved"
        : "Business application rejected";
    const message =
      status === "approved"
        ? `${safeText(
            business.name
          )} was approved. You can now use the Business Dashboard.`
        : `${safeText(
            business.name
          )} was rejected. ${rejectionReason.trim()}`;

    await createNotification(
      business.owner_id,
      `business_${status}`,
      title,
      message,
      "./profile.html"
    );
  }
  await loadAdminBusinessApplications();
}

function setupAdminForms() {
  const adminVenueForm =
    document.getElementById("adminVenueForm");
  const adminEventForm =
    document.getElementById("adminEventForm");
  const adminVenueClearBtn =
    document.getElementById("adminVenueClearBtn");
  const adminEventClearBtn =
    document.getElementById("adminEventClearBtn");

  if (adminVenueForm) {
    adminVenueForm.addEventListener(
      "submit",
      (event) =>
        runGuardedFormSubmit(event, saveAdminVenue)
    );
  }

  if (adminEventForm) {
    adminEventForm.addEventListener(
      "submit",
      (event) =>
        runGuardedFormSubmit(event, saveAdminEvent)
    );
  }

  if (adminVenueClearBtn) {
    adminVenueClearBtn.addEventListener(
      "click",
      clearAdminVenueForm
    );
  }

  if (adminEventClearBtn) {
    adminEventClearBtn.addEventListener(
      "click",
      clearAdminEventForm
    );
  }
}

async function initAdminPanel() {
  const adminPage = document.getElementById("adminPage");

  if (!adminPage) return;

  const session = await checkAdminAccess();

  if (!session) return;

  setupAdminForms();

  await Promise.all([
    loadAdminVenues(),
    loadAdminEvents(),
    loadAdminBusinessApplications(),
    loadAdminReservations(),
  ]);
}

function renderBusinessRecords(businesses) {
  const list = document.getElementById("businessRecordsList");

  if (!list) return;

  list.innerHTML = "";

  if (!businesses || businesses.length === 0) {
    renderEmptyState(
      list,
      "No business yet",
      "Your business records will appear here after approval."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  businesses.forEach((business) => {
    const item = document.createElement("div");
    item.className = "business-card";

    const title = document.createElement("h3");
    title.textContent = safeText(business.name);
    item.appendChild(title);

    item.appendChild(createStatusBadge(business.status));

    if (business.description) {
      const description = document.createElement("p");
      description.textContent = business.description;
      item.appendChild(description);
    }

    fragment.appendChild(item);
  });

  list.appendChild(fragment);
}

function getEmptyBusinessAnalytics() {
  return {
    totalVenues: 0,
    totalEvents: 0,
    totalReservations: 0,
    pendingReservations: 0,
    approvedReservations: 0,
    totalFavorites: 0,
    totalReviews: 0,
    averageRating: 0,
    totalAttendees: 0,
  };
}

function renderBusinessAnalytics(metrics) {
  const grid =
    document.getElementById("businessAnalyticsGrid");

  if (!grid) return;

  const analytics = {
    ...getEmptyBusinessAnalytics(),
    ...(metrics || {}),
  };

  grid.innerHTML = "";

  const cards = [
    ["Total Venues", analytics.totalVenues],
    ["Total Events", analytics.totalEvents],
    ["Total Reservations", analytics.totalReservations],
    ["Pending Reservations", analytics.pendingReservations],
    ["Approved Reservations", analytics.approvedReservations],
    ["Favorites", analytics.totalFavorites],
    ["Reviews", analytics.totalReviews],
    [
      "Average Rating",
      analytics.totalReviews
        ? analytics.averageRating.toFixed(1)
        : "No ratings",
    ],
    ["RSVP / Attendees", analytics.totalAttendees],
  ];

  const fragment = document.createDocumentFragment();

  cards.forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "business-analytics-card";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    card.appendChild(labelElement);

    const valueElement = document.createElement("strong");
    valueElement.textContent = value;
    card.appendChild(valueElement);

    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

function ensureBusinessAnalyticsSection() {
  if (document.getElementById("businessAnalyticsGrid")) {
    return;
  }

  const businessPage =
    document.getElementById("businessPage");

  if (!businessPage) return;

  const firstSection =
    businessPage.querySelector(".business-section");

  const section = document.createElement("section");
  section.className = "business-section";

  const heading = document.createElement("h2");
  heading.textContent = "Analytics";
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.id = "businessAnalyticsGrid";
  grid.className = "business-analytics-grid";
  section.appendChild(grid);

  businessPage.insertBefore(section, firstSection || null);
}

function getBusinessDashboardBusinessIds() {
  return businessDashboardState.businesses
    .filter(
      (business) => getBusinessStatus(business) === "approved"
    )
    .map((business) => String(business.id));
}

function getBusinessDashboardVenueIds() {
  return businessDashboardState.venues.map((venue) =>
    String(venue.id)
  );
}

function ownsBusinessRecord(businessId) {
  return getBusinessDashboardBusinessIds().includes(
    String(businessId)
  );
}

function ownsVenueRecord(venueId) {
  return getBusinessDashboardVenueIds().includes(String(venueId));
}

function getBusinessDashboardVenueName(venueId) {
  const venue = businessDashboardState.venues.find(
    (item) => String(item.id) === String(venueId)
  );

  return venue ? safeText(venue.name) : `Venue #${venueId}`;
}

function populateBusinessDashboardSelects() {
  const businessSelect =
    document.getElementById("businessVenueBusinessId");
  const venueSelect =
    document.getElementById("businessEventVenueId");
  const approvedBusinesses =
    businessDashboardState.businesses.filter(
      (business) => getBusinessStatus(business) === "approved"
    );

  if (businessSelect) {
    const selectedValue = businessSelect.value;
    businessSelect.innerHTML =
      '<option value="">Choose Business</option>';

    approvedBusinesses.forEach((business) => {
      const option = document.createElement("option");
      option.value = business.id;
      option.textContent = safeText(business.name);
      businessSelect.appendChild(option);
    });

    if (ownsBusinessRecord(selectedValue)) {
      businessSelect.value = selectedValue;
    }
  }

  if (venueSelect) {
    const selectedValue = venueSelect.value;
    venueSelect.innerHTML =
      '<option value="">Choose Venue</option>';

    businessDashboardState.venues.forEach((venue) => {
      const option = document.createElement("option");
      option.value = venue.id;
      option.textContent = safeText(venue.name);
      venueSelect.appendChild(option);
    });

    if (ownsVenueRecord(selectedValue)) {
      venueSelect.value = selectedValue;
    }
  }
}

function updateBusinessOwnerCrudVisibility() {
  const hasApprovedBusiness =
    getBusinessDashboardBusinessIds().length > 0;
  const venueForm =
    document.getElementById("businessVenueForm");
  const eventForm =
    document.getElementById("businessEventForm");

  if (venueForm) {
    venueForm.style.display = hasApprovedBusiness ? "" : "none";
  }

  if (eventForm) {
    eventForm.style.display = hasApprovedBusiness ? "" : "none";
  }
}

function clearBusinessVenueForm() {
  setAdminValue("businessVenueId", "");
  setAdminValue("businessVenueBusinessId", "");
  setAdminValue("businessVenueName", "");
  setAdminValue("businessVenueCity", "");
  setAdminValue(
    "businessVenueCategory",
    DEFAULT_VENUE_CATEGORY
  );
  setAdminValue("businessVenueImage", "");
  clearAdminFile("businessVenueImageFile");
  setAdminValue("businessVenueGalleryUrls", "");
  clearAdminFile("businessVenueGalleryFiles");
  setAdminValue("businessVenueAddress", "");
  setAdminValue("businessVenueLatitude", "");
  setAdminValue("businessVenueLongitude", "");
  setAdminValue("businessVenueDescription", "");
  resetBusinessVenueGalleryState();
}

function clearBusinessEventForm() {
  setAdminValue("businessEventId", "");
  setAdminValue("businessEventVenueId", "");
  setAdminValue("businessEventTitle", "");
  setAdminValue("businessEventDate", "");
  setAdminValue("businessEventImage", "");
  clearAdminFile("businessEventImageFile");
  setAdminValue("businessEventDescription", "");
}

function renderBusinessVenues(venues) {
  const list = document.getElementById("businessVenuesList");

  if (!list) return;

  list.innerHTML = "";

  if (!venues || venues.length === 0) {
    renderEmptyState(
      list,
      "No linked venues",
      "Venues linked to your businesses will appear here."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  venues.forEach((venue) => {
    const item = document.createElement("div");
    item.className = "admin-item";

    const content = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = safeText(venue.name);
    content.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "venue-meta";
    meta.textContent =
      `#${venue.id} ${getVenueMetaLabel(venue)}`;
    content.appendChild(meta);

    if (venue.description) {
      const description = document.createElement("p");
      description.textContent = venue.description;
      content.appendChild(description);
    }

    item.appendChild(content);
    item.appendChild(
      createAdminActions(
        () => {
          setAdminValue("businessVenueId", venue.id);
          setAdminValue(
            "businessVenueBusinessId",
            venue.business_id
          );
          setAdminValue("businessVenueName", venue.name);
          setAdminValue("businessVenueCity", venue.city);
          setAdminValue(
            "businessVenueCategory",
            getVenueCategoryValue(venue)
          );
          setAdminValue("businessVenueImage", venue.image);
          setAdminValue(
            "businessVenueAddress",
            venue.address
          );
          setAdminValue(
            "businessVenueLatitude",
            venue.latitude
          );
          setAdminValue(
            "businessVenueLongitude",
            venue.longitude
          );
          setAdminValue(
            "businessVenueDescription",
            venue.description
          );
          loadBusinessVenueGalleryState(venue.id);
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        () => deleteBusinessVenue(venue.id)
      )
    );

    fragment.appendChild(item);
  });

  list.appendChild(fragment);
}

function populateBusinessMenuVenueSelect() {
  const select = document.getElementById("businessMenuVenueSelect");

  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose Venue";
  select.appendChild(placeholder);

  businessDashboardState.venues.forEach((venue) => {
    const option = document.createElement("option");
    option.value = venue.id;
    option.textContent = safeText(venue.name);
    select.appendChild(option);
  });

  if (
    currentValue &&
    businessDashboardState.venues.some(
      (venue) => String(venue.id) === String(currentValue)
    )
  ) {
    select.value = currentValue;
  }
}

function getSelectedBusinessMenuVenueId() {
  const venueId = getAdminValue("businessMenuVenueSelect");

  if (!venueId || !ownsVenueRecord(venueId)) {
    return "";
  }

  return venueId;
}

function resetBusinessMenuForms() {
  setAdminValue("businessMenuCategoryName", "");
  setAdminValue("businessMenuCategorySort", "0");
  setAdminValue("businessMenuItemCategory", "");
  setAdminValue("businessMenuItemName", "");
  setAdminValue("businessMenuItemDescription", "");
  setAdminValue("businessMenuItemPrice", "");
  setAdminValue("businessMenuItemCurrency", "TRY");
  setAdminValue("businessMenuItemImage", "");
  clearAdminFile("businessMenuItemImageFile");
  setAdminValue("businessMenuItemSort", "0");

  const categoryActive =
    document.getElementById("businessMenuCategoryActive");
  const itemAvailable =
    document.getElementById("businessMenuItemAvailable");

  if (categoryActive) categoryActive.checked = true;
  if (itemAvailable) itemAvailable.checked = true;
}

async function loadVenueMenuForBusiness(venueId) {
  if (!venueId || !ownsVenueRecord(venueId)) {
    return { categories: [], items: [] };
  }

  try {
    const [categoriesResult, itemsResult] = await Promise.all([
      supabaseClient
        .from("venue_menu_categories")
        .select("*")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabaseClient
        .from("venue_menu_items")
        .select("*")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (categoriesResult.error || itemsResult.error) {
      showSafeError(
        categoriesResult.error || itemsResult.error,
        "Menu could not be loaded."
      );
      return { categories: [], items: [] };
    }

    return {
      categories: categoriesResult.data || [],
      items: itemsResult.data || [],
    };
  } catch (error) {
    showSafeError(error, "Menu could not be loaded.");
    return { categories: [], items: [] };
  }
}

function populateBusinessMenuCategorySelect(categories) {
  const select = document.getElementById("businessMenuItemCategory");

  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "No category";
  select.appendChild(placeholder);

  (categories || []).forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = safeText(category.name);
    select.appendChild(option);
  });

  if (
    currentValue &&
    (categories || []).some(
      (category) => String(category.id) === String(currentValue)
    )
  ) {
    select.value = currentValue;
  }
}

function createBusinessMenuRow(title, meta, onDelete) {
  const item = document.createElement("div");
  item.className = "business-menu-row";

  const content = document.createElement("div");

  const heading = document.createElement("h3");
  heading.textContent = safeText(title);
  content.appendChild(heading);

  if (meta) {
    const detail = document.createElement("p");
    detail.textContent = meta;
    content.appendChild(detail);
  }

  item.appendChild(content);

  if (onDelete) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-delete-btn";
    button.textContent = "Delete";
    button.addEventListener("click", onDelete);
    item.appendChild(button);
  }

  return item;
}

function renderBusinessVenueMenu(menuData) {
  const list = document.getElementById("businessVenueMenuList");

  if (!list) return;

  list.innerHTML = "";
  populateBusinessMenuCategorySelect(menuData.categories || []);

  if (
    (!menuData.categories || menuData.categories.length === 0) &&
    (!menuData.items || menuData.items.length === 0)
  ) {
    renderEmptyState(
      list,
      "No menu yet.",
      "Create categories and items for the selected venue."
    );
    return;
  }

  const categoriesGroup = document.createElement("section");
  categoriesGroup.className = "business-menu-group";

  const categoriesTitle = document.createElement("h3");
  categoriesTitle.textContent = "Categories";
  categoriesGroup.appendChild(categoriesTitle);

  (menuData.categories || []).forEach((category) => {
    categoriesGroup.appendChild(
      createBusinessMenuRow(
        category.name,
        `${category.is_active ? "Active" : "Hidden"} · Sort ${category.sort_order || 0}`,
        () => deleteMenuCategory(category.id)
      )
    );
  });

  list.appendChild(categoriesGroup);

  const itemsGroup = document.createElement("section");
  itemsGroup.className = "business-menu-group";

  const itemsTitle = document.createElement("h3");
  itemsTitle.textContent = "Items";
  itemsGroup.appendChild(itemsTitle);

  (menuData.items || []).forEach((item) => {
    const price = formatMenuPrice(item);
    const availability = item.is_available ? "Available" : "Hidden";
    itemsGroup.appendChild(
      createBusinessMenuRow(
        item.name,
        [price, availability, `Sort ${item.sort_order || 0}`]
          .filter(Boolean)
          .join(" · "),
        () => deleteMenuItem(item.id)
      )
    );
  });

  list.appendChild(itemsGroup);
}

async function refreshBusinessVenueMenu() {
  const venueId = getSelectedBusinessMenuVenueId();
  const list = document.getElementById("businessVenueMenuList");

  if (!list) return;

  if (!venueId) {
    populateBusinessMenuCategorySelect([]);
    renderEmptyState(
      list,
      "Choose a venue.",
      "Select an owned venue to manage its menu."
    );
    return;
  }

  renderBusinessVenueMenu(await loadVenueMenuForBusiness(venueId));
}

async function createMenuCategory(event) {
  event.preventDefault();

  const venueId = getSelectedBusinessMenuVenueId();

  if (!venueId) {
    showToast("Choose one of your venues");
    return;
  }

  const name = getAdminValue("businessMenuCategoryName");

  if (!name) {
    showToast("Category name required");
    return;
  }

  const activeInput =
    document.getElementById("businessMenuCategoryActive");

  const { error } = await supabaseClient
    .from("venue_menu_categories")
    .insert([{
      venue_id: venueId,
      name,
      sort_order: Number(getAdminValue("businessMenuCategorySort")) || 0,
      is_active: activeInput ? activeInput.checked : true,
    }]);

  if (error) {
    showSafeError(error, "Category could not be saved.");
    return;
  }

  setAdminValue("businessMenuCategoryName", "");
  setAdminValue("businessMenuCategorySort", "0");
  showToast("Category saved");
  await refreshBusinessVenueMenu();
}

async function createMenuItem(event) {
  event.preventDefault();

  const venueId = getSelectedBusinessMenuVenueId();

  if (!venueId) {
    showToast("Choose one of your venues");
    return;
  }

  const name = getAdminValue("businessMenuItemName");

  if (!name) {
    showToast("Item name required");
    return;
  }

  const priceValue = getAdminValue("businessMenuItemPrice");
  const categoryId = getAdminValue("businessMenuItemCategory");
  const availableInput =
    document.getElementById("businessMenuItemAvailable");
  const imageFile = getAdminFile("businessMenuItemImageFile");
  const uploadedImage = imageFile
    ? await uploadAdminImage(imageFile, "venues")
    : "";

  if (imageFile && !uploadedImage) return;

  const { error } = await supabaseClient
    .from("venue_menu_items")
    .insert([{
      venue_id: venueId,
      category_id: categoryId || null,
      name,
      description: getAdminValue("businessMenuItemDescription"),
      price: priceValue ? Number(priceValue) : null,
      currency: getAdminValue("businessMenuItemCurrency") || "TRY",
      image_url:
        uploadedImage || getAdminValue("businessMenuItemImage"),
      is_available: availableInput ? availableInput.checked : true,
      sort_order: Number(getAdminValue("businessMenuItemSort")) || 0,
    }]);

  if (error) {
    showSafeError(error, "Menu item could not be saved.");
    return;
  }

  setAdminValue("businessMenuItemName", "");
  setAdminValue("businessMenuItemDescription", "");
  setAdminValue("businessMenuItemPrice", "");
  setAdminValue("businessMenuItemImage", "");
  clearAdminFile("businessMenuItemImageFile");
  setAdminValue("businessMenuItemSort", "0");
  showToast("Menu item saved");
  await refreshBusinessVenueMenu();
}

async function deleteMenuCategory(categoryId) {
  if (!categoryId || !confirm("Delete this category?")) return;

  const { error } = await supabaseClient
    .from("venue_menu_categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    showSafeError(error, "Category could not be deleted.");
    return;
  }

  showToast("Category deleted");
  await refreshBusinessVenueMenu();
}

async function deleteMenuItem(itemId) {
  if (!itemId || !confirm("Delete this menu item?")) return;

  const { error } = await supabaseClient
    .from("venue_menu_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    showSafeError(error, "Menu item could not be deleted.");
    return;
  }

  showToast("Menu item deleted");
  await refreshBusinessVenueMenu();
}

function populateBusinessStoreVenueSelect() {
  const select = document.getElementById("businessStoreVenueSelect");

  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose Venue";
  select.appendChild(placeholder);

  businessDashboardState.venues.forEach((venue) => {
    const option = document.createElement("option");
    option.value = venue.id;
    option.textContent = safeText(venue.name);
    select.appendChild(option);
  });

  if (
    currentValue &&
    businessDashboardState.venues.some(
      (venue) => String(venue.id) === String(currentValue)
    )
  ) {
    select.value = currentValue;
  }
}

function getSelectedBusinessStoreVenueId() {
  const venueId = getAdminValue("businessStoreVenueSelect");

  if (!venueId || !ownsVenueRecord(venueId)) {
    return "";
  }

  return venueId;
}

const BUSINESS_PRODUCT_ACTIVE_FIELDS = [
  "is_active",
  "active",
  "status",
];
const BUSINESS_PRODUCT_STOCK_FIELDS = [
  "stock_quantity",
  "stock",
  "inventory",
  "quantity",
];
const BUSINESS_PRODUCT_GALLERY_FIELDS = [
  "product_images",
  "images",
  "gallery",
  "gallery_images",
  "image_urls",
];

let businessStoreProductState = {
  categories: [],
  products: [],
};

function hasBusinessProductField(product, field) {
  return Boolean(
    product &&
      Object.prototype.hasOwnProperty.call(product, field)
  );
}

function getBusinessProductActiveField(product) {
  return BUSINESS_PRODUCT_ACTIVE_FIELDS.find((field) =>
    hasBusinessProductField(product, field)
  );
}

function getBusinessProductStockField(product) {
  return BUSINESS_PRODUCT_STOCK_FIELDS.find((field) =>
    hasBusinessProductField(product, field)
  );
}

function getBusinessProductGalleryField(product) {
  return BUSINESS_PRODUCT_GALLERY_FIELDS.find((field) =>
    hasBusinessProductField(product, field)
  );
}

function getBusinessProductIsActive(product) {
  const field = getBusinessProductActiveField(product);

  if (!field) return true;

  if (field === "status") {
    const status = safeText(product.status).toLowerCase().trim();
    return !["inactive", "hidden", "disabled", "draft"].includes(
      status
    );
  }

  return product[field] !== false;
}

function getBusinessProductActivePatch(field, isActive) {
  if (!field) return null;

  return {
    [field]: field === "status"
      ? isActive
        ? "active"
        : "inactive"
      : Boolean(isActive),
  };
}

function getBusinessProductStockValue(product) {
  const field = getBusinessProductStockField(product);

  if (!field) return "";

  const value = product[field];

  return value === null || value === undefined ? "" : value;
}

function getBusinessProductById(productId) {
  return businessStoreProductState.products.find(
    (product) => String(product.id) === String(productId)
  );
}

function getBusinessProductDefaultActiveField() {
  const product = businessStoreProductState.products.find((item) =>
    getBusinessProductActiveField(item)
  );

  return getBusinessProductActiveField(product) || "is_active";
}

function getBusinessProductDefaultStockField() {
  const product = businessStoreProductState.products.find((item) =>
    getBusinessProductStockField(item)
  );

  return getBusinessProductStockField(product) || "stock_quantity";
}

function getProductCategoryName(product, categories) {
  const category = (categories || []).find(
    (item) => String(item.id) === String(product.category_id || "")
  );

  return category ? safeText(category.name) : "";
}

function isMissingProductFieldError(error, field) {
  const text = [
    error && error.message,
    error && error.details,
    error && error.hint,
    error && error.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return Boolean(
    field &&
      text.includes(String(field).toLowerCase()) &&
      (text.includes("column") ||
        text.includes("schema cache") ||
        text.includes("not found"))
  );
}

function getBusinessProductGalleryUrls(product) {
  const urls = [];

  function addUrl(value) {
    const url = safeText(value).trim();

    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  }

  function collect(value) {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed) return;

      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          collect(JSON.parse(trimmed));
          return;
        } catch (error) {
          // Keep treating it as a plain URL/string list.
        }
      }

      if (!trimmed.startsWith("data:") && /[\n,]/.test(trimmed)) {
        trimmed.split(/[\n,]/).forEach(addUrl);
        return;
      }

      addUrl(trimmed);
      return;
    }

    if (typeof value === "object") {
      [
        "image_url",
        "image",
        "url",
        "src",
        "publicUrl",
        "path",
      ].forEach((key) => collect(value[key]));
    }
  }

  BUSINESS_PRODUCT_GALLERY_FIELDS.forEach((field) => {
    collect(product && product[field]);
  });

  collect(product && product.extra_images);

  return urls;
}

function getBusinessProductGalleryInputUrls() {
  return getAdminValue("businessProductGalleryUrls")
    .split(/\r?\n|,/)
    .map((url) => safeText(url).trim())
    .filter(Boolean);
}

async function uploadBusinessProductGalleryFiles(productId) {
  const files = businessMediaState.productGallery.pendingFiles.map(
    (pending) => pending.file
  );

  if (!files.length) return [];

  const urls = [];

  for (const file of files) {
    const uploadedUrl = await uploadMediaImage(file, "products", {
      productId,
    });

    if (!uploadedUrl) {
      return [];
    }

    urls.push(uploadedUrl);
  }

  return urls;
}

async function getProductGalleryPhotoCount(productId) {
  if (!productId) return 0;

  try {
    const { count, error } = await supabaseClient
      .from("venue_product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

    return error ? 0 : count || 0;
  } catch (error) {
    return 0;
  }
}

async function persistBusinessProductGalleryChanges(
  productId,
  product
) {
  if (!productId) return { savedUrls: [], primaryImage: "" };

  const removedIds = [
    ...new Set(businessMediaState.productGallery.removedPhotoIds),
  ];
  const keptPhotos = businessMediaState.productGallery.photos.filter(
    (photo) => !removedIds.includes(String(photo.id))
  );
  const existingCount = await getProductGalleryPhotoCount(productId);
  const pendingCount =
    businessMediaState.productGallery.pendingFiles.length;
  const projectedCount =
    existingCount - removedIds.length + pendingCount;

  if (projectedCount > MAX_PRODUCT_GALLERY_IMAGES) {
    showToast(`En fazla ${MAX_PRODUCT_GALLERY_IMAGES} ürün fotoğrafı`);
    return { savedUrls: [], primaryImage: "" };
  }

  await deleteProductGalleryPhotoRows(removedIds);

  const uploadedUrls = await uploadBusinessProductGalleryFiles(
    productId
  );
  const urlRows = getBusinessProductGalleryInputUrls();
  const allNewUrls = getUniqueBusinessProductImageUrls([
    ...urlRows,
    ...uploadedUrls,
  ]);
  const gallerySaved = await saveBusinessProductGalleryImages(
    productId,
    allNewUrls,
    product
  );

  if (!gallerySaved && allNewUrls.length > 0) {
    showToast("Ek ürün fotoğrafları kaydedilemedi");
  }

  const primaryImage =
    keptPhotos[0] && keptPhotos[0].image_url
      ? keptPhotos[0].image_url
      : allNewUrls[0] ||
        safeText(product && product.image_url) ||
        "";

  if (primaryImage) {
    await syncProductPrimaryImage(productId, primaryImage);
  }

  resetBusinessProductGalleryState();
  await loadBusinessProductGalleryState(productId);

  return { savedUrls: allNewUrls, primaryImage };
}

function resetBusinessStoreForms() {
  setAdminValue("businessProductId", "");
  setAdminValue("businessProductCategoryName", "");
  setAdminValue("businessProductCategorySort", "0");
  setAdminValue("businessProductCategory", "");
  setAdminValue("businessProductName", "");
  setAdminValue("businessProductDescription", "");
  setAdminValue("businessProductPrice", "");
  setAdminValue("businessProductCurrency", "TRY");
  setAdminValue("businessProductImage", "");
  clearAdminFile("businessProductImageFile");
  setAdminValue("businessProductGalleryUrls", "");
  clearAdminFile("businessProductGalleryFiles");
  resetBusinessProductGalleryState();
  setAdminValue("businessProductStock", "");
  setAdminValue("businessProductSort", "0");

  const categoryActive =
    document.getElementById("businessProductCategoryActive");
  const productActive =
    document.getElementById("businessProductActive");
  const productForm =
    document.getElementById("businessProductForm");
  const productSaveButton =
    document.getElementById("businessProductSaveBtn");
  const productCancelButton =
    document.getElementById("businessProductCancelEditBtn");

  if (categoryActive) categoryActive.checked = true;
  if (productActive) productActive.checked = true;
  if (productForm) productForm.classList.remove("is-editing");
  if (productSaveButton) productSaveButton.textContent = "Save Product";
  if (productCancelButton) productCancelButton.hidden = true;
}

async function loadVenueProductsForBusiness(venueId) {
  if (!venueId || !ownsVenueRecord(venueId)) {
    return { categories: [], products: [] };
  }

  try {
    const [categoriesResult, productsResult] = await Promise.all([
      supabaseClient
        .from("venue_product_categories")
        .select("*")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabaseClient
        .from("venue_products")
        .select("*")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (categoriesResult.error || productsResult.error) {
      showSafeError(
        categoriesResult.error || productsResult.error,
        "Store could not be loaded."
      );
      return { categories: [], products: [] };
    }

    const products = await hydrateBusinessProductImages(
      (productsResult.data || []).filter(
        (product) => !product.deleted_at
      )
    );

    return {
      categories: categoriesResult.data || [],
      products,
    };
  } catch (error) {
    showSafeError(error, "Store could not be loaded.");
    return { categories: [], products: [] };
  }
}

async function hydrateBusinessProductImages(products) {
  if (!products || products.length === 0) return [];

  const productIds = products
    .map((product) => product.id)
    .filter(Boolean);

  if (productIds.length === 0) return products;

  try {
    const { data, error } = await supabaseClient
      .from("venue_product_images")
      .select("product_id, image_url, sort_order, created_at")
      .in("product_id", productIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return products;
    }

    const imagesByProductId = {};

    (data || []).forEach((image) => {
      const productId = String(image.product_id || "");

      if (!productId || !image.image_url) return;

      if (!imagesByProductId[productId]) {
        imagesByProductId[productId] = [];
      }

      imagesByProductId[productId].push(image.image_url);
    });

    return products.map((product) => ({
      ...product,
      extra_images: imagesByProductId[String(product.id)] || [],
    }));
  } catch (error) {
    return products;
  }
}

function populateBusinessProductCategorySelect(categories) {
  const select = document.getElementById("businessProductCategory");

  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "No category";
  select.appendChild(placeholder);

  (categories || []).forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = safeText(category.name);
    select.appendChild(option);
  });

  if (
    currentValue &&
    (categories || []).some(
      (category) => String(category.id) === String(currentValue)
    )
  ) {
    select.value = currentValue;
  }
}

function createBusinessProductImagePreview(product) {
  const imageWrap = document.createElement("div");
  imageWrap.className = "business-product-thumb";

  if (product && product.image_url) {
    const image = document.createElement("img");
    image.src = getImage(product.image_url);
    image.alt = safeText(product.name);
    image.loading = "lazy";
    image.addEventListener(
      "error",
      () => {
        imageWrap.classList.add("business-product-thumb--empty");
        image.remove();
      },
      { once: true }
    );
    imageWrap.appendChild(image);
  } else {
    imageWrap.classList.add("business-product-thumb--empty");
  }

  return imageWrap;
}

function renderBusinessProductGalleryCount(product) {
  const count = getBusinessProductGalleryUrls(product).length;

  return count > 0 ? `${count} extra image${count === 1 ? "" : "s"}` : "";
}

function createBusinessProductManagementRow(product, categories) {
  const row = document.createElement("article");
  row.className = "business-menu-row business-product-row";
  row.dataset.productId = product.id;

  const activeField = getBusinessProductActiveField(product);
  const stockField = getBusinessProductStockField(product);
  const isActive = getBusinessProductIsActive(product);
  const stockValue = getBusinessProductStockValue(product);
  const stockNumber = Number(stockValue);
  const isOutOfStock =
    stockField &&
    stockValue !== "" &&
    Number.isFinite(stockNumber) &&
    stockNumber <= 0;
  const price = formatMenuPrice(product);
  const categoryName = getProductCategoryName(product, categories);
  const galleryCount = renderBusinessProductGalleryCount(product);

  row.appendChild(createBusinessProductImagePreview(product));

  const content = document.createElement("div");
  content.className = "business-product-row-content";

  const heading = document.createElement("h3");
  heading.textContent = safeText(product.name);
  content.appendChild(heading);

  const meta = document.createElement("p");
  meta.textContent = [
    price,
    categoryName,
    stockField && stockValue !== "" ? `${stockValue} stock` : "",
    activeField ? (isActive ? "Active" : "Hidden") : "",
    galleryCount,
    `Sort ${product.sort_order || 0}`,
  ]
    .filter(Boolean)
    .join(" / ");
  content.appendChild(meta);

  if (isOutOfStock) {
    const stockBadge = document.createElement("span");
    stockBadge.className =
      "business-product-stock-badge business-product-stock-badge--out";
    stockBadge.textContent = "Stokta yok";
    content.appendChild(stockBadge);
  }

  if (product.description) {
    const description = document.createElement("p");
    description.className = "business-product-row-desc";
    description.textContent = safeText(product.description);
    content.appendChild(description);
  }

  row.appendChild(content);

  const controls = document.createElement("div");
  controls.className = "business-product-controls";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "secondary-btn business-product-action-btn";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", () => {
    editBusinessVenueProduct(product.id);
  });
  controls.appendChild(editButton);

  if (activeField) {
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className =
      "secondary-btn business-product-action-btn";
    toggleButton.textContent = isActive ? "Make Passive" : "Make Active";
    toggleButton.addEventListener("click", () => {
      toggleBusinessVenueProductActive(product.id);
    });
    controls.appendChild(toggleButton);
  }

  if (stockField) {
    const stockControls = document.createElement("div");
    stockControls.className = "business-product-stock-controls";

    const decreaseButton = document.createElement("button");
    decreaseButton.type = "button";
    decreaseButton.className = "business-product-step-btn";
    decreaseButton.textContent = "-";

    const stockInput = document.createElement("input");
    stockInput.type = "number";
    stockInput.className = "business-product-stock-input";
    stockInput.value = stockValue === "" ? "" : String(stockValue);
    stockInput.setAttribute("aria-label", "Stock quantity");

    const increaseButton = document.createElement("button");
    increaseButton.type = "button";
    increaseButton.className = "business-product-step-btn";
    increaseButton.textContent = "+";

    const saveStockButton = document.createElement("button");
    saveStockButton.type = "button";
    saveStockButton.className =
      "secondary-btn business-product-action-btn";
    saveStockButton.textContent = "Save Stock";

    decreaseButton.addEventListener("click", () => {
      const nextValue = Math.max(
        0,
        (Number(stockInput.value) || 0) - 1
      );
      stockInput.value = String(nextValue);
    });

    increaseButton.addEventListener("click", () => {
      stockInput.value = String((Number(stockInput.value) || 0) + 1);
    });

    saveStockButton.addEventListener("click", () => {
      updateBusinessVenueProductStock(product.id, stockInput.value);
    });

    stockControls.appendChild(decreaseButton);
    stockControls.appendChild(stockInput);
    stockControls.appendChild(increaseButton);
    stockControls.appendChild(saveStockButton);
    controls.appendChild(stockControls);
  }

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "admin-delete-btn";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => {
    deleteVenueProduct(product.id);
  });
  controls.appendChild(deleteButton);

  row.appendChild(controls);
  return row;
}

function editBusinessVenueProduct(productId) {
  const product = getBusinessProductById(productId);

  if (!product) {
    showToast("Product unavailable");
    return;
  }

  setAdminValue("businessProductId", product.id);
  setAdminValue("businessProductCategory", product.category_id || "");
  setAdminValue("businessProductName", product.name || "");
  setAdminValue("businessProductDescription", product.description || "");
  setAdminValue(
    "businessProductPrice",
    product.price === null || product.price === undefined
      ? ""
      : product.price
  );
  setAdminValue("businessProductCurrency", product.currency || "TRY");
  setAdminValue("businessProductImage", product.image_url || "");
  clearAdminFile("businessProductImageFile");
  setAdminValue(
    "businessProductGalleryUrls",
    getBusinessProductGalleryUrls(product).join("\n")
  );
  clearAdminFile("businessProductGalleryFiles");
  loadBusinessProductGalleryState(product.id);
  setAdminValue("businessProductStock", getBusinessProductStockValue(product));
  setAdminValue("businessProductSort", product.sort_order || "0");

  const activeInput =
    document.getElementById("businessProductActive");
  const form = document.getElementById("businessProductForm");
  const saveButton = document.getElementById("businessProductSaveBtn");
  const cancelButton =
    document.getElementById("businessProductCancelEditBtn");

  if (activeInput) activeInput.checked = getBusinessProductIsActive(product);
  if (form) {
    form.classList.add("is-editing");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (saveButton) saveButton.textContent = "Update Product";
  if (cancelButton) cancelButton.hidden = false;

  const nameInput = document.getElementById("businessProductName");
  if (nameInput) nameInput.focus();
}

function renderBusinessVenueProducts(productData) {
  const list = document.getElementById("businessVenueProductsList");

  if (!list) return;

  list.innerHTML = "";
  populateBusinessProductCategorySelect(productData.categories || []);

  if (
    (!productData.categories || productData.categories.length === 0) &&
    (!productData.products || productData.products.length === 0)
  ) {
    renderEmptyState(
      list,
      "No products yet.",
      "Create product categories and showcase products for the selected venue."
    );
    return;
  }

  const categoriesGroup = document.createElement("section");
  categoriesGroup.className = "business-menu-group business-store-group";

  const categoriesTitle = document.createElement("h3");
  categoriesTitle.textContent = "Product Categories";
  categoriesGroup.appendChild(categoriesTitle);

  (productData.categories || []).forEach((category) => {
    categoriesGroup.appendChild(
      createBusinessMenuRow(
        category.name,
        `${category.is_active ? "Active" : "Hidden"} · Sort ${category.sort_order || 0}`,
        () => deleteProductCategory(category.id)
      )
    );
  });

  list.appendChild(categoriesGroup);

  const productsGroup = document.createElement("section");
  productsGroup.className = "business-menu-group business-store-group";

  const productsTitle = document.createElement("h3");
  productsTitle.textContent = "Products";
  productsGroup.appendChild(productsTitle);

  (productData.products || []).forEach((product) => {
    productsGroup.appendChild(
      createBusinessProductManagementRow(
        product,
        productData.categories || []
      )
    );
  });

  list.appendChild(productsGroup);
}

async function refreshBusinessVenueProducts() {
  const venueId = getSelectedBusinessStoreVenueId();
  const list = document.getElementById("businessVenueProductsList");

  if (!list) return;

  if (!venueId) {
    populateBusinessProductCategorySelect([]);
    renderEmptyState(
      list,
      "Choose a venue.",
      "Select an owned venue to manage its store catalog."
    );
    return;
  }

  renderBusinessVenueProducts(
    await loadVenueProductsForBusiness(venueId)
  );

  window.dispatchEvent(
    new CustomEvent("business-store-products-refreshed", {
      detail: { venueId },
    })
  );
}

async function createProductCategory(event) {
  event.preventDefault();

  const venueId = getSelectedBusinessStoreVenueId();

  if (!venueId) {
    showToast("Choose one of your venues");
    return;
  }

  const name = getAdminValue("businessProductCategoryName");

  if (!name) {
    showToast("Category name required");
    return;
  }

  const activeInput =
    document.getElementById("businessProductCategoryActive");

  const { error } = await supabaseClient
    .from("venue_product_categories")
    .insert([{
      venue_id: venueId,
      name,
      sort_order: Number(getAdminValue("businessProductCategorySort")) || 0,
      is_active: activeInput ? activeInput.checked : true,
    }]);

  if (error) {
    showSafeError(error, "Product category could not be saved.");
    return;
  }

  setAdminValue("businessProductCategoryName", "");
  setAdminValue("businessProductCategorySort", "0");
  showToast("Product category saved");
  await refreshBusinessVenueProducts();
}

function getBusinessProductPayload({
  venueId,
  product = null,
  uploadedImage = "",
}) {
  const activeInput =
    document.getElementById("businessProductActive");
  const stockValue = getAdminValue("businessProductStock");
  const categoryId = getAdminValue("businessProductCategory");
  const activeField =
    getBusinessProductActiveField(product) ||
    getBusinessProductDefaultActiveField();
  const stockField =
    getBusinessProductStockField(product) ||
    getBusinessProductDefaultStockField();
  const payload = {
    venue_id: venueId,
    category_id: categoryId || null,
    name: getAdminValue("businessProductName"),
    description: getAdminValue("businessProductDescription"),
    price: getAdminValue("businessProductPrice")
      ? Number(getAdminValue("businessProductPrice"))
      : null,
    currency: getAdminValue("businessProductCurrency") || "TRY",
    image_url: uploadedImage || getAdminValue("businessProductImage"),
    sort_order: Number(getAdminValue("businessProductSort")) || 0,
  };

  const activePatch = getBusinessProductActivePatch(
    activeField,
    activeInput ? activeInput.checked : true
  );

  if (activePatch) {
    Object.assign(payload, activePatch);
  }

  if (stockField) {
    payload[stockField] = stockValue ? Number(stockValue) : null;
  }

  return payload;
}

function getMissingPayloadField(error, payload) {
  return Object.keys(payload).find((field) =>
    isMissingProductFieldError(error, field)
  );
}

async function insertBusinessProductWithFallback(payload) {
  const workingPayload = { ...payload };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await supabaseClient
      .from("venue_products")
      .insert([workingPayload])
      .select("id")
      .maybeSingle();

    if (!result.error) return result;

    const missingField = getMissingPayloadField(
      result.error,
      workingPayload
    );

    if (!missingField) return result;

    delete workingPayload[missingField];
  }

  return {
    data: null,
    error: { message: "Product payload fields are unavailable." },
  };
}

async function updateBusinessProductWithFallback(productId, payload) {
  const workingPayload = { ...payload };

  delete workingPayload.venue_id;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await supabaseClient
      .from("venue_products")
      .update(workingPayload)
      .eq("id", productId);

    if (!result.error) return result;

    const missingField = getMissingPayloadField(
      result.error,
      workingPayload
    );

    if (!missingField) return result;

    delete workingPayload[missingField];
  }

  return {
    error: { message: "Product payload fields are unavailable." },
  };
}

function getUniqueBusinessProductImageUrls(urls) {
  const uniqueUrls = [];

  (urls || []).forEach((url) => {
    const value = safeText(url).trim();

    if (value && !uniqueUrls.includes(value)) {
      uniqueUrls.push(value);
    }
  });

  return uniqueUrls;
}

async function appendBusinessProductImageRows(
  productId,
  imageUrls,
  existingUrls = []
) {
  try {
    const currentCount = await getProductGalleryPhotoCount(productId);
    const urlsToInsert = imageUrls.filter(
      (imageUrl) => !existingUrls.includes(imageUrl)
    );

    if (!urlsToInsert.length) return true;

    const allowedCount = Math.max(
      0,
      MAX_PRODUCT_GALLERY_IMAGES - currentCount
    );
    const limitedUrls = urlsToInsert.slice(0, allowedCount);

    if (limitedUrls.length === 0) {
      showToast(`En fazla ${MAX_PRODUCT_GALLERY_IMAGES} ürün fotoğrafı`);
      return false;
    }

    const rows = limitedUrls.map((imageUrl, index) => ({
      product_id: productId,
      image_url: imageUrl,
      sort_order: currentCount + index,
    }));

    const insertResult = await supabaseClient
      .from("venue_product_images")
      .insert(rows);

    return !insertResult.error;
  } catch (error) {
    return false;
  }
}

async function saveBusinessProductInlineGallery(
  productId,
  imageUrls,
  product
) {
  const preferredField = getBusinessProductGalleryField(product);
  const fields = preferredField
    ? [
        preferredField,
        ...BUSINESS_PRODUCT_GALLERY_FIELDS.filter(
          (field) => field !== preferredField
        ),
      ]
    : BUSINESS_PRODUCT_GALLERY_FIELDS;

  for (const field of fields) {
    const arrayResult = await supabaseClient
      .from("venue_products")
      .update({ [field]: imageUrls })
      .eq("id", productId);

    if (!arrayResult.error) return true;

    if (!isMissingProductFieldError(arrayResult.error, field)) {
      const textResult = await supabaseClient
        .from("venue_products")
        .update({ [field]: imageUrls.join("\n") })
        .eq("id", productId);

      if (!textResult.error) return true;
    }
  }

  return false;
}

async function saveBusinessProductGalleryImages(
  productId,
  imageUrls,
  product
) {
  if (!productId) return true;

  const uniqueUrls = getUniqueBusinessProductImageUrls(imageUrls);
  const existingUrls = getBusinessProductGalleryUrls(product);

  if (
    uniqueUrls.length === 0 &&
    existingUrls.length === 0
  ) {
    return true;
  }

  const savedToImageTable = await appendBusinessProductImageRows(
    productId,
    uniqueUrls,
    existingUrls
  );

  if (savedToImageTable) return true;

  return saveBusinessProductInlineGallery(
    productId,
    uniqueUrls,
    product
  );
}

async function createVenueProduct(event) {
  event.preventDefault();

  const venueId = getSelectedBusinessStoreVenueId();

  if (!venueId) {
    showToast("Choose one of your venues");
    return;
  }

  const name = getAdminValue("businessProductName");

  if (!name) {
    showToast("Product name required");
    return;
  }

  const productId = getAdminValue("businessProductId");
  const existingProduct = productId
    ? getBusinessProductById(productId)
    : null;
  const imageFile = getAdminFile("businessProductImageFile");
  const manualImage = getAdminValue("businessProductImage");
  const galleryUrlInput = getBusinessProductGalleryInputUrls();
  const hasGalleryChanges =
    businessMediaState.productGallery.pendingFiles.length > 0 ||
    businessMediaState.productGallery.removedPhotoIds.length > 0 ||
    galleryUrlInput.length > 0;

  const payload = getBusinessProductPayload({
    venueId,
    product: existingProduct,
    uploadedImage: manualImage,
  });

  if (productId) {
    const updateResult = await updateBusinessProductWithFallback(
      productId,
      payload
    );

    if (updateResult.error) {
      showToast("Product could not be updated.");
      return;
    }

    if (imageFile) {
      const uploadedImage = await uploadMediaImage(
        imageFile,
        "products",
        { productId }
      );

      if (!uploadedImage) return;

      payload.image_url = uploadedImage;
      await syncProductPrimaryImage(productId, uploadedImage);
    }

    if (hasGalleryChanges) {
      const galleryResult = await persistBusinessProductGalleryChanges(
        productId,
        existingProduct
      );

      if (!payload.image_url && galleryResult.primaryImage) {
        await syncProductPrimaryImage(
          productId,
          galleryResult.primaryImage
        );
      }
    }

    showToast("Product updated");
    resetBusinessStoreForms();
    await refreshBusinessVenueProducts();
    return;
  }

  const { data, error } = await insertBusinessProductWithFallback(
    payload
  );

  if (error) {
    showToast("Product could not be saved.");
    return;
  }

  const savedProductId = data && data.id;

  if (imageFile && savedProductId) {
    const uploadedImage = await uploadMediaImage(
      imageFile,
      "products",
      { productId: savedProductId }
    );

    if (!uploadedImage) return;

    await syncProductPrimaryImage(savedProductId, uploadedImage);
  }

  if (hasGalleryChanges && savedProductId) {
    const galleryResult = await persistBusinessProductGalleryChanges(
      savedProductId,
      data
    );

    if (!imageFile && galleryResult.primaryImage) {
      await syncProductPrimaryImage(
        savedProductId,
        galleryResult.primaryImage
      );
    }
  }

  resetBusinessStoreForms();
  showToast("Product saved");
  await refreshBusinessVenueProducts();
}

async function deleteProductCategory(categoryId) {
  if (!categoryId || !confirm("Delete this product category?")) return;

  const { error } = await supabaseClient
    .from("venue_product_categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    showSafeError(error, "Product category could not be deleted.");
    return;
  }

  showToast("Product category deleted");
  await refreshBusinessVenueProducts();
}

async function toggleBusinessVenueProductActive(productId) {
  const product = getBusinessProductById(productId);
  const activeField = getBusinessProductActiveField(product);

  if (!product || !activeField) {
    showToast("Active/passive field is not available.");
    return;
  }

  const patch = getBusinessProductActivePatch(
    activeField,
    !getBusinessProductIsActive(product)
  );

  const { error } = await supabaseClient
    .from("venue_products")
    .update(patch)
    .eq("id", productId);

  if (error) {
    showToast("Product status could not be updated.");
    return;
  }

  showToast("Product status updated");
  await refreshBusinessVenueProducts();
}

async function updateBusinessVenueProductStock(productId, value) {
  const product = getBusinessProductById(productId);
  const stockField = getBusinessProductStockField(product);

  if (!product || !stockField) {
    showToast("Stock field is not available.");
    return;
  }

  const nextValue =
    value === "" || value === null || value === undefined
      ? null
      : Number(value);

  if (nextValue !== null && Number.isNaN(nextValue)) {
    showToast("Enter a valid stock amount.");
    return;
  }

  const { error } = await supabaseClient
    .from("venue_products")
    .update({ [stockField]: nextValue })
    .eq("id", productId);

  if (error) {
    showToast("Stock could not be updated.");
    return;
  }

  showToast("Stock updated");
  await refreshBusinessVenueProducts();
}

async function deleteVenueProduct(productId) {
  if (!productId || !confirm("Delete this product?")) return;

  const product = getBusinessProductById(productId);

  if (hasBusinessProductField(product, "deleted_at")) {
    const softDeleteResult = await supabaseClient
      .from("venue_products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", productId);

    if (!softDeleteResult.error) {
      showToast("Product deleted");
      await refreshBusinessVenueProducts();
      return;
    }
  }

  const { error } = await supabaseClient
    .from("venue_products")
    .delete()
    .eq("id", productId);

  if (error) {
    showToast("Product could not be deleted.");
    return;
  }

  showToast("Product deleted");
  await refreshBusinessVenueProducts();
}

function renderBusinessEvents(events) {
  const list = document.getElementById("businessEventsList");

  if (!list) return;

  list.innerHTML = "";

  if (!events || events.length === 0) {
    renderEmptyState(
      list,
      "No events yet",
      "Create events for your venues to get started."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  events.forEach((eventItem) => {
    const item = document.createElement("div");
    item.className = "admin-item";

    const content = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = safeText(eventItem.title);
    content.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "venue-meta";
    meta.textContent =
      `#${eventItem.id} ${getBusinessDashboardVenueName(
        eventItem.venue_id
      )} ${safeText(eventItem.event_date)}`;
    content.appendChild(meta);

    if (eventItem.description) {
      const description = document.createElement("p");
      description.textContent = eventItem.description;
      content.appendChild(description);
    }

    item.appendChild(content);
    item.appendChild(
      createAdminActions(
        () => {
          setAdminValue("businessEventId", eventItem.id);
          setAdminValue(
            "businessEventVenueId",
            eventItem.venue_id
          );
          setAdminValue("businessEventTitle", eventItem.title);
          setAdminValue(
            "businessEventDate",
            eventItem.event_date
          );
          setAdminValue("businessEventImage", eventItem.image);
          setAdminValue(
            "businessEventDescription",
            eventItem.description
          );
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        () => deleteBusinessEvent(eventItem.id)
      )
    );

    fragment.appendChild(item);
  });

  list.appendChild(fragment);
}

function renderBusinessReservations(reservations) {
  const list =
    document.getElementById("businessReservationsList");

  if (!list) return;

  list.innerHTML = "";

  if (!reservations || reservations.length === 0) {
    renderEmptyState(
      list,
      "No reservations yet",
      "Reservations for your venues will appear here."
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  const statuses = [
    ["all", "All"],
    ["pending", "Pending"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["cancelled", "Cancelled"],
  ];
  const dateFilters = [
    ["all", "All Dates"],
    ["today", "Today"],
    ["upcoming", "Upcoming"],
  ];
  const activeStatus =
    window.businessReservationStatusFilter || "all";
  const activeDateFilter =
    window.businessReservationDateFilter || "all";
  const dateFilteredReservations = reservations.filter(
    (reservation) =>
      doesReservationMatchBusinessDateFilter(
        reservation,
        activeDateFilter
      )
  );
  const counts = dateFilteredReservations.reduce((items, reservation) => {
    const status = getReservationStatusValue(
      reservation.status
    );
    items.all += 1;
    items[status] = (items[status] || 0) + 1;
    return items;
  }, {
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  });

  const filters = document.createElement("div");
  filters.className = "reservation-status-filters";

  dateFilters.forEach(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      value === activeDateFilter
        ? "reservation-status-filter active-filter"
        : "reservation-status-filter";
    button.textContent = label;
    button.addEventListener("click", () => {
      window.businessReservationDateFilter = value;
      renderBusinessReservations(
        businessDashboardState.reservations
      );
    });
    filters.appendChild(button);
  });

  statuses.forEach(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      value === activeStatus
        ? "reservation-status-filter active-filter"
        : "reservation-status-filter";
    button.textContent = `${label} ${counts[value] || 0}`;
    button.addEventListener("click", () => {
      window.businessReservationStatusFilter = value;
      renderBusinessReservations(
        businessDashboardState.reservations
      );
    });
    filters.appendChild(button);
  });

  list.appendChild(filters);

  const visibleReservations =
    activeStatus === "all"
      ? dateFilteredReservations
      : dateFilteredReservations.filter(
          (reservation) =>
            getReservationStatusValue(reservation.status) ===
            activeStatus
        );

  if (visibleReservations.length === 0) {
    renderEmptyState(
      list,
      `No ${getReservationStatusLabel(activeStatus)} reservations`,
      "New booking activity will appear here when it matches this status."
    );
    list.prepend(filters);
    return;
  }

  const groupedStatuses =
    activeStatus === "all"
      ? statuses.filter(([value]) => value !== "all")
      : statuses.filter(([value]) => value === activeStatus);

  groupedStatuses.forEach(([statusValue, statusLabel]) => {
    const groupReservations = visibleReservations
      .filter(
        (reservation) =>
          getReservationStatusValue(reservation.status) ===
          statusValue
      )
      .sort(compareBusinessReservationsByDateTime);

    if (activeStatus === "all" && groupReservations.length === 0) {
      return;
    }

    const group = document.createElement("section");
    group.className =
      `reservation-inbox-group ${getReservationStatusClass(
        statusValue
      )}`;

    const groupHeader = document.createElement("div");
    groupHeader.className = "reservation-inbox-group-header";

    const heading = document.createElement("h3");
    heading.textContent = statusLabel;
    groupHeader.appendChild(heading);

    const count = document.createElement("span");
    count.textContent = `${groupReservations.length}`;
    groupHeader.appendChild(count);

    group.appendChild(groupHeader);

    const groupList = document.createElement("div");
    groupList.className = "reservation-inbox-list";

    groupReservations.forEach((reservation) => {
      groupList.appendChild(
        createBusinessReservationCard(reservation)
      );
    });

    group.appendChild(groupList);
    fragment.appendChild(group);
  });

  list.appendChild(fragment);
}

function getWeekDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });
}

function normalizeReservationDate(value) {
  if (!value) return "";

  const date =
    value instanceof Date
      ? new Date(value)
      : new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayReservationDateKey() {
  return normalizeReservationDate(new Date());
}

function doesReservationMatchBusinessDateFilter(
  reservation,
  filterValue
) {
  if (!filterValue || filterValue === "all") return true;

  const date = normalizeReservationDate(
    getScheduleReservationDate(reservation)
  );

  if (!date) return false;

  const today = getTodayReservationDateKey();

  if (filterValue === "today") {
    return date === today;
  }

  if (filterValue === "upcoming") {
    return date >= today;
  }

  return true;
}

function compareBusinessReservationsByDateTime(a, b) {
  const aDate = normalizeReservationDate(
    getScheduleReservationDate(a)
  );
  const bDate = normalizeReservationDate(
    getScheduleReservationDate(b)
  );
  const aTime = normalizeReservationTime(
    getScheduleReservationTime(a)
  );
  const bTime = normalizeReservationTime(
    getScheduleReservationTime(b)
  );
  const aKey = `${aDate || "9999-12-31"}T${aTime || "99:99"}`;
  const bKey = `${bDate || "9999-12-31"}T${bTime || "99:99"}`;

  if (aKey === bKey) {
    return String(b.created_at || "").localeCompare(
      String(a.created_at || "")
    );
  }

  return aKey.localeCompare(bKey);
}

function normalizeReservationTime(value) {
  const time = safeText(value).trim();

  if (!time) return "";

  const match = time.match(/^(\d{1,2}):?(\d{2})?/);

  if (!match) return time;

  const hour = Math.min(Math.max(Number(match[1]), 0), 23);
  const minute = match[2] ? Number(match[2]) : 0;

  return `${String(hour).padStart(2, "0")}:${String(
    Number.isNaN(minute) ? 0 : minute
  ).padStart(2, "0")}`;
}

function getReservationTimeLabel(time) {
  if (!time) return "Time not set";

  const [hourValue, minuteValue = "00"] = time.split(":");
  const hour = Number(hourValue);

  if (Number.isNaN(hour)) return time;

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minuteValue} ${period}`;
}

function isVisibleScheduleReservation(reservation) {
  const normalizedStatus = String(
    reservation.status || ""
  ).trim().toLowerCase();

  return [
    "pending",
    "approved",
    "approve",
    "accepted",
    "confirmed",
    "onaylandı",
    "onaylandı",
    "onaylandi",
  ].includes(normalizedStatus);
}

function getScheduleReservationDate(reservation) {
  return (
    reservation.reservation_date ||
    reservation.date ||
    reservation.booking_date
  );
}

function getScheduleReservationTime(reservation) {
  return (
    reservation.reservation_time ||
    reservation.time ||
    reservation.booking_time
  );
}

function getScheduleTimeSlots() {
  return [
    ...Array.from({ length: 14 }, (_, index) => index + 10),
    0,
    1,
    2,
    3,
  ].map((hour) => `${String(hour).padStart(2, "0")}:00`);
}

function getScheduleHourSlot(time) {
  const normalizedTime = normalizeReservationTime(time);

  if (!normalizedTime) return "";

  const [hourValue] = normalizedTime.split(":");
  const hour = Number(hourValue);

  if (Number.isNaN(hour)) return "";

  return `${String(hour).padStart(2, "0")}:00`;
}

function getRelatedReservationRecord(record, key) {
  const value = record && record[key];

  if (Array.isArray(value)) {
    return value.length ? value[0] : null;
  }

  return value || null;
}

function getScheduleCustomerName(reservation) {
  const profiles = getRelatedReservationRecord(
    reservation,
    "profiles"
  );
  const profile = getRelatedReservationRecord(
    reservation,
    "profile"
  );

  return (
    safeText(reservation.user_name) ||
    safeText(reservation.customer_name) ||
    safeText(reservation.guest_name) ||
    safeText(profiles && profiles.full_name) ||
    safeText(profile && profile.full_name) ||
    safeText(reservation["profiles.full_name"]) ||
    safeText(reservation["profile.full_name"]) ||
    safeText(reservation.user_email) ||
    safeText(reservation.email) ||
    "Guest"
  );
}

function getScheduleVenueName(reservation) {
  const venues = getRelatedReservationRecord(
    reservation,
    "venues"
  );
  const venue = getRelatedReservationRecord(
    reservation,
    "venue"
  );

  return (
    safeText(reservation.venue_name) ||
    safeText(venues && venues.name) ||
    safeText(venue && venue.name) ||
    safeText(reservation["venues.name"]) ||
    safeText(reservation["venue.name"]) ||
    safeText(reservation.business_name) ||
    safeText(getBusinessDashboardVenueName(reservation.venue_id)) ||
    "Venue"
  );
}

function buildBusinessReservationSchedule(reservations) {
  const weekDates = getWeekDates();
  const weekKeys = weekDates.map((date) =>
    normalizeReservationDate(date)
  );
  const slots = getScheduleTimeSlots();
  const scheduleReservations = (reservations || []).filter(
    isVisibleScheduleReservation
  );
  const entriesByDateTime = {};

  scheduleReservations.forEach((reservation) => {
    const date = normalizeReservationDate(
      getScheduleReservationDate(reservation)
    );
    const time = getScheduleHourSlot(
      getScheduleReservationTime(reservation)
    );

    if (
      !date ||
      !time ||
      !weekKeys.includes(date) ||
      !slots.includes(time)
    ) {
      return;
    }

    const key = `${date}|${time}`;
    entriesByDateTime[key] = entriesByDateTime[key] || [];
    entriesByDateTime[key].push({
      date,
      time,
      customerName: getScheduleCustomerName(reservation),
      venueName: getScheduleVenueName(reservation),
      partySize: Number(reservation.party_size) || 0,
      status: getReservationStatusValue(reservation.status),
      displayTime: normalizeReservationTime(
        getScheduleReservationTime(reservation)
      ),
    });
  });

  return {
    weekDates,
    weekKeys,
    slots,
    entriesByDateTime,
  };
}

function createReservationScheduleBadge(status) {
  return createStatusBadge(status || "approved");
}

function createReservationScheduleBooking(entries) {
  const item = document.createElement("div");
  const hasPending = entries.some(
    (entry) => entry.status === "pending"
  );
  item.className = hasPending
    ? "reservation-schedule-item status-pending"
    : "reservation-schedule-item";

  if (entries.length === 1) {
    const booking = entries[0];
    const name = document.createElement("strong");
    name.textContent = booking.customerName;
    item.appendChild(name);

    const venue = document.createElement("span");
    venue.textContent = booking.venueName;
    item.appendChild(venue);

    const time = document.createElement("span");
    time.textContent = getReservationTimeLabel(booking.displayTime);
    item.appendChild(time);

    const party = document.createElement("span");
    party.textContent = `${booking.partySize || 0} guests`;
    item.appendChild(party);

    item.appendChild(createReservationScheduleBadge(booking.status));
    return item;
  }

  const totalGuests = entries.reduce(
    (sum, entry) => sum + (Number(entry.partySize) || 0),
    0
  );
  const pendingCount = entries.filter(
    (entry) => entry.status === "pending"
  ).length;
  const heading = document.createElement("strong");
  heading.textContent = pendingCount
    ? `${entries.length} bookings - ${pendingCount} pending`
    : `${entries.length} bookings`;
  item.appendChild(heading);

  const guests = document.createElement("span");
  guests.textContent = `${totalGuests} guests`;
  item.appendChild(guests);

  const names = document.createElement("span");
  names.textContent = entries
    .map((entry) => entry.customerName)
    .filter(Boolean)
    .join(", ");
  item.appendChild(names);

  const venues = document.createElement("span");
  venues.textContent = [
    ...new Set(entries.map((entry) => entry.venueName)),
  ].join(", ");
  item.appendChild(venues);

  item.appendChild(
    createReservationScheduleBadge(
      pendingCount ? "pending" : "approved"
    )
  );
  return item;
}

function renderBusinessReservationSchedule(reservations) {
  const container =
    document.getElementById("businessReservationSchedule");

  if (!container) return;

  container.innerHTML = "";

  const schedule =
    buildBusinessReservationSchedule(reservations || []);

  const table = document.createElement("div");
  table.className = "reservation-schedule-table";
  table.style.setProperty(
    "--schedule-columns",
    `${schedule.weekDates.length + 1}`
  );

  const emptyCorner = document.createElement("div");
  emptyCorner.className =
    "reservation-schedule-cell reservation-schedule-head";
  emptyCorner.textContent = "Time";
  table.appendChild(emptyCorner);

  schedule.weekDates.forEach((date) => {
    const header = document.createElement("div");
    header.className =
      "reservation-schedule-cell reservation-schedule-head";
    header.textContent = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    table.appendChild(header);
  });

  schedule.slots.forEach((slot) => {
    const timeCell = document.createElement("div");
    timeCell.className =
      "reservation-schedule-cell reservation-schedule-time";
    timeCell.textContent = getReservationTimeLabel(slot);
    table.appendChild(timeCell);

    schedule.weekKeys.forEach((dateKey) => {
      const cell = document.createElement("div");
      const entries =
        schedule.entriesByDateTime[`${dateKey}|${slot}`] || [];

      if (entries.length === 0) {
        cell.className =
          "reservation-schedule-cell reservation-schedule-available";
        const available = document.createElement("span");
        available.className = "reservation-schedule-empty";
        available.textContent = "Available";
        cell.appendChild(available);
      } else {
        cell.className =
          "reservation-schedule-cell reservation-schedule-occupied";
        cell.appendChild(createReservationScheduleBooking(entries));
      }

      table.appendChild(cell);
    });
  });

  container.appendChild(table);
}

function createBusinessReservationCard(reservation) {
  const item = document.createElement("div");
  item.className =
    `admin-item reservation-management-card ${getReservationStatusClass(
      reservation.status
    )}`;

  const content = document.createElement("div");
  content.className = "reservation-management-content";

  const header = document.createElement("div");
  header.className = "reservation-card-header";

  const title = document.createElement("h3");
  title.textContent =
    getBusinessDashboardVenueName(reservation.venue_id);
  header.appendChild(title);
  header.appendChild(createStatusBadge(reservation.status));

  if (isPendingReservation(reservation)) {
    const newBadge = document.createElement("span");
    newBadge.className = "reservation-new-badge";
    newBadge.textContent = "New";
    header.appendChild(newBadge);
  }

  content.appendChild(header);

  const meta = document.createElement("div");
  meta.className = "reservation-meta-grid";
  meta.appendChild(
    createReservationMeta(
      "Guest",
      getReservationGuestLabel(reservation)
    )
  );
  meta.appendChild(
    createReservationMeta("Date", reservation.reservation_date)
  );
  meta.appendChild(
    createReservationMeta("Time", reservation.reservation_time)
  );
  meta.appendChild(
    createReservationMeta(
      "Party",
      `${reservation.party_size || 0}`
    )
  );
  meta.appendChild(
    createReservationMeta(
      "Status",
      getReservationStatusLabel(reservation.status)
    )
  );
  content.appendChild(meta);

  if (reservation.note) {
    content.appendChild(createReservationNote(reservation.note));
  }

  const actions = createReservationActions();
  const profileLink = createUserProfileLink(reservation.user_id);

  if (profileLink) {
    actions.appendChild(profileLink);
  }

  if (isPendingReservation(reservation)) {
    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "btn";
    approveButton.textContent = "Approve";
    bindReservationAction(approveButton, () => {
      updateBusinessReservationStatus(
        reservation.id,
        "approved"
      );
    });
    actions.appendChild(approveButton);

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "admin-delete-btn";
    rejectButton.textContent = "Reject";
    bindReservationAction(rejectButton, () => {
      updateBusinessReservationStatus(
        reservation.id,
        "rejected"
      );
    });
    actions.appendChild(rejectButton);
  }

  const messageButton = document.createElement("button");
  messageButton.type = "button";
  messageButton.className = "secondary-btn";
  messageButton.textContent = "Message User";
  bindReservationAction(messageButton, () => {
    openReservationConversation(reservation.id);
  });
  actions.appendChild(messageButton);

  item.appendChild(content);
  item.appendChild(actions);

  return item;
}

async function loadBusinessBusinesses(session) {
  const { data, error } =
    await supabaseClient
      .from("businesses")
      .select("*")
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: false });

  if (error) {
    showSafeError(error, "Businesses could not be loaded.");
    return [];
  }

  return data || [];
}

async function loadBusinessVenues() {
  const businessIds = getBusinessDashboardBusinessIds();

  if (businessIds.length === 0) return [];

  const { data, error } =
    await supabaseClient
      .from("venues")
      .select("*")
      .in("business_id", businessIds)
      .order("id", { ascending: false });

  if (error) {
    showSafeError(error, "Venues could not be loaded.");
    return [];
  }

  return data || [];
}

async function loadBusinessEvents() {
  const venueIds = getBusinessDashboardVenueIds();

  if (venueIds.length === 0) return [];

  const { data, error } =
    await supabaseClient
      .from("events")
      .select("*")
      .in("venue_id", venueIds)
      .order("id", { ascending: false });

  if (error) {
    showSafeError(error, "Events could not be loaded.");
    return [];
  }

  return data || [];
}

async function loadBusinessReservations() {
  const venueIds = getBusinessDashboardVenueIds();

  if (venueIds.length === 0) return [];

  const { data, error } =
    await supabaseClient
      .from("reservations")
      .select("*")
      .in("venue_id", venueIds)
      .order("created_at", { ascending: false });

  if (error) {
    showSafeError(error, "Reservations could not be loaded.");
    return [];
  }

  return data || [];
}

function mergeStoreOrderResults(results) {
  const ordersById = new Map();

  (results || []).forEach((result) => {
    (result.data || []).forEach((order) => {
      if (order && order.id) {
        ordersById.set(String(order.id), order);
      }
    });
  });

  return [...ordersById.values()].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
}

async function loadBusinessStoreOrders() {
  const list = document.getElementById("businessStoreOrdersList");

  if (!list) return [];

  const ownerId =
    businessDashboardState.session &&
    businessDashboardState.session.user &&
    businessDashboardState.session.user.id;
  const venueIds = getBusinessDashboardVenueIds();
  const requests = [];

  if (ownerId) {
    requests.push(
      supabaseClient
        .from("store_orders")
        .select("*, store_order_items(*)")
        .eq("business_owner_id", ownerId)
        .order("created_at", { ascending: false })
    );
  }

  if (venueIds.length > 0) {
    requests.push(
      supabaseClient
        .from("store_orders")
        .select("*, store_order_items(*)")
        .in("venue_id", venueIds)
        .order("created_at", { ascending: false })
    );
  }

  if (requests.length === 0) return [];

  try {
    const results = await Promise.all(requests);

    if (results.some((result) => result.error)) {
      renderStoreOrdersUnavailable(list);
      return null;
    }

    return mergeStoreOrderResults(results);
  } catch (error) {
    renderStoreOrdersUnavailable(list);
    return null;
  }
}

function getStoreOrderVenueLabel(order) {
  if (!order || !order.venue_id) return "Store";

  return safeText(getBusinessDashboardVenueName(order.venue_id)) ||
    `Venue #${order.venue_id}`;
}

function getStoreOrderCustomerLabel(order) {
  const userId = safeText(order && order.user_id);

  return userId ? `Müşteri #${userId.slice(0, 8)}` : "Müşteri";
}

function createBusinessStoreOrderStatusSelect(order) {
  const select = document.createElement("select");
  select.className = "store-order-status-select";
  select.setAttribute("aria-label", "Sipariş durumu");

  STORE_ORDER_STATUSES.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = getStoreOrderStatusLabel(status);
    select.appendChild(option);
  });

  select.value = getStoreOrderStatusValue(order.status);
  select.addEventListener("change", () => {
    updateBusinessStoreOrderStatus(order.id, select.value);
  });

  return select;
}

function createBusinessStoreOrderCard(order) {
  const card = document.createElement("article");
  card.className = "store-order-card business-store-order-card";

  const header = document.createElement("div");
  header.className = "store-order-card-header";

  const titleWrap = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = getStoreOrderTitle(order);
  titleWrap.appendChild(title);

  const meta = document.createElement("span");
  meta.textContent = [
    getStoreOrderVenueLabel(order),
    formatNotificationDate(order.created_at),
  ].filter(Boolean).join(" · ");
  titleWrap.appendChild(meta);

  header.appendChild(titleWrap);
  header.appendChild(createStoreOrderStatusBadge(order.status));
  card.appendChild(header);

  card.appendChild(createStoreOrderItemsList(getStoreOrderItems(order)));

  const footer = document.createElement("div");
  footer.className = "store-order-meta";

  const total = document.createElement("strong");
  total.textContent = formatStoreOrderAmount(order.total_amount);
  footer.appendChild(total);

  const customer = document.createElement("span");
  customer.textContent = getStoreOrderCustomerLabel(order);
  footer.appendChild(customer);

  const profileLink = createUserProfileLink(order.user_id, "Müşteri profili");
  if (profileLink) {
    footer.appendChild(profileLink);
  }

  if (order.customer_note) {
    const note = document.createElement("span");
    note.textContent = safeText(order.customer_note);
    footer.appendChild(note);
  }

  footer.appendChild(createBusinessStoreOrderStatusSelect(order));
  card.appendChild(footer);

  return card;
}

function renderBusinessStoreOrders(orders) {
  const list = document.getElementById("businessStoreOrdersList");

  if (!list) return;

  list.innerHTML = "";

  if (!orders || orders.length === 0) {
    renderEmptyState(
      list,
      "Henüz store siparişi yok.",
      "Yeni siparişler burada görünecek."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  orders.forEach((order) => {
    fragment.appendChild(createBusinessStoreOrderCard(order));
  });

  list.appendChild(fragment);
}

async function updateBusinessStoreOrderStatus(orderId, status) {
  const nextStatus = getStoreOrderStatusValue(status);
  const currentOrder =
    getBusinessStoreOrderById(orderId) || { id: orderId };
  const previousStatus = getStoreOrderStatusValue(currentOrder.status);

  if (!orderId || !STORE_ORDER_STATUSES.includes(nextStatus)) {
    showToast("Sipariş durumu güncellenemedi");
    return;
  }

  const { error } = await supabaseClient
    .from("store_orders")
    .update({ status: nextStatus })
    .eq("id", orderId);

  if (error) {
    showToast("Sipariş durumu güncellenemedi");
    return;
  }

  showToast("Sipariş durumu güncellendi");
  if (nextStatus !== previousStatus) {
    await notifyStoreOrderOwnerStatusChange(currentOrder, nextStatus);
  }

  const orders = await loadBusinessStoreOrders();

  if (Array.isArray(orders)) {
    businessDashboardState.storeOrders = orders;
    renderBusinessStoreOrders(orders);
  }
}

async function loadBusinessAnalytics() {
  const venueIds = getBusinessDashboardVenueIds();
  const eventIds = businessDashboardState.events.map(
    (eventItem) => eventItem.id
  );
  const analytics = getEmptyBusinessAnalytics();

  analytics.totalVenues =
    businessDashboardState.venues.length;
  analytics.totalEvents =
    businessDashboardState.events.length;
  analytics.totalReservations =
    businessDashboardState.reservations.length;

  businessDashboardState.reservations.forEach(
    (reservation) => {
      const status = safeText(reservation.status)
        .toLowerCase()
        .trim();

      if (status === "pending" || !status) {
        analytics.pendingReservations += 1;
      }

      if (status === "approved") {
        analytics.approvedReservations += 1;
      }
    }
  );

  const statsRequests = [];

  if (venueIds.length > 0) {
    statsRequests.push(
      supabaseClient
        .from("favorites")
        .select("venue_id")
        .in("venue_id", venueIds)
    );
    statsRequests.push(
      supabaseClient
        .from("venue_reviews")
        .select("venue_id, rating")
        .in("venue_id", venueIds)
    );
  } else {
    statsRequests.push(Promise.resolve({ data: [], error: null }));
    statsRequests.push(Promise.resolve({ data: [], error: null }));
  }

  if (eventIds.length > 0) {
    statsRequests.push(
      supabaseClient
        .from("event_attendees")
        .select("event_id")
        .in("event_id", eventIds)
    );
  } else {
    statsRequests.push(Promise.resolve({ data: [], error: null }));
  }

  const [
    favoritesResult,
    reviewsResult,
    attendeesResult,
  ] = await Promise.all(statsRequests);

  if (favoritesResult.error) {
    showSafeError(favoritesResult.error, "Analytics could not be fully loaded.");
  } else {
    analytics.totalFavorites =
      (favoritesResult.data || []).length;
  }

  if (reviewsResult.error) {
    showSafeError(reviewsResult.error, "Analytics could not be fully loaded.");
  } else {
    const reviews = reviewsResult.data || [];
    analytics.totalReviews = reviews.length;

    if (reviews.length > 0) {
      const ratingTotal = reviews.reduce(
        (sum, review) => sum + Number(review.rating || 0),
        0
      );
      analytics.averageRating = ratingTotal / reviews.length;
    }
  }

  if (attendeesResult.error) {
    showSafeError(attendeesResult.error, "Analytics could not be fully loaded.");
  } else {
    analytics.totalAttendees =
      (attendeesResult.data || []).length;
  }

  return analytics;
}

async function refreshBusinessDashboard() {
  businessDashboardState.businesses =
    await loadBusinessBusinesses(
      businessDashboardState.session
    );
  renderBusinessRecords(businessDashboardState.businesses);
  updateBusinessOwnerCrudVisibility();

  if (businessDashboardState.businesses.length === 0) {
    businessDashboardState.venues = [];
    businessDashboardState.events = [];
    businessDashboardState.reservations = [];
    businessDashboardState.storeOrders = [];
    renderBusinessAnalytics(getEmptyBusinessAnalytics());
    populateBusinessDashboardSelects();
    populateBusinessMenuVenueSelect();
    populateBusinessStoreVenueSelect();
    renderBusinessVenues([]);
    renderBusinessEvents([]);
    renderBusinessReservations([]);
    renderBusinessStoreOrders([]);
    renderBusinessReservationSchedule([]);
    updateBusinessBookingVenueOptions();
    renderBusinessOperatingHourRows([]);
    renderBusinessBookingRules(null);
    renderBusinessBlackoutDates([]);
    setBusinessBookingStatus(
      "Add an approved business and venue to manage booking settings."
    );
    await refreshBusinessVenueMenu();
    await refreshBusinessVenueProducts();
    return;
  }

  businessDashboardState.venues = await loadBusinessVenues();
  populateBusinessDashboardSelects();
  populateBusinessMenuVenueSelect();
  populateBusinessStoreVenueSelect();
  updateBusinessBookingVenueOptions();
  renderBusinessVenues(businessDashboardState.venues);
  await refreshBusinessVenueMenu();
  await refreshBusinessVenueProducts();
  await loadBusinessBookingSettings();

  businessDashboardState.events = await loadBusinessEvents();
  renderBusinessEvents(businessDashboardState.events);

  businessDashboardState.reservations =
    await loadBusinessReservations();
  renderBusinessReservations(
    businessDashboardState.reservations
  );
  renderBusinessReservationSchedule(
    businessDashboardState.reservations
  );

  const storeOrders = await loadBusinessStoreOrders();
  if (Array.isArray(storeOrders)) {
    businessDashboardState.storeOrders = storeOrders;
    renderBusinessStoreOrders(storeOrders);
  }

  renderBusinessAnalytics(await loadBusinessAnalytics());
}

async function saveBusinessVenue(event) {
  event.preventDefault();

  const id = getAdminValue("businessVenueId");
  const businessId = getAdminValue("businessVenueBusinessId");
  const latitudeValue =
    getAdminValue("businessVenueLatitude");
  const longitudeValue =
    getAdminValue("businessVenueLongitude");
  const hasLatitude = latitudeValue !== "";
  const hasLongitude = longitudeValue !== "";

  if (!ownsBusinessRecord(businessId)) {
    showToast("Choose one of your businesses");
    return;
  }

  if (id && !ownsVenueRecord(id)) {
    showToast("You can only edit your own venues");
    return;
  }

  if (hasLatitude !== hasLongitude) {
    showToast("Enter both latitude and longitude");
    return;
  }

  if (
    hasLatitude &&
    !hasValidCoordinate(latitudeValue, longitudeValue)
  ) {
    showToast("Latitude or longitude is out of range");
    return;
  }

  const imageFile = getAdminFile("businessVenueImageFile");
  const manualImage = getAdminValue("businessVenueImage");
  const hasPendingGallery =
    businessMediaState.venueGallery.pendingFiles.length > 0 ||
    businessMediaState.venueGallery.removedPhotoIds.length > 0;
  const galleryUrlInput = getVenueGalleryUrls("businessVenueGalleryUrls");

  const payload = {
    business_id: businessId,
    name: getAdminValue("businessVenueName"),
    city: getAdminValue("businessVenueCity"),
    category: getVenueCategoryValue({
      category: getAdminValue("businessVenueCategory"),
    }),
    image: manualImage,
    address: getAdminValue("businessVenueAddress"),
    latitude: hasLatitude ? Number(latitudeValue) : null,
    longitude: hasLongitude ? Number(longitudeValue) : null,
    description: getAdminValue("businessVenueDescription"),
  };

  let error = null;
  let savedVenueId = id;

  if (id) {
    ({ error } = await supabaseClient
      .from("venues")
      .update(payload)
      .eq("id", id)
      .in("business_id", getBusinessDashboardBusinessIds()));
  } else {
    const { data, error: insertError } = await supabaseClient
      .from("venues")
      .insert([payload])
      .select("id")
      .single();

    error = insertError;
    savedVenueId = data ? data.id : "";
  }

  if (error) {
    showSafeError(error, "Venue could not be saved.");
    return;
  }

  if (imageFile) {
    const uploadedImage = await uploadMediaImage(imageFile, "venues", {
      venueId: savedVenueId,
    });

    if (!uploadedImage) return;

    payload.image = uploadedImage;
    await supabaseClient
      .from("venues")
      .update({ image: uploadedImage })
      .eq("id", savedVenueId);
  }

  if (
    hasPendingGallery ||
    galleryUrlInput.length > 0 ||
    businessMediaState.venueGallery.removedPhotoIds.length > 0
  ) {
    const galleryResult = await persistBusinessVenueGalleryChanges(
      savedVenueId
    );

    if (
      !payload.image &&
      galleryResult.primaryImage
    ) {
      await syncVenuePrimaryImage(
        savedVenueId,
        galleryResult.primaryImage
      );
    }
  } else if (!payload.image) {
    const existingPhotos = await loadVenueGalleryPhotos(savedVenueId);

    if (existingPhotos[0] && existingPhotos[0].image_url) {
      await syncVenuePrimaryImage(
        savedVenueId,
        existingPhotos[0].image_url
      );
    }
  }

  showToast(id ? "Venue updated" : "Venue created");
  clearBusinessVenueForm();
  await refreshBusinessDashboard();
}

async function saveBusinessEvent(event) {
  event.preventDefault();

  const id = getAdminValue("businessEventId");
  const venueId = getAdminValue("businessEventVenueId");

  if (!ownsVenueRecord(venueId)) {
    showToast("Choose one of your venues");
    return;
  }

  if (
    id &&
    !businessDashboardState.events.some(
      (eventItem) => String(eventItem.id) === String(id)
    )
  ) {
    showToast("You can only edit your own events");
    return;
  }

  const imageFile = getAdminFile("businessEventImageFile");
  const uploadedImage = imageFile
    ? await uploadAdminImage(imageFile, "events")
    : "";

  if (imageFile && !uploadedImage) return;

  const payload = {
    venue_id: venueId,
    title: getAdminValue("businessEventTitle"),
    event_date: getAdminValue("businessEventDate"),
    image:
      uploadedImage || getAdminValue("businessEventImage"),
    description: getAdminValue("businessEventDescription"),
  };

  const request = id
    ? supabaseClient
        .from("events")
        .update(payload)
        .eq("id", id)
        .in("venue_id", getBusinessDashboardVenueIds())
    : supabaseClient.from("events").insert([payload]);

  const { error } = await request;

  if (error) {
    showSafeError(error, "Event could not be saved.");
    return;
  }

  showToast(id ? "Event updated" : "Event created");
  clearBusinessEventForm();
  await refreshBusinessDashboard();
}

async function deleteBusinessVenue(id) {
  if (!ownsVenueRecord(id)) {
    showToast("You can only delete your own venues");
    return;
  }

  if (!confirm("Delete this venue?")) return;

  const { error } =
    await supabaseClient
      .from("venues")
      .delete()
      .eq("id", id)
      .in("business_id", getBusinessDashboardBusinessIds());

  if (error) {
    showSafeError(error, "Venue could not be deleted.");
    return;
  }

  showToast("Venue deleted");
  await refreshBusinessDashboard();
}

async function deleteBusinessEvent(id) {
  const eventRecord = businessDashboardState.events.find(
    (eventItem) => String(eventItem.id) === String(id)
  );

  if (!eventRecord || !ownsVenueRecord(eventRecord.venue_id)) {
    showToast("You can only delete your own events");
    return;
  }

  if (!confirm("Delete this event?")) return;

  const { error } =
    await supabaseClient
      .from("events")
      .delete()
      .eq("id", id)
      .in("venue_id", getBusinessDashboardVenueIds());

  if (error) {
    showSafeError(error, "Event could not be deleted.");
    return;
  }

  showToast("Event deleted");
  await refreshBusinessDashboard();
}

async function updateBusinessReservationStatus(id, status) {
  const reservation =
    businessDashboardState.reservations.find(
      (item) => String(item.id) === String(id)
    );

  if (!reservation || !ownsVenueRecord(reservation.venue_id)) {
    showToast("You can only update your own reservations");
    return;
  }

  const { error } =
    await supabaseClient
      .from("reservations")
      .update({ status })
      .eq("id", id)
      .in("venue_id", getBusinessDashboardVenueIds());

  if (error) {
    showSafeError(error, "Reservation status could not be updated.");
    return;
  }

  showToast(`Reservation ${status}`);
  notifyUserReservationStatus(reservation, status);
  await refreshBusinessDashboard();
}

function getConversationIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("conversation");
}

function getUserIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || params.get("user") || "";
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    safeText(value)
  );
}

let messageUnreadCountsByConversationId = {};
let messageAttachmentsAvailable = null;
let messageTypingAvailable = null;
let messageTypingUpdateTimer = null;
let messageTypingClearTimer = null;
let messageTypingPollTimer = null;
let messageSessionUserId = "";

function getConversationIdFromNotificationLink(linkUrl) {
  if (!linkUrl) return "";

  try {
    const url = new URL(linkUrl, window.location.href);
    const path = url.pathname.split("/").pop();

    if (path !== "messages.html") return "";

    return url.searchParams.get("conversation") || "";
  } catch (error) {
    console.log(error);
    return "";
  }
}

async function loadMessageUnreadCounts(userId) {
  if (!userId) return {};

  const { data: conversations, error: conversationError } =
    await supabaseClient
      .from("message_conversations")
      .select("id");

  if (conversationError) {
    console.log(conversationError);
    return {};
  }

  const conversationIds = (conversations || [])
    .map((conversation) => conversation.id)
    .filter(Boolean);

  if (conversationIds.length === 0) return {};

  let reads = [];

  const { data: readRows, error: readsError } =
    await supabaseClient
      .from("message_conversation_reads")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId)
      .in("conversation_id", conversationIds);

  if (readsError) {
    console.warn(readsError);
  } else {
    reads = readRows || [];
  }

  const lastReadByConversationId = {};

  reads.forEach((read) => {
    if (!read.conversation_id) return;

    lastReadByConversationId[String(read.conversation_id)] =
      read.last_read_at || "";
  });

  const { data: messages, error: messagesError } =
    await supabaseClient
      .from("messages")
      .select("conversation_id, sender_id, created_at")
      .in("conversation_id", conversationIds)
      .neq("sender_id", userId);

  if (messagesError) {
    console.log(messagesError);
    return {};
  }

  const counts = {};

  (messages || []).forEach((message) => {
    const conversationId = String(message.conversation_id || "");

    if (!conversationId) return;

    const lastReadAt =
      lastReadByConversationId[conversationId] || "";
    const hasBeenRead =
      lastReadAt &&
      new Date(message.created_at).getTime() <=
        new Date(lastReadAt).getTime();

    if (hasBeenRead) return;

    counts[conversationId] =
      (counts[conversationId] || 0) + 1;
  });

  return counts;
}

function getTotalUnreadMessageCount() {
  return Object.values(
    messageUnreadCountsByConversationId || {}
  ).reduce((total, count) => total + Number(count || 0), 0);
}

function updateMessagesBottomNavUnread(count) {
  const link = document.querySelector(
    '.mobile-bottom-nav a[href="./messages.html"]'
  );

  if (!link) return;

  let badge = link.querySelector(".message-nav-unread-badge");

  if (count > 0) {
    link.classList.add("has-unread");

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "message-nav-unread-badge";
      link.appendChild(badge);
    }

    badge.textContent = count > 9 ? "9+" : String(count);
    badge.setAttribute("aria-label", `${count} unread messages`);
    return;
  }

  link.classList.remove("has-unread");

  if (badge) {
    badge.remove();
  }
}

async function markConversationReadState(userId, conversationId) {
  if (!userId || !conversationId) return;

  try {
    const { error: rpcError } = await supabaseClient.rpc(
      "mark_conversation_read",
      {
        p_conversation_id: conversationId,
      }
    );

    if (!rpcError) return;
  } catch (error) {
    console.warn("Read receipt RPC unavailable.", error);
  }

  const { error } =
    await supabaseClient
      .from("message_conversation_reads")
      .upsert(
        {
          conversation_id: conversationId,
          user_id: userId,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,user_id" }
      );

  if (error) {
    console.warn(error);
  }
}

async function loadConversationReadStates(conversationId) {
  if (!conversationId) return [];

  try {
    const { data, error } = await supabaseClient.rpc(
      "get_conversation_read_state",
      {
        p_conversation_id: conversationId,
      }
    );

    if (!error) return data || [];

    console.warn("Read state RPC unavailable.", error);
  } catch (error) {
    console.warn("Read state RPC unavailable.", error);
  }

  try {
    const { data, error } = await supabaseClient
      .from("message_conversation_reads")
      .select("user_id, last_read_at")
      .eq("conversation_id", conversationId);

    if (error) {
      console.warn("Read state fallback unavailable.", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.warn("Read state fallback unavailable.", error);
    return [];
  }
}

function hasRecipientReadMessage(message, readStates, sessionUserId) {
  if (
    !message ||
    String(message.sender_id) !== String(sessionUserId)
  ) {
    return false;
  }

  return (readStates || []).some((readState) => {
    if (
      !readState ||
      String(readState.user_id) === String(sessionUserId) ||
      !readState.last_read_at ||
      !message.created_at
    ) {
      return false;
    }

    return (
      new Date(readState.last_read_at).getTime() >=
      new Date(message.created_at).getTime()
    );
  });
}

async function updateConversationTypingState(
  conversationId,
  userId,
  isTyping
) {
  if (!conversationId || !userId || messageTypingAvailable === false) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("conversation_typing_states")
      .upsert(
        {
          conversation_id: conversationId,
          user_id: userId,
          is_typing: Boolean(isTyping),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,user_id" }
      );

    if (error) {
      messageTypingAvailable = false;
      console.warn("Typing indicators unavailable.", error);
      return;
    }

    messageTypingAvailable = true;
  } catch (error) {
    messageTypingAvailable = false;
    console.warn("Typing indicators unavailable.", error);
  }
}

function renderTypingIndicator(isTyping) {
  const indicator = document.getElementById(
    "conversationTypingIndicator"
  );

  if (!indicator) return;

  indicator.textContent = isTyping ? "Typing..." : "";
}

async function refreshConversationTypingIndicator(
  conversationId,
  userId
) {
  if (!conversationId || !userId || messageTypingAvailable === false) {
    renderTypingIndicator(false);
    return;
  }

  try {
    const staleCutoff = new Date(Date.now() - 7000).toISOString();
    const { data, error } = await supabaseClient
      .from("conversation_typing_states")
      .select("user_id, is_typing, updated_at")
      .eq("conversation_id", conversationId)
      .neq("user_id", userId)
      .eq("is_typing", true)
      .gte("updated_at", staleCutoff);

    if (error) {
      messageTypingAvailable = false;
      renderTypingIndicator(false);
      console.warn("Typing indicators unavailable.", error);
      return;
    }

    messageTypingAvailable = true;
    renderTypingIndicator(Boolean(data && data.length));
  } catch (error) {
    messageTypingAvailable = false;
    renderTypingIndicator(false);
    console.warn("Typing indicators unavailable.", error);
  }
}

function startConversationTypingPoll(conversationId, userId) {
  stopConversationTypingPoll();

  if (!conversationId || !userId) return;

  refreshConversationTypingIndicator(conversationId, userId);
  messageTypingPollTimer = window.setInterval(() => {
    refreshConversationTypingIndicator(conversationId, userId);
  }, 3500);
}

function stopConversationTypingPoll() {
  if (messageTypingPollTimer) {
    window.clearInterval(messageTypingPollTimer);
    messageTypingPollTimer = null;
  }

  renderTypingIndicator(false);
}

async function checkMessageAttachmentsTable() {
  if (messageAttachmentsAvailable !== null) {
    return messageAttachmentsAvailable;
  }

  try {
    const { error } = await supabaseClient
      .from("message_attachments")
      .select("id")
      .limit(1);

    if (error) {
      console.warn("Message attachments unavailable.", error);
      messageAttachmentsAvailable = false;
      return false;
    }

    messageAttachmentsAvailable = true;
    return true;
  } catch (error) {
    console.warn("Message attachments unavailable.", error);
    messageAttachmentsAvailable = false;
    return false;
  }
}

async function loadMessageAttachments(conversationId) {
  if (!conversationId) return {};

  const isAvailable = await checkMessageAttachmentsTable();

  if (!isAvailable) return {};

  try {
    const { data, error } = await supabaseClient
      .from("message_attachments")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Message attachments could not be loaded.", error);
      return {};
    }

    const attachmentsByMessageId = {};

    (data || []).forEach((attachment) => {
      const messageId = String(attachment.message_id || "");

      if (!messageId) return;

      if (!attachmentsByMessageId[messageId]) {
        attachmentsByMessageId[messageId] = [];
      }

      attachmentsByMessageId[messageId].push(attachment);
    });

    return attachmentsByMessageId;
  } catch (error) {
    console.warn("Message attachments could not be loaded.", error);
    return {};
  }
}

function renderMessageAttachments(bubble, attachments) {
  const validAttachments = (attachments || []).filter((attachment) =>
    safeText(attachment.file_url)
  );

  if (validAttachments.length === 0) return;

  const list = document.createElement("div");
  list.className = "message-attachments";

  validAttachments.forEach((attachment) => {
    const link = document.createElement("a");
    link.className = "message-attachment-link";
    link.href = attachment.file_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const image = document.createElement("img");
    image.src = attachment.file_url;
    image.alt = safeText(attachment.file_name) || "Message image";
    image.loading = "lazy";
    image.addEventListener(
      "error",
      () => {
        link.remove();
      },
      { once: true }
    );

    link.appendChild(image);
    list.appendChild(link);
  });

  if (list.children.length > 0) {
    bubble.appendChild(list);
  }
}

async function saveMessageAttachment({
  messageId,
  conversationId,
  senderId,
  file,
}) {
  if (!messageId || !conversationId || !senderId || !file) return;

  const isAvailable = await checkMessageAttachmentsTable();

  if (!isAvailable) return;

  try {
    const fileUrl = await uploadAdminImage(file, "messages");

    if (!fileUrl) return;

    const { error } = await supabaseClient
      .from("message_attachments")
      .insert([
        {
          message_id: messageId,
          conversation_id: conversationId,
          sender_id: senderId,
          file_url: fileUrl,
          file_type: file.type || "",
          file_name: file.name || "",
        },
      ]);

    if (error) {
      console.warn("Message attachment was not saved.", error);
    }
  } catch (error) {
    console.warn("Message attachment was not saved.", error);
  }
}

async function markConversationNotificationsRead(
  userId,
  conversationId
) {
  if (!userId || !conversationId) return;

  const { data, error } =
    await supabaseClient
      .from("notifications")
      .select("id, link_url")
      .eq("user_id", userId)
      .eq("is_read", false);

  if (error) {
    console.log(error);
    return;
  }

  const notificationIds = (data || [])
    .filter(
      (notification) =>
        String(
          getConversationIdFromNotificationLink(
            notification.link_url
          )
        ) === String(conversationId)
    )
    .map((notification) => notification.id)
    .filter(Boolean);

  if (notificationIds.length === 0) return;

  const { error: updateError } =
    await supabaseClient
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .in("id", notificationIds);

  if (updateError) {
    console.log(updateError);
  }
}

function getConversationIdFromRpcResult(data) {
  if (!data) return "";

  if (typeof data === "string" || typeof data === "number") {
    return safeText(data);
  }

  if (Array.isArray(data)) {
    return getConversationIdFromRpcResult(data[0]);
  }

  return safeText(
    data.id ||
      data.conversation_id ||
      data.get_or_create_direct_conversation ||
      data.get_or_create_direct_conversation_id ||
      data.direct_conversation_id ||
      data.get_or_create_reservation_conversation ||
      ""
  );
}

function isDirectConversation(conversation) {
  if (!conversation) return false;

  if (
    safeText(conversation.conversation_type).toLowerCase() ===
    "direct"
  ) {
    return true;
  }

  return (
    !conversation.reservation_id &&
    !conversation.venue_id &&
    ((conversation.participant_one_id &&
      conversation.participant_two_id) ||
      (conversation.user_id && conversation.business_owner_id))
  );
}

function getConversationParticipantIds(conversation) {
  if (!conversation) return [];

  return [
    conversation.participant_one_id,
    conversation.participant_two_id,
    conversation.user_id,
    conversation.business_owner_id,
  ].filter(Boolean);
}

function getOtherConversationParticipantId(conversation, userId) {
  return (
    getConversationParticipantIds(conversation).find(
      (participantId) =>
        String(participantId) !== String(userId)
    ) || ""
  );
}

function getConversationTitle(conversation) {
  if (!conversation) return "Conversation";

  if (isDirectConversation(conversation)) {
    return safeText(conversation.direct_participant_name) ||
      "Direct message";
  }

  if (conversation.reservation_id) {
    return `Reservation #${conversation.reservation_id}`;
  }

  return `Conversation #${safeText(conversation.id)}`;
}

function getConversationSubtitle(conversation) {
  const parts = [];

  if (isDirectConversation(conversation)) {
    parts.push("Profile conversation");
  }

  if (conversation.venue_id) {
    parts.push(`Venue #${conversation.venue_id}`);
  }

  if (conversation.updated_at || conversation.created_at) {
    parts.push(
      formatNotificationDate(
        conversation.updated_at || conversation.created_at
      )
    );
  }

  return parts.filter(Boolean).join(" - ");
}

function getConversationRoleLabel(conversation, userId) {
  if (!conversation || !userId) return "";

  if (isDirectConversation(conversation)) {
    return "Direct message";
  }

  if (String(conversation.user_id) === String(userId)) {
    return "Guest side";
  }

  if (
    String(conversation.business_owner_id) === String(userId)
  ) {
    return "Business side";
  }

  return "";
}

function getMessageSenderLabel(message, conversation, userId) {
  if (String(message.sender_id) === String(userId)) {
    return "You";
  }

  if (isDirectConversation(conversation)) {
    return safeText(conversation.direct_participant_name) ||
      "Profile";
  }

  if (
    conversation &&
    String(message.sender_id) === String(conversation.user_id)
  ) {
    return "Guest";
  }

  if (
    conversation &&
    String(message.sender_id) ===
      String(conversation.business_owner_id)
  ) {
    return "Business";
  }

  return "Message";
}

function getProfileDisplayName(profile) {
  if (!profile) return "User";

  return (
    safeText(profile.full_name) ||
    safeText(profile.display_name) ||
    safeText(profile.name) ||
    safeText(profile.username) ||
    safeText(profile.email) ||
    safeText(profile.user_email) ||
    "User"
  );
}

function getProfileAvatar(profile) {
  if (!profile) return "";

  return (
    safeText(profile.avatar_url) ||
    safeText(profile.avatar) ||
    safeText(profile.image) ||
    safeText(profile.photo_url)
  );
}

function getProfileEmail(profile) {
  if (!profile) return "";

  return (
    safeText(profile.email) ||
    safeText(profile.user_email) ||
    safeText(profile.auth_email)
  );
}

function createUserProfileLink(userId, label = "View profile") {
  if (!userId) return null;

  const link = document.createElement("a");
  link.className = "profile-link";
  link.href = `./user.html?id=${encodeURIComponent(userId)}`;
  link.textContent = label;

  return link;
}

async function loadProfileRecordByUserId(userId) {
  if (!userId) return null;

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("Public profile lookup unavailable.", error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.warn("Public profile lookup unavailable.", error);
    return null;
  }
}

async function hydrateDirectConversationProfiles(conversations) {
  const directConversations = (conversations || []).filter(
    isDirectConversation
  );

  if (directConversations.length === 0) return;

  const session = await getSafeSession();
  const sessionUserId = session && session.user ? session.user.id : "";

  if (!sessionUserId) return;

  const profileIds = [
    ...new Set(
      directConversations
        .map((conversation) =>
          getOtherConversationParticipantId(
            conversation,
            sessionUserId
          )
        )
        .filter(Boolean)
    ),
  ];

  if (profileIds.length === 0) return;

  const profilesById = new Map();

  await Promise.all(
    profileIds.map(async (profileId) => {
      const profile = await loadProfileRecordByUserId(profileId);
      profilesById.set(String(profileId), profile);
    })
  );

  directConversations.forEach((conversation) => {
    const participantId = getOtherConversationParticipantId(
      conversation,
      sessionUserId
    );
    const profile = profilesById.get(String(participantId));
    conversation.direct_participant_id = participantId;
    conversation.direct_participant_name =
      getProfileDisplayName(profile);
  });
}

async function hydrateDirectConversationProfile(conversation) {
  if (!conversation || !isDirectConversation(conversation)) {
    return conversation;
  }

  await hydrateDirectConversationProfiles([conversation]);
  return conversation;
}

function createUserSearchStatus(message) {
  const status = document.createElement("p");
  status.className = "user-search-status";
  status.textContent = message;

  return status;
}

function normalizeDirectMessageUser(row) {
  if (!row) return null;

  const id = safeText(row.user_id || row.id);

  if (!id || !isValidUuid(id)) return null;

  return {
    id,
    name: getProfileDisplayName(row),
    username: safeText(row.username),
    email: getProfileEmail(row),
    avatar: getProfileAvatar(row),
    matchLabel: safeText(row.match_label),
  };
}

function dedupeDirectMessageUsers(rows, sessionUserId) {
  const usersById = new Map();

  (rows || []).forEach((row) => {
    const user = normalizeDirectMessageUser(row);

    if (!user || String(user.id) === String(sessionUserId)) return;

    if (!usersById.has(String(user.id))) {
      usersById.set(String(user.id), user);
    }
  });

  return [...usersById.values()];
}

async function searchUsersForDirectMessage(query) {
  const searchTerm = safeText(query).trim();

  if (searchTerm.length < 3) return [];

  const session = await getSafeSession();
  const sessionUserId = session && session.user ? session.user.id : "";
  const escapedTerm = searchTerm.replace(/[%_]/g, "\\$&");
  const searchPattern = `%${escapedTerm}%`;
  const fallbackFilters = [
    `full_name.ilike.${searchPattern}`,
    `username.ilike.${searchPattern}`,
  ];

  try {
    const { data, error } = await supabaseClient.rpc(
      "search_message_users",
      {
        p_query: searchTerm,
      }
    );

    if (!error) {
      return dedupeDirectMessageUsers(data || [], sessionUserId);
    }

    console.warn("Message user directory search unavailable.", error);
  } catch (error) {
    console.warn("Message user directory search unavailable.", error);
  }

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .or(fallbackFilters.join(","))
      .limit(12);

    if (error) {
      console.warn("User search unavailable.", error);
      throw error;
    }

    return dedupeDirectMessageUsers(data || [], sessionUserId);
  } catch (error) {
    console.warn("User search unavailable.", error);
    throw error;
  }
}

function renderUserSearchResults(users) {
  const results = document.getElementById("userSearchResults");

  if (!results) return;

  results.innerHTML = "";

  if (!users || users.length === 0) {
    results.appendChild(
      createUserSearchStatus(
        "No user found. Ask them to complete their profile or check the email."
      )
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  users.forEach((user) => {
    const card = document.createElement("div");
    card.className = "user-search-result";

    const avatar = document.createElement("div");
    avatar.className = "user-search-avatar";

    if (user.avatar) {
      const image = document.createElement("img");
      image.src = getImage(user.avatar);
      image.alt = user.name;
      image.loading = "lazy";
      image.addEventListener(
        "error",
        () => {
          image.remove();
          avatar.textContent = user.name.charAt(0).toUpperCase() || "U";
        },
        { once: true }
      );
      avatar.appendChild(image);
    } else {
      avatar.textContent = user.name.charAt(0).toUpperCase() || "U";
    }

    const content = document.createElement("div");
    content.className = "user-search-copy";

    const name = document.createElement("strong");
    name.textContent = user.name;
    content.appendChild(name);

    const meta = document.createElement("span");
    meta.textContent =
      user.matchLabel ||
      (user.username
        ? `@${user.username}`
        : user.email || "TANIDIK member");
    content.appendChild(meta);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-btn user-search-message-btn";
    button.textContent = "Message";
    button.addEventListener("click", () =>
      startDirectMessageFromSearch(user.id)
    );

    card.appendChild(avatar);
    card.appendChild(content);
    card.appendChild(button);
    fragment.appendChild(card);
  });

  results.appendChild(fragment);
}

async function startDirectMessageFromSearch(userId) {
  if (!userId || !isValidUuid(userId)) {
    showToast("Could not start conversation. Please try again.");
    return;
  }

  console.log("Starting direct message from search", {
    targetUserId: userId,
  });

  const buttons = [
    ...document.querySelectorAll(".user-search-message-btn"),
  ];

  buttons.forEach((button) => {
    button.disabled = true;
  });

  try {
    const opened = await openDirectConversation(userId);

    buttons.forEach((button) => {
      button.disabled = false;
    });
  } catch (error) {
    console.warn("Direct conversation could not be opened.", error);
    showToast("Could not start conversation. Please try again.");
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

async function getOrCreateDirectConversation(targetUserId) {
  if (!targetUserId || !isValidUuid(targetUserId)) {
    showToast("User not found");
    return "";
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "./auth.html";
    return "";
  }

  if (String(targetUserId) === String(session.user.id)) {
    showToast("You cannot message yourself");
    return "";
  }

  console.log("Calling direct conversation RPC", {
    rpc: "get_or_create_direct_conversation",
    targetUserId,
  });

  let data = null;
  let error = null;

  try {
    ({ data, error } = await supabaseClient.rpc(
      "get_or_create_direct_conversation",
      {
        p_target_user_id: targetUserId,
      }
    ));
  } catch (rpcError) {
    error = rpcError;
  }

  if (error) {
    console.warn("Direct conversation unavailable.", {
      rpc: "get_or_create_direct_conversation",
      targetUserId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      error,
    });
    showToast(getDirectConversationErrorMessage(error));
    return "";
  }

  console.log("Direct conversation RPC result", {
    rpc: "get_or_create_direct_conversation",
    targetUserId,
    data,
  });

  const conversationId = getConversationIdFromRpcResult(data);

  if (!conversationId || !isValidUuid(conversationId)) {
    console.warn("Direct conversation RPC returned no valid id.", {
      targetUserId,
      data,
    });
    showToast("Conversation unavailable");
    return "";
  }

  return conversationId;
}

function getDirectConversationErrorMessage(error) {
  const message = safeText(error && error.message).toLowerCase();

  if (message.includes("not authenticated")) {
    return "Please log in to start a conversation.";
  }

  if (message.includes("yourself")) {
    return "You cannot message yourself.";
  }

  if (message.includes("target user")) {
    return "That user could not be found.";
  }

  if (message.includes("permission") || message.includes("rls")) {
    return "Conversation access is not available yet.";
  }

  return "Could not start conversation. Please try again.";
}

async function openDirectConversation(targetUserId) {
  const conversationId =
    await getOrCreateDirectConversation(targetUserId);

  if (!conversationId) return false;

  const messagesPageReady =
    document.getElementById("messagesList") &&
    document.getElementById("conversationPanel");

  if (messagesPageReady) {
    const nextUrl =
      `./messages.html?conversation=${encodeURIComponent(
        conversationId
      )}`;

    window.history.pushState({}, "", nextUrl);
    await loadMessageInbox();
    await loadConversation(conversationId);

    const searchPanel = document.getElementById("userSearchPanel");
    const searchButton = document.getElementById("newMessageBtn");
    const bodyInput = document.getElementById("messageBody");

    if (searchPanel) {
      searchPanel.hidden = true;
    }

    if (searchButton) {
      searchButton.setAttribute("aria-expanded", "false");
    }

    if (bodyInput) {
      bodyInput.focus();
    }

    return true;
  }

  window.location.href =
    `./messages.html?conversation=${encodeURIComponent(
      conversationId
    )}`;
  return true;
}

async function getStoreProductBusinessOwnerId(product) {
  const embeddedOwnerId = [
    product && product.owner_id,
    product && product.business_owner_id,
    product && product.businessOwnerId,
    product && product.owner && product.owner.id,
    product && product.business_owner && product.business_owner.id,
    product && product.business && product.business.owner_id,
    product && product.businesses && product.businesses.owner_id,
    product && product.venues && product.venues.owner_id,
    product && product.venues && product.venues.business_owner_id,
    product &&
      product.venues &&
      product.venues.businesses &&
      product.venues.businesses.owner_id,
  ]
    .map((value) => safeText(value).trim())
    .find(Boolean);

  if (embeddedOwnerId) {
    return embeddedOwnerId;
  }

  const businessId = safeText(
    (product && product.business_id) ||
      (product && product.venues && product.venues.business_id)
  ).trim();

  if (businessId) {
    try {
      const { data: business, error: businessError } =
        await supabaseClient
          .from("businesses")
          .select("owner_id")
          .eq("id", businessId)
          .maybeSingle();

      if (!businessError && business && business.owner_id) {
        return safeText(business.owner_id).trim();
      }
    } catch (error) {
      // Fall through to venue lookup below.
    }
  }

  const venueId = safeText(product && product.venue_id).trim();

  if (!venueId) {
    return "";
  }

  try {
    const { data: venue, error: venueError } =
      await supabaseClient
        .from("venues")
        .select("business_id")
        .eq("id", venueId)
        .maybeSingle();

    if (venueError || !venue || !venue.business_id) {
      return "";
    }

    const { data: business, error: businessError } =
      await supabaseClient
        .from("businesses")
        .select("owner_id")
        .eq("id", venue.business_id)
        .maybeSingle();

    if (businessError || !business || !business.owner_id) {
      return "";
    }

    return safeText(business.owner_id).trim();
  } catch (error) {
    return "";
  }
}

async function openStoreProductConversation(product) {
  const ownerId = await getStoreProductBusinessOwnerId(product);

  if (!ownerId) {
    showToast("İşletmeye mesaj gönderilemedi");
    return false;
  }

  if (typeof openDirectConversation !== "function") {
    showToast("İşletmeye mesaj gönderilemedi");
    return false;
  }

  return openDirectConversation(ownerId);
}

function setPublicUserMessageError(message) {
  const errorElement =
    document.getElementById("publicUserMessageError");

  if (errorElement) {
    errorElement.textContent = safeText(message);
  }
}

function renderPublicUserProfile(profile, userId, session) {
  const nameElement = document.getElementById("publicUserName");
  const metaElement = document.getElementById("publicUserMeta");
  const avatarElement =
    document.getElementById("publicUserAvatar");
  const messageButton =
    document.getElementById("publicUserMessageBtn");
  const name = getProfileDisplayName(profile);
  const email =
    getProfileEmail(profile) ||
    (session &&
    session.user &&
    String(session.user.id) === String(userId)
      ? safeText(session.user.email)
      : "");
  const avatar = getProfileAvatar(profile);
  const isSelf =
    session &&
    session.user &&
    String(session.user.id) === String(userId);

  if (nameElement) {
    nameElement.textContent = name;
  }

  if (metaElement) {
    metaElement.textContent =
      email || (profile ? "TANIDIK member" : "Public member profile");
  }

  if (avatarElement) {
    avatarElement.innerHTML = "";

    if (avatar) {
      const image = document.createElement("img");
      image.src = getImage(avatar);
      image.alt = name;
      image.loading = "lazy";
      image.addEventListener(
        "error",
        () => {
          image.remove();
          avatarElement.textContent =
            name.charAt(0).toUpperCase() || "U";
        },
        { once: true }
      );
      avatarElement.appendChild(image);
    } else {
      avatarElement.textContent =
        name.charAt(0).toUpperCase() || "U";
    }
  }

  if (messageButton) {
    messageButton.dataset.targetUserId = userId || "";
    messageButton.disabled =
      !userId || !isValidUuid(userId) || Boolean(isSelf);
    messageButton.textContent = isSelf ? "This is you" : "Message";
  }

  if (isSelf) {
    setPublicUserMessageError("This is you.");
  }
}

async function loadPublicUserProfile(userId) {
  const messageButton =
    document.getElementById("publicUserMessageBtn");

  if (!userId || !isValidUuid(userId)) {
    renderPublicUserProfile(null, "", null);

    if (messageButton) {
      messageButton.disabled = true;
    }

    setPublicUserMessageError("Could not start conversation. Please try again.");
    showToast("User profile not found");
    return null;
  }

  const session = await getSafeSession();
  const profile = await loadProfileRecordByUserId(userId);

  setPublicUserMessageError("");
  renderPublicUserProfile(profile, userId, session);
  return profile;
}

function setupPublicUserProfile() {
  const page = document.querySelector(".public-user-page");
  const messageButton =
    document.getElementById("publicUserMessageBtn");

  if (!page || !messageButton) return;

  const userId = getUserIdFromUrl();

  messageButton.addEventListener("click", async () => {
    const targetUserId = messageButton.dataset.targetUserId || userId;

    setPublicUserMessageError("");

    if (!targetUserId || messageButton.disabled) return;

    if (!isValidUuid(targetUserId)) {
      setPublicUserMessageError(
        "Could not start conversation. Please try again."
      );
      return;
    }

    const session = await getSafeSession();

    if (!session) {
      window.location.href = "./auth.html";
      return;
    }

    if (String(session.user.id) === String(targetUserId)) {
      showToast("This is your profile");
      setPublicUserMessageError("This is you.");
      messageButton.disabled = true;
      messageButton.textContent = "This is you";
      return;
    }

    messageButton.disabled = true;

    try {
      const opened = await openDirectConversation(targetUserId);

      if (!opened) {
        setPublicUserMessageError(
          "Could not start conversation. Please try again."
        );
        messageButton.disabled = false;
      }
    } catch (error) {
      console.warn("Direct conversation could not be opened.", error);
      setPublicUserMessageError(
        "Could not start conversation. Please try again."
      );
      messageButton.disabled = false;
    }
  });

  loadPublicUserProfile(userId);
}

function getConversationPreview(messages) {
  const lastMessage = (messages || [])
    .slice()
    .reverse()
    .find((message) => safeText(message.body).trim());

  if (!lastMessage) return "";

  const body = safeText(lastMessage.body).trim();

  return body.length > 96
    ? `${body.slice(0, 96).trim()}...`
    : body;
}

function formatConversationReservationDateTime(reservation) {
  if (!reservation) return "";

  const date = safeText(reservation.reservation_date);
  const time = safeText(reservation.reservation_time);

  if (date && time) return `${date} at ${time}`;
  if (date) return date;
  if (time) return time;

  return "";
}

function renderConversationContextHeader(context = {}) {
  const header = document.getElementById("conversationContextHeader");

  if (!header) return;

  const conversation = context.conversation || {};
  const venue = context.venue || {};
  const reservation = context.reservation || {};
  const venueId = conversation.venue_id || venue.id;
  const venueName = safeText(venue.name) || "Conversation";
  const venueImage = safeText(venue.image);
  const reservationDateTime =
    formatConversationReservationDateTime(reservation);
  const partySize = Number(reservation.party_size) || 0;
  const status = safeText(reservation.status);

  header.innerHTML = "";
  header.classList.toggle("has-image", Boolean(venueImage));

  if (venueImage) {
    const image = document.createElement("img");
    image.src = getImage(venueImage);
    image.alt = venueName;
    image.loading = "lazy";
    image.addEventListener(
      "error",
      () => {
        image.remove();
        header.classList.remove("has-image");
      },
      { once: true }
    );
    header.appendChild(image);
  }

  const body = document.createElement("div");
  body.className = "conversation-context-body";

  const topRow = document.createElement("div");
  topRow.className = "conversation-context-top";

  const title = document.createElement("strong");
  title.textContent = venueName;
  topRow.appendChild(title);

  if (status) {
    topRow.appendChild(createStatusBadge(status));
  }

  body.appendChild(topRow);

  const metaParts = [];

  if (reservationDateTime) {
    metaParts.push(reservationDateTime);
  }

  if (partySize > 0) {
    metaParts.push(`${partySize} ${partySize === 1 ? "guest" : "guests"}`);
  }

  if (metaParts.length > 0) {
    const meta = document.createElement("span");
    meta.className = "conversation-context-meta";
    meta.textContent = metaParts.join(" - ");
    body.appendChild(meta);
  }

  if (venueId) {
    const link = document.createElement("a");
    link.className = "conversation-context-link";
    link.href = `./venue.html?id=${encodeURIComponent(venueId)}`;
    link.textContent = "View venue";
    body.appendChild(link);
  }

  header.appendChild(body);
}

async function loadConversationContextDetails(conversation) {
  const context = {
    conversation: conversation || {},
    venue: null,
    reservation: null,
  };

  if (!conversation) return context;

  if (conversation.venue_id) {
    try {
      const { data, error } = await supabaseClient
        .from("venues")
        .select("id, name, image")
        .eq("id", conversation.venue_id)
        .maybeSingle();

      if (error) {
        console.warn("Conversation venue context unavailable.", error);
      } else {
        context.venue = data;
      }
    } catch (error) {
      console.warn("Conversation venue context unavailable.", error);
    }
  }

  if (conversation.reservation_id) {
    try {
      const { data, error } = await supabaseClient
        .from("reservations")
        .select("id, reservation_date, reservation_time, status, party_size")
        .eq("id", conversation.reservation_id)
        .maybeSingle();

      if (error) {
        console.warn(
          "Conversation reservation context unavailable.",
          error
        );
      } else {
        context.reservation = data;
      }
    } catch (error) {
      console.warn("Conversation reservation context unavailable.", error);
    }
  }

  return context;
}

async function updateConversationContextHeader(conversation) {
  renderConversationContextHeader({ conversation });

  try {
    const context = await loadConversationContextDetails(conversation);
    renderConversationContextHeader(context);
  } catch (error) {
    console.warn("Conversation context header unavailable.", error);
  }
}

function resetConversationContextHeader() {
  renderConversationContextHeader();
}

function updateConversationHeader(conversation, userId) {
  const header = document.getElementById("conversationHeader");

  if (!header) return;

  header.innerHTML = "";

  const kicker = document.createElement("span");
  kicker.className = "messages-kicker";
  kicker.textContent = getConversationRoleLabel(
    conversation,
    userId
  ) || "Reservation Thread";
  header.appendChild(kicker);

  const title = document.createElement("h2");
  title.textContent = getConversationTitle(conversation);
  header.appendChild(title);

  const subtitle = getConversationSubtitle(conversation);

  if (subtitle) {
    const paragraph = document.createElement("p");
    paragraph.textContent = subtitle;
    header.appendChild(paragraph);
  }
}

function resetConversationHeader() {
  const header = document.getElementById("conversationHeader");

  if (!header) return;

  header.innerHTML = "";

  const kicker = document.createElement("span");
  kicker.className = "messages-kicker";
  kicker.textContent = "Message Thread";
  header.appendChild(kicker);

  const title = document.createElement("h2");
  title.textContent = "Conversation";
  header.appendChild(title);

  const paragraph = document.createElement("p");
  paragraph.textContent =
    "Choose a direct message or reservation conversation from your inbox.";
  header.appendChild(paragraph);
}

function updateMessageThreadUnreadBadge(
  conversationId,
  unreadCount
) {
  const thread = [
    ...document.querySelectorAll(".message-thread"),
  ].find((item) => {
    const href = item.getAttribute("href");

    return (
      String(getConversationIdFromNotificationLink(href)) ===
      String(conversationId)
    );
  });

  if (!thread) return;

  const badge = thread.querySelector(".message-unread-badge");

  if (unreadCount > 0) {
    thread.classList.add("unread");

    if (badge) {
      badge.textContent =
        unreadCount > 9 ? "9+" : String(unreadCount);
    } else {
      const topRow = thread.querySelector(".message-thread-top");

      if (topRow) {
        const newBadge = document.createElement("span");
        newBadge.className = "message-unread-badge";
        newBadge.textContent =
          unreadCount > 9 ? "9+" : String(unreadCount);
        topRow.appendChild(newBadge);
      }
    }

    return;
  }

  thread.classList.remove("unread");

  if (badge) {
    badge.remove();
  }
}

function setMessageFormEnabled(isEnabled) {
  const form = document.getElementById("messageForm");
  const bodyInput = document.getElementById("messageBody");
  const button = form
    ? form.querySelector("button[type='submit']")
    : null;

  if (bodyInput) {
    bodyInput.disabled = !isEnabled;
  }

  if (button) {
    button.disabled = !isEnabled;
  }
}

function updateMessageComposerForConversation(conversation) {
  const bodyInput = document.getElementById("messageBody");

  if (!bodyInput) return;

  bodyInput.placeholder = isDirectConversation(conversation)
    ? "Write a message..."
    : "Write a reservation message...";
}

async function openReservationConversation(reservationId) {
  if (!reservationId) {
    showToast("Reservation not found");
    return;
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "./auth.html";
    return;
  }

  let data = null;
  let error = null;

  try {
    ({ data, error } = await supabaseClient.rpc(
      "get_or_create_reservation_conversation",
      {
        p_reservation_id: reservationId,
      }
    ));
  } catch (rpcError) {
    error = rpcError;
  }

  if (error) {
    console.log(error);
    showToast(error.message || "Conversation unavailable");
    return;
  }

  const conversationId = getConversationIdFromRpcResult(data);

  if (!conversationId) {
    showToast("Conversation unavailable");
    return;
  }

  window.location.href =
    `./messages.html?conversation=${encodeURIComponent(
      conversationId
    )}`;
}

async function loadMessageInbox() {
  const list = document.getElementById("messagesList");

  if (!list) return [];

  renderEmptyState(list, "Loading messages...");

  const { data, error } =
    await supabaseClient
      .from("message_conversations")
      .select("*")
      .order("updated_at", { ascending: false });

  if (error) {
    console.log(error);
    renderEmptyState(
      list,
      "Messages unavailable",
      "You may not have access to these conversations."
    );
    return [];
  }

  const conversations = data || [];
  await hydrateDirectConversationProfiles(conversations);
  await hydrateConversationPreviews(conversations);
  renderMessageInbox(conversations);
  return conversations;
}

async function hydrateConversationPreviews(conversations) {
  if (!conversations || conversations.length === 0) return;

  const conversationIds = conversations
    .map((conversation) => conversation.id)
    .filter(Boolean);

  if (conversationIds.length === 0) return;

  const { data, error } =
    await supabaseClient
      .from("messages")
      .select("conversation_id, body, created_at, sender_id")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

  if (error) {
    console.log(error);
    return;
  }

  const previewsById = {};
  const previewTimesById = {};
  const previewSenderById = {};

  (data || []).forEach((message) => {
    const conversationId = String(message.conversation_id);

    if (previewsById[conversationId]) return;

    previewsById[conversationId] = safeText(message.body);
    previewTimesById[conversationId] = message.created_at || "";
    previewSenderById[conversationId] = message.sender_id || "";
  });

  conversations.forEach((conversation) => {
    conversation.last_message_preview =
      previewsById[String(conversation.id)] || "";
    conversation.last_message_at =
      previewTimesById[String(conversation.id)] || "";
    conversation.last_message_sender_id =
      previewSenderById[String(conversation.id)] || "";
  });
}

function renderMessageInbox(conversations) {
  const list = document.getElementById("messagesList");

  if (!list) return;

  list.innerHTML = "";

  if (!conversations || conversations.length === 0) {
    renderEmptyState(
      list,
      "No messages yet",
      "Direct messages and reservation conversations will appear here."
    );
    return;
  }

  const activeConversationId = getConversationIdFromUrl();
  const fragment = document.createDocumentFragment();

  conversations.forEach((conversation) => {
    const unreadCount =
      messageUnreadCountsByConversationId[
        String(conversation.id)
      ] || 0;
    const link = document.createElement("a");
    link.href = `./messages.html?conversation=${encodeURIComponent(
      conversation.id
    )}`;
    link.className =
      String(conversation.id) === String(activeConversationId)
        ? "message-thread active"
        : "message-thread";

    if (unreadCount > 0) {
      link.classList.add("unread");
    }

    const topRow = document.createElement("div");
    topRow.className = "message-thread-top";

    const title = document.createElement("strong");
    title.textContent = getConversationTitle(conversation);
    topRow.appendChild(title);

    if (conversation.last_message_at) {
      const time = document.createElement("time");
      time.className = "message-thread-time";
      time.dateTime = conversation.last_message_at;
      time.textContent = formatNotificationDate(
        conversation.last_message_at
      );
      topRow.appendChild(time);
    }

    if (unreadCount > 0) {
      const badge = document.createElement("span");
      badge.className = "message-unread-badge";
      badge.textContent =
        unreadCount > 9 ? "9+" : String(unreadCount);
      topRow.appendChild(badge);
    }

    link.appendChild(topRow);

    const subtitle = getConversationSubtitle(conversation);

    if (subtitle) {
      const meta = document.createElement("span");
      meta.className = "message-thread-meta";
      meta.textContent = subtitle;
      link.appendChild(meta);
    }

    if (conversation.last_message_preview) {
      const preview = document.createElement("p");
      preview.className = "message-thread-preview";
      const isOwnPreview =
        conversation.last_message_sender_id &&
        String(conversation.last_message_sender_id) ===
          String(messageSessionUserId || "");
      preview.textContent = isOwnPreview
        ? `You: ${conversation.last_message_preview}`
        : conversation.last_message_preview;
      link.appendChild(preview);
    }

    fragment.appendChild(link);
  });

  list.appendChild(fragment);
}

async function loadConversation(conversationId) {
  const panel = document.getElementById("conversationPanel");
  const messagesContainer =
    document.getElementById("conversationMessages");

  if (!panel || !messagesContainer) return null;

  if (!conversationId) {
    setMessageFormEnabled(false);
    updateMessageComposerForConversation(null);
    stopConversationTypingPoll();
    resetConversationHeader();
    resetConversationContextHeader();
    renderEmptyState(
      messagesContainer,
      "Choose a conversation",
      "Open a direct message or reservation conversation from your inbox."
    );
    return null;
  }

  renderEmptyState(messagesContainer, "Loading conversation...");

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    setMessageFormEnabled(false);
    window.location.href = "./auth.html";
    return null;
  }

  messageSessionUserId = session.user.id;

  const { data: conversation, error: conversationError } =
    await supabaseClient
      .from("message_conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();

  if (conversationError || !conversation) {
    if (conversationError) {
      console.log(conversationError);
    }

    renderEmptyState(
      messagesContainer,
      "Conversation unavailable",
      "This conversation does not exist or you do not have access."
    );
    resetConversationHeader();
    resetConversationContextHeader();
    setMessageFormEnabled(false);
    stopConversationTypingPoll();
    return null;
  }

  await hydrateDirectConversationProfile(conversation);
  setMessageFormEnabled(true);
  updateMessageComposerForConversation(conversation);
  updateConversationHeader(conversation, session.user.id);
  panel.dataset.conversationId = conversation.id;
  panel.dataset.userId = conversation.user_id || "";
  panel.dataset.businessOwnerId =
    conversation.business_owner_id || "";
  updateConversationContextHeader(conversation);

  const { data: messages, error: messagesError } =
    await supabaseClient
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

  if (messagesError) {
    console.log(messagesError);
    renderEmptyState(
      messagesContainer,
      "Messages unavailable",
      "Messages could not be loaded."
    );
    return conversation;
  }

  await markConversationNotificationsRead(
    session.user.id,
    conversation.id
  );
  await markConversationReadState(session.user.id, conversation.id);
  messageUnreadCountsByConversationId[
    String(conversation.id)
  ] = 0;
  updateMessageThreadUnreadBadge(conversation.id, 0);
  updateMessagesBottomNavUnread(getTotalUnreadMessageCount());
  const attachmentsByMessageId =
    await loadMessageAttachments(conversation.id);
  const readStates =
    await loadConversationReadStates(conversation.id);

  renderConversationMessages(
    messages || [],
    session.user.id,
    conversation,
    attachmentsByMessageId,
    readStates
  );
  setupMessageForm(conversation.id);
  startConversationTypingPoll(conversation.id, session.user.id);
  return conversation;
}

function renderConversationMessages(
  messages,
  sessionUserId,
  conversation,
  attachmentsByMessageId = {},
  readStates = []
) {
  const messagesContainer =
    document.getElementById("conversationMessages");

  if (!messagesContainer) return;

  messagesContainer.innerHTML = "";

  if (!messages || messages.length === 0) {
    renderEmptyState(
      messagesContainer,
      "No messages yet",
      isDirectConversation(conversation)
        ? "Send the first message."
        : "Send the first reservation message."
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  const lastOwnMessage = [...messages]
    .reverse()
    .find(
      (message) =>
        String(message.sender_id) === String(sessionUserId)
    );
  let previousSenderId = "";

  messages.forEach((message) => {
    const bubble = document.createElement("div");
    const isOwnMessage =
      String(message.sender_id) === String(sessionUserId);
    const isGrouped =
      previousSenderId &&
      String(previousSenderId) === String(message.sender_id);
    bubble.className =
      isOwnMessage
        ? "message-bubble message-bubble--own"
        : "message-bubble";

    if (isGrouped) {
      bubble.classList.add("message-bubble--grouped");
    }

    if (!isGrouped) {
      const sender = document.createElement("strong");
      sender.className = "message-sender-label";
      sender.textContent = getMessageSenderLabel(
        message,
        conversation,
        sessionUserId
      );
      bubble.appendChild(sender);
    }

    if (safeText(message.body)) {
      const body = document.createElement("p");
      body.textContent = safeText(message.body);
      bubble.appendChild(body);
    }

    renderMessageAttachments(
      bubble,
      attachmentsByMessageId[String(message.id)] || []
    );

    const actions = document.createElement("div");
    actions.className = "message-actions";

    if (safeText(message.body)) {
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "message-action-btn";
      copyButton.textContent = "Copy";
      copyButton.addEventListener("click", () => {
        copyMessageText(message.body);
      });
      actions.appendChild(copyButton);
    }

    if (actions.children.length > 0) {
      bubble.appendChild(actions);
    }

    const meta = document.createElement("span");
    meta.className = "message-meta";
    const hasBeenRead =
      lastOwnMessage &&
      String(lastOwnMessage.id) === String(message.id) &&
      hasRecipientReadMessage(message, readStates, sessionUserId);
    meta.textContent = hasBeenRead
      ? `${formatNotificationDate(message.created_at)} - Seen`
      : formatNotificationDate(message.created_at);
    bubble.appendChild(meta);

    fragment.appendChild(bubble);
    previousSenderId = message.sender_id;
  });

  messagesContainer.appendChild(fragment);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function copyMessageText(text) {
  const value = safeText(text);

  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    showToast("Message copied");
  } catch (error) {
    console.warn("Message copy unavailable.", error);
    showToast("Copy unavailable");
  }
}

function setupMessageForm(conversationId) {
  const form = document.getElementById("messageForm");

  if (!form) {
    return;
  }

  form.dataset.conversationId = String(conversationId || "");

  const bodyInput = document.getElementById("messageBody");

  if (
    bodyInput &&
    bodyInput.dataset.typingBound !== "true"
  ) {
    bodyInput.dataset.typingBound = "true";
    bodyInput.addEventListener("input", () => {
      const activeConversationId = form.dataset.conversationId;

      if (!activeConversationId || !messageSessionUserId) return;

      if (messageTypingUpdateTimer) {
        window.clearTimeout(messageTypingUpdateTimer);
      }

      messageTypingUpdateTimer = window.setTimeout(() => {
        updateConversationTypingState(
          activeConversationId,
          messageSessionUserId,
          Boolean(bodyInput.value.trim())
        );
      }, 250);

      if (messageTypingClearTimer) {
        window.clearTimeout(messageTypingClearTimer);
      }

      messageTypingClearTimer = window.setTimeout(() => {
        updateConversationTypingState(
          activeConversationId,
          messageSessionUserId,
          false
        );
      }, 3500);
    });
  }

  if (form.dataset.bound === "true") {
    return;
  }

  form.dataset.bound = "true";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (form.dataset.submitting === "true") {
      return;
    }

    const bodyInput = document.getElementById("messageBody");
    const attachmentFile = getAdminFile("messageAttachmentImage");
    const body = bodyInput ? bodyInput.value.trim() : "";

    if (!body && !attachmentFile) {
      showToast("Write a message or attach an image");
      return;
    }

    form.dataset.submitting = "true";

    try {
      const sent =
        await sendConversationMessage(
          form.dataset.conversationId,
          body,
          attachmentFile
        );

      if (sent && bodyInput) {
        bodyInput.value = "";
      }

      if (sent) {
        updateConversationTypingState(
          form.dataset.conversationId,
          messageSessionUserId,
          false
        );
        clearAdminFile("messageAttachmentImage");
      }
    } catch (error) {
      console.log(error);
      showToast(error.message || "Message could not be sent");
    } finally {
      form.dataset.submitting = "false";
    }
  });
}

async function notifyMessageRecipient(conversation, senderId) {
  if (!conversation || typeof createNotification !== "function") {
    return;
  }

  const recipientId =
    String(senderId) === String(conversation.user_id)
      ? conversation.business_owner_id
      : conversation.user_id;

  if (!recipientId || String(recipientId) === String(senderId)) {
    return;
  }

  try {
    await createNotification(
      recipientId,
      "message_new",
      isDirectConversation(conversation)
        ? "New direct message"
        : "New reservation message",
      getConversationTitle(conversation),
      `./messages.html?conversation=${conversation.id}`
    );
  } catch (error) {
    console.log(error);
  }
}

async function notifyMessageRecipientByEmail(messageId) {
  if (!messageId || !supabaseClient.functions) return;

  try {
    const { error } = await supabaseClient.functions.invoke(
      "send-message-email-notification",
      {
        body: {
          message_id: messageId,
        },
      }
    );

    if (error) {
      console.warn("Message email notification unavailable.", error);
    }
  } catch (error) {
    console.warn("Message email notification unavailable.", error);
  }
}

async function sendConversationMessage(
  conversationId,
  body,
  attachmentFile = null
) {
  if (!conversationId) {
    showToast("Choose a conversation");
    return false;
  }

  if ((!body || !body.trim()) && !attachmentFile) {
    showToast("Write a message or attach an image");
    return false;
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "./auth.html";
    return false;
  }

  const { data: conversation, error: conversationError } =
    await supabaseClient
      .from("message_conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();

  if (conversationError || !conversation) {
    if (conversationError) {
      console.log(conversationError);
    }
    showToast("Conversation unavailable");
    return false;
  }

  await hydrateDirectConversationProfile(conversation);

  const messageBody =
    body && body.trim() ? body.trim() : "Image attachment";

  const { data: insertedMessage, error } =
    await supabaseClient
      .from("messages")
      .insert([
        {
          conversation_id: conversation.id,
          sender_id: session.user.id,
          body: messageBody,
        },
      ])
      .select("id")
      .maybeSingle();

  if (error) {
    showSafeError(error, "Message could not be sent.");
    return false;
  }

  let messageId = insertedMessage ? insertedMessage.id : "";

  if (attachmentFile) {
    if (messageId) {
      await saveMessageAttachment({
        messageId,
        conversationId: conversation.id,
        senderId: session.user.id,
        file: attachmentFile,
      });
    } else {
      console.warn(
        "Message attachment skipped because message id was unavailable."
      );
    }
  }

  await notifyMessageRecipient(conversation, session.user.id);
  notifyMessageRecipientByEmail(messageId);
  await loadConversation(conversation.id);
  await loadMessageInbox();
  return true;
}

async function refreshMessagesPage() {
  const refreshButton =
    document.getElementById("messagesRefreshBtn");

  if (refreshButton) {
    refreshButton.disabled = true;
  }

  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session) {
      window.location.href = "./auth.html";
      return;
    }

    messageUnreadCountsByConversationId =
      await loadMessageUnreadCounts(session.user.id);
    updateMessagesBottomNavUnread(getTotalUnreadMessageCount());
    await loadMessageInbox();
    await loadConversation(getConversationIdFromUrl());
  } catch (error) {
    console.log(error);
    showToast(error.message || "Messages could not refresh");
  } finally {
    if (refreshButton) {
      refreshButton.disabled = false;
    }
  }
}

function setupMessagesRefreshButton() {
  const refreshButton =
    document.getElementById("messagesRefreshBtn");

  if (!refreshButton || refreshButton.dataset.bound === "true") {
    return;
  }

  refreshButton.dataset.bound = "true";
  refreshButton.addEventListener("click", refreshMessagesPage);
}

function setupUserSearchForMessages() {
  const button = document.getElementById("newMessageBtn");
  const panel = document.getElementById("userSearchPanel");
  const input = document.getElementById("userSearchInput");
  const results = document.getElementById("userSearchResults");

  if (!button || !panel || !input || !results) return;

  if (button.dataset.bound === "true") return;

  button.dataset.bound = "true";

  let searchTimer = null;
  let searchRequestId = 0;

  const setPanelOpen = (isOpen) => {
    panel.hidden = !isOpen;
    button.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      input.focus();
    }
  };

  button.addEventListener("click", () => {
    setPanelOpen(panel.hidden);
  });

  input.addEventListener("input", () => {
    const query = input.value.trim();
    searchRequestId += 1;
    const requestId = searchRequestId;

    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    if (query.length < 3) {
      results.innerHTML = "";
      results.appendChild(
        createUserSearchStatus("Type at least 3 characters.")
      );
      return;
    }

    results.innerHTML = "";
    results.appendChild(createUserSearchStatus("Searching..."));

    searchTimer = setTimeout(async () => {
      try {
        const users = await searchUsersForDirectMessage(query);

        if (requestId !== searchRequestId) return;

        renderUserSearchResults(users);
      } catch (error) {
        if (requestId !== searchRequestId) return;

        console.warn("Could not search users.", error);
        results.innerHTML = "";
        results.appendChild(
          createUserSearchStatus("Could not search users.")
        );
      }
    }, 250);
  });
}

async function setupMessagesPage() {
  const messagesList = document.getElementById("messagesList");
  const conversationPanel =
    document.getElementById("conversationPanel");

  if (!messagesList || !conversationPanel) return;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "./auth.html";
    return;
  }

  messageSessionUserId = session.user.id;
  setupMessagesRefreshButton();
  setupUserSearchForMessages();
  await checkMessageAttachmentsTable();
  messageUnreadCountsByConversationId =
    await loadMessageUnreadCounts(session.user.id);
  updateMessagesBottomNavUnread(getTotalUnreadMessageCount());
  await loadMessageInbox();
  await loadConversation(getConversationIdFromUrl());
}

function setBusinessBookingStatus(message, type = "info") {
  const status =
    document.getElementById("businessBookingSettingsStatus");

  if (!status) return;

  status.textContent = message || "";
  status.dataset.status = type;
  status.style.display = message ? "" : "none";
}

function getSelectedBusinessBookingVenueId() {
  const select =
    document.getElementById("businessBookingVenueSelect");

  if (select && ownsVenueRecord(select.value)) {
    return select.value;
  }

  const firstVenue = businessDashboardState.venues[0];
  return firstVenue ? String(firstVenue.id) : "";
}

function updateBusinessBookingVenueOptions() {
  const select =
    document.getElementById("businessBookingVenueSelect");

  if (!select) return;

  const selectedValue = select.value;
  select.innerHTML = '<option value="">Choose Venue</option>';

  businessDashboardState.venues.forEach((venue) => {
    const option = document.createElement("option");
    option.value = venue.id;
    option.textContent = safeText(venue.name) || `Venue #${venue.id}`;
    select.appendChild(option);
  });

  if (ownsVenueRecord(selectedValue)) {
    select.value = selectedValue;
  } else if (businessDashboardState.venues[0]) {
    select.value = businessDashboardState.venues[0].id;
  }
}

function setBookingTimeInputsDisabled(row, isDisabled) {
  row
    .querySelectorAll("[data-booking-opens], [data-booking-closes]")
    .forEach((input) => {
      input.disabled = isDisabled;
    });
}

function renderBusinessOperatingHourRows(hours) {
  const container =
    document.getElementById("businessOperatingHoursRows");

  if (!container) return;

  const hoursByDay = new Map(
    (hours || []).map((row) => [
      Number(row.day_of_week),
      row,
    ])
  );

  container.innerHTML = "";

  BOOKING_WEEKDAYS.forEach((dayName, index) => {
    const rowData = hoursByDay.get(index) || {};
    const row = document.createElement("div");
    row.className = "booking-hours-row";
    row.dataset.dayOfWeek = String(index);

    const day = document.createElement("strong");
    day.textContent = dayName;
    row.appendChild(day);

    const closedLabel = document.createElement("label");
    closedLabel.className = "booking-toggle-field booking-hours-closed";

    const closedInput = document.createElement("input");
    closedInput.type = "checkbox";
    closedInput.dataset.bookingClosed = "true";
    closedInput.checked = Boolean(rowData.is_closed);
    closedLabel.appendChild(closedInput);
    closedLabel.append("Closed");
    row.appendChild(closedLabel);

    const opensLabel = document.createElement("label");
    opensLabel.textContent = "Opens";
    const opensInput = document.createElement("input");
    opensInput.type = "time";
    opensInput.dataset.bookingOpens = "true";
    opensInput.value = rowData.opens_at
      ? String(rowData.opens_at).slice(0, 5)
      : "18:00";
    opensLabel.appendChild(opensInput);
    row.appendChild(opensLabel);

    const closesLabel = document.createElement("label");
    closesLabel.textContent = "Closes";
    const closesInput = document.createElement("input");
    closesInput.type = "time";
    closesInput.dataset.bookingCloses = "true";
    closesInput.value = rowData.closes_at
      ? String(rowData.closes_at).slice(0, 5)
      : "23:00";
    closesLabel.appendChild(closesInput);
    row.appendChild(closesLabel);

    setBookingTimeInputsDisabled(row, closedInput.checked);
    closedInput.addEventListener("change", () => {
      setBookingTimeInputsDisabled(row, closedInput.checked);
    });

    container.appendChild(row);
  });
}

function renderBusinessBookingRules(rule) {
  setAdminValue(
    "businessSlotMinutes",
    rule && rule.slot_minutes ? rule.slot_minutes : 60
  );
  setAdminValue(
    "businessMaxReservationsPerSlot",
    rule && rule.max_reservations_per_slot
      ? rule.max_reservations_per_slot
      : 10
  );
  setAdminValue(
    "businessMaxGuestsPerSlot",
    rule && rule.max_guests_per_slot
      ? rule.max_guests_per_slot
      : ""
  );
  setAdminValue(
    "businessMinNoticeMinutes",
    rule && Number.isFinite(Number(rule.min_notice_minutes))
      ? rule.min_notice_minutes
      : 60
  );

  const allowMultiple =
    document.getElementById("businessAllowMultipleReservations");
  const autoApprove =
    document.getElementById("businessAutoApprove");

  if (allowMultiple) {
    allowMultiple.checked =
      rule && typeof rule.allow_multiple_reservations === "boolean"
        ? rule.allow_multiple_reservations
        : true;
  }

  if (autoApprove) {
    autoApprove.checked = Boolean(rule && rule.auto_approve);
  }
}

function renderBusinessBlackoutDates(rows) {
  const container =
    document.getElementById("businessBlackoutDatesList");

  if (!container) return;

  container.innerHTML = "";

  if (!rows || !rows.length) {
    const empty = document.createElement("p");
    empty.className = "booking-empty-note";
    empty.textContent = "No blackout dates yet.";
    container.appendChild(empty);
    return;
  }

  rows.forEach((blackout) => {
    const item = document.createElement("div");
    item.className = "booking-blackout-item";

    const content = document.createElement("div");
    const date = document.createElement("strong");
    date.textContent = safeText(blackout.blackout_date);
    content.appendChild(date);

    if (blackout.reason) {
      const reason = document.createElement("p");
      reason.textContent = blackout.reason;
      content.appendChild(reason);
    }

    item.appendChild(content);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-delete-btn";
    button.textContent = "Delete";
    button.addEventListener("click", () => {
      deleteBusinessBlackoutDate(blackout.id);
    });
    item.appendChild(button);

    container.appendChild(item);
  });
}

function getBusinessOperatingHourPayloads(venueId) {
  return Array.from(
    document.querySelectorAll(".booking-hours-row")
  ).map((row) => {
    const isClosed = Boolean(
      row.querySelector("[data-booking-closed]")?.checked
    );
    const opensAt =
      row.querySelector("[data-booking-opens]")?.value || null;
    const closesAt =
      row.querySelector("[data-booking-closes]")?.value || null;

    return {
      venue_id: Number(venueId),
      day_of_week: Number(row.dataset.dayOfWeek),
      opens_at: isClosed ? null : opensAt,
      closes_at: isClosed ? null : closesAt,
      is_closed: isClosed,
    };
  });
}

function getBusinessBookingRulePayload(venueId) {
  const maxGuests = Number(
    getAdminValue("businessMaxGuestsPerSlot")
  );
  const allowMultiple =
    document.getElementById("businessAllowMultipleReservations");
  const autoApprove =
    document.getElementById("businessAutoApprove");

  return {
    venue_id: Number(venueId),
    slot_minutes:
      Number(getAdminValue("businessSlotMinutes")) || 60,
    max_reservations_per_slot:
      Number(getAdminValue("businessMaxReservationsPerSlot")) || 10,
    max_guests_per_slot: maxGuests > 0 ? maxGuests : null,
    allow_multiple_reservations: allowMultiple
      ? allowMultiple.checked
      : true,
    auto_approve: autoApprove ? autoApprove.checked : false,
    min_notice_minutes:
      Number(getAdminValue("businessMinNoticeMinutes")) || 0,
  };
}

async function loadBusinessBookingSettings() {
  const panel =
    document.querySelector(".dashboard-section--booking-settings");

  if (!panel) return;

  const venueId = getSelectedBusinessBookingVenueId();

  if (!venueId || !ownsVenueRecord(venueId)) {
    renderBusinessOperatingHourRows([]);
    renderBusinessBookingRules(null);
    renderBusinessBlackoutDates([]);
    setBusinessBookingStatus(
      "Create an owned venue before editing booking settings."
    );
    return;
  }

  setBusinessBookingStatus("");

  try {
    const [hoursResult, rulesResult, blackoutResult] =
      await Promise.all([
        supabaseClient
          .from("venue_operating_hours")
          .select("*")
          .eq("venue_id", venueId)
          .order("day_of_week", { ascending: true }),
        supabaseClient
          .from("venue_booking_rules")
          .select("*")
          .eq("venue_id", venueId)
          .maybeSingle(),
        supabaseClient
          .from("venue_blackout_dates")
          .select("*")
          .eq("venue_id", venueId)
          .order("blackout_date", { ascending: true }),
      ]);

    if (hoursResult.error) throw hoursResult.error;
    if (rulesResult.error) throw rulesResult.error;
    if (blackoutResult.error) throw blackoutResult.error;

    renderBusinessOperatingHourRows(hoursResult.data || []);
    renderBusinessBookingRules(rulesResult.data || null);
    renderBusinessBlackoutDates(blackoutResult.data || []);
  } catch (error) {
    console.warn("Booking settings could not be loaded.", error);
    setBusinessBookingStatus(
      "Booking settings could not be loaded.",
      "error"
    );
  }
}

async function saveBusinessBookingSettings(event) {
  event.preventDefault();

  const venueId = getSelectedBusinessBookingVenueId();

  if (!venueId || !ownsVenueRecord(venueId)) {
    setBusinessBookingStatus(
      "Choose an owned venue before saving.",
      "error"
    );
    return;
  }

  const hoursPayload = getBusinessOperatingHourPayloads(venueId);
  const rulesPayload = getBusinessBookingRulePayload(venueId);

  try {
    const hoursResult = await supabaseClient
      .from("venue_operating_hours")
      .upsert(hoursPayload, {
        onConflict: "venue_id,day_of_week",
      });

    if (hoursResult.error) throw hoursResult.error;

    const rulesResult = await supabaseClient
      .from("venue_booking_rules")
      .upsert(rulesPayload, {
        onConflict: "venue_id",
      });

    if (rulesResult.error) throw rulesResult.error;

    showToast("Booking settings saved.");
    await loadBusinessBookingSettings();
  } catch (error) {
    console.warn("Booking settings could not be saved.", error);
    setBusinessBookingStatus(
      "Booking settings could not be saved.",
      "error"
    );
  }
}

async function addBusinessBlackoutDate(event) {
  event.preventDefault();

  const venueId = getSelectedBusinessBookingVenueId();
  const blackoutDate = getAdminValue("businessBlackoutDate");
  const reason = getAdminValue("businessBlackoutReason");

  if (!venueId || !ownsVenueRecord(venueId) || !blackoutDate) {
    setBusinessBookingStatus(
      "Choose a venue and date before adding a blackout.",
      "error"
    );
    return;
  }

  try {
    const result = await supabaseClient
      .from("venue_blackout_dates")
      .insert({
        venue_id: Number(venueId),
        blackout_date: blackoutDate,
        reason: reason || null,
      });

    if (result.error) throw result.error;

    setAdminValue("businessBlackoutDate", "");
    setAdminValue("businessBlackoutReason", "");
    showToast("Blackout date added.");
    await loadBusinessBookingSettings();
  } catch (error) {
    console.warn("Blackout date could not be added.", error);
    setBusinessBookingStatus(
      "Blackout date could not be added.",
      "error"
    );
  }
}

async function deleteBusinessBlackoutDate(blackoutId) {
  if (!blackoutId) return;

  try {
    const result = await supabaseClient
      .from("venue_blackout_dates")
      .delete()
      .eq("id", blackoutId);

    if (result.error) throw result.error;

    showToast("Blackout date deleted.");
    await loadBusinessBookingSettings();
  } catch (error) {
    console.warn("Blackout date could not be deleted.", error);
    setBusinessBookingStatus(
      "Blackout date could not be deleted.",
      "error"
    );
  }
}

function setupBusinessBookingSettings() {
  const venueSelect =
    document.getElementById("businessBookingVenueSelect");
  const settingsForm =
    document.getElementById("businessBookingSettingsForm");
  const refreshButton =
    document.getElementById("businessBookingSettingsRefreshBtn");
  const blackoutForm =
    document.getElementById("businessBlackoutDateForm");

  if (venueSelect && venueSelect.dataset.bound !== "true") {
    venueSelect.dataset.bound = "true";
    venueSelect.addEventListener("change", () => {
      loadBusinessBookingSettings();
    });
  }

  if (settingsForm && settingsForm.dataset.bound !== "true") {
    settingsForm.dataset.bound = "true";
    settingsForm.addEventListener("submit", (event) => {
      runGuardedFormSubmit(event, saveBusinessBookingSettings);
    });
  }

  if (refreshButton && refreshButton.dataset.bound !== "true") {
    refreshButton.dataset.bound = "true";
    refreshButton.addEventListener("click", () => {
      loadBusinessBookingSettings();
    });
  }

  if (blackoutForm && blackoutForm.dataset.bound !== "true") {
    blackoutForm.dataset.bound = "true";
    blackoutForm.addEventListener("submit", (event) => {
      runGuardedFormSubmit(event, addBusinessBlackoutDate);
    });
  }
}

function setupBusinessForms() {
  setupBusinessVenueGalleryUpload();
  setupBusinessProductGalleryUpload();
  setupBusinessProductGalleryManager();

  const venueForm =
    document.getElementById("businessVenueForm");
  const eventForm =
    document.getElementById("businessEventForm");
  const venueClearButton =
    document.getElementById("businessVenueClearBtn");
  const eventClearButton =
    document.getElementById("businessEventClearBtn");

  if (venueForm) {
    venueForm.addEventListener("submit", (event) =>
      runGuardedFormSubmit(event, saveBusinessVenue)
    );
  }

  if (eventForm) {
    eventForm.addEventListener("submit", (event) =>
      runGuardedFormSubmit(event, saveBusinessEvent)
    );
  }

  if (venueClearButton) {
    venueClearButton.addEventListener(
      "click",
      clearBusinessVenueForm
    );
  }

  if (eventClearButton) {
    eventClearButton.addEventListener(
      "click",
      clearBusinessEventForm
    );
  }
}

function setupBusinessMenuManager() {
  const venueSelect =
    document.getElementById("businessMenuVenueSelect");
  const categoryForm =
    document.getElementById("businessMenuCategoryForm");
  const itemForm =
    document.getElementById("businessMenuItemForm");

  if (venueSelect && venueSelect.dataset.bound !== "true") {
    venueSelect.dataset.bound = "true";
    venueSelect.addEventListener("change", () => {
      resetBusinessMenuForms();
      refreshBusinessVenueMenu();
    });
  }

  if (categoryForm && categoryForm.dataset.bound !== "true") {
    categoryForm.dataset.bound = "true";
    categoryForm.addEventListener("submit", (event) => {
      runGuardedFormSubmit(event, createMenuCategory);
    });
  }

  if (itemForm && itemForm.dataset.bound !== "true") {
    itemForm.dataset.bound = "true";
    itemForm.addEventListener("submit", (event) => {
      runGuardedFormSubmit(event, createMenuItem);
    });
  }
}

function setupBusinessStoreManager() {
  const venueSelect =
    document.getElementById("businessStoreVenueSelect");
  const categoryForm =
    document.getElementById("businessProductCategoryForm");
  const productForm =
    document.getElementById("businessProductForm");
  const productCancelButton =
    document.getElementById("businessProductCancelEditBtn");

  if (venueSelect && venueSelect.dataset.bound !== "true") {
    venueSelect.dataset.bound = "true";
    venueSelect.addEventListener("change", () => {
      resetBusinessStoreForms();
      refreshBusinessVenueProducts();
    });
  }

  if (categoryForm && categoryForm.dataset.bound !== "true") {
    categoryForm.dataset.bound = "true";
    categoryForm.addEventListener("submit", (event) => {
      runGuardedFormSubmit(event, createProductCategory);
    });
  }

  if (productForm && productForm.dataset.bound !== "true") {
    productForm.dataset.bound = "true";
    productForm.addEventListener("submit", (event) => {
      runGuardedFormSubmit(event, createVenueProduct);
    });
  }

  if (
    productCancelButton &&
    productCancelButton.dataset.bound !== "true"
  ) {
    productCancelButton.dataset.bound = "true";
    productCancelButton.addEventListener("click", () => {
      resetBusinessStoreForms();
    });
  }
}

function setupBusinessMobilePanels() {
  const buttons =
    document.querySelectorAll("[data-business-panel]");
  const panels =
    document.querySelectorAll(".business-mobile-panel");

  if (!buttons.length || !panels.length) return;

  buttons.forEach((button) => {
    const panelName = button.dataset.businessPanel;
    const panel = document.querySelector(
      `.business-mobile-panel[data-panel="${panelName}"]`
    );

    if (panel && panel.classList.contains("is-open")) {
      button.classList.add("is-active");
      button.setAttribute("aria-expanded", "true");
    } else {
      button.setAttribute("aria-expanded", "false");
    }
  });

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const panelName = button.dataset.businessPanel;
      const panel = document.querySelector(
        `.business-mobile-panel[data-panel="${panelName}"]`
      );

      if (!panel) return;

      const shouldOpen =
        !panel.classList.contains("is-open");

      panels.forEach((item) => {
        item.classList.remove("is-open");
      });

      buttons.forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-expanded", "false");
      });

      if (shouldOpen) {
        panel.classList.add("is-open");
        button.classList.add("is-active");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });
}

async function initBusinessDashboard() {
  const businessPage =
    document.getElementById("businessPage");

  if (!businessPage) return;

  ensureBusinessAnalyticsSection();
  renderBusinessAnalytics(getEmptyBusinessAnalytics());

  const session = await getSafeSession();

  if (!session) {
    window.location.href = "./auth.html";
    return;
  }

  businessDashboardState.session = session;
  setupBusinessMobilePanels();
  setupBusinessForms();
  setupBusinessMenuManager();
  setupBusinessStoreManager();
  setupBusinessBookingSettings();
  await refreshBusinessDashboard();
}

function setActiveNav() {
  const currentPage =
    window.location.pathname.split("/").pop() ||
    "index.html";
  const navPageAliases = {
    "my-reservations.html": "profile.html",
    "my-reviews.html": "profile.html",
    "user.html": "profile.html",
    "venue.html": "discover.html",
    "event.html": "events.html",
  };
  const activePage =
    navPageAliases[currentPage] || currentPage;

  const navLinks =
    document.querySelectorAll(
      ".nav-links a, .mobile-bottom-nav a"
    );

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const navPage = link.dataset.navPage;

    if (
      href === `./${activePage}` ||
      navPage === activePage
    ) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

function setupMobileNav() {
  const navbars = document.querySelectorAll(".navbar");

  navbars.forEach((navbar) => {
    const toggle = navbar.querySelector(".nav-toggle");
    const navLinks = navbar.querySelector(".nav-links");

    if (!toggle || !navLinks) return;

    toggle.addEventListener("click", () => {
      const isOpen = navbar.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navbar.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((error) => {
        console.log(error);
      });
  });
}

runSafeInitializer("checkUser", checkUser);
runSafeInitializer("loadVenues", loadVenues);
runSafeInitializer("initDiscoverStorePreview", initDiscoverStorePreview);
runSafeInitializer("loadFavorites", loadFavorites);
runSafeInitializer("loadEvents", loadEvents);
runSafeInitializer("loadVenueDetails", loadVenueDetails);
runSafeInitializer("loadEventDetails", loadEventDetails);
runSafeInitializer("initAdminPanel", initAdminPanel);
runSafeInitializer("initBusinessDashboard", initBusinessDashboard);
runSafeInitializer("setupMessagesPage", setupMessagesPage);
runSafeInitializer("setupPublicUserProfile", setupPublicUserProfile);
runSafeInitializer("initMyReservationsPage", initMyReservationsPage);
runSafeInitializer("initMyReviewsPage", initMyReviewsPage);
runSafeInitializer("setActiveNav", setActiveNav);
runSafeInitializer("setupMobileNav", setupMobileNav);
runSafeInitializer("registerServiceWorker", registerServiceWorker);

window.addFavorite = addFavorite;
window.removeFavorite = removeFavorite;
window.openVenue = openVenue;
window.openEvent = openEvent;
window.filterByCity = filterByCity;
window.openReservationConversation =
  openReservationConversation;
window.openDirectConversation = openDirectConversation;
window.getOrCreateDirectConversation =
  getOrCreateDirectConversation;
window.createNotification = createNotification;
window.createStoreOrderNotification = createStoreOrderNotification;
window.openStoreProductConversation =
  openStoreProductConversation;
window.getStoreProductBusinessOwnerId =
  getStoreProductBusinessOwnerId;
