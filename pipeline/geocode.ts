/**
 * Where a sighting happened, from what the story says.
 *
 * This is deliberately conservative. A place name in a headline is usually not
 * a location: "the Roswell Daily Record" is a newspaper, "UFO history is being
 * shaped in Washington" is politics, and "Rhode Island dad saw Bigfoot in
 * Connecticut woods" names the witness's home before the sighting. So a place
 * only counts when a preposition puts an event there, or a dateline does, and
 * only when the headline reports something happening rather than discussing it.
 *
 * The result is a map of sightings that reached the news, not a sightings
 * database. Everything unresolved is simply absent, which is the honest
 * failure: a wrong pin is worse than no pin.
 */
import { KIND_RANK, lookup, type Place } from "./places.ts";
import type { Flag } from "./types.ts";
import { collapseWhitespace, stripHtml } from "./text.ts";

/** Something happened; it was not merely discussed. */
const EVENT =
  /\b(?:sight(?:ing|ed|ings)|spotted|seen|saw|witness(?:ed|es)?|encounter(?:ed|s)?|filmed|photograph(?:ed)?|captured|caught on|footage|video|reported|reports?|appeared|appears|hover(?:ing|ed)?|flew|flying|crash(?:ed|es)?|landed|tracks?|prints?|howls?|growls?|screams?|creature|craft|object|orbs?|lights?|figure|monster|beast|haunt\w*|apparition|abduct\w*|attack(?:ed)?|found|discovered|hunts?|search(?:ed|ing)?|expedition|investigat\w+|claims?|claimed|debris|wreckage|landing|flap)\b/i;

/**
 * A place inside a name is not a location. Newspapers, teams, universities and
 * institutions carry place names and go nowhere.
 */
const ORGANISATION =
  /\b(?:daily record|gazette|herald|tribune|chronicle|sentinel|dispatch|times|post|journal|university|college|institute|museum|library|airport|zoo|police department|sheriff'?s office|fire department|state fair|senate|congress|house of representatives|parliament|white house|pentagon|capitol|dc\b|d\.c\.)\b/i;

/**
 * Words the gazetteer knows as places that a headline almost never means as
 * one. Politics uses "in Washington" for the institution, and there really are
 * towns called March, May and August.
 */
const NOT_A_PLACE = new Set([
  "washington dc", "america", "britain", "uk", "march", "may", "august", "june", "april",
  "reading", "mobile", "normal", "boring", "hope", "eureka", "surprise", "why", "buffalo",
]);

const LOCATIVE = /\b(?:in|over|above|near|at|across|around|outside|off|through|along|beneath|under)\s+(?:the\s+)?((?:[A-ZÀ-Þ][\w'’.-]*(?:\s+(?:of|de|upon|on|the))?\s*){1,4})/g;
/** The beat nouns a place tends to sit in front of: "Colorado Bigfoot report". */
const BEAT_NOUN = "bigfoot|sasquatch|yeti|nessie|ufos?|uaps?|alien|abduction|ghosts?|haunt\\w*|poltergeist|monster|creature|cryptid|sighting|encounter|mystery|lights?";
/** "Colorado Bigfoot report", "Maine's Bigfoot hunt", "Vermont UFO sighting". */
// No apostrophe in the name class here, or "Maine's" is consumed whole and the
// possessive marker never matches.
const NAME = "[A-ZÀ-Þ][\\w.-]*";
const LEADING = new RegExp(`^((?:${NAME}\\s+){0,2}${NAME})(?:'s|’s)?\\s+(?:${BEAT_NOUN})`, "i");
const POSSESSIVE = new RegExp(`\\b((?:${NAME}\\s+){0,2}${NAME})(?:'s|’s)\\s+(?:${BEAT_NOUN})`, "g");
/** "Damariscotta, Maine" and "DAMARISCOTTA, Maine (AP) —" datelines. */
const COMMA_PAIR = /\b([A-ZÀ-Þ][\w'’.-]+(?:\s+[A-ZÀ-Þ][\w'’.-]+){0,2}),\s*([A-ZÀ-Þ][\w'’.-]+(?:\s+[A-ZÀ-Þ][\w'’.-]+){0,2})\b/g;

/**
 * Some creatures are inseparable from one place: Nessie is Loch Ness by
 * definition, Mothman is Point Pleasant. The headline names the location by
 * naming the thing, so these count — flagged as implied, never as reported.
 */
const IMPLIED: [RegExp, string][] = [
  [/\b(?:nessie|loch ness monster)\b/i, "Loch Ness"],
  [/\bmothman\b/i, "Point Pleasant"],
  [/\bskinwalker ranch\b/i, "Skinwalker Ranch"],
  [/\b(?:ogopogo)\b/i, "Okanagan Lake"],
  [/\bchamp\b(?=\s+(?:the|sighting|monster))/i, "Lake Champlain"],
  [/\bbray road\b/i, "Bray Road"],
  [/\bflatwoods monster\b/i, "Flatwoods"],
  [/\bfouke monster\b/i, "Fouke"],
  [/\bdover demon\b/i, "Dover"],
  [/\bhopkinsville goblin/i, "Hopkinsville"],
  [/\bphoenix lights\b/i, "Phoenix"],
  [/\bmarfa lights\b/i, "Marfa"],
  [/\broswell\b/i, "Roswell"],
  [/\brendlesham\b/i, "Rendlesham Forest"],
  [/\bkecksburg\b/i, "Kecksburg"],
  [/\bpascagoula\b/i, "Pascagoula"],
  [/\bjersey devil\b/i, "New Jersey"],
  [/\bnazca (?:lines|mummies)\b/i, "Nazca"],
  [/\bg[oö]bekli tepe\b/i, "Göbekli Tepe"],
];

/**
 * A gathering about the subject, held somewhere on purpose.
 *
 * The Mothman Festival happens at Point Pleasant every September; that is
 * Point Pleasant holding a festival, not Mothman appearing there.
 */
const GATHERING =
  /\b(?:festival|fest|convention|expo|symposium|conclave|jamboree|comic[- ]?con|parade|gala|county fair|state fair|meet-?up|camp-?out|vendors?|tickets?|line-?up|registration|attendees?|keynote|speaks at|to speak|panel|guest speakers?|hosts? the|will host|kicks off)\b/i;

/** Something made about the subject: a film, a book, a statue. Not an encounter. */
const PRODUCTION =
  /\b(?:films?\s+about|a\s+(?:new\s+)?(?:film|movie|documentary|book|novel|memoir|play|musical|comic)|documentar(?:y|ies)|(?:new|upcoming|hit|horror)\s+(?:film|movie|series|show|book)|box office|season\s+\d|episodes?|statues?|sculptures?|murals?|mascots?|exhibits?|exhibitions?|turns?\s+\w+\s+into\s+books?|into\s+a\s+book)\b/i;

/** A history column revisits an old case. The date on it is today's, the event's is not. */
const RETROSPECTIVE =
  /\b(?:today in history|on this day|this day in history|\d+\s+years ago|\d+(?:st|nd|rd|th)\s+anniversary|anniversary of)\b/i;

/** An object or show staged at a place, rather than something witnessed there. */
const STAGED =
  /\b(?:brings?\b[^.]{0,60}\b(?:to|into)\b|on display|new home|goes on show|unveiled at|commonwealth games|olympics)\b/i;

/** Flags the classifier already sets that mean this was never a sighting. */
const NOT_SIGHTING_FLAGS: ReadonlySet<Flag> = new Set<Flag>(["attraction", "gathering", "roundup", "notice"]);

/**
 * Whether a headline reports something witnessed, as opposed to something
 * organised, made or commemorated about the subject.
 *
 * This gate exists because the failure it prevents is invisible. A festival
 * headline places *well* — it names a town, usually the right one — so without
 * it a Mothman Festival pin sits at Point Pleasant looking exactly like a
 * sighting. Unplaceable stories are merely absent; these are wrong.
 *
 * Measured over the archive it removes 9 of 28 pins, every one of them a
 * festival, convention, attraction, film, sculpture or history column, and
 * keeps all 19 genuine reports — including the ones that read like
 * productions and are not: "Video: Five Horses Found Mutilated", a find
 * carried by Coast to Coast AM, and a Bigfoot "police hunt".
 */
export function isSightingReport(title: string, flags: readonly Flag[] = []): boolean {
  if (flags.some((f) => NOT_SIGHTING_FLAGS.has(f))) return false;
  return !GATHERING.test(title) && !PRODUCTION.test(title) && !RETROSPECTIVE.test(title) && !STAGED.test(title);
}

/** A criticism headline names places it is not reporting from. */
const CRITICISM = /\breview\b\s*[–—|:-]|[–—|]\s*review\b|\bsendup\b|\bstarring\b|\brecap\b/i;

export interface Located {
  place: Place;
  /** The exact words that resolved. */
  matched: string;
  from: "headline" | "dateline" | "implied";
}

/** Longest prefix of a capitalised run that is a known place. */
function resolveRun(run: string): { place: Place; matched: string } | undefined {
  const words = collapseWhitespace(run).replace(/[.,;:!?]+$/, "").split(" ").filter(Boolean);
  for (let n = Math.min(words.length, 4); n >= 1; n--) {
    const candidate = words.slice(0, n).join(" ");
    if (NOT_A_PLACE.has(candidate.toLowerCase())) continue;
    const place = lookup(candidate);
    if (place) return { place, matched: candidate };
  }
  return undefined;
}

function best(found: { place: Place; matched: string }[]): { place: Place; matched: string } | undefined {
  // The most specific wins: a town over the state it sits in.
  return found.sort((a, b) => KIND_RANK[a.place.kind] - KIND_RANK[b.place.kind])[0];
}

export function locateImplied(title: string): Located | undefined {
  // "The End of the Roswell Daily Record?" names a newspaper, not a place.
  if (ORGANISATION.test(title) || CRITICISM.test(title)) return undefined;
  for (const [re, name] of IMPLIED) {
    if (!re.test(title)) continue;
    const place = lookup(name);
    if (place) return { place, matched: name, from: "implied" };
  }
  return undefined;
}

export function locateHeadline(title: string): Located | undefined {
  if (CRITICISM.test(title)) return undefined;
  if (!EVENT.test(title) || ORGANISATION.test(title)) return undefined;
  const found: { place: Place; matched: string }[] = [];
  for (const m of title.matchAll(LOCATIVE)) {
    const hit = resolveRun(m[1]);
    if (hit) found.push(hit);
  }
  for (const m of title.matchAll(COMMA_PAIR)) {
    const city = resolveRun(m[1]);
    const region = resolveRun(m[2]);
    // "Damariscotta, Maine": trust the pair far more than either word alone.
    if (city && region && city.place.kind !== "country") found.push(city);
  }
  const leading = title.match(LEADING);
  if (leading) {
    const hit = resolveRun(leading[1]);
    if (hit) found.push(hit);
  }
  for (const m of title.matchAll(POSSESSIVE)) {
    const hit = resolveRun(m[1]);
    if (hit) found.push(hit);
  }
  const hit = best(found);
  return hit ? { ...hit, from: "headline" } : undefined;
}

/** Wire datelines: "DAMARISCOTTA, Maine (AP) — ..." at the very start of the text. */
export function locateDateline(text: string): Located | undefined {
  const head = collapseWhitespace(stripHtml(text)).slice(0, 160);
  const m = head.match(/^\(?([A-ZÀ-Þ][A-ZÀ-Þ\s.'-]{2,28}),\s*([A-ZÀ-Þ][\w'’.-]+(?:\s+[A-ZÀ-Þ][\w'’.-]+)?)\s*(?:\([^)]{1,20}\)\s*)?[—–-]/);
  if (!m) return undefined;
  const city = resolveRun(m[1].replace(/\s+/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()));
  const region = resolveRun(m[2]);
  const hit = city ?? region;
  return hit ? { ...hit, from: "dateline" } : undefined;
}

/**
 * Only the dateline. Running the locative pass over article prose was tried and
 * measured: it put Nessie sightings in Barcelona and a Bigfoot encounter in
 * Edinburgh, because a page mentions many places and only one of them is where
 * the thing happened. A dateline, by contrast, is the publisher stating it.
 */
export function locateBody(text: string): Located | undefined {
  return locateDateline(text);
}

/** Headline first: it is what an editor chose to say the story is about. */
export function locate(title: string, body?: string): Located | undefined {
  if (CRITICISM.test(title)) return undefined;
  return locateHeadline(title) ?? locateImplied(title) ?? (body ? locateBody(body) : undefined);
}
