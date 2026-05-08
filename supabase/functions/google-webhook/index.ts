import {
  corsHeaders,
  json,
  syncGoogleForChannel,
} from "../_shared/google_calendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const channelId = req.headers.get("X-Goog-Channel-ID");
    const resourceState = req.headers.get("X-Goog-Resource-State");

    if (!channelId) {
      return json({ error: "missing_channel_id" }, { status: 400 });
    }

    if (resourceState !== "sync") {
      await syncGoogleForChannel(channelId);
    }

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, { status: 400 });
  }
});
