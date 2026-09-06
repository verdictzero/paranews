import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFlags, classifyTopics, isOffTopic } from "./classify.ts";

test("topics from real headlines", () => {
  assert.deepEqual(classifyTopics("Pentagon seeks access to vast private UFO records collection"), ["ufo"]);
  assert.deepEqual(classifyTopics("Paranormal investigators find activity at Wilmington's Museum of the Bizarre"), ["ghosts"]);
  assert.deepEqual(classifyTopics("'Case closed': Police say Bigfoot sightings in Maine were just a man in a costume"), ["cryptids"]);
  assert.deepEqual(classifyTopics("Pilots report mysterious lights 'moving at extreme speeds' across Oregon skies"), ["fortean"]);
  assert.deepEqual(classifyTopics("UFO experiences might have connection with demonic possession cases"), ["ufo", "ghosts"]);
  assert.deepEqual(classifyTopics("Archive of Luis Elizondo's \"Deleted\" Emails"), ["ufo"]);
  assert.deepEqual(classifyTopics("Conflict in the Final Frontier: The U.S. and China prepare for war"), []);
  assert.deepEqual(classifyTopics("Yeti launches textured Riverhead Collection for fall"), []);
  assert.deepEqual(classifyTopics("Iconic singer-songwriter vanished without a trace 52 years ago"), ["fortean"]);
});

test("serialized fiction is off-topic outright", () => {
  assert.equal(isOffTopic("Mushoku Tensei: Jobless Reincarnation III ‒ Episode 10"), true);
  assert.equal(isOffTopic("6 Reincarnation Isekai Better Than Re:Zero"), true);
  assert.equal(isOffTopic("Ghost hunters visit St. Anthony's old reform school"), false);
});

test("flags demote entertainment and attractions", () => {
  assert.deepEqual(classifyFlags("Wildman: Bigfoot will go John Wick in bloody revenge thriller"), ["entertainment"]);
  assert.deepEqual(classifyFlags("The 20 best exorcist-themed movies, ranked"), ["entertainment"]);
  assert.deepEqual(classifyFlags("Madworld Haunted Attraction opens in Piedmont"), ["attraction"]);
  assert.deepEqual(classifyFlags("How live scares convinced Jason Blum to invest in Paranormal Activity on Broadway"), ["entertainment"]);
  assert.deepEqual(classifyFlags("Rebecca Ferguson and Greta Lee to star in lesbian romantic comedy Honeymoon/Funeral"), ["entertainment"]);
  assert.deepEqual(classifyFlags("Pentagon seeks access to vast private UFO records collection"), []);
  assert.deepEqual(classifyFlags("Bigfoot sighting was just a man in a costume, police say"), []);
});
