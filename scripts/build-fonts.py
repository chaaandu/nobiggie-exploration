"""Builds the self-hosted web fonts in public/fonts from the @fontsource packages.

Run: python3 scripts/build-fonts.py   (needs: pip install fonttools brotli)

Why: the full Fraunces variable font is ~120KB per style. We pin the axes we don't
animate (SOFT=100 for the soft serifs, WONK=1 for the wonky letters, opsz=144 for
display), keep a weight range so headings can be tuned, and subset to Latin.
None of Fraunces-latin, Instrument Sans or Gochi Hand ship a ₹ sign, so each family
gets a tiny extra file holding only U+20B9 (declared with unicode-range in fonts.css).
"""
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
import os

NM = "node_modules"
OUT = "public/fonts"
LATIN = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) +
    [0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A,
     0x201C, 0x201D, 0x201E, 0x2022, 0x2026, 0x2032, 0x2033, 0x2039, 0x203A, 0x20AC,
     0x2122, 0x2212]
)
RUPEE = [0x20B9]


def build(src, out, axes, unicodes):
    font = TTFont(src)
    # Subset first, then pin axes: instancing first trips a fontTools gvar bug on the italic.
    opts = subset.Options()
    opts.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "onum", "lnum", "tnum", "pnum", "case"]
    opts.name_IDs = [1, 2]  # family + style only
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG"]
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    if axes and "fvar" in font:
        font = instancer.instantiateVariableFont(font, axes, updateFontNames=False)
    font.flavor = "woff2"
    path = os.path.join(OUT, out)
    font.save(path)
    print(f"{out:34s} {os.path.getsize(path)/1024:6.1f} KB")


FR = f"{NM}/@fontsource-variable/fraunces/files"
display = {"SOFT": 100, "WONK": 1, "opsz": 144, "wght": (500, 800)}
build(f"{FR}/fraunces-latin-full-normal.woff2", "fraunces.woff2", display, LATIN)
build(f"{FR}/fraunces-latin-full-italic.woff2", "fraunces-italic.woff2", display, LATIN)
build(f"{FR}/fraunces-latin-ext-full-normal.woff2", "fraunces-rupee.woff2", display, RUPEE)

IS = f"{NM}/@fontsource-variable/instrument-sans/files"
build(f"{IS}/instrument-sans-latin-wdth-normal.woff2", "instrument-sans.woff2", {"wdth": 100, "wght": (400, 700)}, LATIN)
# Inter's ₹ matches Instrument Sans in weight and cap height (0.73 vs 0.72 em).
build(f"{NM}/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2", "instrument-sans-rupee.woff2", {"wght": (400, 700)}, RUPEE)

GH = f"{NM}/@fontsource/gochi-hand/files"
build(f"{GH}/gochi-hand-latin-400-normal.woff2", "gochi-hand.woff2", None, LATIN)
