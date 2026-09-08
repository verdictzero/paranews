import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFlags, classifyTopics, isNotice, isOffTopic, isRoundup } from "./classify.ts";

test("topics from real headlines", () => {
  assert.deepEqual(classifyTopics("Pentagon seeks access to vast private UFO records collection"), ["ufo"]);
  assert.deepEqual(classifyTopics("Paranormal investigators find activity at Wilmington's Museum of the Bizarre"), ["ghosts"]);
  assert.deepEqual(classifyTopics("'Case closed': Police say Bigfoot sightings in Maine were just a man in a costume"), ["cryptids"]);
  assert.deepEqual(classifyTopics("Pilots report mysterious lights 'moving at extreme speeds' across Oregon skies"), ["fortean"]);
  assert.deepEqual(classifyTopics("UFO experiences might have connection with demonic possession cases"), ["ufo", "ghosts"]);
  assert.deepEqual(classifyTopics("Archive of Luis Elizondo's \"Deleted\" Emails"), ["ufo"]);
  assert.deepEqual(classifyTopics("Conflict in the Final Frontier: The U.S. and China prepare for war"), []);
  assert.deepEqual(classifyTopics("Yeti launches textured Riverhead Collection for fall"), []);
  assert.deepEqual(classifyTopics("Iconic singer-songwriter vanished without a trace 52 years ago"), [], "disappearances are true crime, not Fortean, unless something else marks them");
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
  // Every one of these is entertainment; a few are also roundups, which is fine.
  for (const t of yes) assert.ok(classifyFlags(t).includes("entertainment"), t);
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

test("expanded beat keywords catch real stories that used to be weak matches", () => {
  assert.deepEqual(classifyTopics("Conjuring House cases 'are a mess,' says RI judge"), ["ghosts"]);
  assert.deepEqual(classifyTopics("Kisii village in frenzy as 'Virgin Mary' image 'appears' on a kitchen wall"), ["fortean"]);
  assert.deepEqual(classifyTopics("Black Country locals claim to hear 'strange noise' overnight - did you hear it?"), ["fortean"]);
  assert.deepEqual(classifyTopics("Mystery Creature Found Lurking in Supermarket Bread Aisle"), ["fortean"]);
  assert.deepEqual(classifyTopics("Sandra Bullock confirms there are 'alien ships flying around' the sky"), ["ufo"]);
  assert.deepEqual(classifyTopics("Whistleblower describes non-human intelligence programme to senators"), ["ufo"]);
  assert.deepEqual(classifyTopics("Loch Ness witness spots 'seven-metre' creature moving 'like a very large eel'"), ["cryptids"]);
  assert.deepEqual(classifyTopics("Tourist spots 'dark, mound-like shape' in Loch Ness"), ["cryptids"]);
  assert.deepEqual(classifyTopics("CT doll said to be inhabited by an 'inhuman spirit' brought to new site"), ["ghosts"]);
  assert.deepEqual(classifyTopics("Victor Marx says he 'met' the devil at a Texas prison"), ["ghosts"]);
  assert.deepEqual(classifyTopics("CIA Recording From 1972 Reveals 50-Year Time Loop!"), ["fortean"]);
  assert.deepEqual(classifyTopics("Loch Ness cruise firm achieves Gold Green tourism award"), [], "tourism is not a sighting");
});

test("offbeat: tickers, products and teams that borrow a beat word", () => {
  const yes = [
    "Procure Space ETF (NASDAQ: UFO) Share Price, UFO Stock News, UFO Share Price & Updates",
    "Alien Metals Stock Price Forecast. Should You Buy UFO.L?",
    "UFO Moviez India Ltd. Key Financial Ratios – Valuation, Profitability & More",
    "Sasquatch Resources Engages Departures Capital to Conduct Digital Marketing Program",
    "2018 Norco Bigfoot 2 - medium For Sale",
    "2026 Folkstyle Tour of America - Northwest Bigfoot Battle",
    "Raleigh Aaro - Gonzaga Prep Bullpups Girls Soccer (Spokane, WA)",
    "Lufthansa and cabin crew union UFO resume talks",
    "iQOO 16 Real Device Design Leaked Featuring a Futuristic UFO-Inspired Square Camera Module",
    "Best Position 5 Supports in Dota 2 — Patch 7.41b Guide to Gain MMR",
    "SPECTER codes (September 2026)",
    "Yeti's Biggest Labor Day Deals Yet Just Dropped—Shop Discounted Coolers, Tumblers, and More",
  ];
  for (const t of yes) assert.ok(classifyFlags(t).includes("offbeat"), t);
  const no = [
    "Pentagon seeks access to vast private UFO records collection",
    "Bigfoot sighting was just a man in a costume, Maine police department assures residents",
    "Historic Hotel Alex Johnson nominated for 'Best Haunted Hotel' in national contest",
    "Stock footage of 1967 sighting resurfaces in new UFO archive",
    "Pilots report mysterious lights 'moving at extreme speeds' across Oregon skies",
  ];
  for (const t of no) assert.ok(!classifyFlags(t).includes("offbeat"), t);
});

test("flags demote entertainment and attractions", () => {
  assert.deepEqual(classifyFlags("Wildman: Bigfoot will go John Wick in bloody revenge thriller"), ["entertainment"]);
  // Both: a ranked listicle that is also fiction promotion.
  assert.deepEqual(classifyFlags("The 20 best exorcist-themed movies, ranked"), ["entertainment", "roundup"]);
  assert.deepEqual(classifyFlags("Madworld Haunted Attraction opens in Piedmont"), ["attraction"]);
  assert.deepEqual(classifyFlags("How live scares convinced Jason Blum to invest in Paranormal Activity on Broadway"), ["entertainment"]);
  assert.deepEqual(classifyFlags("Rebecca Ferguson and Greta Lee to star in lesbian romantic comedy Honeymoon/Funeral"), ["entertainment"]);
  assert.deepEqual(classifyFlags("Pentagon seeks access to vast private UFO records collection"), []);
  assert.deepEqual(classifyFlags("Bigfoot sighting was just a man in a costume, police say"), []);
});

test("perennial listicles are flagged, real events with superlative names are not", () => {
  for (const t of [
    "The 10 most haunted hotels in America, ranked",
    "9 of Chicago's most haunted places",
    "Caithness: 5 Haunted Places to Visit",
    "Check in if you dare: 12 haunted hotels in the U.S. for spooky stays",
    "Explore Tennessee's Most Haunted Places on the Ultimate Halloween Road Trip",
    "Stay at America's Most Haunted Hotel in Eureka Springs",
    "Top 10 most haunted places in Britain",
    "Göbekli Tepe and 8 Other Ancient Sites Every Design Lover Should Visit",
  ]) assert.equal(isRoundup(t), true, t);

  for (const t of [
    // A contest is an event even when its name is a superlative.
    "Historic Hotel Alex Johnson nominated for 'Best Haunted Hotel' in national contest",
    "Pub crowned most haunted in Britain by paranormal investigators",
    // A large number is a count, not a list of items.
    "Warren Collection Opens in Salem With Annabelle Doll and 1,000 Haunted Objects",
    "Police in Maine launch bizarre 'Bigfoot' hunt after mysterious creature spotted",
    "3 witnesses report mysterious lights over Phoenix",
    "Niece of couple who claimed to have encountered UFO in 1960s speaks at Exeter UFO Festival",
  ]) assert.equal(isRoundup(t), false, t);

  assert.deepEqual(classifyFlags("The 10 most haunted hotels in America, ranked"), ["roundup"]);
});

test("an organisation's own housekeeping is flagged; a person speaking is still news", () => {
  for (const t of [
    "Dr. Marieta Pehlivanova Featured on the CMAJ Podcast",
    "New Podcast Feature: Dr. Edward Kelly on A Wonderjunkie with Ryan Anderson",
    "Dr. J. Kim Penberthy Presents on Psychedelics in Practice at APA 2026",
    "Séance - Artist talk",
    "Florida Frights: Join us on a haunted history tour of St. Augustine",
  ]) assert.equal(isNotice(t), true, t);

  for (const t of [
    "Niece of N.H. couple famous for alien abduction story to speak at Exeter UFO Festival",
    "Pentagon seeks access to vast private UFO records collection",
    "New Research: Shorter Intervals Between Death and Birth Follow Unexpected Deaths",
  ]) assert.equal(isNotice(t), false, t);
});

test("'close encounter' is the UFO idiom only in its idiomatic forms", () => {
  assert.ok(classifyTopics("Why 250 British officers finally spoke about 'close encounters'").includes("ufo"));
  assert.ok(classifyTopics("Close Encounters of the Third Kind returns to cinemas").includes("ufo"));
  // Ordinary English: a close encounter with an animal is not a UFO report.
  assert.ok(!classifyTopics("Doorbell camera captures Montana woman's close encounter with mama moose").includes("ufo"));
  assert.ok(!classifyTopics("Hiker describes close encounter with a bear on the trail").includes("ufo"));
});

test("high strangeness is a phenomenon claim, not an atmosphere word", () => {
  const fortean = (t: string) => classifyTopics(t).includes("fortean");
  for (const t of [
    "UNEXPLAINED HOWLS, TREE KNOCKS, & THROWN ROCKS Near Vernon, Vermont",
    "The public joins a paranormal investigation and witnesses some unexplained activity",
    "'Proof' time travel is 'real' with unusual detail spotted in 1937 painting",
    "Border Patrol agents report a time slip on West Texas I-10",
    "Dr. Pehlivanova discusses shared death experiences in Popular Mechanics",
    "Study of past lives finds children recall verifiable details",
    "Mysterious lights over Phoenix baffle residents",
    "Residents report loud booms with no known source",
  ]) assert.equal(fortean(t), true, t);

  for (const t of [
    // "eerie" is atmosphere, not a claim about the world.
    "Listen to the sound of the Jurassic: Scientists recreate the eerie calls of the forest",
    "Inside the eerie American ghost town where stolen souvenirs are blamed for illness",
    // Bare "unexplained" and "anomaly" are ordinary English and ordinary science jargon.
    "Dan Farah's UFO docufilm revealed insider report on unexplained military base activities",
    "Radar Detects Anomalies And Unknown Burial Mounds At Viking-Age Birka",
    // A suspicious death is a crime story.
    "Autopsy reveals chilling new details in mysterious death of missing scientist",
    // Archaeology is not high strangeness just because a city was lost.
    "Lost Ancient Egyptian City Found? Archaeologists Unveil Mysterious Inscription",
    // Celebrity puff that happens to use the words.
    "Ha Ji-won's Past Life: Handsome Man, Present Beauty",
    // "Past Lives" is a film title as often as it is a research subject.
    "Greta Lee Was Hollywood's Background. Past Lives Changed the Frame",
    "NASA has successfully launched its next-generation space telescope",
    "Underground detector finds possible evidence of dark matter",
  ]) assert.equal(fortean(t), false, t);
});

test("anomalous archaeology and OOPArts are their own beats, not High Strangeness", () => {
  const beat = (t: string) => classifyTopics(t);
  // Lost cities and named anomalous sites belong to archaeology now. They used
  // to land on High Strangeness, which is how that beat became a catch-all.
  for (const t of [
    "Lost city of Atlantis clues revealed in new scans of secret ocean site",
    "Percy Fawcett: Did He Find the Lost City He Was Searching For?",
    "Radar Detects Anomalies And Unknown Burial Mounds At Viking-Age Birka",
    "New Radar Scans Reveal Mysterious 'Subsurface Anomalies' Beneath Noah's Ark site",
    "Mysterious seven-mile 'sunken city' spotted near the Bermuda Triangle",
    "Göbekli Tepe dig reopens the question of when building began",
    "Elongated skulls from Paracas re-examined",
    "Hidden chamber found in the Great Pyramid",
  ]) {
    assert.ok(beat(t).includes("archaeology"), t);
    assert.ok(!beat(t).includes("ooparts"), `${t} is not an OOPArt`);
  }

  for (const t of [
    "The Ghost of Columbus and the Impossible Geometry of the Piri Reis Map",
    "The Antikythera mechanism was more sophisticated than anyone thought",
    "Voynich manuscript decoded? Researchers claim a breakthrough",
    "Baghdad battery reconsidered by materials scientists",
  ]) assert.ok(beat(t).includes("ooparts"), t);

  // Ordinary archaeology is still not a beat at all.
  for (const t of [
    "Roman Forum Found Beneath Barcelona Hotel Rewrites Barcino",
    "Renaissance Gallows Unearthed in France With 32 Executed Victims",
    "Denmark's Largest Viking Silver Treasure Found In A Private Garden",
  ]) assert.deepEqual(beat(t), [], t);
});

test("'haunting' is only the beat when it is the noun", () => {
  const ghosts = (t: string) => classifyTopics(t).includes("ghosts");
  for (const t of [
    "Investigators document hauntings across the county",
    "Reports of a haunting at the old mill",
    "The haunting of Borley Rectory revisited",
    "Family flees after violent haunting",
    "Most haunted pub in Britain reopens",
  ]) assert.equal(ghosts(t), true, t);

  // Adjectival "haunting" is ordinary English and was tagging news photography.
  for (const t of [
    "25 years ago, a NASA astronaut captured this haunting photo of the 9/11 attacks",
    "A haunting melody echoes through the abandoned theatre",
    "The haunting beauty of the Scottish highlands",
  ]) assert.equal(ghosts(t), false, t);
});
