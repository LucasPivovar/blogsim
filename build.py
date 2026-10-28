"""Gera index.html: tokens + design system + app num arquivo só (abre no navegador ou publica como artifact)."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
DS = ROOT / "design-system"
FONTS = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400&display=swap"
REACT = "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"
REACT_DOM = "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"
GSAP = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"
SCROLL_TRIGGER = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"


def tokens_css(tokens):
    themes = [t["id"] for t in tokens["color"]["themes"]]
    first, dark = themes[0], themes[1]

    def val(tok, theme):
        v = tok["value"]
        return v if isinstance(v, str) else v.get(theme, v[first])

    def block(theme):
        lines = [f"  --{t['name']}: {val(t, theme)};" for t in tokens["color"]["tokens"]]
        lines += [f"  --{t['name']}: {val(t, theme)};" for t in tokens.get("shadow", {}).get("tokens", [])]
        return "\n".join(lines)

    static = [f"  --font-{k}: {v};" for k, v in tokens["type"]["families"].items()]
    for fam in ("spacing", "radius"):
        static += [f"  --{t['name']}: {t['value']};" for t in tokens[fam]["tokens"]]
    return (
        ":root {\n" + block(first) + "\n" + "\n".join(static) + "\n}\n"
        "@media (prefers-color-scheme: dark) {\n  :root:not([data-theme=\"light\"]) {\n" + block(dark) + "\n  color-scheme: dark;\n  }\n}\n"
        ":root[data-theme=\"dark\"] {\n" + block(dark) + "\n  color-scheme: dark;\n}\n"
    )


def main():
    tokens = json.loads((DS / "tokens.json").read_text(encoding="utf-8"))
    ds_css = re.sub(r"@import url\([^)]*\);\s*", "", (DS / "bundle.css").read_text(encoding="utf-8"))
    app_css = (ROOT / "src" / "app.css").read_text(encoding="utf-8")
    scripts = {name: p.read_text(encoding="utf-8") for name, p in
               (("bundle.js", DS / "bundle.js"), ("app.js", ROOT / "src" / "app.js"))}
    for name, text in scripts.items():
        if "</script" in text.lower():
            raise SystemExit(f"{name} contém '</script' e quebraria o HTML")

    # Protótipo só no tema claro (visual clean e branco); o design system mantém o escuro.
    light_tokens = tokens_css(tokens).split("@media (prefers-color-scheme: dark)")[0]
    head = f"""<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>BlogSim</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="{FONTS}">
<style>
{light_tokens}
{ds_css}
{app_css}
</style>
"""
    body = f"""<div id="app"></div>
<script src="{REACT}"></script>
<script src="{REACT_DOM}"></script>
<script src="{GSAP}"></script>
<script src="{SCROLL_TRIGGER}"></script>
<script>
{scripts["bundle.js"]}
</script>
<script>
{scripts["app.js"]}
</script>
"""
    # index.html: página para o artifact do Claude, que completa doctype, html, head e body sozinho.
    html = head + body
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    print(f"index.html: {len(html.encode('utf-8')) / 1024:.0f} KB")

    # dist/index.html: documento completo para servir num servidor web (nginx, Vercel).
    page = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
            + head + '<meta name="description" content="Anuncie nos blogs que seu cliente já lê. Escolha blogs por nicho e região e acompanhe visitas, conversas e vendas.">\n'
            + '</head>\n<body>\n' + body + '</body>\n</html>\n')
    (ROOT / "dist").mkdir(exist_ok=True)
    (ROOT / "dist" / "index.html").write_text(page, encoding="utf-8")
    print(f"dist/index.html: {len(page.encode('utf-8')) / 1024:.0f} KB")

if __name__ == "__main__":
    main()