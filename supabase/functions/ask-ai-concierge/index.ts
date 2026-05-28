import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitStore = new Map<
  string,
  { count: number; windowStart: number }
>();

type HistoryItem = { role: "user" | "assistant"; content: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function checkRateLimit(userId: string) {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  rateLimitStore.set(userId, entry);
  return true;
}

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

async function buildTanidikContext() {
  const admin = createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY")
  );

  const [{ data: venues }, { data: events }] = await Promise.all([
    admin
      .from("venues")
      .select("id, name, city, category, description")
      .order("name", { ascending: true })
      .limit(40),
    admin
      .from("events")
      .select("id, title, event_date, venue_id, description")
      .order("event_date", { ascending: true })
      .limit(25),
  ]);

  const venueIds = (venues || []).map((v) => v.id).filter(Boolean);
  let reviewStats: Record<string, { avg: number; count: number }> = {};

  if (venueIds.length) {
    const { data: reviews } = await admin
      .from("venue_reviews")
      .select("venue_id, rating")
      .in("venue_id", venueIds.slice(0, 40));

    (reviews || []).forEach((row) => {
      const id = String(row.venue_id);
      if (!reviewStats[id]) reviewStats[id] = { avg: 0, count: 0 };
      reviewStats[id].avg += Number(row.rating) || 0;
      reviewStats[id].count += 1;
    });

    Object.keys(reviewStats).forEach((id) => {
      const s = reviewStats[id];
      if (s.count) s.avg = Math.round((s.avg / s.count) * 10) / 10;
    });
  }

  const venueLines = (venues || []).map((v) => {
    const stats = reviewStats[String(v.id)];
    const rating =
      stats && stats.count
        ? `${stats.avg}/5 (${stats.count} yorum)`
        : "yorum yok";
    return `- ${v.name} | ${v.city || "şehir yok"} | ${v.category || "genel"} | puan: ${rating}`;
  });

  const eventLines = (events || []).map((e) => {
    return `- ${e.title} | tarih: ${e.event_date || "TBA"} | venue_id: ${e.venue_id || "?"}`;
  });

  const categories = [
    ...new Set(
      (venues || [])
        .map((v) => safeText(v.category))
        .filter(Boolean)
    ),
  ];
  const cities = [
    ...new Set(
      (venues || [])
        .map((v) => safeText(v.city))
        .filter(Boolean)
    ),
  ];

  return {
    venues: venueLines.join("\n") || "Mekan verisi yok.",
    events: eventLines.join("\n") || "Etkinlik verisi yok.",
    categories: categories.join(", ") || "kategori yok",
    cities: cities.join(", ") || "şehir yok",
  };
}

async function askOpenAI(
  apiKey: string,
  systemPrompt: string,
  history: HistoryItem[],
  userMessage: string
) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-8),
    { role: "user", content: userMessage },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
      messages,
      max_tokens: 480,
      temperature: 0.65,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${errText}`);
  }

  const payload = await response.json();
  const reply = safeText(payload?.choices?.[0]?.message?.content);

  if (!reply) {
    throw new Error("Empty AI response");
  }

  return reply;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    if (!checkRateLimit(user.id)) {
      return jsonResponse(
        {
          error: "Rate limit exceeded. Try again later.",
          code: "rate_limited",
        },
        429
      );
    }

    const body = await req.json();
    const message = safeText(body?.message);
    const history = Array.isArray(body?.history)
      ? (body.history as HistoryItem[])
          .filter(
            (item) =>
              item &&
              (item.role === "user" || item.role === "assistant") &&
              safeText(item.content)
          )
          .map((item) => ({
            role: item.role,
            content: safeText(item.content).slice(0, 1200),
          }))
      : [];

    if (!message || message.length > 1500) {
      return jsonResponse({ error: "Invalid message" }, 400);
    }

    const context = await buildTanidikContext();
    const openAiKey = getEnv("OPENAI_API_KEY");

    const systemPrompt = `Sen TANIDIK gece hayatı ve mekan keşif asistanısın. Türkçe, kısa ve samimi konuş.
Sadece aşağıdaki TANIDIK verisine dayanarak öneri yap. Uydurma mekan ismi ekleme.
Mekan yoksa dürüstçe söyle. 2-4 cümle, madde işaretleri kullanabilirsin.

ŞEHİRLER: ${context.cities}
KATEGORİLER: ${context.categories}

MEKANLAR:
${context.venues}

ETKİNLİKLER:
${context.events}`;

    const reply = await askOpenAI(
      openAiKey,
      systemPrompt,
      history,
      message
    );

    return jsonResponse({ reply, model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini" });
  } catch (error) {
    console.error("ask-ai-concierge error:", error);
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : "AI concierge failed",
      },
      500
    );
  }
});
