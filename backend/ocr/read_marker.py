"""
Read a Nest EXPERT marker — the CAD image a CAD row is made from.

The team makes each marker in Nest EXPERT and uploads a screenshot (or the PDF export). Everything the
ERP needs is printed on it:

    title bar   Nest EXPERT - IP00138 PANT - S-M-L-XL-XXL*          -> the sizes; "L(x2)" = two of L
    piece table under the toolbar: one column per pattern piece,   -> the sizes again, when the title bar
                rows "S 1/1", "M 1/1" ... (size, placed/required)     is not in the screenshot
    status bar  Placed 135/135 | Eff 89,05% | Length 8,29 m | Width: 52,00 inch

so this is OCR of a few thin strips, not "understanding" a picture. PaddleOCR's PP-OCR models (via
RapidOCR, ONNX on the CPU — the models bundled with the rapidocr wheel; nothing is ever downloaded) read the
numbers on 49 of the 50 images uploaded by 28-Sep-2026 — the miss was a photo of a garment. Tesseract read
16. See backend/src/services/marker-reader.service.ts for the caller and
backend/src/services/helpers/cad-marker.helper.ts for what the ERP does with a reading.

The piece table is read only when the title gives no sizes (LNG129, 29-Sep-2026: the screenshot began below
the title bar), and its answer is kept only when it adds up exactly — see decide_piece_sizes.

    python read_marker.py <file>          one JSON object on stdout
    python read_marker.py --batch <dir>   one JSON line per image, a summary on stderr
    python read_marker.py --selftest [fixtures-dir]
                                          read the test fixtures and compare with expected.json (exit 1 on a miss)

The output never depends on the locale: decimal commas ("8,29") are read as points.
"""

import json
import logging
import math
import os
import re
import sys
import time
from collections import Counter

READER_VERSION = "rapidocr-3.9.2/pp-ocrv6-small/3"

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.normpath(os.path.join(HERE, "..", "src", "__tests__", "fixtures", "markers"))

# The strips that carry the text, as fractions of the image height. The title bar is the top ~2 %,
# the status bar sits just above the Windows taskbar in the bottom ~6 %; the margins absorb window
# chrome and screenshots taken at other resolutions (1483x1079 .. 1840x1030 on file).
TITLE_STRIP = (0.0, 0.05)
STATUS_STRIP = (0.86, 1.0)
UPSCALE = 2  # small UI text is read far better enlarged

NUM = r"(\d+\s?[.,]\s?\d+|\d+)"
LENGTH_RE = re.compile(r"Length\s*:?\s*" + NUM + r"\s*m\b", re.I)
WIDTH_RE = re.compile(r"Width\s*:?\s*" + NUM + r"\s*inch", re.I)
EFF_RE = re.compile(r"Eff\s*:?\s*" + NUM + r"\s*%", re.I)
PLACED_RE = re.compile(r"Placed\s*:?\s*(\d+)\s*/\s*(\d+)", re.I)

# One size token of a marker title, optionally repeated: S, XL, 3XL, XXXL, 2XS, 8, 28, 100, FREE SIZE, "L(x2)"
SIZE_TOKEN_RE = re.compile(
    r"^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|[2-6]XL|[2-4]XS|\d{1,3}|FREESIZE|FREE|FS)(?:\(X(\d+)\))?$", re.I
)
# A token that looks like a size this reader does not know (7XL, XXXXXL, 5XS): a list cut there is not the whole
# list, so the title gives no sizes rather than its tail
LOOKS_LIKE_SIZE_RE = re.compile(r"^\d?X{1,6}[SL](?:\(X\d+\))?$", re.I)


def _size_kind(name):
    """'number' (8, 28, 100) or 'letter' (S, XL, FREE): one marker lists sizes of one kind"""
    return "number" if name.isdigit() else "letter"


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
        compact = token.replace(" ", "")
        m = SIZE_TOKEN_RE.match(compact)
        # A size of the other kind ends the list: "IP00138 - 02 - S-M-L" is S, M, L (02 is the style's part)
        if m and sizes and _size_kind(m.group(1)) != _size_kind(sizes[-1]["sizeName"]):
            m = None
            bounded = True
            break
        # Number sizes run up in small steps (8-10-12, 28-30-32, 90-100-110): a number that is not below the size
        # after it, or less than half of it, is the style's part or the marker's width, not a size
        # ("PANT - 2 - 28-30-32" is 28, 30, 32; "X - 100 - 28-30" is 28, 30)
        if m and sizes and _size_kind(m.group(1)) == "number":
            n, after = int(m.group(1)), int(sizes[-1]["sizeName"])
            if not (n < after <= 2 * n):
                bounded = True
                break
        if not m:
            # Stopped on something that looks like a size: the list goes on past what this reader knows, so its
            # tail is not the marker's sizes ("2XS-XS-S-M" read XS, S, M until 2026-10-01; "8-10-12-14" read 10..14)
            if sizes and LOOKS_LIKE_SIZE_RE.match(compact):
                return []
            bounded = True
            break
        sizes.append({"sizeName": m.group(1).upper(), "quantity": int(m.group(2)) if m.group(2) else 1})
    if not bounded:
        return []
    sizes.reverse()
    return sizes


MENU_WORDS = ("FILE", "NEST", "PIECE", "MARKER", "VIEW", "APPLICATION", "ABOUT")


def is_menu_bar(line):
    """Nest EXPERT's menu bar ("File Nest Piece Marker settings View Application settings About"), which is the
    top line of a screenshot that begins below the title bar. It is never the title: re-reading its right end
    read the logged-in user's name ("Himar") as the title (LNG129, 29-Sep-2026). The real title says
    "Nest EXPERT", so a line with "EXPERT" in it is never the menu bar."""
    if not line:
        return False
    upper = line.upper()
    if "EXPERT" in upper:
        return False
    return sum(1 for word in MENU_WORDS if re.search(r"\b" + word + r"\b", upper)) >= 4


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


# ---------------------------------------------------------------------------
# The piece table: the sizes when the title bar is not in the screenshot
# ---------------------------------------------------------------------------

# Numbers of 2-3 digits only: a lone digit in a piece cell is far more often a misread letter (S→5, L→1) than a size
PIECE_SIZE_RE = re.compile(r"^(XXXXL|XXXL|XXL|XXXS|XXS|XS|XL|[2-6]XL|[2-4]XS|S|M|L|FREESIZE|FREE|FS|\d{2,3})$")
PIECE_COUNT_RE = re.compile(r"^(\d{1,3})/(\d{1,3})$")
GROUP_LABEL_RE = re.compile(r"^\s*GROUP\s*[0-9OIl]+\s*$", re.I)  # OCR reads "Group 0" as "Group o"
CUT_ONE_LABEL_RE = re.compile(r"CUT\s*-?\s*1(?!\d)", re.I)


def parse_piece_size(text):
    """A size name read from one piece-table row ("S", "xxl") — exactly one size token, or None."""
    token = re.sub(r"[^A-Za-z0-9]", "", text or "").upper()
    return token if PIECE_SIZE_RE.match(token) else None


def parse_piece_count(text):
    """(placed, required) from one row's "1/1", "0/2" — or None. The usual OCR confusions of 1 and 0 are
    undone first (l, I, |, i -> 1; O, o -> 0); the sums in decide_piece_sizes catch any other misread."""
    cleaned = (text or "").replace(" ", "").translate(str.maketrans({"l": "1", "I": "1", "|": "1", "i": "1", "O": "0", "o": "0"}))
    m = PIECE_COUNT_RE.match(cleaned)
    if not m:
        return None
    placed, required = int(m.group(1)), int(m.group(2))
    if required < 1 or placed > required:
        return None
    return placed, required


def decide_piece_sizes(columns, total):
    """The garments per size a piece table shows, or (None, why) — an answer only when it adds up exactly.

    `columns` = [{"label": "BACK CUT 1", "rows": [(sizeName|None, required|None), ...]}, ...], one per
    piece column in screen order; `total` = the status bar's "Placed a/TOTAL" (pieces in the marker).

      - "Group N" columns hold pieces already counted in their own columns: left out.
      - Every column lists the same sizes, one row each, in the same order; each size's name must be read
        the same way in at least half of the columns (at least 2, three in four of those read, no rival
        read twice), and the names must differ.
      - Garments of a size = its SMALLEST required count: a copied piece shows 2/2 in a x1 marker (IP00138).
        Every column must be a whole multiple of that list.
      - All required counts together must equal the marker's piece total — this catches a column or row
        hidden by the screenshot or the scroll bars, and any misread count.
      - A list with a common factor (L x2, or M x3 + L x3) is kept only when a "CUT 1" column shows it
        exactly: otherwise it cannot be told from a x1 marker whose every piece is cut twice.
    """
    if not total:
        return None, "no piece total in the status bar"
    cols = [c for c in columns if not GROUP_LABEL_RE.match(c.get("label") or "")]
    if len(cols) < 2:
        return None, "fewer than 2 piece columns"
    n_rows = len(cols[0]["rows"])
    if n_rows == 0 or any(len(c["rows"]) != n_rows for c in cols):
        return None, "the columns list different numbers of sizes"

    names = []
    for i in range(n_rows):
        read = [c["rows"][i][0] for c in cols if c["rows"][i][0]]
        votes = Counter(read)
        if not votes:
            return None, f"size {i + 1} not read"
        name, count = votes.most_common(1)[0]
        rival = any(n != name and v >= 2 for n, v in votes.items())
        if count < 2 or count < math.ceil(len(cols) / 2) or count < 0.75 * len(read) or rival:
            return None, f"size {i + 1} read inconsistently: {dict(votes)}"
        names.append(name)
    if len(set(names)) != len(names):
        return None, f"a size is listed twice: {names}"
    if len({_size_kind(n) for n in names}) > 1:
        return None, f"letter and number sizes in one list: {names}"

    required = []
    for c in cols:
        counts = [r[1] for r in c["rows"]]
        if any(q is None for q in counts):
            return None, f"a count in {c.get('label') or 'a column'} not read"
        required.append(counts)
    garments = [min(col[i] for col in required) for i in range(n_rows)]
    multiples = []
    for counts in required:
        k = counts[0] // garments[0]
        if k < 1 or any(counts[i] != k * garments[i] for i in range(n_rows)):
            return None, "a column is not a whole multiple of the size list"
        multiples.append(k)
    if sum(sum(counts) for counts in required) != total:
        return None, f"the columns add up to {sum(sum(c) for c in required)}, the marker has {total} pieces"
    common = 0
    for g in garments:
        common = math.gcd(common, g)
    if common > 1 and not any(
        k == 1 and CUT_ONE_LABEL_RE.search(c.get("label") or "") for k, c in zip(multiples, cols)
    ):
        return None, "every size is a multiple and no CUT 1 piece shows the list"
    return [{"sizeName": n, "quantity": g} for n, g in zip(names, garments)], None


PIECE_BAR_SPAN = (0.08, 0.60)
PIECE_BUDGET_S = 15.0
DARK = 120  # grey level below which a pixel is ink (text, checkbox borders)


def _runs(flags):
    """[(start, end)) of the True runs in a 1-D boolean array"""
    import numpy as np

    padded = np.concatenate(([False], np.asarray(flags, dtype=bool), [False]))
    diff = np.diff(padded.astype(np.int8))
    return list(zip(np.where(diff == 1)[0].tolist(), np.where(diff == -1)[0].tolist()))


def _piece_bar(image):
    """(top, bottom) rows of the blue piece-name bar under the toolbar, or None."""
    h, w = image.shape[:2]
    y0, y1 = int(h * PIECE_BAR_SPAN[0]), int(h * PIECE_BAR_SPAN[1])
    band = image[y0:y1]
    blue = (band[:, :, 0] >= 170) & (band[:, :, 1] <= 80) & (band[:, :, 2] <= 80)
    need = max(60, int(w * 0.04))
    # Rows with a long pure-blue run: the bar's edges (its middle rows are broken up by the white label text)
    rows = [y for y in range(blue.shape[0]) if any(e - s >= need for s, e in _runs(blue[y]))]
    if not rows:
        return None
    start = end = rows[0]
    for y in rows[1:]:
        if y - end > 20:  # the text rows in between are at most a line of text tall
            break
        end = y
    if end - start < 10 or end - start > 60:
        return None
    return y0 + start, y0 + end


def _piece_columns(image, bar):
    """x ranges of the piece columns: the blue labels, measured on the bar's text-free edge rows."""
    top, bottom = bar
    edge_rows = image[[top + 1, bottom - 1]]
    blue = (edge_rows[:, :, 0] >= 170) & (edge_rows[:, :, 1] <= 80) & (edge_rows[:, :, 2] <= 80)
    return [(s, e) for s, e in _runs(blue[0] | blue[1]) if e - s >= 40]


def _rec_text(crop, scale=3):
    """Recognition only (no text detection) of one small crop — a label, a size or a count."""
    import cv2

    big = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    big = cv2.copyMakeBorder(big, 8, 8, 8, 8, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    result = _engine()(big, use_det=False, use_cls=False, use_rec=True)
    txts = getattr(result, "txts", None) or ()
    # Only ASCII: the bundled model also knows Chinese, and a stray character must never become a size
    return "".join(ch for ch in " ".join(txts) if ord(ch) < 128).strip()


def _cell_rows(gray):
    """(start, end) of the size rows at the top of a piece cell, in order — the leading block of evenly
    spaced text rows (the scroll bar further down is not a row)."""
    rows = [(s, e) for s, e in _runs((gray < DARK).any(axis=1)) if 5 <= e - s <= 18]
    block = rows[:1]
    for r in rows[1:]:
        prev = block[-1]
        if r[0] - prev[1] <= max(8, int((prev[1] - prev[0]) * 0.9)):
            block.append(r)
        else:
            break
    return block


def _split_row(gray_row):
    """Where the size name and the count are in one row: (name_x0, name_x1, count_x0, count_x1), or None.
    The row starts with the size's checkbox — the first block of ink, about as wide as the row is tall (its
    top and bottom borders are ink all the way across, whether it is outlined, filled, or has a lock icon
    for a grouped piece) — then the name, a wide gap, the count."""
    h = gray_row.shape[0]
    ink = gray_row < DARK
    columns = _runs(ink.any(axis=0))
    if not columns:
        return None
    box_start, box_end = columns[0]
    if not 0.5 * h <= box_end - box_start <= 1.6 * h:
        return None
    segments = []
    for s, e in _runs(ink[:, box_end:].any(axis=0)):
        s, e = s + box_end, e + box_end
        if segments and s - segments[-1][1] <= 3:
            segments[-1] = (segments[-1][0], e)
        else:
            segments.append((s, e))
    if len(segments) < 2:
        return None
    gaps = [segments[i + 1][0] - segments[i][1] for i in range(len(segments) - 1)]
    k = max(range(len(gaps)), key=lambda i: gaps[i])
    return segments[0][0], segments[k][1], segments[k + 1][0], segments[-1][1]


def read_piece_table(image, deadline):
    """The piece table as decide_piece_sizes wants it: [{label, rows: [(sizeName|None, required|None)]}],
    or None when there is no bar or the time budget ran out."""
    import cv2

    bar = _piece_bar(image)
    if bar is None:
        return None
    h = image.shape[0]
    top, bottom = bar
    y0 = bottom + 2
    y1 = min(h, y0 + int(h * 0.25))
    columns = []
    for x0, x1 in _piece_columns(image, bar):
        if time.time() > deadline:
            return None
        label_gray = cv2.cvtColor(image[top : bottom + 1, x0:x1], cv2.COLOR_BGR2GRAY)
        label = _rec_text(cv2.cvtColor(255 - label_gray, cv2.COLOR_GRAY2BGR), scale=2)
        cell = image[y0:y1, x0:x1]
        gray = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
        rows = []
        for ra, rz in _cell_rows(gray):
            if time.time() > deadline:
                return None
            band_top, band_bottom = max(0, ra - 2), min(gray.shape[0], rz + 2)
            split = _split_row(gray[ra:rz])
            if split is None:
                rows.append((None, None))
                continue
            nx0, nx1, cx0, cx1 = split
            name = parse_piece_size(_rec_text(cell[band_top:band_bottom, max(0, nx0 - 1) : nx1 + 1]))
            count = parse_piece_count(_rec_text(cell[band_top:band_bottom, max(0, cx0 - 1) : cx1 + 1]))
            rows.append((name, count[1] if count else None))
        columns.append({"label": label, "rows": rows})
    return columns


def piece_table_sizes(image, total, budget_s=PIECE_BUDGET_S):
    """(sizes, why): the sizes the piece table shows, or ([], why not). Never raises."""
    try:
        columns = read_piece_table(image, time.time() + budget_s)
        if columns is None:
            return [], "no piece table (or it took too long)"
        sizes, why = decide_piece_sizes(columns, total)
        return (sizes or []), why
    except Exception as exc:  # the piece table is a fallback: it can only add sizes, never lose a reading
        return [], f"piece table error: {str(exc)[:200]}"


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------


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
    # The flags are passed every time: RapidOCR keeps the last call's (a recognition-only piece-table read
    # would otherwise turn text detection off for every later read)
    result = _engine()(image, use_det=True, use_cls=True, use_rec=True)
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
    gives no sizes, only its last few hundred pixels — where the sizes are — are read again. A screenshot
    that begins below the title bar has the menu bar on top: nothing there is the title."""
    title = next((l["text"] for l in title_items if "EXPERT" in l["text"].upper()), None)
    sizes = parse_sizes(title)
    if sizes or not title_items:
        return title, sizes
    if title is None and is_menu_bar(title_items[0]["text"]):
        return None, []
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
    reading["sizesFrom"] = "title" if reading["sizes"] else None
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
    reading["sizesFrom"] = "title" if sizes else None
    if not sizes and reading["lengthM"] is not None:
        sizes, why = piece_table_sizes(image, reading["total"])
        if sizes:
            reading["sizes"] = sizes
            reading["sizesFrom"] = "pieces"
        else:
            reading["piecesNote"] = why
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
        reading = {"status": "UNREADABLE", "error": str(exc)[:500], "sizes": [], "sizesFrom": None, "title": None,
                   "text": None, "lengthM": None, "widthIn": None, "efficiencyPct": None, "placed": None,
                   "total": None}
    reading["pieces"] = sum(s["quantity"] for s in reading.get("sizes") or []) or None
    reading["ms"] = int((time.time() - started) * 1000)
    reading["readerVersion"] = READER_VERSION
    return reading


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------

TITLE_CASES = [
    ("Nest EXPERT - IP00138 PANT - S-M-L-XL-XXL*", "S M L XL XXL"),
    ("N Nest EXPERT - GRAIN NEW - L(x2)*", "L L"),
    ("Nest EXPERT - ESSSR273LS  [BENNET-16 ] - S-M-L-XL-XXL*", "S M L XL XXL"),
    ("N Nest EXPERT - LEVIS - Default - S-M-L-XL-XXL* D", "S M L XL XXL"),  # OCR joined a stray "D"
    ("2026\\TISHA\\ESSFF106LS [TISHA ] AVG.ord - S-M-L(x2)-XL-XXL*", "S M L L XL XXL"),
    ("Nest EXPERT - Z:\\CAD\\GRAIN NEW AVG.ord - M(x3)-L(x3)*", "M M M L L L"),
    ("L-XL-XXL*", ""),  # a crop that began inside the list is NOT a shorter list
    ("Nest EXPERT - KIDS TEE - 8-10-12-14*", "8 10 12 14"),  # one-digit sizes (read 10 12 14 until 2026-10-01)
    ("Nest EXPERT - X - 2XS-XS-S-M*", "2XS XS S M"),  # 2XS was dropped
    ("Nest EXPERT - X - 3XS-2XS-XS-S*", "3XS 2XS XS S"),
    ("Nest EXPERT - X - XXXXXL-S-M*", ""),
    ("Nest EXPERT - TEE - S-M-7XL*", ""),  # a size this reader does not know: no tail, "not checked"
    ("Nest EXPERT - IP00138 - 02 - S-M-L*", "S M L"),  # a number before letter sizes is not a size
    ("Nest EXPERT - ESSKY082LS - 52 - S-M-L(x2)-XL*", "S M L L XL"),  # nor a width (read "52" as a size)
    ("Nest EXPERT - X - 28-30-32*", "28 30 32"),
    ("Nest EXPERT - PANT - 2 - 28-30-32*", "28 30 32"),  # a part number in front of number sizes
    ("Nest EXPERT - X - 100 - 28-30*", "28 30"),
    ("Nest EXPERT - IP00138 - 9 - 28-30*", "28 30"),
    ("Nest EXPERT - KIDS - 2-4-6-8*", "2 4 6 8"),
    ("Nest EXPERT - X - 90-100-110*", "90 100 110"),
    ("Nest EXPERT - DUPATTA - FREE SIZE*", "FREESIZE"),
    ("Nest EXPERT - X - S-M-L-XL-XXL-3XL*", "S M L XL XXL 3XL"),
    ("", ""),
]

MENU_CASES = [
    ("File Nest Piece Marker settings View Application settings About Hima", True),  # LNG129's top line
    ("File Nest Piece Marker settings View Application settings About", True),
    ("Nest EXPERT - IP00138 PANT - S-M-L-XL-XXL*", False),
    ("Nest EXPERT - Z:\\CAD_MASTER\\File View\\NIGHT.ord - S-M-L*", False),  # the title has "EXPERT"
    ("Himar", False),
    ("", False),
]

ROW_CASES = [
    (("S", "1/1"), ("S", (1, 1))),
    (("xxl", "0/1"), ("XXL", (0, 1))),
    (("L", "2/2"), ("L", (2, 2))),
    (("S1", "l/1"), (None, (1, 1))),  # a name that is not one size token is not read
    (("M", "1/7x"), ("M", None)),
    (("功", "2/1"), (None, None)),  # placed above required is not a count
    (("2XS", "1/1"), ("2XS", (1, 1))),
    (("Free Size", "1/1"), ("FREESIZE", (1, 1))),
    (("8", "1/1"), (None, (1, 1))),  # a lone digit is not read as a size in the piece table
    (("28", "1/1"), ("28", (1, 1))),
]


def _cols(spec, rows):
    """Synthetic piece columns: spec = [(label, multiple)], rows = [(size, garments)]"""
    return [{"label": label, "rows": [(name, g * k) for name, g in rows]} for label, k in spec]


FIVE = [("S", 1), ("M", 1), ("L", 1), ("XL", 1), ("XXL", 1)]
TABLE_CASES = [
    # LNG129: 12 single pieces x 5 sizes = 60
    ("12 columns x S-XXL", _cols([("BACK CUT 1", 1)] * 12, FIVE), 60, "S M L XL XXL"),
    # IP00138: a copied piece shows 2/2 in a x1 marker — the smallest count wins
    ("copy at 2/2", _cols([("PANT BACK CUT - 2", 1)] * 10 + [("Copy of PANT FRONT", 2)] * 2, FIVE), 70, "S M L XL XXL"),
    # ROXIE: L x2 with a CUT 1 piece; its Group columns are left out of the sum ("Group o" = OCR's "Group 0")
    ("L x2 with CUT 1", _cols([("BACK CUT-1", 1)] * 13 + [("Group o", 1), ("Group 1", 1)], [("L", 2)]), 26, "L L"),
    ("L x2 without CUT 1", _cols([("FRONT CUT-2", 1)] * 13, [("L", 2)]), 26, ""),
    ("columns hidden (short sum)", _cols([("BACK CUT 1", 1)] * 10, FIVE), 60, ""),
    ("no total", _cols([("BACK CUT 1", 1)] * 12, FIVE), None, ""),
    ("a size twice", _cols([("BACK CUT 1", 1)] * 12, [("S", 1), ("S", 1)]), 24, ""),
    ("one column", _cols([("BACK CUT 1", 1)], FIVE), 5, ""),
]


def _table_case_extra():
    """Cases that need a hand-made column"""
    cols = _cols([("BACK CUT 1", 1)] * 12, FIVE)
    cols[3]["rows"][2] = ("L", None)  # one count not read
    missing = ("a count not read", cols, 60, "")
    cols2 = _cols([("BACK CUT 1", 1)] * 12, FIVE)
    for c in cols2[:4]:
        c["rows"][1] = ("XS", 1)  # a rival name read 4 times
    rival = ("rival size name", cols2, 60, "")
    cols3 = _cols([("BACK CUT 1", 1)] * 12, FIVE)
    cols3[5]["rows"][0] = (None, 1)  # one name not read: still a clear majority
    one_blank = ("one name not read", cols3, 60, "S M L XL XXL")
    cols4 = _cols([("BACK CUT 1", 1)] * 12, FIVE)
    for c in cols4:
        c["rows"][0] = ("50", 1)  # one row misread as a number in every column: never a mixed list
    mixed = ("letter and number sizes", cols4, 60, "")
    return [missing, rival, one_blank, mixed]


def _flat(sizes):
    return " ".join(" ".join([s["sizeName"]] * s["quantity"]) for s in sizes or [])


def _selftest(fixtures=FIXTURES):
    failures = 0
    for title, want in TITLE_CASES:
        got = _flat(parse_sizes(title))
        if got != want:
            failures += 1
            print(f"FAIL title {title!r}: {got!r}, expected {want!r}", file=sys.stderr)
    for line, want in MENU_CASES:
        if is_menu_bar(line) != want:
            failures += 1
            print(f"FAIL menu bar {line!r}: expected {want}", file=sys.stderr)
    for (name, count), (want_name, want_count) in ROW_CASES:
        got = (parse_piece_size(name), parse_piece_count(count))
        if got != (want_name, want_count):
            failures += 1
            print(f"FAIL piece row {(name, count)!r}: {got!r}, expected {(want_name, want_count)!r}", file=sys.stderr)
    for label, cols, total, want in TABLE_CASES + _table_case_extra():
        sizes, why = decide_piece_sizes(cols, total)
        got = _flat(sizes)
        if got != want:
            failures += 1
            print(f"FAIL piece table '{label}': {got!r} ({why}), expected {want!r}", file=sys.stderr)
    expected = json.load(open(os.path.join(fixtures, "expected.json"), encoding="utf-8"))
    for name, want in expected.items():
        got = read_marker(os.path.join(fixtures, name))
        before = failures
        for key, value in want.items():
            if got.get(key) != value:
                failures += 1
                print(f"FAIL {name}: {key} = {got.get(key)!r}, expected {value!r}", file=sys.stderr)
        print(f"{'ok  ' if failures == before else '    '} {name} ({got['ms']} ms)", file=sys.stderr)
    print("selftest passed" if failures == 0 else f"selftest FAILED ({failures})", file=sys.stderr)
    return 0 if failures == 0 else 1


def main(argv):
    if len(argv) >= 2 and argv[1] == "--selftest":
        return _selftest(argv[2] if len(argv) >= 3 else FIXTURES)
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
