import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body?: string | null;
};

type ConversationRow = {
  id: string;
  user_id?: string | null;
  business_owner_id?: string | null;
  participant_one_id?: string | null;
  participant_two_id?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getConversationParticipantIds(conversation: ConversationRow) {
  return [
    conversation.participant_one_id,
    conversation.participant_two_id,
    conversation.user_id,
    conversation.business_owner_id,
  ]
    .map(safeText)
    .filter(Boolean);
}

function getRecipientId(conversation: ConversationRow, senderId: string) {
  const participants = [...new Set(getConversationParticipantIds(conversation))];

  return participants.find((participantId) => participantId !== senderId) || "";
}

function getSenderDisplayName(profile: Record<string, unknown> | null) {
  return (
    safeText(profile?.full_name) ||
    safeText(profile?.display_name) ||
    safeText(profile?.name) ||
    safeText(profile?.username) ||
    "A TANIDIK member"
  );
}

async function sendEmailWithResend({
  apiKey,
  from,
  to,
  subject,
  text,
}: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
    }),
  });

  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(`Resend email failed: ${response.status} ${responseBody}`);
  }

  return responseBody;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const emailProviderApiKey = getEnv("EMAIL_PROVIDER_API_KEY");
    const emailFrom = getEnv("EMAIL_FROM");
    const authorization = req.headers.get("Authorization") || "";
    const jwt = authorization.replace("Bearer ", "").trim();

    if (!authorization.startsWith("Bearer ") || !jwt) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await serviceClient.auth.getUser(jwt);

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const messageId = safeText(payload.message_id);

    if (!messageId) {
      return jsonResponse({ error: "message_id is required" }, 400);
    }

    const { data: message, error: messageError } = await serviceClient
      .from("messages")
      .select("id, conversation_id, sender_id, body")
      .eq("id", messageId)
      .maybeSingle<MessageRow>();

    if (messageError || !message) {
      console.error("Message lookup failed", messageError);
      return jsonResponse({ error: "Message not found" }, 404);
    }

    if (message.sender_id !== user.id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { data: conversation, error: conversationError } =
      await serviceClient
        .from("message_conversations")
        .select(
          "id, user_id, business_owner_id, participant_one_id, participant_two_id",
        )
        .eq("id", message.conversation_id)
        .maybeSingle<ConversationRow>();

    if (conversationError || !conversation) {
      console.error("Conversation lookup failed", conversationError);
      return jsonResponse({ error: "Conversation not found" }, 404);
    }

    const recipientId = getRecipientId(conversation, message.sender_id);

    if (!recipientId) {
      return jsonResponse({ error: "Recipient not found" }, 400);
    }

    const { data: recipient, error: recipientError } =
      await serviceClient.auth.admin.getUserById(recipientId);

    if (recipientError || !recipient?.user?.email) {
      console.error("Recipient email lookup failed", recipientError);
      return jsonResponse({ error: "Recipient email not found" }, 404);
    }

    const { data: senderProfile } = await serviceClient
      .from("profiles")
      .select("full_name, display_name, name, username")
      .eq("id", message.sender_id)
      .maybeSingle<Record<string, unknown>>();

    const senderName = getSenderDisplayName(senderProfile || null);
    const conversationUrl =
      `https://tanidik.app/messages.html?conversation=${encodeURIComponent(
        conversation.id,
      )}`;

    await sendEmailWithResend({
      apiKey: emailProviderApiKey,
      from: emailFrom,
      to: recipient.user.email,
      subject: "New message on TANIDIK",
      text:
        `You have a new message from ${senderName}.\n\n` +
        "Open TANIDIK to reply.\n\n" +
        conversationUrl,
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Message email notification failed", error);
    return jsonResponse({ error: "Email notification failed" }, 500);
  }
});
