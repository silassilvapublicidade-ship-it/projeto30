/**
 * A field starting with =, +, -, @, tab or CR is a formula in Excel/Sheets -
 * prefixing it with a plain quote neutralizes that without changing what a
 * human reading the CSV sees. Applied to every field, not just name/email,
 * since any text column could in principle carry attacker-controlled input.
 */
export function csvField(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvRow(fields: Array<string | number | null | undefined>): string {
  return `${fields.map(csvField).join(",")}\r\n`;
}
