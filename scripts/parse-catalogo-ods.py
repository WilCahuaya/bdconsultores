#!/usr/bin/env python3
"""Parsea la primera hoja de un .xlsx o el .ods histórico y emite JSON por stdout.

  python scripts/parse-catalogo-ods.py ruta.xlsx
  python scripts/parse-catalogo-ods.py
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ODS = ROOT / "docs/Catalogo nacional de activos.ods"

NS_XLSX = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
TAG_ROW = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"
TAG_T = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"


def parse_conta(raw: str):
    t = (raw or "").strip()
    if not t:
        return None, None
    m = re.match(r"^(\d{1,6})(?:\s+(.*))?$", t)
    if not m:
        return None, t
    codigo = m.group(1)
    rest = (m.group(2) or "").strip()
    if rest == codigo or rest.startswith(f"{codigo} "):
        rest = rest[len(codigo) :].strip()
    return codigo, rest or None


def row_payload(cells):
    cells = (list(cells) + [""] * 8)[:8]
    codigo = str(cells[0]).strip()
    if not codigo or codigo.lower() in {"código", "codigo"}:
        return None
    cuenta_codigo, contabilidad = parse_conta(str(cells[4]))
    origen = "PROPIO" if re.fullmatch(r"BD\d{6}", codigo, re.IGNORECASE) else "NACIONAL"
    codigo = codigo.upper() if origen == "PROPIO" else codigo

    def opt(value):
        text = str(value).strip()
        return text or None

    return {
        "codigo": codigo,
        "denominacion": str(cells[1]).strip(),
        "grupo": opt(cells[2]),
        "clase": opt(cells[3]),
        "cuenta_codigo": cuenta_codigo,
        "contabilidad": contabilidad,
        "depreciacion": opt(cells[5]),
        "resolucion": opt(cells[6]),
        "estado": opt(cells[7]),
        "origen": origen,
    }


def col_idx(ref: str) -> int:
    letters = "".join(ch for ch in ref if ch.isalpha())
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def parse_xlsx(path: Path):
    rows = []
    with zipfile.ZipFile(path) as z:
        ss = []
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", NS_XLSX):
            ss.append("".join((t.text or "") for t in si.iter(TAG_T)))
        with z.open("xl/worksheets/sheet1.xml") as sheet:
            for _ev, el in ET.iterparse(sheet, events=("end",)):
                if el.tag != TAG_ROW:
                    continue
                cells = {}
                max_i = -1
                for c in el.findall("m:c", NS_XLSX):
                    ref = c.attrib.get("r", "")
                    i = col_idx(ref) if ref else max_i + 1
                    t = c.attrib.get("t")
                    v = c.find("m:v", NS_XLSX)
                    is_el = c.find("m:is", NS_XLSX)
                    val = ""
                    if t == "s" and v is not None and v.text:
                        val = ss[int(v.text)]
                    elif t == "inlineStr" and is_el is not None:
                        val = "".join((t2.text or "") for t2 in is_el.iter(TAG_T))
                    elif v is not None and v.text:
                        val = v.text
                    cells[i] = val
                    if i > max_i:
                        max_i = i
                payload = row_payload([cells.get(i, "") for i in range(max_i + 1 if max_i >= 0 else 0)])
                if payload:
                    rows.append(payload)
                el.clear()
    return rows


def parse_ods(path: Path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("content.xml"))
    ns = {
        "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    }
    rows = []
    for row in root.findall(".//table:table-row", ns)[1:]:
        cells = []
        for cell in row.findall("table:table-cell", ns):
            reps = int(
                cell.get("{urn:oasis:names:tc:opendocument:xmlns:table:1.0}number-columns-repeated")
                or 1
            )
            ps = cell.findall(".//text:p", ns)
            val = (ps[0].text or "").strip() if ps else ""
            cells.extend([val] * reps)
        payload = row_payload(cells)
        if payload:
            rows.append(payload)
    return rows


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ODS
    if not source.exists():
        raise SystemExit(f"No existe la fuente del catálogo: {source}")
    if source.suffix.lower() == ".xlsx":
        rows = parse_xlsx(source)
    else:
        rows = parse_ods(source)
    json.dump(rows, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
