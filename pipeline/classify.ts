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

const FLAG_RULES: { flag: Flag; re: RegExp }[] = [
  {
    flag: "entertainment",
    re: /\b(reviews?|trailer|teaser|box office|season \d+|episodes?|streaming|netflix|hulu|prime video|disney\+|paramount\+|hbo|premieres?|cast(?:ing)?|movies?|films?|tv (?:show|series)|showrunner|sequel|prequel|remake|reboot|screenplay|scripts?|thrillers?|blockbusters?|screenings?|cinemas?|novel|comic|video ?games?|anime|soundtrack|album|single|bands?|tour dates|concert|podcast episode|spoilers?|episode recap|recap|animatronics?|lego|funko|toys?|action figures?|merch|broadway|west end|theatre|theater|musical|ballet|stage (?:show|production|adaptation)|playwright|opera|rom-?coms?|romantic comed(?:y|ies)|comed(?:y|ies)|sitcoms?|to star in|joins? (?:the )?cast|biopic|docuseries|miniseries|limited series|showtimes?|premiere date|release date)\b/i,
  },
  {
    flag: "attraction",
    re: /\b(haunted (?:house|houses|attraction|attractions|trail|trails|hayride|maze|mansion tickets)|halloween (?:event|events|attraction|attractions)|ghost tours?|escape rooms?|theme parks?|scare (?:zone|zones|actors?)|fright fest|spirit halloween|halloween horror nights)\b/i,
  },
];

/**
 * Not paranormal news under any reading: serialized fiction and its fandom.
 * "reincarnation" and "possession" alone pull in whole anime seasons.
 */
const OFF_TOPIC = /\b(anime|manga|isekai|manhwa|webtoon|light novel|k-?drama|episode \d+|ep\.? ?\d+|chapter \d+|season \d+ episode)\b/i;

export function isOffTopic(title: string): boolean {
  return OFF_TOPIC.test(title);
}

export function classifyFlags(title: string): Flag[] {
  const out: Flag[] = [];
  for (const r of FLAG_RULES) if (r.re.test(title)) out.push(r.flag);
  return out;
}
