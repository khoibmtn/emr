/**
 * complete-example.js
 * =====================================================================
 * Script mẫu HOÀN CHỈNH để tạo báo cáo ĐÁNH GIÁ CHẤT LƯỢNG HSBA
 * Tương đương với file BaoCao_HSBA_TongVanQuang_2600062416_CHUAN.docx
 *
 * Cách dùng:
 *   1. Claude phân tích xong HSBA → điền data thực vào phần "DATA" bên dưới
 *   2. Cập nhật OUTPUT_PATH
 *   3. node complete-example.js
 *
 * Yêu cầu: npm install -g docx (v9.x)
 * =====================================================================
 */

'use strict';

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, LevelFormat, Header, Footer,
} = require('docx');
const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────
// DATA — ĐIỀN VÀO ĐÂY SAU KHI ĐÃ PHÂN TÍCH HSBA
// ─────────────────────────────────────────────────────────

const DATA = require(require('path').resolve(process.argv[2]));

// ─────────────────────────────────────────────────────────
// AUDIT CONFIG — Tải & áp dụng quy tắc bỏ qua của TTYT
// File: ../audit-config.json (cạnh thư mục scripts/)
// Để TẮT một rule: đặt "enabled": false trong audit-config.json
// ─────────────────────────────────────────────────────────
(function applyAuditConfig() {
  var cfgPath = path.join(__dirname, '..', 'audit-config.json');
  var cfg = { ignore_rules: [] };
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch(e) {
    /* Không tìm thấy config → không bỏ qua rule nào */
  }

  // Chỉ dùng các rule đang bật (enabled != false)
  var activeRules = (cfg.ignore_rules || []).filter(function(r) {
    return r.enabled !== false;
  });

  // ── Lọc thieu_sot ──
  // Rule chỉ áp dụng khi:
  //   (a) keyword khớp, VÀ
  //   (b) suppress_type === null (bỏ qua tất cả) HOẶC suppress_type khớp cause của thiếu sót
  var originalThieuSot = DATA.thieu_sot.slice();
  DATA.thieu_sot = DATA.thieu_sot.filter(function(ts) {
    return !activeRules.some(function(rule) {
      if (!rule.thieu_sot_keyword || !ts.noi_dung) return false;
      var keywordMatch = ts.noi_dung.indexOf(rule.thieu_sot_keyword) >= 0;
      if (!keywordMatch) return false;
      // Nếu rule không khai báo suppress_type → bỏ qua mọi cause
      if (!rule.suppress_type) return true;
      // Ngược lại: chỉ bỏ qua khi cause của thiếu sót khớp suppress_type
      return ts.cause === rule.suppress_type;
    });
  });

  // ── Suppress bieu_mau entries theo canonical_id (hoàn toàn — không để lại ⚠️) ──
  // DATA.bieu_mau là FLAT ARRAY; dùng trực tiếp, không phải .chi_tiet
  DATA.bieu_mau = DATA.bieu_mau.map(function(item) {
    if (!item.canonical_id || item.icon === '❌') return item;
    // Tìm rule suppress canonical_id này
    var suppressRule = null;
    activeRules.forEach(function(rule) {
      if (!suppressRule && (rule.suppresses_canonical_ids || []).indexOf(item.canonical_id) >= 0) {
        suppressRule = rule;
      }
    });
    if (!suppressRule) return item;
    // Strip nội dung liên quan đến check bị tắt khỏi ket_qua
    var cleaned = item.ket_qua || '';
    if (suppressRule.thieu_sot_keyword) {
      var kw = suppressRule.thieu_sot_keyword;
      // Tìm vị trí keyword (không phân biệt hoa/thường) và xóa từ đó đến '.'
      var lower = cleaned.toLowerCase();
      var kwLower = kw.toLowerCase().replace(/\band\b/g, '').replace(/\s+/g, ' ').trim();
      // Thử tìm cả "và" lẫn "/" giữa hai phần của keyword
      var idx = lower.indexOf(kwLower);
      if (idx < 0) {
        // Fallback: tìm từ đầu của keyword (trước "và"/"/" )
        var firstWord = kw.split(/\s+/)[0].toLowerCase();
        idx = lower.indexOf(firstWord);
      }
      if (idx >= 0) {
        var dotIdx = cleaned.indexOf('.', idx);
        var end    = dotIdx >= 0 ? dotIdx + 1 : cleaned.length;
        // Cắt khoảng trắng/dấu câu trước keyword
        var start = idx;
        while (start > 0 && /[\s,;.]/.test(cleaned[start - 1])) start--;
        cleaned = (cleaned.slice(0, start) + ' ' + cleaned.slice(end))
                    .replace(/\s{2,}/g, ' ').trim();
      }
    }
    if (!cleaned || cleaned.length < 2) cleaned = 'Đạt.';
    return {
      stt:          item.stt,
      canonical_id: item.canonical_id,
      ten:          item.ten,
      ket_qua:      cleaned,
      icon:         '✅',
    };
  });

  // ── Ghi lại danh sách rule thực sự có hiệu lực (để log vào JSON + DOCX) ──
  var suppressed = [];
  activeRules.forEach(function(rule) {
    var hitThieuSot = originalThieuSot.some(function(ts) {
      return rule.thieu_sot_keyword
        && ts.noi_dung
        && ts.noi_dung.indexOf(rule.thieu_sot_keyword) >= 0;
    });
    var hitBieuMau = (rule.suppresses_canonical_ids || []).some(function(cid) {
      return DATA.bieu_mau.some(function(item) { return item.canonical_id === cid; });
    });
    if (hitThieuSot || hitBieuMau) {
      suppressed.push({
        id:            rule.id,
        description:   rule.description,
        reason:        rule.reason,
        suppress_type: rule.suppress_type || null,
      });
    }
  });

  DATA._suppressed_rules       = suppressed;
  DATA._audit_config_version   = cfg.version || 'unknown';
  DATA._audit_config_hospital  = cfg.hospital || '';
})();

// ─────────────────────────────────────────────────────────
// HỆ MÀU CHUẨN
// ─────────────────────────────────────────────────────────
const C = {
  navy:   "1F3864",  blue:   "2E75B6",  dblue:  "1A5276",
  lblue:  "D6E4F0",  lblue2: "EBF5FB",
  green:  "1E7145",  lgreen: "E2EFDA",
  amber:  "C55A11",  lamber: "FEF9E7",
  red:    "C00000",  lred:   "FCECEA",
  gray:   "595959",  lgray:  "F2F2F2",
  white:  "FFFFFF",  black:  "000000",
};

const COLR = { green: C.green, amber: C.amber, red: C.red };

const PAGE_W = 11906;
const MARGIN = 1134;
const CONT_W = PAGE_W - MARGIN * 2;

// ─────────────────────────────────────────────────────────
// HÀM TIỆN ÍCH
// ─────────────────────────────────────────────────────────

function bdr(c, sz) { c = c || "CCCCCC"; sz = sz || 1; return { style: BorderStyle.SINGLE, size: sz, color: c }; }
function bdrs(c, sz) { return { top: bdr(c,sz), bottom: bdr(c,sz), left: bdr(c,sz), right: bdr(c,sz) }; }

function cell(children, w, opts) {
  opts = opts || {};
  return new TableCell({
    width:         { size: w, type: WidthType.DXA },
    borders:       bdrs(opts.bc || "CCCCCC", opts.bs || 1),
    shading:       opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    verticalAlign: opts.va || VerticalAlign.TOP,
    margins:       { top: 100, bottom: 100, left: 130, right: 130 },
    children:      children,
  });
}

function txt(t, opts) {
  opts = opts || {};
  return new TextRun({
    text: t, bold: opts.bold || false, italics: opts.italic || false,
    color: opts.color || C.black, size: opts.size || 20,
    font: opts.font || "Arial",
    underline: opts.underline ? {} : undefined,
  });
}

function para(children, opts) {
  opts = opts || {};
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: opts.before || 0, after: opts.after || 70 },
    border: opts.bb ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: opts.bb, space: 4 } } : undefined,
    children: Array.isArray(children) ? children : [children],
  });
}

function h1(t) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.blue, space: 4 } },
    children: [new TextRun({ text: t, bold: true, size: 28, font: "Arial", color: C.navy })],
  });
}

function h2(t, color) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 90 },
    children: [new TextRun({ text: t, bold: true, size: 24, font: "Arial", color: color || C.blue })],
  });
}

function h3(t) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 70 },
    children: [new TextRun({ text: t, bold: true, size: 21, font: "Arial", color: C.navy })],
  });
}

function spacer(n) {
  n = n || 1; var arr = [];
  for (var i = 0; i < n; i++) arr.push(new Paragraph({ children: [new TextRun({ text: "", size: 20 })], spacing: { before: 0, after: 0 } }));
  return arr;
}

function tbl(headers, rows, colW, opts) {
  opts = opts || {};
  var hdrFill = opts.hf || C.navy;
  var hdrRow = new TableRow({
    tableHeader: true,
    children: headers.map(function(h, i) {
      return cell([para([txt(h, { bold: true, size: 19, color: C.white })], { after: 0 })], colW[i], { fill: hdrFill, bc: hdrFill });
    })
  });
  var dataRows = rows.map(function(row, ri) {
    return new TableRow({
      children: row.map(function(v, ci) {
        var fill = v.fill || (ri % 2 === 0 ? (opts.sf || "F4F8FC") : C.white);
        var ps = v.paras ? v.paras.map(function(p) {
          return para([txt(p.text || "", { size: 19, color: p.color || C.black, bold: p.bold || false, italic: p.italic || false })], { after: 30 });
        }) : [para([txt(v.text || "", { size: 19, color: v.color || C.black, bold: v.bold || false, italic: v.italic || false })], { after: 0 })];
        return cell(ps, colW[ci], { fill: fill, bc: "CCCCCC" });
      })
    });
  });
  return new Table({
    width: { size: CONT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [hdrRow].concat(dataRows),
  });
}

function sectionBanner(t, fill) {
  fill = fill || C.navy;
  return new Table({
    width: { size: CONT_W, type: WidthType.DXA }, columnWidths: [CONT_W],
    rows: [new TableRow({ children: [
      cell([para([txt(t, { bold: true, size: 24, color: C.white })], { after: 0, align: AlignmentType.CENTER })], CONT_W, { fill: fill, bc: fill })
    ]})]
  });
}

function guidelineBox(lines) {
  return new Table({
    width: { size: CONT_W, type: WidthType.DXA }, columnWidths: [CONT_W],
    rows: [new TableRow({ children: [
      cell(
        lines.map(function(l, i) {
          return para([txt((i === 0 ? "📋  " : "     ") + (l.text || l), { size: 19, bold: l.bold || false, color: C.dblue, italic: l.italic || false })], { after: i === lines.length - 1 ? 0 : 40 });
        }),
        CONT_W, { fill: C.lblue2, bc: C.blue, bs: 4 }
      )
    ]})]
  });
}

function noticeBox(lines, fill, bc) {
  return new Table({
    width: { size: CONT_W, type: WidthType.DXA }, columnWidths: [CONT_W],
    rows: [new TableRow({ children: [
      cell(
        lines.map(function(l, i) {
          return para([txt(l.text || l, { size: 20, bold: l.bold || false, color: l.color || C.black, italic: l.italic || false })], { after: i === lines.length - 1 ? 0 : 50 });
        }),
        CONT_W, { fill: fill, bc: bc, bs: 4 }
      )
    ]})]
  });
}

function verdictBox(label, color, lines) {
  return new Table({
    width: { size: CONT_W, type: WidthType.DXA }, columnWidths: [CONT_W],
    rows: [new TableRow({ children: [
      cell(
        [para([txt(label, { bold: true, size: 26, color: color })], { after: 60 })].concat(
          lines.map(function(l) { return para([txt("  ▸  " + l, { size: 20, color: C.gray })], { after: 40 }); })
        ),
        CONT_W, { fill: C.lamber, bc: color, bs: 6 }
      )
    ]})]
  });
}

// ── v3.7: Hộp ranh giới suy luận (đầu Phần B) ──
function reasoningBoundaryBox() {
  var rb = DATA.reasoning_boundary || {};
  var capLabel = { supported: "Có căn cứ (đối chiếu guideline)", partially_supported: "Có căn cứ một phần (chỉ logic nội bộ)", insufficient_evidence: "Chưa đủ bằng chứng (OCR hạn chế)" }[rb.confidence_cap] || (rb.confidence_cap || "—");
  var capColor = rb.confidence_cap === "supported" ? C.green : (rb.confidence_cap === "insufficient_evidence" ? C.red : C.amber);
  var srcN = (rb.guideline_sources || []).length;
  return new Table({
    width: { size: CONT_W, type: WidthType.DXA }, columnWidths: [CONT_W],
    rows: [new TableRow({ children: [
      cell([
        para([txt("🧭  Cơ sở suy luận Phần B: ", { bold: true, size: 19, color: C.dblue }), txt(capLabel, { bold: true, size: 19, color: capColor })], { after: 40 }),
        para([txt("Nguồn đối chiếu (" + srcN + "): ", { size: 18, color: C.gray }), txt((rb.guideline_sources || []).join(" · ") || "—", { size: 18, color: C.gray, italic: true })], { after: 30 }),
        para([txt("Đã đối chiếu mã ICD chuẩn BYT 2026: " + (rb.icd_grounded ? "Có" : "Chưa") + ". Mọi trích dẫn đưa vào báo cáo đã qua bước kiểm chứng (verify).", { size: 17, color: C.gray, italic: true })], { after: 0 }),
      ], CONT_W, { fill: C.lblue2, bc: C.blue, bs: 4 })
    ]})]
  });
}

// ── v3.7: Bảng B.0 — Cơ sở bằng chứng đối chiếu ──
function buildEvidenceGroundingTable() {
  var eg = DATA.evidence_grounding || [];
  if (!eg.length) return para([txt("(Chưa có bằng chứng đối chiếu được ghi nhận)", { italic: true, size: 18, color: C.gray })]);
  var tierLabel = { internal_2nd_brain: "Kho nội bộ", moh: "Bộ Y tế", international_society: "Hiệp hội QT", literature: "Y văn", icd: "ICD" };
  var rows = eg.map(function(e) {
    var vFill = e.verified ? C.lgreen : C.lamber;
    var vText = e.verified ? "✅ Đã verify" : "⚠️ Chờ verify";
    return [
      { text: e.concept || "", fill: C.white },
      { text: (tierLabel[e.source_tier] || e.source_tier || "") , fill: C.lgray },
      { text: e.source || "", fill: C.white },
      { text: (e.validity === "current" ? "Còn hiệu lực" : (e.validity || "—")), fill: C.white },
      { text: vText, fill: vFill, color: e.verified ? C.green : C.amber, bold: true },
      { text: e.citation_ref || "", fill: C.white, bold: true, color: C.navy },
    ];
  });
  return tbl(
    ["Khái niệm đối chiếu (ẩn danh)", "Tier", "Nguồn", "Hiệu lực", "Kiểm chứng", "TLTK"],
    rows,
    [2700, 1000, 2900, 1300, 1200, CONT_W - 2700 - 1000 - 2900 - 1300 - 1200]
  );
}

// ── v3.7: Guard phủ dữ liệu theo khoa (cảnh báo gán nhầm khi nằm nhiều khoa) ──
function buildDeptCoverageNote() {
  var stays = DATA.department_stays || [];
  if (stays.length < 2) return null;   // chỉ kiểm khi BN nằm ≥2 khoa
  var warn = [];
  stays.forEach(function(d) {
    var nLab = (d.lab_results || []).length;
    var nMed = (d.medications || []).length;
    var nImg = (d.imaging_results || []).length;
    var hasCourse = (d.clinical_course_raw || "").length > 50;
    if (hasCourse && nLab === 0 && nMed === 0 && nImg === 0) {
      warn.push("Khoa \"" + (d.department || "?") + "\" có diễn biến lâm sàng nhưng KHÔNG có XN/y lệnh/CĐHA — kiểm tra lại việc gán phiếu theo ngày (có thể bị dồn sang khoa khác).");
    }
  });
  if (!warn.length) return null;
  return noticeBox(
    [{ text: "⚠️ Cảnh báo phủ dữ liệu theo khoa (BN nằm " + stays.length + " khoa):", bold: true, color: C.amber }]
      .concat(warn.map(function(w){ return { text: "• " + w }; })),
    C.lamber, C.amber
  );
}

// ── v5.0: Narrative box (nền xám, in nghiêng) — dùng cho Section B ──
function narrativeBox(title, levelTag, bodyLines) {
  var tagColor = levelTag === "supported" ? C.green : (levelTag === "insufficient_evidence" ? C.red : C.amber);
  var tagLabel = levelTag === "supported" ? "Có căn cứ" : (levelTag === "insufficient_evidence" ? "Chưa đủ căn cứ" : "Có căn cứ một phần");
  var lines = Array.isArray(bodyLines) ? bodyLines : (typeof bodyLines === "string" ? bodyLines.split("\n") : ["(Chưa có nhận xét)"]);
  lines = lines.filter(function(l) { return l && l.trim(); });
  if (!lines.length) lines = ["(Chưa có nhận xét)"];
  var ch = [
    para([
      txt(title, { bold: true, size: 21, color: "2C3E50" }),
      txt("  [" + tagLabel + "]", { size: 18, color: tagColor, italic: true }),
    ], { after: 60 }),
  ];
  lines.forEach(function(ln) {
    ch.push(para([txt(ln, { italic: true, size: 19, color: "5D6D7E" })], { after: 40 }));
  });
  return new Table({
    width: { size: CONT_W, type: WidthType.DXA }, columnWidths: [CONT_W],
    rows: [new TableRow({ children: [cell(ch, CONT_W, { fill: "EBF5FB", bc: "AED6F1", bs: 4 })] })],
  });
}

// Section B narrative summary — dùng DATA.lam_sang_tomtat (dynamic)
function buildSectionBNarrative() {
  var ls = DATA.lam_sang_tomtat || {};
  var kl = DATA.ket_luan || {};
  var rb = DATA.reasoning_boundary || {};
  var cap = rb.confidence_cap || "partially_supported";
  var out = [];
  out.push(noticeBox([
    { text: "⚠️  Mục này do Claude (LLM) tổng hợp từ nội bộ hồ sơ bệnh án. KHÔNG phải kết luận y khoa độc lập. Mọi nhận định cần bác sĩ lâm sàng xem xét và xác nhận trước khi sử dụng.", italic: true, color: C.gray },
  ], C.lgray, C.gray));
  out.push(...spacer(1));
  if (ls.chan_doan_chinh || ls.ly_do_bang_chung) {
    var t1 = (ls.chan_doan_chinh || "Chẩn đoán chính") + " — tính nhất quán bằng chứng";
    out.push(narrativeBox(t1, cap, ls.ly_do_bang_chung || "(Chưa có thông tin)"));
    out.push(...spacer(1));
  }
  if (ls.chan_doan_kem_e876 || (ls.phat_hien_phu_chua_xu_tri || []).length > 0) {
    var phLines = [];
    if (ls.chan_doan_kem_e876) phLines.push(ls.chan_doan_kem_e876);
    (ls.phat_hien_phu_chua_xu_tri || []).forEach(function(p) { phLines.push("• " + p); });
    out.push(narrativeBox("Phát hiện phụ / Bệnh kèm — nhận xét quan trọng", cap, phLines));
    out.push(...spacer(1));
  }
  if (ls.dieu_tri_danh_gia) {
    out.push(narrativeBox("Diễn biến điều trị — bằng chứng đáp ứng lâm sàng", cap, ls.dieu_tri_danh_gia));
    out.push(...spacer(1));
  }
  if (kl.tong_the) {
    var qLines = [kl.tong_the];
    if ((kl.diem_manh || []).length) qLines.push("Điểm mạnh: " + kl.diem_manh.join("; "));
    if ((kl.loi_noi_bat || []).length) qLines.push("Cần lưu ý: " + kl.loi_noi_bat.join("; "));
    out.push(narrativeBox("Chất lượng ghi chép hồ sơ", kl.tong_the_color === "green" ? "supported" : cap, qLines));
    out.push(...spacer(1));
  }
  return out;
}

// B.1 dynamic — detect tiêu chí từ DATA (thay thế hardcode UAP/I20.0)
function buildB1Dynamic() {
  var ls = DATA.lam_sang_tomtat || {};
  var rb = DATA.reasoning_boundary || {};
  var cap = rb.confidence_cap || "partially_supported";
  var capLabel = cap === "supported" ? "Có căn cứ" : (cap === "insufficient_evidence" ? "Chưa đủ căn cứ" : "Có căn cứ một phần");
  var capColor = cap === "supported" ? C.green : (cap === "insufficient_evidence" ? C.red : C.amber);
  var capFill  = cap === "supported" ? C.lgreen : (cap === "insufficient_evidence" ? C.lred : C.lamber);
  var icd = DATA.icd || {};
  var mainCode = (icd.ma_chinh && icd.ma_chinh.code) ? icd.ma_chinh.code : "";
  var mainDx = (mainCode ? mainCode + " — " : "") + (ls.chan_doan_chinh || "Chẩn đoán chính");
  var out = [];
  out.push(h2("Bệnh chính: " + mainDx));
  if (ls.ly_do_bang_chung) {
    out.push(noticeBox([
      { text: "Mức độ bằng chứng: ", bold: true, color: capColor },
      { text: capLabel + ". " + ls.ly_do_bang_chung, italic: true },
    ], capFill, capColor));
    out.push(...spacer(1));
  }
  if ((DATA.tieu_chi_uap || []).length > 0) {
    out.push(h3("Đối chiếu tiêu chí chẩn đoán"));
    out.push(buildUAPTable());
    out.push(...spacer(1));
  }
  if ((DATA.tieu_chi_kali || []).length > 0) {
    out.push(buildKaliTable());
    out.push(...spacer(1));
  }
  if ((DATA.phat_hien_phu || []).length > 0 || (ls.phat_hien_phu_chua_xu_tri || []).length > 0) {
    out.push(h2("Các phát hiện lâm sàng phụ chưa được giải quyết"));
    out.push(buildPhatHienPhuTable());
    out.push(...spacer(1));
  }
  if (ls.chan_doan_kem_e876) {
    out.push(noticeBox([
      { text: "Nhận xét (bệnh kèm): ", bold: true, color: C.green },
      { text: ls.chan_doan_kem_e876, italic: true },
    ], C.lgreen, C.green));
    out.push(...spacer(1));
  }
  return out;
}

// B.5 dynamic — ICD analysis (thay thế hardcode I20.0/R07.3)
function buildB5Dynamic() {
  var icdS = DATA.icd_summary || {};
  var out = [];
  var icdG = (DATA.evidence_grounding || []).filter(function(e) {
    return e.source_tier === "icd" || ((e.source || "").indexOf("4469") >= 0);
  });
  if (icdG.length > 0) {
    out.push(guidelineBox(icdG.map(function(g) {
      return { text: (g.citation_ref ? g.citation_ref + " " : "") + g.source + (g.key_point ? ": " + g.key_point : "") };
    })));
    out.push(...spacer(1));
  }
  if ((DATA.icd_chi_tiet || []).length > 0) {
    out.push(h2("Phân tích sai sót mã hóa và đề xuất mã đúng"));
    out.push(buildIcdChiTietTable());
    out.push(...spacer(1));
  }
  if (icdS.danh_gia_ma_chinh) {
    out.push(noticeBox([
      { text: "Đánh giá mã chính: ", bold: true, color: C.navy },
      { text: icdS.danh_gia_ma_chinh, italic: true },
    ], C.lgray, C.navy));
    out.push(...spacer(1));
  }
  if (icdS.danh_gia_ma_kem_r073) {
    out.push(noticeBox([
      { text: "Đánh giá mã kèm: ", bold: true, color: C.navy },
      { text: icdS.danh_gia_ma_kem_r073, italic: true },
    ], C.lgray, C.navy));
    out.push(...spacer(1));
  }
  if (icdS.ma_de_nghi_chinh) {
    out.push(noticeBox([
      { text: "Đề nghị mã chính: ", bold: true, color: C.green },
      { text: icdS.ma_de_nghi_chinh + (icdS.ten_de_nghi_chinh ? " — " + icdS.ten_de_nghi_chinh : "") + ". " },
      { text: icdS.co_so_phap_ly || "", italic: true, color: C.gray },
    ], C.lgreen, C.green));
    out.push(...spacer(1));
  }
  return out;
}

// ── 100-ĐIỂM: Tính điểm từ DATA ──
function computeScore100() {
  function bmIcon(id) {
    if (!DATA.bieu_mau) return "N/A";
    for (var i = 0; i < DATA.bieu_mau.length; i++) {
      if (DATA.bieu_mau[i].canonical_id === id) return DATA.bieu_mau[i].icon || "N/A";
    }
    return "N/A";
  }
  function i2n(icon, max) {
    if (icon === "✅") return max;
    if (icon === "⚠️") return Math.floor(max * 0.3);  // Siết: 30% (không phải 50%)
    if (icon === "❌") return 0;
    return 0; // N/A → 0 (không xác minh được = không tính điểm, tránh điểm ảo)
  }
  function has(kw) {
    return (DATA.thieu_sot || []).some(function(ts) {
      return (ts.noi_dung || "").toLowerCase().indexOf(kw.toLowerCase()) >= 0;
    });
  }
  // Chất lượng kê đơn từ dieu_tri_danh_gia
  function thuocIcon() {
    var dtd = DATA.dieu_tri_danh_gia || [];
    if (!dtd.length) return "⚠️"; // không fill → không xác minh
    var hasErr  = dtd.some(function(d) { return d.muc_do === "❌"; });
    var hasWarn = dtd.some(function(d) { return d.muc_do === "⚠️"; });
    return hasErr ? "❌" : hasWarn ? "⚠️" : "✅";
  }
  function mk(code, text, max, iconOrNum) {
    var e, ic;
    if (typeof iconOrNum === "number") {
      e = Math.min(iconOrNum, max);
      ic = e >= max ? "✅" : (e > 0 ? "⚠️" : "❌");
    } else {
      ic = iconOrNum || "⚠️";   // default ⚠️, không tự động ✅
      e = i2n(ic, max);
    }
    return { code: code, text: text, max: max, earned: e, icon: ic };
  }
  var icdTotal = (DATA.icd || {}).tong_ma || 0;
  var icdLoi   = (DATA.icd || {}).ma_loi  || 0;
  var icdRatio = icdTotal > 0 ? Math.max(0, (icdTotal - icdLoi) / icdTotal) : 0; // 0 nếu không có dữ liệu ICD
  var icdIcon  = icdTotal === 0 ? "⚠️" : (icdRatio >= 1 ? "✅" : (icdRatio >= 0.5 ? "⚠️" : "❌"));

  // Thay đổi chẩn đoán: rỗng = không cần thay đổi → OK; có thay đổi → kiểm tra
  var tcdArr = DATA.thay_doi_chan_doan || [];
  var tcdIcon = tcdArr.length === 0 ? "✅"
    : (tcdArr.every(function(t){ return t.phu_hop === "✅" || t.phu_hop === true; }) ? "✅" : "⚠️");

  // so_ngay — parse an toàn
  var soNgay = 0;
  var snRaw = String(DATA.so_ngay || "0");
  var snMatch = snRaw.match(/\d+/);
  if (snMatch) soNgay = parseInt(snMatch[0], 10);

  // Phát hiện liệu hồ sơ có trang scan chưa OCR → ảnh hưởng nhiều tiêu chí
  var coScan = (DATA.bieu_mau || []).some(function(b){ return (b.ket_qua || "").indexOf("SCAN") >= 0 || (b.icon === "N/A"); });

  var g1 = [
    mk("I.1",  "Họ tên viết in hoa, có dấu", 2, bmIcon("HC01")),
    mk("I.2",  "Ghi đủ các mục; không sửa xóa; không rách", 2,
      (has("sửa") || has("xóa") || has("rách")) ? "❌" : (has("thiếu mục") || has("bỏ trống") ? "⚠️" : "✅")),
    mk("I.3",  "Sắp xếp đúng nhóm, đúng trình tự", 2,
      (has("sắp xếp") || has("thứ tự") || has("nhầm trình tự")) ? "⚠️" : (coScan ? "⚠️" : "✅")),
    mk("I.4",  "Mã ICD phù hợp chẩn đoán", 3, icdIcon),
    mk("I.5",  "Đầy đủ chữ ký, họ tên BS/ĐD", 3,
      (has("chữ ký") || has("ký tên") || has("thiếu ký")) ? "⚠️" : (coScan ? "⚠️" : "✅")),
    mk("I.6",  "Hoàn chỉnh HSBA trong 24h/36h", 2,
      (has("24h") || has("36h") || has("chậm") || coScan) ? "⚠️" : "✅"),
    mk("I.7",  "Không ghi thông tin không liên quan", 1, "✅"),
  ];
  var g2 = [
    mk("II.1", "Hỏi bệnh sử, tiền sử; khám toàn diện", 5,
      i2n(bmIcon("LS01"),2) + i2n(bmIcon("LS02"),2) + i2n(bmIcon("LS03"),1)),
    mk("II.2", "Làm đủ XN, CLS cần thiết", 5,
      i2n(bmIcon("CLS01"),3) + i2n(bmIcon("CLS02"),2)),
    mk("II.3", "KQ XN được BS xem, sao kết quả, xử trí", 4,
      ((DATA.dieu_tri_danh_gia || []).length > 0 || (DATA.cls_du || []).length > 0) ? "✅" : "⚠️"),
    mk("II.4", "Chẩn đoán sơ bộ ngay sau thăm khám", 4, bmIcon("DD01")),
    mk("II.5", "Chẩn đoán xác định trong 72h đầu", 4, bmIcon("DD02")),
    mk("II.6", "Lựa chọn mã ICD phù hợp", 4, icdIcon),
    mk("II.7", "Thay đổi chẩn đoán có lập luận (khi có)", 3, tcdIcon),
    mk("II.8", "Hội chẩn theo quy chế; ghi đầy đủ (khi có)", 3,
      has("hội chẩn") ? "⚠️" : "✅"),
    mk("II.9", "Ra viện có CĐ xác định, đúng đủ thông tin", 3, bmIcon("RV01")),
  ];
  var g3 = [
    mk("III.1",  "Ghi đầy đủ diễn biến BN hàng ngày", 5, bmIcon("DD04")),
    mk("III.2",  "Y lệnh điều trị phù hợp chẩn đoán", 5, bmIcon("DD03")),
    mk("III.3",  "Chỉ định thuốc hợp lý, an toàn, tiết kiệm", 5, thuocIcon()),
    mk("III.4",  "Tên thuốc đúng danh pháp; thuốc đặc biệt đánh số", 4,
      (DATA.dieu_tri_danh_gia || []).length > 0 ? "✅" : "⚠️"),
    mk("III.5",  "Thực hiện đủ quy định sử dụng thuốc, dược lâm sàng", 4,
      (DATA.tuong_tac_thuoc || []).some(function(t){ return t.muc_do === "Nặng"; }) ? "⚠️"
      : ((DATA.dieu_tri_danh_gia || []).length > 0 ? "✅" : "⚠️")),
    mk("III.6",  "Biên bản hội chẩn đúng đủ (khi có chỉ định)", 4,
      (has("biên bản hội chẩn") || has("hội chẩn thiếu")) ? "⚠️" : "✅"),
    mk("III.7",  "Kết quả khám lại Trưởng khoa ≥1 lần/tuần", 3,
      soNgay >= 7 ? "⚠️" : "✅"),   // ≥7 ngày: nghi ngờ → ⚠️ (không thể tự động verify)
    mk("III.8",  "Sơ kết điều trị 15 ngày (khi nằm >15 ngày)", 2,
      soNgay > 15 ? "⚠️" : "✅"),  // >15 ngày: cần sơ kết → ⚠️ nếu không có bằng chứng rõ
    mk("III.9",  "Tổng kết khi BN ra viện", 2, bmIcon("RV01")),
    mk("III.10", "BA tử vong có trích biên bản kiểm thảo tử vong", 1,
      (DATA.hinh_thuc_ra_vien || "").indexOf("Tử vong") >= 0 ? bmIcon("RV01") : "✅"),
  ];
  var g4 = [
    mk("IV.1", "Phiếu chăm sóc điều dưỡng đầy đủ", 3,
      has("chăm sóc điều dưỡng") ? "❌" : (coScan ? "⚠️" : "✅")),
    mk("IV.2", "Phiếu theo dõi ghi đầy đủ các mục", 3,
      has("theo dõi") ? "⚠️" : "✅"),
    mk("IV.3", "Phiếu truyền dịch đầy đủ", 3,
      has("truyền dịch") ? "❌" : "✅"),
    mk("IV.4", "Phiếu truyền máu đầy đủ (khi có)", 2,
      has("truyền máu") ? "❌" : "✅"),
    mk("IV.5", "Phiếu công khai chi phí đúng đủ", 2,
      has("công khai") ? "❌" : "✅"),
    mk("IV.6", "Phiếu GDSK / hướng dẫn sau ra viện", 2, bmIcon("RV02")),
  ];
  function sg(items) {
    var e = 0, m = 0;
    items.forEach(function(it) { e += it.earned; m += it.max; });
    return { earned: Math.min(e, m), max: m, items: items };
  }
  var sg1 = sg(g1), sg2 = sg(g2), sg3 = sg(g3), sg4 = sg(g4);
  var total = Math.min(100, Math.max(0, sg1.earned + sg2.earned + sg3.earned + sg4.earned));
  var cls   = total >= 90 ? "Xuất sắc" : total >= 75 ? "Tốt" : total >= 60 ? "Khá" : total >= 45 ? "Trung bình" : "Yếu";
  var clsC  = total >= 90 ? C.green : total >= 75 ? C.dblue : total >= 60 ? C.navy : total >= 45 ? C.amber : C.red;
  return { total: total, classification: cls, classColor: clsC, g1: sg1, g2: sg2, g3: sg3, g4: sg4 };
}

// ── 100-ĐIỂM: Bảng chấm điểm ──
function buildBangKiem100Table() {
  var sc = SCORE;
  var rows = [];
  function iFill(ic) { return ic === "✅" ? C.lgreen : (ic === "⚠️" ? C.lamber : (ic === "❌" ? C.lred : C.lgray)); }
  function iLbl(ic)  { return ic === "✅" ? "Đạt" : (ic === "⚠️" ? "Cần bổ sung" : (ic === "❌" ? "Không đạt" : "N/A")); }
  var W = [Math.floor(CONT_W*0.51), Math.floor(CONT_W*0.14), Math.floor(CONT_W*0.14),
           CONT_W - Math.floor(CONT_W*0.51) - Math.floor(CONT_W*0.14) - Math.floor(CONT_W*0.14)];
  // Header row
  rows.push(new TableRow({ tableHeader: true, children: [
    cell([para([txt("Tiêu chí đánh giá", { bold: true, size: 20, color: C.white })], { after: 0 })], W[0], { fill: "2C3E50", bc: "2C3E50" }),
    cell([para([txt("Tối đa", { bold: true, size: 18, color: C.white })], { after: 0, align: AlignmentType.CENTER })], W[1], { fill: "2C3E50", bc: "2C3E50" }),
    cell([para([txt("Đạt được", { bold: true, size: 18, color: C.white })], { after: 0, align: AlignmentType.CENTER })], W[2], { fill: "2C3E50", bc: "2C3E50" }),
    cell([para([txt("Kết quả", { bold: true, size: 18, color: C.white })], { after: 0, align: AlignmentType.CENTER })], W[3], { fill: "2C3E50", bc: "2C3E50" }),
  ]}));
  function addGH(label, g) {
    var pct = Math.round(g.earned / g.max * 100);
    rows.push(new TableRow({ tableHeader: true, children: [
      cell([para([txt(label, { bold: true, size: 21, color: C.white })], { after: 0 })], W[0], { fill: C.navy, bc: C.navy }),
      cell([para([txt(String(g.max), { bold: true, size: 20, color: "BDC3C7" })], { after: 0, align: AlignmentType.CENTER })], W[1], { fill: C.navy, bc: C.navy }),
      cell([para([txt(String(g.earned), { bold: true, size: 22, color: g.earned >= g.max*0.75 ? "A9DFBF" : (g.earned >= g.max*0.5 ? "F9E79F" : "F1948A") })], { after: 0, align: AlignmentType.CENTER })], W[2], { fill: C.navy, bc: C.navy }),
      cell([para([txt(pct + "%", { bold: true, size: 20, color: C.white })], { after: 0, align: AlignmentType.CENTER })], W[3], { fill: C.navy, bc: C.navy }),
    ]}));
    g.items.forEach(function(it) {
      var f = iFill(it.icon);
      rows.push(new TableRow({ children: [
        cell([para([txt(it.code + "  " + it.text, { size: 19 })], { after: 0 })], W[0], { fill: f, bc: "CCCCCC" }),
        cell([para([txt(String(it.max), { size: 19, color: C.gray })], { after: 0, align: AlignmentType.CENTER })], W[1], { fill: f, bc: "CCCCCC" }),
        cell([para([txt(String(it.earned), { size: 19, bold: true, color: it.icon === "✅" ? C.green : (it.icon === "⚠️" ? C.amber : C.red) })], { after: 0, align: AlignmentType.CENTER })], W[2], { fill: f, bc: "CCCCCC" }),
        cell([para([txt(iLbl(it.icon), { size: 18, italic: true, color: it.icon === "✅" ? C.green : (it.icon === "⚠️" ? C.amber : C.red) })], { after: 0 })], W[3], { fill: f, bc: "CCCCCC" }),
      ]}));
    });
  }
  addGH("I. Thủ tục hành chính (" + sc.g1.earned + "/" + sc.g1.max + " điểm)", sc.g1);
  addGH("II. Chất lượng chẩn đoán (" + sc.g2.earned + "/" + sc.g2.max + " điểm)", sc.g2);
  addGH("III. Chất lượng điều trị (" + sc.g3.earned + "/" + sc.g3.max + " điểm)", sc.g3);
  addGH("IV. Chăm sóc điều dưỡng (" + sc.g4.earned + "/" + sc.g4.max + " điểm)", sc.g4);
  // Total row
  rows.push(new TableRow({ children: [
    cell([para([txt("TỔNG ĐIỂM CHẤT LƯỢNG HỒ SƠ BỆNH ÁN", { bold: true, size: 22, color: C.white })], { after: 0 })], W[0], { fill: sc.classColor, bc: sc.classColor }),
    cell([para([txt("100", { bold: true, size: 24, color: C.white })], { after: 0, align: AlignmentType.CENTER })], W[1], { fill: sc.classColor, bc: sc.classColor }),
    cell([para([txt(String(sc.total), { bold: true, size: 26, color: C.white })], { after: 0, align: AlignmentType.CENTER })], W[2], { fill: sc.classColor, bc: sc.classColor }),
    cell([para([txt(sc.classification, { bold: true, size: 22, color: C.white })], { after: 0 })], W[3], { fill: sc.classColor, bc: sc.classColor }),
  ]}));
  return new Table({ width: { size: CONT_W, type: WidthType.DXA }, columnWidths: W, rows: rows });
}

// Dynamic verdict box — thay thế hardcode TONG VAN QUANG
function buildDynamicVerdict() {
  var ls = DATA.lam_sang_tomtat || {};
  var kl = DATA.ket_luan || {};
  var sc = SCORE;
  var vc = ls.verdict_color || kl.tong_the_color || "amber";
  var vcHex = vc === "green" ? C.green : (vc === "red" ? C.red : C.amber);
  var emoji = vc === "green" ? "✅" : (vc === "red" ? "❌" : "🟡");
  var vLabel = ls.verdict || (sc.total >= 90 ? "Xuất sắc" : sc.total >= 75 ? "Tốt" :
    sc.total >= 60 ? "Chấp nhận được" : sc.total >= 45 ? "Cần cải thiện" : "Có vấn đề nghiêm trọng");
  var lines = [];
  (kl.diem_manh || []).forEach(function(d) { lines.push("✔  " + d); });
  (kl.loi_noi_bat || []).forEach(function(l) { lines.push("⚠  " + l); });
  if (!lines.length) lines = ["Điểm tổng hợp chất lượng hồ sơ: " + sc.total + "/100 — " + sc.classification];
  return verdictBox(emoji + "  MỨC ĐÁNH GIÁ: " + vLabel.toUpperCase() + "  (" + sc.total + "/100 điểm)", vcHex, lines);
}

// ── v4.1: B.2 mở rộng — Dược lâm sàng ──
function mucDoColor(s) {
  if (s === "✅") return C.green; if (s === "⚠️") return C.amber;
  if (s === "❌") return C.red; return C.gray;
}
function buildDieuTriDanhGiaTable() {
  var rows = (DATA.dieu_tri_danh_gia || []).map(function(d) {
    var f = d.muc_do === "✅" ? C.lgreen : (d.muc_do === "❌" ? C.lred : (d.muc_do === "⚠️" ? C.lamber : C.white));
    var lieu = [d.lieu_dung, d.duong, d.nhip, d.thoi_gian].filter(Boolean).join(" · ");
    var dls = [
      d.lieu_chuan ? "Liều chuẩn: " + d.lieu_chuan : "",
      d.chinh_than_gan ? "Chỉnh thận/gan: " + d.chinh_than_gan : "",
      d.chong_chi_dinh ? "CCĐ/thận trọng: " + d.chong_chi_dinh : "",
      d.tuong_tac ? "Tương tác: " + d.tuong_tac : "",
      d.theo_doi ? "Theo dõi: " + d.theo_doi : "",
    ].filter(Boolean).join("\n");
    return [
      { text: (d.muc_do || "") + " " + (d.ten_thuoc || "") + (d.nhom ? "\n(" + d.nhom + ")" : ""), fill: f, bold: true },
      { text: d.chi_dinh_cho || "", fill: C.white },
      { text: lieu, fill: C.white },
      { text: dls, fill: C.white, size: 17 },
      { text: d.nhan_xet || "", fill: f },
    ];
  });
  return tbl(["Thuốc (mức)", "Chỉ định cho", "Liều–đường–nhịp–thời gian", "Dược lâm sàng", "Nhận xét"],
    rows, [2100, 1700, 2000, 2100, CONT_W - 2100 - 1700 - 2000 - 2100]);
}
function buildTuongTacTable() {
  var rows = (DATA.tuong_tac_thuoc || []).map(function(t) {
    var f = t.muc_do === "Nặng" ? C.lred : (t.muc_do === "Trung bình" ? C.lamber : C.lgray);
    return [
      { text: t.cap_thuoc || "", fill: f, bold: true },
      { text: t.muc_do || "", fill: f, color: t.muc_do === "Nặng" ? C.red : C.amber, bold: true },
      { text: t.co_che || "", fill: C.white },
      { text: t.hau_qua || "", fill: C.white },
      { text: t.xu_tri || "", fill: C.white },
    ];
  });
  return tbl(["Cặp thuốc", "Mức độ", "Cơ chế", "Hậu quả", "Xử trí đề nghị"],
    rows, [2200, 1200, 2200, 2200, CONT_W - 2200 - 1200 - 2200 - 2200]);
}
function buildDapUngTable() {
  var rows = (DATA.dap_ung_dieu_tri || []).map(function(r) {
    var f = r.phu_hop === "✅" ? C.lgreen : (r.phu_hop === "❌" ? C.lred : C.lamber);
    return [
      { text: r.moc_tg || "", fill: C.white },
      { text: r.dien_bien || "", fill: C.white },
      { text: r.dap_ung || "", fill: f, bold: true },
      { text: r.dieu_chinh_y_lenh || "", fill: C.white },
      { text: (r.phu_hop || "") + " " + (r.ghi_chu || ""), fill: f },
    ];
  });
  return tbl(["Mốc TG", "Diễn biến LS/CLS", "Đáp ứng", "Điều chỉnh y lệnh", "Đánh giá"],
    rows, [1500, 2400, 1300, 2200, CONT_W - 1500 - 2400 - 1300 - 2200]);
}
function buildThayDoiChanDoanTable() {
  var rows = (DATA.thay_doi_chan_doan || []).map(function(r) {
    var f = r.phu_hop === "✅" ? C.lgreen : (r.phu_hop === "❌" ? C.lred : C.lamber);
    return [
      { text: r.moc || "", fill: C.white },
      { text: (r.tu_cd || "") + "  →  " + (r.sang_cd || ""), fill: f },
      { text: r.ly_do || "", fill: C.white },
      { text: r.cls_bo_sung || "", fill: C.white },
      { text: r.phu_hop || "", fill: f, bold: true },
    ];
  });
  return tbl(["Mốc", "Thay đổi chẩn đoán", "Lý do", "CLS bổ sung", "Hợp lý"],
    rows, [1400, 2700, 2200, 2000, CONT_W - 1400 - 2700 - 2200 - 2000]);
}
// ── v4.1: Bảng kết quả xét nghiệm (giá trị thô) ──
function buildBangXetNghiem() {
  var rows = (DATA.bang_xet_nghiem || []).map(function(x) {
    var co = x.co || "";
    var f = /↑|↓|cao|thấp|Nguy/i.test(co) ? C.lamber : C.white;
    if (/nguy/i.test(co)) f = C.lred;
    return [
      { text: x.ten || "", fill: C.white, bold: true },
      { text: x.gia_tri || "", fill: f },
      { text: x.don_vi || "", fill: C.white },
      { text: x.tham_chieu || "", fill: C.white, color: C.gray },
      { text: co, fill: f, color: /nguy/i.test(co) ? C.red : C.amber, bold: true },
    ];
  });
  return tbl(["Xét nghiệm", "Kết quả", "Đơn vị", "Tham chiếu", "Cờ"],
    rows, [3000, 1900, 1300, 1900, CONT_W - 3000 - 1900 - 1300 - 1900]);
}
// ── v4.1: Bảng diễn biến lâm sàng (data-driven) ──
function buildDienBienTable() {
  var rows = (DATA.dien_bien_lam_sang || []).map(function(r) {
    return [
      { text: r.ngay || "", fill: C.white, bold: true },
      { text: r.dien_bien || "", fill: C.white },
      { text: r.y_lenh || "", fill: C.white },
      { text: r.nhan_xet || "", fill: /✅/.test(r.nhan_xet || "") ? C.lgreen : (/❌/.test(r.nhan_xet || "") ? C.lred : C.white) },
    ];
  });
  return tbl(["Ngày", "Diễn biến", "Y lệnh chính", "Nhận xét"],
    rows, [1000, 3200, 2800, CONT_W - 1000 - 3200 - 2800]);
}

// Khối B.2 mở rộng — trả mảng children (rỗng nếu không có dữ liệu)
function buildB2Extended() {
  var out = [];
  if ((DATA.dieu_tri_danh_gia || []).length) {
    out.push(h2("Đánh giá dược lâm sàng từng thuốc (B.2.1–B.2.2)"));
    out.push(guidelineBox([
      { text: "Rà soát 6 trục mỗi thuốc: liều–đường–nhịp–thời gian · chỉnh liều theo thận/gan · chống chỉ định · tương tác · trùng lặp · theo dõi điều trị. Nguồn: Dược thư QG Việt Nam + phác đồ (xem references/treatment-pharmacy-review.md).", bold: false },
    ]));
    out.push(...spacer(1), buildDieuTriDanhGiaTable(), ...spacer(1));
  }
  if ((DATA.tuong_tac_thuoc || []).length) {
    out.push(h3("Tương tác thuốc–thuốc có ý nghĩa lâm sàng"));
    out.push(buildTuongTacTable(), ...spacer(1));
  }
  if ((DATA.dap_ung_dieu_tri || []).length) {
    out.push(h2("Đáp ứng điều trị theo thời gian (B.2.3)"));
    out.push(buildDapUngTable(), ...spacer(1));
  }
  if ((DATA.thay_doi_chan_doan || []).length) {
    out.push(h2("Thay đổi chẩn đoán & bổ sung CLS khi diễn biến đổi (B.2.4)"));
    out.push(buildThayDoiChanDoanTable(), ...spacer(1));
  }
  var dt = DATA.dieu_tri_tomtat || {};
  if (dt.noi_dung) {
    var col = dt.muc_do === "Phù hợp" ? C.green : (dt.muc_do === "Chưa phù hợp" ? C.red : C.amber);
    var fill = dt.muc_do === "Phù hợp" ? C.lgreen : (dt.muc_do === "Chưa phù hợp" ? C.lred : C.lamber);
    out.push(noticeBox([
      { text: "Kết luận điều trị" + (dt.muc_do ? " — " + dt.muc_do : "") + ": ", bold: true, color: col },
      { text: dt.noi_dung },
    ], fill, col), ...spacer(1));
  }
  return out;
}

// ─────────────────────────────────────────────────────────
// XÂY DỰNG NỘI DUNG BÁO CÁO
// ─────────────────────────────────────────────────────────

// ── Icon color helper ──
function iconColor(icon) {
  if (icon === "✅") return C.green;
  if (icon === "⚠️") return C.amber;
  if (icon === "❌") return C.red;
  return C.black;
}

function danh_gia_color(s) {
  if (!s) return C.black;
  var sl = s.toLowerCase();
  if (sl.indexOf("ủng hộ") >= 0 && sl.indexOf("không") < 0) return C.green;
  if (sl.indexOf("không ủng hộ") >= 0) return C.red;
  if (sl.indexOf("xác nhận") >= 0) return C.green;
  if (sl.indexOf("phù hợp") >= 0) return C.green;
  if (sl.indexOf("củng cố") >= 0) return C.green;
  if (sl.indexOf("trung bình") >= 0) return C.amber;
  return C.black;
}

// ── A.1 Bảng biểu mẫu ──
function buildBieuMauTable() {
  return tbl(
    ["STT", "Biểu mẫu", "Kết quả kiểm tra"],
    DATA.bieu_mau.map(function(r) {
      var ic = r.icon === "✅" ? C.lgreen : r.icon === "⚠️" ? C.lamber : C.lred;
      var tc = r.icon === "✅" ? C.green  : r.icon === "⚠️" ? C.amber  : C.red;
      return [
        { text: r.stt,      fill: ic },
        { text: r.ten,      fill: ic },
        { text: r.icon + "  " + r.ket_qua, color: tc, fill: ic },
      ];
    }),
    [700, 3100, CONT_W - 700 - 3100]
  );
}

// ── A.2 Timeline table ──
function buildTimelineTable() {
  return tbl(
    ["Thời điểm", "Sự kiện", "Nhận xét"],
    DATA.timeline.map(function(r, i) {
      return [
        { text: r.tg,         fill: i % 2 === 0 ? "F4F8FC" : C.white },
        { text: r.su_kien,    fill: i % 2 === 0 ? "F4F8FC" : C.white },
        { text: r.nhan_xet,   fill: i % 2 === 0 ? "F4F8FC" : C.white },
      ];
    }),
    [2200, 4700, CONT_W - 2200 - 4700]
  );
}

// ── A.3 ICD cảnh báo ──
function buildIcdCanhBaoTable() {
  return tbl(
    ["Mã ICD ghi trong hồ sơ", "Tên chẩn đoán", "Vị trí sử dụng", "Cảnh báo sơ bộ"],
    DATA.icd_canh_bao.map(function(r) {
      var ok = r.canh_bao.indexOf("Phù hợp") >= 0;
      var cl = ok ? C.lgreen : C.lred;
      var tc = ok ? C.green  : C.red;
      return [
        { text: r.ma,        fill: cl, bold: true, color: tc },
        { text: r.ten,       fill: cl },
        { text: r.vi_tri,    fill: cl },
        { text: r.canh_bao,  fill: cl, color: tc },
      ];
    }),
    [1400, 2800, 2100, CONT_W - 1400 - 2800 - 2100]
  );
}

// ── B.1 Tiêu chí UAP ──
function buildUAPTable() {
  return tbl(
    ["Tiêu chí chẩn đoán", "Yêu cầu", "Kết quả trong hồ sơ", "Đánh giá"],
    DATA.tieu_chi_uap.map(function(r) {
      var fill = r.icon === "✅" ? C.lgreen : r.icon === "❌" ? C.lred : C.lamber;
      var tc   = r.icon === "✅" ? C.green  : r.icon === "❌" ? C.red  : C.amber;
      return [
        { text: r.tieu_chi,  fill: fill },
        { text: r.yeu_cau,   fill: fill },
        { text: r.ket_qua,   fill: fill },
        { text: r.icon + "  " + r.danh_gia, color: tc, bold: true, fill: fill },
      ];
    }),
    [2000, 2200, 3000, 2300]
  );
}

// ── B.1 Tiêu chí Kali ──
function buildKaliTable() {
  return tbl(
    ["Tiêu chí", "Nội dung", "Đánh giá"],
    DATA.tieu_chi_kali.map(function(r) {
      return [
        { text: r.tieu_chi, fill: C.lgreen },
        { text: r.noi_dung, fill: C.lgreen },
        { text: r.icon + "  " + r.danh_gia, color: C.green, bold: true, fill: C.lgreen },
      ];
    }),
    [2200, 5300, CONT_W - 2200 - 5300]
  );
}

// ── B.1 Phát hiện phụ ──
function buildPhatHienPhuTable() {
  return tbl(
    ["Phát hiện", "Giá trị", "Tiêu chuẩn tham chiếu", "Vấn đề cần xử lý"],
    DATA.phat_hien_phu.map(function(r) {
      return [
        { text: r.phat_hien, fill: C.lamber },
        { text: r.gia_tri,   fill: C.lamber },
        { text: r.tieu_chuan, fill: C.lamber },
        { text: r.van_de,    fill: C.lred, color: C.red },
      ];
    }),
    [1800, 2200, 2800, CONT_W - 1800 - 2200 - 2800]
  );
}

// ── B.2 Điều trị kali ──
function buildDieuTriKaliTable() {
  return tbl(
    ["Thời điểm", "Y lệnh Kali", "K⁺ đo được", "Đánh giá theo hướng dẫn"],
    DATA.dieu_tri_kali.map(function(r, i) {
      return [
        { text: r.tg,       fill: i % 2 === 0 ? "F4F8FC" : C.white },
        { text: r.y_lenh,   fill: i % 2 === 0 ? "F4F8FC" : C.white },
        { text: r.k,        fill: i % 2 === 0 ? "F4F8FC" : C.white },
        { text: r.danh_gia, fill: i % 2 === 0 ? "F4F8FC" : C.white, color: r.danh_gia.indexOf("✅") >= 0 ? C.green : C.black },
      ];
    }),
    [2200, 3200, 1800, CONT_W - 2200 - 3200 - 1800]
  );
}

// ── B.3 CLS đủ ──
function buildClsDuTable() {
  return tbl(
    ["Xét nghiệm / CLS", "Kết quả chính", "Vai trò lâm sàng", "Đánh giá"],
    DATA.cls_du.map(function(r) {
      var ok  = r.danh_gia.indexOf("✅") >= 0;
      var warn = r.danh_gia.indexOf("⚠️") >= 0;
      var fill = ok ? C.lgreen : warn ? C.lamber : C.lgray;
      var tc   = ok ? C.green  : warn ? C.amber  : C.gray;
      return [
        { text: r.cls,       fill: fill },
        { text: r.ket_qua,   fill: fill },
        { text: r.vai_tro,   fill: fill },
        { text: r.danh_gia,  fill: fill, color: tc, bold: true },
      ];
    }),
    [2000, 2800, 2600, CONT_W - 2000 - 2800 - 2600]
  );
}

// ── B.3 CLS không chỉ định ──
function buildClsKhongCDTable() {
  return tbl(
    ["Xét nghiệm", "Kết quả", "Nhận xét"],
    DATA.cls_khong_chi_dinh.map(function(r) {
      return [
        { text: r.cls,     fill: C.lamber },
        { text: r.ket_qua, fill: C.lamber },
        { text: r.nhan_xet, fill: C.lamber, color: C.amber },
      ];
    }),
    [2600, 2800, CONT_W - 2600 - 2800]
  );
}

// ── B.3 CLS thiếu ──
function buildClsThieuTable() {
  return tbl(
    ["CLS cần bổ sung", "Lý do cần thiết", "Cơ sở hướng dẫn", "Mức độ ưu tiên"],
    DATA.cls_thieu.map(function(r) {
      var high = r.uu_tien.indexOf("Cao") >= 0;
      return [
        { text: r.cls,    fill: high ? C.lred   : C.lamber },
        { text: r.ly_do,  fill: high ? C.lred   : C.lamber },
        { text: r.co_so,  fill: high ? C.lred   : C.lamber },
        { text: r.uu_tien, fill: high ? C.lred  : C.lamber, color: high ? C.red : C.amber, bold: true },
      ];
    }),
    [2200, 3600, 2200, CONT_W - 2200 - 3600 - 2200]
  );
}

// ── B.5 ICD chi tiết ──
function buildIcdChiTietTable() {
  return tbl(
    ["Thời điểm", "Mã đang dùng", "Lý do SAI", "Mã đúng phải dùng"],
    DATA.icd_chi_tiet.map(function(r) {
      return [
        { text: r.tg },
        { text: r.ma_dung,    fill: C.lred,   color: C.red,   bold: true },
        { text: r.ly_do_sai,  fill: C.lred },
        { text: r.ma_dung_can + " — " + r.ten_ma_dung, fill: C.lgreen, color: C.green, bold: true },
      ];
    }),
    [1800, 1800, 4200, CONT_W - 1800 - 1800 - 4200]
  );
}

// ── 8 câu hỏi ──
function build8CauHoiTable() {
  return tbl(
    ["Câu hỏi đánh giá", "Trả lời", "Kết quả"],
    DATA.tam_cau_hoi.map(function(r) {
      var tc = COLR[r.color] || C.black;
      return [
        { text: r.cau },
        { text: r.tra_loi },
        { text: r.ket_qua, color: tc, bold: true },
      ];
    }),
    [3100, 5300, CONT_W - 3100 - 5300]
  );
}

// ── Khuyến nghị ──
function buildKhuyenNghiTable() {
  return tbl(
    ["Ưu tiên", "Nội dung khuyến nghị", "Cơ sở hướng dẫn", "Đơn vị thực hiện"],
    DATA.khuyen_nghi.map(function(r) {
      var high = r.uu_tien.indexOf("Cao") >= 0;
      var med  = r.uu_tien.indexOf("Trung bình") >= 0;
      var fill = high ? C.lred : med ? C.lamber : C.lgreen;
      var tc   = high ? C.red  : med ? C.amber  : C.green;
      return [
        { text: r.uu_tien,  fill: fill, color: tc, bold: true },
        { text: r.noi_dung, fill: fill },
        { text: r.co_so,    fill: fill },
        { text: r.don_vi,   fill: fill },
      ];
    }),
    [1600, 4000, 2400, CONT_W - 1600 - 4000 - 2400]
  );
}

// ─────────────────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────────────────
// Tính điểm 100 một lần — dùng trong overview table VÀ BẢNG KIỂM cuối
var SCORE = computeScore100();

var doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: C.navy },
        paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: C.blue },
        paragraph: { spacing: { before: 220, after: 90 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 21, bold: true, font: "Arial", color: C.navy },
        paragraph: { spacing: { before: 160, after: 70 }, outlineLevel: 2 } },
    ]
  },
  numbering: { config: [
    { reference: "bul1", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
  ]},
  sections: [{
    properties: {
      page: {
        size:   { width: PAGE_W, height: 16838 },
        margin: { top: MARGIN, bottom: MARGIN + 200, left: MARGIN, right: MARGIN },
      }
    },
    headers: {
      default: new Header({ children: [
        new Table({
          width: { size: CONT_W, type: WidthType.DXA },
          columnWidths: [Math.floor(CONT_W * 0.65), Math.floor(CONT_W * 0.35)],
          rows: [new TableRow({ children: [
            cell([para([txt("ĐÁNH GIÁ CHẤT LƯỢNG HỒ SƠ BỆNH ÁN — " + DATA.ho_ten, { bold: true, size: 17, color: C.navy })], { after: 0 })],
              Math.floor(CONT_W * 0.65), { fill: C.lgray, bc: C.lgray }),
            cell([para([txt("Mã BN: " + DATA.ma_bn + "  |  " + DATA.so_vao_vien, { size: 16, color: C.gray })], { after: 0, align: AlignmentType.RIGHT })],
              Math.floor(CONT_W * 0.35), { fill: C.lgray, bc: C.lgray }),
          ]})]
        })
      ]})
    },
    footers: {
      default: new Footer({ children: [
        para([txt("Trung tâm Y tế Thủy Nguyên — Đánh giá chất lượng HSBA — " + DATA.ngay_danh_gia, { size: 16, color: C.gray, italic: true })],
          { align: AlignmentType.CENTER, after: 0 })
      ]})
    },

    children: [

      // ─── TRANG TIÊU ĐỀ ───
      new Table({
        width: { size: CONT_W, type: WidthType.DXA },
        columnWidths: [Math.floor(CONT_W * 0.62), Math.floor(CONT_W * 0.38)],
        rows: [new TableRow({ children: [
          cell([
            para([txt("ĐÁNH GIÁ CHẤT LƯỢNG HỒ SƠ BỆNH ÁN", { bold: true, size: 30, color: C.white })], { after: 60 }),
            para([txt("Bệnh án Nội khoa — Nội trú", { size: 20, color: "BDC3E7" })], { after: 0 }),
          ], Math.floor(CONT_W * 0.62), { fill: C.navy, bc: C.navy }),
          cell([
            para([txt("Mã BN:", { bold: true, size: 18, color: C.white })], { after: 20 }),
            para([txt(DATA.ma_bn, { size: 20, color: "AED6F1" })], { after: 30 }),
            para([txt("Số vào viện:", { bold: true, size: 18, color: C.white })], { after: 20 }),
            para([txt(DATA.so_vao_vien, { size: 20, color: "AED6F1" })], { after: 0 }),
          ], Math.floor(CONT_W * 0.38), { fill: "1A5276", bc: "1A5276" }),
        ]})]
      }),
      ...spacer(1),

      // Bảng thông tin hành chính
      tbl(["Trường thông tin", "Nội dung"], [
        [{ text: "Họ tên bệnh nhân" },     { text: DATA.ho_ten }],
        [{ text: "Giới / Tuổi" },           { text: DATA.gioi_tuoi }],
        [{ text: "Địa chỉ" },              { text: DATA.dia_chi }],
        [{ text: "Cơ sở điều trị" },       { text: DATA.co_so }],
        [{ text: "Khoa / Phòng / Giường" }, { text: DATA.khoa_phong }],
        [{ text: "Nhập viện" },             { text: DATA.nhap_vien }],
        [{ text: "Xuất viện" },             { text: DATA.xuat_vien }],
        [{ text: "Tổng số ngày điều trị" }, { text: DATA.so_ngay }],
        [{ text: "Bảo hiểm y tế" },        { text: DATA.bao_hiem }],
        [{ text: "Bác sĩ điều trị" },      { text: DATA.bac_si }],
        [{ text: "Chế độ đánh giá" },      { text: DATA.che_do }],
        [{ text: "Cơ sở đánh giá" },       { text: DATA.co_so_danh_gia }],
        [{ text: "Điểm chất lượng HSBA", bold: true, color: SCORE.classColor },
         { text: SCORE.total + " / 100 điểm", bold: true, color: SCORE.classColor }],
        [{ text: "Phân loại hồ sơ", bold: true, color: SCORE.classColor },
         { text: SCORE.classification, bold: true, color: SCORE.classColor }],
      ], [3200, CONT_W - 3200]),
      ...spacer(2),

      // ═══════════════════════════════════════════════════════
      // PHẦN B — trước PHẦN A (theo yêu cầu)
      // ═══════════════════════════════════════════════════════
      sectionBanner("PHẦN B — ĐÁNH GIÁ LÂM SÀNG"),
      ...spacer(1),

      // B.0 — Cơ sở bằng chứng đối chiếu
      reasoningBoundaryBox(),
      ...spacer(1),
      h1("B.0  Cơ sở Bằng chứng Đối chiếu"),
      para([txt("Các nhận định lâm sàng dưới đây được đối chiếu với nguồn đã kiểm chứng (Bộ Y tế, hiệp hội chuyên ngành, y văn, danh mục ICD-10 BYT). Truy vấn ngoài chỉ dùng khái niệm bệnh ẩn danh — không chứa thông tin định danh người bệnh.", { size: 19, color: C.gray, italic: true })], { after: 80 }),
      buildEvidenceGroundingTable(),
      ...(buildDeptCoverageNote() ? [...spacer(1), buildDeptCoverageNote()] : []),
      ...spacer(1),

      // B.narrative — Tóm tắt nhận xét lâm sàng (hộp xám, in nghiêng — dynamic)
      h1("Tóm tắt Nhận xét Lâm sàng"),
      ...buildSectionBNarrative(),

      // B.1 — Đánh giá Chẩn đoán (dynamic)
      h1("B.1  Đánh giá Chẩn đoán"),
      ...buildB1Dynamic(),

      // B.2 — Đánh giá Điều trị
      h1("B.2  Đánh giá Điều trị"),
      ...buildB2Extended(),

      // B.3
      h1("B.3  Đánh giá Cận lâm sàng"),
      ...((DATA.bang_xet_nghiem || []).length ? [
        h2("Kết quả xét nghiệm (giá trị)"),
        buildBangXetNghiem(),
        ...spacer(1),
      ] : []),
      h2("Cận lâm sàng thiết yếu — Đầy đủ"),
      buildClsDuTable(),
      ...spacer(1),
      h2("Cận lâm sàng không có chỉ định rõ ràng"),
      buildClsKhongCDTable(),
      ...spacer(1),
      h2("Cận lâm sàng còn thiếu — Quan trọng"),
      buildClsThieuTable(),
      ...spacer(1),

      // B.4
      h1("B.4  Đánh giá Diễn biến Lâm sàng"),
      buildDienBienTable(),
      ...spacer(1),

      // B.5 — ICD (dynamic)
      h1("B.5  Đánh giá Mã ICD — Phân tích chi tiết"),
      ...buildB5Dynamic(),

      ...spacer(2),

      // ═══════════════════════════════════════════════════════
      // PHẦN A — sau PHẦN B
      // ═══════════════════════════════════════════════════════
      sectionBanner("PHẦN A — KIỂM TRA HÌNH THỨC HỒ SƠ"),
      ...spacer(1),

      h1("A.1  Kiểm tra đủ biểu mẫu"),
      buildBieuMauTable(),
      ...spacer(1),

      h3("Tóm tắt thiếu sót hình thức"),
      tbl(
        ["Mức độ", "Nội dung thiếu sót", "Trang liên quan"],
        DATA.thieu_sot.map(function(r) {
          var fill = r.muc_do === "Cần bổ sung" ? C.lamber : C.lgray;
          var tc   = r.muc_do === "Cần bổ sung" ? C.amber  : C.gray;
          return [
            { text: r.muc_do, fill: fill, color: tc, bold: true },
            { text: r.noi_dung, fill: fill },
            { text: r.trang,   fill: fill },
          ];
        }),
        [2200, 5400, CONT_W - 2200 - 5400]
      ),
      ...spacer(1),

      // Ghi chú quy tắc đã bỏ qua
      ...(DATA._suppressed_rules && DATA._suppressed_rules.length > 0 ? [
        h3('Quy tắc bỏ qua theo cấu hình TTYT (' + DATA._audit_config_hospital + ')'),
        tbl(
          ['Quy tắc', 'Lý do bỏ qua'],
          DATA._suppressed_rules.map(function(r) {
            return [
              { text: r.description, fill: C.lgray },
              { text: r.reason,      fill: C.lgray },
            ];
          }),
          [3500, CONT_W - 3500],
          { hf: C.gray }
        ),
        ...spacer(1),
      ] : []),

      h1("A.2  Kiểm tra Trình tự Thời gian"),
      buildTimelineTable(),
      ...spacer(1),
      noticeBox([
        { text: "Kết luận: ", bold: true, color: C.green },
        { text: "Tổng " + (DATA.timeline_raw || DATA.timeline || []).length + " mốc thời gian kiểm tra. " +
          ((DATA.timeline || []).some(function(t) { return (t.nhan_xet || "").indexOf("⚠") >= 0; })
            ? "Phát hiện một số bất thường — xem chi tiết bảng trên."
            : "Không phát hiện xung đột thời gian. Trình tự hợp lệ và logic nhất quán.") },
      ], C.lgreen, C.green),
      ...spacer(1),

      h1("A.3  Kiểm tra Mã ICD — Cảnh báo ban đầu"),
      buildIcdCanhBaoTable(),
      ...spacer(2),

      // ═══════════════════════════════════════════════════════
      // TỔNG HỢP
      // ═══════════════════════════════════════════════════════
      sectionBanner("TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ"),
      ...spacer(1),

      h1("Trả lời 8 câu hỏi cốt lõi"),
      build8CauHoiTable(),
      ...spacer(1),

      buildDynamicVerdict(),
      ...spacer(1),

      h1("Khuyến nghị Hành động"),
      buildKhuyenNghiTable(),
      ...spacer(2),

      // ═══════════════════════════════════════════════════════
      // BẢNG KIỂM 100 ĐIỂM
      // ═══════════════════════════════════════════════════════
      sectionBanner("BẢNG KIỂM CHẤM ĐIỂM CHẤT LƯỢNG HỒ SƠ (100 ĐIỂM)"),
      ...spacer(1),
      buildBangKiem100Table(),
      ...spacer(2),

      // ═══════════════════════════════════════════════════════
      // TÀI LIỆU THAM KHẢO
      // ═══════════════════════════════════════════════════════
      sectionBanner("DANH MỤC TÀI LIỆU THAM KHẢO"),
      ...spacer(1),
      para([txt("Trích dẫn theo thứ tự xuất hiện — Định dạng Vancouver", { italic: true, size: 18, color: C.gray })], { after: 100 }),

    ].concat(DATA.tai_lieu.map(function(r) {
      return new Paragraph({
        spacing: { before: 60, after: 100 },
        indent:  { left: 540, hanging: 540 },
        children: [txt(r.n + " ", { bold: true, size: 20, color: C.navy })].concat(
          r.parts.map(function(s) {
            return txt(s.t, { bold: s.b || false, italic: s.i || false, size: 20 });
          })
        )
      });
    })),

  }]
});

// ─────────────────────────────────────────────────────────
// XUẤT FILE
// Naming convention: {ma_bn} - {TEN_KHONG_DAU}
// ─────────────────────────────────────────────────────────
// BASE_OUT: tự phát hiện đường dẫn đúng — hoạt động cả trên macOS (user) và Linux sandbox (bash)
// ── v4.2: Tài liệu tham khảo — luôn có baseline + bổ sung từ evidence_grounding ──
(function autoReferences() {
  if (DATA.tai_lieu && DATA.tai_lieu.length) return; // subagent đã điền → giữ nguyên

  // 1. Sinh từ evidence_grounding (nếu có)
  var list = [];
  if (DATA.evidence_grounding && DATA.evidence_grounding.length) {
    var seen = {}, n = 0;
    DATA.evidence_grounding.forEach(function(e) {
      (e.citations || [e]).forEach(function(c) {
        var src = c.source || e.source; if (!src) return;
        var id = (c.identifier || e.identifier || {});
        var key = (id.value || src);
        if (seen[key]) return; seen[key] = true; n++;
        var idText = id.type === "doi" ? (" doi:" + id.value) : (id.value ? (" " + (id.type || "") + ":" + id.value) : "");
        list.push({ n: "[" + n + "]", parts: [{ t: src + "." }, { t: idText, i: true }] });
      });
    });
  }

  // 2. Tài liệu nền tảng — luôn thêm vào cuối (pháp quy chuẩn)
  var offset = list.length;
  var baseline = [
    { parts: [
      { t: "Bộ Y tế. " },
      { t: "Thông tư 32/2023/TT-BYT quy định về mẫu hồ sơ bệnh án.", b: true },
      { t: " Hà Nội; 2023." },
    ]},
    { parts: [
      { t: "Bộ Y tế. " },
      { t: "Hướng dẫn sử dụng ICD-10 trong các cơ sở khám bệnh, chữa bệnh.", b: true },
      { t: " Ban hành kèm QĐ 4469/QĐ-BYT. Hà Nội; 2012 (cập nhật 2019)." },
    ]},
    { parts: [
      { t: "Bộ Y tế. " },
      { t: "Quy chế bệnh viện.", b: true },
      { t: " Ban hành kèm QĐ 1895/1997/QĐ-BYT. Hà Nội; 1997." },
    ]},
  ];
  baseline.forEach(function(b, i) {
    list.push({ n: "[" + (offset + i + 1) + "]", parts: b.parts });
  });

  DATA.tai_lieu = list;
})();

var BASE_OUT = (function() {
    var fs = require("fs");
    // Thử macOS path trước (khi chạy trực tiếp trên máy user)
    var macPath = "/Users/buiminhkhoi/Documents/Claude/KHTH/KHTH - P4 HSBA/output";
    if (fs.existsSync(macPath)) return macPath;
    // Fallback: tìm trong bash sandbox (/sessions/<name>/mnt/KHTH/KHTH - P4 HSBA/output)
    try {
        var sessions = fs.readdirSync("/sessions");
        for (var i = 0; i < sessions.length; i++) {
            var p = "/sessions/" + sessions[i] + "/mnt/KHTH/KHTH - P4 HSBA/output";
            if (fs.existsSync(p)) return p;
        }
    } catch(e) {}
    // Last resort: tạo tại macOS path (mkdir -p sẽ tự tạo)
    return macPath;
}());
var FILE_STEM   = DATA.ma_bn + " - " + DATA.ten_khong_dau;
var DOCX_PATH   = BASE_OUT + "/word/" + FILE_STEM + ".docx";
var JSON_PATH   = BASE_OUT + "/json/" + FILE_STEM + ".json";
var MASTER_PATH = BASE_OUT + "/tong-hop/master.json";
var TODAY       = new Date().toISOString().slice(0, 10);   // "2026-05-25"

// ─────────────────────────────────────────────────────────
// RAW JSON — NGUỒN DỮ LIỆU KHÁCH QUAN (v3.0)
// ─────────────────────────────────────────────────────────
// Nguyên lý: JSON chỉ chứa dữ liệu RAW từ PDF — không có nhận định AI.
// Bất kỳ AI agent nào đọc file này đều nhận được thông tin khách quan,
// không bị "contaminate" bởi conclusions của AI trước.
//
// AI analysis (icd_summary, lam_sang, ket_luan, khuyen_nghi) CHỈ xuất hiện
// trong DOCX — KHÔNG ghi vào JSON.
// ─────────────────────────────────────────────────────────
var rawJsonData = {
  // 1. Schema + lineage
  schema_version: "v4.0-backbone",   // meta giàu (ma_kcb...) + GIỮ separation (AI analysis chỉ ở DOCX)
  lineage: {
    workflow:              "hsba-audit-skill",
    schema_note:           "v4.0-backbone (clean): meta đầy đủ + raw extraction; AI analysis ở DOCX, KHÔNG nhét section_b vào JSON",
    extracted_at:          TODAY,
    source_file:           FILE_STEM + ".PDF",
    json_path:             JSON_PATH,
    docx_path:             DOCX_PATH,
    docx_generated_at:     TODAY,
  },

  // 2. Metadata hành chính (factual) — META GIÀU (chuẩn v4.0-backbone, giữ separation)
  // ma_kcb là khóa chính; ma_bn giữ làm alias để tương thích ngược.
  meta: {
    ma_kcb:               DATA.ma_kcb          || DATA.ma_bn,
    ma_bn:                DATA.ma_bn,                                  // alias tương thích ngược
    ten_khong_dau:        DATA.ten_khong_dau,
    ho_ten:               DATA.ho_ten,
    gioi:                 DATA.gioi,
    nam_sinh:             DATA.nam_sinh,
    dia_chi:              DATA.dia_chi         || "",
    so_vao_vien:          DATA.so_vao_vien     || "",
    so_ho_so:             DATA.so_ho_so        || DATA.ma_bn,
    bhyt:                 DATA.bhyt            || DATA.bao_hiem || "",
    cccd:                 DATA.cccd            || "",
    ngay_vao:             DATA.ngay_vao        || (DATA.nhap_vien || "").split("–")[0].trim().split(" ")[0],
    ngay_ra:              DATA.ngay_ra         || (DATA.xuat_vien || "").split("–")[0].trim().split(" ")[0],
    so_ngay:              DATA.so_ngay         || "",
    khoa:                 DATA.khoa            || DATA.khoa_vao_vien || DATA.khoa_phong || "",
    phong:                DATA.phong           || "",
    giuong:               DATA.giuong          || "",
    bac_si_dieu_tri:      DATA.bac_si_dieu_tri || DATA.bac_si || "",
    truong_khoa:          DATA.truong_khoa     || "",
    hinh_thuc_ra_vien:    DATA.hinh_thuc_ra_vien,
    khoa_vao_vien:        DATA.khoa_vao_vien,
    khoa_ra_vien:         DATA.khoa_ra_vien,
    cac_khoa_dieu_tri:    DATA.cac_khoa_dieu_tri,
    phau_thuat:           DATA.phau_thuat,
    ba_loai:              DATA.ba_loai         || "noi_khoa",
    ma_bieu_mau:          DATA.ma_bieu_mau     || "01/BV-01",
    co_so:                DATA.co_so           || "Trung tâm Y tế Thủy Nguyên – Sở Y tế Hải Phòng",
    ngay_trich_xuat_json: TODAY,
  },

  // 3. Phần làm bệnh án khi nhập viện — TOÀN VĂN + structured từ hồ sơ (factual)
  // Chỉ chứa những gì BÁC SĨ GHI trong hồ sơ, không có AI nhận định
  admission_workup: {
    source_page:          DATA.admission_workup.source_page,
    raw_text:             DATA.admission_workup.raw_text,           // Toàn văn nguyên xi từ PDF
    ly_do_vao_vien:       DATA.admission_workup.ly_do_vao_vien,
    vao_ngay_thu_benh:    DATA.admission_workup.vao_ngay_thu_benh,
    qua_trinh_benh_ly:    DATA.admission_workup.qua_trinh_benh_ly,
    tien_su_ban_than:     DATA.admission_workup.tien_su_ban_than,
    tien_su_gia_dinh:     DATA.admission_workup.tien_su_gia_dinh,
    dac_diem_lien_quan:   DATA.admission_workup.dac_diem_lien_quan,
    dau_hieu_sinh_ton:    DATA.admission_workup.dau_hieu_sinh_ton,  // Factual: số đo từ hồ sơ
    kham_toan_than:       DATA.admission_workup.kham_toan_than,
    kham_co_quan:         DATA.admission_workup.kham_co_quan,
    cls_can_lam:          DATA.admission_workup.cls_can_lam,
    tom_tat_benh_an:      DATA.admission_workup.tom_tat_benh_an,
    chan_doan_vao_khoa:   DATA.admission_workup.chan_doan_vao_khoa, // Chẩn đoán ghi trong hồ sơ
    tien_luong:           DATA.admission_workup.tien_luong,
    huong_dieu_tri:       DATA.admission_workup.huong_dieu_tri,
    bac_si_lam_ba:        DATA.admission_workup.bac_si_lam_ba,
    ngay_lam_ba:          DATA.admission_workup.ngay_lam_ba,
  },

  // 4. Tổng kết bệnh án — TOÀN VĂN + structured từ hồ sơ (factual)
  // Bao gồm chẩn đoán + ICD được ghi trong hồ sơ (không phải AI đánh giá đúng/sai)
  discharge_summary: {
    source_page:              DATA.discharge_summary.source_page,
    raw_text:                 DATA.discharge_summary.raw_text,      // Toàn văn nguyên xi từ PDF
    qua_trinh_va_dien_bien:   DATA.discharge_summary.qua_trinh_va_dien_bien,
    tom_tat_cls_co_gia_tri:   DATA.discharge_summary.tom_tat_cls_co_gia_tri,
    phuong_phap_dieu_tri:     DATA.discharge_summary.phuong_phap_dieu_tri,
    tinh_trang_ra_vien:       DATA.discharge_summary.tinh_trang_ra_vien,
    huong_sau_ra_vien:        DATA.discharge_summary.huong_sau_ra_vien,
    chan_doan_ra_vien:        DATA.discharge_summary.chan_doan_ra_vien, // ICD ghi trong hồ sơ
    bac_si_ky:                DATA.discharge_summary.bac_si_ky,
    ngay_tong_ket:            DATA.discharge_summary.ngay_tong_ket,
  },

  // 5. Dữ liệu theo từng khoa điều trị (raw)
  // clinical_course_raw, lab_results, medications = factual từ hồ sơ
  department_stays: DATA.department_stays.map(function(dept) {
    return {
      department:           dept.department,
      start_date:           dept.start_date,
      end_date:             dept.end_date,
      source_pages:         dept.source_pages,
      diagnoses:            dept.diagnoses,          // Chẩn đoán ghi trong hồ sơ tại khoa
      clinical_course_raw:  dept.clinical_course_raw, // Text nguyên văn từ phiếu theo dõi
      medications:          dept.medications,         // Y lệnh thuốc thực tế từ hồ sơ
      labs_ordered:         dept.labs_ordered   || [],
      lab_results:          dept.lab_results,         // Kết quả XN thực tế từ phiếu
      imaging_results:      dept.imaging_results,     // Kết quả CLS thực tế từ phiếu
      procedures:           dept.procedures     || [],
      doctor_notes_raw:     dept.doctor_notes_raw,    // Ghi chú BS nguyên văn
      nursing_notes_raw:    dept.nursing_notes_raw,   // Ghi chú điều dưỡng nguyên văn
      consultations:        dept.consultations  || [],
      transfer_out:         dept.transfer_out,
    };
  }),

  // 6. Timeline sự kiện thực tế từ hồ sơ (factual — không có AI commentary)
  // Nguồn: clinical_course_raw, y lệnh, kết quả XN
  timeline_raw: DATA.timeline_raw || [],

  // 7. Mã ICD được ghi trong hồ sơ (factual — không có AI evaluation đúng/sai)
  icd_codes_in_record: DATA.icd_codes_in_record || [],

  // 7b. Chất lượng mã ICD — structured summary (đếm số + phân loại lỗi)
  // Dùng cho báo cáo tổng hợp chất lượng mã toàn trung tâm (tong-hop-skill §II-bis).
  // KHÁC icd_summary (prose) ở DOCX: đây là cấu trúc đếm được, không phải văn xuôi AI.
  // null/{} nếu HSBA chưa phân tích ICD → tong-hop tự bỏ qua phần này.
  icd: DATA.icd || null,

  // 7c. Evidence grounding (v3.7) — bằng chứng đối chiếu ĐÃ VERIFY (factual, khách quan).
  // Đây KHÔNG phải kết luận AI về BN, mà là danh mục nguồn + trạng thái kiểm chứng
  // → hợp nguyên tắc separation, ghi vào JSON để tong-hop/AI sau tái sử dụng.
  evidence_grounding: DATA.evidence_grounding || [],
  reasoning_boundary:  DATA.reasoning_boundary || null,

  // 8. Kiểm tra biểu mẫu (factual — có/thiếu theo TT 32/2023)
  bieu_mau: {
    tong:        DATA.bieu_mau.length,
    dat:         DATA.bieu_mau.filter(function(b){ return b.icon === "✅"; }).length,
    can_bo_sung: DATA.bieu_mau.filter(function(b){ return b.icon === "⚠️"; }).length,
    thieu:       DATA.bieu_mau.filter(function(b){ return b.icon === "❌"; }).length,
    chi_tiet:    DATA.bieu_mau,
    thieu_sot:   DATA.thieu_sot || [],
  },

  // 9. Evidence map (truy vết nguồn từng field về trang PDF)
  evidence_map: DATA.evidence_map || [],

  // 10. Coverage audit (trạng thái phủ tầm dữ liệu theo từng khoa — factual)
  // AI agent đọc JSON này biết khoa nào đã đủ data, khoa nào thiếu và lý do
  coverage_audit: DATA.coverage_audit || {
    departments_found: [], per_department: [],
    scan_pages_not_processed: [], overall_completeness_pct: 0, ready_for_analysis: false,
  },

  // 11. Quy tắc kiểm tra đã bỏ qua (factual — từ audit-config.json của TTYT)
  // AI agent đọc JSON này biết rule nào đã bị bỏ qua để không bắt lại
  audit_config: {
    version:          DATA._audit_config_version || null,
    hospital:         DATA._audit_config_hospital || null,
    suppressed_rules: DATA._suppressed_rules || [],
  },

  // ─── KHÔNG GHI VÀO JSON (chỉ dùng để generate DOCX) ───────────────────
  // Các trường dưới đây là KẾT QUẢ SUY LUẬN AI — KHÔNG được serialize vào JSON
  // để tránh contaminate AI agent đọc sau:
  //   × icd_summary.danh_gia, icd_canh_bao, icd_chi_tiet   → DOCX B.5
  //   × lam_sang_tomtat, tieu_chi_uap, tieu_chi_kali         → DOCX B.1
  //   × phat_hien_phu, dieu_tri_kali, cls_du/thieu/khong     → DOCX B.2-B.3
  //   × ket_luan, tam_cau_hoi                                 → DOCX Tổng hợp
  //   × khuyen_nghi                                           → DOCX Khuyến nghị
  //   × timeline[].nhan_xet (AI commentary về timeline)       → DOCX A.2
  // ───────────────────────────────────────────────────────────────────────
};

// ── Bản ghi master registry (ghi vào tong-hop/master.json) ──
var masterRecord = {
  ma_kcb:                 DATA.ma_bn,
  ten_khong_dau:          DATA.ten_khong_dau,
  ho_ten:                 DATA.ho_ten,
  gioi:                   DATA.gioi,
  nam_sinh:               DATA.nam_sinh,
  ngay_vao_vien:          DATA.ngay_vao || (DATA.nhap_vien || "").split("–")[0].trim().split(" ")[0],
  ngay_ra_vien:           DATA.ngay_ra  || (DATA.xuat_vien || "").split("–")[0].trim().split(" ")[0],
  hinh_thuc_ra_vien:      DATA.hinh_thuc_ra_vien,
  khoa_vao_vien:          DATA.khoa_vao_vien,
  khoa_ra_vien:           DATA.khoa_ra_vien,
  phau_thuat:             DATA.phau_thuat,
  cac_khoa_dieu_tri:      DATA.cac_khoa_dieu_tri,
  ba_loai:                DATA.ba_loai     || "noi_khoa",
  ngay_trich_xuat_json:   TODAY,
  ngay_danh_gia:          DATA.ngay_danh_gia || TODAY,
  trang_thai_danh_gia:    "hoan_thanh",    // "hoan_thanh" | "cho_review" | "loi"
  muc_do_hoan_chinh:      (DATA.coverage_audit || {}).overall_completeness_pct || 0,
  json_path:              JSON_PATH,
  docx_path:              DOCX_PATH,
  // Thống kê nhanh để dashboard tổng hợp dùng được mà không cần đọc full JSON
  bm_tong:    DATA.bieu_mau.length,
  bm_dat:     DATA.bieu_mau.filter(function(b){ return b.icon === "✅"; }).length,
  bm_can_bo_sung: DATA.bieu_mau.filter(function(b){ return b.icon === "⚠️"; }).length,
  bm_thieu:   DATA.bieu_mau.filter(function(b){ return b.icon === "❌"; }).length,
  kn_cao_n:   (DATA.khuyen_nghi || []).filter(function(k){ return k.uu_tien === "Cao"; }).length,
};

Packer.toBuffer(doc).then(function(buf) {
  // 1. Lưu DOCX
  fs.writeFileSync(DOCX_PATH, buf);
  console.log("✅  DOCX : " + DOCX_PATH);
  console.log("    Size : " + (buf.length / 1024).toFixed(1) + " KB");

  // 2. Lưu JSON cá nhân (raw data only — không chứa AI analysis)
  fs.writeFileSync(JSON_PATH, JSON.stringify(rawJsonData, null, 2), 'utf8');
  console.log("✅  JSON : " + JSON_PATH);

  // 3. Cập nhật master.json (upsert theo ma_kcb)
  var master = { tong_so: 0, cap_nhat_lan_cuoi: "", records: [] };
  try { master = JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8')); } catch(e) { /* tạo mới nếu chưa có */ }

  var idx = master.records.findIndex(function(r){ return r.ma_kcb === masterRecord.ma_kcb; });
  if (idx >= 0) {
    master.records[idx] = masterRecord;
    console.log("🔄  master.json: cập nhật record " + masterRecord.ma_kcb);
  } else {
    master.records.push(masterRecord);
    console.log("✅  master.json: thêm record " + masterRecord.ma_kcb);
  }
  master.records.sort(function(a, b){ return a.ma_kcb.localeCompare(b.ma_kcb); });
  master.tong_so          = master.records.length;
  master.cap_nhat_lan_cuoi = TODAY;
  fs.writeFileSync(MASTER_PATH, JSON.stringify(master, null, 2), 'utf8');
  console.log("✅  master: " + MASTER_PATH + " (" + master.tong_so + " records tổng cộng)");
  console.log("");
  console.log("📋  Tiếp theo: trình bày kết quả → xác nhận user → move PDF sang processed/");
}).catch(function(e) {
  console.error("❌  Lỗi:", e.message || e);
  process.exit(1);
});
