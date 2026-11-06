import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

var SITE = "https://anaxx001.github.io/student-blog";
var REPO = "anaxx001/student-blog";
var API = "https://api.github.com/repos/" + REPO + "/contents/";
var CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

function xml(s: string) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;"); }
function esc(s: string) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }
function slugify(s: string) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "post"; }
function sanitizeBody(s: string) {
  return String(s || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z0-9_-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src|xlink:href|formaction)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, "")
    .replace(/\s+style\s*=\s*("[^"]*expression\s*\([^"]*"|'[^']*expression\s*\([^']*')/gi, "")
    .replace(/url\s*\(\s*(['"]?)\s*javascript:[^)]*\)/gi, "");
}
function textOnly(s: string) { return String(s || "").replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, " ").replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, "\\\"").replace(/&#39;|&apos;/gi, "'").replace(/\\s+/g, " ").trim(); }
function b64(s: string) { var bytes = new TextEncoder().encode(s); var binary = ""; for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]); return btoa(binary); }
function fromB64(s: string) { try { return new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, "")), function (c) { return c.charCodeAt(0); })); } catch (_) { return ""; } }
function makePage(p: any, pathSlug: string) {
  var title = String(p.title || "Untitled"), desc = textOnly(p.body).slice(0, 160), canonical = SITE + "/post/" + pathSlug + ".html";
  var cover = /^https?:\/\//i.test(String(p.cover_url || "")) ? String(p.cover_url) : "";
  var date = String(p.published_at || p.created_at || "").slice(0, 10), bodyHtml = sanitizeBody(p.body), category = String(p.category || "").replace(/-/g, " "), author = String(p.author || "Anaxx Science Hub"), readMins = Math.max(1, Math.ceil(textOnly(p.body).split(/\s+/).filter(Boolean).length / 230));
  var jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", headline: title, description: desc, image: cover || undefined, datePublished: p.published_at || p.created_at || undefined, dateModified: p.updated_at || p.published_at || undefined, author: { "@type": "Person", name: p.author || "Anaxx Science Hub" }, mainEntityOfPage: canonical, publisher: { "@type": "Organization", name: "Anaxx Science Hub", url: SITE + "/" } }).replace(/</g, "\\u003c");
  var head = "<!doctype html>\n<html lang=\"en\"><head>\n<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>" + esc(title) + " · Anaxx Science Hub</title>\n<meta name=\"description\" content=\"" + esc(desc) + "\">\n<link rel=\"canonical\" href=\"" + canonical + "\">\n<meta property=\"og:type\" content=\"article\"><meta property=\"og:site_name\" content=\"Anaxx Science Hub\"><meta property=\"og:title\" content=\"" + esc(title) + " · Anaxx Science Hub\"><meta property=\"og:description\" content=\"" + esc(desc) + "\"><meta property=\"og:url\" content=\"" + canonical + "\">" + (cover ? "<meta property=\"og:image\" content=\"" + esc(cover) + "\">" : "") + "\n<meta name=\"twitter:card\" content=\"" + (cover ? "summary_large_image" : "summary") + "\"><meta name=\"twitter:title\" content=\"" + esc(title) + " · Anaxx Science Hub\"><meta name=\"twitter:description\" content=\"" + esc(desc) + "\">" + (cover ? "<meta name=\"twitter:image\" content=\"" + esc(cover) + "\">" : "") + "\n<script type=\"application/ld+json\">" + jsonLd + "</script>\n" +
    "<link rel=\"stylesheet\" href=\"../styles.css\"><link rel=\"stylesheet\" href=\"../styles-v3.css\"><link rel=\"stylesheet\" href=\"../ux-v7.css?v=3\"><link rel=\"stylesheet\" href=\"../ads-v6.css?v=3\">\n" +
    "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin><link href=\"https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&display=swap\" rel=\"stylesheet\">\n" +
    "<link rel=\"stylesheet\" href=\"../header-v4.css\"><link rel=\"stylesheet\" href=\"../ambient.css\">\n</head>\n";
  var header = "<body class=\"post-page\">\n<div class=\"ambient-background\" aria-hidden=\"true\"><canvas id=\"ambient-field\"></canvas></div><div class=\"rprog\" aria-hidden=\"true\"><i id=\"rprogBar\"></i></div>\n" +
    "<header class=\"site-header\" id=\"siteHeader\"><div class=\"sh-inner\"><a class=\"wordmark\" href=\"../index.html\" aria-label=\"Anaxx Science Hub home\"><span id=\"navLogo\"></span><span>Anaxx <span class=\"wm-accent\">Science</span> Hub</span></a>\n" +
    "<button class=\"theme-toggle\" id=\"theme-toggle\" type=\"button\" aria-label=\"Switch to dark mode\" aria-pressed=\"false\"><svg class=\"sun-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42\"></path></svg><svg class=\"moon-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" hidden><path d=\"M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z\"></path></svg></button>\n" +
    "<nav class=\"sh-links\" aria-label=\"Main\"><a class=\"sh-link\" href=\"../index.html\">Home</a><div class=\"sh-drop\" id=\"catDrop\"><button class=\"sh-link\" type=\"button\" id=\"catBtn\" aria-expanded=\"false\" aria-controls=\"catMenu\" aria-haspopup=\"true\">Categories<span class=\"sh-caret\" aria-hidden=\"true\"></span></button><div class=\"sh-menu\" id=\"catMenu\" role=\"menu\"><a role=\"menuitem\" href=\"../category.html?c=anatomy\">Anatomy</a><a role=\"menuitem\" href=\"../category.html?c=physiology\">Physiology</a><a role=\"menuitem\" href=\"../category.html?c=biochemistry\">Biochemistry</a><a role=\"menuitem\" href=\"../category.html?c=radiography\">Radiography</a></div></div><a class=\"sh-link\" href=\"../index.html#about\">About</a><a class=\"sh-link\" href=\"../saved.html\">Saved</a></nav>\n" +
    "<button class=\"sh-burger\" id=\"shBurger\" type=\"button\" aria-label=\"Open menu\" aria-expanded=\"false\" aria-controls=\"shSheet\"><span></span><span></span><span></span></button></div><div class=\"sh-sheet\" id=\"shSheet\"><span class=\"sh-sheet-label\">Go to</span><a href=\"../index.html\">Home</a><span class=\"sh-sheet-label\">Categories</span><a class=\"sub\" href=\"../category.html?c=anatomy\">Anatomy</a><a class=\"sub\" href=\"../category.html?c=physiology\">Physiology</a><a class=\"sub\" href=\"../category.html?c=biochemistry\">Biochemistry</a><a class=\"sub\" href=\"../category.html?c=radiography\">Radiography</a><span class=\"sh-sheet-label\">Blog</span><a href=\"../index.html#about\">About</a><a href=\"../saved.html\">Saved</a></div></header>\n" +
    "<main class=\"article-wrap\"><article id=\"article\">" + (cover ? "<div id=\"cover\"><div class=\"cover banner-cover\"><img src=\"" + esc(cover) + "\" alt=\"" + esc(title) + "\" loading=\"eager\"></div></div>" : "") +
    "<span class=\"tag t-" + esc(String(p.category || "")) + "\" id=\"cat\">" + esc(category) + "</span><h1 class=\"article-title\" id=\"title\">" + esc(title) + "</h1><div class=\"muted small article-meta\" id=\"meta\"><span class=\"byline-name\">" + esc(author) + "</span>" + (date ? "<span class=\"byline-dot\" aria-hidden=\"true\">·</span><time>" + esc(new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })) + "</time>" : "") + "<span class=\"byline-dot\" aria-hidden=\"true\">·</span><span>" + readMins + " min read</span></div><div class=\"article-body\" id=\"body\">" + bodyHtml + "</div>\n" +
    "<div class=\"action-bar\"><div class=\"reactions\" role=\"group\" aria-label=\"Article actions\"><a class=\"react\" href=\"../post.html?p=" + encodeURIComponent(String(p.slug || pathSlug)) + "#reactions\">React</a><a class=\"react\" href=\"../saved.html\">Save</a></div><div class=\"share\"><a class=\"sh share-btn\" href=\"https://wa.me/?text=" + encodeURIComponent(title + " " + canonical) + "\" target=\"_blank\" rel=\"noopener\">Share</a><a class=\"sh share-btn\" href=\"../post.html?p=" + encodeURIComponent(String(p.slug || pathSlug)) + "#commentsBox\">Comments</a></div></div></article></main>\n";
  var footer = "<footer class=\"site-footer\" id=\"follow\"><a class=\"wordmark\" href=\"../index.html\"><span id=\"footLogo\"></span><span>Anaxx <span class=\"wm-accent\">Science</span> Hub</span></a><p class=\"foot-tag\">notes from a radiography student, for health science students</p><div class=\"socials\"><a href=\"https://www.linkedin.com/in/churchill-celestine-239920291\" target=\"_blank\" rel=\"noopener\">LinkedIn</a><a href=\"https://x.com/AnaxxWrites\" target=\"_blank\" rel=\"noopener\">X</a><a href=\"https://substack.com/@vonanaxx\" target=\"_blank\" rel=\"noopener\">Substack</a></div><p class=\"foot-legal\">© 2026 Anaxx Science Hub · <a href=\"../admin.html\">Admin</a></p></footer>\n" +
    "<button class=\"to-top\" id=\"toTop\" type=\"button\" aria-label=\"Back to top\" title=\"Back to top\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 19V5M5 12l7-7 7 7\"/></svg></button><script src=\"../header-v4.js\"></script><script src=\"../ambient.js\"></script></body></html>\n";
  return head + header + footer;
}
async function gh(path: string, init?: RequestInit) {
  var token = Deno.env.get("GH_TOKEN");
  if (!token) throw new Error("GitHub publishing is not configured: GH_TOKEN is missing from Supabase Edge Function secrets.");
  var response = await fetch(API + path.split("/").map(encodeURIComponent).join("/"), { ...(init || {}), headers: { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + token, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...((init && init.headers) || {}) } });
  var data: any = await response.json().catch(function () { return {}; });
  if (!response.ok && response.status !== 404) throw new Error("GitHub " + response.status + ": " + (data.message || "request failed"));
  return { response: response, data: data };
}
async function getFile(path: string) { var r = await gh(path); return r.response.status === 404 ? null : r.data; }
async function putFile(path: string, content: string, message: string, prior: any) {
  if (prior && fromB64(prior.content) === content) return false;
  var body: any = { message: message, content: b64(content), branch: "main" };
  if (prior && prior.sha) body.sha = prior.sha;
  await gh(path, { method: "PUT", body: JSON.stringify(body) });
  return true;
}
async function deleteFile(path: string, message: string, prior: any) {
  if (!prior || !prior.sha) return false;
  await gh(path, { method: "DELETE", body: JSON.stringify({ message: message, sha: prior.sha, branch: "main" }) });
  return true;
}
serve(async function (req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } });
    var supa = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), auth = req.headers.get("Authorization") || "";
    if (!supa || !anon || !/^Bearer\s+\S+/i.test(auth)) throw new Error("An authenticated admin session is required.");
    var adminRes = await fetch(supa + "/rest/v1/rpc/is_admin", { method: "POST", headers: { apikey: anon, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
    if (!adminRes.ok || (await adminRes.json()) !== true) return new Response(JSON.stringify({ error: "Admin access required." }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    var rows: any[] = [], offset = 0, batch: any[];
    do {
      var listRes = await fetch(supa + "/rest/v1/posts?select=id,title,body,category,author,cover_url,status,slug,published_at,created_at,updated_at&order=created_at.asc&limit=1000&offset=" + offset, { headers: { apikey: anon, Authorization: auth } });
      if (!listRes.ok) throw new Error("Could not read posts from Supabase (" + listRes.status + ").");
      batch = await listRes.json(); rows = rows.concat(batch); offset += batch.length;
    } while (batch.length === 1000);
    for (var k = 0; k < rows.length; k++) if (!rows[k].title || (rows[k].status === "published" && !rows[k].body)) throw new Error("A post is missing its title or published body, so static pages were not changed.");
    var unique: Record<string, number> = {}, names: Record<string, string> = {}, active: Record<string, boolean> = {}, published = rows.filter(function (p: any) { return p.status === "published" && p.title && p.body; });
    rows.forEach(function (p: any) {
      var base = slugify(p.title), n = (unique[base] || 0) + 1; unique[base] = n;
      names[String(p.id)] = base + (n > 1 ? "-" + n : "");
    });
    var slugUpdateFailed = false;
    for (var j = 0; j < rows.length; j++) {
      var row = rows[j], wantedSlug = names[String(row.id)];
      if (row.slug !== wantedSlug) {
        var updateRes = await fetch(supa + "/rest/v1/rpc/set_post_slug", { method: "POST", headers: { apikey: anon, Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify({ p_post_id: String(row.id), p_slug: wantedSlug }) });
        if (!updateRes.ok) slugUpdateFailed = true;
        else row.slug = wantedSlug;
      }
    }
    var manifestPrior = await getFile("post/manifest.json"), manifest: any = {};
    try { manifest = manifestPrior ? JSON.parse(fromB64(manifestPrior.content)) : {}; } catch (_) { manifest = {}; }
    var wanted: Record<string, boolean> = {}, tracked: Record<string, boolean> = {}, changed = 0, removed = 0;
    for (var i = 0; i < published.length; i++) {
      var post = published[i], slug = names[String(post.id)], filePath = "post/" + slug + ".html";
      wanted[filePath] = true; tracked[filePath] = true;
    }
    Object.keys(manifest).forEach(function (id) {
      var oldPath = "post/" + String(manifest[id]) + ".html";
      tracked[oldPath] = true;
      if (!wanted[oldPath]) active[oldPath] = true;
    });
    for (var file in tracked) if (Object.prototype.hasOwnProperty.call(tracked, file) && wanted[file]) {
      var fileSlug = file.slice(5, -5), found = published.filter(function (p: any) { return names[String(p.id)] === fileSlug; })[0];
      if (found && await putFile(file, makePage(found, fileSlug), "Publish static post: " + fileSlug, await getFile(file))) changed++;
    }
    for (var stale in active) if (Object.prototype.hasOwnProperty.call(active, stale)) {
      if (await deleteFile(stale, "Remove unpublished static post", await getFile(stale))) removed++;
    }
    var nextManifest: Record<string, string> = {};
    published.forEach(function (p: any) { nextManifest[String(p.id)] = names[String(p.id)]; });
    if (await putFile("post/manifest.json", JSON.stringify(nextManifest, null, 2) + "\n", "Sync static post manifest", await getFile("post/manifest.json"))) changed++;
    var locs = [SITE + "/"].concat(published.map(function (p: any) { return SITE + "/post/" + names[String(p.id)] + ".html"; }));
    var sitemap = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" + locs.map(function (url) { return "  <url><loc>" + xml(url) + "</loc></url>"; }).join("\n") + "\n</urlset>\n";
    if (await putFile("sitemap.xml", sitemap, "Sync sitemap with published posts", await getFile("sitemap.xml"))) changed++;
    return new Response(JSON.stringify({ ok: true, published: published.length, changed: changed, removed: removed, slugUpdateFailed: slugUpdateFailed }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e && (e as Error).message) || "Static publishing failed." }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
