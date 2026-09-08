/**
 * CSV writing, to RFC 4180.
 *
 * Small enough to look trivial and exactly the kind of thing that corrupts a
 * spreadsheet quietly: a comma in a headline, a quote in a place name, a
 * newline in a title. Every value is escaped by the same rule rather than by
 * inspection, and it is tested.
 */

export interface Column<T> {
  key: string;
  value: (row: T) => string | number | undefined | null;
}

/** Quote when the value could otherwise break the row, and double any quotes inside it. */
export function escapeCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  // A number is never a formula. Guarding it would turn -72.9 into '-72.9 and
  // silently break every negative longitude in the file.
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  // A leading =, +, - or @ in TEXT is executed by spreadsheet software.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /["\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const head = columns.map((c) => escapeCell(c.key)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(","));
  // CRLF is what RFC 4180 specifies and what Excel expects.
  return [head, ...body].join("\r\n") + "\r\n";
}
