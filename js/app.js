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
const signupFullName = document.getElementById("signupFullName");
const signupUsername = document.getElementById("signupUsername");
const signupUsernameStatus = document.getElementById(
  "signupUsernameStatus"
);
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
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return safeText(value.message);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    const messageLike =
      value.message ||
      value.error ||
      value.description ||
      value.code;

    if (messageLike !== undefined && messageLike !== null) {
      return safeText(messageLike);
    }

    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }

  return String(value);
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

function normalizeUsernameValue(value) {
  return safeText(value).trim().toLowerCase();
}

function isValidUsernameFormat(username) {
  return /^[a-z0-9_]{3,20}$/.test(normalizeUsernameValue(username));
}

function setUsernameStatusMessage(element, message, status = "info") {
  if (!element) return;
  element.textContent = safeText(message);
  element.dataset.status = status;
}

async function isUsernameAvailable(username, excludeUserId = null) {
  const normalized = normalizeUsernameValue(username);

  if (!isValidUsernameFormat(normalized)) {
    return false;
  }

  try {
    const { data, error } = await supabaseClient.rpc(
      "check_username_available",
      {
        p_username: normalized,
        p_exclude_user_id: excludeUserId || null,
      }
    );

    if (!error) return data === true;
  } catch (rpcError) {
    console.warn("Username RPC unavailable.", rpcError);
  }

  let query = supabaseClient
    .from("profiles")
    .select("id")
    .eq("username", normalized);

  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  const { data: rows, error } = await query.limit(1);

  if (error) {
    console.warn(error);
    return false;
  }

  return !(rows && rows.length);
}

async function loadUserProfile(userId) {
  if (!userId) return null;
  return loadProfileRecordByUserId(userId);
}

async function upsertUserProfile(userId, fields = {}) {
  if (!userId) return { error: { message: "User required" } };

  const payload = {
    id: userId,
    updated_at: new Date().toISOString(),
  };

  if (fields.full_name !== undefined) {
    payload.full_name = safeText(fields.full_name).trim();
  }

  if (fields.username !== undefined) {
    payload.username = normalizeUsernameValue(fields.username);
  }

  if (fields.bio !== undefined) {
    payload.bio = safeText(fields.bio).trim();
  }

  if (fields.avatar_url !== undefined) {
    payload.avatar_url = safeText(fields.avatar_url).trim();
  }

  return supabaseClient
    .from("profiles")
    .upsert(payload, { onConflict: "id" });
}

async function syncProfileFromAuthMetadata(session) {
  if (!session || !session.user) return;

  const metadata = session.user.user_metadata || {};
  const username =
    metadata.username || metadata.preferred_username || "";
  const fullName = metadata.full_name || metadata.name || "";

  if (!username && !fullName) return;

  const existing = await loadUserProfile(session.user.id);

  if (existing && existing.username && existing.full_name) return;

  await upsertUserProfile(session.user.id, {
    username: existing && existing.username ? existing.username : username,
    full_name:
      existing && existing.full_name ? existing.full_name : fullName,
  });
}

function renderProfileAvatarElement(element, profile) {
  if (!element) return;

  element.innerHTML = "";
  const avatar = getProfileAvatar(profile);
  const label =
    getProfileDisplayName(profile).charAt(0).toUpperCase() || "T";

  if (avatar) {
    const image = document.createElement("img");
    image.src = getImage(avatar);
    image.alt = getProfileDisplayName(profile);
    image.addEventListener(
      "error",
      () => {
        element.textContent = label;
      },
      { once: true }
    );
    element.appendChild(image);
    return;
  }

  element.textContent = label;
}

async function loadAndRenderProfileIdentity(userId) {
  const profile = await loadUserProfile(userId);

  const displayName = document.getElementById("profileDisplayName");
  const usernameLine = document.getElementById("profileUsernameLine");
  const bioLine = document.getElementById("profileBioLine");
  const avatar = document.getElementById("profileAvatar");

  if (displayName) {
    displayName.textContent = getProfileDisplayName(profile);
  }

  if (usernameLine) {
    const username = safeText(profile && profile.username);
    usernameLine.textContent = username ? `@${username}` : "";
  }

  if (bioLine) {
    bioLine.textContent = safeText(profile && profile.bio) || "";
  }

  renderProfileAvatarElement(avatar, profile);

  const form = document.getElementById("profileIdentityForm");
  if (!form || form.dataset.bound === "true") return;

  form.dataset.bound = "true";

  const fullNameInput = document.getElementById("profileEditFullName");
  const usernameInput = document.getElementById("profileEditUsername");
  const bioInput = document.getElementById("profileEditBio");
  const avatarUrlInput = document.getElementById("profileEditAvatarUrl");
  const usernameStatus = document.getElementById("profileEditUsernameStatus");

  if (profile) {
    if (fullNameInput) fullNameInput.value = safeText(profile.full_name);
    if (usernameInput) usernameInput.value = safeText(profile.username);
    if (bioInput) bioInput.value = safeText(profile.bio);
    if (avatarUrlInput) avatarUrlInput.value = safeText(profile.avatar_url);
  }

  if (usernameInput) {
    usernameInput.addEventListener("input", async () => {
      const value = normalizeUsernameValue(usernameInput.value);
      if (!value) {
        setUsernameStatusMessage(usernameStatus, "");
        return;
      }
      if (!isValidUsernameFormat(value)) {
        setUsernameStatusMessage(
          usernameStatus,
          "Geçersiz format",
          "error"
        );
        return;
      }
      const available = await isUsernameAvailable(value, userId);
      setUsernameStatusMessage(
        usernameStatus,
        available ? "Kullanılabilir" : "Alınmış",
        available ? "ok" : "error"
      );
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = fullNameInput ? fullNameInput.value.trim() : "";
    const username = usernameInput
      ? normalizeUsernameValue(usernameInput.value)
      : "";

    if (!fullName) {
      showToast("Ad soyad gerekli");
      return;
    }

    if (!isValidUsernameFormat(username)) {
      showToast("Geçersiz kullanıcı adı");
      return;
    }

    if (!(await isUsernameAvailable(username, userId))) {
      showToast("Bu kullanıcı adı alınmış");
      return;
    }

    let avatarUrl = avatarUrlInput ? avatarUrlInput.value.trim() : "";
    const avatarFile = document.getElementById("profileEditAvatarFile");
    const file =
      avatarFile && avatarFile.files && avatarFile.files[0]
        ? avatarFile.files[0]
        : null;

    if (file) {
      const uploaded = await uploadAdminImage(file, `avatars/${userId}`);
      if (!uploaded) return;
      avatarUrl = uploaded;
    }

    const { error } = await upsertUserProfile(userId, {
      full_name: fullName,
      username,
      bio: bioInput ? bioInput.value : "",
      avatar_url: avatarUrl,
    });

    if (error) {
      showSafeError(error, "Profil kaydedilemedi.");
      return;
    }

    showToast("Profil güncellendi");
    await loadAndRenderProfileIdentity(userId);
  });
}

function validateAuthForm(mode) {
  const isSignup = mode === "signup";
  const confirmInput = document.getElementById("confirmPassword");
  const emailValue = normalizeEmail(email && email.value);
  const passwordValue = password ? password.value : "";
  const fullNameValue = signupFullName
    ? signupFullName.value.trim()
    : "";
  const usernameValue = signupUsername
    ? normalizeUsernameValue(signupUsername.value)
    : "";

  setFieldValidity(email, true);
  setFieldValidity(password, true);
  setFieldValidity(confirmInput, true);
  setFieldValidity(signupFullName, true);
  setFieldValidity(signupUsername, true);

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

    if (!fullNameValue) {
      setFieldValidity(signupFullName, false);
      return {
        ok: false,
        message: "Ad soyadını gir.",
      };
    }

    if (!isValidUsernameFormat(usernameValue)) {
      setFieldValidity(signupUsername, false);
      return {
        ok: false,
        message: "Kullanıcı adı 3-20 karakter (a-z, 0-9, _) olmalı.",
      };
    }
  }

  return {
    ok: true,
    email: emailValue,
    password: passwordValue,
    fullName: fullNameValue,
    username: usernameValue,
  };
}

function translateAuthError(error, fallback) {
  const message = String(safeText(error && error.message) || "")
    .toLowerCase();
  const status = String(safeText(error && error.status) || "")
    .toLowerCase();
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

  if (
    combined.includes("429") ||
    combined.includes("too many requests") ||
    combined.includes("rate limit")
  ) {
    return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.";
  }

  return fallback || safeText(error);
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

const venueGalleryCarouselState = {
  photos: [],
  index: 0,
};

function openVenueGalleryLightbox(imageUrl) {
  let lightbox = document.getElementById("venueGalleryLightbox");

  if (!lightbox) {
    lightbox = document.createElement("div");
    lightbox.id = "venueGalleryLightbox";
    lightbox.className = "venue-gallery-lightbox";
    lightbox.hidden = true;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "venue-gallery-lightbox-close";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", () => {
      lightbox.hidden = true;
    });
    lightbox.appendChild(closeBtn);

    const image = document.createElement("img");
    image.id = "venueGalleryLightboxImage";
    image.alt = "Venue photo";
    lightbox.appendChild(image);

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.hidden = true;
    });

    document.body.appendChild(lightbox);
  }

  const image = document.getElementById("venueGalleryLightboxImage");
  if (image) image.src = getImage(imageUrl);
  lightbox.hidden = false;
}

function setVenueGalleryCarouselIndex(nextIndex) {
  const photos = venueGalleryCarouselState.photos;
  if (!photos.length) return;

  const total = photos.length;
  venueGalleryCarouselState.index =
    ((nextIndex % total) + total) % total;

  const photo = photos[venueGalleryCarouselState.index];
  const imageUrl = safeText(photo.image_url || photo.image);
  const slide = document.getElementById("venueGallerySlide");
  const thumbs = document.getElementById("venueGalleryThumbs");

  if (slide) {
    slide.src = getImage(imageUrl);
    slide.onclick = () => openVenueGalleryLightbox(imageUrl);
  }

  if (thumbs) {
    thumbs.querySelectorAll(".venue-gallery-thumb").forEach((button, idx) => {
      button.classList.toggle("is-active", idx === venueGalleryCarouselState.index);
    });
  }
}

function setupVenueGalleryCarouselTouch() {
  const main = document.querySelector(".venue-gallery-main");
  if (!main || main.dataset.touchBound === "true") return;

  main.dataset.touchBound = "true";
  let startX = 0;

  main.addEventListener(
    "touchstart",
    (event) => {
      startX = event.changedTouches[0].clientX;
    },
    { passive: true }
  );

  main.addEventListener(
    "touchend",
    (event) => {
      const delta = event.changedTouches[0].clientX - startX;
      if (Math.abs(delta) < 40) return;
      setVenueGalleryCarouselIndex(
        venueGalleryCarouselState.index + (delta < 0 ? 1 : -1)
      );
    },
    { passive: true }
  );
}

function renderVenueGallery(photos) {
  const legacyGallery = document.getElementById("venueGallery");
  const carousel = document.getElementById("venueGalleryCarousel");
  const thumbs = document.getElementById("venueGalleryThumbs");
  const slide = document.getElementById("venueGallerySlide");
  const prevBtn = document.getElementById("venueGalleryPrev");
  const nextBtn = document.getElementById("venueGalleryNext");

  const validPhotos = (photos || []).filter((photo) =>
    safeText(photo.image_url || photo.image)
  );

  venueGalleryCarouselState.photos = validPhotos;
  venueGalleryCarouselState.index = 0;

  if (legacyGallery) {
    legacyGallery.innerHTML = "";
    legacyGallery.hidden = true;
  }

  if (!carousel || !slide) {
    if (legacyGallery && validPhotos.length) {
      legacyGallery.hidden = false;
      validPhotos.forEach((photo) => {
        const item = createGalleryPhotoLink(photo);
        if (item) legacyGallery.appendChild(item);
      });
    }
    return;
  }

  if (!validPhotos.length) {
    carousel.hidden = true;
    return;
  }

  carousel.hidden = false;

  if (thumbs) {
    thumbs.innerHTML = "";
    validPhotos.forEach((photo, index) => {
      const imageUrl = safeText(photo.image_url || photo.image);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "venue-gallery-thumb";
      const image = document.createElement("img");
      image.src = getImage(imageUrl);
      image.alt = `Thumbnail ${index + 1}`;
      button.appendChild(image);
      button.addEventListener("click", () => setVenueGalleryCarouselIndex(index));
      thumbs.appendChild(button);
    });
  }

  if (prevBtn && !prevBtn.dataset.bound) {
    prevBtn.dataset.bound = "true";
    prevBtn.addEventListener("click", () => {
      setVenueGalleryCarouselIndex(venueGalleryCarouselState.index - 1);
    });
  }

  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = "true";
    nextBtn.addEventListener("click", () => {
      setVenueGalleryCarouselIndex(venueGalleryCarouselState.index + 1);
    });
  }

  setVenueGalleryCarouselIndex(0);
  setupVenueGalleryCarouselTouch();
}

/** @deprecated Legacy venue.html accordion (venue_menu_*). Use renderVenueOrderCta + restaurant-menu.html. */
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

/** @deprecated Legacy venue.html menu cards (venue_menu_items). */
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

/** @deprecated Legacy venue.html menu renderer (venue_menu_*). */
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

/** @deprecated Legacy venue_menu_categories / venue_menu_items loader for venue.html. */
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

if (signupUsername) {
  signupUsername.addEventListener("input", async () => {
    const value = normalizeUsernameValue(signupUsername.value);
    if (!value) {
      setUsernameStatusMessage(signupUsernameStatus, "");
      return;
    }
    if (!isValidUsernameFormat(value)) {
      setUsernameStatusMessage(
        signupUsernameStatus,
        "Geçersiz format",
        "error"
      );
      return;
    }
    const available = await isUsernameAvailable(value);
    setUsernameStatusMessage(
      signupUsernameStatus,
      available ? "Kullanılabilir" : "Alınmış",
      available ? "ok" : "error"
    );
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
      const usernameAvailable = await isUsernameAvailable(
        validation.username
      );

      if (!usernameAvailable) {
        setAuthMessage("Bu kullanıcı adı alınmış.", "error");
        setUsernameStatusMessage(
          signupUsernameStatus,
          "Alınmış",
          "error"
        );
        return;
      }

      setUsernameStatusMessage(
        signupUsernameStatus,
        "Kullanılabilir",
        "ok"
      );

      const { data, error } =
        await supabaseClient.auth.signUp({
          email: validation.email,
          password: validation.password,
          options: {
            emailRedirectTo: getAuthEmailRedirectTo(),
            data: {
              full_name: validation.fullName,
              username: validation.username,
              preferred_username: validation.username,
            },
          },
        });

      if (error) {
        setAuthMessage(
          translateAuthError(error, "Kayıt oluşturulamadı."),
          "error"
        );
        return;
      }

      if (data && data.user) {
        const profileResult = await upsertUserProfile(data.user.id, {
          full_name: validation.fullName,
          username: validation.username,
        });

        if (profileResult.error) {
          setAuthMessage(
            "Hesap oluştu ancak profil kaydı tamamlanamadı. Profilden tekrar dene.",
            "error"
          );
          return;
        }
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

  await syncProfileFromAuthMetadata(session);

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
    await syncProfileFromAuthMetadata(session);
    ensureBusinessApplicationSection();
    setupProfileMobilePanels();
    setupBusinessApplicationForm(session.user.id);
    await loadProfileStats(session.user.id);
    await loadAndRenderProfileIdentity(session.user.id);
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
  await renderVenueOrderCta(venue.id);
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
  const isAdminShell =
    document.getElementById("adminPage") ||
    document.getElementById("adminCouriersPage") ||
    document.getElementById("adminDeliveriesPage");

  if (!isAdminShell) return null;

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
  return (
    params.get("conversation") ||
    params.get("conversation_id") ||
    ""
  );
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

const AI_CONCIERGE_CONVERSATION_ID = "ai-concierge";
const AI_CONCIERGE_BOT_SENDER_ID = "ai-concierge-assistant";
let aiConciergePending = false;

function isAIConciergeConversationId(conversationId) {
  return String(conversationId) === AI_CONCIERGE_CONVERSATION_ID;
}

function isAIConciergeConversation(conversation) {
  return (
    conversation && isAIConciergeConversationId(conversation.id)
  );
}

function buildAIConciergeConversation() {
  return {
    id: AI_CONCIERGE_CONVERSATION_ID,
    conversation_type: "ai_concierge",
    name: "Tanıdık AI",
    description: "Mekan, etkinlik ve gece planı önerileri",
    updated_at: new Date().toISOString(),
  };
}

function getAIConciergeStorageKey(userId) {
  return `tanidik.ai-concierge.v1.${String(userId)}`;
}

function loadAIConciergeMessagesFromStorage(userId) {
  if (!userId) return [];

  try {
    const raw = window.localStorage.getItem(
      getAIConciergeStorageKey(userId)
    );
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    const messages = Array.isArray(parsed?.messages)
      ? parsed.messages
      : [];

    return messages
      .filter((message) => safeText(message.body))
      .map((message, index) => ({
        id:
          safeText(message.id) ||
          `ai-local-${index}-${message.created_at || ""}`,
        sender_id: safeText(message.sender_id),
        body: safeText(message.body),
        created_at:
          message.created_at || new Date().toISOString(),
      }));
  } catch (error) {
    console.log(error);
    return [];
  }
}

function saveAIConciergeMessagesToStorage(userId, messages) {
  if (!userId) return;

  try {
    window.localStorage.setItem(
      getAIConciergeStorageKey(userId),
      JSON.stringify({ messages: messages || [] })
    );
  } catch (error) {
    console.log(error);
  }
}

function hydrateAIConciergeInboxPreview(conversation, userId) {
  const messages = loadAIConciergeMessagesFromStorage(userId);
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage) {
    conversation.last_message_preview = "";
    conversation.last_message_at = "";
    conversation.last_message_sender_id = "";
    return;
  }

  conversation.last_message_preview = lastMessage.body;
  conversation.last_message_at = lastMessage.created_at || "";
  conversation.last_message_sender_id = lastMessage.sender_id || "";
}

function prependAIConciergeToInbox(conversations) {
  const aiConversation = buildAIConciergeConversation();
  hydrateAIConciergeInboxPreview(
    aiConversation,
    messageSessionUserId
  );
  return [aiConversation, ...(conversations || [])];
}

function getAIConciergeHistoryForApi(userId, messages) {
  return (messages || [])
    .slice(-8)
    .map((message) => ({
      role:
        String(message.sender_id) === String(userId)
          ? "user"
          : "assistant",
      content: safeText(message.body),
    }))
    .filter((item) => item.content);
}

function setAIConciergeQuickPromptsVisible(isVisible) {
  const panel = document.getElementById("aiConciergeQuickPrompts");
  if (!panel) return;
  panel.hidden = !isVisible;
}

function setAIConciergeTypingVisible(isVisible) {
  const indicator = document.getElementById(
    "conversationTypingIndicator"
  );
  if (!indicator) return;

  if (!isVisible) {
    indicator.innerHTML = "";
    indicator.hidden = true;
    return;
  }

  indicator.hidden = false;
  indicator.innerHTML =
    '<span class="ai-concierge-typing">Tanıdık AI yazıyor…</span>';
}

function renderAIConciergeEmptyState(container) {
  if (!container) return;

  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "ai-concierge-empty";

  const title = document.createElement("h3");
  title.textContent = "Bu gece için öneri iste";
  wrap.appendChild(title);

  const hint = document.createElement("p");
  hint.textContent =
    "Mekan, etkinlik veya gece planı için kısa bir soru yaz.";
  wrap.appendChild(hint);

  container.appendChild(wrap);
  setAIConciergeQuickPromptsVisible(true);
}

function setupAIConciergeQuickPrompts() {
  const panel = document.getElementById("aiConciergeQuickPrompts");
  if (!panel || panel.dataset.bound === "true") return;

  panel.dataset.bound = "true";

  panel.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-ai-prompt]");
    if (!button) return;

    const prompt = safeText(button.dataset.aiPrompt);
    if (!prompt) return;

    const bodyInput = document.getElementById("messageBody");
    if (bodyInput) {
      bodyInput.value = prompt;
    }

    await sendAIConciergeMessage(prompt);
  });
}

async function loadAIConciergeConversation() {
  const panel = document.getElementById("conversationPanel");
  const messagesContainer =
    document.getElementById("conversationMessages");

  if (!panel || !messagesContainer) return null;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    setMessageFormEnabled(false);
    window.location.href = "./auth.html";
    return null;
  }

  messageSessionUserId = session.user.id;
  stopConversationTypingPoll();
  setAIConciergeTypingVisible(false);

  const conversation = buildAIConciergeConversation();
  const messages = loadAIConciergeMessagesFromStorage(
    session.user.id
  );

  setMessageFormEnabled(true);
  updateMessageComposerForConversation(conversation);
  updateConversationHeader(conversation, session.user.id);
  resetConversationContextHeader();
  panel.dataset.conversationId = conversation.id;
  panel.dataset.userId = "";
  panel.dataset.businessOwnerId = "";

  if (!messages.length) {
    renderAIConciergeEmptyState(messagesContainer);
  } else {
    setAIConciergeQuickPromptsVisible(false);
    renderConversationMessages(
      messages,
      session.user.id,
      conversation,
      {},
      []
    );
    if (aiConciergePending) {
      appendAIConciergeLoadingBubble(
        messagesContainer,
        session.user.id
      );
    }
  }

  setupMessageForm(conversation.id);
  setupAIConciergeQuickPrompts();
  return conversation;
}

function appendAIConciergeLoadingBubble(container, sessionUserId) {
  if (!container) return;

  const row = document.createElement("div");
  row.className =
    "message-bubble-with-avatar ai-concierge-loading-row";
  row.id = "aiConciergeLoadingBubble";

  const avatar = document.createElement("div");
  avatar.className = "message-bubble-avatar";
  avatar.textContent = "🤖";
  row.appendChild(avatar);

  const bubble = document.createElement("div");
  bubble.className =
    "message-bubble message-bubble-content ai-concierge-loading-bubble";
  bubble.innerHTML =
    '<span class="ai-concierge-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
  row.appendChild(bubble);

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function removeAIConciergeLoadingBubble() {
  document
    .getElementById("aiConciergeLoadingBubble")
    ?.remove();
}

async function sendAIConciergeMessage(body) {
  const text = safeText(body);
  if (!text) {
    showToast("Write a message");
    return false;
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "./auth.html";
    return false;
  }

  if (aiConciergePending) {
    showToast("AI is still responding");
    return false;
  }

  const userId = session.user.id;
  const conversation = buildAIConciergeConversation();
  const messages = loadAIConciergeMessagesFromStorage(userId);
  const userMessage = {
    id: `ai-user-${Date.now()}`,
    sender_id: userId,
    body: text,
    created_at: new Date().toISOString(),
  };

  messages.push(userMessage);
  saveAIConciergeMessagesToStorage(userId, messages);
  hydrateAIConciergeInboxPreview(conversation, userId);

  const messagesContainer =
    document.getElementById("conversationMessages");
  setAIConciergeQuickPromptsVisible(false);

  if (messagesContainer) {
    renderConversationMessages(
      messages,
      userId,
      conversation,
      {},
      []
    );
  }

  aiConciergePending = true;
  setAIConciergeTypingVisible(true);
  appendAIConciergeLoadingBubble(messagesContainer, userId);

  try {
    const history = getAIConciergeHistoryForApi(
      userId,
      messages.slice(0, -1)
    );

    const { data, error } = await supabaseClient.functions.invoke(
      "ask-ai-concierge",
      {
        body: {
          message: text,
          history,
        },
      }
    );

    if (error) {
      throw error;
    }

    const reply = safeText(data?.reply);
    if (!reply) {
      throw new Error(
        safeText(data?.error) || "AI response unavailable"
      );
    }

    messages.push({
      id: `ai-bot-${Date.now()}`,
      sender_id: AI_CONCIERGE_BOT_SENDER_ID,
      body: reply,
      created_at: new Date().toISOString(),
    });
    saveAIConciergeMessagesToStorage(userId, messages);
    hydrateAIConciergeInboxPreview(conversation, userId);

    if (messagesContainer) {
      renderConversationMessages(
        messages,
        userId,
        conversation,
        {},
        []
      );
    }

    return true;
  } catch (error) {
    console.log(error);
    const message =
      error?.message ||
      (error?.context?.status === 429
        ? "Çok fazla istek. Biraz sonra tekrar dene."
        : "AI yanıt veremedi");
    showToast(message);
    return false;
  } finally {
    aiConciergePending = false;
    setAIConciergeTypingVisible(false);
    removeAIConciergeLoadingBubble();
  }
}

function getConversationIdFromNotificationLink(linkUrl) {
  if (!linkUrl) return "";

  try {
    const url = new URL(linkUrl, window.location.href);
    const path = url.pathname.split("/").pop();

    if (path !== "messages.html") return "";

    return (
      url.searchParams.get("conversation") ||
      url.searchParams.get("conversation_id") ||
      ""
    );
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

  if (isAIConciergeConversation(conversation)) {
    return "Tanıdık AI";
  }

  if (isDirectConversation(conversation)) {
    const fullName =
      safeText(conversation.direct_participant_full_name) ||
      safeText(conversation.direct_participant_name);
    const username = safeText(conversation.direct_participant_username);

    if (fullName && username) {
      return `${fullName} (@${username})`;
    }

    return fullName || (username ? `@${username}` : "Direct message");
  }

  if (conversation.reservation_id) {
    const businessName = safeText(conversation.business_display_name);
    return businessName
      ? `${businessName} · Rezervasyon #${conversation.reservation_id}`
      : `Reservation #${conversation.reservation_id}`;
  }

  if (safeText(conversation.business_display_name)) {
    return safeText(conversation.business_display_name);
  }

  return `Conversation #${safeText(conversation.id)}`;
}

function getConversationSubtitle(conversation) {
  if (isAIConciergeConversation(conversation)) {
    return (
      safeText(conversation.description) ||
      "Mekan, etkinlik ve gece planı önerileri"
    );
  }

  const parts = [];

  if (isDirectConversation(conversation)) {
    const username = safeText(conversation.direct_participant_username);
    if (username) parts.push(`@${username}`);
    parts.push("Direct message");
  }

  if (safeText(conversation.business_display_name)) {
    parts.push(safeText(conversation.business_display_name));
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

  if (isAIConciergeConversation(conversation)) {
    return "AI Concierge";
  }

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

  if (
    String(message.sender_id) === AI_CONCIERGE_BOT_SENDER_ID
  ) {
    return "Tanıdık AI";
  }

  if (isDirectConversation(conversation)) {
    const fullName =
      safeText(conversation.direct_participant_full_name) ||
      safeText(conversation.direct_participant_name);
    const username = safeText(conversation.direct_participant_username);
    if (fullName && username) return `${fullName} (@${username})`;
    return fullName || (username ? `@${username}` : "Profile");
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
    return (
      safeText(conversation.business_display_name) || "Business"
    );
  }

  return "Message";
}

function createMessageThreadAvatar(conversation) {
  const avatar = document.createElement("div");
  avatar.className = "message-thread-avatar";

  if (isAIConciergeConversation(conversation)) {
    avatar.classList.add("message-thread-avatar--ai");
    avatar.textContent = "🤖";
    return avatar;
  }

  if (isDirectConversation(conversation)) {
    const imageUrl = safeText(conversation.direct_participant_avatar);
    const label =
      getProfileDisplayName({
        full_name: conversation.direct_participant_full_name,
        username: conversation.direct_participant_username,
        display_name: conversation.direct_participant_name,
      }).charAt(0) || "U";

    if (imageUrl) {
      const image = document.createElement("img");
      image.src = getImage(imageUrl);
      image.alt = "";
      image.addEventListener("error", () => {
        avatar.textContent = label;
      }, { once: true });
      avatar.appendChild(image);
    } else {
      avatar.textContent = label;
    }
    return avatar;
  }

  avatar.textContent = safeText(conversation.business_display_name)
    .charAt(0)
    .toUpperCase() || "B";
  return avatar;
}

function createMessageBubbleAvatar(conversation, sessionUserId) {
  const avatar = document.createElement("div");
  avatar.className = "message-bubble-avatar";

  if (isAIConciergeConversation(conversation)) {
    avatar.textContent = "🤖";
    return avatar;
  }

  if (isDirectConversation(conversation)) {
    const imageUrl = safeText(conversation.direct_participant_avatar);
    const label =
      getProfileDisplayName({
        full_name: conversation.direct_participant_full_name,
        username: conversation.direct_participant_username,
        display_name: conversation.direct_participant_name,
      }).charAt(0) || "U";

    if (imageUrl) {
      const image = document.createElement("img");
      image.src = getImage(imageUrl);
      image.alt = "";
      avatar.appendChild(image);
    } else {
      avatar.textContent = label;
    }
    return avatar;
  }

  avatar.textContent =
    String(conversation.business_owner_id) === String(sessionUserId)
      ? "B"
      : "G";
  return avatar;
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
    conversation.direct_participant_full_name = safeText(
      profile && profile.full_name
    );
    conversation.direct_participant_username = safeText(
      profile && profile.username
    );
    conversation.direct_participant_avatar = getProfileAvatar(profile);
  });
}

async function hydrateConversationBusinessNames(conversations) {
  const ownerIds = [
    ...new Set(
      (conversations || [])
        .map((c) => c.business_owner_id)
        .filter(Boolean)
    ),
  ];

  if (!ownerIds.length) return;

  const { data: businesses } = await supabaseClient
    .from("businesses")
    .select("owner_id, name")
    .in("owner_id", ownerIds);

  const nameByOwner = new Map(
    (businesses || []).map((b) => [String(b.owner_id), b.name])
  );

  (conversations || []).forEach((conversation) => {
    if (conversation.business_owner_id) {
      conversation.business_display_name =
        nameByOwner.get(String(conversation.business_owner_id)) || "";
    }
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
  const attachControl = document.querySelector(
    ".message-attach-control"
  );
  const attachInput = document.getElementById(
    "messageAttachmentImage"
  );
  const isAi = isAIConciergeConversation(conversation);

  if (attachControl) {
    attachControl.hidden = isAi;
  }

  if (attachInput && isAi) {
    attachInput.value = "";
  }

  if (!bodyInput) return;

  if (isAi) {
    bodyInput.placeholder = "Gece planı için sor...";
    return;
  }

  setAIConciergeQuickPromptsVisible(false);

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

  const conversations = data || [];

  if (error) {
    console.log(error);
  }

  if (!error) {
    await hydrateDirectConversationProfiles(conversations);
    await hydrateConversationBusinessNames(conversations);
    await hydrateConversationPreviews(conversations);
  }

  const inboxThreads = prependAIConciergeToInbox(conversations);
  renderMessageInbox(inboxThreads);
  return inboxThreads;
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
      "Henüz mesaj yok",
      "Rezervasyon veya doğrudan mesajlar burada görünecek."
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

    link.appendChild(createMessageThreadAvatar(conversation));

    const body = document.createElement("div");
    body.className = "message-thread-body";

    const topRow = document.createElement("div");
    topRow.className = "message-thread-top";

    const title = document.createElement("strong");
    title.className = "message-thread-title";
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

    body.appendChild(topRow);

    const subtitle = getConversationSubtitle(conversation);

    if (isDirectConversation(conversation)) {
      const identity = document.createElement("span");
      identity.className = "message-thread-identity-line";
      const username = safeText(conversation.direct_participant_username);
      identity.textContent = username
        ? `@${username} · ${safeText(conversation.direct_participant_full_name) || ""}`
        : safeText(conversation.direct_participant_full_name);
      body.appendChild(identity);
    }

    if (subtitle) {
      const meta = document.createElement("span");
      meta.className = "message-thread-meta";
      meta.textContent = subtitle;
      body.appendChild(meta);
    }

    if (conversation.last_message_preview) {
      const preview = document.createElement("p");
      preview.className = "message-thread-preview";
      const isOwnPreview =
        conversation.last_message_sender_id &&
        String(conversation.last_message_sender_id) ===
          String(messageSessionUserId || "");
      const isAiReply =
        isAIConciergeConversation(conversation) &&
        String(conversation.last_message_sender_id) ===
          AI_CONCIERGE_BOT_SENDER_ID;
      preview.textContent = isOwnPreview
        ? `Sen: ${conversation.last_message_preview}`
        : isAiReply
          ? `Tanıdık AI: ${conversation.last_message_preview}`
          : conversation.last_message_preview;
      body.appendChild(preview);
    }

    link.appendChild(body);
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
    setAIConciergeQuickPromptsVisible(false);
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

  if (isAIConciergeConversationId(conversationId)) {
    setAIConciergeQuickPromptsVisible(false);
    return loadAIConciergeConversation();
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
  await hydrateConversationBusinessNames([conversation]);
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
    if (isAIConciergeConversation(conversation)) {
      renderAIConciergeEmptyState(messagesContainer);
      return;
    }

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
    const isOwnMessage =
      String(message.sender_id) === String(sessionUserId);
    const isGrouped =
      previousSenderId &&
      String(previousSenderId) === String(message.sender_id);

    const row = document.createElement("div");
    row.className = isOwnMessage
      ? "message-bubble-with-avatar message-bubble-row--own"
      : "message-bubble-with-avatar";

    if (!isGrouped && !isOwnMessage) {
      row.appendChild(createMessageBubbleAvatar(conversation, sessionUserId));
    } else if (!isGrouped && isOwnMessage) {
      row.appendChild(document.createElement("span"));
    }

    const bubble = document.createElement("div");
    bubble.className = isOwnMessage
      ? "message-bubble message-bubble--own message-bubble-content"
      : "message-bubble message-bubble-content";

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

    row.appendChild(bubble);

    if (!isGrouped && isOwnMessage) {
      const ownSpacer = document.createElement("div");
      ownSpacer.className = "message-bubble-avatar";
      ownSpacer.textContent = "S";
      row.appendChild(ownSpacer);
    }

    fragment.appendChild(row);
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
      let sent = false;

      if (isAIConciergeConversationId(form.dataset.conversationId)) {
        if (attachmentFile) {
          showToast("AI concierge supports text only");
          return;
        }

        sent = await sendAIConciergeMessage(body);
      } else {
        sent = await sendConversationMessage(
          form.dataset.conversationId,
          body,
          attachmentFile
        );
      }

      if (sent && bodyInput) {
        bodyInput.value = "";
      }

      if (sent) {
        if (!isAIConciergeConversationId(form.dataset.conversationId)) {
          updateConversationTypingState(
            form.dataset.conversationId,
            messageSessionUserId,
            false
          );
        }
        clearAdminFile("messageAttachmentImage");

        if (isAIConciergeConversationId(form.dataset.conversationId)) {
          const { data: inboxRows } = await supabaseClient
            .from("message_conversations")
            .select("*")
            .order("updated_at", { ascending: false });
          const threads = prependAIConciergeToInbox(inboxRows || []);
          renderMessageInbox(threads);
        }
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

async function sendConversationMessage(
  conversationId,
  body,
  attachmentFile = null
) {
  if (isAIConciergeConversationId(conversationId)) {
    return sendAIConciergeMessage(body);
  }

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
  setupAIConciergeQuickPrompts();
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

// ---------------------------------------------------------------------------
// Restaurant ordering + courier MVP
// ---------------------------------------------------------------------------

const RESTAURANT_ORDER_STATUSES = {
  pending: "Onay bekliyor",
  new: "Onay bekliyor",
  accepted: "Kabul edildi",
  rejected: "Reddedildi",
  preparing: "Hazırlanıyor",
  ready_for_pickup: "Teslime hazır",
  courier_assigned: "Kurye atandı",
  picked_up: "Kurye aldı",
  on_the_way: "Yolda",
  out_for_delivery: "Yolda",
  delivered: "Teslim edildi",
  cancelled: "İptal edildi",
};

const ORDERS_PAGE_DEBUG = true;
const BUSINESS_ORDERS_DEBUG = true;
const COURIER_DELIVERY_DEBUG = true;

const DELIVERY_STATUS_LABELS = {
  available: "Havuzda",
  open: "Havuzda",
  assigned: "Kurye atandı",
  courier_assigned: "Kurye atandı",
  picked_up: "Alındı",
  on_the_way: "Yolda",
  delivered: "Teslim edildi",
  cancelled: "İptal",
  pending: "Havuzda",
  in_transit: "Yolda",
};

const COURIER_DELIVERY_NEXT_ACTIONS = {
  assigned: [["picked_up", "Siparişi Aldım"]],
  courier_assigned: [["picked_up", "Siparişi Aldım"]],
  picked_up: [["on_the_way", "Yola Çıktım"]],
  on_the_way: [["delivered", "Teslim Edildi"]],
};

function normalizeCourierDeliveryStatusKey(status) {
  const value = safeText(status).toLowerCase().trim();
  if (value === "open" || value === "available" || value === "pending") {
    return "available";
  }
  if (value === "courier_assigned" || value === "assigned") {
    return "assigned";
  }
  return value;
}

const courierPageState = {
  refreshTimerId: null,
  lastRefreshedAt: null,
};

const restaurantOrderCartState = {
  venueId: null,
  items: {},
};

function getRestaurantOrderStatusValue(status) {
  return safeText(status).toLowerCase().trim() || "pending";
}

function getRestaurantOrderStatusLabel(status) {
  const value = getRestaurantOrderStatusValue(status);
  return RESTAURANT_ORDER_STATUSES[value] || value;
}

function createRestaurantOrderStatusBadge(status) {
  const badge = document.createElement("span");
  badge.className = `status-badge status-${getRestaurantOrderStatusValue(status)}`;
  badge.textContent = getRestaurantOrderStatusLabel(status);
  return badge;
}

function formatRestaurantOrderAmount(amount) {
  const value = Number(amount) || 0;
  return `₺${value.toFixed(2)}`;
}

function getOrderIdFromQuery() {
  return safeText(new URLSearchParams(window.location.search).get("id")).trim();
}

/** Normalizes create_restaurant_order RPC row (object or single-element array). */
function normalizeRestaurantOrderRow(data) {
  if (!data) return null;

  if (Array.isArray(data)) {
    return data[0] && data[0].id ? data[0] : null;
  }

  if (typeof data === "object" && data.id) {
    return data;
  }

  return null;
}

function normalizeRestaurantOrderRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.filter((row) => row && row.id);
  }
  if (typeof data === "object" && data.id) {
    return [data];
  }
  return [];
}

function getSupabaseErrorMessage(error) {
  if (!error) return "";
  return (
    safeText(error.message) ||
    safeText(error.details) ||
    safeText(error.hint) ||
    safeText(error.code) ||
    String(error)
  );
}

function renderOrdersPageMessage(list, title, message, isError = false) {
  if (!list) return;
  list.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = isError
    ? "order-list-status order-list-status--error"
    : "order-list-status";
  const heading = document.createElement("h3");
  heading.textContent = title;
  wrap.appendChild(heading);
  if (message) {
    const body = document.createElement("p");
    body.textContent = message;
    wrap.appendChild(body);
  }
  list.appendChild(wrap);
}

async function enrichOrdersWithRelations(orders, options = {}) {
  const list = Array.isArray(orders) ? orders : [];
  if (!list.length) return [];

  const venueIds = [
    ...new Set(list.map((order) => order.venue_id).filter(Boolean)),
  ];
  const orderIds = list.map((order) => order.id).filter(Boolean);

  const venuesById = {};
  const itemsByOrderId = {};
  const deliveriesByOrderId = {};
  const historyByOrderId = {};

  if (venueIds.length) {
    const { data: venues, error: venuesError } = await supabaseClient
      .from("venues")
      .select("id, name, city")
      .in("id", venueIds);

    if (venuesError) {
      console.log(venuesError);
    } else {
      (venues || []).forEach((venue) => {
        venuesById[String(venue.id)] = venue;
      });
    }
  }

  if (orderIds.length) {
    const { data: items, error: itemsError } = await supabaseClient
      .from("order_items")
      .select("id, order_id, item_name, quantity, total_price, unit_price, menu_item_id")
      .in("order_id", orderIds);

    if (itemsError) {
      console.log(itemsError);
    } else {
      (items || []).forEach((item) => {
        const key = String(item.order_id);
        if (!itemsByOrderId[key]) itemsByOrderId[key] = [];
        itemsByOrderId[key].push(item);
      });
    }

    if (options.includeDeliveries) {
      const { data: deliveries, error: deliveriesError } =
        await supabaseClient
          .from("deliveries")
          .select("*")
          .in("order_id", orderIds);

      if (deliveriesError) {
        console.log(deliveriesError);
      } else {
        (deliveries || []).forEach((delivery) => {
          deliveriesByOrderId[String(delivery.order_id)] = delivery;
        });
      }
    }

    if (options.includeStatusHistory) {
      const { data: history, error: historyError } =
        await supabaseClient
          .from("order_status_history")
          .select("order_id, status, note, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: true });

      if (historyError) {
        console.log(historyError);
      } else {
        (history || []).forEach((entry) => {
          const key = String(entry.order_id);
          if (!historyByOrderId[key]) historyByOrderId[key] = [];
          historyByOrderId[key].push(entry);
        });
      }
    }
  }

  return list.map((order) => {
    const orderId = String(order.id);
    const venue =
      order.venues ||
      venuesById[String(order.venue_id)] ||
      null;
    const orderItems = order.order_items || itemsByOrderId[orderId] || [];
    const delivery =
      order.deliveries ||
      (options.includeDeliveries
        ? deliveriesByOrderId[orderId] || null
        : order.delivery);
    const statusHistory =
      order.order_status_history ||
      (options.includeStatusHistory
        ? historyByOrderId[orderId] || []
        : []);

    return {
      ...order,
      venues: venue,
      order_items: orderItems,
      deliveries: delivery,
      order_status_history: statusHistory,
    };
  });
}

function getVenueIdFromQuery() {
  return safeText(new URLSearchParams(window.location.search).get("venue")).trim();
}

function isRestaurantMenuManageMode() {
  return new URLSearchParams(window.location.search).get("manage") === "1";
}

async function ensureRestaurantMenuForVenue(venueId) {
  const { data: existing } = await supabaseClient
    .from("restaurant_menus")
    .select("id, venue_id, name, is_active")
    .eq("venue_id", venueId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabaseClient
    .from("restaurant_menus")
    .insert({
      venue_id: Number(venueId),
      name: "Ana Menü",
      is_active: true,
    })
    .select("id, venue_id, name, is_active")
    .single();

  if (error) {
    console.log(error);
    return null;
  }

  return created;
}

async function loadRestaurantMenu(venueId, options = {}) {
  const normalizedVenueId = Number(venueId);
  if (!normalizedVenueId) return { menu: null, items: [] };

  const menu = await ensureRestaurantMenuForVenue(normalizedVenueId);
  if (!menu) return { menu: null, items: [] };

  let query = supabaseClient
    .from("menu_items")
    .select("*")
    .eq("menu_id", menu.id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options.includeUnavailable) {
    query = query.eq("is_available", true);
  }

  const { data: items, error } = await query;

  if (error) {
    console.log(error);
    showSafeError(error, "Menü yüklenemedi.");
    return { menu, items: [] };
  }

  return { menu, items: items || [] };
}

async function createOrder(payload) {
  const session = await getSafeSession();
  if (!session) {
    redirectToAuthForCurrentPage();
    return null;
  }

  const venueId = Number(payload && payload.venueId);
  const orderType = safeText(payload && payload.orderType) || "pickup";
  const items = Array.isArray(payload && payload.items) ? payload.items : [];
  const deliveryAddress = safeText(payload && payload.deliveryAddress);
  const customerNote = safeText(payload && payload.customerNote);

  if (!venueId || items.length === 0) {
    showToast("Sepet boş veya mekan seçilmedi.");
    return null;
  }

  const rpcPayload = {
    p_venue_id: venueId,
    p_order_type: orderType,
    p_delivery_address: deliveryAddress || null,
    p_customer_note: customerNote || null,
    p_items: items.map((item) => ({
      menu_item_id: item.menuItemId,
      quantity: Number(item.quantity) || 1,
    })),
  };

  const { data, error } = await supabaseClient.rpc(
    "create_restaurant_order",
    rpcPayload
  );

  const order = normalizeRestaurantOrderRow(data);

  if (ORDERS_PAGE_DEBUG || BUSINESS_ORDERS_DEBUG) {
    console.log("[createOrder] create_restaurant_order", {
      rpcPayload,
      data,
      error: error ? getSupabaseErrorMessage(error) : null,
      normalized: order,
      sessionUserId: session.user.id,
      inserted: order
        ? {
            id: order.id,
            venue_id: order.venue_id,
            business_owner_id: order.business_owner_id,
            user_id: order.user_id,
            status: order.status,
            created_at: order.created_at,
            total_amount: order.total_amount,
          }
        : null,
    });
  }

  if (error || !order || !order.id) {
    showSafeError(error, "Sipariş oluşturulamadı. Sistem yapılandırmasını kontrol edin.");
    return null;
  }

  const orderUserId = safeText(order.user_id);
  if (orderUserId && String(orderUserId) !== String(session.user.id)) {
    console.warn(
      "[createOrder] user_id mismatch",
      orderUserId,
      session.user.id
    );
    showToast("Sipariş oluşturuldu ancak doğrulanamadı.");
    return null;
  }

  showToast("Sipariş oluşturuldu");
  restaurantOrderCartState.venueId = null;
  restaurantOrderCartState.items = {};
  return order;
}

async function loadUserOrders(userId) {
  const uid = safeText(userId);
  const result = {
    orders: [],
    error: null,
    source: "",
    rawCount: 0,
  };

  if (!uid) {
    result.error = new Error("Kullanıcı oturumu bulunamadı.");
    return result;
  }

  let rows = [];
  let loadError = null;

  const { data: rpcData, error: rpcError } = await supabaseClient.rpc(
    "get_my_restaurant_orders"
  );

  if (!rpcError && rpcData) {
    rows = normalizeRestaurantOrderRows(rpcData);
    result.source = "rpc:get_my_restaurant_orders";
  } else if (rpcError) {
    if (ORDERS_PAGE_DEBUG) {
      console.log("[loadUserOrders] RPC failed, trying table select", rpcError);
    }
    loadError = rpcError;
  }

  if (!rows.length) {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      loadError = error;
    } else {
      rows = data || [];
      result.source = result.source || "table:orders";
    }
  }

  result.rawCount = rows.length;

  if (ORDERS_PAGE_DEBUG) {
    console.log("[loadUserOrders]", {
      userId: uid,
      source: result.source,
      rawCount: result.rawCount,
      error: loadError ? getSupabaseErrorMessage(loadError) : null,
      statuses: rows.map((o) => o.status),
    });
  }

  if (loadError && !rows.length) {
    result.error = loadError;
    return result;
  }

  if (!rows.length) {
    return result;
  }

  try {
    result.orders = await enrichOrdersWithRelations(rows);
  } catch (enrichError) {
    console.log(enrichError);
    result.orders = rows.map((order) => ({
      ...order,
      venues: order.venues || null,
      order_items: Array.isArray(order.order_items) ? order.order_items : [],
    }));
    result.source += "+enrich-fallback";
  }

  return result;
}

async function fetchMyRestaurantOrderById(orderId, userId) {
  const id = safeText(orderId);
  if (!id) return null;

  const { data: rpcRow, error: rpcError } = await supabaseClient.rpc(
    "get_my_restaurant_order",
    { p_order_id: id }
  );

  if (!rpcError && rpcRow) {
    const row = normalizeRestaurantOrderRow(rpcRow);
    if (row) return row;
  }

  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    if (ORDERS_PAGE_DEBUG) {
      console.log("[fetchMyRestaurantOrderById]", id, rpcError, error);
    }
    return null;
  }

  return data;
}

async function getOwnedVenueIdsForBusinessUser(userId) {
  const uid = safeText(userId);
  if (!uid) return [];

  const { data: businesses, error: businessError } = await supabaseClient
    .from("businesses")
    .select("id")
    .eq("owner_id", uid);

  if (businessError) {
    console.log("[getOwnedVenueIdsForBusinessUser] businesses", businessError);
    return [];
  }

  const businessIds = (businesses || []).map((b) => b.id).filter(Boolean);
  if (!businessIds.length) return [];

  const { data: venues, error: venueError } = await supabaseClient
    .from("venues")
    .select("id")
    .in("business_id", businessIds);

  if (venueError) {
    console.log("[getOwnedVenueIdsForBusinessUser] venues", venueError);
    return [];
  }

  return (venues || []).map((v) => Number(v.id)).filter(Boolean);
}

async function loadRestaurantOrders(venueIds) {
  const result = { orders: [], error: null, source: "", rawCount: 0 };
  const ids = (venueIds || [])
    .map((id) => Number(id))
    .filter(Boolean);

  if (!ids.length) return result;

  let rows = [];
  let loadError = null;

  const { data: rpcData, error: rpcError } = await supabaseClient.rpc(
    "get_business_restaurant_orders",
    { p_venue_ids: ids }
  );

  if (!rpcError && rpcData) {
    rows = normalizeRestaurantOrderRows(rpcData);
    result.source = "rpc:get_business_restaurant_orders";
  } else if (rpcError) {
    if (BUSINESS_ORDERS_DEBUG) {
      console.log("[loadRestaurantOrders] RPC failed, trying table", rpcError);
    }
    loadError = rpcError;
  }

  if (!rows.length) {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("*")
      .in("venue_id", ids)
      .order("created_at", { ascending: false });

    if (error) {
      loadError = error;
    } else {
      rows = data || [];
      result.source = result.source || "table:orders";
    }
  }

  result.rawCount = rows.length;

  if (BUSINESS_ORDERS_DEBUG) {
    console.log("[loadRestaurantOrders]", {
      venueIds: ids,
      source: result.source,
      rawCount: result.rawCount,
      statuses: rows.map((o) => o.status),
      error: loadError ? getSupabaseErrorMessage(loadError) : null,
    });
  }

  if (loadError && !rows.length) {
    result.error = loadError;
    return result;
  }

  if (!rows.length) return result;

  try {
    result.orders = await enrichOrdersWithRelations(rows, {
      includeDeliveries: true,
    });
    result.orders = await enrichBusinessOrdersWithCustomers(result.orders);
  } catch (enrichError) {
    console.log(enrichError);
    result.orders = rows;
    result.source += "+enrich-fallback";
  }

  return result;
}

async function enrichBusinessOrdersWithCustomers(orders) {
  const list = Array.isArray(orders) ? orders : [];
  if (!list.length) return [];

  const userIds = [
    ...new Set(list.map((order) => order.user_id).filter(Boolean)),
  ];
  const profileById = new Map();

  await Promise.all(
    userIds.map(async (userId) => {
      const profile = await loadProfileRecordByUserId(userId);
      profileById.set(String(userId), profile);
    })
  );

  return list.map((order) => {
    const profile = profileById.get(String(order.user_id)) || null;
    return {
      ...order,
      customer_profile: profile,
      customer_display_name: profile
        ? getProfileDisplayName(profile)
        : `Müşteri ${String(order.user_id || "").slice(0, 8)}`,
    };
  });
}

async function updateOrderStatus(orderId, newStatus, note = "") {
  const normalizedStatus = getRestaurantOrderStatusValue(newStatus);

  console.log("[business approve] order id/status", orderId, normalizedStatus);

  const { data, error } = await supabaseClient.rpc(
    "update_restaurant_order_status",
    {
      p_order_id: orderId,
      p_new_status: normalizedStatus,
      p_note: note || null,
    }
  );

  if (error || !data) {
    console.log("[delivery create] error", {
      orderId,
      status: normalizedStatus,
      message: safeText(error && error.message),
      code: error && error.code,
      details: error && error.details,
    });
    showSafeError(error, "Sipariş durumu güncellenemedi.");
    return null;
  }

  console.log("[business approve] result", data.id, data.status);
  if (
    ["accepted", "preparing", "ready_for_pickup"].includes(normalizedStatus) &&
    safeText(data.order_type).toLowerCase() === "delivery"
  ) {
    const { data: deliveryRow, error: deliveryError } = await supabaseClient.rpc(
      "ensure_courier_delivery_for_order",
      { p_order_id: orderId }
    );
    if (deliveryError) {
      console.log("[delivery create] ensure error", {
        orderId,
        message: safeText(deliveryError.message),
        code: deliveryError.code,
      });
    } else {
      console.log("[delivery create] ensured", deliveryRow?.id, deliveryRow?.status);
    }
  }

  showToast("Sipariş durumu güncellendi");
  return data;
}

function getDeliveryStatusLabel(status) {
  const value = safeText(status).toLowerCase().trim();
  return DELIVERY_STATUS_LABELS[value] || value;
}

function formatOrderItemsSummary(order) {
  const lines = order && order.order_items;
  if (!lines || !lines.length) return "—";
  return lines
    .map((line) => `${line.quantity}x ${line.item_name}`)
    .join(", ");
}

async function getActiveCourierProfileByUserId(userId) {
  const uid = safeText(userId);
  if (!uid) return null;

  const { data, error } = await supabaseClient
    .from("couriers")
    .select(
      "id, user_id, email, full_name, phone, vehicle_type, status, created_at"
    )
    .eq("user_id", uid)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.log("[courier] user_id lookup", error);
    return null;
  }

  return data;
}

async function getActiveCourierProfileByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const { data, error } = await supabaseClient
    .from("couriers")
    .select(
      "id, user_id, email, full_name, phone, vehicle_type, status, created_at"
    )
    .eq("status", "active")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.log("[courier] email lookup", error);
    return null;
  }

  return data;
}

async function linkCourierUserId(courierId, userId) {
  const { data, error } = await supabaseClient
    .from("couriers")
    .update({ user_id: userId })
    .eq("id", courierId)
    .is("user_id", null)
    .select(
      "id, user_id, email, full_name, phone, vehicle_type, status, created_at"
    )
    .maybeSingle();

  if (error) {
    console.log("[courier] link user_id", error);
    return null;
  }

  return data;
}

/**
 * Resolves active courier for logged-in session:
 * A) couriers.user_id = session user AND status active
 * B) lower(email) match AND status active → link user_id if null (via RPC)
 */
async function resolveActiveCourierForSession(session) {
  if (!session || !session.user) return null;

  const userId = session.user.id;
  const email = normalizeEmail(session.user.email);

  const byUserId = await getActiveCourierProfileByUserId(userId);
  if (byUserId) {
    return byUserId;
  }

  const { data: rpcCourier, error: rpcError } = await supabaseClient.rpc(
    "resolve_my_active_courier"
  );

  if (!rpcError && rpcCourier) {
    if (
      rpcCourier.user_id &&
      String(rpcCourier.user_id) !== String(userId)
    ) {
      console.warn(
        "[courier] RPC returned courier for another user",
        rpcCourier.user_id,
        userId
      );
      return null;
    }
    return rpcCourier;
  }

  if (rpcError) {
    console.log("[courier] resolve_my_active_courier", rpcError);
  }

  const byEmail = await getActiveCourierProfileByEmail(email);
  if (!byEmail) {
    return null;
  }

  if (!byEmail.user_id) {
    const linked = await linkCourierUserId(byEmail.id, userId);
    return linked || byEmail;
  }

  if (String(byEmail.user_id) !== String(userId)) {
    console.warn(
      "[courier] Email matched another account",
      byEmail.user_id,
      userId,
      email
    );
    return null;
  }

  return byEmail;
}

async function getActiveCourierProfile(userId) {
  const session = await getSafeSession();
  if (session && session.user) {
    return resolveActiveCourierForSession(session);
  }

  return getActiveCourierProfileByUserId(userId);
}

async function enrichDeliveriesWithCustomerProfiles(deliveries) {
  const list = deliveries || [];
  const userIds = [
    ...new Set(
      list
        .map((d) => d.orders && d.orders.user_id)
        .filter(Boolean)
    ),
  ];

  if (!userIds.length) return list;

  const profileById = new Map();
  await Promise.all(
    userIds.map(async (userId) => {
      const profile = await loadProfileRecordByUserId(userId);
      profileById.set(String(userId), profile);
    })
  );

  return list.map((delivery) => {
    const order = delivery.orders || {};
    const userId = order.user_id ? String(order.user_id) : "";
    return {
      ...delivery,
      customerProfile: profileById.get(userId) || null,
    };
  });
}

async function notifyOrderParticipant(orderId, type, title, message) {
  if (!orderId) return;

  const { data: order } = await supabaseClient
    .from("orders")
    .select("user_id, business_owner_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return;

  const linkUrl = `./order-detail.html?id=${encodeURIComponent(orderId)}`;
  await createNotification(order.user_id, type, title, message, linkUrl);

  if (
    order.business_owner_id &&
    order.business_owner_id !== order.user_id
  ) {
    await createNotification(
      order.business_owner_id,
      type,
      title,
      message,
      "./restaurant-orders.html"
    );
  }
}

async function notifyCourierDispatchEvent(orderId, eventKey) {
  const messages = {
    courier_assigned: {
      title: "Kurye atandı",
      message: "Siparişiniz bir kurye tarafından kabul edildi.",
    },
    on_the_way: {
      title: "Sipariş yolda",
      message: "Kuryeniz siparişinizle yola çıktı.",
    },
    delivered: {
      title: "Sipariş teslim edildi",
      message: "Siparişiniz teslim edildi.",
    },
  };

  const payload = messages[eventKey];
  if (!payload) return;

  await notifyOrderParticipant(
    orderId,
    `order_${eventKey}`,
    payload.title,
    payload.message
  );
}

async function loadCourierAvailableDeliveries() {
  const session = await getSafeSession();
  if (!session) return { available: [], assigned: [], courier: null };

  const courier = await resolveActiveCourierForSession(session);
  if (!courier) return { available: [], assigned: [], courier: null };

  console.log("[courier load] courier id/email", courier.id, courier.email || session.user.email);

  let available = [];
  let assigned = [];
  let loadError = null;

  const { data: pool, error: poolError } = await supabaseClient.rpc(
    "get_courier_delivery_pool"
  );

  if (poolError) {
    loadError = poolError;
    const poolMsg = safeText(poolError.message).toLowerCase();
    console.log("[courier load] RPC error", {
      message: safeText(poolError.message),
      code: poolError.code,
      details: poolError.details,
      hint: poolError.hint,
    });
    if (poolMsg.includes("active courier")) {
      showToast(
        "Aktif kurye hesabı bulunamadı. Admin aynı e-posta ile kurye kaydı açmalı."
      );
    } else {
      showSafeError(
        poolError,
        "Teslimatlar yüklenemedi. Supabase'de sql/courier_pool_hotfix.sql çalıştırın."
      );
    }
  } else if (pool) {
    available = Array.isArray(pool.available) ? pool.available : [];
    assigned = Array.isArray(pool.assigned) ? pool.assigned : [];
    if (COURIER_DELIVERY_DEBUG) {
      console.log("[courier load] deliveries via RPC", {
        available: available.length,
        assigned: assigned.length,
      });
    }
    if (!available.length && !assigned.length) {
      console.log(
        "[courier load] pool empty — işletme Kabul Et + sipariş delivery tipi olmalı"
      );
    }
  }

  const availableEnriched = await enrichDeliveriesWithCustomerProfiles(available);
  const assignedEnriched = await enrichDeliveriesWithCustomerProfiles(assigned);

  return {
    courier,
    available: availableEnriched,
    assigned: assignedEnriched,
  };
}

async function loadCourierDeliveryHistory(limit = 50) {
  const session = await getSafeSession();
  if (!session) return [];

  const courier = await resolveActiveCourierForSession(session);
  if (!courier) return [];

  const { data, error } = await supabaseClient.rpc("get_courier_delivery_history", {
    p_limit: limit,
  });

  if (error) {
    console.log("[courier history] error", {
      message: safeText(error.message),
      code: error.code,
      details: error.details,
    });
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  return enrichDeliveriesWithCustomerProfiles(rows);
}

async function acceptDelivery(deliveryId) {
  let data = null;
  let error = null;

  const acceptRpc = await supabaseClient.rpc("accept_courier_delivery", {
    p_delivery_id: deliveryId,
  });
  data = acceptRpc.data;
  error = acceptRpc.error;

  if (error && safeText(error.message).toLowerCase().includes("function")) {
    const legacyRpc = await supabaseClient.rpc("accept_delivery", {
      p_delivery_id: deliveryId,
    });
    data = legacyRpc.data;
    error = legacyRpc.error;
  }

  if (error || !data) {
    console.log("[courier accept] error", {
      deliveryId,
      message: safeText(error && error.message),
      code: error && error.code,
    });
    const msg = safeText(error && error.message).toLowerCase();
    if (msg.includes("already claimed") || msg.includes("unavailable")) {
      showToast("Bu teslimat başka bir kurye tarafından alındı.");
    } else {
      showSafeError(error, "Teslimat kabul edilemedi.");
    }
    return null;
  }

  showToast("Teslimat kabul edildi");
  await notifyCourierDispatchEvent(data.order_id, "courier_assigned");
  return data;
}

async function updateDeliveryStatus(deliveryId, newStatus, note = "") {
  const normalizedStatus = safeText(newStatus).toLowerCase().trim();

  let data = null;
  let error = null;

  const statusRpc = await supabaseClient.rpc("update_courier_delivery_status", {
    p_delivery_id: deliveryId,
    p_new_status: normalizedStatus,
    p_note: note || null,
  });
  data = statusRpc.data;
  error = statusRpc.error;

  if (error && safeText(error.message).toLowerCase().includes("function")) {
    const legacyRpc = await supabaseClient.rpc("update_delivery_status", {
      p_delivery_id: deliveryId,
      p_new_status: normalizedStatus,
      p_note: note || null,
    });
    data = legacyRpc.data;
    error = legacyRpc.error;
  }

  if (error || !data) {
    console.log("[courier status] error", {
      deliveryId,
      status: normalizedStatus,
      message: safeText(error && error.message),
      code: error && error.code,
    });
    showSafeError(error, "Teslimat durumu güncellenemedi.");
    return null;
  }

  showToast("Teslimat durumu güncellendi");

  if (normalizedStatus === "on_the_way") {
    await notifyCourierDispatchEvent(data.order_id, "on_the_way");
  } else if (normalizedStatus === "delivered") {
    await notifyCourierDispatchEvent(data.order_id, "delivered");
  }

  return data;
}

function buildGoogleMapsDirectionsUrl(destination) {
  const raw = safeText(destination).trim();
  if (!raw) return "";

  const coordinateMatch = raw.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  const destParam = coordinateMatch
    ? `${coordinateMatch[1]},${coordinateMatch[2]}`
    : encodeURIComponent(raw);

  return `https://www.google.com/maps/dir/?api=1&destination=${destParam}`;
}

function getCourierPickupDestination(order) {
  const venue = (order && order.venues) || {};
  const query = getMapQuery(venue);

  if (query) return query;

  const parts = [venue.address, venue.city].map((v) => safeText(v).trim()).filter(Boolean);
  return parts.join(", ");
}

function getCourierDeliveryDestination(order) {
  return safeText(order && order.delivery_address).trim();
}

function canCourierOpenNavigation(delivery, courierId) {
  if (!delivery || !courierId) return false;
  return safeText(delivery.courier_id) === safeText(courierId);
}

function openCourierNavigation(delivery, navType, courierId) {
  if (!canCourierOpenNavigation(delivery, courierId)) {
    showToast("Navigasyon yalnızca size atanmış teslimatlar için kullanılabilir.");
    return;
  }

  const order = delivery.orders || {};
  const destination =
    navType === "pickup"
      ? getCourierPickupDestination(order)
      : getCourierDeliveryDestination(order);

  if (!destination) {
    showToast(
      navType === "pickup"
        ? "Restoran adresi bulunamadı."
        : "Teslimat adresi bulunamadı."
    );
    return;
  }

  const url = buildGoogleMapsDirectionsUrl(destination);
  if (!url) return;

  window.open(url, "_blank", "noopener,noreferrer");
}

function appendCourierNavigationButtons(actions, delivery, courierId) {
  if (!canCourierOpenNavigation(delivery, courierId)) return;

  const order = delivery.orders || {};
  const pickupDest = getCourierPickupDestination(order);
  const deliveryDest = getCourierDeliveryDestination(order);

  const navWrap = document.createElement("div");
  navWrap.className = "courier-delivery-card__nav";

  if (pickupDest) {
    const pickupBtn = document.createElement("button");
    pickupBtn.type = "button";
    pickupBtn.className = "secondary-btn courier-nav-btn";
    pickupBtn.textContent = "Pickup Navigasyonu";
    pickupBtn.addEventListener("click", () => {
      openCourierNavigation(delivery, "pickup", courierId);
    });
    navWrap.appendChild(pickupBtn);
  }

  if (deliveryDest) {
    const deliveryBtn = document.createElement("button");
    deliveryBtn.type = "button";
    deliveryBtn.className = "secondary-btn courier-nav-btn";
    deliveryBtn.textContent = "Teslimat Navigasyonu";
    deliveryBtn.addEventListener("click", () => {
      openCourierNavigation(delivery, "delivery", courierId);
    });
    navWrap.appendChild(deliveryBtn);
  }

  if (navWrap.childElementCount) {
    actions.appendChild(navWrap);
  }
}

function renderOrderListCard(order, options = {}) {
  if (!order || !order.id) {
    const fallback = document.createElement("article");
    fallback.className = "order-card order-card--invalid";
    fallback.textContent = "Sipariş verisi okunamadı.";
    return fallback;
  }

  const card = document.createElement("article");
  card.className = "order-card";

  const head = document.createElement("div");
  head.className = "order-card-head";

  const title = document.createElement("h3");
  const orderIdLabel = String(order.id);
  title.textContent =
    safeText(order.venues && order.venues.name) ||
    `Sipariş #${orderIdLabel.slice(0, 8)}`;
  head.appendChild(title);
  head.appendChild(createRestaurantOrderStatusBadge(order.status));
  card.appendChild(head);

  const meta = document.createElement("p");
  meta.className = "order-card-meta";
  const typeLabel =
    safeText(order.order_type) === "delivery" ? "Teslimat" : "Gel-al";
  const dateLabel = order.created_at
    ? formatNotificationDate(order.created_at)
    : "";
  const customerLabel = options.showBusinessActions
    ? safeText(order.customer_display_name) || "Müşteri"
    : "";
  meta.textContent = options.showBusinessActions
    ? `${customerLabel} · ${formatRestaurantOrderAmount(order.total_amount)} · ${typeLabel}${dateLabel ? ` · ${dateLabel}` : ""}`
    : `${formatRestaurantOrderAmount(order.total_amount)} · ${typeLabel}${dateLabel ? ` · ${dateLabel}` : ""}`;
  card.appendChild(meta);

  const lineItems = Array.isArray(order.order_items) ? order.order_items : [];

  if (lineItems.length) {
    const items = document.createElement("ul");
    items.className = "order-card-items";
    lineItems.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = `${line.quantity}x ${line.item_name}`;
      items.appendChild(li);
    });
    card.appendChild(items);
  }

  const actions = document.createElement("div");
  actions.className = "order-card-actions";

  const detailLink = document.createElement("a");
  detailLink.href = `./order-detail.html?id=${encodeURIComponent(order.id)}`;
  detailLink.className = "secondary-btn";
  detailLink.textContent = "Detay";
  actions.appendChild(detailLink);

  if (options.showBusinessActions) {
    appendBusinessOrderActions(actions, order);
  }

  card.appendChild(actions);
  return card;
}

function appendBusinessOrderActions(container, order) {
  const status = getRestaurantOrderStatusValue(order.status);
  const actions = [];
  const actionableStatus = status === "new" ? "pending" : status;

  if (actionableStatus === "pending") {
    actions.push(["accepted", "Kabul Et"], ["rejected", "Reddet"]);
  } else if (actionableStatus === "accepted") {
    actions.push(["preparing", "Hazırlanıyor"]);
  } else if (actionableStatus === "preparing") {
    const label =
      safeText(order.order_type) === "delivery"
        ? "Teslime Hazır (Kurye Havuzu)"
        : "Teslime Hazır";
    actions.push(["ready_for_pickup", label]);
  }

  actions.forEach(([nextStatus, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn--small";
    button.textContent = label;
    button.addEventListener("click", async () => {
      await updateOrderStatus(order.id, nextStatus);
      await refreshRestaurantOrdersPage();
    });
    container.appendChild(button);
  });
}

async function refreshRestaurantOrdersPage() {
  const filter = document.getElementById("restaurantOrdersVenueFilter");
  const list = document.getElementById("restaurantOrdersList");
  if (!list) return;

  renderOrdersPageMessage(list, "Siparişler yükleniyor...", "");

  const selectedVenueId =
    filter && safeText(filter.value) ? Number(filter.value) : null;
  const allVenueIds = Array.from(filter ? filter.options : [])
    .map((opt) => Number(opt.value))
    .filter(Boolean);
  const venueIds =
    selectedVenueId && allVenueIds.includes(selectedVenueId)
      ? [selectedVenueId]
      : allVenueIds;

  if (!venueIds.length) {
    list.innerHTML = "";
    renderEmptyState(
      list,
      "Mekan yok",
      "Önce işletme panelinden bir mekan ekleyin."
    );
    return;
  }

  const loadResult = await loadRestaurantOrders(venueIds);
  list.innerHTML = "";

  if (loadResult.error) {
    renderOrdersPageMessage(
      list,
      "Siparişler yüklenemedi",
      getSupabaseErrorMessage(loadResult.error) ||
        "RLS veya RPC yapılandırmasını kontrol edin. sql/orders_customer_read_rpc.sql dosyasını çalıştırın.",
      true
    );
    console.log("[refreshRestaurantOrdersPage] error", loadResult.error);
    return;
  }

  const orders = loadResult.orders || [];

  if (!orders.length) {
    renderEmptyState(list, "Henüz sipariş yok", "Yeni siparişler burada görünecek.");
    return;
  }

  const fragment = document.createDocumentFragment();
  orders.forEach((order) => {
    try {
      fragment.appendChild(
        renderOrderListCard(order, { showBusinessActions: true })
      );
    } catch (renderError) {
      console.log("[refreshRestaurantOrdersPage] render failed", order, renderError);
    }
  });
  list.appendChild(fragment);
}

async function initOrdersPage() {
  const page = document.getElementById("ordersPage");
  if (!page) return;

  const list = document.getElementById("userOrdersList");
  if (!list) {
    console.error("[initOrdersPage] #userOrdersList not found");
    return;
  }

  if (ORDERS_PAGE_DEBUG) {
    console.log("[initOrdersPage] start", window.location.href);
  }

  renderOrdersPageMessage(list, "Siparişler yükleniyor...", "");

  const {
    data: { session },
    error: sessionError,
  } = await supabaseClient.auth.getSession();

  if (sessionError || !session || !session.user) {
    window.location.href = "./auth.html?redirect=./orders.html";
    return;
  }

  const userId = session.user.id;
  const highlightId = getOrderIdFromQuery();
  const loadResult = await loadUserOrders(userId);

  if (ORDERS_PAGE_DEBUG) {
    console.log("[initOrdersPage] loadResult", {
      container: Boolean(list),
      userId,
      highlightId,
      ...loadResult,
      orderCount: loadResult.orders.length,
    });
  }

  list.innerHTML = "";

  if (loadResult.error) {
    renderOrdersPageMessage(
      list,
      "Siparişler yüklenemedi",
      getSupabaseErrorMessage(loadResult.error) ||
        "Veritabanı veya RLS yapılandırmasını kontrol edin. sql/orders_customer_read_rpc.sql dosyasını Supabase SQL Editor'da çalıştırın.",
      true
    );
    showSafeError(loadResult.error, "Siparişler yüklenemedi.");
    return;
  }

  let orders = loadResult.orders || [];

  if (
    highlightId &&
    !orders.some((order) => String(order.id) === String(highlightId))
  ) {
    const missing = await fetchMyRestaurantOrderById(highlightId, userId);
    if (missing) {
      let enrichedMissing = missing;
      try {
        const enriched = await enrichOrdersWithRelations([missing]);
        enrichedMissing = enriched[0] || missing;
      } catch (enrichError) {
        console.log(enrichError);
      }
      orders = [enrichedMissing, ...orders];
    }
  }

  if (!orders.length) {
    renderOrdersPageMessage(
      list,
      "Sipariş yok",
      "İlk siparişinizi bir mekandan verin."
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  orders.forEach((order) => {
    try {
      const card = renderOrderListCard(order);
      if (highlightId && String(order.id) === String(highlightId)) {
        card.classList.add("order-card--highlight");
      }
      fragment.appendChild(card);
    } catch (renderError) {
      console.log("[initOrdersPage] render failed", order, renderError);
    }
  });

  if (!fragment.childElementCount) {
    renderOrdersPageMessage(
      list,
      "Siparişler gösterilemedi",
      "Liste yüklendi ancak kartlar oluşturulamadı. Konsolu kontrol edin.",
      true
    );
    return;
  }

  list.appendChild(fragment);
}

async function initOrderDetailPage() {
  const page = document.getElementById("orderDetailPage");
  if (!page) return;

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    window.location.href = "./auth.html?redirect=" + encodeURIComponent(window.location.href);
    return;
  }

  const orderId = getOrderIdFromQuery();
  if (!orderId) {
    showToast("Sipariş bulunamadı");
    window.location.href = "./orders.html";
    return;
  }

  const orderRow = await fetchMyRestaurantOrderById(orderId, user.id);

  if (!orderRow) {
    showToast("Sipariş bulunamadı.");
    window.location.href = "./orders.html";
    return;
  }

  const [order] = await enrichOrdersWithRelations([orderRow], {
    includeDeliveries: true,
    includeStatusHistory: true,
  });
  if (!order) {
    showToast("Sipariş bulunamadı.");
    return;
  }

  const title = document.getElementById("orderDetailTitle");
  if (title) {
    title.textContent =
      safeText(order.venues && order.venues.name) || "Sipariş Detayı";
  }

  const content = document.getElementById("orderDetailContent");
  if (content) {
    content.innerHTML = "";
    const card = renderOrderListCard(order);
    content.appendChild(card);

    const address = document.createElement("p");
    address.className = "order-card-meta";
    if (order.delivery_address) {
      address.textContent = `Adres: ${order.delivery_address}`;
      content.appendChild(address);
    }
    if (order.customer_note) {
      const note = document.createElement("p");
      note.className = "order-card-meta";
      note.textContent = `Not: ${order.customer_note}`;
      content.appendChild(note);
    }
  }

  const historyList = document.getElementById("orderStatusHistory");
  if (historyList) {
    historyList.innerHTML = "<h2>Durum Geçmişi</h2>";
    const entries = order.order_status_history || [];
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "page-message";
      empty.textContent = "Henüz kayıt yok.";
      historyList.appendChild(empty);
    } else {
      const ul = document.createElement("ul");
      ul.className = "order-history-items";
      entries
        .slice()
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        .forEach((entry) => {
          const li = document.createElement("li");
          li.textContent = `${getRestaurantOrderStatusLabel(entry.status)} — ${new Date(entry.created_at).toLocaleString("tr-TR")}${entry.note ? ` (${entry.note})` : ""}`;
          ul.appendChild(li);
        });
      historyList.appendChild(ul);
    }
  }
}

async function loadBusinessVenueOptions(selectEl) {
  const session = await getSafeSession();
  if (!session || !selectEl) return [];

  const venueIds = await getOwnedVenueIdsForBusinessUser(session.user.id);
  if (!venueIds.length) {
    selectEl.innerHTML = "";
    return [];
  }

  const { data: venues, error } = await supabaseClient
    .from("venues")
    .select("id, name, city")
    .in("id", venueIds)
    .order("name");

  if (error) {
    console.log("[loadBusinessVenueOptions]", error);
    selectEl.innerHTML = "";
    return [];
  }

  selectEl.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Tüm mekanlar";
  allOption.selected = true;
  selectEl.appendChild(allOption);

  (venues || []).forEach((venue) => {
    const option = document.createElement("option");
    option.value = venue.id;
    option.textContent = `${venue.name}${venue.city ? ` · ${venue.city}` : ""}`;
    selectEl.appendChild(option);
  });

  if (BUSINESS_ORDERS_DEBUG) {
    console.log("[loadBusinessVenueOptions]", {
      userId: session.user.id,
      venueIds,
      venues: venues || [],
    });
  }

  return venues || [];
}

async function initRestaurantOrdersPage() {
  const page = document.getElementById("restaurantOrdersPage");
  if (!page) return;

  const session = await getSafeSession();
  if (!session) {
    window.location.href = "./auth.html?redirect=./restaurant-orders.html";
    return;
  }

  const filter = document.getElementById("restaurantOrdersVenueFilter");
  const venues = await loadBusinessVenueOptions(filter);

  if (!venues.length) {
    const list = document.getElementById("restaurantOrdersList");
    if (list) {
      renderEmptyState(
        list,
        "Mekan yok",
        "Önce işletme panelinden onaylı bir mekan ekleyin."
      );
    }
    return;
  }

  filter.addEventListener("change", refreshRestaurantOrdersPage);
  await refreshRestaurantOrdersPage();
}

function renderRestaurantMenuManageList(items, menuId) {
  const list = document.getElementById("restaurantMenuManageList");
  if (!list) return;

  list.innerHTML = "";
  if (!items.length) {
    renderEmptyState(list, "Ürün yok", "Menüye ilk ürününüzü ekleyin.");
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "order-menu-item";

    const title = document.createElement("h3");
    title.textContent = item.name;
    card.appendChild(title);

    const price = document.createElement("p");
    price.textContent = formatRestaurantOrderAmount(item.price);
    card.appendChild(price);

    if (item.description) {
      const desc = document.createElement("p");
      desc.className = "order-card-meta";
      desc.textContent = item.description;
      card.appendChild(desc);
    }

    const actions = document.createElement("div");
    actions.className = "order-card-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "secondary-btn";
    editBtn.textContent = "Düzenle";
    editBtn.addEventListener("click", () => fillRestaurantMenuItemForm(item));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "secondary-btn";
    deleteBtn.textContent = "Sil";
    deleteBtn.addEventListener("click", async () => {
      await supabaseClient.from("menu_items").delete().eq("id", item.id);
      const refreshed = await loadRestaurantMenu(
        document.getElementById("restaurantMenuVenueSelect").value,
        { includeUnavailable: true }
      );
      renderRestaurantMenuManageList(refreshed.items, menuId);
    });
    actions.appendChild(deleteBtn);

    card.appendChild(actions);
    fragment.appendChild(card);
  });

  list.appendChild(fragment);
}

function fillRestaurantMenuItemForm(item) {
  document.getElementById("restaurantMenuItemId").value = item.id || "";
  document.getElementById("restaurantMenuItemName").value = item.name || "";
  document.getElementById("restaurantMenuItemCategory").value = item.category || "";
  document.getElementById("restaurantMenuItemPrice").value = item.price || "";
  document.getElementById("restaurantMenuItemDescription").value =
    item.description || "";
  document.getElementById("restaurantMenuItemImage").value = item.image_url || "";
  document.getElementById("restaurantMenuItemAvailable").checked =
    item.is_available !== false;
}

async function refreshRestaurantMenuManageView() {
  const select = document.getElementById("restaurantMenuVenueSelect");
  if (!select || !select.value) return;

  const { menu, items } = await loadRestaurantMenu(select.value, {
    includeUnavailable: true,
  });
  if (menu) renderRestaurantMenuManageList(items, menu.id);
}

function updateRestaurantOrderCartUi() {
  const cartItemsEl = document.getElementById("restaurantOrderCartItems");
  const totalEl = document.getElementById("restaurantOrderCartTotal");
  if (!cartItemsEl || !totalEl) return;

  const entries = Object.values(restaurantOrderCartState.items);
  cartItemsEl.innerHTML = "";
  let total = 0;

  if (!entries.length) {
    cartItemsEl.textContent = "Sepet boş";
    totalEl.textContent = "₺0.00";
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "order-cart-lines";
  entries.forEach((entry) => {
    const lineTotal = entry.price * entry.quantity;
    total += lineTotal;
    const li = document.createElement("li");
    li.textContent = `${entry.quantity}x ${entry.name} — ${formatRestaurantOrderAmount(lineTotal)}`;
    ul.appendChild(li);
  });
  cartItemsEl.appendChild(ul);
  totalEl.textContent = formatRestaurantOrderAmount(total);
}

function renderRestaurantMenuOrderList(items) {
  const list = document.getElementById("restaurantMenuItemsList");
  if (!list) return;

  list.innerHTML = "";
  if (!items.length) {
    renderEmptyState(list, "Menü boş", "Bu mekan için henüz ürün yok.");
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "order-menu-item";

    const title = document.createElement("h3");
    title.textContent = item.name;
    card.appendChild(title);

    const price = document.createElement("p");
    price.textContent = formatRestaurantOrderAmount(item.price);
    card.appendChild(price);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn--small";
    addBtn.textContent = "Sepete Ekle";
    addBtn.addEventListener("click", () => {
      const existing = restaurantOrderCartState.items[item.id];
      restaurantOrderCartState.items[item.id] = {
        menuItemId: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: (existing ? existing.quantity : 0) + 1,
      };
      updateRestaurantOrderCartUi();
    });
    card.appendChild(addBtn);
    fragment.appendChild(card);
  });

  list.appendChild(fragment);
  updateRestaurantOrderCartUi();
}

async function initRestaurantMenuPage() {
  const page = document.getElementById("restaurantMenuPage");
  if (!page) return;

  const manageSection = document.getElementById("restaurantMenuManageSection");
  const orderSection = document.getElementById("restaurantMenuOrderSection");
  const manageMode = isRestaurantMenuManageMode();
  const venueIdFromQuery = getVenueIdFromQuery();

  if (manageMode) {
    const session = await getSafeSession();
    if (!session) {
      window.location.href = "./auth.html?redirect=./restaurant-menu.html?manage=1";
      return;
    }

    manageSection.hidden = false;
    orderSection.hidden = true;

    const businessLink = document.getElementById("restaurantMenuBusinessLink");
    if (businessLink) businessLink.hidden = false;

    const select = document.getElementById("restaurantMenuVenueSelect");
    await loadBusinessVenueOptions(select);
    select.addEventListener("change", refreshRestaurantMenuManageView);

    const form = document.getElementById("restaurantMenuItemForm");
    const clearBtn = document.getElementById("restaurantMenuItemClearBtn");

    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const venueId = Number(select.value);
        const { menu } = await loadRestaurantMenu(venueId, {
          includeUnavailable: true,
        });
        if (!menu) return;

        const payload = {
          menu_id: menu.id,
          name: document.getElementById("restaurantMenuItemName").value.trim(),
          category: document.getElementById("restaurantMenuItemCategory").value.trim(),
          price: Number(document.getElementById("restaurantMenuItemPrice").value) || 0,
          description: document.getElementById("restaurantMenuItemDescription").value.trim(),
          image_url: document.getElementById("restaurantMenuItemImage").value.trim(),
          is_available: document.getElementById("restaurantMenuItemAvailable").checked,
        };

        const itemId = document.getElementById("restaurantMenuItemId").value;
        if (itemId) {
          await supabaseClient.from("menu_items").update(payload).eq("id", itemId);
        } else {
          await supabaseClient.from("menu_items").insert(payload);
        }

        form.reset();
        document.getElementById("restaurantMenuItemAvailable").checked = true;
        await refreshRestaurantMenuManageView();
        showToast("Menü kaydedildi");
      });
    }

    if (clearBtn && !clearBtn.dataset.bound) {
      clearBtn.dataset.bound = "true";
      clearBtn.addEventListener("click", () => {
        form.reset();
        document.getElementById("restaurantMenuItemId").value = "";
        document.getElementById("restaurantMenuItemAvailable").checked = true;
      });
    }

    await refreshRestaurantMenuManageView();
    return;
  }

  if (!venueIdFromQuery) {
    showToast("Mekan seçilmedi");
    return;
  }

  manageSection.hidden = true;
  orderSection.hidden = false;
  restaurantOrderCartState.venueId = Number(venueIdFromQuery);

  const { data: venue } = await supabaseClient
    .from("venues")
    .select("name, city")
    .eq("id", venueIdFromQuery)
    .maybeSingle();

  const title = document.getElementById("restaurantMenuTitle");
  if (title && venue) title.textContent = `${venue.name} Menüsü`;

  const { items } = await loadRestaurantMenu(venueIdFromQuery);
  renderRestaurantMenuOrderList(items);

  document.querySelectorAll('input[name="orderType"]').forEach((input) => {
    input.addEventListener("change", () => {
      const addressInput = document.getElementById("restaurantOrderDeliveryAddress");
      if (!addressInput) return;
      const isDelivery = document.querySelector('input[name="orderType"]:checked').value === "delivery";
      addressInput.hidden = !isDelivery;
      addressInput.required = isDelivery;
    });
  });

  const submitBtn = document.getElementById("restaurantOrderSubmitBtn");
  if (submitBtn && !submitBtn.dataset.bound) {
    submitBtn.dataset.bound = "true";
    submitBtn.addEventListener("click", async () => {
      const session = await getSafeSession();
      if (!session) {
        redirectToAuthForCurrentPage();
        return;
      }

      const orderType =
        document.querySelector('input[name="orderType"]:checked')?.value || "pickup";
      const order = await createOrder({
        venueId: restaurantOrderCartState.venueId,
        orderType,
        deliveryAddress: document.getElementById("restaurantOrderDeliveryAddress")?.value,
        customerNote: document.getElementById("restaurantOrderNote")?.value,
        items: Object.values(restaurantOrderCartState.items).map((entry) => ({
          menuItemId: entry.menuItemId,
          quantity: entry.quantity,
        })),
      });

      if (order && order.id) {
        window.location.href = `./orders.html?id=${encodeURIComponent(order.id)}`;
      }
    });
  }
}

function renderCourierDeliveryCard(delivery, options = {}) {
  const card = document.createElement("article");
  card.className = "courier-delivery-card";

  const order = delivery.orders || {};
  const venueName =
    safeText(order.venues && order.venues.name) || `Mekan #${order.venue_id}`;
  const customerName =
    getProfileDisplayName(delivery.customerProfile) || "Müşteri";

  const head = document.createElement("div");
  head.className = "courier-delivery-card__head";

  const titleWrap = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = customerName;
  titleWrap.appendChild(title);

  const venue = document.createElement("span");
  venue.className = "courier-delivery-card__venue";
  venue.textContent = venueName;
  titleWrap.appendChild(venue);
  head.appendChild(titleWrap);

  const badge = document.createElement("span");
  badge.className = `status-badge status-${safeText(delivery.status)}`;
  badge.textContent = getDeliveryStatusLabel(delivery.status);
  head.appendChild(badge);
  card.appendChild(head);

  const venueData = order.venues || {};
  const pickupLabel =
    safeText(venueData.address) ||
    getCourierPickupDestination(order) ||
    "—";

  const pickupRow = document.createElement("p");
  pickupRow.className = "courier-delivery-card__row";
  pickupRow.textContent = `Pickup: ${pickupLabel}`;
  card.appendChild(pickupRow);

  const deliveryRow = document.createElement("p");
  deliveryRow.className = "courier-delivery-card__row";
  deliveryRow.textContent = `Teslimat: ${getCourierDeliveryDestination(order) || "—"}`;
  card.appendChild(deliveryRow);

  const summary = document.createElement("p");
  summary.className = "courier-delivery-card__row";
  summary.textContent = `Sipariş: ${formatOrderItemsSummary(order)} · ${formatRestaurantOrderAmount(order.total_amount)}`;
  card.appendChild(summary);

  if (order.order_items && order.order_items.length) {
    const ul = document.createElement("ul");
    ul.className = "courier-delivery-card__items";
    order.order_items.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = `${line.quantity}x ${line.item_name}`;
      ul.appendChild(li);
    });
    card.appendChild(ul);
  }

  const createdAt = delivery.created_at || order.created_at;
  if (createdAt) {
    const time = document.createElement("p");
    time.className = "courier-delivery-card__time";
    time.textContent = new Date(createdAt).toLocaleString("tr-TR");
    card.appendChild(time);
  }

  const actions = document.createElement("div");
  actions.className = "courier-delivery-card__actions";

  if (options.readOnly) {
    card.appendChild(actions);
    return card;
  }

  if (options.canAccept) {
    const acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.className = "btn";
    acceptBtn.textContent = "Teslimatı Kabul Et";
    acceptBtn.addEventListener("click", async () => {
      acceptBtn.disabled = true;
      const result = await acceptDelivery(delivery.id);
      if (result) await refreshCourierPage();
      else acceptBtn.disabled = false;
    });
    actions.appendChild(acceptBtn);
  }

  if (options.canUpdate) {
    const statusKey = normalizeCourierDeliveryStatusKey(delivery.status);
    const nextActions = COURIER_DELIVERY_NEXT_ACTIONS[statusKey] || [];

    nextActions.forEach(([status, label]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = status === "delivered" ? "btn" : "secondary-btn";
      btn.textContent = label;
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const result = await updateDeliveryStatus(delivery.id, status);
        if (result) await refreshCourierPage();
        else btn.disabled = false;
      });
      actions.appendChild(btn);
    });

    appendCourierNavigationButtons(
      actions,
      delivery,
      options.courierId
    );
  }

  card.appendChild(actions);
  return card;
}

function renderCourierProfileCard(courier) {
  const card = document.getElementById("courierProfileCard");
  if (!card || !courier) return;

  card.innerHTML = "";

  const rows = [
    ["Ad Soyad", courier.full_name],
    ["Telefon", courier.phone || "—"],
    ["Araç", courier.vehicle_type || "—"],
    ["Durum", courier.status],
  ];

  rows.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = safeText(value);
    card.appendChild(dt);
    card.appendChild(dd);
  });
}

function updateCourierRefreshMeta() {
  const meta = document.getElementById("courierRefreshMeta");
  if (!meta || !courierPageState.lastRefreshedAt) return;

  meta.textContent = `Son yenileme: ${courierPageState.lastRefreshedAt.toLocaleTimeString("tr-TR")} · Otomatik: 25 sn`;
}

function showCourierAccessDenied() {
  const denied = document.getElementById("courierAccessDenied");
  const panel = document.getElementById("courierPanelContent");
  if (denied) denied.hidden = false;
  if (panel) panel.hidden = true;
}

function showCourierPanel() {
  const denied = document.getElementById("courierAccessDenied");
  const panel = document.getElementById("courierPanelContent");
  if (denied) denied.hidden = true;
  if (panel) panel.hidden = false;
}

async function refreshCourierPage() {
  const availableList = document.getElementById("courierAvailableList");
  const assignedList = document.getElementById("courierAssignedList");
  const historyList = document.getElementById("courierHistoryList");
  if (!availableList || !assignedList) return;

  const { courier, available, assigned } =
    await loadCourierAvailableDeliveries();
  const history = historyList ? await loadCourierDeliveryHistory() : [];

  courierPageState.lastRefreshedAt = new Date();
  updateCourierRefreshMeta();

  const welcome = document.getElementById("courierWelcome");
  if (welcome) {
    welcome.textContent = courier
      ? `Hoş geldin, ${courier.full_name}`
      : "Aktif kurye hesabı bulunamadı.";
  }

  if (!courier) {
    showCourierAccessDenied();
    return;
  }

  showCourierPanel();
  renderCourierProfileCard(courier);

  availableList.innerHTML = "";
  assignedList.innerHTML = "";

  if (!available.length) {
    renderEmptyState(
      availableList,
      "Açık teslimat yok",
      "Sipariş teslimat (delivery) tipinde olmalı ve işletme Kabul Et demeli. Hâlâ boşsa Supabase'de sql/courier_pool_hotfix.sql çalıştırın."
    );
  } else {
    available.forEach((delivery) => {
      availableList.appendChild(
        renderCourierDeliveryCard(delivery, { canAccept: true })
      );
    });
  }

  if (!assigned.length) {
    renderEmptyState(assignedList, "Atanan teslimat yok", "");
  } else {
    assigned.forEach((delivery) => {
      assignedList.appendChild(
        renderCourierDeliveryCard(delivery, {
          canUpdate: true,
          courierId: courier.id,
        })
      );
    });
  }

  if (historyList) {
    historyList.innerHTML = "";
    if (!history.length) {
      renderEmptyState(
        historyList,
        "Geçmiş teslimat yok",
        "Tamamlanan teslimatlar burada listelenir."
      );
    } else {
      history.forEach((delivery) => {
        historyList.appendChild(
          renderCourierDeliveryCard(delivery, { readOnly: true })
        );
      });
    }
  }
}

function setupCourierAutoRefresh() {
  if (courierPageState.refreshTimerId) {
    clearInterval(courierPageState.refreshTimerId);
  }

  courierPageState.refreshTimerId = window.setInterval(() => {
    refreshCourierPage();
  }, 25000);
}

async function initCourierPage() {
  const page = document.getElementById("courierPage");
  if (!page) return;

  const session = await getSafeSession();
  if (!session) {
    window.location.href = "./auth.html?redirect=./courier.html";
    return;
  }

  const courier = await resolveActiveCourierForSession(session);
  if (!courier) {
    showCourierAccessDenied();
    const welcome = document.getElementById("courierWelcome");
    if (welcome) {
      welcome.textContent = "Aktif kurye hesabı bulunamadı.";
    }
    console.warn("[courier] No active courier profile", {
      userId: session.user.id,
      email: session.user.email,
    });
    return;
  }

  showCourierPanel();

  const logoutBtn = document.getElementById("courierLogoutBtn");
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = "true";
    logoutBtn.addEventListener("click", async () => {
      if (courierPageState.refreshTimerId) {
        clearInterval(courierPageState.refreshTimerId);
      }
      await supabaseClient.auth.signOut();
      window.location.href = "./auth.html";
    });
  }

  const refreshBtn = document.getElementById("courierRefreshBtn");
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = "true";
    refreshBtn.addEventListener("click", () => refreshCourierPage());
  }

  await refreshCourierPage();
  setupCourierAutoRefresh();
}

async function initCourierLoginPage() {
  const page = document.getElementById("courierLoginPage");
  if (!page) return;

  const messageEl = document.getElementById("courierLoginMessage");
  const session = await getSafeSession();
  if (!session) {
    if (messageEl) {
      messageEl.textContent =
        "Kurye paneline erişmek için TANIDIK hesabınızla giriş yapın.";
    }
    return;
  }

  const courier = await resolveActiveCourierForSession(session);
  if (courier) {
    window.location.href = "./courier.html";
    return;
  }

  if (messageEl) {
    messageEl.textContent =
      "Giriş yapıldı ancak aktif kurye kaydı bulunamadı. Admin, bu hesabın e-postasıyla kurye oluşturmalı.";
  }
}

async function loadAdminCouriers() {
  const { data, error } = await supabaseClient
    .from("couriers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showSafeError(error, "Kuryeler yüklenemedi.");
    return [];
  }

  return data || [];
}

function renderAdminCouriersList(couriers) {
  const list = document.getElementById("adminCouriersList");
  if (!list) return;

  list.innerHTML = "";
  if (!couriers.length) {
    renderEmptyState(list, "Kurye yok", "İlk kurye hesabını ekleyin.");
    return;
  }

  const fragment = document.createDocumentFragment();
  couriers.forEach((courier) => {
    const card = document.createElement("article");
    card.className = "business-card";

    const title = document.createElement("h3");
    title.textContent = courier.full_name;
    card.appendChild(title);

    card.appendChild(createStatusBadge(courier.status));

    const meta = document.createElement("p");
    const linkLabel = courier.user_id ? "Hesap bağlı" : "Davet (giriş bekliyor)";
    meta.textContent = `${courier.email || "—"} · ${courier.phone || "—"} · ${courier.vehicle_type || "—"} · ${linkLabel}`;
    card.appendChild(meta);

    fragment.appendChild(card);
  });

  list.appendChild(fragment);
}

async function loadAdminDeliveryDispatchBoard() {
  const { data, error } = await supabaseClient.rpc(
    "get_admin_delivery_dispatch_board"
  );

  if (error) {
    console.log("[admin deliveries] board error", error);
    showSafeError(error, "Teslimat listesi yüklenemedi.");
    return { pool: [], active: [], completed: [] };
  }

  return {
    pool: (data && data.pool) || [],
    active: (data && data.active) || [],
    completed: (data && data.completed) || [],
  };
}

async function adminAssignCourierToDelivery(deliveryId, courierId) {
  const { data, error } = await supabaseClient.rpc(
    "admin_assign_courier_delivery",
    {
      p_delivery_id: deliveryId,
      p_courier_id: courierId,
      p_note: "Admin ataması",
    }
  );

  if (error || !data) {
    showSafeError(error, "Kurye ataması yapılamadı.");
    return null;
  }

  showToast("Kurye atandı");
  return data;
}

function renderAdminDeliveryCard(delivery, options = {}) {
  const card = document.createElement("article");
  card.className = "business-card admin-delivery-card";

  const order = delivery.orders || {};
  const venueName =
    safeText(order.venues && order.venues.name) || `Mekan #${order.venue_id}`;
  const courierInfo = delivery.couriers || {};

  const title = document.createElement("h3");
  title.textContent = venueName;
  card.appendChild(title);

  const meta = document.createElement("p");
  meta.textContent = `Sipariş: ${safeText(order.status)} · Teslimat: ${getDeliveryStatusLabel(delivery.status)} · ${formatRestaurantOrderAmount(order.total_amount)}`;
  card.appendChild(meta);

  const address = document.createElement("p");
  address.textContent = safeText(order.delivery_address) || "—";
  card.appendChild(address);

  if (courierInfo.full_name) {
    const courierRow = document.createElement("p");
    courierRow.textContent = `Kurye: ${courierInfo.full_name}${courierInfo.email ? ` (${courierInfo.email})` : ""}`;
    card.appendChild(courierRow);
  }

  if (options.showAssign && options.couriers && options.couriers.length) {
    const row = document.createElement("div");
    row.className = "admin-delivery-card__assign";

    const select = document.createElement("select");
    select.className = "admin-delivery-card__select";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Kurye seç…";
    select.appendChild(placeholder);

    options.couriers
      .filter((c) => safeText(c.status).toLowerCase() === "active")
      .forEach((courier) => {
        const opt = document.createElement("option");
        opt.value = courier.id;
        opt.textContent = `${courier.full_name} (${courier.email || "—"})`;
        select.appendChild(opt);
      });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = "Kurye Ata";
    btn.addEventListener("click", async () => {
      if (!select.value) {
        showToast("Kurye seçin");
        return;
      }
      btn.disabled = true;
      const result = await adminAssignCourierToDelivery(
        delivery.id,
        select.value
      );
      if (result && typeof options.onAssigned === "function") {
        await options.onAssigned();
      } else {
        btn.disabled = false;
      }
    });

    row.appendChild(select);
    row.appendChild(btn);
    card.appendChild(row);
  }

  return card;
}

function renderAdminDeliverySection(container, deliveries, options = {}) {
  if (!container) return;
  container.innerHTML = "";

  if (!deliveries.length) {
    renderEmptyState(container, options.emptyTitle || "Kayıt yok", options.emptyHint || "");
    return;
  }

  const fragment = document.createDocumentFragment();
  deliveries.forEach((delivery) => {
    fragment.appendChild(renderAdminDeliveryCard(delivery, options));
  });
  container.appendChild(fragment);
}

async function refreshAdminDeliveriesPage() {
  const poolList = document.getElementById("adminDeliveryPoolList");
  const activeList = document.getElementById("adminDeliveryActiveList");
  const completedList = document.getElementById("adminDeliveryCompletedList");
  if (!poolList || !activeList || !completedList) return;

  const [board, couriers] = await Promise.all([
    loadAdminDeliveryDispatchBoard(),
    loadAdminCouriers(),
  ]);

  const refresh = async () => {
    const next = await loadAdminDeliveryDispatchBoard();
    renderAdminDeliverySection(poolList, next.pool, {
      emptyTitle: "Havuzda teslimat yok",
      emptyHint: "İşletme onayladığında delivery görevleri burada görünür.",
      showAssign: true,
      couriers,
      onAssigned: refresh,
    });
    renderAdminDeliverySection(activeList, next.active, {
      emptyTitle: "Aktif teslimat yok",
    });
    renderAdminDeliverySection(completedList, next.completed, {
      emptyTitle: "Tamamlanan teslimat yok",
    });
  };

  await refresh();
}

async function initAdminDeliveriesPage() {
  const page = document.getElementById("adminDeliveriesPage");
  if (!page) return;

  const session = await checkAdminAccess();
  if (!session) return;

  const refreshBtn = document.getElementById("adminDeliveriesRefreshBtn");
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = "true";
    refreshBtn.addEventListener("click", () => refreshAdminDeliveriesPage());
  }

  await refreshAdminDeliveriesPage();
}

async function initAdminCouriersPage() {
  const page = document.getElementById("adminCouriersPage");
  if (!page) return;

  const session = await checkAdminAccess();
  if (!session) return;

  const form = document.getElementById("adminCourierForm");
  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("adminCourierEmail").value.trim();
      const fullName = document.getElementById("adminCourierFullName").value.trim();
      const phone = document.getElementById("adminCourierPhone").value.trim();
      const vehicle = document.getElementById("adminCourierVehicle").value.trim();
      const status = document.getElementById("adminCourierStatus").value;

      const normalizedEmail = normalizeEmail(email);
      const { data: userId, error: lookupError } = await supabaseClient.rpc(
        "admin_find_user_id_by_email",
        { p_email: normalizedEmail }
      );

      const rpcPayload = {
        p_full_name: fullName,
        p_phone: phone,
        p_vehicle_type: vehicle,
        p_status: status,
        p_email: normalizedEmail,
      };

      if (lookupError) {
        console.log(lookupError);
        showSafeError(lookupError, "Kullanıcı araması başarısız.");
        return;
      }

      if (userId) {
        rpcPayload.p_user_id = userId;
      } else {
        rpcPayload.p_user_id = null;
      }

      const { error } = await supabaseClient.rpc("admin_upsert_courier", rpcPayload);

      if (error) {
        showSafeError(error, "Kurye kaydedilemedi.");
        return;
      }

      form.reset();
      showToast(
        userId
          ? "Kurye kaydedildi"
          : "Kurye daveti oluşturuldu. Kurye aynı e-posta ile giriş yapınca panel açılır."
      );
      renderAdminCouriersList(await loadAdminCouriers());
    });
  }

  renderAdminCouriersList(await loadAdminCouriers());
}

async function loadVenueRestaurantMenuSummary(venueId) {
  const normalizedVenueId = Number(venueId);
  if (!normalizedVenueId) return { itemCount: 0 };

  try {
    const { data: menu, error: menuError } = await supabaseClient
      .from("restaurant_menus")
      .select("id")
      .eq("venue_id", normalizedVenueId)
      .eq("is_active", true)
      .maybeSingle();

    if (menuError) {
      console.warn("Restaurant menu lookup failed.", menuError);
      return { itemCount: 0 };
    }

    if (!menu) return { itemCount: 0 };

    const { count, error: countError } = await supabaseClient
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("menu_id", menu.id)
      .eq("is_available", true);

    if (countError) {
      console.warn("Menu item count failed.", countError);
      return { itemCount: 0 };
    }

    return { itemCount: count || 0 };
  } catch (error) {
    console.warn("Restaurant menu summary failed.", error);
    return { itemCount: 0 };
  }
}

async function renderVenueOrderCta(venueId) {
  const section = document.getElementById("venueOrderCta");
  if (!section || !venueId) return;

  const description = document.getElementById("venueOrderCtaDescription");
  const meta = document.getElementById("venueOrderCtaMeta");
  const countEl = document.getElementById("venueOrderCtaCount");
  const emptyEl = document.getElementById("venueOrderCtaEmpty");
  const link = document.getElementById("venueOrderCtaLink");
  const sticky = document.getElementById("venueOrderSticky");
  const stickyLink = document.getElementById("venueOrderStickyLink");
  const stickyMeta = document.getElementById("venueOrderStickyMeta");
  const actionBtn = document.getElementById("venueOrderActionBtn");

  const menuUrl = `./restaurant-menu.html?venue=${encodeURIComponent(
    venueId
  )}`;
  const { itemCount } = await loadVenueRestaurantMenuSummary(venueId);
  const hasItems = itemCount > 0;

  section.classList.toggle("venue-order-cta--empty", !hasItems);

  if (description) {
    description.textContent = hasItems
      ? "Dijital menüden seç, sepete ekle ve siparişini tamamla."
      : "Bu mekan için sipariş menüsü henüz hazırlanıyor.";
  }

  if (meta) meta.hidden = !hasItems;

  if (countEl) {
    countEl.textContent =
      itemCount === 1 ? "1 ürün" : `${itemCount} ürün`;
  }

  if (emptyEl) emptyEl.hidden = hasItems;

  if (link) {
    link.href = menuUrl;
    link.hidden = !hasItems;
  }

  if (sticky) sticky.hidden = !hasItems;

  if (stickyLink) {
    stickyLink.href = menuUrl;
  }

  if (stickyMeta) {
    stickyMeta.textContent = hasItems
      ? `${itemCount} ürün · Gel-al & Teslimat`
      : "";
  }

  if (actionBtn) actionBtn.hidden = !hasItems;
}

/** @deprecated Use renderVenueOrderCta — kept for legacy callers. */
function setupVenueOrderLink(venueId) {
  renderVenueOrderCta(venueId);
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
    "orders.html": "profile.html",
    "order-detail.html": "profile.html",
    "restaurant-orders.html": "business.html",
    "restaurant-menu.html": "discover.html",
    "courier.html": "profile.html",
    "courier-login.html": "profile.html",
    "admin-couriers.html": "profile.html",
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
runSafeInitializer("initOrdersPage", initOrdersPage);
runSafeInitializer("initOrderDetailPage", initOrderDetailPage);
runSafeInitializer("initRestaurantOrdersPage", initRestaurantOrdersPage);
runSafeInitializer("initRestaurantMenuPage", initRestaurantMenuPage);
runSafeInitializer("initCourierPage", initCourierPage);
runSafeInitializer("initCourierLoginPage", initCourierLoginPage);
runSafeInitializer("initAdminCouriersPage", initAdminCouriersPage);
runSafeInitializer("initAdminDeliveriesPage", initAdminDeliveriesPage);
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
