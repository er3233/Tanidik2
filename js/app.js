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
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const VENUE_CATEGORIES = [
  ["night_club", "Gece Kulübü"],
  ["bar", "Bar"],
  ["restaurant", "Restoran"],
  ["cafe", "Kafe"],
  ["beach", "Plaj"],
  ["hotel", "Otel"],
  ["live_music", "Canlı Müzik"],
  ["event_venue", "Etkinlik Mekanı"],
  ["sports_fitness", "Spor / Fitness"],
  ["wellness", "Wellness"],
  ["other", "Diğer"],
];
const DEFAULT_VENUE_CATEGORY = "other";
const BOOKING_WEEKDAYS = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

const email = document.getElementById("email");
const password = document.getElementById("password");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");
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
};
let venueReservationSlotState = {
  venueId: null,
  date: "",
  slots: [],
  selectedSlotTime: "",
  fallbackMode: true,
};

const AUTH_MIN_PASSWORD_LENGTH = 8;
const RESERVATION_MIN_PARTY_SIZE = 1;
const RESERVATION_MAX_PARTY_SIZE = 20;

function getBusinessStatus(business) {
  return safeText(business.status).toLowerCase().trim();
}

function getBusinessVerificationStatus(business) {
  return safeText(business && business.verification_status)
    .toLowerCase()
    .trim();
}

function isApprovedBusinessRecord(business) {
  return ["approved", "active", "verified"].includes(
    getBusinessStatus(business)
  ) || ["approved", "active", "verified"].includes(
    getBusinessVerificationStatus(business)
  );
}

function isPendingBusinessRecord(business) {
  return ["pending", "review", "in_review"].includes(
    getBusinessStatus(business)
  ) || ["pending", "review", "in_review"].includes(
    getBusinessVerificationStatus(business)
  );
}

function getBusinessDisplayStatus(business) {
  if (isApprovedBusinessRecord(business)) return "approved";
  if (isPendingBusinessRecord(business)) return "pending";

  return (
    getBusinessStatus(business) ||
    getBusinessVerificationStatus(business) ||
    "pending"
  );
}

function safeText(value) {
  return value || "";
}

function normalizeEmail(value) {
  return safeText(value).trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
    normalizeEmail(value)
  );
}

function setFieldValidity(input, isValid) {
  if (!input) return;

  input.classList.toggle("is-invalid", !isValid);
  input.setAttribute("aria-invalid", isValid ? "false" : "true");
}

function setAuthMessage(message, status = "info") {
  const authMessage = document.getElementById("authMessage");

  if (!authMessage) return;

  authMessage.textContent = safeText(message);
  authMessage.dataset.status = status;
}

function getAuthRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const fallback = "./index.html";
  const rawRedirect = safeText(params.get("redirect")).trim();

  if (!rawRedirect) return fallback;

  try {
    const redirectUrl = new URL(rawRedirect, window.location.href);

    if (redirectUrl.origin !== window.location.origin) {
      return fallback;
    }

    const page =
      redirectUrl.pathname.split("/").pop() || "index.html";

    if (page === "auth.html") return fallback;

    return `./${page}${redirectUrl.search}${redirectUrl.hash}`;
  } catch (error) {
    console.log(error);
    return fallback;
  }
}

function getCurrentPageRedirectValue() {
  const page =
    window.location.pathname.split("/").pop() || "index.html";

  return `${page}${window.location.search}${window.location.hash}`;
}

function getAuthUrlForCurrentPage() {
  const redirectValue = getCurrentPageRedirectValue();

  return `./auth.html?redirect=${encodeURIComponent(
    redirectValue
  )}`;
}

function redirectToAuthForCurrentPage() {
  window.location.href = getAuthUrlForCurrentPage();
}

function getAuthEmailRedirectTo() {
  const authUrl = new URL("./auth.html", window.location.href);
  authUrl.searchParams.set("redirect", getAuthRedirectTarget());

  return authUrl.toString();
}

function getPasswordValidationMessage(value) {
  const passwordValue = safeText(value);

  if (passwordValue.length < AUTH_MIN_PASSWORD_LENGTH) {
    return `Şifre en az ${AUTH_MIN_PASSWORD_LENGTH} karakter olmalı.`;
  }

  if (!/[A-Za-z]/.test(passwordValue) || !/\d/.test(passwordValue)) {
    return "Şifre en az bir harf ve bir rakam içermeli.";
  }

  return "";
}

function isElementHidden(element) {
  if (!element) return true;

  return (
    element.hidden ||
    element.style.display === "none" ||
    window.getComputedStyle(element).display === "none"
  );
}

function showSignupConfirmPassword() {
  const confirmInput = document.getElementById("confirmPassword");
  const confirmLabel =
    document.getElementById("confirmPasswordLabel");

  if (confirmInput) {
    confirmInput.style.display = "";
  }

  if (confirmLabel) {
    confirmLabel.style.display = "";
  }

  document
    .querySelectorAll(".auth-tab")
    .forEach((tab, index) => {
      tab.classList.toggle("auth-tab--active", index === 1);
    });

  if (password) {
    password.setAttribute("autocomplete", "new-password");
  }
}

function validateAuthForm(mode) {
  const isSignup = mode === "signup";
  const confirmInput = document.getElementById("confirmPassword");
  const emailValue = normalizeEmail(email && email.value);
  const passwordValue = password ? password.value : "";

  setFieldValidity(email, true);
  setFieldValidity(password, true);
  setFieldValidity(confirmInput, true);

  if (!emailValue) {
    setFieldValidity(email, false);
    return {
      ok: false,
      message: "E-posta adresini gir.",
    };
  }

  if (!isValidEmail(emailValue)) {
    setFieldValidity(email, false);
    return {
      ok: false,
      message: "Geçerli bir e-posta adresi gir.",
    };
  }

  if (!passwordValue) {
    setFieldValidity(password, false);
    return {
      ok: false,
      message: "Şifreni gir.",
    };
  }

  if (isSignup) {
    const passwordMessage =
      getPasswordValidationMessage(passwordValue);

    if (passwordMessage) {
      setFieldValidity(password, false);
      return {
        ok: false,
        message: passwordMessage,
      };
    }

    if (confirmInput && isElementHidden(confirmInput)) {
      showSignupConfirmPassword();
      setFieldValidity(confirmInput, false);
      return {
        ok: false,
        message: "Kayıt için şifreni tekrar yaz.",
      };
    }

    if (
      confirmInput &&
      confirmInput.value &&
      confirmInput.value !== passwordValue
    ) {
      setFieldValidity(confirmInput, false);
      return {
        ok: false,
        message: "Şifreler eşleşmiyor.",
      };
    }

    if (confirmInput && !confirmInput.value) {
      setFieldValidity(confirmInput, false);
      return {
        ok: false,
        message: "Şifre tekrarını gir.",
      };
    }
  }

  return {
    ok: true,
    email: emailValue,
    password: passwordValue,
  };
}

function translateAuthError(error, fallback) {
  const message = safeText(error && error.message).toLowerCase();
  const status = safeText(error && error.status).toLowerCase();
  const combined = `${message} ${status}`;

  if (!message) {
    return fallback || "İşlem tamamlanamadı. Lütfen tekrar dene.";
  }

  if (combined.includes("invalid login credentials")) {
    return "E-posta veya şifre hatalı.";
  }

  if (
    combined.includes("email not confirmed") ||
    combined.includes("email_confirm")
  ) {
    return "E-posta adresini doğrulaman gerekiyor. Gelen kutunu kontrol et.";
  }

  if (
    combined.includes("already registered") ||
    combined.includes("already exists") ||
    combined.includes("user already")
  ) {
    return "Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.";
  }

  if (
    combined.includes("signup") &&
    combined.includes("disabled")
  ) {
    return "Kayıt şu anda kapalı görünüyor. Supabase Auth ayarlarını kontrol et.";
  }

  if (
    combined.includes("password") &&
    (combined.includes("weak") ||
      combined.includes("at least") ||
      combined.includes("length"))
  ) {
    return "Şifre yeterince güçlü değil. En az 8 karakter, bir harf ve bir rakam kullan.";
  }

  if (combined.includes("invalid email")) {
    return "E-posta adresi geçerli görünmüyor.";
  }

  if (
    combined.includes("provider") ||
    combined.includes("oauth") ||
    combined.includes("google")
  ) {
    return "Google ile giriş şu anda kullanılamıyor. Supabase Google provider ayarlarını kontrol et.";
  }

  if (
    combined.includes("network") ||
    combined.includes("failed to fetch")
  ) {
    return "Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.";
  }

  return fallback || error.message;
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

function createVenueProductCard(product) {
  const card = document.createElement("article");
  card.className = "venue-menu-item venue-product-card";

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

  if (
    product.stock_quantity !== null &&
    product.stock_quantity !== undefined &&
    product.stock_quantity !== ""
  ) {
    const stock = document.createElement("span");
    stock.className = "venue-product-stock";
    stock.textContent = `${product.stock_quantity} in stock`;
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
  const products = productData.products || [];

  if (categories.length === 0 && products.length === 0) {
    renderEmptyState(panel, "No products yet.", "Products will appear here when available.");
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
      products: productsResult.data || [],
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
    setAuthMessage(message);
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
    showToast("Oturum bilgisi alınamadı. Lütfen tekrar giriş yap.");
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

  if (
    [
      "approved",
      "approve",
      "accepted",
      "confirmed",
      "onaylandı",
      "onaylandi",
    ].includes(value)
  ) {
    return "approved";
  }

  if (
    ["rejected", "reject", "denied", "reddedildi"].includes(
      value
    )
  ) {
    return "rejected";
  }

  if (
    ["cancelled", "canceled", "cancel", "iptal", "iptal edildi"].includes(
      value
    )
  ) {
    return "cancelled";
  }

  return value === "pending" ? "pending" : "pending";
}

function getReservationStatusLabel(status) {
  const value = getReservationStatusValue(status);
  const labels = {
    pending: "Beklemede",
    approved: "Onaylandı",
    rejected: "Reddedildi",
    cancelled: "İptal Edildi",
  };

  return labels[value] || value;
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

  return "Rezervasyon talebi";
}

function createReservationMeta(label, value) {
  const item = document.createElement("div");
  item.className = "reservation-meta-item";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  item.appendChild(labelElement);

  const valueElement = document.createElement("strong");
  valueElement.textContent = safeText(value) || "Belirtilmedi";
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
      ? `Misafir #${String(reservation.user_id).slice(0, 8)}`
      : "Misafir")
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
    cancelButton.textContent = "İptal et";
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
      "Henüz rezervasyon yok",
      "Bu mekan için gönderdiğin rezervasyon talepleri burada görünecek."
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

function isSupabaseRpcUnavailable(error, functionName = "") {
  const code = safeText(error && error.code).toUpperCase();
  const message = safeText(error && error.message).toLowerCase();
  const details = safeText(error && error.details).toLowerCase();
  const combined = `${message} ${details}`;

  return (
    code === "PGRST202" ||
    code === "42883" ||
    combined.includes("could not find the function") ||
    combined.includes("does not exist") ||
    combined.includes("schema cache") ||
    (functionName &&
      combined.includes(functionName.toLowerCase()))
  );
}

async function cancelUserReservation(
  reservationId,
  onComplete
) {
  if (!confirm("Bu rezervasyon talebini iptal etmek istiyor musun?")) {
    return;
  }

  let error = null;
  let rpcUnavailable = false;

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
    rpcUnavailable = isSupabaseRpcUnavailable(
      error,
      "cancel_pending_reservation"
    );

    if (!rpcUnavailable) {
      console.log(error);
      showToast(
        "Yalnızca bekleyen rezervasyonlarını iptal edebilirsin."
      );
      return;
    }

    const session = await getSafeSession();

    if (!session) {
      showToast("Rezervasyon iptali için giriş yapmalısın.");
      redirectToAuthForCurrentPage();
      return;
    }

    const fallbackResult = await supabaseClient
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", reservationId)
      .eq("user_id", session.user.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (fallbackResult.error) {
      showSafeError(
        fallbackResult.error,
        "Rezervasyon iptal edilemedi."
      );
      return;
    }

    if (!fallbackResult.data) {
      showToast(
        "Bu rezervasyon iptal edilemez veya zaten güncellenmiş."
      );
      return;
    }
  }

  showToast("Rezervasyon iptal edildi");

  if (onComplete) {
    await onComplete();
  }
}

function getReservationNotificationTitle(status) {
  return status === "approved"
    ? "Rezervasyon onaylandı"
    : "Rezervasyon reddedildi";
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
    ? "Rezervasyon talebin işletme tarafından onaylandı."
    : "Rezervasyon talebin işletme tarafından reddedildi.";
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
    "Yeni rezervasyon talebi",
    `${safeText(
      venue.name
    )} için yeni bir rezervasyon talebi geldi.`,
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
        "Rezervasyon talebi oluşturmak için giriş yapmalısın.";
    }
    renderEmptyState(
      reservationsContainer,
      "Giriş gerekli",
      "Rezervasyon durumların giriş yaptıktan sonra burada görünecek."
    );
    return;
  }

  if (reservationMessage) {
    reservationMessage.innerText =
      "Rezervasyon talepleri önce beklemede olarak açılır.";
  }

  const { data, error } =
    await supabaseClient
      .from("reservations")
      .select("*")
      .eq("venue_id", venueId)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

  if (error) {
    showSafeError(error, "Rezervasyonlar yüklenemedi.");
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
    parts.push(`${reservationCount}/${maxReservations} rezervasyon`);
  } else if (reservationCount > 0) {
    parts.push(`${reservationCount} rezervasyon`);
  }

  if (maxGuests > 0) {
    parts.push(`${guestCount}/${maxGuests} misafir`);
  } else if (guestCount > 0) {
    parts.push(`${guestCount} misafir`);
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
    return "Bu mekan seçilen tarihte rezervasyon almıyor.";
  }

  if (settings && settings.hours) {
    if (
      settings.hours.is_closed ||
      !settings.hours.opens_at ||
      !settings.hours.closes_at
    ) {
      return "Bu mekan seçilen tarihte kapalı.";
    }
  }

  return "Bu mekan için slot ayarları henüz tanımlanmamış.";
}

function formatVenueAvailabilityDate(value) {
  if (!value) return "Tarih seç";

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

  if (!hours) return "Rezervasyon saatleri tanımlı değil";

  if (hours.is_closed || !hours.opens_at || !hours.closes_at) {
    return "Bu tarihte kapalı";
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
    ? `${availableCount} uygun - ${fullCount} dolu`
    : emptyMessage || "Uygun saatleri görmek için tarih seç";

  summary.innerHTML = "";
  summary.dataset.status =
    !hasSlots &&
    (
      statusLabel.toLowerCase().includes("closed") ||
      statusLabel.toLowerCase().includes("unavailable") ||
      statusLabel.toLowerCase().includes("kapalı") ||
      statusLabel.toLowerCase().includes("almıyor")
    )
      ? "warning"
      : "info";

  const items = [
    ["Tarih", formatVenueAvailabilityDate(reservationDate)],
    ["Saatler", getVenueOpenHoursLabel(settings)],
    ["Slotlar", statusLabel],
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
  setVenueSlotMessage("Uygun saatler yükleniyor...");
  updateVenueAvailabilitySummary(
    reservationDate,
    [],
    null,
    "Uygunluk yükleniyor..."
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
      "Rezervasyon saatleri tanımlı değil"
    );
    setVenueSlotMessage(
      "Bu mekan için slot ayarları henüz tanımlanmamış."
    );
    return [];
  }
}

function renderVenueAvailableSlots(
  slots,
  emptyMessage = "Bu mekan için slot ayarları henüz tanımlanmamış."
) {
  const slotContainer =
    document.getElementById("venueAvailableSlots");

  if (!slotContainer) return;

  slotContainer.innerHTML = "";

  if (!slots || slots.length === 0) {
    const messageStatus = emptyMessage.toLowerCase().includes("closed") ||
      emptyMessage.toLowerCase().includes("unavailable") ||
      emptyMessage.toLowerCase().includes("kapalı") ||
      emptyMessage.toLowerCase().includes("almıyor")
      ? "error"
      : "info";
    setVenueSlotMessage(emptyMessage, messageStatus);
    return;
  }

  setVenueSlotMessage("Uygun bir rezervasyon saati seç.");

  const heading = document.createElement("span");
  heading.className = "venue-slot-picker-label";
  heading.textContent = "Uygun saatler";
  slotContainer.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "venue-slot-grid";
  const requestedPartySize = getReservationPartySizeValue();

  slots.forEach((slot) => {
    const slotTime = getVenueSlotTimeValue(slot);
    if (!slotTime) return;

    const button = document.createElement("button");
    const hasCapacityForParty =
      isVenueSlotAvailableForParty(slot, requestedPartySize);
    const isAvailable =
      slot.is_available !== false && hasCapacityForParty;
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
    state.textContent = isAvailable
      ? "Uygun"
      : slot.is_available === false
        ? "Dolu"
        : "Kapasite yok";
    button.appendChild(state);

    if (metaLabel) {
      const meta = document.createElement("span");
      meta.textContent = metaLabel;
      button.appendChild(meta);
    }

    if (!isAvailable) {
      button.setAttribute("aria-label", `${time.textContent} dolu`);
    } else {
      button.setAttribute(
        "aria-label",
        `${time.textContent} uygun`
      );
    }

    button.addEventListener("click", () => {
      selectVenueReservationSlot(slotTime);
    });

    grid.appendChild(button);
  });

  slotContainer.appendChild(grid);
}

function getReservationPartySizeValue() {
  const partySizeInput =
    document.getElementById("reservationPartySize");
  const value = Number(partySizeInput ? partySizeInput.value : 0);

  return Number.isFinite(value) ? value : 0;
}

function refreshVisibleReservationSlotsForPartySize() {
  if (
    venueReservationSlotState.fallbackMode ||
    !venueReservationSlotState.slots.length
  ) {
    return;
  }

  const selectedTime =
    venueReservationSlotState.selectedSlotTime;

  renderVenueAvailableSlots(
    venueReservationSlotState.slots,
    "Bu mekan için slot ayarları henüz tanımlanmamış."
  );

  if (selectedTime) {
    selectVenueReservationSlot(selectedTime);
  }
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
    !isVenueSlotAvailableForParty(slot, getReservationPartySizeValue())
  ) {
    timeInput.value = "";
    venueReservationSlotState.selectedSlotTime = "";
    document
      .querySelectorAll(".venue-slot-button")
      .forEach((button) => {
        button.classList.remove("is-selected");
        button.setAttribute("aria-pressed", "false");
      });
    setVenueSlotMessage(
      "Bu saat dolu. Lütfen başka bir slot seç.",
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

  setVenueSlotMessage("Rezervasyon saati seçildi.");
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
    setVenueSlotMessage("Uygun bir rezervasyon saati seç.", "error");
    return false;
  }

  const slot = venueReservationSlotState.slots.find(
    (item) => getVenueSlotTimeValue(item) === selectedTime
  );

  if (!slot || !isVenueSlotAvailableForParty(slot, partySize)) {
    setVenueSlotMessage(
      "Bu saat artık uygun değil. Lütfen başka bir slot seç.",
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
  return isSupabaseRpcUnavailable(
    error,
    "create_reservation_with_capacity_check"
  );
}

function getReservationCapacityErrorMessage(error) {
  const message = safeText(error && error.message).toLowerCase();
  const details = safeText(error && error.details).toLowerCase();
  const hint = safeText(error && error.hint).toLowerCase();
  const combined = `${message} ${details} ${hint}`;

  if (combined.includes("login required")) {
    return "Rezervasyon yapmak için giriş yapmalısın.";
  }

  if (
    combined.includes("unavailable on the selected date") ||
    combined.includes("blackout")
  ) {
    return "Bu mekan seçilen tarihte rezervasyon almıyor.";
  }

  if (
    combined.includes("closed on the selected date") ||
    combined.includes("closed day")
  ) {
    return "Bu mekan seçilen tarihte kapalı.";
  }

  if (
    combined.includes("outside operating hours") ||
    combined.includes("outside hours")
  ) {
    return "Rezervasyon saati çalışma saatleri dışında.";
  }

  if (
    combined.includes("not an available slot") ||
    combined.includes("not available slot")
  ) {
    return "Lütfen uygun bir rezervasyon saati seç.";
  }

  if (
    combined.includes("minimum notice") ||
    combined.includes("too soon")
  ) {
    return "Bu saat için rezervasyon süresi çok yakın. Daha ileri bir saat seç.";
  }

  if (
    combined.includes("guest capacity") ||
    combined.includes("enough guest capacity")
  ) {
    return "Bu saat seçtiğin kişi sayısı için yeterli kapasiteye sahip değil.";
  }

  if (
    combined.includes("slot is full") ||
    combined.includes("slot full") ||
    combined.includes("reservation slot is full")
  ) {
    return "Bu rezervasyon slotu dolu.";
  }

  return "Rezervasyon talebi oluşturulamadı.";
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
  const partySizeInput =
    document.getElementById("reservationPartySize");

  if (dateInput) {
    dateInput.min = getTodayReservationDateKey();
  }

  if (partySizeInput) {
    partySizeInput.min = String(RESERVATION_MIN_PARTY_SIZE);
    partySizeInput.max = String(RESERVATION_MAX_PARTY_SIZE);

    if (partySizeInput.dataset.slotsBound !== "true") {
      partySizeInput.dataset.slotsBound = "true";
      partySizeInput.addEventListener("input", () => {
        refreshVisibleReservationSlotsForPartySize();
      });
    }
  }

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
          "Uygun saatleri görmek için tarih seç"
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
        showToast("Rezervasyon yapmak için giriş yapmalısın.");
        redirectToAuthForCurrentPage();
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
        showToast("Rezervasyon formu kullanılamıyor.");
        return;
      }

      const partySize = Number(partySizeInput.value);
      const reservationDate =
        normalizeReservationDate(dateInput.value);
      const reservationTime =
        normalizeReservationTime(timeInput.value);

      if (
        partySize < RESERVATION_MIN_PARTY_SIZE ||
        partySize > RESERVATION_MAX_PARTY_SIZE
      ) {
        showToast(
          `Kişi sayısı ${RESERVATION_MIN_PARTY_SIZE}-${RESERVATION_MAX_PARTY_SIZE} arasında olmalı.`
        );
        return;
      }

      if (!reservationDate) {
        showToast("Rezervasyon tarihi seç.");
        return;
      }

      if (reservationDate < getTodayReservationDateKey()) {
        showToast("Geçmiş bir tarih için rezervasyon oluşturamazsın.");
        return;
      }

      if (!reservationTime) {
        showToast("Rezervasyon saati seç.");
        return;
      }

      if (!validateSelectedReservationSlotBeforeSubmit()) {
        return;
      }

      const payload = {
        venue_id: venueId,
        user_id: session.user.id,
        reservation_date: reservationDate,
        reservation_time: reservationTime,
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
          "Reservation capacity RPC unavailable.",
          rpcResult.error
        );
        const setupMessage =
          "Rezervasyon kapasite fonksiyonu Supabase'te kurulu değil. SQL migration dosyasını çalıştır.";
        setVenueSlotMessage(setupMessage, "error");
        showToast("Rezervasyon sistemi kurulumu eksik.");
        return;
      } else {
        createdReservation = Array.isArray(rpcResult.data)
          ? rpcResult.data[0]
          : rpcResult.data;
      }

      const createdVenueId =
        createdReservation && createdReservation.venue_id
          ? createdReservation.venue_id
          : venueId;

      showToast("Rezervasyon talebi gönderildi");
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
      showToast(
        error.message || "Rezervasyon şu anda kullanılamıyor."
      );
    } finally {
      reservationForm.dataset.submitting = "false";
    }
  });
}

function queueHomeMapIntro() {
  try {
    sessionStorage.setItem("tanidik.playMapIntro", "1");
    console.log("[home-map-intro] flag yazıldı");
  } catch (error) {
    console.log("[auth] Map intro flag unavailable:", error);
  }
}

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    if (loginBtn.disabled) return;

    if (!email || !password) {
      showToast("Giriş formu kullanılamıyor.");
      return;
    }

    const validation = validateAuthForm("login");

    if (!validation.ok) {
      setAuthMessage(validation.message, "error");
      return;
    }

    loginBtn.disabled = true;

    try {
      const { error } =
        await supabaseClient.auth.signInWithPassword({
          email: validation.email,
          password: validation.password,
        });

      if (error) {
        setAuthMessage(
          translateAuthError(error, "Giriş yapılamadı."),
          "error"
        );
        return;
      }

      await window.playEarthZoomTransition?.();
      queueHomeMapIntro();
      window.location.href = getAuthRedirectTarget();
    } catch (error) {
      console.log(error);
      setAuthMessage(
        translateAuthError(error, "Giriş şu anda kullanılamıyor."),
        "error"
      );
    } finally {
      loginBtn.disabled = false;
    }
  });
}

if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    if (registerBtn.disabled) return;

    if (!email || !password) {
      showToast("Kayıt formu kullanılamıyor.");
      return;
    }

    const validation = validateAuthForm("signup");

    if (!validation.ok) {
      setAuthMessage(validation.message, "error");
      return;
    }

    registerBtn.disabled = true;

    try {
      const { data, error } =
        await supabaseClient.auth.signUp({
          email: validation.email,
          password: validation.password,
          options: {
            emailRedirectTo: getAuthEmailRedirectTo(),
          },
        });

      if (error) {
        setAuthMessage(
          translateAuthError(error, "Kayıt oluşturulamadı."),
          "error"
        );
        return;
      }

      if (data && data.session) {
        setAuthMessage("Kayıt tamamlandı. Yönlendiriliyorsun.", "success");
        await window.playEarthZoomTransition?.();
        queueHomeMapIntro();
        window.location.href = getAuthRedirectTarget();
        return;
      }

      setAuthMessage(
        "Kayıt alındı. Devam etmek için e-posta doğrulama bağlantını kontrol et.",
        "success"
      );
    } catch (error) {
      console.log(error);
      setAuthMessage(
        translateAuthError(
          error,
          "Kayıt şu anda kullanılamıyor."
        ),
        "error"
      );
    } finally {
      registerBtn.disabled = false;
    }
  });
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    if (googleLoginBtn.disabled) return;

    googleLoginBtn.disabled = true;

    try {
      const { error } =
        await supabaseClient.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: getAuthEmailRedirectTo(),
          },
        });

      if (error) {
        setAuthMessage(
          translateAuthError(error, "Google ile giriş başlatılamadı."),
          "error"
        );
      }
    } catch (error) {
      console.log(error);
      setAuthMessage(
        translateAuthError(
          error,
          "Google ile giriş şu anda kullanılamıyor."
        ),
        "error"
      );
    } finally {
      googleLoginBtn.disabled = false;
    }
  });
}

async function initAuthPage() {
  if (!loginBtn && !registerBtn && !googleLoginBtn) return;

  const queryParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, "")
  );
  const authError =
    hashParams.get("error_description") ||
    queryParams.get("error_description") ||
    hashParams.get("error") ||
    queryParams.get("error");

  if (authError) {
    setAuthMessage(
      translateAuthError(
        { message: authError },
        "Giriş işlemi tamamlanamadı."
      ),
      "error"
    );
    return;
  }

  const session = await getSafeSession();

  if (!session) return;

  const authType =
    hashParams.get("type") || queryParams.get("type") || "";
  const message =
    authType === "signup" || authType === "email"
      ? "E-posta doğrulandı. Yönlendiriliyorsun."
      : "Oturum açık. Yönlendiriliyorsun.";

  setAuthMessage(message, "success");
  queueHomeMapIntro();

  window.setTimeout(() => {
    window.location.href = getAuthRedirectTarget();
  }, 600);
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
    setupBusinessApplicationForm(session.user.id);
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
      }
    });
  });
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
  heading.textContent = "İşletme Başvurusu";
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
  nameInput.placeholder = "İşletme Adı";
  nameInput.required = true;
  form.appendChild(nameInput);

  const categorySelect = document.createElement("select");
  categorySelect.id = "businessApplicationCategory";
  const categoryPlaceholder = document.createElement("option");
  categoryPlaceholder.value = "";
  categoryPlaceholder.textContent = "Kategori Seç";
  categorySelect.appendChild(categoryPlaceholder);
  VENUE_CATEGORIES.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    categorySelect.appendChild(option);
  });
  form.appendChild(categorySelect);

  const cityInput = document.createElement("input");
  cityInput.type = "text";
  cityInput.id = "businessApplicationCity";
  cityInput.placeholder = "Şehir / Bölge";
  form.appendChild(cityInput);

  const phoneInput = document.createElement("input");
  phoneInput.type = "tel";
  phoneInput.id = "businessApplicationPhone";
  phoneInput.placeholder = "Telefon";
  form.appendChild(phoneInput);

  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.id = "businessApplicationEmail";
  emailInput.placeholder = "E-posta";
  form.appendChild(emailInput);

  const instagramInput = document.createElement("input");
  instagramInput.type = "text";
  instagramInput.id = "businessApplicationInstagram";
  instagramInput.placeholder = "Instagram";
  form.appendChild(instagramInput);

  const addressInput = document.createElement("input");
  addressInput.type = "text";
  addressInput.id = "businessApplicationAddress";
  addressInput.placeholder = "Adres";
  form.appendChild(addressInput);

  const imageInput = document.createElement("input");
  imageInput.type = "text";
  imageInput.id = "businessApplicationImage";
  imageInput.placeholder = "Kapak fotoğrafı URL";
  form.appendChild(imageInput);

  const galleryInput = document.createElement("textarea");
  galleryInput.id = "businessApplicationGalleryUrls";
  galleryInput.placeholder =
    "Galeri fotoğraf URL'leri, her satıra bir tane";
  form.appendChild(galleryInput);

  const hoursInput = document.createElement("input");
  hoursInput.type = "text";
  hoursInput.id = "businessApplicationHours";
  hoursInput.placeholder = "Çalışma saatleri";
  form.appendChild(hoursInput);

  const reservationsLabel = document.createElement("label");
  reservationsLabel.className = "booking-toggle-field";
  const reservationsInput = document.createElement("input");
  reservationsInput.type = "checkbox";
  reservationsInput.id = "businessApplicationAcceptsReservations";
  reservationsLabel.appendChild(reservationsInput);
  reservationsLabel.append("Rezervasyon kabul ediyor");
  form.appendChild(reservationsLabel);

  const averagePriceInput = document.createElement("input");
  averagePriceInput.type = "number";
  averagePriceInput.id = "businessApplicationAveragePrice";
  averagePriceInput.placeholder = "Ortalama kişi başı fiyat";
  averagePriceInput.min = "0";
  averagePriceInput.step = "1";
  form.appendChild(averagePriceInput);

  const descriptionInput = document.createElement("textarea");
  descriptionInput.id = "businessApplicationDescription";
  descriptionInput.placeholder = "Açıklama";
  descriptionInput.required = true;
  form.appendChild(descriptionInput);

  const actions = document.createElement("div");
  actions.className = "admin-form-actions";

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "btn";
  submitButton.textContent = "Başvur";
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
  await loadProfileBusinessApplications(userId);
  await loadProfileReservations(userId, {
    limit: 4,
  });
  await setupBusinessProfileLink(userId);
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
    isPendingBusinessRecord(business) ||
    isApprovedBusinessRecord(business)
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

    item.appendChild(createStatusBadge(getBusinessDisplayStatus(business)));

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

  console.log("[business-debug] applications", data);
  logBusinessStatusFields(data || []);
  renderProfileBusinessApplications(data || []);
}

function clearBusinessApplicationForm() {
  setAdminValue("businessApplicationName", "");
  setAdminValue("businessApplicationCategory", "");
  setAdminValue("businessApplicationCity", "");
  setAdminValue("businessApplicationPhone", "");
  setAdminValue("businessApplicationEmail", "");
  setAdminValue("businessApplicationInstagram", "");
  setAdminValue("businessApplicationAddress", "");
  setAdminValue("businessApplicationImage", "");
  setAdminValue("businessApplicationGalleryUrls", "");
  setAdminValue("businessApplicationHours", "");
  setAdminValue("businessApplicationAveragePrice", "");
  setAdminChecked("businessApplicationAcceptsReservations", false);
  setAdminValue("businessApplicationDescription", "");
}

function getBusinessApplicationCategoryLabel() {
  const category = getAdminValue("businessApplicationCategory");
  const match = VENUE_CATEGORIES.find(
    ([value]) => value === category
  );

  return match ? match[1] : "";
}

function getBusinessApplicationDescription() {
  const description = getAdminValue(
    "businessApplicationDescription"
  );
  const acceptsReservationsInput =
    document.getElementById(
      "businessApplicationAcceptsReservations"
    );
  const extraFields = [
    ["Kategori", getBusinessApplicationCategoryLabel()],
    ["Şehir / Bölge", getAdminValue("businessApplicationCity")],
    ["E-posta", getAdminValue("businessApplicationEmail")],
    ["Instagram", getAdminValue("businessApplicationInstagram")],
    ["Kapak Fotoğrafı", getAdminValue("businessApplicationImage")],
    [
      "Galeri Fotoğrafları",
      getAdminValue("businessApplicationGalleryUrls"),
    ],
    ["Çalışma Saatleri", getAdminValue("businessApplicationHours")],
    [
      "Rezervasyon Kabul Ediyor",
      acceptsReservationsInput
        ? getAdminChecked("businessApplicationAcceptsReservations")
          ? "Evet"
          : "Hayır"
        : "",
    ],
    [
      "Ortalama Kişi Başı Fiyat",
      getAdminValue("businessApplicationAveragePrice"),
    ],
  ].filter(([, value]) => value);

  if (extraFields.length === 0) {
    return description;
  }

  const details = extraFields
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

  return [description, `Başvuru detayları:\n${details}`]
    .filter(Boolean)
    .join("\n\n");
}

function setupBusinessApplicationForm(userId) {
  const form =
    document.getElementById("businessApplicationForm");

  if (!form) return;
  if (form.dataset.bound === "true") return;

  form.dataset.bound = "true";

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
      description: getBusinessApplicationDescription(),
      status: "pending",
      rejection_reason: "",
    };

    const { error } =
      await supabaseClient
        .from("businesses")
        .insert([payload]);

    if (error) {
      showSafeError(error, "Başvuru gönderilemedi.");
      return;
    }

    showToast(
      "Başvurun alındı. Admin onayından sonra işletmen panelde görünecek."
    );
    clearBusinessApplicationForm();
    await loadProfileBusinessApplications(userId);
    await setupBusinessProfileLink(userId);

    if (
      document.getElementById("businessPage") &&
      businessDashboardState.session
    ) {
      await refreshBusinessDashboard();
    }
    } catch (error) {
      showSafeError(error, "Başvuru gönderilemedi.");
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
    "Rezervasyonlar yükleniyor..."
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
    showSafeError(error, "Rezervasyonlar yüklenemedi.");
    return;
  }

  const recentReservations = reservations || [];

  if (recentReservations.length === 0) {
    renderEmptyState(
      reservationsList,
      "Henüz rezervasyon yok.",
      "Gönderdiğin rezervasyon talepleri burada görünecek."
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

  renderVenueGallery(await loadVenueGalleryPhotos(venue.id));
  renderVenueMenu(await loadVenueMenu(venue.id));
  renderVenueStore(await loadVenueProducts(venue.id));

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

function getAdminChecked(id) {
  const element = document.getElementById(id);

  return Boolean(element && element.checked);
}

function setAdminValue(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.value = value || "";
  }
}

function setAdminChecked(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.checked = Boolean(value);
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

async function uploadVenueGalleryFiles(inputId) {
  const files = getAdminFiles(inputId);

  if (files.length === 0) return [];

  const urls = [];

  for (const file of files) {
    const uploadedUrl = await uploadAdminImage(
      file,
      "venue-gallery"
    );

    if (!uploadedUrl) {
      return [];
    }

    urls.push(uploadedUrl);
  }

  return urls;
}

async function saveVenueGalleryPhotos(venueId, imageUrls) {
  if (!venueId || !imageUrls || imageUrls.length === 0) {
    return;
  }

  const rows = imageUrls.map((imageUrl, index) => ({
    venue_id: venueId,
    image_url: imageUrl,
    sort_order: index,
  }));

  try {
    const { error } = await supabaseClient
      .from("venue_photos")
      .insert(rows);

    if (error) {
      console.warn("Venue gallery photos were not saved.", error);
    }
  } catch (error) {
    console.warn("Venue gallery photos were not saved.", error);
  }
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
      console.warn("Venue gallery photos could not be loaded.", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.warn("Venue gallery photos could not be loaded.", error);
    return [];
  }
}

function validateAdminImage(file) {
  if (!file) return true;

  if (!file.type.startsWith("image/")) {
    showToast("Please choose an image file");
    return false;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    showToast("Image must be 5MB or smaller");
    return false;
  }

  return true;
}

function getSafeFileName(fileName) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");

  return safeName || "image";
}

async function uploadAdminImage(file, folder) {
  if (!file) return "";

  if (!validateAdminImage(file)) {
    return "";
  }

  const fileName = getSafeFileName(file.name);
  const filePath = `${folder}/${Date.now()}-${fileName}`;

  let error = null;

  try {
    ({ error } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file));
  } catch (uploadError) {
    error = uploadError;
  }

  if (error) {
    console.log(error);
    showToast(error.message || "Image upload failed");
    return "";
  }

  const { data } =
    supabaseClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

  return data.publicUrl;
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
  editButton.textContent = "Düzenle";
  bindReservationAction(editButton, onEdit);
  actions.appendChild(editButton);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "admin-delete-btn";
  deleteButton.textContent = "Sil";
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

  console.log("[business-debug] applications", data);
  logBusinessStatusFields(data || []);
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

  console.log("[business-debug] application approval update", {
    id,
    status,
    business,
    payload,
  });

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

function setBusinessEmptyStateVisible(isVisible) {
  const emptyState =
    document.getElementById("businessEmptyState");

  if (emptyState) {
    emptyState.hidden = !isVisible;
  }
}

function setBusinessEmptyStateContent(options = {}) {
  const emptyState =
    document.getElementById("businessEmptyState");

  if (!emptyState) return;

  const title = emptyState.querySelector("h2");
  const message = emptyState.querySelector("p");
  const button =
    document.getElementById("businessEmptyStateAddButton");

  emptyState.hidden = !options.visible;

  if (title && options.title) {
    title.textContent = options.title;
  }

  if (message && options.message) {
    message.textContent = options.message;
  }

  if (button) {
    button.textContent = options.buttonText || "İşletme Ekle";
    button.hidden = options.buttonVisible === false;
  }
}

function updateBusinessDashboardEmptyState() {
  const businesses = businessDashboardState.businesses || [];
  const approvedBusinesses = businesses.filter(
    isApprovedBusinessRecord
  );
  const pendingBusinesses = businesses.filter(
    isPendingBusinessRecord
  );

  if (businesses.length === 0) {
    setBusinessEmptyStateContent({
      visible: true,
      title: "Henüz işletme eklemedin",
      message: "İlk işletmeni ekleyerek rezervasyon, etkinlik ve profil yönetimine başlayabilirsin.",
      buttonText: "İşletme Ekle",
      buttonVisible: true,
    });
    return;
  }

  if (pendingBusinesses.length > 0 && approvedBusinesses.length === 0) {
    setBusinessEmptyStateContent({
      visible: true,
      title: "Başvurun incelemede",
      message: "Admin onayından sonra işletmen burada görünecek.",
      buttonVisible: false,
    });
    return;
  }

  if (
    approvedBusinesses.length > 0 &&
    businessDashboardState.venues.length === 0
  ) {
    setBusinessEmptyStateContent({
      visible: true,
      title: "İşletme onaylandı",
      message: "İşletme profilini tamamlayarak mekan, rezervasyon ve etkinlik yönetimine başlayabilirsin.",
      buttonText: "İşletme profilini tamamla",
      buttonVisible: true,
    });
    return;
  }

  setBusinessEmptyStateVisible(false);
}

function openBusinessCreationForm() {
  const hasApprovedBusiness =
    getBusinessDashboardBusinessIds().length > 0;
  const form = hasApprovedBusiness
    ? document.getElementById("businessVenueForm")
    : document.getElementById("businessApplicationForm");

  if (!form) return;

  const section =
    form.closest(".dashboard-section") || form;

  if (section.hidden) {
    section.hidden = false;
  }

  form.style.display = "";
  section.classList.add("is-expanded", "is-open");

  if (hasApprovedBusiness) {
    const venuesPanelButton = document.querySelector(
      '[data-business-panel="venues"]'
    );

    if (venuesPanelButton) {
      venuesPanelButton.classList.add("is-active");
      venuesPanelButton.setAttribute("aria-expanded", "true");
    }
  }

  section.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  const firstField = form.querySelector("input, select, textarea");

  if (firstField) {
    window.setTimeout(() => firstField.focus(), 260);
  }
}

function setupBusinessCreationButtons() {
  [
    "businessAddButton",
    "businessEmptyStateAddButton",
  ].forEach((buttonId) => {
    const button = document.getElementById(buttonId);

    if (!button || button.dataset.bound === "true") return;

    button.dataset.bound = "true";
    button.addEventListener("click", openBusinessCreationForm);
  });
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
      "Henüz işletme yok",
      "Onay sonrası işletme kayıtların burada görünecek."
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

    item.appendChild(createStatusBadge(getBusinessDisplayStatus(business)));

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
    ["Toplam Mekan", analytics.totalVenues],
    ["Toplam Etkinlik", analytics.totalEvents],
    ["Toplam Rezervasyon", analytics.totalReservations],
    ["Bekleyen Rezervasyon", analytics.pendingReservations],
    ["Onaylı Rezervasyon", analytics.approvedReservations],
    ["Favoriler", analytics.totalFavorites],
    ["Yorumlar", analytics.totalReviews],
    [
      "Ortalama Puan",
      analytics.totalReviews
        ? analytics.averageRating.toFixed(1)
        : "Puan yok",
    ],
    ["Katılımcılar", analytics.totalAttendees],
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
  heading.textContent = "Analitik";
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.id = "businessAnalyticsGrid";
  grid.className = "business-analytics-grid";
  section.appendChild(grid);

  businessPage.insertBefore(section, firstSection || null);
}

function getBusinessDashboardBusinessIds() {
  return businessDashboardState.businesses
    .filter(isApprovedBusinessRecord)
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

  return venue ? safeText(venue.name) : `Mekan #${venueId}`;
}

function populateBusinessDashboardSelects() {
  const businessSelect =
    document.getElementById("businessVenueBusinessId");
  const venueSelect =
    document.getElementById("businessEventVenueId");
  const approvedBusinesses =
    businessDashboardState.businesses.filter(
      isApprovedBusinessRecord
    );

  if (businessSelect) {
    const selectedValue = businessSelect.value;
    businessSelect.innerHTML =
      '<option value="">İşletme Seç</option>';

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
      '<option value="">Mekan Seç</option>';

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
  const hasPendingOrApprovedBusiness =
    businessDashboardState.businesses.some((business) =>
      isPendingBusinessRecord(business) ||
      isApprovedBusinessRecord(business)
    );
  const venueForm =
    document.getElementById("businessVenueForm");
  const eventForm =
    document.getElementById("businessEventForm");
  const applicationSection =
    document.getElementById("businessApplicationSection");
  const applicationForm =
    document.getElementById("businessApplicationForm");

  if (venueForm) {
    venueForm.style.display = hasApprovedBusiness ? "" : "none";
  }

  if (eventForm) {
    eventForm.style.display = hasApprovedBusiness ? "" : "none";
  }

  if (applicationSection) {
    applicationSection.hidden = true;
  }

  if (applicationForm) {
    applicationForm.style.display =
      hasPendingOrApprovedBusiness ? "none" : "";
  }

  updateBusinessDashboardEmptyState();
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
      "Henüz mekan yok",
      "İşletmelerine bağlı mekanlar burada görünecek."
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
  placeholder.textContent = "Mekan Seç";
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
        "Menü yüklenemedi."
      );
      return { categories: [], items: [] };
    }

    return {
      categories: categoriesResult.data || [],
      items: itemsResult.data || [],
    };
  } catch (error) {
    showSafeError(error, "Menü yüklenemedi.");
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
  placeholder.textContent = "Kategori yok";
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
    button.textContent = "Sil";
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
      "Henüz menü yok.",
      "Seçili mekan için kategori ve ürün oluştur."
    );
    return;
  }

  const categoriesGroup = document.createElement("section");
  categoriesGroup.className = "business-menu-group";

  const categoriesTitle = document.createElement("h3");
  categoriesTitle.textContent = "Kategoriler";
  categoriesGroup.appendChild(categoriesTitle);

  (menuData.categories || []).forEach((category) => {
    categoriesGroup.appendChild(
      createBusinessMenuRow(
        category.name,
        `${category.is_active ? "Aktif" : "Gizli"} · Sıra ${category.sort_order || 0}`,
        () => deleteMenuCategory(category.id)
      )
    );
  });

  list.appendChild(categoriesGroup);

  const itemsGroup = document.createElement("section");
  itemsGroup.className = "business-menu-group";

  const itemsTitle = document.createElement("h3");
  itemsTitle.textContent = "Ürünler";
  itemsGroup.appendChild(itemsTitle);

  (menuData.items || []).forEach((item) => {
    const price = formatMenuPrice(item);
    const availability = item.is_available ? "Mevcut" : "Gizli";
    itemsGroup.appendChild(
      createBusinessMenuRow(
        item.name,
        [price, availability, `Sıra ${item.sort_order || 0}`]
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
      "Bir mekan seç.",
      "Menüsünü yönetmek için sana ait bir mekan seç."
    );
    return;
  }

  renderBusinessVenueMenu(await loadVenueMenuForBusiness(venueId));
}

async function createMenuCategory(event) {
  event.preventDefault();

  const venueId = getSelectedBusinessMenuVenueId();

  if (!venueId) {
    showToast("Mekanlarından birini seç");
    return;
  }

  const name = getAdminValue("businessMenuCategoryName");

  if (!name) {
    showToast("Kategori adı gerekli");
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
    showSafeError(error, "Kategori kaydedilemedi.");
    return;
  }

  setAdminValue("businessMenuCategoryName", "");
  setAdminValue("businessMenuCategorySort", "0");
  showToast("Kategori kaydedildi");
  await refreshBusinessVenueMenu();
}

async function createMenuItem(event) {
  event.preventDefault();

  const venueId = getSelectedBusinessMenuVenueId();

  if (!venueId) {
    showToast("Mekanlarından birini seç");
    return;
  }

  const name = getAdminValue("businessMenuItemName");

  if (!name) {
    showToast("Ürün adı gerekli");
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
    showSafeError(error, "Menü ürünü kaydedilemedi.");
    return;
  }

  setAdminValue("businessMenuItemName", "");
  setAdminValue("businessMenuItemDescription", "");
  setAdminValue("businessMenuItemPrice", "");
  setAdminValue("businessMenuItemImage", "");
  clearAdminFile("businessMenuItemImageFile");
  setAdminValue("businessMenuItemSort", "0");
  showToast("Menü ürünü kaydedildi");
  await refreshBusinessVenueMenu();
}

async function deleteMenuCategory(categoryId) {
  if (!categoryId || !confirm("Bu kategoriyi silmek istiyor musun?")) return;

  const { error } = await supabaseClient
    .from("venue_menu_categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    showSafeError(error, "Kategori silinemedi.");
    return;
  }

  showToast("Kategori silindi");
  await refreshBusinessVenueMenu();
}

async function deleteMenuItem(itemId) {
  if (!itemId || !confirm("Bu menü ürününü silmek istiyor musun?")) return;

  const { error } = await supabaseClient
    .from("venue_menu_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    showSafeError(error, "Menü ürünü silinemedi.");
    return;
  }

  showToast("Menü ürünü silindi");
  await refreshBusinessVenueMenu();
}

function populateBusinessStoreVenueSelect() {
  const select = document.getElementById("businessStoreVenueSelect");

  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Mekan Seç";
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

function resetBusinessStoreForms() {
  setAdminValue("businessProductCategoryName", "");
  setAdminValue("businessProductCategorySort", "0");
  setAdminValue("businessProductCategory", "");
  setAdminValue("businessProductName", "");
  setAdminValue("businessProductDescription", "");
  setAdminValue("businessProductPrice", "");
  setAdminValue("businessProductCurrency", "TRY");
  setAdminValue("businessProductImage", "");
  clearAdminFile("businessProductImageFile");
  setAdminValue("businessProductStock", "");
  setAdminValue("businessProductSort", "0");

  const categoryActive =
    document.getElementById("businessProductCategoryActive");
  const productActive =
    document.getElementById("businessProductActive");

  if (categoryActive) categoryActive.checked = true;
  if (productActive) productActive.checked = true;
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
        "Mağaza yüklenemedi."
      );
      return { categories: [], products: [] };
    }

    return {
      categories: categoriesResult.data || [],
      products: productsResult.data || [],
    };
  } catch (error) {
    showSafeError(error, "Mağaza yüklenemedi.");
    return { categories: [], products: [] };
  }
}

function populateBusinessProductCategorySelect(categories) {
  const select = document.getElementById("businessProductCategory");

  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Kategori yok";
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
      "Henüz ürün yok.",
      "Seçili mekan için ürün kategorileri ve ürünler oluştur."
    );
    return;
  }

  const categoriesGroup = document.createElement("section");
  categoriesGroup.className = "business-menu-group business-store-group";

  const categoriesTitle = document.createElement("h3");
  categoriesTitle.textContent = "Ürün Kategorileri";
  categoriesGroup.appendChild(categoriesTitle);

  (productData.categories || []).forEach((category) => {
    categoriesGroup.appendChild(
      createBusinessMenuRow(
        category.name,
        `${category.is_active ? "Aktif" : "Gizli"} · Sıra ${category.sort_order || 0}`,
        () => deleteProductCategory(category.id)
      )
    );
  });

  list.appendChild(categoriesGroup);

  const productsGroup = document.createElement("section");
  productsGroup.className = "business-menu-group business-store-group";

  const productsTitle = document.createElement("h3");
  productsTitle.textContent = "Ürünler";
  productsGroup.appendChild(productsTitle);

  (productData.products || []).forEach((product) => {
    const price = formatMenuPrice(product);
    const stock =
      product.stock_quantity === null ||
      product.stock_quantity === undefined ||
      product.stock_quantity === ""
        ? ""
        : `${product.stock_quantity} stok`;
    const availability = product.is_active ? "Aktif" : "Gizli";
    productsGroup.appendChild(
      createBusinessMenuRow(
        product.name,
        [price, stock, availability, `Sıra ${product.sort_order || 0}`]
          .filter(Boolean)
          .join(" · "),
        () => deleteVenueProduct(product.id)
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
      "Bir mekan seç.",
      "Mağaza kataloğunu yönetmek için sana ait bir mekan seç."
    );
    return;
  }

  renderBusinessVenueProducts(
    await loadVenueProductsForBusiness(venueId)
  );
}

async function createProductCategory(event) {
  event.preventDefault();

  const venueId = getSelectedBusinessStoreVenueId();

  if (!venueId) {
    showToast("Mekanlarından birini seç");
    return;
  }

  const name = getAdminValue("businessProductCategoryName");

  if (!name) {
    showToast("Kategori adı gerekli");
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
    showSafeError(error, "Ürün kategorisi kaydedilemedi.");
    return;
  }

  setAdminValue("businessProductCategoryName", "");
  setAdminValue("businessProductCategorySort", "0");
  showToast("Ürün kategorisi kaydedildi");
  await refreshBusinessVenueProducts();
}

async function createVenueProduct(event) {
  event.preventDefault();

  const venueId = getSelectedBusinessStoreVenueId();

  if (!venueId) {
    showToast("Mekanlarından birini seç");
    return;
  }

  const name = getAdminValue("businessProductName");

  if (!name) {
    showToast("Ürün adı gerekli");
    return;
  }

  const priceValue = getAdminValue("businessProductPrice");
  const stockValue = getAdminValue("businessProductStock");
  const categoryId = getAdminValue("businessProductCategory");
  const activeInput =
    document.getElementById("businessProductActive");
  const imageFile = getAdminFile("businessProductImageFile");
  const uploadedImage = imageFile
    ? await uploadAdminImage(imageFile, "venues")
    : "";

  if (imageFile && !uploadedImage) return;

  const { error } = await supabaseClient
    .from("venue_products")
    .insert([{
      venue_id: venueId,
      category_id: categoryId || null,
      name,
      description: getAdminValue("businessProductDescription"),
      price: priceValue ? Number(priceValue) : null,
      currency: getAdminValue("businessProductCurrency") || "TRY",
      image_url:
        uploadedImage || getAdminValue("businessProductImage"),
      stock_quantity: stockValue ? Number(stockValue) : null,
      is_active: activeInput ? activeInput.checked : true,
      sort_order: Number(getAdminValue("businessProductSort")) || 0,
    }]);

  if (error) {
    showSafeError(error, "Ürün kaydedilemedi.");
    return;
  }

  setAdminValue("businessProductName", "");
  setAdminValue("businessProductDescription", "");
  setAdminValue("businessProductPrice", "");
  setAdminValue("businessProductImage", "");
  clearAdminFile("businessProductImageFile");
  setAdminValue("businessProductStock", "");
  setAdminValue("businessProductSort", "0");
  showToast("Ürün kaydedildi");
  await refreshBusinessVenueProducts();
}

async function deleteProductCategory(categoryId) {
  if (!categoryId || !confirm("Bu ürün kategorisini silmek istiyor musun?")) return;

  const { error } = await supabaseClient
    .from("venue_product_categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    showSafeError(error, "Ürün kategorisi silinemedi.");
    return;
  }

  showToast("Ürün kategorisi silindi");
  await refreshBusinessVenueProducts();
}

async function deleteVenueProduct(productId) {
  if (!productId || !confirm("Bu ürünü silmek istiyor musun?")) return;

  const { error } = await supabaseClient
    .from("venue_products")
    .delete()
    .eq("id", productId);

  if (error) {
    showSafeError(error, "Ürün silinemedi.");
    return;
  }

  showToast("Ürün silindi");
  await refreshBusinessVenueProducts();
}

function renderBusinessEvents(events) {
  const list = document.getElementById("businessEventsList");

  if (!list) return;

  list.innerHTML = "";

  if (!events || events.length === 0) {
    renderEmptyState(
      list,
      "Henüz etkinlik yok",
      "Başlamak için mekanlarına etkinlik oluştur."
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
      "Henüz rezervasyon yok",
      "Mekanların için gelen rezervasyonlar burada görünecek."
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  const statuses = [
    ["all", "Tümü"],
    ["pending", "Beklemede"],
    ["approved", "Onaylandı"],
    ["rejected", "Reddedildi"],
    ["cancelled", "İptal Edildi"],
  ];
  const dateFilters = [
    ["all", "Tüm Tarihler"],
    ["today", "Bugün"],
    ["upcoming", "Yaklaşan"],
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
      `${getReservationStatusLabel(activeStatus)} rezervasyon yok`,
      "Bu filtreyle eşleşen yeni rezervasyon hareketleri burada görünecek."
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
  if (!time) return "Saat belirlenmedi";

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
    "Misafir"
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
    "Mekan"
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
    party.textContent = `${booking.partySize || 0} misafir`;
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
    ? `${entries.length} rezervasyon - ${pendingCount} beklemede`
    : `${entries.length} rezervasyon`;
  item.appendChild(heading);

  const guests = document.createElement("span");
  guests.textContent = `${totalGuests} misafir`;
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
  emptyCorner.textContent = "Saat";
  table.appendChild(emptyCorner);

  schedule.weekDates.forEach((date) => {
    const header = document.createElement("div");
    header.className =
      "reservation-schedule-cell reservation-schedule-head";
    header.textContent = date.toLocaleDateString("tr-TR", {
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
        available.textContent = "Uygun";
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
    newBadge.textContent = "Yeni";
    header.appendChild(newBadge);
  }

  content.appendChild(header);

  const meta = document.createElement("div");
  meta.className = "reservation-meta-grid";
  meta.appendChild(
    createReservationMeta(
      "Misafir",
      getReservationGuestLabel(reservation)
    )
  );
  meta.appendChild(
    createReservationMeta("Tarih", reservation.reservation_date)
  );
  meta.appendChild(
    createReservationMeta("Saat", reservation.reservation_time)
  );
  meta.appendChild(
    createReservationMeta(
      "Kişi",
      `${reservation.party_size || 0}`
    )
  );
  meta.appendChild(
    createReservationMeta(
      "Durum",
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
    approveButton.textContent = "Onayla";
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
    rejectButton.textContent = "Reddet";
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
  messageButton.textContent = "Kullanıcıya Mesaj Gönder";
  bindReservationAction(messageButton, () => {
    openReservationConversation(reservation.id);
  });
  actions.appendChild(messageButton);

  item.appendChild(content);
  item.appendChild(actions);

  return item;
}

function mergeBusinessRecords(records) {
  const seen = new Set();
  const merged = [];

  records.flat().forEach((record) => {
    const key = record && record.id ? String(record.id) : "";

    if (!key || seen.has(key)) return;

    seen.add(key);
    merged.push(record);
  });

  return merged;
}

function logBusinessStatusFields(records) {
  console.log(
    "[business-debug] status fields",
    (records || []).map((business) => ({
      id: business.id,
      owner_id: business.owner_id,
      status: business.status,
    }))
  );
}

async function queryBusinessRecordsByOwnerField(
  field,
  userId,
  options = {}
) {
  const { data, error } =
    await supabaseClient
      .from("businesses")
      .select("*")
      .eq(field, userId)
      .order("created_at", { ascending: false });

  if (error) {
    console.log("[business-debug] applications query error", {
      field,
      error,
    });
    if (options.showError) {
      showSafeError(error, "İşletmeler yüklenemedi.");
    }
    return [];
  }

  console.log("[business-debug] applications", {
    field,
    data,
  });

  return data || [];
}

async function loadBusinessBusinesses(session) {
  const userId = session && session.user ? session.user.id : "";

  console.log("[business-debug] user", userId);

  const businesses =
    await queryBusinessRecordsByOwnerField(
      "owner_id",
      userId,
      { showError: true }
    );

  logBusinessStatusFields(businesses);

  return businesses;
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
    showSafeError(error, "Mekanlar yüklenemedi.");
    return [];
  }

  console.log("[business-debug] approved venues", {
    businessIds,
    venues: data,
  });
  console.log(
    "[business-debug] venue relationship fields",
    (data || []).map((venue) => ({
      id: venue.id,
      business_id: venue.business_id,
      status: venue.status,
      verification_status: venue.verification_status,
    }))
  );

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
    showSafeError(error, "Etkinlikler yüklenemedi.");
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
    showSafeError(error, "Rezervasyonlar yüklenemedi.");
    return [];
  }

  return data || [];
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
    showSafeError(favoritesResult.error, "Analitik tam yüklenemedi.");
  } else {
    analytics.totalFavorites =
      (favoritesResult.data || []).length;
  }

  if (reviewsResult.error) {
    showSafeError(reviewsResult.error, "Analitik tam yüklenemedi.");
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
    showSafeError(attendeesResult.error, "Analitik tam yüklenemedi.");
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
    updateBusinessDashboardEmptyState();
    renderBusinessAnalytics(getEmptyBusinessAnalytics());
    populateBusinessDashboardSelects();
    populateBusinessMenuVenueSelect();
    populateBusinessStoreVenueSelect();
    renderBusinessVenues([]);
    renderBusinessEvents([]);
    renderBusinessReservations([]);
    renderBusinessReservationSchedule([]);
    updateBusinessBookingVenueOptions();
    renderBusinessOperatingHourRows([]);
    renderBusinessBookingRules(null);
    renderBusinessBlackoutDates([]);
    setBusinessBookingStatus(
      "Rezervasyon ayarlarını yönetmek için onaylı bir işletme ve mekan ekle."
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
  updateBusinessDashboardEmptyState();
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

  renderBusinessAnalytics(await loadBusinessAnalytics());
}

async function saveBusinessVenue(event) {
  event.preventDefault();

  const user =
    businessDashboardState.session &&
    businessDashboardState.session.user;
  const id = getAdminValue("businessVenueId");
  const businessId = getAdminValue("businessVenueBusinessId");
  const latitudeValue =
    getAdminValue("businessVenueLatitude");
  const longitudeValue =
    getAdminValue("businessVenueLongitude");
  const hasLatitude = latitudeValue !== "";
  const hasLongitude = longitudeValue !== "";

  if (!user || !user.id) {
    showToast("Oturum bulunamadı. Lütfen tekrar giriş yap.");
    return;
  }

  const approvedBusiness = businessDashboardState.businesses.find(
    (business) =>
      String(business.id) === String(businessId) &&
      String(business.owner_id) === String(user.id) &&
      isApprovedBusinessRecord(business)
  );

  if (!approvedBusiness) {
    showToast("İşletmelerinden birini seç");
    return;
  }

  if (id && !ownsVenueRecord(id)) {
    showToast("Yalnızca kendi mekanlarını düzenleyebilirsin");
    return;
  }

  if (hasLatitude !== hasLongitude) {
    showToast("Enlem ve boylamı birlikte gir");
    return;
  }

  if (
    hasLatitude &&
    !hasValidCoordinate(latitudeValue, longitudeValue)
  ) {
    showToast("Enlem veya boylam geçerli aralıkta değil");
    return;
  }

  const imageFile = getAdminFile("businessVenueImageFile");
  const uploadedImage = imageFile
    ? await uploadAdminImage(imageFile, "venues")
    : "";

  if (imageFile && !uploadedImage) return;

  const galleryUrls = getVenueGalleryUrls(
    "businessVenueGalleryUrls"
  );
  const galleryFiles = getAdminFiles("businessVenueGalleryFiles");
  const uploadedGalleryUrls = galleryFiles.length
    ? await uploadVenueGalleryFiles("businessVenueGalleryFiles")
    : [];
  const galleryImageUrls = [
    ...galleryUrls,
    ...uploadedGalleryUrls,
  ];

  if (galleryFiles.length && uploadedGalleryUrls.length === 0) {
    return;
  }

  const payload = {
    business_id: approvedBusiness.id,
    name: getAdminValue("businessVenueName"),
    city: getAdminValue("businessVenueCity"),
    category: getVenueCategoryValue({
      category: getAdminValue("businessVenueCategory"),
    }),
    image:
      uploadedImage || getAdminValue("businessVenueImage"),
    address: getAdminValue("businessVenueAddress"),
    latitude: hasLatitude ? Number(latitudeValue) : null,
    longitude: hasLongitude ? Number(longitudeValue) : null,
    description: getAdminValue("businessVenueDescription"),
  };

  console.log("[venue-insert-debug] payload", payload);
  console.log("[venue-insert-debug] user", user.id);
  console.log("[venue-insert-debug] approved business", approvedBusiness);

  let error = null;
  let savedVenueId = id;

  if (id) {
    ({ error } = await supabaseClient
      .from("venues")
      .update(payload)
      .eq("id", id)
      .in("business_id", getBusinessDashboardBusinessIds()));
  } else if (galleryImageUrls.length === 0) {
    ({ error } = await supabaseClient
      .from("venues")
      .insert([payload]));
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
    showSafeError(error, "Mekan kaydedilemedi.");
    return;
  }

  await saveVenueGalleryPhotos(savedVenueId, galleryImageUrls);

  showToast(id ? "Mekan güncellendi" : "Mekan oluşturuldu");
  clearBusinessVenueForm();
  await refreshBusinessDashboard();
}

async function saveBusinessEvent(event) {
  event.preventDefault();

  const id = getAdminValue("businessEventId");
  const venueId = getAdminValue("businessEventVenueId");

  if (!ownsVenueRecord(venueId)) {
    showToast("Mekanlarından birini seç");
    return;
  }

  if (
    id &&
    !businessDashboardState.events.some(
      (eventItem) => String(eventItem.id) === String(id)
    )
  ) {
    showToast("Yalnızca kendi etkinliklerini düzenleyebilirsin");
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
    showSafeError(error, "Etkinlik kaydedilemedi.");
    return;
  }

  showToast(id ? "Etkinlik güncellendi" : "Etkinlik oluşturuldu");
  clearBusinessEventForm();
  await refreshBusinessDashboard();
}

async function deleteBusinessVenue(id) {
  if (!ownsVenueRecord(id)) {
    showToast("Yalnızca kendi mekanlarını silebilirsin");
    return;
  }

  if (!confirm("Bu mekanı silmek istiyor musun?")) return;

  const { error } =
    await supabaseClient
      .from("venues")
      .delete()
      .eq("id", id)
      .in("business_id", getBusinessDashboardBusinessIds());

  if (error) {
    showSafeError(error, "Mekan silinemedi.");
    return;
  }

  showToast("Mekan silindi");
  await refreshBusinessDashboard();
}

async function deleteBusinessEvent(id) {
  const eventRecord = businessDashboardState.events.find(
    (eventItem) => String(eventItem.id) === String(id)
  );

  if (!eventRecord || !ownsVenueRecord(eventRecord.venue_id)) {
    showToast("Yalnızca kendi etkinliklerini silebilirsin");
    return;
  }

  if (!confirm("Bu etkinliği silmek istiyor musun?")) return;

  const { error } =
    await supabaseClient
      .from("events")
      .delete()
      .eq("id", id)
      .in("venue_id", getBusinessDashboardVenueIds());

  if (error) {
    showSafeError(error, "Etkinlik silinemedi.");
    return;
  }

  showToast("Etkinlik silindi");
  await refreshBusinessDashboard();
}

async function updateBusinessReservationStatus(id, status) {
  const reservation =
    businessDashboardState.reservations.find(
      (item) => String(item.id) === String(id)
    );
  const normalizedStatus = getReservationStatusValue(status);

  if (!reservation || !ownsVenueRecord(reservation.venue_id)) {
    showToast("Yalnızca kendi rezervasyonlarını güncelleyebilirsin");
    return;
  }

  if (!isPendingReservation(reservation)) {
    showToast("Yalnızca bekleyen rezervasyonlar güncellenebilir.");
    return;
  }

  if (!["approved", "rejected"].includes(normalizedStatus)) {
    showToast("Geçersiz rezervasyon durumu.");
    return;
  }

  let error = null;
  let updatedReservation = null;

  try {
    const rpcResult = await supabaseClient.rpc(
      "update_business_reservation_status",
      {
        reservation_id: Number(id),
        new_status: normalizedStatus,
      }
    );

    error = rpcResult.error;
    updatedReservation = Array.isArray(rpcResult.data)
      ? rpcResult.data[0]
      : rpcResult.data;
  } catch (rpcError) {
    error = rpcError;
  }

  if (
    error &&
    isSupabaseRpcUnavailable(
      error,
      "update_business_reservation_status"
    )
  ) {
    const fallbackResult = await supabaseClient
      .from("reservations")
      .update({ status: normalizedStatus })
      .eq("id", id)
      .eq("status", "pending")
      .in("venue_id", getBusinessDashboardVenueIds())
      .select("*")
      .maybeSingle();

    error = fallbackResult.error;
    updatedReservation = fallbackResult.data;
  }

  if (error) {
    showSafeError(error, "Rezervasyon durumu güncellenemedi.");
    return;
  }

  if (!updatedReservation) {
    showToast("Rezervasyon zaten güncellenmiş olabilir.");
    await refreshBusinessDashboard();
    return;
  }

  showToast(
    `Rezervasyon ${getReservationStatusLabel(normalizedStatus)}`
  );
  notifyUserReservationStatus(
    {
      ...reservation,
      ...updatedReservation,
    },
    normalizedStatus
  );
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
  select.innerHTML = '<option value="">Mekan Seç</option>';

  businessDashboardState.venues.forEach((venue) => {
    const option = document.createElement("option");
    option.value = venue.id;
    option.textContent = safeText(venue.name) || `Mekan #${venue.id}`;
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
    closedLabel.append("Kapalı");
    row.appendChild(closedLabel);

    const opensLabel = document.createElement("label");
    opensLabel.textContent = "Açılış";
    const opensInput = document.createElement("input");
    opensInput.type = "time";
    opensInput.dataset.bookingOpens = "true";
    opensInput.value = rowData.opens_at
      ? String(rowData.opens_at).slice(0, 5)
      : "18:00";
    opensLabel.appendChild(opensInput);
    row.appendChild(opensLabel);

    const closesLabel = document.createElement("label");
    closesLabel.textContent = "Kapanış";
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
    empty.textContent = "Henüz kapalı tarih yok.";
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
    button.textContent = "Sil";
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
      "Rezervasyon ayarlarını düzenlemeden önce sana ait bir mekan oluştur."
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
      "Rezervasyon ayarları yüklenemedi.",
      "error"
    );
  }
}

async function saveBusinessBookingSettings(event) {
  event.preventDefault();

  const venueId = getSelectedBusinessBookingVenueId();

  if (!venueId || !ownsVenueRecord(venueId)) {
    setBusinessBookingStatus(
      "Kaydetmeden önce sana ait bir mekan seç.",
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

    showToast("Rezervasyon ayarları kaydedildi.");
    await loadBusinessBookingSettings();
  } catch (error) {
    console.warn("Booking settings could not be saved.", error);
    setBusinessBookingStatus(
      "Rezervasyon ayarları kaydedilemedi.",
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
      "Kapalı tarih eklemeden önce mekan ve tarih seç.",
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
    showToast("Kapalı tarih eklendi.");
    await loadBusinessBookingSettings();
  } catch (error) {
    console.warn("Blackout date could not be added.", error);
    setBusinessBookingStatus(
      "Kapalı tarih eklenemedi.",
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

    showToast("Kapalı tarih silindi.");
    await loadBusinessBookingSettings();
  } catch (error) {
    console.warn("Blackout date could not be deleted.", error);
    setBusinessBookingStatus(
      "Kapalı tarih silinemedi.",
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
  setupBusinessApplicationForm(session.user.id);
  setupBusinessCreationButtons();
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
runSafeInitializer("initAuthPage", initAuthPage);
runSafeInitializer("loadVenues", loadVenues);
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
