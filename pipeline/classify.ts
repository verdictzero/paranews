import type { Flag, Topic } from "./types.ts";

/** The science beat's own subjects. Named here so a guard can reuse it. */
const SCIENCE_SUBJECT =
  /\b(dark matter|dark energy|black holes?|event horizons?|neutron stars?|magnetars?|pulsars?|quasars?|supernovae?\b(?=[^.]{0,45}\b(?:stars?|stellar|explos\w+|exploded|remnants?|progenitors?|galax\w+|astronom\w+|telescopes?|cosmic|dark energy|light curves?|type ia|neutron|dataset|impostors?|universe|ever recorded)\b)|(?<=\b(?:brightest|distant|nearby|exploding|ancient|bright|massive|powerful|rare|type ia|type 1a|closest|nearest)\s)supernovae?|(?<=\b(?:hubble|webb|jwst|telescopes?|astronomers?|astrophysicists?|spotted|discovered|observed|detected|imaged|nasa|esa|chandra)\b[^.]{0,30})supernovae?|kilonovae?|gravitational waves?|gravitational lens\w+|neutrinos?|antimatter|cosmic rays?|fast radio bursts?|gamma[- ]ray bursts?|exoplanets?|habitable zones?|protoplanetary|accretion discs?|solar flares?|coronal mass ejections?|aurora (?:borealis|australis)|northern lights\b(?=[^.]{0,50}\b(?:visible|visibility|forecast|tonight|tomorrow|alert|seen|spotted|storms?|geomagnetic|solar|dazzl\w+|chance|states|activity)\b)|(?<=\b(?:see|seeing|watch|catch|spot|photograph\w*|chance of|forecast for)\b[^.]{0,30})northern lights|geomagnetic storms?|meteors?|meteorites?|meteor showers?|bolides?|(?:meteor|sky|green|blue|bright|massive|brilliant|giant) fireballs?|fireballs? (?:over|above|across|streak\w*|light\w* up|spotted|seen|captured|filmed)|asteroids?|comets?\b(?=[^.]{0,45}\b(?:sky|skies|orbits?|orbiting|tail|nucleus|solar system|sun|earth|telescopes?|astronomers?|observ\w+|visible|spotted|approach\w*|flyby|rendezvous|interstellar|meteors?|perihelion|coma|rising|streak\w*)\b)|comets?\s+(?:neowise|atlas|borisov|halley|encke|leonard|lovejoy|hale)|(?<=\b(?:interstellar|periodic|halley'?s|encke|neowise|hale[- ]bopp|lovejoy|leonard|borisov|3i\/atlas)\b[^.]{0,25})comets?|near[- ]earth objects?|particle accelerators?|large hadron collider|cern|higgs boson|standard model|string theory|quantum (?:computing|computers?|mechanics|entanglement|gravity|physics|tunnell?ing|states?|theory|supremacy|sensors?|materials?)|superconduct\w+|nuclear fusion|fusion reactors?|james webb|jwst|hubble (?:telescope|images?)|ligo|simulation (?:theory|hypothesis)|fermi paradox|drake equation|great filter|cosmic myster\w+|panspermia|astrobiolog\w+|hydrothermal vents?|extremophiles?|tardigrades?|bioluminescen\w+|mass extinctions?|supervolcano|geomagnetic reversals?|magnetic pole (?:reversal|flip)|deep[- ](?:sea|ocean) (?:creatures?|discover\w+|expeditions?|spiders?|life)|sea spiders?|midnight (?:zone|ocean)|abyssal (?:plain|zone|depths?)|hadal zone|astronomers?|astrophysicists?|cosmologists?|galax(?:y|ies)|nebulae?|milky way|space telescopes?|solar storms?|solar winds?|earth'?s magnetic field|magnetosphere|ionosphere|interstellar (?:comets?|objects?|visitors?)|3i\/atlas|oumuamua|(?:search|searching|searches|hunt|hunting)\w* for (?:extraterrestrial|alien|intelligent|non-?human)|extraterrestrial (?:life|intelligence|civili[sz]ations?|artificial intelligence|microbes?|biolog\w+)|alien life|biosignatures?|\bseti\b|second earth)\b/i;

/**
 * The room science is reported from: an observatory, a particle lab, a
 * research vessel. Never assigns a beat on its own — it only withholds one,
 * which is why it may be broader than the subjects above.
 *
 * Working science writes in exactly the register the Fortean beats were tuned
 * for. "Astronomers detect 84 mysterious objects in nearby galaxies", "a
 * strange signal keeps turning up in Earth's magnetic field", "strange
 * creatures seen riding giant sea spiders": read as wording, all three are
 * high strangeness; read as subjects, they are astronomy, geophysics and
 * marine biology. The subject wins, because Keel's beat is place-bound and
 * witnessed, and a galaxy is neither.
 *
 * The subjects are folded in so the two can never drift apart: "Scientists
 * Detect a Mysterious Signal That Could Be Dark Matter" named no observatory
 * and kept its Fortean tag until they were.
 */
const SCIENCE_AMBIENT =
  /\b(?:astronomers?|astrophysicists?|cosmologists?|physicists?|seismologists?|volcanolog\w+|pal(?:a)?eontolog\w+|marine biolog\w+|telescopes?|observator(?:y|ies)|galax(?:y|ies)|galactic|nebulae?|cosmic|cosmos|the universe|interstellar|solar system|milky way|(?:in|from|outer|deep) space|orbit(?:s|ing|al)?|spacecraft|space probes?|mars rovers?|light[- ]years?|star systems?|exoplanets?|magnetic fields?|magnetosphere|ionosphere|solar winds?|deep[- ](?:sea|ocean)|sea spiders?|midnight ocean|sea ?floor|ocean floor|midnight zone|abyssal|hadal|submersibles?|research vessels?|particle (?:accelerators?|physics|collisions?|colliders?)|collider|quantum|peer[- ]reviewed)\b/i;

const SCIENCE_CONTEXT = new RegExp(`${SCIENCE_SUBJECT.source}|${SCIENCE_AMBIENT.source}`, "i");

/**
 * A boom with a named cause is an accident report. "Loud boom: birthday horror
 * as explosion kills mum and son" ran on the Fortean beat for a week.
 */
const NAMED_CAUSE =
  /\b(?:gas explosions?|explosions? (?:kill|injur|destroy|level)\w*|blasts? (?:kill|injur)\w*|plane crash|air ?strikes?|missiles?|shelling|car bombs?|pipeline blasts?|controlled (?:detonation|explosion)|sonic booms? from|quarry blast)\b/i;

/** Either disqualifier, for the beats whose loose wording both of them reach. */
const MUNDANE_OR_SCIENCE = new RegExp(`${NAMED_CAUSE.source}|${SCIENCE_CONTEXT.source}`, "i");

/**
 * Keyword classification runs on the headline only. Used for "auto" sources
 * (multi-beat genre feeds, filtered science feeds) and to add secondary
 * topics to Google News items. Tuned for precision over recall: a wrong topic
 * is worse than a missed one because the source's default topic still applies.
 */
const TOPIC_RULES: { topic: Topic; re: RegExp; unless?: RegExp }[] = [
  {
    topic: "ufo",
    // "Close encounters of the X kind" is a headline formula the wire uses for
    // anything — golf, moose, bears, the AfD. Only the numbered kinds are the
    // Spielberg reference, so any other kind is somebody else's story; a bare
    // "close encounters" still counts, and "up-close encounters" never does.
    re: /\b(ufos?|uaps?|unidentified (?:aerial|anomalous|flying)|flying saucers?|aaro|alien (?:spacecraft|craft|abduction|encounter|contact|bod(?:y|ies)|mummies|technology)|space aliens?|roswell(?:'s|’s)?\s+(?:incident|crash|ufo|uap|slides?|debris|1947|aliens?|wreckage|coverups?|cover-ups?|mania|myster\w+|saucers?|recovery|witness\w*|files?|museum|festival)|(?:[a-z]+(?:'s|’s)|the [a-z]+)\s*['"‘’“”]?\s*roswell\b|area 51|close encounters? of the (?:first|second|third|fourth|fifth|3rd|4th|5th) kind|(?<!up[- ])close encounters(?! of the )|tic[- ]tac|(?:bright|glowing|mysterious|orange|white|red|multiple|strange|anomalous) orbs?|orbs? (?:over|above|in the sky)|giant disc|(?:disc|saucer|cigar)[- ]shaped|black triangles?|triangular (?:craft|object)|drone sightings?|disclosure|elizondo|grusch|coulthart|avi loeb|fravor|uap task force|galileo project|skinwalker|alien ships?|non-?human (?:intelligence|biologics?|craft)|nhi|crashed (?:craft|saucer)|crash retrievals?|reverse[- ]engineer\w*)\b/i,
  },
  {
    /*
     * The search for life is not the same story as the claim that it is here.
     * Astrobiology and SETI file "Search for Extraterrestrial Life", a paper
     * on organic carbon in a Martian riverbed, an SKA radio-telescope
     * programme — mainstream science with the beat's vocabulary, and eight of
     * them were on the UFO front page. The beat keeps the words when the
     * headline makes a claim: aliens that are here, visiting, or in contact.
     */
    topic: "ufo",
    re: /\b(extraterrestrials?|alien life|the aliens|aliens (?:are|exist|among|visit\w*|contact\w*))\b/i,
    unless: /\b(?:search(?:ing|es|ed)? for|hunt(?:ing)? for|look(?:ing)? for|astrobiolog\w+|biosignatures?|technosignatures?|microb\w+|organic (?:carbon|molecules?|matter|chemistry)|habitable|drake equation|radio telescopes?|\bseti\b|exoplanets?|origins? of life|finding life)\b/i,
  },
  {
    /*
     * The interstellar visitors are an astronomy story that became a UFO story
     * because Avi Loeb said the word. The composition papers — methanol,
     * nitrogen, where it formed, how old it is — never stopped being astronomy,
     * and nine of them ran on this beat. Science holds them by default; the
     * beat takes one back only when the headline argues it was made.
     */
    topic: "ufo",
    re: /\b(interstellar (?:object|visitor)s?|3i\/atlas|oumuamua)\b/i,
    unless: /^(?!.*\b(?:aliens?|extraterrestrials?|artificial|probes?|spacecraft|technolog\w+|loeb|ufos?|uaps?|nhi|non-?human|motherships?|intelligent|not natural)\b)/i,
  },
  {
    topic: "ghosts",
    // "Ghost" is physics' favourite metaphor and none of it is haunted: ghost
    // galaxies, the ghost particle (a neutrino), ghost imaging, phantom energy.
    unless: /\bghost (?:galax\w+|particles?|imaging|nuclei|nucleus|peaks?|branch(?:es)?|stars?)\b|\bphantom energy\b/i,
    re: /\b(ghosts?|ghostly(?=\s+(?:figures?|presences?|apparitions?|shapes?|forms?|entit(?:y|ies)|voices?|footsteps?|footprints?|woman|women|man|men|child|children|monk|nun|face|faces|image|images|encounters?|activity|possessions?|rituals?|attacks?|forces?|beings?|happenings?|goings?|tales?|stor(?:y|ies)|legends?|hauntings?|spirits?)\b)|haunted|hauntings\b|haunting\b(?=\s+(?:at|in|of|on|near|inside|that|which|was|is|began|continues|reported|claims?)\b|[.,;:!?"'\)]|$)|poltergeists?|paranormal|apparitions?|spirits? (?:of|in|at)|s[eé]ances?|exorcis(?:m|t|ts)|(?:something|someone|anything)\s+(?:demonic|ghostly|unholy)|demonic(?=\s+(?:figures?|presences?|apparitions?|shapes?|forms?|entit(?:y|ies)|voices?|footsteps?|footprints?|woman|women|man|men|child|children|monk|nun|face|faces|image|images|encounters?|activity|possessions?|rituals?|attacks?|forces?|beings?|happenings?|goings?|tales?|stor(?:y|ies)|legends?|hauntings?|spirits?)\b)|possession|ouija|medium(?:s|ship)?|afterlife|phantoms?|spectres?|specters?|shadow (?:people|figures?)|conjuring house|annabelle|warren collection|amityville|enfield (?:poltergeist|haunting)|most haunted|ghost hunters?|ghost hunting|(?:inhuman|evil|malevolent) spirits?|haunted dolls?|possessed dolls?|spirit box|met the devil|the devil at|satan(?:ic)?|demons?|overnight investigation|paranormal (?:investigat\w+|research\w+|group|team|society|activity))\b/i,
  },
  {
    topic: "cryptids",
    // "yeti" (coolers), "dogman" (children's books) and "jersey devil" (NHL) need context.
    re: /\b(bigfoot|sasquatch|cryptids?|cryptozoolog(?:y|ist|ists)|yeti (?:footprints?|sightings?|legend|myth|hunt|expedition|dna|scalp|creature)|abominable snowman|loch ness (?:monster|witness|sighting|creature|hunter|footage)s?|(?:in|on|at|over|from) loch ness|nessie|lake monsters?|sea (?:monsters?|serpents?)|dogman sightings?|mothman|chupacabras?|skinwalkers?|wendigo|yowie|thunderbird sightings?|jersey devil sightings?|goatman|ogopogo|mokele|thylacine|living dinosaurs?)\b/i,
  },
  {
    /*
     * High Strangeness, held to Keel. Not "anything odd": the beat is the
     * phenomenon Keel described — place-bound, deceptive, and indifferent to
     * which category it is supposed to belong to. Men in black, window areas
     * and flaps, phantom vehicles and callers, mutilations, falls of fish,
     * synchronicity, the ambient skyquakes and earth lights, and the psi and
     * survival research that reads the same terrain from the other end.
     *
     * Three things that used to live here have their own beats now: time
     * (temporal), the cosmos and the physics (science), and the loose
     * "unsolved mystery / mysterious remains" copy, which was archaeology's
     * or nobody's. That drift is why this beat needed tightening — an
     * atmospheric adjective is not high strangeness.
     *
     * Two of Keel's own terms cannot stand alone. One live pull of the new
     * query returned 21 headlines carrying "men in black" — a Fijian football
     * club, the film, the Will Smith single, an anti-migrant march — and not
     * one of them was MIB. "Window area" is glazing. Both need the phenomenon
     * named within a clause of them.
     */
    topic: "fortean",
    re: /\b(high strangeness|high weirdness|fortean|ultraterrestrials?|superspectrum|men in black\b(?=[^.]{0,40}\b(?:ufos?|uaps?|witness\w*|encounters?|encountered|visit\w*|sightings?|phenomen\w+|abduct\w+|mothman|contactees?|silenc\w+|paranormal|paranormal)\b)|(?<=\b(?:ufos?|uaps?|witness\w*|encounters?|encountered|visit\w*|sightings?|phenomen\w+|abduct\w+|mothman|contactees?|silenc\w+|paranormal|paranormal)\b[^.]{0,40})men in black|window areas?\b(?=[^.]{0,40}\b(?:ufos?|uaps?|witness\w*|encounters?|encountered|visit\w*|sightings?|phenomen\w+|abduct\w+|mothman|contactees?|silenc\w+|paranormal|paranormal)\b)|(?<=\b(?:ufos?|uaps?|witness\w*|encounters?|encountered|visit\w*|sightings?|phenomen\w+|abduct\w+|mothman|contactees?|silenc\w+|paranormal|paranormal)\b[^.]{0,40})window areas?|contactees?|indrid cold|crop circles?|cattle mutilations?|animal mutilations?|livestock mutilations?|black[- ]eyed (?:children|kids)|phantom (?:hitchhikers?|callers?|clowns?|vehicles?|aircraft|helicopters?|cars?|trains?)|black helicopters?|skyquakes?|earth ?lights|ley lines?|tree knocks?|wood knocks?|synchronicit(?:y|ies)|(?:ufo|sighting) flaps?|rains? of (?:fish|frogs)|rain(?:ed|ing) (?:fish|frogs)|(?:fish|frogs) (?:fell|falling|rained) from the sky|near[- ]death experiences?|shared death experiences?|terminal lucidity|out[- ]of[- ]body|reincarnation|past[- ]life (?:memor\w+|regression|recall)|past lives (?:research|memor\w+|stud\w+|regression|recall)|(?:recall\w*|remember\w*|stud(?:y|ies) of|research into) past lives|premonitions?|psychic|telepath(?:y|ic)|clairvoyan\w+|precognition|extrasensory perception|remote viewing|parapsycholog\w+|survival of consciousness|spontaneous human combustion|bermuda triangle|missing 411|dyatlov|skinwalker ranch|virgin mary|weeping (?:statue|madonna)|marian apparitions?|approved miracles|miracle (?:healing|cure)s?|lourdes|consciousness (?:exists )?beyond|life after death|the other side\b(?! of ))\b/i,
  },
  {
    /*
     * The atmospheric half of High Strangeness: the wording rather than the
     * named phenomenon. "Mysterious object", "strange lights", "unexplained
     * howls" are how a witness account reads, and they are also how a press
     * release from an observatory reads, so this half of the beat yields —
     * to a named mundane cause, and to science's own subjects.
     *
     * Kept apart from the rule above rather than guarded with it, because
     * Mothman does not stop being Mothman in a headline that mentions a
     * telescope. Only the wording defers.
     */
    topic: "fortean",
    re: /\b(anomalous (?:phenomen\w+|experiences?|objects?|craft|signals?|readings?)|unexplained (?:phenomen\w+|activity|noises?|sounds?|lights?|objects?|howls?|footage|video|events?|deaths?|disappearances?|marks?)|mysterious(?:ly)? (?:light|sound|boom|object|signal|creature|figure|craft)\w*|strange (?:noises?|sounds?|creatures?|lights?|objects?|figures?|animals?|signals?)|mystery (?:creatures?|objects?|lights?|animals?|booms?|noises?|sounds?|signals?)|(?:loud|mysterious|unexplained) booms?)\b/i,
    unless: MUNDANE_OR_SCIENCE,
  },
  {
    /*
     * Temporal anomalies. Time as the thing that has gone wrong, not time as
     * a figure of speech: slips and loops, the people who claim to have been
     * to 2198, the paradoxes physics argues about, and the Mandela effect,
     * where the past is what changed. Split out of High Strangeness, where
     * fifteen archived headlines were sitting under an unrelated label.
     *
     * "Timeline" is not here on purpose — every news explainer has one, and
     * neither is a bare "time travel": measured against one live pull of the
     * new queries, 67 of 91 headlines said it and most meant a heritage column
     * ("Time Travel Tuesday"), a guided walk, an aircraft parts firm called
     * Time Traveler, or "real-time travel data". So the two promiscuous terms
     * need a claim, a physicist or a year next to them; the distinctive ones —
     * slip, loop, Mandela — stand on their own.
     */
    topic: "temporal",
    re: /\b(time slips?|time loops?|time anomal\w+|temporal anomal\w+|chrononauts?|retrocausal\w+|closed timelike curves?|chronology protection|grandfather paradox|bootstrap paradox|causal loops?|mandela effect|glitch in the matrix|arrow of time|(?<!real[- ])time[- ]travell?(?:ers?|ing)?\b(?=[^.]{0,45}\b(?:real|really|proof|proves?|proven|evidence|claims?|claiming|hoax|debunk\w*|physics|scientific|science|theor(?:y|ies)|paradox|possible|impossible|machines?|experiments?|relativity|wormholes?|conspirac\w+|warns?|predicts?|reveals?|insists?|visited|year \d{3,4}|from \d{3,4}|from the year)\b)|(?<=\b(?:real|really|proof|proves?|proven|evidence|claims?|claiming|hoax|debunk\w*|physics|scientific|science|theor(?:y|ies)|paradox|possible|impossible|machines?|experiments?|relativity|wormholes?|conspirac\w+|warns?|predicts?|reveals?|insists?|visited|year \d{3,4}|from \d{3,4}|from the year)\b[^.]{0,45})(?<!real[- ])time[- ]travell?(?:ers?|ing)?)\b/i,
  },
  {
    /*
     * Science: the real thing, at the end of it that a Fortean reader turns
     * to first. Dark matter, what the sky drops, the physics that sounds
     * invented. The point of the beat is that a fireball which turns out to
     * be a fireball is still worth the front page — and that saying so is
     * the site's job as much as carrying the sighting was.
     *
     * Astronomy, physics and cosmology, plus the handful of earth and life
     * sciences with the same strangeness. Deliberately not everything a
     * science desk files: "study finds" is not a beat.
     *
     * "Comet" and "northern lights" are brands as often as they are objects.
     * One live pull returned a defence contract called COMET, a band called
     * Comet, a school team called the Comets, a Northern Lights EP and a
     * Northern Lights illumination display. Both terms need the sky nearby.
     */
    topic: "science",
    re: SCIENCE_SUBJECT,
    /*
     * A vendor's roadmap is commerce, not physics, and an energy MOU is
     * policy. Both arrive on the quantum and fusion queries every week —
     * "Mitsubishi Electric Invests In Optical Quantum Computer Hardware
     * Developer OptQC", "Tennessee, United Kingdom announce nuclear fusion
     * partnership". No vendor is named here: IonQ publishes real results too.
     */
    unless: /\b(?:invests? in|investments?|funding rounds?|series [a-e] rounds?|acquires?|acquisitions?|joint ventures?|partnerships?|joins? forces|memorand(?:um|a) of understanding|signs? (?:an? )?(?:mou|agreement|deal)|go[- ]to[- ]market|commerciali[sz]\w+|startups?|shareholders?|ipo|ufos?|uaps?|pentagon|department of war|disclosure|whistleblowers?|abduct\w+|crash retrievals?|grusch|elizondo|coulthart|sparks (?:theor\w+|speculation))\b/i,
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
    topic: "exoarchaeology",
    // Evidence of manufacture off Earth — which is not the same thing as the
    // search for life off Earth. Carbon chemistry on Mars is astrobiology and
    // belongs to no beat here; a monolith on Phobos is this one. Measured over
    // the archive, that line splits 22 off-world headlines 12 to 10 with
    // nothing ambiguous left over.
    re: /\b(exo[- ]?archaeolog\w+|xeno[- ]?archaeolog\w+|space archaeolog\w+|(?:lunar|martian) (?:anomal\w+|ruins?|artifacts?|monoliths?|structures?|towers?|obelisks?|pyramids?|domes?|bridges?|cit(?:y|ies)|bases?|walls?|roads?|machinery|spires?)|(?:anomal\w+|ruins?|artifacts?|monoliths?|structures?|towers?|obelisks?|pyramids?|domes?|bridges?|cit(?:y|ies)|bases?|walls?|roads?|machinery|spires?) on (?:the )?(?:moon|lunar surface|mars|martian surface|phobos|deimos|ceres|europa|titan|mercury|venus)|(?:traces?|signs?|remnants?) of (?:\w+ )?(?:extraterrestrial|alien|non-?human)[^.]{0,40}(?:moon|lunar|mars|martian|phobos|deimos)|(?:moon|lunar surface|mars|martian surface|phobos|deimos)[^.]{0,40}(?:traces?|signs?|remnants?) of (?:\w+ )?(?:extraterrestrial|alien|non-?human)|face on mars|cydonia (?:mensae|region|face|mesa)|blair cuspids|(?:phobos|mars|martian|lunar|moon) monoliths?|alien (?:megastructures?|artifacts?|probes?|machines?)|dyson (?:spheres?|swarms?)|technosignatures?|von neumann probes?|tabby'?s star|boyajian'?s star|nasa[^.]{0,16}(?:photo|image)[^.]{0,44}(?:spark\w*|theor\w*|alien|mysterious|anomal\w*|spot\w*|track\w*|footprint\w*)|(?:moon|lunar surface|mars|martian surface|phobos|deimos|ceres|europa|titan|mercury|venus)[^.]{0,16}(?:photo|image)[^.]{0,36}(?:spark\w*|theor\w*|mysterious|anomal\w*|spot\w*)|(?:moon|lunar surface|mars|martian surface|phobos|deimos|ceres|europa|titan|mercury|venus)[^.]{0,34}(?:alien|extraterrestrial|non-?human) technolog\w+|(?:alien|extraterrestrial|non-?human) technolog\w+[^.]{0,34}(?:moon|lunar surface|mars|martian surface|phobos|deimos|ceres|europa|titan|mercury|venus)|(?:not|may not) be of natural origin|artificial(?:ly)? origin|not natural in origin|martian sky|moon towers?|(?:moon|lunar surface|mars|martian surface|phobos)[^.]{0,26}(?:built by|artificially built|alien-built))\b/i,
    // Probed before it was built, and the probe killed two obvious terms.
    // "Structures on the moon" is mostly people planning to build them — laser
    // origami, spider robots, Artemis habitats — and "lunar anomaly detection"
    // is a machine-learning paper about craters. Neither is an artefact
    // somebody else left. An alien claim in the same headline overrides the
    // guard, so "Aliens Built Moon Towers" still counts.
    unless: /^(?!.*\b(?:aliens?|extraterrestrial|non-?human|ufos?|artificial origin)\b).*\b(?:astronauts?|artemis|regolith|3d[- ]print\w+|habitats?|colonis\w+|coloniz\w+|anomaly detection|machine learning|neural network|could help|could build|to build|will build|plans to build)\b/i,
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
  // A beat can have more than one rule — a strict half and a half that yields
  // to another beat — so the same topic can match twice. Order is TOPICS order.
  for (const r of TOPIC_RULES) if (r.re.test(title) && !r.unless?.test(title) && !out.includes(r.topic)) out.push(r.topic);
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
  // Promotion told through a performer: casting, roles, and what an actor "did
  // for" a production. A performer describing their own sighting is not this,
  // and does not match — that is a real claim and stays.
  /\b(?:next role|role will be|cast as|reprises?|portrayals?|studied\b[^.]{0,40}\bfor ['"‘’“”]|for (?:the )?(?:upcoming )?(?:film|movie|series))\b/i,
  /\b(?:frightfest|fantastic fest|sitges|sundance|cannes|tiff)\b/i,
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
  /\b(?:apple arcade|steam page|xbox|playstation|nintendo|dlc|battle pass|gacha|azur lane|castlevania|5e supplements?|ttrpg|board game|tabletop|cooperative [\w-]+ game|detective game)\b/i,
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
  /\bfirst look\b/i,
  // A bare "Teaser" is promotion in every one of the twelve headlines the
  // archive holds. The qualified rule above wanted the word "trailer", so six
  // members of one "Capturing Bigfoot" cluster went unflagged and the cluster
  // stayed under the half-entertainment threshold.
  /\bteasers?\b/i,
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
  /\breprints?\b/i,
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
  // A record release. UFO is a band as well as the beat, and "UFO 'Mechanix'
  // Expanded, Remastered & Reissued On Double CD & Triple Vinyl" reached the
  // front page. None of these words has a second life off the sleeve.
  /\b(?:remaster(?:s|ed|ing)?|reissue(?:s|d)?|expanded edition|double cd|vinyl|box sets?)\b/i,
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
 * Off-beat: the beat word belongs to something else, or the beat is being
 * sold rather than reported. "Procure Space ETF (NASDAQ: UFO)", "Norco
 * Bigfoot 2 for sale", "Raleigh Aaro girls soccer" — and a drinks brand's
 * million-dollar bounty, a tourism board's trail. Hidden from the site.
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
  /*
   * Sport. Golf borrows the beat harder than the rest of it: a Solheim Cup
   * preview ran as "Close encounters of the golfing kind", GolfWRX files
   * "WITB" gear posts, and the Thunderbird Collegiate is a college fixture.
   * The tournament names are here because those headlines need not say golf.
   * "Bogey" is not, and must not be: on this beat it is a radar contact.
   */
  /\b(?:wrestling|folkstyle|soccer|football|basketball|hockey|baseball|volleyball|lacrosse|rugby|cricket|golf(?:ers?|ing)?|dinghy|dinghies|regattas?|sailing club|yacht club|nfl|nba|nhl|mlb|ncaa|pga|lpga|ryder cup|solheim cup|witb|tee times?|bullpups|varsity|junior varsity|prep (?:girls|boys)|high school (?:girls|boys)|box score|final score|touchdown|playoffs?)\b/i,
  // Crypto spam rides any phrase with a future in it. "Time Traveler: If You
  // Don't Have An XRP Wallet, You Have Less Than 72 Hours" arrived on the new
  // temporal query the first time it ran. "blockchain" and "nft" are not
  // here: they are policy words too, and cost a real US disclosure story.
  /\b(?:crypto|bitcoin|ethereum|xrp|solana|dogecoin|altcoins?|memecoins?|token presale|airdrops?)\b/i,
  /*
   * Enterprise technology PR. The science beat's quantum query is 45 of its
   * first 235 headlines and about half were commerce rather than physics:
   * IonQ's Superion product line, D-Wave's definitive agreement with the
   * Commerce Department, an IBM innovation hub, "for banks, quantum computing
   * is both a threat to security and a chance to build resilience". The
   * physics keeps its own vocabulary — qubit, superconductor, tunneling,
   * dilution fridge — so this only has to name the commerce, and no vendor is
   * listed by name: IonQ publishes real results too.
   */
  /\b(?:product lines?|definitive agreements?|go[- ]to[- ]market|enterprise customers?|innovation hubs?|business value|expensive guesswork|whether to invest|q-day|data breach|cybersecurity|smart buildings?|tech boom|patenting|threat to security|data cent(?:er|re)s?|defen[cs]e deals?)\b/i,
  // A supernova is also a yacht, a trainer and an energy drink — and, on the
  // first live ingest, a sailing dinghy class racing at Loch Lomond. The star
  // is qualified in TOPIC_RULES; these are the objects that borrow the name.
  /\b(?:yachts?|superyachts?|trainers? \(|energy drinks?)\b/i,
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
  // A colourway. New Balance's 990v4 "Navy/Meteorite" reached the science beat
  // four times; the shoe is the only thing in the archive made of nubuck.
  /\b(?:new balance|sneakers?|colou?rways?|nubuck)\b/i,
  /\b(?:royal enfield|harley davidson|bobber|thunderbird \d{3}|\d{3,4}\s?cc)\b/i,
  /\b(?:launch system|launch vehicle|portable launch)\b/i,
  /*
   * A cash offer to the public. Hard Mountain Dew's $1M for proof of Bigfoot
   * ran on 33 outlets in two days and outscored every sighting on the site —
   * and only three of the 33 headlines said "bounty", so the rule has to
   * catch the offer rather than the word. The amount and what it is for are
   * the only things every version of it shares. Matched against the whole
   * archive it finds that campaign and nothing else.
   */
  /(?:(?:\$|£|€|us\$|a\$)\s?[\d.,]+\s*(?:million|billion|m\b|bn\b|k\b)?|\b[\d.,]+\s*(?:million|billion)\s*dollars?)[^.]{0,60}\b(?:proofs?|proves?|proving|prove|bount(?:y|ies)|rewards?|evidence|find|finding|catch|capture)\b/i,
  /\b(?:proofs?|proves?|proving|prove|bount(?:y|ies)|rewards?|evidence|find|finding|catch|capture)\b[^.]{0,60}(?:(?:\$|£|€|us\$|a\$)\s?[\d.,]+\s*(?:million|billion|m\b|bn\b|k\b)?|\b[\d.,]+\s*(?:million|billion)\s*dollars?)/i,
  /\b(?:sweepstakes?|giveaways?|prize draws?|enter to win|(?:new|cash|free|more) prizes|fun and prizes)\b/i,
  /*
   * A tourism trail is an itinerary a visitors bureau is marketing, not a
   * place something happened. One West Virginia Paranormal Trail produced
   * seventeen stories about its own new stop, and Connecticut's Haunted
   * History Trail a dozen more about its launch. A haunted hayride stays an
   * `attraction` and stays visible; this is the campaign around one.
   */
  /\b(?:paranormal|haunted history|ghost|ghost[- ]hunting|cryptid|folklore) trails?\b/i,
  /\b(?:ghost|cryptid|paranormal|dark|spooky) tourism\b/i,
  /\bdigital passports?\b/i,
  // A beat word that is a building. Fort Worth's convention centre arena has
  // been the "Flying Saucer" for 58 years, and its demolition surfaced as a
  // UFO story the moment the promotions above stopped outranking it.
  /\b(?:arena|coliseum|amphitheat(?:er|re)|convention cent(?:er|re)|civic cent(?:er|re))\b/i,
  // Ogopogo is a ski patrol zone at Big White as well as a lake monster, and
  // the zone wins its division awards every year. A patrol is not a sighting.
  /\bski patrol(?:s|lers?)?\b/i,
  /\b(?:ad|advert|commercial) (?:campaigns?|films?|spots?|brings?|features?|stars)\b/i,
  // AARO is the Pentagon office and also a Canadian trade association that runs
  // a charity golf day. A fundraising total is never a beat story.
  /\brais(?:e|es|ed|ing) (?:a\$|us\$|\$|£|€)[\d,.]+/i,
];

export function isOffbeat(title: string): boolean {
  return OFFBEAT.some((re) => re.test(title));
}

const ATTRACTION =
  /\b(haunted (?:house|houses|attraction|attractions|trail|trails|hayride|maze|mansion tickets)|halloween (?:event|events|attraction|attractions)|ghost tours?|escape rooms?|theme parks?|scare (?:zone|zones|actors?)|fright fest|spirit halloween|halloween horror nights)\b/i;

/**
 * A convention, festival, expo or contest about the beat.
 *
 * These are the single most repetitive thing on the wire: one Exeter UFO
 * Festival generated eight separate stories about its own schedule. The event
 * is not a report from the event.
 *
 * The exception is a headline that carries an actual claim rather than
 * logistics — a witness account given at a festival is still a witness
 * account, and the niece of the Hill abduction couple speaking about 1961 is
 * worth more than the vendor list that surrounds it.
 */
const GATHERING =
  /\b(?:festival|fest|convention|expo|symposium|conclave|jamboree|comic[- ]?con|parade|gala|county fair|state fair|meet-?up|camp-?out|calling contest|conference|vendors?|tickets?|line-?up|registration|attendees?|keynote|speaks at|guest speakers?|cirque|horror-themed circus|las vegas show|touring show|immersive (?:event|experience))\b/i;

/** A claim reported from the event, rather than the event's own housekeeping. */
const GATHERING_NEWSWORTHY =
  /\b(?:sighting|encounter(?:ed|s)?|spotted|saw\b|witness(?:ed|es)?|footage|new evidence|testimon\w+|reveals?|claim(?:s|ed)|hearings?|congress|senate|subcommittee|committee|pentagon)\b/i;

export function isGathering(title: string): boolean {
  if (!GATHERING.test(title)) return false;
  // A book launched at the event is the event's merchandise. "Turns her Bigfoot
  // sighting into books" names a sighting but is reporting a book.
  if (/\binto (?:a )?books?\b|\bbook (?:launch|signing)\b/i.test(title)) return true;
  return !GATHERING_NEWSWORTHY.test(title);
}

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
  if (isGathering(title)) out.push("gathering");
  if (isRoundup(title)) out.push("roundup");
  if (isNotice(title)) out.push("notice");
  return out;
}
