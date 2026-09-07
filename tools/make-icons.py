#!/usr/bin/env python3
"""
Generate the app's PNG icons.

Uses only the Python standard library (zlib + struct) so the project stays free
of image tooling and no binary asset of unknown origin is committed. Re-run
this after editing icons/icon.svg to keep the raster icons in step:

    python3 tools/make-icons.py
"""

import struct
import zlib
from pathlib import Path

NAVY = (0x13, 0x1C, 0x30, 255)
BARS = [(0x2E, 0x7D, 0x4E, 255), (0x91, 0x56, 0x0A, 255), (0xB0, 0x44, 0x3A, 255)]
WHITE = (0xFF, 0xFF, 0xFF, 217)

ICONS_DIR = Path(__file__).resolve().parent.parent / "icons"


def rounded_rect_hit(px, py, x, y, w, h, r):
    """True when the pixel centre falls inside a rounded rectangle."""
    if not (x <= px < x + w and y <= py < y + h):
        return False
    if r <= 0:
        return True
    cx = min(max(px, x + r), x + w - r)
    cy = min(max(py, y + r), y + h - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def blend(dst, src):
    """Source-over compositing, so the translucent white bar sits on navy."""
    a = src[3] / 255.0
    return tuple(round(src[i] * a + dst[i] * (1 - a)) for i in range(3)) + (255,)


def draw(size, *, maskable=False):
    """Return RGBA rows for one icon at `size` pixels square."""
    # A maskable icon may be cropped to a circle, so keep art inside the
    # central 80% safe zone and let the background bleed to the edges.
    inset = size * 0.10 if maskable else 0.0
    art = size - inset * 2
    corner = 0 if maskable else size * 0.1875

    unit = art / 512.0
    bar_x = inset + 112 * unit
    bar_w = 288 * unit
    bar_h = 44 * unit
    bar_r = 10 * unit
    tops = [inset + t * unit for t in (128, 204, 280)]
    tab = (inset + 112 * unit, inset + 356 * unit, 180 * unit, 28 * unit, 8 * unit)

    rows = []
    for y in range(size):
        row = bytearray()
        py = y + 0.5
        for x in range(size):
            px = x + 0.5
            pixel = (0, 0, 0, 0)
            if maskable or rounded_rect_hit(px, py, 0, 0, size, size, corner):
                pixel = NAVY
                for top, colour in zip(tops, BARS):
                    if rounded_rect_hit(px, py, bar_x, top, bar_w, bar_h, bar_r):
                        pixel = colour
                        break
                else:
                    if rounded_rect_hit(px, py, tab[0], tab[1], tab[2], tab[3], tab[4]):
                        pixel = blend(pixel, WHITE)
            row += bytes(pixel)
        rows.append(bytes(row))
    return rows


def write_png(path, rows, size):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, payload):
        body = tag + payload
        return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body))

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)
    return len(png)


def main():
    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, True),
    ]
    for name, size, maskable in targets:
        path = ICONS_DIR / name
        written = write_png(path, draw(size, maskable=maskable), size)
        print(f"{name:26} {size}x{size}  {written:>6} bytes")


if __name__ == "__main__":
    main()
