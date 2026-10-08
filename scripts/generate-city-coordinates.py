"""Generate browser-only city coordinates from public city points.

Inputs: INS SIRUTA S1 2025 workbook and romania/localitati orase.csv.
The city points are rounded to ~1 km in the source; they are used only to
suggest a city. Browser GPS coordinates never leave the device.
"""

import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

from openpyxl import load_workbook


def normalize(value):
    value = value.lower().replace("ş", "ș").replace("ţ", "ț")
    value = "".join(c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn")
    return re.sub("[^a-z0-9]", "", value)


siruta = list(load_workbook(sys.argv[1], read_only=True, data_only=True).active.values)[1:]
counties = {
    row[3]: re.sub(r"^(JUDEȚUL|JUDEŢUL|MUNICIPIUL) ", "", row[1])
    for row in siruta if row[6] == 1
}
points = defaultdict(list)
with open(sys.argv[2], encoding="utf-8-sig", newline="") as handle:
    for row in csv.DictReader(handle):
        points[(normalize(row["NUME"]), normalize(row["JUDET"]))].append(row)

# A few SIRUTA towns are represented by neighborhoods in the older point set.
# These coordinates approximate their center.
fallback = {
    "eforie": (44.05, 28.64),
    "breaza": (45.185, 25.67),
    "bailegovora": (45.08, 24.18),
    "baileolanesti": (45.205, 24.242),
    "ocnelemari": (45.086, 24.305),
    "bucuresti": (44.44, 26.10),
}
cities = []
for row in siruta:
    if row[6] != 2 or row[7] != "1" or row[5] not in (1, 2, 4, 9):
        continue
    name = re.sub(r"^(MUNICIPIUL|ORAŞUL|ORAȘUL|ORAŞ|ORAȘ) ", "", row[1])
    county = counties[row[3]]
    candidates = points[(normalize(name), normalize(county))]
    if candidates:
        point = max(candidates, key=lambda value: int(value["POPULATIE (in 2002)"]))
        latitude, longitude = float(point["Y"]), float(point["X"])
    else:
        latitude, longitude = fallback[normalize(name)]
    cities.append([name.replace("Ş", "Ș").replace("Ţ", "Ț").title(), latitude, longitude])

assert len(cities) == 319
output = Path(__file__).resolve().parent.parent / "lib" / "romanian-city-coordinates.ts"
output.write_text(
    "// City centers for browser-only location matching.\n"
    "// Names: INS SIRUTA S1 2025 (CC BY 4.0), https://data.gov.ro/dataset/siruta-2025\n"
    "// Coordinates: romania/localitati (WTFPL), https://github.com/romania/localitati\n"
    "// Coordinates are approximate; no user location is sent to a server.\n"
    "export const ROMANIAN_CITY_COORDINATES: readonly [string, number, number][] = [\n"
    + "".join("  " + json.dumps(city, ensure_ascii=False) + ",\n" for city in cities)
    + "]\n",
    encoding="utf-8",
)
print(f"Wrote {len(cities)} city coordinates")
