// Plain HTML error page for the Orbit sign-in callback (no React: it is returned straight from a route handler).

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function ssoErrorHtml(opts: { title: string; message: string; links: { href: string; label: string }[] }): string {
  const links = opts.links.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(" ");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(opts.title)}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#f5f6f8;color:#1a1a1a}
main{max-width:26rem;margin:1rem;background:#fff;padding:2rem;border-radius:.75rem;box-shadow:0 10px 30px rgba(0,0,0,.12)}
h1{font-size:1.25rem;margin:0 0 .75rem}p{line-height:1.5;margin:0 0 1.25rem}a{display:inline-block;margin-right:1rem;color:#0b5cad;font-weight:600}</style></head>
<body><main><h1>${esc(opts.title)}</h1><p>${esc(opts.message)}</p>${links}</main></body></html>`;
}
