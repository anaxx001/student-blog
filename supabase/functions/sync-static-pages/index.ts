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
function textOnly(s: string) { return String(s || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim(); }
function b64(s: string) { var bytes = new TextEncoder().encode(s); var binary = ""; for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]); return btoa(binary); }
function fromB64(s: string) { try { return new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, "")), function (c) { return c.charCodeAt(0); })); } catch (_) { return ""; } }
var SB_API = "https://adcaogagdljbbxdsihip.supabase.co/rest/v1";
var SB_PUB = "sb_publishable_FbItOuVOwTa8F4iOGZVKgg_eMkUoATw";
function linkChip(url: string) {
  var u = String(url || "");
  var yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return '<a class="link-chip" href="' + esc(u) + '" target="_blank" rel="noopener"><span class="chip-ico">&#9654;</span> Watch on YouTube</a>';
  if (/^https?:\/\/(?:www\.)?(?:twitter\.com|x)\.com\//i.test(u)) return '<a class="link-chip" href="' + esc(u) + '" target="_blank" rel="noopener"><span class="chip-ico">&#120143;</span> Read on X</a>';
  var host = "";
  try { host = new URL(u).hostname.replace(/^www\./, ""); } catch (_) { }
  if (!host) return '<a class="link-chip" href="' + esc(u) + '" target="_blank" rel="noopener"><span class="chip-ico">&#128279;</span> Open link</a>';
  var parts = host.split(".");
  var name = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return '<a class="link-chip" href="' + esc(u) + '" target="_blank" rel="noopener"><span class="chip-ico">&#128279;</span> Read: ' + esc(name.charAt(0).toUpperCase() + name.slice(1)) + '</a>';
}
function makePage(p: any, pathSlug: string) {
  var title = String(p.title || "Untitled"), desc = textOnly(p.body).slice(0, 160), canonical = SITE + "/post/" + pathSlug + ".html";
  var cover = /^https?:\/\//i.test(String(p.cover_url || "")) ? String(p.cover_url) : "";
  var date = String(p.published_at || p.created_at || "").slice(0, 10), bodyHtml = sanitizeBody(p.body), category = String(p.category || "").replace(/-/g, " "), author = String(p.author || "Anaxx Science Hub"), readMins = Math.max(1, Math.ceil(textOnly(p.body).split(/\s+/).filter(Boolean).length / 230));
  bodyHtml = bodyHtml
    .replace(/<a\s+[^>]*href="(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)[^"]*)"[^>]*>[\s\S]*?<\/a>/gi, function (_m: string, url: string) { return linkChip(url); })
    .replace(/(^|[\s>])(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)[^\s<]*)/g, function (_m: string, pre: string, url: string) { return pre + linkChip(url); })
    .replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g, function (_m: string, pre: string, url: string) { if (/<a\s/i.test(pre) || pre === '=') return _m; return pre + linkChip(url); });
  var jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", headline: title, description: desc, image: cover || undefined, datePublished: p.published_at || p.created_at || undefined, dateModified: p.updated_at || p.published_at || undefined, author: { "@type": "Person", name: p.author || "Anaxx Science Hub" }, mainEntityOfPage: canonical, publisher: { "@type": "Organization", name: "Anaxx Science Hub", url: SITE + "/" } }).replace(/</g, "\\u003c");
  var head = "<!doctype html>\n<html lang=\"en\"><head>\n<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>" + esc(title) + " · Anaxx Science Hub</title>\n<meta name=\"description\" content=\"" + esc(desc) + "\">\n<link rel=\"canonical\" href=\"" + canonical + "\">\n<meta property=\"og:type\" content=\"article\"><meta property=\"og:site_name\" content=\"Anaxx Science Hub\"><meta property=\"og:title\" content=\"" + esc(title) + " · Anaxx Science Hub\"><meta property=\"og:description\" content=\"" + esc(desc) + "\"><meta property=\"og:url\" content=\"" + canonical + "\">" + (cover ? "<meta property=\"og:image\" content=\"" + esc(cover) + "\"><meta property=\"og:image:width\" content=\"1200\"><meta property=\"og:image:height\" content=\"630\"><meta property=\"og:image:alt\" content=\"" + esc(title) + "\">" : "") + "\n<meta name=\"twitter:card\" content=\"" + (cover ? "summary_large_image" : "summary") + "\"><meta name=\"twitter:title\" content=\"" + esc(title) + " · Anaxx Science Hub\"><meta name=\"twitter:description\" content=\"" + esc(desc) + "\">" + (cover ? "<meta name=\"twitter:image\" content=\"" + esc(cover) + "\">" : "") + "\n<script type=\"application/ld+json\">" + jsonLd + "</script>\n" +
    "<link rel=\"stylesheet\" href=\"../styles.css?v=6\"><link rel=\"stylesheet\" href=\"../styles-v3.css\"><link rel=\"stylesheet\" href=\"../ux-v7.css?v=3\"><link rel=\"stylesheet\" href=\"../ads-v6.css?v=3\">\n" +
    "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin><link href=\"https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&display=swap\" rel=\"stylesheet\">\n" +
    "<link rel=\"stylesheet\" href=\"../header-v4.css\"><link rel=\"stylesheet\" href=\"../ambient.css?v=5\">\n</head>\n";
  var header = "<body class=\"post-page\">\n<div class=\"ambient-background\" aria-hidden=\"true\"><canvas id=\"ambient-field\"></canvas></div><div class=\"rprog\" aria-hidden=\"true\"><i id=\"rprogBar\"></i></div>\n" +
    "<header class=\"site-header\" id=\"siteHeader\"><div class=\"sh-inner\"><a class=\"wordmark\" href=\"../index.html\" aria-label=\"Anaxx Science Hub home\"><span id=\"navLogo\"></span><span>Anaxx <span class=\"wm-accent\">Science</span> Hub</span></a>\n" +
    "<button class=\"theme-toggle\" id=\"theme-toggle\" type=\"button\" aria-label=\"Switch to dark mode\" aria-pressed=\"false\"><svg class=\"sun-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42\"></path></svg><svg class=\"moon-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" hidden><path d=\"M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z\"></path></svg></button>\n" +
    "<nav class=\"sh-links\" aria-label=\"Main\"><a class=\"sh-link\" href=\"../index.html\">Home</a><div class=\"sh-drop\" id=\"catDrop\"><button class=\"sh-link\" type=\"button\" id=\"catBtn\" aria-expanded=\"false\" aria-controls=\"catMenu\" aria-haspopup=\"true\">Categories<span class=\"sh-caret\" aria-hidden=\"true\"></span></button><div class=\"sh-menu\" id=\"catMenu\" role=\"menu\"><a role=\"menuitem\" href=\"../category.html?c=anatomy\">Anatomy</a><a role=\"menuitem\" href=\"../category.html?c=physiology\">Physiology</a><a role=\"menuitem\" href=\"../category.html?c=biochemistry\">Biochemistry</a><a role=\"menuitem\" href=\"../category.html?c=radiography\">Radiography</a></div></div><a class=\"sh-link\" href=\"../index.html#about\">About</a><a class=\"sh-link\" href=\"../saved.html\">Saved</a></nav>\n" +
    "<button class=\"sh-burger\" id=\"shBurger\" type=\"button\" aria-label=\"Open menu\" aria-expanded=\"false\" aria-controls=\"shSheet\"><span></span><span></span><span></span></button></div><div class=\"sh-sheet\" id=\"shSheet\"><span class=\"sh-sheet-label\">Go to</span><a href=\"../index.html\">Home</a><span class=\"sh-sheet-label\">Categories</span><a class=\"sub\" href=\"../category.html?c=anatomy\">Anatomy</a><a class=\"sub\" href=\"../category.html?c=physiology\">Physiology</a><a class=\"sub\" href=\"../category.html?c=biochemistry\">Biochemistry</a><a class=\"sub\" href=\"../category.html?c=radiography\">Radiography</a><span class=\"sh-sheet-label\">Blog</span><a href=\"../index.html#about\">About</a><a href=\"../saved.html\">Saved</a></div></header>\n" +
    "<main class=\"article-wrap\"><article id=\"article\">" + (cover ? "<div id=\"cover\" style=\"margin:14px 0 8px\"><img src=\"" + esc(cover) + "\" alt=\"" + esc(title) + "\" loading=\"eager\" style=\"width:100%;max-width:100%;height:auto;display:block;border-radius:12px;object-fit:contain;background:rgba(0,0,0,.03)\"></div>" : "") +
    "<span class=\"tag t-" + esc(String(p.category || "")) + "\" id=\"cat\">" + esc(category) + "</span><h1 class=\"article-title\" id=\"title\">" + esc(title) + "</h1><div class=\"muted small article-meta\" id=\"meta\"><span class=\"byline-name\">" + esc(author) + "</span>" + (date ? "<span class=\"byline-dot\" aria-hidden=\"true\">·</span><time>" + esc(new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })) + "</time>" : "") + "<span class=\"byline-dot\" aria-hidden=\"true\">·</span><span>" + readMins + " min read</span></div><div class=\"article-body\" id=\"body\">" + bodyHtml + "</div>\n" +
    "<div class=\"action-bar\"><div class=\"reactions\" id=\"spReactions\" role=\"group\" aria-label=\"Reactions\">" +
    "<button class=\"react\" type=\"button\" data-react=\"like\" aria-label=\"Like\" title=\"Like\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 10v11H3V10h4zM7 10l4-7a2 2 0 0 1 2 2v4h6.2a2 2 0 0 1 2 2.3l-1.3 7.4A2 2 0 0 1 17.9 21H7\"/></svg><b data-count=\"like\">0</b></button>" +
    "<button class=\"react\" type=\"button\" data-react=\"dislike\" aria-label=\"Dislike\" title=\"Dislike\"><span style=\"display:inline-block;transform:rotate(180deg)\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 10v11H3V10h4zM7 10l4-7a2 2 0 0 1 2 2v4h6.2a2 2 0 0 1 2 2.3l-1.3 7.4A2 2 0 0 1 17.9 21H7\"/></svg></span><b data-count=\"dislike\">0</b></button>" +
    "<button class=\"react\" type=\"button\" data-react=\"insight\" aria-label=\"Insight\" title=\"Insight\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z\"/></svg><b data-count=\"insight\">0</b></button>" +
    "<button class=\"react\" type=\"button\" data-react=\"save\" aria-label=\"Save\" title=\"Save\"><svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 3h12v18l-6-4-6 4z\"/></svg><b data-count=\"save\">0</b></button>" +
    "</div><div class=\"share\"><a class=\"sh share-btn\" href=\"https://wa.me/?text=" + encodeURIComponent(title + " " + canonical) + "\" target=\"_blank\" rel=\"noopener\" title=\"Share on WhatsApp\"><svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><path d=\"M8.6 13.5l6.8 4M15.4 6.5l-6.8 4\"/></svg></a></div></div>" +
    "<div class=\"sp-comments\"><h3>Comments</h3><div id=\"spComments\"><p class=\"muted\">Loading comments\u2026</p></div></div></article></main>\n";
  var footer = "<footer class=\"site-footer\" id=\"follow\"><a class=\"wordmark\" href=\"../index.html\"><span id=\"footLogo\"></span><span>Anaxx <span class=\"wm-accent\">Science</span> Hub</span></a><p class=\"foot-tag\">notes from a radiography student, for health science students</p><div class=\"socials\"><a href=\"https://www.linkedin.com/in/churchill-celestine-239920291\" target=\"_blank\" rel=\"noopener\" aria-label=\"LinkedIn\" title=\"LinkedIn\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\"><rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"currentColor\"/><rect x=\"5.5\" y=\"9.5\" width=\"2.6\" height=\"9\" fill=\"#fff\"/><circle cx=\"6.8\" cy=\"6.6\" r=\"1.5\" fill=\"#fff\"/><path d=\"M10.6 9.5h2.5v1.3c.4-.8 1.4-1.5 2.9-1.5 3 0 3.5 2 3.5 4.5v4.7h-2.6v-4.2c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.3h-2.6z\" fill=\"#fff\"/></svg></a><a href=\"https://x.com/AnaxxWrites\" target=\"_blank\" rel=\"noopener\" aria-label=\"X\" title=\"X\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\"><path d=\"M3 3h5.2l4.3 5.9L17.4 3H20l-6.4 7.4L21 21h-5.2l-4.7-6.4L5.6 21H3l6.9-7.9z\" fill=\"currentColor\"/></svg></a><a href=\"https://substack.com/@vonanaxx\" target=\"_blank\" rel=\"noopener\" aria-label=\"Substack\" title=\"Substack\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"4\" fill=\"currentColor\"/><rect x=\"3\" y=\"9\" width=\"18\" height=\"4\" fill=\"currentColor\"/><path d=\"M3 15l9 5 9-5v-1H3z\" fill=\"currentColor\"/></svg></a><a href=\"https://wa.me/2349049787588\" target=\"_blank\" rel=\"noopener\" aria-label=\"WhatsApp\" title=\"WhatsApp\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\"><path d=\"M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M8.5 7.8c.3-.1.6 0 .8.4l.7 1.5c.1.3 0 .6-.2.8l-.5.6c.6 1.2 1.6 2.2 2.9 2.9l.6-.6c.2-.2.5-.3.8-.2l1.5.7c.3.2.5.5.4.8-.2 1-1 1.7-2 1.7-3.2 0-6.6-3.4-6.6-6.6 0-1 .7-1.8 1.6-2z\" fill=\"currentColor\"/></svg></a></div><p class=\"foot-legal\">© 2026 Anaxx Science Hub · <a href=\"../admin.html\">Admin</a></p></footer>\n" +

    "<button class=\"to-top\" id=\"toTop\" type=\"button\" aria-label=\"Back to top\" title=\"Back to top\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 19V5M5 12l7-7 7 7\"/></svg></button><script src=\"../header-v4.js\"></script><script src=\"../ambient.js\"></script>\n" +
    "<script>(function(){var API='" + SB_API + "',KEY='" + SB_PUB + "',PID='" + String(p.id || "") + "';" +
    "function vid(){var k='sp_visitor_v1',v='';try{v=localStorage.getItem(k)||''}catch(e){}if(!v){v='v-'+Math.random().toString(36).slice(2)+Date.now().toString(36);try{localStorage.setItem(k,v)}catch(e){}}return v}" +
    "var R=document.getElementById('spReactions');if(R){var HS=R.querySelectorAll('.react');function draw(d){for(var i=0;i<HS.length;i++){var t=HS[i].getAttribute('data-react'),c=HS[i].querySelector('b');if(c)c.textContent=(d&&d[t])||0;HS[i].setAttribute('aria-pressed',(d&&d.mine&&d.mine[t])?'true':'false')}}" +
    "fetch(API+'/reactions?post_id=eq.'+encodeURIComponent(PID)+'&select=emoji_type,visitor_id',{headers:{apikey:KEY}}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(rows){var o={like:0,dislike:0,insight:0,save:0,mine:{}};(rows||[]).forEach(function(x){if(o[x.emoji_type]!==undefined)o[x.emoji_type]++;if(x.visitor_id===vid())o.mine[x.emoji_type]=true});draw(o)}).catch(function(){});" +
    "for(var i=0;i<HS.length;i++){(function(btn){btn.addEventListener('click',function(){var t=btn.getAttribute('data-react'),mine=btn.getAttribute('aria-pressed')==='true';var url=API+'/reactions?post_id=eq.'+encodeURIComponent(PID)+'&emoji_type=eq.'+t+'&visitor_id=eq.'+encodeURIComponent(vid());fetch(url,{method:mine?'DELETE':'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:mine?undefined:JSON.stringify({post_id:PID,emoji_type:t,visitor_id:vid()})}).then(function(r){if(!r.ok)throw 0;btn.setAttribute('aria-pressed',mine?'false':'true');var c=btn.querySelector('b');if(c)c.textContent=Math.max(0,parseInt(c.textContent||'0',10)+(mine?-1:1))}).catch(function(){})})})(HS[i])}}" +
    "var C=document.getElementById('spComments');if(C&&!document.getElementById('spCForm')){var f=document.createElement('form');f.id='spCForm';f.setAttribute('class','cform');f.innerHTML='<div class=\"cform-row\"><div class=\"cform-main\"><input class=\"field cform-name\" id=\"spCName\" placeholder=\"Your name\" maxlength=\"80\" required><input class=\"field\" id=\"spCText\" placeholder=\"Add a comment\" maxlength=\"2000\" required><button class=\"csend\" type=\"submit\" aria-label=\"Send comment\">Send</button></div></div><div class=\"admin-note\" id=\"spCMsg\"></div>';C.parentNode.insertBefore(f, C.nextSibling);" +
    "f.addEventListener('submit',function(e){e.preventDefault();var n=document.getElementById('spCName'),t=document.getElementById('spCText'),m=document.getElementById('spCMsg');if(!n.value.trim()||!t.value.trim())return;m.textContent='Sending...';fetch(API+'/comments',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({post_id:PID,name:n.value.trim(),body:t.value.trim(),approved:false})}).then(function(r){if(!r.ok)throw 0;t.value='';m.textContent='Comment sent. It shows once approved.'}).catch(function(){m.textContent='Could not send. Try again.'})})}})();</script>" +
"<script>(function(){var C=document.getElementById('spComments');if(!C)return;fetch('" + SB_API + "/comments?post_id=eq." + encodeURIComponent(String(p.id || "")) + "&select=name,body,created_at&approved=eq.true&order=created_at.desc&limit=50',{headers:{apikey:'" + SB_PUB + "'}}).then(function(r){if(!r.ok)throw new Error('comments request failed');return r.json()}).then(function(list){if(!Array.isArray(list)||!list.length){C.innerHTML='<p class=muted>No comments yet. Be the first.</p>';return}C.innerHTML=list.map(function(c){return '<div class=sp-comment><b>'+esc(c.name)+'</b><span class=sc-date>'+esc((c.created_at||'').slice(0,10))+'</span><p>'+esc(c.body)+'</p></div>'}).join('')}).catch(function(){C.innerHTML='<p class=muted>Could not load comments.</p>'})})();</script></body></html>\n";
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
