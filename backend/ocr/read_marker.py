"""
Read a Nest EXPERT marker — the CAD image a CAD row is made from.

The team makes each marker in Nest EXPERT and uploads a screenshot (or the PDF export). Everything the
ERP needs is printed on it:

    title bar   Nest EXPERT - IP00138 PANT - S-M-L-XL-XXL*          -> the sizes; "L(x2)" = two of L
    status bar  Placed 135/135 | Eff 89,05% | Length 8,29 m | Width: 52,00 inch

so this is OCR of two thin strips, not "understanding" a picture. PaddleOCR's PP-OCR models (via RapidOCR,
ONNX on the CPU) read the numbers on 49 of the 50 images uploaded by 28-Sep-2026 — the miss was a photo of
a garment. Tesseract read 16. See backend/src/services/marker-reader.service.ts for the caller and
backend/src/services/helpers/cad-marker.helper.ts for what the ERP does with a reading.

    python read_marker.py <file>          one JSON object on stdout
    python read_marker.py --batch <dir>   one JSON line per image, a summary on stderr
    python read_marker.py --selftest      read the test fixtures and compare with expected.json (exit 1 on a miss)

The output never depends on the locale: decimal commas ("8,29") are read as points.
"""

import json
import logging
import os
import re
import sys
import time

READER_VERSION = "rapidocr-3.9.2/pp-ocrv6-small/1"

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.normpath(os.path.join(HERE, "..", "src", "__tests__", "fixtures", "markers"))

# The strips that carry the text, as fractions of the image height. The title bar is the top ~2 %,
# the status bar sits just above the Windows taskbar in the bottom ~6 %; the margins absorb window
# chrome and screenshots taken at other resolutions (1483x1079 .. 1600x977 on file).
TITLE_STRIP = (0.0, 0.05)
STATUS_STRIP = (0.86, 1.0)
UPSCALE = 2  # small UI text is read far better enlarged

NUM = r"(\d+\s?[.,]\s?\d+|\d+)"
LENGTH_RE = re.compile(r"Length\s*:?\s*" + NUM + r"\s*m\b", re.I)
WIDTH_RE = re.compile(r"Width\s*:?\s*" + NUM + r"\s*inch", re.I)
EFF_RE = re.compile(r"Eff\s*:?\s*" + NUM + r"\s*%", re.I)
PLACED_RE = re.compile(r"Placed\s*:?\s*(\d+)\s*/\s*(\d+)", re.I)

# One size token of a marker title, optionally repeated: S, XL, 3XL, XXXL, 28, FREE, "L(x2)"
SIZE_TOKEN_RE = re.compile(r"^(XS|S|M|L|XL|XXL|XXXL|[2-6]XL|XXS|\d{2}|FREE|FS)(?:\(X(\d+)\))?$", re.I)


def _num(text):
    if text is None:
        return None
    return float(text.replace(" ", "").replace(",", "."))


def parse_sizes(title_line):
    """The sizes at the end of a Nest EXPERT title, as [{sizeName, quantity}].

    "Nest EXPERT - IP00138 PANT - S-M-L-XL-XXL*"          -> S, M, L, XL, XXL (1 each)
    "Nest EXPERT - GRAIN NEW - L(x2)*"                    -> L x 2
    "Nest EXPERT - ESSSR273LS [BENNET-16]-S-M-L-XL-XXL*"  -> S..XXL — the style's "16]" is not a size
    Tokens are read from the END backwards and the walk stops at the first one that is not a size, so a
    style name or a file path in front never counts. The "*" Nest adds to an unsaved marker ends the title;
    anything OCR joined after it is dropped.

    A list is returned only when something that is NOT a size stands in front of it: a crop that began
    inside the list ("L-XL-XXL*") must read as "no sizes", never as a shorter list.
    """
    if not title_line:
        return []
    text = title_line.strip()
    if "*" in text:
        text = text[: text.rfind("*")]
    tokens = [t.strip() for t in re.split(r"\s*-\s*", text.strip())]
    sizes = []
    bounded = False
    for token in reversed(tokens):
        m = SIZE_TOKEN_RE.match(token.replace(" ", ""))
        if not m:
            bounded = True
            break
        sizes.append({"sizeName": m.group(1).upper(), "quantity": int(m.group(2)) if m.group(2) else 1})
    if not bounded:
        return []
    sizes.reverse()
    return sizes


def parse_status(text):
    length = LENGTH_RE.search(text)
    width = WIDTH_RE.search(text)
    eff = EFF_RE.search(text)
    placed = PLACED_RE.search(text)
    return {
        "lengthM": _num(length.group(1)) if length else None,
        "widthIn": _num(width.group(1)) if width else None,
        "efficiencyPct": _num(eff.group(1)) if eff else None,
        "placed": int(placed.group(1)) if placed else None,
        "total": int(placed.group(2)) if placed else None,
    }


def classify(reading):
    """READ = length, width and sizes all read; PARTIAL = a length but something missing; UNREADABLE = no length."""
    if reading["lengthM"] is None:
        return "UNREADABLE"
    if reading["widthIn"] is None or not reading["sizes"]:
        return "PARTIAL"
    return "READ"


def _silence_logs():
    for name in list(logging.root.manager.loggerDict) + ["RapidOCR", ""]:
        logging.getLogger(name).setLevel(logging.ERROR)


_ENGINE = None


def _engine():
    global _ENGINE
    if _ENGINE is None:
        from rapidocr import RapidOCR  # imported late: --help and parser tests need no models

        _ENGINE = RapidOCR()
        _silence_logs()
    return _ENGINE


def _ocr_line_items(image):
    """OCR text boxes grouped into lines, top to bottom: [{text, x1}] (x1 = the line's right end)."""
    result = _engine()(image)
    txts = getattr(result, "txts", None)
    boxes = getattr(result, "boxes", None)
    if txts is None or boxes is None:
        return []
    items = []
    for box, txt in zip(boxes, txts):
        ys = [p[1] for p in box]
        xs = [p[0] for p in box]
        items.append(((min(ys) + max(ys)) / 2, min(xs), max(xs), max(ys) - min(ys), txt))
    items.sort(key=lambda i: (i[0], i[1]))
    lines, current, current_y, current_h = [], [], None, None

    def close():
        current.sort()
        lines.append({"text": " ".join(c[2] for c in current), "x1": max(c[1] for c in current)})

    for y, x0, x1, h, txt in items:
        if current and abs(y - current_y) > max(current_h, h) * 0.6:
            close()
            current = []
        if not current:
            current_y, current_h = y, h
        current.append((x0, x1, txt))
    if current:
        close()
    return lines


def _ocr_lines(image):
    return [line["text"] for line in _ocr_line_items(image)]


# How much of a long title's END to re-read, in upscaled pixels (~300 px of the screenshot)
TITLE_TAIL = 600


def _title_sizes(title_strip, title_items):
    """Sizes from the title bar. A title holding a whole file path ("Nest EXPERT - Z:\\CAD_MASTER\\...
    \\TISHA AVG.ord - S-M-L(x2)-XL-XXL*") is too wide to be recognised in one piece, so when the full line
    gives no sizes, only its last few hundred pixels — where the sizes are — are read again."""
    title = next((l["text"] for l in title_items if "EXPERT" in l["text"].upper()), None)
    sizes = parse_sizes(title)
    if sizes or not title_items:
        return title, sizes
    right = int(title_items[0]["x1"])  # the top line is the title bar, however garbled
    tail = title_strip[:, max(0, right - TITLE_TAIL) : min(title_strip.shape[1], right + 30)]
    tail_lines = _ocr_lines(tail)
    tail_text = tail_lines[0] if tail_lines else None
    return (title or tail_text), parse_sizes(tail_text)


def _strip(image, span):
    import cv2

    h = image.shape[0]
    part = image[int(h * span[0]) : max(int(h * span[1]), int(h * span[0]) + 1), :]
    return cv2.resize(part, None, fx=UPSCALE, fy=UPSCALE, interpolation=cv2.INTER_CUBIC)


def _load_image(path):
    import cv2
    import numpy as np

    # np.fromfile + imdecode: cv2.imread cannot open a Windows path with non-ASCII characters
    data = np.fromfile(path, dtype=np.uint8)
    return cv2.imdecode(data, cv2.IMREAD_COLOR)


def _read_from_text(title_line, status_text):
    reading = parse_status(status_text)
    reading["title"] = title_line
    reading["sizes"] = parse_sizes(title_line)
    return reading


def _read_pdf(path):
    """A Nest EXPERT PDF export: its text layer when it has one, else page 1 rendered and OCR'd."""
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(path)
    page = pdf[0]
    text = page.get_textpage().get_text_range() or ""
    if LENGTH_RE.search(text):
        title = next((l for l in text.splitlines() if "EXPERT" in l.upper()), None)
        reading = _read_from_text(title, text)
        reading["text"] = text[:2000]
        return reading
    import cv2
    import numpy as np

    bitmap = page.render(scale=2).to_pil()
    image = cv2.cvtColor(np.array(bitmap), cv2.COLOR_RGB2BGR)
    return _read_image(image)


def _read_image(image):
    title_strip = _strip(image, TITLE_STRIP)
    title_items = _ocr_line_items(title_strip)
    status_lines = _ocr_lines(_strip(image, STATUS_STRIP))
    title, sizes = _title_sizes(title_strip, title_items)
    reading = parse_status(" ".join(status_lines))
    reading["title"] = title
    reading["sizes"] = sizes
    reading["text"] = "\n".join([l["text"] for l in title_items] + status_lines)[:2000]
    return reading


def read_marker(path):
    started = time.time()
    try:
        if path.lower().endswith(".pdf"):
            reading = _read_pdf(path)
        else:
            image = _load_image(path)
            if image is None:
                raise ValueError("not an image this reader can open")
            reading = _read_image(image)
        reading["status"] = classify(reading)
    except Exception as exc:  # the caller turns any failure into "not checked"; never a crash
        reading = {"status": "UNREADABLE", "error": str(exc)[:500], "sizes": [], "title": None, "text": None,
                   "lengthM": None, "widthIn": None, "efficiencyPct": None, "placed": None, "total": None}
    reading["pieces"] = sum(s["quantity"] for s in reading.get("sizes") or []) or None
    reading["ms"] = int((time.time() - started) * 1000)
    reading["readerVersion"] = READER_VERSION
    return reading


TITLE_CASES = [
    ("Nest EXPERT - IP00138 PANT - S-M-L-XL-XXL*", "S M L XL XXL"),
    ("N Nest EXPERT - GRAIN NEW - L(x2)*", "L L"),
    ("Nest EXPERT - ESSSR273LS  [BENNET-16 ] - S-M-L-XL-XXL*", "S M L XL XXL"),
    ("N Nest EXPERT - LEVIS - Default - S-M-L-XL-XXL* D", "S M L XL XXL"),  # OCR joined a stray "D"
    ("2026\\TISHA\\ESSFF106LS [TISHA ] AVG.ord - S-M-L(x2)-XL-XXL*", "S M L L XL XXL"),
    ("Nest EXPERT - Z:\\CAD\\GRAIN NEW AVG.ord - M(x3)-L(x3)*", "M M M L L L"),
    ("L-XL-XXL*", ""),  # a crop that began inside the list is NOT a shorter list
    ("", ""),
]


def _selftest():
    expected = json.load(open(os.path.join(FIXTURES, "expected.json"), encoding="utf-8"))
    failures = 0
    for title, want in TITLE_CASES:
        got = " ".join(" ".join([s["sizeName"]] * s["quantity"]) for s in parse_sizes(title))
        if got != want:
            failures += 1
            print(f"FAIL title {title!r}: {got!r}, expected {want!r}", file=sys.stderr)
    for name, want in expected.items():
        got = read_marker(os.path.join(FIXTURES, name))
        for key, value in want.items():
            if got.get(key) != value:
                failures += 1
                print(f"FAIL {name}: {key} = {got.get(key)!r}, expected {value!r}", file=sys.stderr)
        print(f"{'ok  ' if failures == 0 else '    '} {name} ({got['ms']} ms)", file=sys.stderr)
    print("selftest passed" if failures == 0 else f"selftest FAILED ({failures})", file=sys.stderr)
    return 0 if failures == 0 else 1


def main(argv):
    if len(argv) >= 2 and argv[1] == "--selftest":
        return _selftest()
    if len(argv) >= 3 and argv[1] == "--batch":
        folder = argv[2]
        names = sorted(n for n in os.listdir(folder) if n.lower().endswith((".png", ".jpg", ".jpeg", ".pdf")))
        read = 0
        for n in names:
            r = read_marker(os.path.join(folder, n))
            read += r["status"] != "UNREADABLE"
            print(json.dumps({"file": n, **r}, ensure_ascii=True))
        print(f"{read}/{len(names)} images had a marker length", file=sys.stderr)
        return 0
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    print(json.dumps(read_marker(argv[1]), ensure_ascii=True))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
