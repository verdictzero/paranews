import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeCell, toCsv } from "./csv.ts";

test("values that would break a row are quoted", () => {
  assert.equal(escapeCell("plain"), "plain");
  assert.equal(escapeCell("has, comma"), '"has, comma"');
  assert.equal(escapeCell('has "quotes"'), '"has ""quotes"""');
  assert.equal(escapeCell("has\nnewline"), '"has\nnewline"');
  assert.equal(escapeCell("has\r\nCRLF"), '"has\r\nCRLF"');
  assert.equal(escapeCell(42), "42");
  assert.equal(escapeCell(undefined), "");
  assert.equal(escapeCell(null), "");
});

test("a value that a spreadsheet would run as a formula is defused", () => {
  // Without this, opening the file executes the cell.
  assert.equal(escapeCell("=1+1"), "'=1+1");
  assert.equal(escapeCell("+44 7700 900000"), "'+44 7700 900000");
  assert.equal(escapeCell("-1"), "'-1");
  assert.equal(escapeCell("@handle"), "'@handle");
  // A minus inside the value is fine; only a leading one is dangerous.
  assert.equal(escapeCell("Roswell-Chaves"), "Roswell-Chaves");
  // A NUMBER is never a formula. Guarding it would corrupt every western longitude.
  assert.equal(escapeCell(-72.921), "-72.921");
  assert.equal(escapeCell(-1), "-1");
  assert.equal(escapeCell(0), "0");
  assert.equal(escapeCell(Number.NaN), "");
  assert.equal(escapeCell(Number.POSITIVE_INFINITY), "");
});

test("toCsv writes a header and CRLF rows", () => {
  const rows = [
    { date: "2026-09-01", place: "Damariscotta, Maine", title: 'He said "it was huge"' },
    { date: "2026-09-02", place: "Loch Ness", title: "Nessie again" },
  ];
  const csv = toCsv(rows, [
    { key: "date", value: (r) => r.date },
    { key: "place", value: (r) => r.place },
    { key: "title", value: (r) => r.title },
  ]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "date,place,title");
  assert.equal(lines[1], '2026-09-01,"Damariscotta, Maine","He said ""it was huge"""');
  assert.equal(lines[2], "2026-09-02,Loch Ness,Nessie again");
  assert.equal(lines[3], "", "trailing CRLF");
  // Round-trips through a strict parser: the quoted comma stays one field.
  assert.equal(lines[1].split(",").length, 4, "naive split sees the quoted comma");
});

test("an empty set still writes its header", () => {
  assert.equal(toCsv([], [{ key: "date", value: () => "" }]), "date\r\n");
});
