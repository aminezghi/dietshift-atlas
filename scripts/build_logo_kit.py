import os

os.makedirs("public/brand/kit", exist_ok=True)


def make_glyph_paths(x0: float, y0: float, scale: float = 1.0):
    """Constructs geometric outlined paths for 'DIETSHIFT ATLAS' with zero <text> tags."""
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
    paths_word1 = []
    for ch in "DIETSHIFT":
        d_str, w = letters[ch]
        paths_word1.append(
            f'<g transform="translate({cursor:.1f},{y0:.1f}) scale({scale:.3f})"><path fill-rule="evenodd" d="{d_str}"/></g>'
        )
        cursor += (w + 13) * scale
    cursor += 28 * scale
    paths_word2 = []
    for ch in "ATLAS":
        d_str, w = letters[ch]
        paths_word2.append(
            f'<g transform="translate({cursor:.1f},{y0:.1f}) scale({scale:.3f})"><path fill-rule="evenodd" d="{d_str}"/></g>'
        )
        cursor += (w + 13) * scale
    return "\n      ".join(paths_word1), "\n      ".join(paths_word2), cursor


# 1. Master Two-Colour Symbol (Almanac Ink #111827 + Chart Magenta #8A1253 on Shifted Wedge & Node)
symbol_color_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">DietShift Atlas — Meridian Plate Symbol</title>
  <g id="symbol">
    <path fill="#111827" fill-rule="evenodd" d="
      M 122 24
      A 102 102 0 0 0 122 228
      Z
      M 44 82 H 104 V 98 H 44 Z
      M 32 118 H 104 V 134 H 32 Z
      M 44 154 H 104 V 170 H 44 Z
    "/>
    <path fill="#111827" d="
      M 138 136
      L 226 159.58
      A 102 102 0 0 1 138 224
      Z
    "/>
    <path fill="#8A1253" d="
      M 138 20
      A 102 102 0 0 1 226 94.42
      L 138 118
      Z
    "/>
    <circle fill="#8A1253" cx="216" cy="127" r="16"/>
  </g>
</svg>
"""

# 2. Small-Size 16px Favicon Cut (Wider meridian gap, 2 bold latitude bars instead of 3, larger r=20 node)
symbol_small_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">DietShift Atlas — Meridian Plate Small Cut (16px)</title>
  <g id="symbol">
    <path fill="#111827" fill-rule="evenodd" d="
      M 118 24
      A 102 102 0 0 0 118 228
      Z
      M 40 90 H 100 V 114 H 40 Z
      M 40 138 H 100 V 162 H 40 Z
    "/>
    <path fill="#111827" d="
      M 142 142
      L 228 165.04
      A 102 102 0 0 1 142 224
      Z
    "/>
    <path fill="#8A1253" d="
      M 142 20
      A 102 102 0 0 1 228 88.96
      L 142 112
      Z
    "/>
    <circle fill="#8A1253" cx="214" cy="127" r="20"/>
  </g>
</svg>
"""

with open("public/brand/kit/dietshift-symbol-color.svg", "w", encoding="utf-8") as f:
    f.write(symbol_color_svg)

with open("public/brand/kit/dietshift-symbol-small.svg", "w", encoding="utf-8") as f:
    f.write(symbol_small_svg)

# 3. Horizontal Lockup (Color)
w1, w2, _ = make_glyph_paths(276, 66, scale=0.62)
lockup_horizontal_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1012 256" width="1012" height="256" role="img" aria-labelledby="title">
  <title id="title">DietShift Atlas — Horizontal Lockup</title>
  <g id="symbol">
    <path fill="#111827" fill-rule="evenodd" d="
      M 122 24
      A 102 102 0 0 0 122 228
      Z
      M 44 82 H 104 V 98 H 44 Z
      M 32 118 H 104 V 134 H 32 Z
      M 44 154 H 104 V 170 H 44 Z
    "/>
    <path fill="#111827" d="
      M 138 136
      L 226 159.58
      A 102 102 0 0 1 138 224
      Z
    "/>
    <path fill="#8A1253" d="
      M 138 20
      A 102 102 0 0 1 226 94.42
      L 138 118
      Z
    "/>
    <circle fill="#8A1253" cx="216" cy="127" r="16"/>
  </g>
  <g id="wordmark">
    <g fill="#111827">
      {w1}
    </g>
    <g fill="#8A1253">
      {w2}
    </g>
    <rect fill="#111827" x="276" y="150" width="705" height="6"/>
    <rect fill="#8A1253" x="276" y="170" width="240" height="12"/>
    <rect fill="#163D4A" x="532" y="170" width="168" height="12"/>
  </g>
</svg>
"""
with open("public/brand/kit/dietshift-lockup-horizontal.svg", "w", encoding="utf-8") as f:
    f.write(lockup_horizontal_svg)

# 4. Stacked Lockup (512 x 380)
w1_s, w2_s, _ = make_glyph_paths(32, 260, scale=0.42)
lockup_stacked_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 360" width="540" height="360" role="img" aria-labelledby="title">
  <title id="title">DietShift Atlas — Stacked Lockup</title>
  <g id="symbol" transform="translate(154, 12) scale(0.9)">
    <path fill="#111827" fill-rule="evenodd" d="
      M 122 24
      A 102 102 0 0 0 122 228
      Z
      M 44 82 H 104 V 98 H 44 Z
      M 32 118 H 104 V 134 H 32 Z
      M 44 154 H 104 V 170 H 44 Z
    "/>
    <path fill="#111827" d="
      M 138 136
      L 226 159.58
      A 102 102 0 0 1 138 224
      Z
    "/>
    <path fill="#8A1253" d="
      M 138 20
      A 102 102 0 0 1 226 94.42
      L 138 118
      Z
    "/>
    <circle fill="#8A1253" cx="216" cy="127" r="16"/>
  </g>
  <g id="wordmark">
    <g fill="#111827">
      {w1_s}
    </g>
    <g fill="#8A1253">
      {w2_s}
    </g>
    <rect fill="#111827" x="32" y="316" width="478" height="5"/>
  </g>
</svg>
"""
with open("public/brand/kit/dietshift-lockup-stacked.svg", "w", encoding="utf-8") as f:
    f.write(lockup_stacked_svg)

print("Generated Concept A Phase 7 master SVGs in public/brand/kit/")
