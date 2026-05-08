import {
  corsHeaders,
  createGoogleAuthUrl,
  getConnectionStatus,
  json,
  requireUser,
  syncGoogleForUser,
} from "../_shared/google_calendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? "sync";

    if (mode === "status") {
      return json(await getConnectionStatus(userId));
    }

    if (mode === "auth-url") {
      if (typeof body.appRedirectTo !== "string") {
        throw new Error("missing_app_redirect");
      }
      return json({
        url: await createGoogleAuthUrl(userId, body.appRedirectTo),
      });
    }

    await syncGoogleForUser(userId);
    return json(await getConnectionStatus(userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "not_authenticated" ? 401 : 400;
    return json({ error: message }, { status });
  }
});
