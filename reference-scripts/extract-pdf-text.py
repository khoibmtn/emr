#!/usr/bin/env python3
"""
extract-pdf-text.py  v3.0
Trich xuat toan bo text tu HSBA PDF, phan loai trang, phat hien ranh gioi khoa.
Ho tro render trang scan thanh PNG de Claude Vision OCR.

NANG CAP v3.0 (so voi v2.1):
  1. Table-aware extraction: trang lab_result / medical_orders co them "text_table"
     (tai tao bang theo toa do y/x) -> gia tri XN / cot dinh hang khong bi dinh dong.
  2. Scan detection thong minh: ngoai nguong char_count < 50, them image_area_ratio.
     Trang it text NHUNG anh phu > 60% dien tich -> cung render PNG de OCR
     (bat duoc cac trang scan-bang ma v2.1 bo sot).
  3. Chuan hoa ten khoa: them "department_canonical" (map ve danh muc khoa chuan)
     -> department_stays gom nhat quan, khong con nhieu bien the cua cung 1 khoa.
  4. Forward-fill khoa: moi trang deu co department_canonical (lay khoa gan nhat phia truoc)
     -> "moi thong tin deu gan khoa".
  5. Multi-label: them "page_types_all" (tat ca page_type match) ben canh page_type (top).

Output mac dinh: JSON. Output tuy chon: TXT (legacy).

Cach dung:
    python extract-pdf-text.py <file.pdf>                        # JSON ra stdout
    python extract-pdf-text.py <file.pdf> --output raw.json      # JSON ra file
    python extract-pdf-text.py <file.pdf> --format txt           # Legacy flat text
    python extract-pdf-text.py <file.pdf> --pages 1-10           # Trang chi dinh
    python extract-pdf-text.py <file.pdf> --ocr-images-dir /tmp/scans  # Render scan pages -> PNG
    python extract-pdf-text.py <file.pdf> --ocr-images-dir /tmp/scans \\
        --ocr-cache out/ocr-cache/2600062416.json   # Cache OCR: hit -> bo render+OCR lai
    python extract-pdf-text.py --update-cache out/ocr-cache/2600062416.json \\
        --from-json /tmp/hsba_raw.json               # Ghi OCR text Claude vua dien vao cache

NANG CAP v3.1 (so voi v3.0):
  6. OCR cache theo hash anh: cache hit -> dien thang ocr_text, KHONG render PNG,
     KHONG can Claude OCR lai -> tang toc manh khi chay lai cung HSBA.
     Output them "ocr_todo" (chi trang con phai OCR) + "ocr_cache_stats".
  7. Trich ngay tren tung trang ("dates_found") + "department_date_ranges"
     -> gan CLS / dieu tri dung khoa theo NGAY khi BN nam nhieu khoa.
  8. "page_dept_method" (explicit | forward_filled | unknown) de Claude biet
     attribution nao can kiem tra lai theo ngay.
"""
import sys
import json
import argparse
import re
import hashlib
import unicodedata
from pathlib import Path
from datetime import datetime

# ──────────────────────────────────────────────────────────────────────────────
# PAGE TYPE RULES (keyword patterns — no-diacritic matching)
# ──────────────────────────────────────────────────────────────────────────────

PAGE_TYPE_RULES = [
    ("admission_form",    100, [
        r"A[.\-]\s*BENH AN",
        r"LY DO VAO VIEN",
        r"HOI BENH",
        r"QUA TRINH BENH LY",
        r"KHAM BENH",
        r"CHAN DOAN KHI VAO KHOA",
        r"HUONG DIEU TRI",
        r"TIEN LUONG",
    ]),
    ("discharge_summary",  95, [
        r"TONG KET BENH AN",
        r"B[.\s]+TONG KET",
        r"QUA TRINH BENH LY VA DIEN BIEN",
        r"PHUONG PHAP DIEU TRI",
        r"TINH TRANG NGUOI BENH RA VIEN",
    ]),
    ("discharge_letter",   90, [
        r"GIAY RA VIEN",
        r"HINH THUC RA VIEN",
        r"CHE DO CHAM SOC SAU RA VIEN",
    ]),
    ("medical_orders",     80, [
        r"TO DIEU TRI",
        r"Y LENH",
        r"PHIEU THUOC",
    ]),
    ("clinical_course",    75, [
        r"DIEN BIEN BENH",
        r"THEO DOI DIEU TRI",
        r"PHIEU THEO DOI",
        r"DIEN BIEN LAM SANG",
    ]),
    ("nursing_notes",      70, [
        r"PHIEU CHAM SOC",
        r"DIEU DUONG",
        r"PHIEU THEO DOI CHAM SOC",
    ]),
    ("lab_result",         65, [
        r"PHIEU XET NGHIEM",
        r"KET QUA XET NGHIEM",
        r"HUYET HOC",
        r"HOA SINH",
        r"NUOC TIEU",
    ]),
    ("imaging",            60, [
        r"CHAN DOAN HINH ANH",
        r"SIEU AM",
        r"X QUANG",
        r"CT SCAN",
        r"CAT LOP VI TINH",      # CT scan tiếng Việt
        r"MRI",
        r"NOI SOI",
        r"DIEN TAM",
        r"PHIEU DIEN TIM",       # ECG/ĐTĐ tiếng Việt
        r"DIEN TIM",
        r"PHIEU CHIEU",          # Phiếu chiếu/chụp Xquang
        r"CHUP X-QUANG",
    ]),
    ("surgical_record",    55, [
        r"BIEN BAN PHAU THUAT",
        r"PHIEU PHAU THUAT",
        r"CAM KET PHAU THUAT",
        r"PHIEU GAY ME",
        r"PHIEU THU THUAT",
    ]),
    ("transfer_record",    50, [
        r"GIAY CHUYEN VIEN",
        # "CHUYEN KHOA" đã loại — false positive với "LỜI DẶN CỦA BS CHUYÊN KHOA"
        # trên phiếu ECG, CLVT, Xquang. Chỉ dùng pattern rõ ràng hơn:
        r"TOM TAT BENH AN CHUYEN",
        r"PHIEU CHUYEN VIEN",
        r"GIAY CHUYEN KHOA",
    ]),
    ("consultation_note",  45, [
        r"BIEN BAN HOI CHAN",
        r"HOI CHAN",
        r"PHIEU HOI CHAN",
    ]),
    ("administrative",     30, [
        r"CAM KET",
        r"BHYT",
        r"BAO HIEM Y TE",
        r"CHI PHI",
        r"BANG KE",
        r"GIAY NHAP VIEN",
    ]),
]

# Nguong de mot page_type phu duoc ghi vao page_types_all (multi-label)
MULTILABEL_MIN_PRIORITY = 45

DEPARTMENT_KEYWORDS = [
    "CAP CUU", "HOI SUC", "HSTC", "NOI ", "NGOAI ", "SAN ", "NHI ",
    "TAI MUI HONG", "MAT ", "RANG HAM MAT", "TIM MACH", "THAN KINH",
    "TIEU HOA", "HO HAP", "THAN TIET NIEU", "UNG BUOU",
    "CHAN THUONG", "CHINH HINH", "BONG ", "TAM THAN", "DA LIEU",
    "TRUYEN NHIEM", "SO SINH", "ICU", "PHUC HOI CHUC NANG",
    "Y HOC CO TRUYEN", "PHU KHOA", "HUYET HOC",
]

# ──────────────────────────────────────────────────────────────────────────────
# KHOA CANONICAL — chuan hoa ten khoa ve danh muc thong nhat (v3.0)
# Moi entry: (canonical_name, [no-diacritic substring patterns])
# Khop theo thu tu — pattern dau tien match thi gan canonical do.
# ──────────────────────────────────────────────────────────────────────────────
KHOA_CANONICAL = [
    ("Cấp cứu - HSTC - Chống độc", ["CAP CUU", "HOI SUC", "HSTC", "HSCC", "ICU", "CHONG DOC"]),
    ("Nội Tim mạch - Lão học",     ["TIM MACH", "LAO HOC", "TMHH", "TIM MACH HO HAP"]),
    ("Nội Tổng hợp",               ["NOI TONG HOP", "NOI TH", "NOI A", "NOI B", "NOI 1", "NOI 2", "NOI "]),
    ("Truyền nhiễm",               ["TRUYEN NHIEM", "BENH NHIET DOI", "BND", "TN "]),
    ("Ngoại Tổng hợp",             ["NGOAI TONG HOP", "NGOAI TH", "NGOAI 1", "NGOAI 2", "NGOAI "]),
    ("Chấn thương - Chỉnh hình",   ["CHAN THUONG", "CHINH HINH", "CTCH"]),
    ("Y học cổ truyền",            ["Y HOC CO TRUYEN", "YHCT", "PHCN", "PHUC HOI CHUC NANG"]),
    ("Sản - Phụ khoa",             ["SAN ", "PHU KHOA", "SAN PHU"]),
    ("Nhi - Sơ sinh",              ["NHI ", "SO SINH"]),
    ("Tai - Mũi - Họng",           ["TAI MUI HONG", "TMH"]),
    ("Mắt",                        ["MAT "]),
    ("Răng - Hàm - Mặt",           ["RANG HAM MAT", "RHM"]),
    ("Thần kinh",                  ["THAN KINH"]),
    ("Tiêu hóa",                   ["TIEU HOA"]),
    ("Thận - Tiết niệu",           ["THAN TIET NIEU", "TIET NIEU"]),
    ("Ung bướu",                   ["UNG BUOU"]),
    ("Huyết học - Truyền máu",     ["HUYET HOC", "TRUYEN MAU"]),
    ("Da liễu",                    ["DA LIEU"]),
    ("Tâm thần",                   ["TAM THAN"]),
    ("Bỏng",                       ["BONG "]),
]


def canonicalize_department(dept_raw):
    """Map ten khoa tho -> ten khoa chuan trong KHOA_CANONICAL. None neu khong map duoc."""
    if not dept_raw:
        return None
    norm = _nodiac(dept_raw)
    for canon, patterns in KHOA_CANONICAL:
        for pat in patterns:
            if pat in norm:
                return canon
    return None


BA_TYPE_MAP = {
    "01": "noi_khoa",       "02": "nhi_khoa",        "03": "truyen_nhiem",
    "04": "phu_khoa",       "05": "san_khoa",         "06": "so_sinh",
    "07": "tam_than",       "08": "da_lieu",          "09": "huyet_hoc",
    "10": "ngoai_khoa",     "11": "bong",             "12": "ung_buou",
    "13": "rang_ham_mat",   "14": "tai_mui_hong",     "15": "ngoai_tru",
    "16": "ngoai_tru",      "17": "mat",              "18": "yhct_noi_tru",
    "19": "yhct_ngoai_tru", "20": "yhct_nhi",
    "21": "mat", "22": "mat", "23": "mat", "24": "mat", "25": "mat", "26": "mat",
}


# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _clean_text(text: str) -> str:
    """
    Lọc bỏ ký tự CJK/Kangxi artifacts từ HIS font embedding.

    HIS Việt Nam embed font CJK để render giao diện nội bộ; khi pymupdf đọc
    các trang lab result / y lệnh, nó giải mã codepoint thực của font và trả
    về ký tự CJK thay vì ký tự Latin ban đầu.

    Các dải loại bỏ:
      U+2E80–U+2EFF  CJK Radicals Supplement
      U+2F00–U+2FFF  Kangxi Radicals
      U+3000–U+303F  CJK Symbols and Punctuation  (trừ U+3000 ideographic space)
      U+3040–U+31EF  Hiragana / Katakana / CJK Extensions
      U+3400–U+4DBF  CJK Unified Ideographs Extension A
      U+4E00–U+9FFF  CJK Unified Ideographs (khối chính)
      U+F900–U+FAFF  CJK Compatibility Ideographs

    Giữ nguyên ký tự y tế hợp lệ:
      U+00B0–U+00B9  °, ±, ², ³ ... (superscripts, degree)
      U+00B5         µ (micro)
      U+03B1–U+03C9  α, β, γ ... (Greek lowercase)
      U+2019         ' (right single quotation)
      U+2026         … (ellipsis)
      U+2212         − (minus sign)
      U+2264–U+2265  ≤, ≥
      U+00D7         × (multiplication)
    """
    out = []
    for c in text:
        cp = ord(c)
        # Loại bỏ CJK artifact ranges
        if (0x2E80 <= cp <= 0x2EFF or   # CJK Radicals Supplement
                0x2F00 <= cp <= 0x2FFF or   # Kangxi Radicals
                0x3000 <= cp <= 0x303F or   # CJK Symbols & Punctuation
                0x3040 <= cp <= 0x31EF or   # Hiragana/Katakana/Extensions
                0x3400 <= cp <= 0x4DBF or   # CJK Extension A
                0x4E00 <= cp <= 0x9FFF or   # CJK Unified Ideographs
                0xF900 <= cp <= 0xFAFF):    # CJK Compatibility Ideographs
            continue
        out.append(c)
    return "".join(out)


def _nodiac(text: str) -> str:
    """Chuyen tieng Viet co dau -> khong dau (NFD decompose)."""
    text = text.upper()
    nfd = unicodedata.normalize("NFD", text)
    result = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    # Handle D-with-stroke (not decomposed by NFD)
    result = result.replace("Đ", "D").replace("đ", "D")
    return result


# ──────────────────────────────────────────────────────────────────────────────
# v3.1 — DATE EXTRACTION (gan CLS/dieu tri dung khoa theo ngay)
# ──────────────────────────────────────────────────────────────────────────────

# DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY ; cung bat "ngay 05 thang 05 nam 2026"
_DATE_RE = re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b")
_DATE_VN_RE = re.compile(r"ng[aà]y\s+(\d{1,2})\s+th[aá]ng\s+(\d{1,2})\s+n[aă]m\s+(\d{2,4})", re.IGNORECASE)


def _to_iso(d, mth, y):
    try:
        d, mth, y = int(d), int(mth), int(y)
    except ValueError:
        return None
    if y < 100:
        y += 2000
    if not (1 <= d <= 31 and 1 <= mth <= 12 and 2000 <= y <= 2100):
        return None
    return f"{y:04d}-{mth:02d}-{d:02d}"


def extract_dates(text: str) -> list:
    """Tra ve danh sach ngay ISO (yyyy-mm-dd) UNIQUE xuat hien tren trang, sap tang dan."""
    found = set()
    for m in _DATE_RE.finditer(text):
        iso = _to_iso(*m.groups())
        if iso:
            found.add(iso)
    for m in _DATE_VN_RE.finditer(text):
        iso = _to_iso(*m.groups())
        if iso:
            found.add(iso)
    return sorted(found)


def build_department_date_ranges(pages: list) -> list:
    """Voi moi khoa (department_canonical), tong hop khoang ngay (min..max) tu cac
    trang CO ngay. Dung de Claude gan phieu XN / y lenh khong ghi khoa vao dung
    khoa theo ngay khi BN nam nhieu khoa.
    Uu tien trang lam sang (admission_form, clinical_course, medical_orders,
    discharge_summary, consultation_note) de xac dinh ranh gioi ngay cua khoa.
    """
    CLIN = {"admission_form", "clinical_course", "medical_orders",
            "discharge_summary", "consultation_note", "nursing_notes"}
    agg = {}  # dept -> {dates:set, pages:set}
    for p in pages:
        dept = p.get("department_canonical")
        if not dept:
            continue
        a = agg.setdefault(dept, {"dates": set(), "pages": set(), "clin_dates": set()})
        a["pages"].add(p["page_num"])
        for d in p.get("dates_found", []):
            a["dates"].add(d)
            if p.get("page_type") in CLIN:
                a["clin_dates"].add(d)
    out = []
    for dept, a in agg.items():
        # Uu tien ngay tu trang lam sang; neu khong co thi dung tat ca ngay
        dates = sorted(a["clin_dates"]) or sorted(a["dates"])
        out.append({
            "department":  dept,
            "start_date":  dates[0] if dates else None,
            "end_date":    dates[-1] if dates else None,
            "date_source": "clinical_pages" if a["clin_dates"] else ("any_page" if a["dates"] else "none"),
            "pages":       sorted(a["pages"]),
        })
    # Sap theo start_date (None xuong cuoi)
    out.sort(key=lambda r: (r["start_date"] is None, r["start_date"] or ""))
    return out


def classify_page(text: str):
    """Tra ve (best_type, page_types_all[]).
    best_type = page_type priority cao nhat.
    page_types_all = tat ca page_type match co priority >= MULTILABEL_MIN_PRIORITY,
                     sap xep priority giam dan (de phat hien trang ghep nhieu bieu mau).
    """
    norm = _nodiac(text)
    matched = []  # (priority, ptype)
    for ptype, priority, patterns in PAGE_TYPE_RULES:
        for pat in patterns:
            if re.search(pat, norm):
                matched.append((priority, ptype))
                break
    if not matched:
        return "unknown", []
    matched.sort(reverse=True)
    best_type = matched[0][1]
    all_types = [pt for pr, pt in matched if pr >= MULTILABEL_MIN_PRIORITY]
    return best_type, all_types


def detect_department(text: str):
    """
    Phat hien ten khoa tu text trang.
    - Strip prefix "Khoa:" khoi ket qua
    - Loc noise: ten khoa < 4 ky tu hoac la common words
    """
    norm = _nodiac(text)
    NOISE = {
        "NGOAI BHYT", "NOI TRU", "NOI QUY", "NOI DUNG", "KHOA",
        "PHONG", "GIUONG", "BUONG", "DIEU TRI", "THEO DOI",
        "DIEU DUONG", "TIEP NHAN", ""
    }

    # Pattern: "KHOA: <name>" or "KHOA <name>"
    for m in re.finditer(r"KHOA[:\s]+([A-Z0-9 \-/Đđ]{3,50})", norm):
        dept_norm = m.group(1).strip().rstrip(".-").strip()
        # If dept_norm starts with "KHOA" again, strip it
        dept_norm = re.sub(r"^KHOA[:\s]+", "", dept_norm).strip()
        # Filter noise
        if dept_norm in NOISE or len(dept_norm) < 3:
            continue
        # Also skip if it's mostly dots or dashes
        if re.fullmatch(r"[.\-:/ ]+", dept_norm):
            continue
        # Return original text at corresponding position
        orig_idx = text.upper().find(m.group(0).upper()[:10])
        if orig_idx >= 0:
            # Find the dept name in original text: skip past "Khoa: "
            after_khoa = re.search(r"[Kk]hoa[:\s]+", text[orig_idx:orig_idx+20])
            if after_khoa:
                start = orig_idx + after_khoa.end()
                dept_raw = text[start:start+50].split("\n")[0].strip()
                # Strip redundant "Khoa " prefix
                dept_raw = re.sub(r"^[Kk]hoa[:\s]+", "", dept_raw).strip()
                if dept_raw and len(dept_raw) > 2:
                    return dept_raw[:50]
        return dept_norm.title()[:50]

    # Fallback: find common department names in full text
    for kw in DEPARTMENT_KEYWORDS:
        if kw in norm:
            idx = norm.find(kw)
            return text[idx:idx+40].strip().split("\n")[0][:40]
    return None


def detect_ba_type(pages: list) -> tuple:
    for p in pages:
        m = re.search(r"MS[:\s]*(\d{2})/BV[-\s]*0?1", p.get("text", ""), re.IGNORECASE)
        if m:
            ms_num = m.group(1)
            return BA_TYPE_MAP.get(ms_num, "other"), f"{ms_num}/BV-01"
    return "noi_khoa", "01/BV-01"


def build_department_timeline(pages: list) -> list:
    """Group consecutive pages theo department_canonical (chuan hoa) thanh segments.
    v3.0: dung department_canonical thay vi department_hint tho -> nhat quan hon.
    """
    timeline = []
    current_dept = None
    current_start = None
    current_pages = []
    for p in pages:
        dept = p.get("department_canonical") or p.get("department_hint")
        if not dept:
            if current_dept:
                current_pages.append(p["page_num"])
            continue
        if dept != current_dept:
            if current_dept and current_pages:
                timeline.append({
                    "department":   current_dept,
                    "first_page":   current_start,
                    "last_page":    current_pages[-1],
                    "page_indices": current_pages[:]
                })
            current_dept = dept
            current_start = p["page_num"]
            current_pages = [p["page_num"]]
        else:
            current_pages.append(p["page_num"])
    if current_dept and current_pages:
        timeline.append({
            "department":   current_dept,
            "first_page":   current_start,
            "last_page":    current_pages[-1],
            "page_indices": current_pages[:]
        })
    return timeline


def _parse_pages(pages_str, total):
    if not pages_str or pages_str.lower() == "all":
        return list(range(total))
    indices = set()
    for part in pages_str.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            indices.update(range(max(1, int(a.strip())) - 1, min(total, int(b.strip()))))
        else:
            p = int(part.strip())
            if 1 <= p <= total:
                indices.add(p - 1)
    return sorted(indices)


def _summarize_page_types(pages):
    s = {}
    for p in pages:
        pt = p["page_type"]
        s[pt] = s.get(pt, 0) + 1
    return s


# ──────────────────────────────────────────────────────────────────────────────
# v3.0 — TABLE-AWARE EXTRACTION
# ──────────────────────────────────────────────────────────────────────────────

def extract_table_text(page) -> str:
    """
    Tai tao cau truc bang tu page.get_text("words").
    Gom cac word thanh hang theo toa do y (lam tron), sap xep trong hang theo x.
    Tra ve text nhieu dong, moi dong = 1 hang bang, cot cach nhau bang '  |  '
    khi co khoang trong x lon -> gia tri XN / don vi / nguong khong dinh nhau.

    Dung cho trang lab_result / medical_orders de Claude doc dung cot.
    """
    import fitz  # noqa
    words = page.get_text("words")  # [(x0,y0,x1,y1,"word",block,line,word_no), ...]
    if not words:
        return ""
    # Gom theo hang: lam tron y0 ve boi so ~3pt
    rows = {}
    for w in words:
        x0, y0, x1, y1, txt = w[0], w[1], w[2], w[3], w[4]
        txt = _clean_text(txt)
        if not txt.strip():
            continue
        key = round(y0 / 3.0)
        rows.setdefault(key, []).append((x0, x1, txt))
    lines = []
    for key in sorted(rows.keys()):
        cells = sorted(rows[key], key=lambda c: c[0])
        # Ghep cell, chen separator khi gap x > 18pt (khoang cot)
        parts = []
        prev_x1 = None
        for x0, x1, txt in cells:
            if prev_x1 is not None and (x0 - prev_x1) > 18:
                parts.append("  |  ")
            elif prev_x1 is not None:
                parts.append(" ")
            parts.append(txt)
            prev_x1 = x1
        lines.append("".join(parts))
    return "\n".join(lines)


def page_image_area_ratio(page) -> float:
    """Ti le dien tich anh phu len trang (0.0-1.0). Dung de phat hien trang scan-bang
    co it text nhung that ra la anh chiem phan lon trang."""
    try:
        import fitz  # noqa
        page_area = abs(page.rect.width * page.rect.height)
        if page_area <= 0:
            return 0.0
        img_area = 0.0
        for info in page.get_image_info():
            bbox = info.get("bbox")
            if bbox:
                w = abs(bbox[2] - bbox[0])
                h = abs(bbox[3] - bbox[1])
                img_area += w * h
        return min(1.0, img_area / page_area)
    except Exception:
        return 0.0


# ──────────────────────────────────────────────────────────────────────────────
# MAIN EXTRACT FUNCTIONS
# ──────────────────────────────────────────────────────────────────────────────

def _render_pixmap(page, dpi: int = 250):
    """Render trang -> pixmap grayscale. Tach rieng de tinh hash truoc khi quyet dinh save."""
    import fitz
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    return page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY)


def _pixmap_hash(pix) -> str:
    """Hash noi dung anh (md5 cua samples) -> khoa cache OCR. Cung anh -> cung hash."""
    try:
        return "img_" + hashlib.md5(pix.samples).hexdigest()[:20]
    except Exception:
        return None


def _render_page_to_png(page, out_path: str, dpi: int = 250) -> str:
    """Backward-compat: render va save PNG. Tra ve duong dan."""
    pix = _render_pixmap(page, dpi=dpi)
    pix.save(out_path)
    return out_path


def _load_ocr_cache(path):
    if not path:
        return {}
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return {}


# Nguong: trang it text + anh phu lon -> nghi la scan-bang, render PNG de OCR
LOWTEXT_SCAN_CHAR_MAX = 200
LOWTEXT_SCAN_IMG_RATIO = 0.60
# Trang co text-table dang xay dung cho cac loai sau
TABLE_AWARE_TYPES = {"lab_result", "medical_orders"}


def extract_to_json(pdf_path: str, pages_arg=None, output=None,
                    ocr_images_dir: str = None, ocr_read_dir: str = None,
                    ocr_cache: str = None) -> dict:
    try:
        import fitz
    except ImportError:
        print("Chua cai pymupdf. Chay: pip install pymupdf --break-system-packages", file=sys.stderr)
        sys.exit(1)

    doc = fitz.open(pdf_path)
    total_pages = doc.page_count
    print(f"File: {Path(pdf_path).name} -- {total_pages} trang", file=sys.stderr)

    # Chuẩn bị thư mục lưu ảnh scan (nếu được yêu cầu)
    if ocr_images_dir:
        Path(ocr_images_dir).mkdir(parents=True, exist_ok=True)
        print(f"OCR images dir: {ocr_images_dir}", file=sys.stderr)

    # ── v3.1: Nap OCR cache (hash anh -> ocr_text) ──
    cache = _load_ocr_cache(ocr_cache)
    if ocr_cache:
        print(f"OCR cache: {ocr_cache}  ({len(cache)} entries)", file=sys.stderr)
    cache_hit = cache_miss = 0

    page_indices = _parse_pages(pages_arg, total_pages)
    pages_data = []

    for i in page_indices:
        page = doc[i]
        page_num = i + 1
        text = _clean_text(page.get_text("text").strip())

        if len(text) < 50:
            blocks = page.get_text("dict")["blocks"]
            if blocks:
                text = _clean_text(page.get_text("text", flags=fitz.TEXT_PRESERVE_WHITESPACE).strip())

        char_count = len(text)
        img_ratio = round(page_image_area_ratio(page), 3)

        # ── v3.0: Scan detection thong minh ──
        # (a) Het sach text (< 50) -> scan ro rang
        # (b) It text (< 200) NHUNG anh phu > 60% dien tich -> scan-bang (v2.1 bo sot)
        hard_scan  = char_count < 50
        lowtext_scan = (char_count < LOWTEXT_SCAN_CHAR_MAX and img_ratio >= LOWTEXT_SCAN_IMG_RATIO)
        is_scan = hard_scan or lowtext_scan

        if is_scan:
            page_type, page_types_all = "scan_image", []
            dept_hint = None
        else:
            page_type, page_types_all = classify_page(text)
            dept_hint = detect_department(text)

        dept_canon = canonicalize_department(dept_hint) if dept_hint else None

        # ── B1: Content density + extraction quality ──
        if is_scan:
            content_density    = "scan"
            extraction_quality = "scan_no_text"
        elif char_count >= 800:
            content_density    = "high"
            extraction_quality = "good"
        elif char_count >= 200:
            content_density    = "medium"
            extraction_quality = "sparse"
        else:
            content_density    = "low"
            extraction_quality = "very_sparse"

        # ── v3.0: Table-aware text cho trang lab/orders ──
        text_table = ""
        if (not is_scan) and (page_type in TABLE_AWARE_TYPES or
                              any(t in TABLE_AWARE_TYPES for t in page_types_all)):
            try:
                text_table = extract_table_text(page)
            except Exception as e:
                print(f"    ! table extract loi trang {page_num}: {e}", file=sys.stderr)

        # ── C1 + v3.1: Render scan page → PNG, KÈM OCR cache theo hash anh ──
        scan_image_path = None
        scan_image_hash = None
        ocr_attempted   = False
        ocr_text        = None
        ocr_from_cache  = False
        if is_scan and ocr_images_dir:
            pix = _render_pixmap(doc[i], dpi=250)
            scan_image_hash = _pixmap_hash(pix)
            cached = cache.get(scan_image_hash) if scan_image_hash else None
            if cached:
                # CACHE HIT: dien thang OCR text, KHONG save PNG, KHONG can Claude OCR lai
                ocr_text       = cached
                ocr_attempted  = True
                ocr_from_cache = True
                text           = cached
                page_type, page_types_all = classify_page(cached)  # phan loai lai tu OCR
                dept_hint  = detect_department(cached)
                dept_canon = canonicalize_department(dept_hint) if dept_hint else None
                content_density, extraction_quality = "high", "ocr_cached"
                is_scan = False  # da co text -> khong con la scan can xu ly
                cache_hit += 1
                print(f"    ✓ CACHE HIT trang {page_num} ({scan_image_hash})", file=sys.stderr)
            else:
                # CACHE MISS: save PNG de Claude OCR
                png_name = f"page_{page_num:03d}.png"
                png_path = str(Path(ocr_images_dir) / png_name)
                pix.save(png_path)
                read_dir = ocr_read_dir or ocr_images_dir
                scan_image_path = str(Path(read_dir) / png_name)
                cache_miss += 1
                tag = "scan-bang" if (lowtext_scan and not hard_scan) else "scan"
                print(f"    → Render {tag} → {png_name}  (img_ratio={img_ratio})", file=sys.stderr)

        # ── v3.1: dates_found + phuong phap gan khoa ──
        dates_found = extract_dates(text) if (text and text != "[SCAN -- chua OCR]") else []
        if dept_canon and dept_hint:
            dept_method = "explicit"
        elif dept_canon:
            dept_method = "from_cache_ocr" if ocr_from_cache else "explicit"
        else:
            dept_method = "unknown"   # se thanh forward_filled o buoc sau neu fill duoc

        pages_data.append({
            "page_num":           page_num,
            "char_count":         len(text) if text and text != "[SCAN -- chua OCR]" else char_count,
            "is_scan":            is_scan,
            "scan_reason":        ("no_text" if hard_scan else ("lowtext_image" if lowtext_scan else None)) if is_scan else None,
            "image_area_ratio":   img_ratio,
            "page_type":          page_type,
            "page_types_all":     page_types_all,           # v3.0 multi-label
            "department_hint":    dept_hint,
            "department_canonical": dept_canon,             # v3.0 chuan hoa (forward-fill sau)
            "department_method":  dept_method,              # v3.1 explicit|forward_filled|unknown
            "dates_found":        dates_found,              # v3.1 ngay tren trang (ISO)
            "content_density":    content_density,
            "extraction_quality": extraction_quality,
            "ocr_attempted":      ocr_attempted,            # true neu da OCR (cache) hoac se OCR
            "ocr_from_cache":     ocr_from_cache,           # v3.1
            "ocr_text":           ocr_text,
            "scan_image_path":    scan_image_path,          # Path PNG neu MISS can OCR; None neu HIT/khong scan
            "scan_image_hash":    scan_image_hash,          # v3.1 khoa cache (de write-back)
            "text":               text if (text and text != "[SCAN -- chua OCR]") else "[SCAN -- chua OCR]",
            "text_table":         text_table,    # v3.0: bang tai tao (lab/orders), "" neu khong co
        })
        print(
            f"  Trang {page_num:3d}: {char_count:5d} chars | img {img_ratio:4.2f} | "
            f"{page_type:18s} | khoa: {(dept_canon or dept_hint or '--')} | ngay: {len(dates_found)}",
            file=sys.stderr
        )

    doc.close()

    # ── v3.0: Forward-fill department_canonical ──
    # Moi trang khong xac dinh duoc khoa -> ke thua khoa gan nhat phia truoc.
    # -> "moi thong tin deu gan khoa". Khong fill cho cac trang scan dau ho so (chua co khoa).
    last_dept = None
    for p in pages_data:
        if p["department_canonical"] and p.get("department_method") in ("explicit", "from_cache_ocr"):
            last_dept = p["department_canonical"]
        elif last_dept and not p["is_scan"] and not p["department_canonical"]:
            p["department_canonical"] = last_dept
            p["department_method"]    = "forward_filled"

    ba_type, ma_bieu_mau = detect_ba_type(pages_data)
    dept_timeline = build_department_timeline(pages_data)
    dept_date_ranges = build_department_date_ranges(pages_data)   # v3.1

    # ── v3.1: ocr_todo — chi trang con phai OCR (MISS), kem scan_image_path ──
    ocr_todo = [
        {"page_num": p["page_num"], "scan_image_path": p["scan_image_path"],
         "scan_image_hash": p["scan_image_hash"], "page_type": p["page_type"]}
        for p in pages_data
        if p.get("scan_image_path") and not p.get("ocr_from_cache")
    ]

    # Danh sach khoa chuan (unique, giu thu tu xuat hien)
    depts_canonical = []
    for p in pages_data:
        d = p.get("department_canonical")
        if d and d not in depts_canonical:
            depts_canonical.append(d)

    result = {
        "schema_version":       "raw-v3.1",
        "extracted_at":         datetime.now().isoformat(timespec="seconds"),
        "source_file":          str(Path(pdf_path).name),
        "source_path":          str(pdf_path),
        "total_pages":          total_pages,
        "ba_type":              ba_type,
        "ma_bieu_mau":          ma_bieu_mau,
        "departments_canonical": depts_canonical,          # v3.0
        "department_date_ranges": dept_date_ranges,        # v3.1 — gan CLS/dieu tri theo ngay
        "pages":                pages_data,
        "department_timeline":  dept_timeline,
        "page_type_summary":    _summarize_page_types(pages_data),
        "ocr_todo":             ocr_todo,                   # v3.1 — chi trang con phai OCR
        "ocr_cache_stats": {                               # v3.1
            "cache_file":   ocr_cache,
            "hit":          cache_hit,
            "miss":         cache_miss,
            "todo":         len(ocr_todo),
        },
        "scan_summary": {                                  # v3.0
            "total_scan":       sum(1 for p in pages_data if p["is_scan"]),
            "no_text":          sum(1 for p in pages_data if p.get("scan_reason") == "no_text"),
            "lowtext_image":    sum(1 for p in pages_data if p.get("scan_reason") == "lowtext_image"),
        },
    }

    if output:
        Path(output).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Da luu JSON: {output}", file=sys.stderr)
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))

    return result


def extract_to_txt(pdf_path: str, pages_arg=None, output=None) -> str:
    """Legacy TXT output (backward compatible voi v1.0)."""
    try:
        import fitz
    except ImportError:
        print("Chua cai pymupdf.", file=sys.stderr)
        sys.exit(1)

    doc = fitz.open(pdf_path)
    total_pages = doc.page_count
    page_indices = _parse_pages(pages_arg, total_pages)

    lines = ["=" * 70, f"FILE: {Path(pdf_path).name}",
             f"Tong so trang: {total_pages}", "=" * 70, ""]

    for i in page_indices:
        page = doc[i]
        page_num = i + 1
        text = _clean_text(page.get_text("text").strip())
        if len(text) < 50:
            blocks = page.get_text("dict")["blocks"]
            text = "[Trang scan]" if not blocks else _clean_text(page.get_text(
                "text", flags=fitz.TEXT_PRESERVE_WHITESPACE).strip())
        lines += [f"{'─'*70}", f"TRANG {page_num}/{total_pages}", f"{'─'*70}", text, ""]

    doc.close()
    result = "\n".join(lines)
    if output:
        Path(output).write_text(result, encoding="utf-8")
        print(f"Da luu TXT: {output}", file=sys.stderr)
    else:
        print(result)
    return result


# ──────────────────────────────────────────────────────────────────────────────
# v3.2 — DIGEST: view gon cho Claude doc o Phase 3 (tiet kiem token)
# ──────────────────────────────────────────────────────────────────────────────

# Cac loai trang khong mang noi dung lam sang/CLS -> bo khoi digest (van con trong raw JSON)
_DIGEST_SKIP_TYPES = {"administrative"}


def to_digest_text(d: dict, keep_admin: bool = False) -> str:
    """
    Sinh digest TEXT gon tu raw JSON da co OCR.
    Nguyen tac tiet kiem token:
      - Trang lab/orders co text_table -> CHI in text_table (bo 'text' trung).
      - Bo field thua (image_area_ratio, content_density, hash, ...).
      - Bo trang rong / chua OCR / administrative (tru khi keep_admin).
      - Gom theo khoa; in banner khi doi khoa.
      - Header goj: ranh gioi ngay theo khoa + map nhom trang -> DATA section.
    Output la text de Claude doc 1 lan trong Phase 3.
    """
    pages = d.get("pages", [])
    out = []
    src = d.get("source_file", "")
    out.append(f"# DIGEST · {src} · {d.get('total_pages')} trang · BA={d.get('ba_type')}")
    depts = d.get("departments_canonical", [])
    out.append(f"Khoa (theo thứ tự): {', '.join(depts) if depts else '—'}")
    # Ranh gioi ngay theo khoa (de gan CLS/dieu tri theo ngay)
    for r in d.get("department_date_ranges", []):
        out.append(f"  · {r['department']}: {r.get('start_date') or '?'} → {r.get('end_date') or '?'} "
                   f"(trang {r['pages'][0]}–{r['pages'][-1]})")
    todo = d.get("ocr_todo", [])
    if todo:
        out.append(f"⚠️ Còn {len(todo)} trang CHƯA OCR (page {[t['page_num'] for t in todo]}) — digest bỏ qua các trang này.")
    out.append("\nMAP: admission_form→admission_workup · discharge_summary→discharge_summary · "
               "clinical_course/medical_orders/lab_result/imaging→department_stays[khoa]\n")
    out.append("=" * 60)

    cur_dept = "__INIT__"
    kept = skipped = 0
    for p in pages:
        ptype = p.get("page_type", "")
        text  = p.get("text", "") or ""
        table = p.get("text_table", "") or ""
        # Bo trang chua OCR / rong / administrative
        if text.startswith("[SCAN"):
            skipped += 1
            continue
        if (not keep_admin) and ptype in _DIGEST_SKIP_TYPES:
            skipped += 1
            continue
        # Noi dung: uu tien text_table cho lab/orders (bo 'text' trung)
        body = table if table.strip() else text
        if not body.strip():
            skipped += 1
            continue
        dept = p.get("department_canonical") or "—"
        if dept != cur_dept:
            out.append(f"\n{'─'*50}\n## KHOA: {dept}\n{'─'*50}")
            cur_dept = dept
        dates = p.get("dates_found", [])
        dtag = (" · ngày " + ",".join(dates)) if dates else ""
        method = p.get("department_method", "")
        mtag = " · ⚠khoa-suy-luận" if method == "forward_filled" else ""
        out.append(f"\n[p{p['page_num']} · {ptype}{dtag}{mtag}]")
        out.append(body.strip())
        kept += 1

    out.append("\n" + "=" * 60)
    out.append(f"DIGEST: giữ {kept} trang có nội dung · bỏ {skipped} trang (scan chưa OCR/rỗng/hành chính).")
    return "\n".join(out)


def update_ocr_cache(cache_path: str, from_json: str) -> None:
    """
    v3.1 — Sau khi Claude OCR (dien 'ocr_text' vao raw JSON), ghi nguoc vao cache:
        cache[scan_image_hash] = ocr_text
    De lan sau chay lai cung HSBA -> CACHE HIT -> khong OCR lai.
    """
    cache = _load_ocr_cache(cache_path)
    try:
        d = json.loads(Path(from_json).read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Khong doc duoc {from_json}: {e}", file=sys.stderr)
        sys.exit(1)
    added = 0
    for p in d.get("pages", []):
        h = p.get("scan_image_hash")
        txt = p.get("ocr_text")
        if h and txt and not p.get("ocr_from_cache"):
            if cache.get(h) != txt:
                cache[h] = txt
                added += 1
    Path(cache_path).parent.mkdir(parents=True, exist_ok=True)
    Path(cache_path).write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ OCR cache: +{added} entry moi -> {cache_path} (tong {len(cache)})", file=sys.stderr)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="extract-pdf-text.py v3.1")
    parser.add_argument("pdf", nargs="?", help="Duong dan file PDF (khong can khi --update-cache)")
    parser.add_argument("--pages", default=None, help='"all" | "1-5" | "1,3,5"')
    parser.add_argument("--output", "-o", default=None, help="Luu JSON/TXT vao file")
    parser.add_argument("--format", choices=["json", "txt"], default="json",
                        help="json (default) | txt (legacy)")
    parser.add_argument("--ocr-images-dir", default=None,
                        help="Thu muc BASH PATH luu anh PNG cua cac trang scan. "
                             "Vi du (bash sandbox): /sessions/.../mnt/KHTH/KHTH - P4 HSBA/temp-ocr")
    parser.add_argument("--ocr-read-dir", default=None,
                        help="Thu muc MACOS PATH de Claude dung Read tool doc PNG. "
                             "Neu khac --ocr-images-dir (chay trong sandbox).")
    parser.add_argument("--ocr-cache", default=None,
                        help="File JSON cache OCR (hash anh -> text). Cache HIT -> bo render+OCR lai.")
    parser.add_argument("--update-cache", default=None,
                        help="Ghi OCR text tu raw JSON (--from-json) vao file cache nay roi thoat.")
    parser.add_argument("--from-json", default=None,
                        help="raw JSON da co ocr_text (dung voi --update-cache hoac --digest).")
    parser.add_argument("--digest", action="store_true",
                        help="Sinh DIGEST text gon tu raw JSON (--from-json) -> doc Phase 3 tiet kiem token.")
    parser.add_argument("--keep-admin", action="store_true",
                        help="(voi --digest) giu ca trang administrative.")
    args = parser.parse_args()

    # Che do DIGEST (doc raw JSON da co OCR -> view gon)
    if args.digest:
        if not args.from_json:
            print("--digest can --from-json <raw.json>", file=sys.stderr)
            sys.exit(1)
        d = json.loads(Path(args.from_json).read_text(encoding="utf-8"))
        txt = to_digest_text(d, keep_admin=args.keep_admin)
        if args.output:
            Path(args.output).write_text(txt, encoding="utf-8")
            print(f"Da luu DIGEST: {args.output}", file=sys.stderr)
        else:
            print(txt)
        sys.exit(0)

    # Che do write-back cache (sau khi Claude OCR xong)
    if args.update_cache:
        if not args.from_json:
            print("--update-cache can --from-json <raw.json>", file=sys.stderr)
            sys.exit(1)
        update_ocr_cache(args.update_cache, args.from_json)
        sys.exit(0)

    if not args.pdf:
        print("Thieu duong dan PDF.", file=sys.stderr)
        sys.exit(1)

    if args.format == "txt":
        extract_to_txt(args.pdf, args.pages, args.output)
    else:
        extract_to_json(args.pdf, args.pages, args.output,
                        ocr_images_dir=args.ocr_images_dir,
                        ocr_read_dir=args.ocr_read_dir,
                        ocr_cache=args.ocr_cache)
