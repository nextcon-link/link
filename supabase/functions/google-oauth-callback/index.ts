import {
  corsHeaders,
  exchangeGoogleAuthCode,
  redirectToApp,
  verifyOAuthState,
} from "../_shared/google_calendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let appRedirectTo = "nextcon-link://google-calendar";

  try {
    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");

    if (!state) throw new Error("missing_oauth_state");
    const payload = await verifyOAuthState(state);
    appRedirectTo = payload.appRedirectTo;

    if (oauthError) throw new Error(oauthError);
    if (!code) throw new Error("missing_oauth_code");

    await exchangeGoogleAuthCode(payload.userId, code);

    return redirectToApp(appRedirectTo, {
      google_connected: "1",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return redirectToApp(appRedirectTo, {
      error: message,
    });
  }
});
