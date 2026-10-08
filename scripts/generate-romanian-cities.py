"""Generate the urban locality list from INS SIRUTA S1 2025.

Source: https://data.gov.ro/dataset/siruta-2025
The resource is named CSV but currently serves an XLSX workbook.
Usage: python scripts/generate-romanian-cities.py path/to/siruta_s1_2025.xlsx
"""

import json
import sys
from pathlib import Path

from openpyxl import load_workbook


def city_name(name: str) -> str:
    name = name.removeprefix("MUNICIPIUL ").removeprefix("ORAŞUL ").removeprefix("ORAȘUL ").removeprefix("ORAŞ ").removeprefix("ORAȘ ")
    return name.replace("Ş", "Ș").replace("Ţ", "Ț").title()


rows = load_workbook(sys.argv[1], read_only=True, data_only=True).active.values
next(rows)
cities = sorted(
    {
        city_name(row[1])
        for row in rows
        if row[6] == 2 and row[7] == "1" and row[5] in (1, 2, 4, 9)
    },
    key=lambda value: value.casefold(),
)
assert len(cities) == 318, f"Expected 318 distinct urban names, got {len(cities)}"

output = Path(__file__).resolve().parent.parent / "lib" / "romanian-cities.ts"
output.write_text(
    "// Municipii și orașe din INS SIRUTA S1 2025 (CC BY 4.0).\n"
    "// https://data.gov.ro/dataset/siruta-2025\n"
    "export const ROMANIAN_CITIES = "
    + json.dumps(cities, ensure_ascii=False, indent=2)
    + " as const\n\n"
    "export function normalizeCity(value: string): string {\n"
    "  return value.trim().toLocaleLowerCase('ro-RO')\n"
    "    .replace(/^(municipiul|orașul|oraşul|oraș|oraş)\\s+/, '')\n"
    "    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')\n"
    "    .replace(/[șş]/g, 's').replace(/[țţ]/g, 't')\n"
    "    .replace(/[^a-z0-9]/g, '')\n"
    "}\n\n"
    "const cityByNormalizedName = new Map<string, string>(\n"
    "  ROMANIAN_CITIES.map((city) => [normalizeCity(city), city])\n"
    ")\n\n"
    "export function canonicalCity(value: string): string | null {\n"
    "  return cityByNormalizedName.get(normalizeCity(value)) ?? null\n"
    "}\n",
    encoding="utf-8",
)
print(f"Wrote {len(cities)} cities to {output}")
