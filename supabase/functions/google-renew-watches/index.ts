import {
  corsHeaders,
  json,
  renewDueWatches,
} from "../_shared/google_calendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const expectedSecret = Deno.env.get("GOOGLE_RENEW_SECRET");
    if (expectedSecret) {
      const provided = req.headers.get("X-Renew-Secret");
      if (provided !== expectedSecret) {
        return json({ error: "unauthorized" }, { status: 401 });
      }
    }

    await renewDueWatches();
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, { status: 400 });
  }
});
