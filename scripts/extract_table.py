#!/usr/bin/env python3
"""Extract a rectangular table from CSV/XLSX/PDF into JSON for timesheet_raw_rows.

CSV is also parsed in TypeScript; this script exists so XLSX and PDF share one
landing shape. PDF tries camelot first, then pdfplumber. Low-confidence tables
are flagged instead of being treated as clean data.

Stdout is JSON only. Diagnostics go to stderr.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any


def cell_to_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def unique_headers(raw: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out: list[str] = []
    for index, header in enumerate(raw):
        base = header.strip() or f"column_{index + 1}"
        count = seen.get(base, 0)
        seen[base] = count + 1
        out.append(base if count == 0 else f"{base}_{count + 1}")
    return out


def rows_from_matrix(matrix: list[list[Any]], header_row: int) -> tuple[list[str], list[dict[str, str]]]:
    if not matrix:
        return [], []
    header_index = max(header_row - 1, 0)
    if header_index >= len(matrix):
        return [], []
    headers = unique_headers([cell_to_str(v) for v in matrix[header_index]])
    rows: list[dict[str, str]] = []
    for raw in matrix[header_index + 1 :]:
        cells = [cell_to_str(v) for v in raw]
        if all(cell == "" for cell in cells):
            continue
        row = {headers[i]: (cells[i] if i < len(cells) else "") for i in range(len(headers))}
        rows.append(row)
    return headers, rows


def payload(
    *,
    engine: str,
    confidence: float,
    needs_review: bool,
    warnings: list[str],
    headers: list[str],
    rows: list[dict[str, str]],
) -> dict[str, Any]:
    return {
        "ok": True,
        "engine": engine,
        "confidence": round(max(0.0, min(1.0, confidence)), 4),
        "needs_review": needs_review,
        "warnings": warnings,
        "headers": headers,
        "rows": rows,
    }


def extract_csv(path: Path, header_row: int) -> dict[str, Any]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        matrix = list(csv.reader(handle))
    headers, rows = rows_from_matrix(matrix, header_row)
    warnings = [] if rows else ["No data rows found after the header row."]
    return payload(
        engine="csv",
        confidence=1.0 if rows else 0.4,
        needs_review=not rows,
        warnings=warnings,
        headers=headers,
        rows=rows,
    )


def extract_xlsx(path: Path, header_row: int, sheet_name: str | None) -> dict[str, Any]:
    try:
        from openpyxl import load_workbook
    except ImportError:
        return payload(
            engine="openpyxl",
            confidence=0,
            needs_review=True,
            warnings=["openpyxl is not installed. pip install -r requirements-ingestion.txt"],
            headers=[],
            rows=[],
        )

    workbook = load_workbook(path, data_only=True, read_only=True)
    warnings: list[str] = []
    if sheet_name:
        if sheet_name not in workbook.sheetnames:
            return payload(
                engine="openpyxl",
                confidence=0,
                needs_review=True,
                warnings=[f'Sheet "{sheet_name}" was not found.'],
                headers=[],
                rows=[],
            )
        sheet = workbook[sheet_name]
    else:
        sheet = workbook.active
        if len(workbook.sheetnames) > 1:
            warnings.append(
                f"Workbook has {len(workbook.sheetnames)} sheets; using \"{sheet.title}\"."
            )

    matrix = [[cell_to_str(cell) for cell in row] for row in sheet.iter_rows(values_only=True)]
    headers, rows = rows_from_matrix(matrix, header_row)
    if not rows:
        warnings.append("No data rows found after the header row.")
    return payload(
        engine="openpyxl",
        confidence=1.0 if rows else 0.4,
        needs_review=not rows,
        warnings=warnings,
        headers=headers,
        rows=rows,
    )


def extract_pdf_camelot(path: Path, header_row: int) -> dict[str, Any] | None:
    try:
        import camelot
    except ImportError:
        return None

    warnings: list[str] = []
    tables = camelot.read_pdf(str(path), flavor="lattice", pages="all")
    engine = "camelot-lattice"
    if tables.n == 0:
        tables = camelot.read_pdf(str(path), flavor="stream", pages="all")
        engine = "camelot-stream"
        warnings.append("camelot lattice found no tables; fell back to stream.")
    if tables.n == 0:
        return None

    best = max(tables, key=lambda table: float(getattr(table, "accuracy", 0) or 0))
    accuracy = float(getattr(best, "accuracy", 0) or 0) / 100.0
    matrix = [[cell_to_str(cell) for cell in row] for row in best.df.values.tolist()]
    # camelot keeps the header as the first data row in df unless process_background
    headers, rows = rows_from_matrix(matrix, header_row)
    if tables.n > 1:
        warnings.append(f"PDF has {tables.n} tables; using the highest-accuracy table.")
    return payload(
        engine=engine,
        confidence=accuracy if rows else min(accuracy, 0.4),
        needs_review=accuracy < 0.8 or not rows,
        warnings=warnings,
        headers=headers,
        rows=rows,
    )


def extract_pdf_pdfplumber(path: Path, header_row: int) -> dict[str, Any] | None:
    try:
        import pdfplumber
    except ImportError:
        return None

    warnings: list[str] = []
    matrices: list[list[list[str]]] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if table:
                matrices.append([[cell_to_str(cell) for cell in row] for row in table])
    if not matrices:
        return None
    if len(matrices) > 1:
        warnings.append(f"pdfplumber found {len(matrices)} tables; using the first.")
    headers, rows = rows_from_matrix(matrices[0], header_row)
    confidence = 0.65 if rows else 0.3
    return payload(
        engine="pdfplumber",
        confidence=confidence,
        needs_review=True,
        warnings=warnings or ["pdfplumber extraction is whitespace-aligned; review required."],
        headers=headers,
        rows=rows,
    )


def extract_pdf(path: Path, header_row: int) -> dict[str, Any]:
    camelot_result = extract_pdf_camelot(path, header_row)
    if camelot_result and camelot_result["rows"]:
        return camelot_result

    plumber_result = extract_pdf_pdfplumber(path, header_row)
    if plumber_result and plumber_result["rows"]:
        if camelot_result:
            plumber_result["warnings"] = [
                "camelot produced no usable table; fell back to pdfplumber.",
                *plumber_result["warnings"],
            ]
        return plumber_result

    warnings = ["No table could be extracted from the PDF."]
    if camelot_result is None:
        warnings.append("camelot is not installed.")
    if plumber_result is None:
        warnings.append("pdfplumber is not installed.")
    return payload(
        engine="pdf",
        confidence=0,
        needs_review=True,
        warnings=warnings,
        headers=[],
        rows=[],
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract a table to JSON for StaffHub ingestion.")
    parser.add_argument("--path", required=True)
    parser.add_argument("--format", required=True, choices=["csv", "xlsx", "pdf"])
    parser.add_argument("--header-row", type=int, default=1)
    parser.add_argument("--sheet-name", default=None)
    parser.add_argument("--confidence-min", type=float, default=0.8)
    args = parser.parse_args()

    path = Path(args.path)
    if not path.exists():
        json.dump(
            payload(
                engine=args.format,
                confidence=0,
                needs_review=True,
                warnings=[f"File not found: {path}"],
                headers=[],
                rows=[],
            ),
            sys.stdout,
        )
        return 1

    if args.format == "csv":
        result = extract_csv(path, args.header_row)
    elif args.format == "xlsx":
        result = extract_xlsx(path, args.header_row, args.sheet_name)
    else:
        result = extract_pdf(path, args.header_row)

    if result["confidence"] < args.confidence_min:
        result["needs_review"] = True
    json.dump(result, sys.stdout)
    sys.stdout.write("\n")
    return 0 if result["rows"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
