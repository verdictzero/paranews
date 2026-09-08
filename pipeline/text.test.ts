import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTitle, decodeEntities, itemId, normalizeTitle, publisherKey, stem, stripHtml, stripPublisherSuffix, tokens, truncate } from "./text.ts";

test("decodeEntities handles named, decimal and hex entities and leaves unknowns alone", () => {
  assert.equal(decodeEntities("Tom &amp; Jerry &#8217;s &#x27;quote&#x27; &nbsp;x &bogus;"), "Tom & Jerry ’s 'quote'  x &bogus;");
});

test("stripHtml removes tags and scripts, decodes entities", () => {
  assert.equal(stripHtml('<p>Hello <b>world</b></p><script>alert(1)</script><a href="x">link &amp; more</a>').replace(/\s+/g, " ").trim(), "Hello world link & more");
});

test("cleanTitle strips soft hyphens and zero-width characters", () => {
  assert.equal(cleanTitle("Forgotten case of 'Willie' the cottage poltergeis\u00ADt\u200B"), "Forgotten case of 'Willie' the cottage poltergeist");
});

test("cleanTitle unifies curly quotes and whitespace", () => {
  assert.equal(cleanTitle("  ‘Case closed’:  Police   say &quot;no&quot; "), "'Case closed': Police say \"no\"");
});

test("stripPublisherSuffix only strips when the suffix is the publisher", () => {
  assert.equal(stripPublisherSuffix("Pentagon seeks UFO records - DefenseScoop", "DefenseScoop"), "Pentagon seeks UFO records");
  assert.equal(stripPublisherSuffix("Pentagon seeks UFO records - DefenseScoop", "The Guardian"), "Pentagon seeks UFO records - DefenseScoop");
  assert.equal(stripPublisherSuffix("Ghosts - and why we hunt them - The Conversation", "the conversation"), "Ghosts - and why we hunt them");
  assert.equal(stripPublisherSuffix("No suffix here", "X"), "No suffix here");
});

test("normalizeTitle is lowercase alphanumerics", () => {
  assert.equal(normalizeTitle("‘Case closed’: Police say Bigfoot’s sightings in Maine were… a man!"), "case closed police say bigfoots sightings in maine were a man");
});

test("publisherKey folds domain and display forms of the same outlet", () => {
  assert.equal(publisherKey("kptv.com"), publisherKey("KPTV"));
  assert.equal(publisherKey("cbsnews.com"), publisherKey("CBS News"));
  assert.equal(publisherKey("femalefirst.co.uk"), publisherKey("Female First"));
  assert.equal(publisherKey("nashua.inklink.news"), publisherKey("Nashua Ink Link"));
  assert.equal(publisherKey("The New York Times"), "newyorktimes");
  assert.notEqual(publisherKey("KPTV"), publisherKey("KCTV"));
});

test("tokens drop stopwords, stem and dedupe", () => {
  assert.deepEqual(tokens("pentagon seeks access to vast private ufo records collection"), ["pentagon", "seek", "access", "vast", "private", "ufo", "record", "collection"]);
  assert.equal(stem("sightings"), "sighting");
  assert.equal(stem("cities"), "city");
  assert.equal(stem("glass"), "glass");
  assert.equal(stem("1954"), "1954");
});

test("itemId is stable and publisher-sensitive", () => {
  const a = itemId("pentagon seeks ufo records", "DefenseScoop");
  assert.equal(a, itemId("pentagon seeks ufo records", "defensescoop"));
  assert.notEqual(a, itemId("pentagon seeks ufo records", "NewsNation"));
  assert.match(a, /^[0-9a-f]{16}$/);
});

test("truncate cuts on a word boundary with an ellipsis", () => {
  assert.equal(truncate("short", 20), "short");
  const t = truncate("one two three four five six seven eight nine ten", 24);
  assert.equal(t, "one two three four five…");
});

test("a publisher whose own name contains ' - ' is still stripped", () => {
  assert.equal(
    stripPublisherSuffix(
      "Ask the Experts: What Is a Near-Death Experience? - ABC News - Breaking News, Latest News and Videos",
      "ABC News - Breaking News, Latest News and Videos",
    ),
    "Ask the Experts: What Is a Near-Death Experience?",
  );
  assert.equal(stripPublisherSuffix("Bigfoot spotted in Maine - Fox News", "Fox News"), "Bigfoot spotted in Maine");
  // A dash that is part of the headline is left alone.
  assert.equal(stripPublisherSuffix("Roswell - the untold story", "Fox News"), "Roswell - the untold story");
});
