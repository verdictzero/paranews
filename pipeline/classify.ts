import type { Flag, Topic } from "./types.ts";

/**
 * Keyword classification runs on the headline only. Used for "auto" sources
 * (multi-beat genre feeds, filtered science feeds) and to add secondary
 * topics to Google News items. Tuned for precision over recall: a wrong topic
 * is worse than a missed one because the source's default topic still applies.
 */
const TOPIC_RULES: { topic: Topic; re: RegExp }[] = [
  {
    topic: "ufo",
    re: /\b(ufos?|uaps?|unidentified (?:aerial|anomalous|flying)|flying saucers?|aaro|extraterrestrials?|alien (?:spacecraft|craft|abduction|encounter|contact|life|bod(?:y|ies)|mummies|technology)|space aliens?|roswell|area 51|close encounters\b|close encounter of the|tic[- ]tac|(?:bright|glowing|mysterious|orange|white|red|multiple|strange|anomalous) orbs?|orbs? (?:over|above|in the sky)|giant disc|(?:disc|saucer|cigar)[- ]shaped|black triangles?|triangular (?:craft|object)|drone sightings?|disclosure|elizondo|grusch|coulthart|avi loeb|fravor|uap task force|galileo project|skinwalker|alien ships?|the aliens|aliens (?:are|exist|among|visit\w*|contact\w*)|non-?human (?:intelligence|biologics?|craft)|nhi|interstellar (?:object|visitor)s?|3i\/atlas|oumuamua|crashed (?:craft|saucer)|crash retrievals?|reverse[- ]engineer\w*)\b/i,
  },
  {
    topic: "ghosts",
    re: /\b(ghosts?|ghostly|haunted|hauntings\b|haunting\b(?=\s+(?:at|in|of|on|near|inside|that|which|was|is|began|continues|reported|claims?)\b|[.,;:!?"'\)]|$)|poltergeists?|paranormal|apparitions?|spirits? (?:of|in|at)|s[eé]ances?|exorcis(?:m|t|ts)|demonic|possession|ouija|medium(?:s|ship)?|afterlife|phantoms?|spectres?|specters?|shadow (?:people|figures?)|conjuring house|annabelle|warren collection|amityville|enfield|most haunted|ghost hunters?|ghost hunting|ghostly|(?:inhuman|evil|malevolent) spirits?|haunted dolls?|possessed dolls?|spirit box|met the devil|the devil at|satan(?:ic)?|demons?|overnight investigation|paranormal (?:investigat\w+|research\w+|group|team|society|activity))\b/i,
  },
  {
    topic: "cryptids",
    // "yeti" (coolers), "dogman" (children's books) and "jersey devil" (NHL) need context.
    re: /\b(bigfoot|sasquatch|cryptids?|cryptozoolog(?:y|ist|ists)|yeti (?:footprints?|sightings?|legend|myth|hunt|expedition|dna|scalp|creature)|abominable snowman|loch ness (?:monster|witness|sighting|creature|hunter|footage)s?|(?:in|on|at|over|from) loch ness|nessie|lake monsters?|sea (?:monsters?|serpents?)|dogman sightings?|mothman|chupacabras?|skinwalkers?|wendigo|yowie|thunderbird sightings?|jersey devil sightings?|goatman|ogopogo|mokele|thylacine|living dinosaurs?)\b/i,
  },
  {
    topic: "fortean",
    re: /\b(high strangeness|fortean|crop circles?|unsolved myster(?:y|ies)|near[- ]death experiences?|shared death experiences?|terminal lucidity|out[- ]of[- ]body|reincarnation|past[- ]life (?:memor\w+|regression|recall)|past lives (?:research|memor\w+|stud\w+|regression|recall)|(?:recall\w*|remember\w*|stud(?:y|ies) of|research into) past lives|premonitions?|psychic|telepath(?:y|ic)|remote viewing|parapsycholog\w+|survival of consciousness|time slips?|time loops?|time anomal\w+|time travel(?:l?ers?)?|simulation theory|simulation hypothesis|mandela effect|spontaneous human combustion|bermuda triangle|missing 411|dyatlov|skinwalker ranch|men in black|rains? of (?:fish|frogs)|anomalous (?:phenomen\w+|experiences?|objects?|craft|signals?|readings?)|unexplained (?:phenomen\w+|activity|noises?|sounds?|lights?|objects?|howls?|footage|video|events?|deaths?|disappearances?|marks?)|mysterious(?:ly)? (?:light|sound|boom|object|signal|creature|figure|craft)\w*|strange (?:noises?|sounds?|creatures?|lights?|objects?|figures?|animals?|signals?)|mystery (?:creatures?|objects?|lights?|animals?|booms?|noises?|sounds?|signals?)|(?:loud|mysterious|unexplained) booms?|virgin mary|weeping (?:statue|madonna)|marian apparitions?|approved miracles|miracle (?:healing|cure)s?|lourdes|consciousness (?:exists )?beyond|life after death|the other side|fermi paradox|mysterious (?:find|discovery|remains|bones?|skull)s?|mystery (?:find|discovery|remains|bones?|skull)s?)\b/i,
  },
  {
    topic: "archaeology",
    // Anomalous archaeology, not archaeology. A Roman villa is a dig; a
    // structure nobody can explain, a chamber found by radar, or a site that
    // does not fit the timeline is this beat. Named sites are listed because
    // the anomaly is in the site, not in the wording of the headline.
    re: /\b(anomalous archaeolog\w+|forbidden archaeolog\w+|g[oö]bekli tepe|gunung padang|yonaguni|nan madol|puma ?punku|bimini road|derinkuyu|karahan tepe|elongated skulls?|paracas skulls?|giant skeletons?|nephilim|underwater (?:ruins?|cit(?:y|ies)|pyramids?|structures?)|sunken (?:cit(?:y|ies)|ruins?)|submerged (?:cit(?:y|ies)|ruins?)|hidden (?:chambers?|voids?)|(?:radar|lidar|sonar|scans?)[^.]{0,24}anomal\w+|subsurface anomal\w+|lost civili[sz]ation|lost city of|el dorado|percy fawcett|ancient (?:aliens|astronauts)|ancient astronaut theor\w+|mysterious (?:inscriptions?|monoliths?|ruins?|structures?)|unexplained (?:inscriptions?|ruins?|structures?)|megalithic (?:myster|anomal)\w*|impossible (?:engineering|masonry|geometry)|atlantis)\b/i,
  },
  {
    topic: "ooparts",
    // Out-of-place artifacts: an object in a context it should not be in.
    // Every name is qualified. Bare "oopart" is a Korean mobile game, bare
    // "antikythera" is a shipwreck dive site, and "crystal skull" without
    // "Indiana Jones" is still usually the film — which the entertainment
    // filter catches separately.
    re: /\b(out[- ]of[- ]place artifacts?|ooparts?|antikythera (?:mechanism|device|fragment)s?|baghdad batter(?:y|ies)|london hammer|coso artifact|klerksdorp spheres?|dorchester pot|aiud (?:wedge|aluminium|aluminum)|piri reis map|voynich manuscript|ica stones?|saqqara bird|dendera light|baigong pipes?|kensington runestone|bat creek stone|los lunas inscription|fuente magna|quimbaya (?:artifacts?|figurines?|aeroplanes?|airplanes?)|nazca (?:lines|mummies)|crystal skulls?|anachronistic (?:artifacts?|objects?|technolog\w+)|impossible artifacts?|anomalous artifacts?)\b/i,
  },
];

export function classifyTopics(title: string): Topic[] {
  const out: Topic[] = [];
  for (const r of TOPIC_RULES) if (r.re.test(title)) out.push(r.topic);
  return out;
}

/**
 * Entertainment: fiction and its promotion — films, television, games, books,
 * stage and music — plus the merchandise and fandom around them. Clusters
 * carrying this flag are hidden from the site (pipeline/visibility.ts), so
 * every pattern is deliberately contextual. Real stories say "witness films
 * three orbs", "investigation at the Opera House", "Victory Theatre claims
 * mysterious footage", "study shows", "hearing recap", "stranger things have
 * happened" and "real-life Ghostbusters"; none of those may match.
 */
const ENTERTAINMENT: RegExp[] = [
  // Screen
  /\bmovies?\b/i,
  /\b(?:horror|new|upcoming|indie|feature|short|sci-?fi|found[- ]footage|animated|monster|korean|japanese|bollywood|hollywood|hindi|tamil|telugu|malayalam|kannada|cult|classic|iconic) films?\b/i,
  /\bfilms? (?:reviews?|festivals?|adaptations?|franchises?|trailers?|premieres?|starring|directors?|studios?|releases?|posters?|universe)\b/i,
  // "A film about Bigfoot" names no genre, so the adjective rule above misses it.
  // "films about" is never a verb phrase, so this cannot catch "witness films three orbs".
  /\bfilms? about\b/i,
  /*
   * Criticism. The geocoder has refused these since the beginning — a review
   * names places it is not reporting from — but the entertainment classifier
   * never got the same rules, so "A Haunting in Venice 2023 REVIEW" ran as news.
   * The year anchor on the trailing form matters: a bare /review$/ would hide
   * "Congress orders UFO review".
   */
  /\breview\b\s*[–—|:-]/i,
  /[–—|]\s*review\b/i,
  /\b(?:19|20)\d{2}\s+review\s*$/i,
  /\bsendup\b/i,
  // Games. A cryptid is a mascot in half of them.
  /\b(?:apple arcade|steam page|xbox|playstation|nintendo|dlc|battle pass|gacha|azur lane|castlevania|5e supplements?|ttrpg)\b/i,
  // Music and club nights: Ben UFO is a DJ, Poltergeist 9000 a band.
  /\b(?:ben ufo|making music|open-air showcase|dj sets?|club night|residency|percussion)\b/i,
  /\b(?:tv|television|netflix|hulu|hbo|apple tv|streaming|animated|anthology|limited|drama|comedy|horror|reality|sci-?fi|hit|popular|paranormal tv) (?:shows?|series|specials?)\b/i,
  /\b(?:hulu|netflix|hbo|amazon|apple tv|paramount|disney|peacock|shudder)(?:'s)? (?:new |hit |original |upcoming |latest )?(?:shows?|series|specials?|movies?|films?|documentar(?:y|ies)|lineup|collection)\b/i,
  /\b(?:netflix|hulu|hbo|hbo max|apple tv|prime video|peacock tv|shudder|tubi|crunchyroll)\b/i,
  /(?:^|[^a-z0-9])(?:disney\+|paramount\+|apple tv\+|disney plus|paramount plus)(?![a-z])/i,
  /\bseason (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|finale|premiere)\b/i,
  /\bs\d{1,2}e\d{1,2}\b/i,
  /\bepisodes? (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|recaps?|guides?|reviews?|titles?|ranked)\b/i,
  /\bnew episodes?\b/i,
  /\bseries (?:finale|premiere|regulars?|creators?|renewed|cancell?ed|order)\b/i,
  /\b(?:showrunners?|screenwriters?|screenplays?|scripts?)\b/i,
  /\b(?:official|new|teaser|first|full|final|red[- ]band|debut|launch|overview) trailers?\b/i,
  /\btrailer (?:drops|dropped|released|reveals|for|debuts|teases|breakdown)\b/i,
  /\(trailer\)/i,
  /\bbox office\b/i,
  /\bopening weekend\b/i,
  /\brotten tomatoes\b/i,
  /\bimdb\b/i,
  /\bpremieres?\b/i,
  /\bhow to watch\b/i,
  /\bwhere to (?:watch|stream)\b/i,
  /\bwatch (?:online|free|now|it here)\b/i,
  /\bstreaming (?:now|on|guide|service|lineup|release|debut|documentary|premiere)\b/i,
  /\bnow streaming\b/i,
  /\bhits? (?:theaters|theatres|cinemas|screens|streaming)\b/i,
  /\bin (?:theaters|theatres|cinemas)\b/i,
  /\b(?:to|will) release in\b/i,
  /\b(?:sequels?|prequels?|spin-?offs?|reboots?|remakes?|franchises?|biopics?|docuseries|miniseries)\b/i,
  /\b(?:tv|film|movie|screen|stage|musical|series|feature) adaptations?\b/i,
  /\badaptation of\b/i,
  /\bhorror (?:films?|movies?|flicks?|scripts?|series|anthology|franchise|games?|novels?|comics?|icons?|directors?|classics?|thrillers?|comed(?:y|ies)|hits?|high jinks)\b/i,
  /\b(?:new|upcoming|indie|found[- ]footage|folk|supernatural|psychological|slasher|body|cosmic|gothic|a24|blumhouse|wild|religious|fantasy|korean) horror\b/i,
  /\bthrillers?\b/i,
  /\bblockbusters?\b/i,
  /\b(?:film|movie|special|advance|free|public|sneak) screenings?\b/i,
  /\bcinemas?\b/i,
  /\bsci-?fi\b/i,
  /\bscience fiction\b/i,
  /\b(?:rom-?coms?|romantic comed(?:y|ies)|sitcoms?|comed(?:y|ies))\b/i,
  /\b(?:cast members?|casting (?:news|call|announcement)|joins? the cast|the cast of|starring|to star in|co-stars?|star of (?:the )?(?:film|movie|show|series)|onscreen performance)\b/i,
  /\b(?:film|movie|tv|show|series|franchise|executive|blumhouse) producers?\b/i,
  /\b(?:jason blum|blumhouse|a24|lionsgate|warner bros|universal pictures|paramount pictures|sony pictures|pixar|dreamworks|marvel studios|dc studios)\b/i,
  // Books, comics, games
  /\b(?:new|debut|latest|horror|graphic|first|upcoming|his|her|their) novels?\b/i,
  /\bnovelists?\b/i,
  /\bbook (?:reviews?|excerpts?|clubs?)\b/i,
  /\b(?:new|best|upcoming|top) (?:kids'?|ya|children's|horror|fiction|fantasy) books\b/i,
  /\bbooks: week of\b/i,
  /\bcomics?\b/i,
  /\bcomic[- ]?books?\b/i,
  /\bgraphic novels?\b/i,
  /\b(?:manga|anime|isekai|manhwa|webtoon|light novels?|english dub)\b/i,
  /\bvideo ?games?\b/i,
  /\bgameplay\b/i,
  /\bdlc\b/i,
  /\b(?:playstation|xbox|nintendo|roblox|fortnite|minecraft|square enix|ubisoft|capcom|bethesda|rockstar games|epic games|steam deck|game pass|fallout \d+|until dawn)\b/i,
  /\bgame (?:shows?|trailers?|reviews?|releases?|devs?|developers?|studios?)\b/i,
  /\b(?:tokyo game show|gamescom|comic-?con|fan expo)\b/i,
  // Stage and music
  /\b(?:broadway|off-broadway|west end)\b/i,
  /\b(?:theatre|theater|stage|dance|puppet) (?:shows?|productions?|reviews?|compan(?:y|ies)|adaptations?|plays?|tickets)\b/i,
  /\bstage (?:play|musical|version)\b/i,
  /\bplaywrights?\b/i,
  /\bballets?\b/i,
  /\b(?:the|new|romance|rock|jukebox|stage|a) musical\b(?! instrument)/i,
  /\bmusical (?:opens|premieres?|reviews?|adaptations?|version|comedy|in london)\b/i,
  /\bopera (?:reviews?|premieres?|compan(?:y|ies)|singers?|productions?)\b/i,
  /\b(?:new|debut|latest) (?:single|album|ep|record|song|track)s?\b/i,
  /\balbum (?:reviews?|releases?)\b/i,
  /\b(?:rock|metal|punk|indie|hardcore|folk|jazz|pop|country|dark folk) bands?\b/i,
  /\bband spotlight\b/i,
  /\btour dates\b/i,
  /\bsetlists?\b/i,
  /\bsoundtracks?\b/i,
  /\bmusic videos?\b/i,
  /\bsingle slam\b/i,
  // Merchandise and fandom
  /\b(?:animatronics?|lego|funko|merch|collectibles?|action figures?|toy lines?|cosplay)\b/i,
  /\b(?:halloween|scary|animatronic) (?:props?|decorations?|decor|costumes?)\b/i,
  /\b(?:spoilers?|fan theor(?:y|ies))\b/i,
  /\b(?:movies|films|episodes|games|characters|villains|scenes|performances) (?:ranked|that|you|we)\b/i,
  /\bbest (?:horror|scary|scariest|paranormal|ghost|alien|ufo|sci-?fi|monster|creature|religious|exorcist-themed) (?:movies|films|shows|series|games|books|episodes)\b/i,
  /\b(?:movie|film|book|game|album|episode|season|series|dub|theatre|theater|tv|play) reviews?\b/i,
  /^review\b/i,
  /\breview ?[|:]/i,
  // Named franchises and shows. The quoted form keeps "reports of paranormal
  // activity" (the phenomenon) apart from 'Paranormal Activity' (the franchise).
  /['"]paranormal activity['"]/i,
  /\b(?:the conjuring(?! house)|(?<!real-life |real life )ghostbusters|beetlejuice|x-files|twilight zone|doctor who|skinwalker ranch|ancient aliens|expedition bigfoot|finding bigfoot|mountain monsters|paranormal caught on camera|kindred spirits|the dead files|ghost files|ghost adventures|john wick|sasquatch sunset|alien: earth)\b/i,
];

/**
 * Off-beat: a beat word used as a ticker, brand, product or team name.
 * "Procure Space ETF (NASDAQ: UFO)", "Norco Bigfoot 2 for sale", "Raleigh
 * Aaro girls soccer". Hidden from the site.
 */
const OFFBEAT: RegExp[] = [
  /\b(?:stock|share) prices?\b/i,
  /\bstocks?\b(?! footage)/i,
  /\b(?:etfs?|nasdaq|nyse|tsx|asx|lse|otc markets?|market cap|dividends?|earnings|valuation|financial ratios?|analyst (?:blog|ratings?|forecast)|price (?:forecast|target)|should you buy|buy or sell|ticker)\b/i,
  /\b(?:ltd|inc|corp|plc|gmbh|llc)\.?\b/i,
  /\b(?:digital marketing|press release|investor relations|quarterly results|q[1-4] results|ipo)\b/i,
  /\bfor sale\b/i,
  /\b(?:deal alert|coupon|discount code|promo code|% off|lowest price|price drop|black friday|prime day|labor day (?:sale|deals?)|best deals?)\b/i,
  /\b(?:smartphone|camera module|device design|leaked design|specs? leak|firmware|android devices?|iphone \d+|galaxy s\d+|iqoo|xiaomi|oneplus|realme|patch \d|patch notes|mmr|meta guide|codes \(|\(codes\)|redeem codes?|cards? guide|tier list)\b/i,
  /\b(?:wrestling|folkstyle|soccer|football|basketball|hockey|baseball|volleyball|lacrosse|rugby|cricket|nfl|nba|nhl|mlb|ncaa|bullpups|varsity|junior varsity|prep (?:girls|boys)|high school (?:girls|boys)|box score|final score|touchdown|playoffs?)\b/i,
  /\b(?:cabin crew|flight attendants?|pilots?) union\b/i,
  /\blufthansa\b/i,
  /\b(?:coolers?|tumblers?|drinkware|water bottles?|rambler)\b/i,
  /*
   * A beat word that is a company. UAP is a Bangladeshi university and a Kenyan
   * insurer, Yowie is an ASX confectioner, UFO is two separate tickers. Their
   * results announcements arrive on the beat every quarter, forever.
   */
  /\b(?:revenue|net loss|net income|full[- ]year results|fy\d{2}\b|h[12] results|narrows loss|shareholders?|price dynamics|execution-aware)\b/i,
  /\bsecures?\s+(?:a\$|us\$|\$|£|€)?[\d.]+\s*(?:million|billion|m\b|bn\b)/i,
  /\buap (?:old mutual|holdings|group|insurance|towers)\b|^uap\s+(?:honours?|honors?|celebrates?|announces?|launches?|partners?|reports?|appoints?)/i,
  /\b(?:betting odds|sportsbook|wagers?|payouts?)\b|\bodds\b[^.]{0,20}\bbets?\b/i,
  /*
   * A beat word that is a product. Ritchey's Bigfoot is a bicycle, Squier's
   * Paranormal a guitar, Rocket Lab's GHOST a launcher, and a Thunderbird is
   * usually a motorbike.
   */
  /\b(?:pedals?|handlebars?|drivetrain|groupset|derailleur|seatpost|frameset|crankset|hardtail)\b/i,
  /\b(?:squier|telecaster|stratocaster|signature guitar|fender launches)\b/i,
  /\b(?:royal enfield|harley davidson|bobber|thunderbird \d{3}|\d{3,4}\s?cc)\b/i,
  /\b(?:launch system|launch vehicle|portable launch)\b/i,
];

export function isOffbeat(title: string): boolean {
  return OFFBEAT.some((re) => re.test(title));
}

const ATTRACTION =
  /\b(haunted (?:house|houses|attraction|attractions|trail|trails|hayride|maze|mansion tickets)|halloween (?:event|events|attraction|attractions)|ghost tours?|escape rooms?|theme parks?|scare (?:zone|zones|actors?)|fright fest|spirit halloween|halloween horror nights)\b/i;

/**
 * Perennial service copy: "The 10 most haunted hotels in America, ranked",
 * "5 Haunted Places to Visit". Genuinely about the beat, and genuinely not
 * news — the same listicles are rewritten every autumn and, being fresh and
 * widely syndicated, they crowd out actual events.
 *
 * A contest, award or nomination is an event even when its name is a
 * superlative, so EVENT_TITLE clears them first: a hotel *nominated* for "Best
 * Haunted Hotel" is a story. The digit guard keeps "1,000 Haunted Objects"
 * from reading as a listicle of 1,000 items.
 */
const EVENT_TITLE = /\b(?:nominat\w*|contest|awards?|wins|won|voted|shortlist\w*|finalists?|crowned|named)\b/i;

const ROUNDUP: RegExp[] = [
  /(?<![\d,])\d{1,2}(?![\d,])\s+(?:of\s+the\s+)?(?:most|best|worst|scariest|creepiest|spookiest|weirdest|strangest|eeriest|haunted|creepy|spooky|terrifying|chilling|bizarre|unexplained|mysterious)\b/i,
  /\b(?:top|best)\s+(?<![\d,])\d{1,2}(?![\d,])\b/i,
  /\b(?:the\s+)?(?:most|best|scariest|creepiest|spookiest)\s+haunted\s+(?:places?|spots?|hotels?|towns?|cities|roads?|destinations?|pubs?|castles?|buildings?|houses?)\b/i,
  /\b(?:places?|spots?|destinations?|towns?|hotels?|sites?|ruins?)\s+(?:to\s+(?:visit|stay|explore|see)|you\s+(?:can|should|must)|(?:that\s+)?every[^.]{0,28}?(?:should|must|need to)\s+(?:visit|see|explore))\b/i,
  /,\s*ranked\b/i,
];

export function isRoundup(title: string): boolean {
  return !EVENT_TITLE.test(title) && ROUNDUP.some((r) => r.test(title));
}

/**
 * An organisation talking about itself: a researcher's podcast appearance, a
 * webinar, a call for papers, an artist talk. Scholarly feeds carry a lot of
 * this, and it was three of the seven official-tier stories on the site.
 *
 * Deliberately narrow. "to speak at" is NOT here: "Niece of N.H. couple famous
 * for alien abduction story to speak at Exeter UFO Festival" is a real story,
 * and it was a front-page one.
 */
const NOTICE =
  /\b(?:featured on|appears? on|presents? (?:on|at)\b|podcast feature|artist talk|webinar|call for papers|registration (?:is )?open|save the date|annual (?:meeting|conference)|newsletter|now accepting|join us|tickets? (?:are )?(?:on sale|available)|in memoriam)\b/i;

export function isNotice(title: string): boolean {
  return NOTICE.test(title);
}

/**
 * Not paranormal news under any reading: serialized fiction and its fandom.
 * "reincarnation" and "possession" alone pull in whole anime seasons. Dropped
 * at ingest so they never reach the archive.
 */
const OFF_TOPIC = /\b(anime|manga|isekai|manhwa|webtoon|light novel|k-?drama|episode \d+|ep\.? ?\d+|chapter \d+|season \d+ episode)\b/i;

export function isOffTopic(title: string): boolean {
  return OFF_TOPIC.test(title);
}

export function isEntertainmentTitle(title: string): boolean {
  return ENTERTAINMENT.some((re) => re.test(title));
}

/** Headline-only flags. Publisher-based signals are added in normalize.ts. */
/**
 * A headline that names nothing from any beat. The story reached the site
 * because a search matched its body, or because its source declares a beat for
 * everything it publishes — neither of which is evidence about this headline.
 */
export function namesNoBeat(title: string): boolean {
  return classifyTopics(title).length === 0;
}

export function classifyFlags(title: string): Flag[] {
  const out: Flag[] = [];
  if (isEntertainmentTitle(title) || isOffTopic(title)) out.push("entertainment");
  if (isOffbeat(title)) out.push("offbeat");
  if (ATTRACTION.test(title)) out.push("attraction");
  if (isRoundup(title)) out.push("roundup");
  if (isNotice(title)) out.push("notice");
  return out;
}
