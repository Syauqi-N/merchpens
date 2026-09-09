#!/usr/bin/env python3
"""Remap warna terang toko-online -> dark+gold Merch PENS (design.md).

Cara pakai:  python3 scripts/remap-dark.py            (dry-run: hitung saja)
              python3 scripts/remap-dark.py --apply    (tulis perubahan)

ATURAN MAIN:
- Hanya menyentuh class Tailwind hardcoded (slate/sky/white + status pastel).
- Token shadcn (bg-primary, text-muted-...) TIDAK disentuh: mereka otomatis
  gelap lewat `.dark` di globals.css karena <html> selalu punya kelas `dark`.
- Varian `dark:` TIDAK disentuh (sudah sadar-tema gelap).
- Reversibel: untuk kembali ke terang, jalankan dengan --reverse memakai
  daftar RULES yang sama (dibalik otomatis). BUKAN transpose sempurna untuk
  aturan pair (button), tapi cukup untuk perbandingan visual.

Urutan penting: pair-button dulu, baru global.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "src"
EXTS = {".tsx", ".ts"}

# (pola, ganti) — diterapkan berurutan per file.
RULES: list[tuple[str, str]] = [
    # --- 1. Tombol: bg-sky-600 + text-white dalam satu string -> emas + hitam.
    #     text-white di string LAIN (overlay gambar, badge berwarna) dibiarkan.
    (r"bg-sky-600((?:[^\"'`]*?))text-white", r"bg-gold\1text-obsidian"),
    (r"text-white((?:[^\"'`]*?))bg-sky-600", r"text-obsidian\1bg-gold"),
    (r"hover:bg-sky-700((?:[^\"'`]*?))text-obsidian", r"hover:bg-gold-light\1text-obsidian"),
    (r"text-obsidian((?:[^\"'`]*?))hover:bg-sky-700", r"text-obsidian\1hover:bg-gold-light"),
    # --- 2. Sky global -> emas.
    (r"bg-sky-700(?![\w-])", "bg-gold-deep"),
    (r"bg-sky-600(?![\w-])", "bg-gold"),
    (r"bg-sky-500(?![\w-])", "bg-gold"),
    (r"hover:bg-sky-700(?![\w-])", "hover:bg-gold-light"),
    (r"text-sky-800(?![\w-])", "text-gold-light"),
    (r"text-sky-700(?![\w-])", "text-gold"),
    (r"text-sky-600(?![\w-])", "text-gold"),
    (r"text-sky-500(?![\w-])", "text-gold-light"),
    (r"text-sky-900(?![\w-])", "text-gold-light"),
    (r"text-sky-300(?![\w-])", "text-gold-light"),
    (r"bg-sky-100(?![\w-])", "bg-gold/15"),
    (r"bg-sky-50(?![\w-])", "bg-gold/10"),
    (r"border-sky-200(?![\w-])", "border-gold/30"),
    (r"border-sky-100(?![\w-])", "border-gold/20"),
    (r"ring-sky-600(?![\w-])", "ring-gold/60"),
    (r"ring-sky-500(?![\w-])", "ring-gold/50"),
    (r"ring-sky-200(?![\w-])", "ring-gold/30"),
    (r"ring-sky-100(?![\w-])", "ring-gold/20"),
    (r"from-sky-700(?![\w-])", "from-gold-deep"),
    (r"via-sky-600(?![\w-])", "via-gold"),
    # --- 3. Slate teks -> krem berjenjang.
    (r"text-slate-900(?![\w-])", "text-cream"),
    (r"text-slate-800(?![\w-])", "text-cream-soft"),
    (r"text-slate-700(?![\w-])", "text-[#D8D3C7]"),
    (r"text-slate-600(?![\w-])", "text-cream-muted"),
    (r"text-slate-500(?![\w-])", "text-cream-muted"),
    (r"text-slate-400(?![\w-])", "text-[#8A8A8A]"),
    (r"text-slate-300(?![\w-])", "text-[#6E6E6E]"),
    # --- 4. Latar & garis netral.
    (r"bg-white(?![\w/-])", "bg-coal"),
    (r"bg-white/85(?![\w-])", "bg-obsidian/85"),
    (r"bg-white/80(?![\w-])", "bg-obsidian/80"),
    (r"bg-white/20(?![\w-])", "bg-white/10"),
    (r"bg-white/15(?![\w-])", "bg-white/10"),
    (r"bg-slate-50(?![\w-])", "bg-obsidian"),
    (r"bg-slate-100(?![\w-])", "bg-raise"),
    (r"bg-slate-200(?![\w-])", "bg-[#2A2A2A]"),
    (r"border-slate-300(?![\w-])", "border-[#3A3A3A]"),
    (r"border-slate-200(?![\w-])", "border-white/10"),
    (r"border-slate-100(?![\w-])", "border-white/5"),
    (r"ring-slate-200(?![\w-])", "ring-white/10"),
    (r"ring-slate-100(?![\w-])", "ring-white/5"),
    (r"divide-slate-200(?![\w-])", "divide-white/10"),
    (r"divide-slate-100(?![\w-])", "divide-white/5"),
    (r"from-slate-900(?![\w-])", "from-cream"),
    (r"via-slate-900(?![\w-])", "via-cream"),
    (r"to-slate-900(?![\w-])", "to-cream"),
    # --- 5. Status pastel -> versi transparan gelap (solid dibiarkan).
    (r"bg-amber-50(?![\w-])", "bg-amber-500/10"),
    (r"bg-amber-100(?![\w-])", "bg-amber-500/15"),
    (r"text-amber-900(?![\w-])", "text-amber-200"),
    (r"text-amber-800(?![\w-])", "text-amber-200"),
    (r"text-amber-700(?![\w-])", "text-amber-300"),
    (r"border-amber-200(?![\w-])", "border-amber-500/30"),
    (r"ring-amber-200(?![\w-])", "ring-amber-500/30"),
    (r"bg-emerald-50(?![\w-])", "bg-emerald-500/10"),
    (r"bg-emerald-100(?![\w-])", "bg-emerald-500/15"),
    (r"text-emerald-900(?![\w-])", "text-emerald-200"),
    (r"text-emerald-800(?![\w-])", "text-emerald-200"),
    (r"text-emerald-700(?![\w-])", "text-emerald-300"),
    (r"border-emerald-200(?![\w-])", "border-emerald-500/30"),
    (r"ring-emerald-200(?![\w-])", "ring-emerald-500/30"),
    (r"bg-red-50(?![\w-])", "bg-red-500/10"),
    (r"bg-red-100(?![\w-])", "bg-red-500/15"),
    (r"text-red-800(?![\w-])", "text-red-200"),
    (r"text-red-700(?![\w-])", "text-red-300"),
    (r"text-red-600(?![\w-])", "text-red-400"),
    (r"border-red-200(?![\w-])", "border-red-500/30"),
    (r"ring-red-200(?![\w-])", "ring-red-500/30"),
    (r"bg-rose-50(?![\w-])", "bg-rose-500/10"),
    (r"bg-rose-100(?![\w-])", "bg-rose-500/15"),
    (r"text-rose-800(?![\w-])", "text-rose-200"),
    (r"text-rose-700(?![\w-])", "text-rose-300"),
    (r"border-rose-200(?![\w-])", "border-rose-500/30"),
    (r"ring-rose-200(?![\w-])", "ring-rose-500/30"),
    (r"bg-indigo-50(?![\w-])", "bg-indigo-500/10"),
    (r"bg-indigo-100(?![\w-])", "bg-indigo-500/15"),
    (r"text-indigo-800(?![\w-])", "text-indigo-200"),
    (r"text-indigo-700(?![\w-])", "text-indigo-300"),
    (r"border-indigo-200(?![\w-])", "border-indigo-500/30"),
]

# Lindungi segmen `dark:...` (sudah sadar-tema) dari rewrite global.
DARK_SEGMENT = re.compile(r"dark:[a-z0-9/\-[\].#]+(?:/[0-9]+)?", re.IGNORECASE)


def apply_rules(text: str, rules: list[tuple[str, str]]) -> tuple[str, int]:
    total = 0
    # Pisahkan segmen dark: agar tidak tersentuh.
    parts = re.split(r"(dark:[^\s\"'`]+)", text)
    for i in range(0, len(parts), 2):
        chunk = parts[i]
        for pattern, repl in rules:
            # Aturan pair (mengandung grup) diulang sampai stabil.
            for _ in range(5):
                chunk, n = re.subn(pattern, repl, chunk)
                total += n
                if n == 0:
                    break
        parts[i] = chunk
    return "".join(parts), total


def main() -> None:
    apply = "--apply" in sys.argv
    reverse = "--reverse" in sys.argv
    rules = RULES
    if reverse:
        # Balik literal sederhana saja (aturan pair regex tidak dibalik).
        rules = [(re.escape(b), a) for a, b in RULES if "(" not in a]
        rules = [(a, b) for a, b in rules]
    changed_files = 0
    changed_spots = 0
    for path in sorted(ROOT.rglob("*")):
        if path.suffix not in EXTS or "generated" in path.parts:
            continue
        original = path.read_text()
        if reverse:
            updated, n = original, 0
            for a, b in rules:
                updated, m = re.subn(a, b, updated)
                n += m
        else:
            updated, n = apply_rules(original, rules)
        if n:
            changed_files += 1
            changed_spots += n
            print(f"{n:4d}  {path.relative_to(ROOT)}")
            if apply:
                path.write_text(updated)
    print(f"\n{changed_spots} titik di {changed_files} file" + (" — DITULIS" if apply else " (dry-run)"))


if __name__ == "__main__":
    main()
