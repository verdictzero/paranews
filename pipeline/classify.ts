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
    re: /\b(ufos?|uaps?|unidentified (?:aerial|anomalous|flying)|flying saucers?|aaro|extraterrestrials?|alien (?:spacecraft|craft|abduction|encounter|contact|life|bod(?:y|ies)|mummies|technology)|space aliens?|roswell|area 51|close encounters?|tic[- ]tac|(?:bright|glowing|mysterious|orange|white|red|multiple|strange|anomalous) orbs?|orbs? (?:over|above|in the sky)|giant disc|(?:disc|saucer|cigar)[- ]shaped|black triangles?|triangular (?:craft|object)|drone sightings?|disclosure|elizondo|grusch|coulthart|avi loeb|fravor|uap task force|galileo project|skinwalker)\b/i,
  },
  {
    topic: "ghosts",
    re: /\b(ghosts?|ghostly|haunted|hauntings?|poltergeists?|paranormal|apparitions?|spirits? (?:of|in|at)|s[eé]ances?|exorcis(?:m|t|ts)|demonic|possession|ouija|medium(?:s|ship)?|afterlife|phantoms?|spectres?|specters?|shadow (?:people|figures?))\b/i,
  },
  {
    topic: "cryptids",
    // "yeti" (coolers), "dogman" (children's books) and "jersey devil" (NHL) need context.
    re: /\b(bigfoot|sasquatch|cryptids?|cryptozoolog(?:y|ist|ists)|yeti (?:footprints?|sightings?|legend|myth|hunt|expedition|dna|scalp|creature)|abominable snowman|loch ness monster|nessie|lake monsters?|sea (?:monsters?|serpents?)|dogman sightings?|mothman|chupacabras?|skinwalkers?|wendigo|yowie|thunderbird sightings?|jersey devil sightings?|goatman|ogopogo|mokele|thylacine|living dinosaurs?)\b/i,
  },
  {
    topic: "fortean",
    re: /\b(unexplained|high strangeness|fortean|anomal(?:y|ies|ous)|crop circles?|mysterious(?:ly)? (?:disappear|vanish|death|light|sound|boom|object|signal|creature|figure|craft)\w*|vanished? without a trace|unsolved myster(?:y|ies)|near[- ]death experiences?|out[- ]of[- ]body|reincarnation|premonitions?|psychic|telepath(?:y|ic)|remote viewing|time slips?|simulation theory|mandela effect|spontaneous human combustion|cursed|the curse of|ancient (?:aliens|astronauts|mystery)|lost civili[sz]ation|atlantis|bermuda triangle|missing 411|dyatlov|skinwalker ranch|men in black|rains? of (?:fish|frogs))\b/i,
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

const ATTRACTION =
  /\b(haunted (?:house|houses|attraction|attractions|trail|trails|hayride|maze|mansion tickets)|halloween (?:event|events|attraction|attractions)|ghost tours?|escape rooms?|theme parks?|scare (?:zone|zones|actors?)|fright fest|spirit halloween|halloween horror nights)\b/i;

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
export function classifyFlags(title: string): Flag[] {
  const out: Flag[] = [];
  if (isEntertainmentTitle(title) || isOffTopic(title)) out.push("entertainment");
  if (ATTRACTION.test(title)) out.push("attraction");
  return out;
}
