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

test("entertainment: fiction and its promotion is flagged", () => {
  const yes = [
    "Wildman: Bigfoot will go John Wick in bloody revenge thriller",
    "It's 'John Wick' Meets Bigfoot as Genre Banner Badlands Picks up Horror Script 'Wildman' (Exclusive)",
    "John Wick Meets Bigfoot In Development For New Wild Horror",
    "The 20 best exorcist-themed movies, ranked",
    "Movie Myths: Did Steven Spielberg Secretly Direct 'Poltergeist'?",
    "How live scares convinced Jason Blum to invest in PARANORMAL ACTIVITY on Broadway",
    "'Paranormal Activity' Review: Creepy Horror High Jinks on Broadway",
    "'Paranormal Activity' franchise producer Jason Blum on making art work",
    "Rebecca Ferguson and Greta Lee to star in lesbian romantic comedy Honeymoon/Funeral",
    "Paramount+'s 2026 'Peak Screaming' Halloween Collection Is Here, and It's Stacked With Over 450 Titles",
    "Peak Screaming – Paramount+ Halloween 2026",
    "Breaking News - Apple TV Unveils First Look at Season Two of Animated Series",
    "Korean sci-fi hit 'Hope' to release in India",
    "Mushoku Tensei: Jobless Reincarnation Season 3 Episode 10 Review",
    "Where to Watch Mushoku Tensei: Jobless Reincarnation Online",
    "A Famous Minnesota Ghost Hunter Is Part Of Hulu's New Show",
    "Coming Soon: New TV Series Based on the Archives of the Impossible",
    "Mothman ballet to premiere in Charleston",
    "M.G. Vassanji returns with new novel 'The Apparition'",
    "Highlights for 'Tamron Hall' Season 7",
    "5 TV Show Characters That Vanished Without A Trace",
    "Review | How a WWII veteran became one of England's most prolific ghost hunters",
    "The 3-in-1 LEGO Haunted Mansion Drops to a New Low Price",
    "HalloweenCostumes.com Launches 75 New Animatronics Including 'Poltergeist' Clown",
    "Square Enix Tokyo Game Show 2026 Lineup Revealed",
    "Until Dawn 2 release window narrowed as Supermassive teases new gameplay",
    "Juan Hansen Releases Debut Album",
    "Best horror dramas on Apple TV: 'The Enfield Poltergeist', 'Servant' and more",
    "Viewers of streaming documentary The Rendlesham UFO: The British Roswell visited by alien orbs",
    "Wakiso Dance Kids revive Kakalabanda tale in new dance theatre show",
  ];
  for (const t of yes) assert.deepEqual(classifyFlags(t), ["entertainment"], t);
});

test("entertainment: real stories with media-sounding words are not flagged", () => {
  const no = [
    "Crew member films three bright orbs shadowing aircraft over Alaska",
    "Paranormal group to host investigation at King Opera House in Van Buren",
    "Victory Theatre claims mysterious footage has drawn paranormal investigation",
    "Small rooms being uncovered during renovations at Vernon's Towne Theatre",
    "Her Neighbors Vanished Without A Trace, Leaving Packages Piling Up And Toys Scattered",
    "Pentagon report casts doubt on UFO claims",
    "Woman describes sleep paralysis episode with a shadow figure",
    "Bigfoot spotted near trailer park, residents say",
    "Radar operators on X-band system tracked the object for 20 minutes",
    "UFO hearing recap: what the whistleblowers told Congress",
    "Stranger things have happened: Maine town shrugs off Bigfoot scare",
    "Real-life Ghostbusters investigate haunted pub in Kent",
    "Reports of paranormal activity at the old county jail draw investigators",
    "Study shows most UFO reports are misidentified aircraft",
    "A new series of sightings over Cumbria has residents baffled",
    "Former Pentagon UAP Task Force leader Jay Stratton releasing book in October",
    "Sandra Bullock reveals her own UFO sighting on podcast",
    "Pilots report mysterious lights 'moving at extreme speeds' across Oregon skies",
    "Bigfoot sighting was just a man in a costume, Maine police department assures residents",
    "Star of TV's Ghost Hunters appears in Glasgow, Kentucky",
    "The Conjuring house sells to paranormal investigators",
  ];
  for (const t of no) assert.deepEqual(classifyFlags(t), [], t);
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
