import os

os.makedirs("public/brand/concepts", exist_ok=True)


def make_glyph_paths(x0: float, y0: float, scale: float = 1.0):
    """Constructs geometric outlined paths for 'DIETSHIFT ATLAS' with zero <text> tags and exact angles."""
    letters = {
        "D": (
            "M 0 0 H 44 A 50 50 0 0 1 44 100 H 0 Z M 18 18 V 82 H 42 A 32 32 0 0 0 42 18 Z",
            88,
        ),
        "I": ("M 0 0 H 18 V 100 H 0 Z", 18),
        "E": (
            "M 0 0 H 68 V 18 H 18 V 41 H 58 V 59 H 18 V 82 H 68 V 100 H 0 Z",
            68,
        ),
        "T": ("M 0 0 H 76 V 18 H 47 V 100 H 29 V 18 H 0 Z", 76),
        "S": (
            "M 66 24 H 47 C 45 16 38 15 32 15 C 22 15 18 20 18 27 C 18 35 26 38 42 42 C 62 47 70 56 70 72 C 70 90 55 100 35 100 C 13 100 0 88 0 71 H 19 C 20 80 26 84 36 84 C 46 84 52 79 52 72 C 52 63 44 60 28 56 C 10 51 0 43 0 27 C 0 11 14 0 33 0 C 53 0 65 10 66 24 Z",
            70,
        ),
        "H": (
            "M 0 0 H 18 V 41 H 58 V 0 H 76 V 100 H 58 V 59 H 18 V 100 H 0 Z",
            76,
        ),
        "F": ("M 0 0 H 66 V 18 H 18 V 43 H 56 V 61 H 18 V 100 H 0 Z", 66),
        "A": (
            "M 34 0 H 52 L 86 100 H 67 L 59 76 H 27 L 19 100 H 0 Z M 32 59 H 54 L 43 24 Z",
            86,
        ),
        "L": ("M 0 0 H 18 V 82 H 66 V 100 H 0 Z", 66),
    }

    cursor = x0
    paths = []
    for ch in "DIETSHIFT":
        d_str, w = letters[ch]
        paths.append(
            f'<g transform="translate({cursor:.1f},{y0:.1f}) scale({scale:.3f})"><path fill-rule="evenodd" d="{d_str}"/></g>'
        )
        cursor += (w + 13) * scale
    cursor += 28 * scale
    for ch in "ATLAS":
        d_str, w = letters[ch]
        paths.append(
            f'<g transform="translate({cursor:.1f},{y0:.1f}) scale({scale:.3f})"><path fill-rule="evenodd" d="{d_str}"/></g>'
        )
        cursor += (w + 13) * scale
    return "\n    ".join(paths), cursor


# Concept A Symbol: Meridian Plate (Abstract / Cartographic-Dietary Tectonic Shift)
# Exact 15-degree wedge (tan 15° = 0.26795 -> dx=88, dy=23.58) and optical centring on 256x256 canvas.
concept_a_symbol_inner = """  <g id="symbol" fill="#111827">
    <path fill-rule="evenodd" d="
      M 122 24
      A 102 102 0 0 0 122 228
      Z
      M 44 82 H 104 V 98 H 44 Z
      M 32 118 H 104 V 134 H 32 Z
      M 44 154 H 104 V 170 H 44 Z
    "/>
    <path d="
      M 138 20
      A 102 102 0 0 1 226 94.42
      L 138 118
      Z
    "/>
    <path d="
      M 138 136
      L 226 159.58
      A 102 102 0 0 1 138 224
      Z
    "/>
    <circle cx="216" cy="127" r="16"/>
  </g>"""

# Concept B Symbol: Atlas D-A Monogram (Letterform / Negative-Space Monogram)
# Bold geometric 'D' silhouette with an upright 'A' / North-pointing compass apex carved in negative space,
# plus a horizontal shift-bar cutting cleanly across the stem. Avoids the right-pointing play-button cliché.
concept_b_symbol_inner = """  <g id="symbol" fill="#111827">
    <path fill-rule="evenodd" d="
      M 28 24
      H 128
      A 104 104 0 0 1 128 232
      H 28
      Z
      M 124 62
      L 168 182
      H 142
      L 133 156
      H 115
      L 106 182
      H 80
      Z
      M 28 118
      H 64
      V 138
      H 28
      Z
    "/>
    <polygon points="124,96 130,136 118,136"/>
  </g>"""

# Concept C Symbol: Quintile Horizon (Pictorial-Abstract / Statistical Quartile Globe)
concept_c_symbol_inner = """  <g id="symbol" fill="#111827">
    <path d="M 34 144 H 68 V 196 A 104 104 0 0 1 34 144 Z"/>
    <path d="M 84 108 H 118 V 226 A 104 104 0 0 1 84 214 Z"/>
    <path d="M 134 72 H 168 V 222 A 104 104 0 0 1 134 228 Z"/>
    <path d="M 184 40 H 218 V 172 A 104 104 0 0 1 184 206 Z"/>
    <path d="M 32 120 A 104 104 0 0 1 160 26 L 160 50 A 80 80 0 0 0 56 120 Z"/>
  </g>"""

for code, title, inner in [
    ("a", "Meridian Plate", concept_a_symbol_inner),
    ("b", "Atlas D-A Monogram", concept_b_symbol_inner),
    ("c", "Quintile Horizon", concept_c_symbol_inner),
]:
    svg_sym = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">DietShift Atlas — {title} Symbol</title>
{inner}
</svg>
"""
    with open(
        f"public/brand/concepts/concept-{code}-symbol.svg", "w", encoding="utf-8"
    ) as f:
        f.write(svg_sym)

    wm_paths, end_x = make_glyph_paths(276, 66, scale=0.62)
    svg_lock = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1012 256" width="1012" height="256" role="img" aria-labelledby="title">
  <title id="title">DietShift Atlas — {title} Lockup</title>
{inner}
  <g id="wordmark" fill="#111827">
    {wm_paths}
    <rect x="276" y="150" width="705" height="6"/>
    <rect x="276" y="170" width="240" height="12"/>
    <rect x="532" y="170" width="168" height="12"/>
  </g>
</svg>
"""
    with open(
        f"public/brand/concepts/concept-{code}-lockup.svg", "w", encoding="utf-8"
    ) as f:
        f.write(svg_lock)

print("Generated 3 refined symbol SVGs and 3 lockup SVGs in public/brand/concepts/")
