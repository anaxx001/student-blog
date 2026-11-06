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
  var date = String(p.published_at || p.created_at || "").slice(0, 10), bodyHtml = sanitizeBody(p.body);
  var jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", headline: title, description: desc, image: cover || undefined, datePublished: p.published_at || p.created_at || undefined, dateModified: p.updated_at || p.published_at || undefined, author: { "@type": "Person", name: p.author || "Anaxx Science Hub" }, mainEntityOfPage: canonical, publisher: { "@type": "Organization", name: "Anaxx Science Hub", url: SITE + "/" } }).replace(/</g, "\\u003c");
  return "<!doctype html>\n<html lang=\"en\"><head>\n<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>" + esc(title) + " | Anaxx Science Hub</title>\n<meta name=\"description\" content=\"" + esc(desc) + "\">\n<link rel=\"canonical\" href=\"" + canonical + "\">\n<meta property=\"og:type\" content=\"article\"><meta property=\"og:site_name\" content=\"Anaxx Science Hub\"><meta property=\"og:title\" content=\"" + esc(title) + "\"><meta property=\"og:description\" content=\"" + esc(desc) + "\"><meta property=\"og:url\" content=\"" + canonical + "\">" + (cover ? "<meta property=\"og:image\" content=\"" + esc(cover) + "\">" : "") + "\n<meta name=\"twitter:card\" content=\"" + (cover ? "summary_large_image" : "summary") + "\"><meta name=\"twitter:title\" content=\"" + esc(title) + "\"><meta name=\"twitter:description\" content=\"" + esc(desc) + "\">" + (cover ? "<meta name=\"twitter:image\" content=\"" + esc(cover) + "\">" : "") + "\n<script type=\"application/ld+json\">" + jsonLd + "</script>\n<link rel=\"stylesheet\" href=\"../styles.css\"><link rel=\"stylesheet\" href=\"../styles-v3.css\"><link rel=\"stylesheet\" href=\"../ux-v7.css\">\n</head><body><main class=\"wrap\"><p><a href=\"../\">← Anaxx Science Hub</a></p><article><header><p>" + esc(String(p.category || "").replace(/-/g, " ")) + (date ? " · " + esc(date) : "") + "</p><h1>" + esc(title) + "</h1><p>By " + esc(p.author || "Anaxx Science Hub") + "</p>" + (cover ? "<img src=\"" + esc(cover) + "\" alt=\"" + esc(title) + "\" style=\"max-width:100%;height:auto\">" : "") + "</header><div class=\"article-body\">" + bodyHtml + "</div></article><p><a href=\"../\">More from Anaxx Science Hub</a></p></main></body></html>\n";
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
