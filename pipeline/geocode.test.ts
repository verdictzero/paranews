import { test } from "node:test";
import assert from "node:assert/strict";
import { locate, locateDateline, locateHeadline, locateImplied } from "./geocode.ts";

test("a place only counts when something happened there", () => {
  // The sighting location beats the witness's home.
  const ct = locateHeadline("Rhode Island dad claims he saw Bigfoot in Connecticut woods");
  assert.equal(ct?.place.name, "Connecticut");

  assert.equal(locateHeadline("100-foot triangular UFO over Colorado base captured in video")?.place.name, "Colorado");
  assert.equal(locateHeadline("Claimed bigfoot sighting in Damariscotta")?.place.name, "Damariscotta");
  // A place in front of a beat noun is where it happened.
  assert.equal(locateHeadline("Colorado Bigfoot report")?.place.name, "Colorado");
  assert.equal(locateHeadline("Maine's Bigfoot hunt draws a crowd")?.place.name, "Maine");
  // "City, State" is trusted as a pair.
  assert.equal(locateHeadline("Voorhees, New Jersey pterodactyl-like winged cryptid spotted")?.place.name, "Voorhees");
});

test("names that are not locations are refused", () => {
  // An organisation carrying a place name goes nowhere.
  assert.equal(locate("The End of the Roswell Daily Record?"), undefined);
  assert.equal(locateHeadline("UFO history is being shaped in Washington DC"), undefined);
  // Discussion is not an event.
  assert.equal(locateHeadline("What the new UFO files mean for Britain"), undefined);
  // Criticism names places it is not reporting from.
  assert.equal(locate("Unidentified Murder review – a playful sendup of alien abduction in Hong Kong"), undefined);
  // Months are towns somewhere; they are not the location of a sighting.
  assert.equal(locateHeadline("UFO sighting reported in March"), undefined);
});

test("some creatures name their own location", () => {
  assert.equal(locateImplied("Two separate tourists report new Nessie sightings")?.place.name, "Loch Ness");
  assert.equal(locateImplied("Mothman statue draws visitors")?.place.name, "Point Pleasant");
  assert.equal(locateImplied("Ogopogo tooth found at Canadian lake")?.place.name, "Okanagan Lake");
  assert.equal(locateImplied("A quiet week for cryptids"), undefined);
  // Implied is marked as such: it is inference, not something the story reported.
  assert.equal(locateImplied("Nessie spotted again")?.from, "implied");
});

test("wire datelines are the publisher stating the location", () => {
  assert.equal(locateDateline("DAMARISCOTTA, Maine (AP) — Police said Monday...")?.place.name, "Damariscotta");
  assert.equal(locateDateline("Nothing resembling a dateline here at all."), undefined);
});

test("the most specific place wins", () => {
  // Both Damariscotta and Maine appear; the town is the answer.
  const hit = locateHeadline("Bigfoot spotted in Damariscotta, Maine over the weekend");
  assert.equal(hit?.place.name, "Damariscotta");
  assert.equal(hit?.place.kind, "landmark");
});
