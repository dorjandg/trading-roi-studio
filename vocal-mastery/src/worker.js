import defaultContent from './content.js';
import { renderPage } from './site.js';
import { apiFetch, loadContent, getPreviewContent } from './api.js';

const PAGES = ['/', '/academy', '/programs', '/landi', '/stories', '/media', '/voice', '/apply', '/contact', '/privacy'];
const security = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
function finish(response, request, isPrivate = false) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(security)) headers.set(key, value);
  if (!headers.has('X-Frame-Options')) headers.set('X-Frame-Options', isPrivate ? 'SAMEORIGIN' : 'DENY');
  if (isPrivate) { headers.set('Cache-Control','private, no-store'); headers.set('X-Robots-Tag','noindex, nofollow'); }
  return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
}
function html(markup, status = 200, privatePage = false) {
  return new Response(markup, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': privatePage ? 'private, no-store' : 'no-cache',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-src https://www.youtube-nocookie.com https://www.youtube.com; base-uri 'self'; form-action 'self' https://wa.me; frame-ancestors " + (privatePage ? "'self'" : "'none'"),
  }});
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === 'www.vocalmastery.net') {
      url.hostname = 'vocalmastery.net'; url.protocol = 'https:';
      return Response.redirect(url.href, 308);
    }
    const path = url.pathname;
    const privatePage = path.startsWith('/manage') || path.startsWith('/api/manage');
    try {
      if (path === '/manage/preview') {
        if (!['GET','HEAD'].includes(request.method)) return finish(new Response('Method not allowed', {status:405}),request,true);
        const preview = await getPreviewContent(request, env, ctx, defaultContent);
        if (preview instanceof Response) return finish(preview,request,true);
        const target = url.searchParams.get('page') || '/';
        if (!PAGES.includes(target)) return finish(new Response('Page not found',{status:404}),request,true);
        const language = url.searchParams.get('lang') === 'sq' ? 'sq' : 'en';
        return finish(html(renderPage(target, preview.content, language, { preview:true, draftId:preview.draftId }),200,true),request,true);
      }
      const api = await apiFetch(request, env, ctx, defaultContent);
      if (api) return finish(api,request,privatePage);
      if (path.startsWith('/api/') || privatePage) return finish(new Response('Not found',{status:404}),request,privatePage);
      if (!['GET','HEAD'].includes(request.method)) return finish(new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}}),request);
      if (path === '/health') return finish(Response.json({ok:true,site:'Vocal Mastery',languages:['en','sq']}),request);
      if (path === '/robots.txt') return finish(new Response('User-agent: *\nAllow: /\nDisallow: /manage\nDisallow: /api/\nSitemap: https://vocalmastery.net/sitemap.xml\n',{headers:{'Content-Type':'text/plain'}}),request);
      if (path === '/sitemap.xml') {
        const entries=PAGES.flatMap(p=>['en','sq'].map(lang=>`<url><loc>https://vocalmastery.net${p}?lang=${lang}</loc></url>`)).join('');
        return finish(new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`,{headers:{'Content-Type':'application/xml'}}),request);
      }
      if (path.startsWith('/assets/') || path === '/favicon.ico') return finish(await env.ASSETS.fetch(request),request);
      if (path.endsWith('.html')) {
        const clean = path === '/index.html' ? '/' : path.slice(0,-5);
        if (PAGES.includes(clean)) { url.pathname=clean;return Response.redirect(url.href,301); }
      }
      if (path !== '/' && path.endsWith('/') && PAGES.includes(path.slice(0,-1))) { url.pathname=path.slice(0,-1);return Response.redirect(url.href,301); }
      const content = await loadContent(env, defaultContent);
      const lang = ['sq','al'].includes(url.searchParams.get('lang')) ? 'sq' : 'en';
      return finish(html(renderPage(path,content,lang),PAGES.includes(path)?200:404),request);
    } catch (error) {
      console.error(JSON.stringify({event:'website_error',path,kind:error?.name||'Error'}));
      return finish(new Response('The academy website is temporarily unavailable. Please contact +355 69 208 5923.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}}),request,privatePage);
    }
  }
};
