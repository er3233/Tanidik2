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
};

function getBusinessStatus(business) {
  return safeText(business.status).toLowerCase().trim();
}

function safeText(value) {
  return value || "";
}

function getImage(image) {
  return image || PLACEHOLDER_IMAGE;
}

function showToast(message) {
  const toast = document.getElementById("toast");

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

async function createNotification(
  userId,
  type,
  title,
  message = "",
  linkUrl = ""
) {
  if (!userId) return;

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
    const { error } = await supabaseClient.rpc(
      "create_notification",
      payload
    );

    if (!error) return;

    lastError = error;
  }

  if (lastError) {
    console.log(lastError);
  }
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
  meta.textContent = safeText(venue.city);
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

  const { data, error } =
    await supabaseClient
      .from("event_attendees")
      .select("event_id")
      .in("event_id", uniqueEventIds);

  if (error) {
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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

  const [reviewsResult, favoritesResult] =
    await Promise.all([
      supabaseClient
        .from("venue_reviews")
        .select("venue_id, rating")
        .in("venue_id", uniqueVenueIds),
      supabaseClient
        .from("favorites")
        .select("venue_id")
        .in("venue_id", uniqueVenueIds),
    ]);

  if (reviewsResult.error) {
    console.log(reviewsResult.error);
    showToast(reviewsResult.error.message);
  }

  if (favoritesResult.error) {
    console.log(favoritesResult.error);
    showToast(favoritesResult.error.message);
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
    console.log(error);
    showToast(error.message);
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
      console.log(error);
      showToast(error.message);
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
  return `status-${safeText(status)
    .toLowerCase()
    .trim() || "pending"}`;
}

function createStatusBadge(status) {
  const badge = document.createElement("span");
  badge.className =
    `status-badge ${getReservationStatusClass(status)}`;
  badge.textContent = safeText(status) || "pending";

  return badge;
}

function isPendingReservation(reservation) {
  return (
    safeText(reservation.status).toLowerCase().trim() ===
      "pending" || !reservation.status
  );
}

function getReservationTitle(reservation, options = {}) {
  const venueName =
    options.showVenue && reservation.venue_name
      ? `${safeText(reservation.venue_name)} - `
      : "";

  return `${venueName}${safeText(
    reservation.reservation_date
  )} ${safeText(reservation.reservation_time)}`;
}

function createReservationCard(reservation, options = {}) {
  const card = document.createElement("div");
  card.className = "reservation-card";

  const header = document.createElement("div");
  header.className = "reservation-card-header";

  const title = document.createElement("h3");
  title.textContent = getReservationTitle(
    reservation,
    options
  );
  header.appendChild(title);
  header.appendChild(createStatusBadge(reservation.status));

  const details = document.createElement("p");
  details.textContent = `${reservation.party_size} guests`;

  card.appendChild(header);
  card.appendChild(details);

  if (reservation.note) {
    const note = document.createElement("p");
    note.textContent = reservation.note;
    card.appendChild(note);
  }

  if (options.allowCancel && isPendingReservation(reservation)) {
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "reservation-cancel-btn";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => {
      cancelUserReservation(
        reservation.id,
        options.onCancel
      );
    });
    card.appendChild(cancelButton);
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

  const { error } =
    await supabaseClient.rpc(
      "cancel_pending_reservation",
      {
        reservation_id: reservationId,
      }
    );

  if (error) {
    console.log(error);
    showToast(error.message);
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

async function notifyUserReservationStatus(
  reservation,
  status
) {
  if (!reservation || !reservation.user_id) return;

  const title = getReservationNotificationTitle(status);
  const message =
    `Your reservation for ${safeText(
      reservation.reservation_date
    )} ${safeText(reservation.reservation_time)} was ${status}.`;

  await createNotification(
    reservation.user_id,
    `reservation_${status}`,
    title,
    message,
    `./venue.html?id=${reservation.venue_id}`
  );
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
    console.log(error);
    showToast(error.message);
    return;
  }

  renderUserReservations(data || []);
}

async function setupReservationForm(venueId) {
  const reservationForm =
    document.getElementById("reservationForm");

  if (!reservationForm) return;

  reservationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session) {
      showToast("Login required");
      return;
    }

    const partySize = Number(
      document.getElementById("reservationPartySize").value
    );

    if (partySize < 1 || partySize > 20) {
      showToast("Party size must be between 1 and 20");
      return;
    }

    const payload = {
      venue_id: venueId,
      user_id: session.user.id,
      reservation_date:
        document.getElementById("reservationDate").value,
      reservation_time:
        document.getElementById("reservationTime").value,
      party_size: partySize,
      note:
        document.getElementById("reservationNote").value.trim(),
      status: "pending",
    };

    const { error } =
      await supabaseClient
        .from("reservations")
        .insert([payload]);

    if (error) {
      console.log(error);
      showToast(error.message);
      return;
    }

    showToast("Reservation requested");
    await notifyBusinessOwnerReservationRequest(venueId);
    reservationForm.reset();
    await loadUserReservations(venueId);
  });
}

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
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
  });
}

if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
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
      console.log(error);
      showToast(error.message);
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
      console.log(error);
      showToast(error.message);
      return;
    }

    showToast("Event created");
  });
}

async function checkUser() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

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
    setupBusinessApplicationForm(session.user.id);
    await loadProfileStats(session.user.id);
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
  section.className = "profile-business-section";

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
    console.log(favoritesResult.error);
    showToast(favoritesResult.error.message);
  } else if (favoritesCount) {
    favoritesCount.innerText =
      favoritesResult.count || 0;
  }

  if (reviewsResult.error) {
    console.log(reviewsResult.error);
    showToast(reviewsResult.error.message);
  } else if (reviewsCount) {
    reviewsCount.innerText = reviewsResult.count || 0;
  }

  if (reservationsResult.error) {
    console.log(reservationsResult.error);
    showToast(reservationsResult.error.message);
  } else if (reservationsCount) {
    reservationsCount.innerText =
      reservationsResult.count || 0;
  }

  await loadProfileNotifications(userId);
  await loadProfileReservations(userId);
  await loadProfileBusinessApplications(userId);
  await setupBusinessProfileLink(userId);
}

function formatNotificationDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString();
}

function renderProfileNotifications(notifications) {
  const list =
    document.getElementById("profileNotificationsList");

  if (!list) return;

  list.innerHTML = "";

  if (!notifications || notifications.length === 0) {
    renderEmptyState(
      list,
      "No notifications yet",
      "Reservation and business updates will appear here."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  notifications.forEach((notification) => {
    const item = document.createElement("div");
    item.className = notification.is_read
      ? "profile-card notification-card"
      : "profile-card notification-card unread";

    const status = document.createElement("span");
    status.textContent = notification.is_read
      ? "Read"
      : "Unread";
    item.appendChild(status);

    const title = document.createElement("strong");
    title.textContent = safeText(notification.title);
    item.appendChild(title);

    if (notification.message) {
      const message = document.createElement("p");
      message.textContent = notification.message;
      item.appendChild(message);
    }

    const date = formatNotificationDate(
      notification.created_at
    );

    if (date) {
      const dateElement = document.createElement("p");
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
      console.log(error);
      showToast(error.message);
      return;
    }

    showToast("Application submitted");
    clearBusinessApplicationForm();
    await loadProfileBusinessApplications(userId);
    await setupBusinessProfileLink(userId);
  });
}

async function loadProfileReservations(userId) {
  const reservationsList =
    document.getElementById("profileReservationsList");

  if (!reservationsList) return;

  renderEmptyState(
    reservationsList,
    "Loading reservations..."
  );

  const { data: reservations, error } =
    await supabaseClient
      .from("reservations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8);

  if (error) {
    console.log(error);
    showToast(error.message);
    return;
  }

  const recentReservations = reservations || [];

  if (recentReservations.length === 0) {
    renderEmptyState(
      reservationsList,
      "No reservations yet",
      "Your reservation history will appear here."
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
          onCancel: () => loadProfileStats(userId),
        }
      )
    );
  });

  reservationsList.appendChild(fragment);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
    return;
  }

  allVenues = data || [];
  venueStatsById = await loadVenueStats(
    allVenues.map((venue) => venue.id)
  );

  renderVenues(allVenues);
  renderCityFilters(allVenues);
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

function applyVenueFilters() {
  const searchInput =
    document.getElementById("venueSearchInput");

  const searchValue = searchInput
    ? searchInput.value.toLowerCase()
    : "";

  const selectedCity =
    window.selectedCity || "All";

  let filtered = [...allVenues];

  if (selectedCity !== "All") {
    filtered = filtered.filter(
      (venue) => venue.city === selectedCity
    );
  }

  if (searchValue) {
    filtered = filtered.filter((venue) => {
      const name = safeText(venue.name).toLowerCase();
      const city = safeText(venue.city).toLowerCase();
      const description =
        safeText(venue.description).toLowerCase();

      return (
        name.includes(searchValue) ||
        city.includes(searchValue) ||
        description.includes(searchValue)
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
    console.log(error);
    showToast(error.message);
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
    console.log(venuesError);
    showToast(venuesError.message);
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
    console.log(error);
    showToast(error.message);
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

async function loadVenueDetails() {
  const venueName =
    document.getElementById("venueName");

  if (!venueName) return;

  const params = new URLSearchParams(
    window.location.search
  );

  const id = params.get("id");

  if (!id) return;

  const { data: venue, error } =
    await supabaseClient
      .from("venues")
      .select("*")
      .eq("id", id)
      .single();

  if (error) {
    console.log(error);
    showToast(error.message);
    return;
  }

  document.getElementById("venueImage").src =
    getImage(venue.image);

  document
    .getElementById("venueImage")
    .setAttribute(
      "onerror",
      `this.src='${PLACEHOLDER_IMAGE}'`
    );

  document.getElementById("venueName").innerText =
    safeText(venue.name);

  document.getElementById("venueCity").innerText =
    safeText(venue.city);

  document.getElementById("venueDescription").innerText =
    safeText(venue.description);

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

  const { data: events } =
    await supabaseClient
      .from("events")
      .select("*")
      .eq("venue_id", venue.id);

  const venueEvents =
    document.getElementById("venueEvents");

  if (venueEvents) {
    venueEvents.innerHTML = "";

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

  const params = new URLSearchParams(
    window.location.search
  );

  const id = params.get("id");

  if (!id) return;

  const { data: event, error } =
    await supabaseClient
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

  if (error) {
    console.log(error);
    showToast(error.message);
    return;
  }

  document.getElementById("eventImage").src =
    getImage(event.image);

  document
    .getElementById("eventImage")
    .setAttribute(
      "onerror",
      `this.src='${PLACEHOLDER_IMAGE}'`
    );

  document.getElementById("eventTitle").innerText =
    safeText(event.title);

  document.getElementById("eventDate").innerText =
    safeText(event.event_date);

  const eventDate = document.getElementById("eventDate");

  if (eventDate) {
    eventDate.insertAdjacentElement(
      "afterend",
      createEventCountdownBadge(event.event_date)
    );
  }

  await refreshEventAttendance(event.id);

  document.getElementById("eventDescription").innerText =
    safeText(event.description);

  const { data: venue } =
    await supabaseClient
      .from("venues")
      .select("*")
      .eq("id", event.venue_id)
      .single();

  const eventVenue =
    document.getElementById("eventVenue");

  if (eventVenue && venue) {
    eventVenue.innerText = safeText(venue.name);
  }
}

async function checkAdminAccess() {
  const adminPage = document.getElementById("adminPage");

  if (!adminPage) return null;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

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

function clearAdminFile(id) {
  const element = document.getElementById(id);

  if (element) {
    element.value = "";
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

  const { error } =
    await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file);

  if (error) {
    console.log(error);
    showToast(error.message);
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
  editButton.addEventListener("click", onEdit);
  actions.appendChild(editButton);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "admin-delete-btn";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", onDelete);
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
      `#${venue.id} ${safeText(venue.city)}`;
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
    item.className = "admin-item";

    const content = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent =
      `Venue #${safeText(reservation.venue_id)} - ${safeText(
        reservation.reservation_date
      )} ${safeText(reservation.reservation_time)}`;
    content.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "venue-meta";
    meta.textContent =
      `${reservation.party_size} guests`;
    content.appendChild(meta);

    const user = document.createElement("p");
    user.textContent =
      `User: ${safeText(reservation.user_id)}`;
    content.appendChild(user);

    if (reservation.note) {
      const note = document.createElement("p");
      note.textContent = reservation.note;
      content.appendChild(note);
    }

    content.appendChild(createStatusBadge(reservation.status));

    const actions = document.createElement("div");
    actions.className = "admin-item-actions";

    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "btn";
    approveButton.textContent = "Approve";
    approveButton.addEventListener("click", () => {
      updateReservationStatus(reservation.id, "approved");
    });
    actions.appendChild(approveButton);

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "admin-delete-btn";
    rejectButton.textContent = "Reject";
    rejectButton.addEventListener("click", () => {
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
    approveButton.addEventListener("click", () => {
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
    rejectButton.addEventListener("click", () => {
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
      saveAdminVenue
    );
  }

  if (adminEventForm) {
    adminEventForm.addEventListener(
      "submit",
      saveAdminEvent
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
  setAdminValue("businessVenueImage", "");
  clearAdminFile("businessVenueImageFile");
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
      `#${venue.id} ${safeText(venue.city)}`;
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

  reservations.forEach((reservation) => {
    const item = document.createElement("div");
    item.className = "admin-item";

    const content = document.createElement("div");

    const header = document.createElement("div");
    header.className = "reservation-card-header";

    const title = document.createElement("h3");
    title.textContent =
      `${getBusinessDashboardVenueName(
        reservation.venue_id
      )} - ${safeText(
        reservation.reservation_date
      )} ${safeText(reservation.reservation_time)}`;
    header.appendChild(title);
    header.appendChild(createStatusBadge(reservation.status));
    content.appendChild(header);

    const details = document.createElement("p");
    details.textContent =
      `${reservation.party_size} guests`;
    content.appendChild(details);

    if (reservation.note) {
      const note = document.createElement("p");
      note.textContent = reservation.note;
      content.appendChild(note);
    }

    const actions = document.createElement("div");
    actions.className = "admin-item-actions";

    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "btn";
    approveButton.textContent = "Approve";
    approveButton.addEventListener("click", () => {
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
    rejectButton.addEventListener("click", () => {
      updateBusinessReservationStatus(
        reservation.id,
        "rejected"
      );
    });
    actions.appendChild(rejectButton);

    const messageButton = document.createElement("button");
    messageButton.type = "button";
    messageButton.className = "secondary-btn";
    messageButton.textContent = "Message User";
    messageButton.addEventListener("click", () => {
      openReservationConversation(reservation.id);
    });
    actions.appendChild(messageButton);

    item.appendChild(content);
    item.appendChild(actions);
    fragment.appendChild(item);
  });

  list.appendChild(fragment);
}

async function loadBusinessBusinesses(session) {
  const { data, error } =
    await supabaseClient
      .from("businesses")
      .select("*")
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: false });

  if (error) {
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(favoritesResult.error);
    showToast(favoritesResult.error.message);
  } else {
    analytics.totalFavorites =
      (favoritesResult.data || []).length;
  }

  if (reviewsResult.error) {
    console.log(reviewsResult.error);
    showToast(reviewsResult.error.message);
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
    console.log(attendeesResult.error);
    showToast(attendeesResult.error.message);
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
    renderBusinessAnalytics(getEmptyBusinessAnalytics());
    populateBusinessDashboardSelects();
    renderBusinessVenues([]);
    renderBusinessEvents([]);
    renderBusinessReservations([]);
    return;
  }

  businessDashboardState.venues = await loadBusinessVenues();
  populateBusinessDashboardSelects();
  renderBusinessVenues(businessDashboardState.venues);

  businessDashboardState.events = await loadBusinessEvents();
  renderBusinessEvents(businessDashboardState.events);

  businessDashboardState.reservations =
    await loadBusinessReservations();
  renderBusinessReservations(
    businessDashboardState.reservations
  );

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
  const uploadedImage = imageFile
    ? await uploadAdminImage(imageFile, "venues")
    : "";

  if (imageFile && !uploadedImage) return;

  const payload = {
    business_id: businessId,
    name: getAdminValue("businessVenueName"),
    city: getAdminValue("businessVenueCity"),
    image:
      uploadedImage || getAdminValue("businessVenueImage"),
    address: getAdminValue("businessVenueAddress"),
    latitude: hasLatitude ? Number(latitudeValue) : null,
    longitude: hasLongitude ? Number(longitudeValue) : null,
    description: getAdminValue("businessVenueDescription"),
  };

  const request = id
    ? supabaseClient
        .from("venues")
        .update(payload)
        .eq("id", id)
        .in("business_id", getBusinessDashboardBusinessIds())
    : supabaseClient.from("venues").insert([payload]);

  const { error } = await request;

  if (error) {
    console.log(error);
    showToast(error.message);
    return;
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
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
    console.log(error);
    showToast(error.message);
    return;
  }

  showToast(`Reservation ${status}`);
  await notifyUserReservationStatus(reservation, status);
  await refreshBusinessDashboard();
}

function getConversationIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("conversation");
}

function getConversationIdFromRpcResult(data) {
  if (!data) return "";

  if (typeof data === "string" || typeof data === "number") {
    return String(data);
  }

  if (Array.isArray(data)) {
    return getConversationIdFromRpcResult(data[0]);
  }

  return String(
    data.id ||
      data.conversation_id ||
      data.get_or_create_reservation_conversation ||
      ""
  );
}

function getConversationTitle(conversation) {
  if (!conversation) return "Reservation conversation";

  if (conversation.reservation_id) {
    return `Reservation #${conversation.reservation_id}`;
  }

  return `Conversation #${safeText(conversation.id)}`;
}

function getConversationSubtitle(conversation) {
  const parts = [];

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

  const { data, error } = await supabaseClient.rpc(
    "get_or_create_reservation_conversation",
    {
      p_reservation_id: reservationId,
    }
  );

  if (error) {
    console.log(error);
    showToast(error.message);
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

  renderMessageInbox(data || []);
  return data || [];
}

function renderMessageInbox(conversations) {
  const list = document.getElementById("messagesList");

  if (!list) return;

  list.innerHTML = "";

  if (!conversations || conversations.length === 0) {
    renderEmptyState(
      list,
      "No messages yet",
      "Reservation conversations will appear here."
    );
    return;
  }

  const activeConversationId = getConversationIdFromUrl();
  const fragment = document.createDocumentFragment();

  conversations.forEach((conversation) => {
    const link = document.createElement("a");
    link.href = `./messages.html?conversation=${encodeURIComponent(
      conversation.id
    )}`;
    link.className =
      String(conversation.id) === String(activeConversationId)
        ? "message-thread active"
        : "message-thread";

    const title = document.createElement("strong");
    title.textContent = getConversationTitle(conversation);
    link.appendChild(title);

    const subtitle = getConversationSubtitle(conversation);

    if (subtitle) {
      const meta = document.createElement("span");
      meta.textContent = subtitle;
      link.appendChild(meta);
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
    renderEmptyState(
      messagesContainer,
      "Choose a conversation",
      "Open a reservation conversation from your inbox."
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
    setMessageFormEnabled(false);
    return null;
  }

  setMessageFormEnabled(true);
  panel.dataset.conversationId = conversation.id;
  panel.dataset.userId = conversation.user_id || "";
  panel.dataset.businessOwnerId =
    conversation.business_owner_id || "";

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

  renderConversationMessages(messages || [], session.user.id);
  setupMessageForm(conversation.id);
  return conversation;
}

function renderConversationMessages(messages, sessionUserId) {
  const messagesContainer =
    document.getElementById("conversationMessages");

  if (!messagesContainer) return;

  messagesContainer.innerHTML = "";

  if (!messages || messages.length === 0) {
    renderEmptyState(
      messagesContainer,
      "No messages yet",
      "Send the first reservation message."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  messages.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className =
      String(message.sender_id) === String(sessionUserId)
        ? "message-bubble message-bubble--own"
        : "message-bubble";

    const body = document.createElement("p");
    body.textContent = safeText(message.body);
    bubble.appendChild(body);

    const meta = document.createElement("span");
    meta.textContent = formatNotificationDate(message.created_at);
    bubble.appendChild(meta);

    fragment.appendChild(bubble);
  });

  messagesContainer.appendChild(fragment);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function setupMessageForm(conversationId) {
  const form = document.getElementById("messageForm");

  if (!form || form.dataset.bound === String(conversationId)) {
    return;
  }

  form.dataset.bound = String(conversationId);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const bodyInput = document.getElementById("messageBody");
    const body = bodyInput ? bodyInput.value.trim() : "";

    if (!body) {
      showToast("Write a message");
      return;
    }

    await sendConversationMessage(conversationId, body);

    if (bodyInput) {
      bodyInput.value = "";
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
      "New reservation message",
      getConversationTitle(conversation),
      `./messages.html?conversation=${conversation.id}`
    );
  } catch (error) {
    console.log(error);
  }
}

async function sendConversationMessage(conversationId, body) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "./auth.html";
    return;
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
    return;
  }

  const { error } =
    await supabaseClient
      .from("messages")
      .insert([
        {
          conversation_id: conversation.id,
          sender_id: session.user.id,
          body,
        },
      ]);

  if (error) {
    console.log(error);
    showToast(error.message);
    return;
  }

  await notifyMessageRecipient(conversation, session.user.id);
  await loadConversation(conversation.id);
  await loadMessageInbox();
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

  await loadMessageInbox();
  await loadConversation(getConversationIdFromUrl());
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
    venueForm.addEventListener("submit", saveBusinessVenue);
  }

  if (eventForm) {
    eventForm.addEventListener("submit", saveBusinessEvent);
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

async function initBusinessDashboard() {
  const businessPage =
    document.getElementById("businessPage");

  if (!businessPage) return;

  ensureBusinessAnalyticsSection();
  renderBusinessAnalytics(getEmptyBusinessAnalytics());

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "./auth.html";
    return;
  }

  businessDashboardState.session = session;
  setupBusinessForms();
  await refreshBusinessDashboard();
}

function setActiveNav() {
  const currentPage =
    window.location.pathname.split("/").pop();

  const navLinks =
    document.querySelectorAll(".nav-links a");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");

    if (href === `./${currentPage}`) {
      link.classList.add("active");
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

checkUser();
loadVenues();
loadFavorites();
loadEvents();
loadVenueDetails();
loadEventDetails();
initAdminPanel();
initBusinessDashboard();
setupMessagesPage();
setActiveNav();
setupMobileNav();
registerServiceWorker();

window.addFavorite = addFavorite;
window.removeFavorite = removeFavorite;
window.openVenue = openVenue;
window.openEvent = openEvent;
window.filterByCity = filterByCity;
window.openReservationConversation =
  openReservationConversation;
