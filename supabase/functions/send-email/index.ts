// Supabase Edge Function: sends Anaxx Science Hub post and comment-reply emails.
const SENDER = "Anaxx Science Hub <onboarding@resend.dev>"; // Swap to a verified domain sender when available.
const SITE_POST_URL = "https://anaxx001.github.io/student-blog/post.html?slug=";
const RESEND_URL = "https://api.resend.com/emails";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function plainText(value: unknown): string {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim();
}

async function sendResend(to: string, subject: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from: SENDER, to: [to], subject, text }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Resend API returned " + response.status + ": " + JSON.stringify(payload));
  return payload;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST required" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization") || "";
    if (!supabaseUrl || !anonKey || !authorization) return jsonResponse({ error: "Admin authentication is required" }, 401);
    const adminCheck = await fetch(new URL("/rest/v1/rpc/is_admin", supabaseUrl), {
      method: "POST",
      headers: { apikey: anonKey, Authorization: authorization, "Content-Type": "application/json" },
      body: "{}",
    });
    const isAdmin = adminCheck.ok && await adminCheck.json().catch(() => false);
    if (isAdmin !== true) return jsonResponse({ error: "Admin access required" }, 403);

    const body = await req.json();
    if (body.kind === "publish") {
      const postId = String(body.postId || "").trim();
      const slug = String(body.slug || "").trim();
      const title = plainText(body.title);
      if (!postId || !slug || !title) return jsonResponse({ error: "postId, slug, and title are required" }, 400);

      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase function environment is incomplete" }, 500);
      const query = new URL("/rest/v1/subscribers", supabaseUrl);
      query.searchParams.set("select", "email");
      const subscriberResponse = await fetch(query.toString(), {
        headers: { apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey },
      });
      const subscribers = await subscriberResponse.json().catch(() => []);
      if (!subscriberResponse.ok) throw new Error("Could not fetch subscribers: " + JSON.stringify(subscribers));

      const excerpt = plainText(body.excerpt || body.text || "").slice(0, 150);
      const link = SITE_POST_URL + encodeURIComponent(slug);
      const text = "A new post is up on Anaxx Science Hub: " + title + "\n\n" +
        (excerpt || "Read the latest post on Anaxx Science Hub.") + "\n\nRead it here: " + link;
      const outcomes = await Promise.all((Array.isArray(subscribers) ? subscribers : []).map(async (subscriber: { email?: string }) => {
        const email = String(subscriber.email || "").trim();
        if (!email) return { skipped: true };
        try {
          return { email, result: await sendResend(email, "New on Anaxx Science Hub: " + title, text) };
        } catch (error) {
          return { email, error: error instanceof Error ? error.message : String(error) };
        }
      }));
      const sent = outcomes.filter((item) => "result" in item).length;
      const failed = outcomes.filter((item) => "error" in item).length;
      return jsonResponse({ ok: failed === 0, kind: "publish", subscriberCount: outcomes.length, sent, failed, outcomes }, failed ? 502 : 200);
    }

    if (body.kind === "reply") {
      const email = String(body.email || "").trim();
      const replyText = plainText(body.replyText);
      const postUrl = String(body.postUrl || "").trim();
      if (!email || !replyText || !postUrl || !/^https:\/\//i.test(postUrl)) {
        return jsonResponse({ error: "email, replyText, and a valid https postUrl are required" }, 400);
      }
      const hasReplier = body.replierName != null || body.replierRole != null;
      const replierName = plainText(body.replierName);
      const replierRole = plainText(body.replierRole).toLowerCase();
      const postTitle = plainText(body.postTitle);
      const isAuthor = replierRole === "admin" || replierRole === "author";
      const subject = !hasReplier
        ? "Someone replied to your comment on Anaxx Science Hub"
        : isAuthor
          ? "The author replied to your comment on Anaxx Science Hub"
          : "New reply on " + (postTitle || "a post") + " - Anaxx Science Hub";
      const opening = !hasReplier
        ? "Someone replied to your comment on Anaxx Science Hub:"
        : isAuthor
          ? "The admin replied to your comment:"
          : (replierName || "Someone") + " replied to your comment:";
      const result = await sendResend(
        email,
        subject,
        opening + "\n\n" + replyText + "\n\nRead the post: " + postUrl,
      );
      return jsonResponse({ ok: true, kind: "reply", result });
    }

    return jsonResponse({ error: "kind must be publish or reply" }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
