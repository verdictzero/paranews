/**
 * The gazetteer. Built once per process from two licensed datasets plus a
 * curated list, and used only at build time — the site ships the handful of
 * resolved points, never this.
 *
 *   all-the-cities  GeoNames extract (CC BY 4.0), 135k populated places
 *   world-countries country centroids
 *
 * Region centroids are computed from the cities in each region rather than
 * typed in, so no coordinate here is remembered rather than derived. The
 * curated list is the exception, and it exists because population is the wrong
 * tiebreak for this subject: "Roswell" is Roswell, Georgia by population and
 * Roswell, New Mexico by every other measure.
 */
import cities from "all-the-cities";
import countries from "world-countries";

export type PlaceKind = "landmark" | "city" | "region" | "country";

export interface Place {
  name: string;
  lat: number;
  lon: number;
  kind: PlaceKind;
  /** Enclosing region, for display: "New Mexico", "Scotland". */
  admin?: string;
  country?: string;
}

/** Smallest first: a landmark beats a city, a city beats the state it sits in. */
export const KIND_RANK: Record<PlaceKind, number> = { landmark: 0, city: 1, region: 2, country: 3 };

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "Washington DC", FL: "Florida", GA: "Georgia", HI: "Hawaii",
  ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const CA_PROVINCES: Record<string, string> = {
  "01": "Alberta", "02": "British Columbia", "03": "Manitoba", "04": "New Brunswick",
  "05": "Newfoundland and Labrador", "07": "Nova Scotia", "08": "Ontario", "09": "Prince Edward Island",
  "10": "Quebec", "11": "Saskatchewan", "12": "Yukon", "13": "Northwest Territories", "14": "Nunavut",
};

const GB_NATIONS: Record<string, string> = { ENG: "England", SCT: "Scotland", WLS: "Wales", NIR: "Northern Ireland" };

const AU_STATES: Record<string, string> = {
  "01": "Australian Capital Territory", "02": "New South Wales", "03": "Northern Territory",
  "04": "Queensland", "05": "South Australia", "06": "Tasmania", "07": "Victoria", "08": "Western Australia",
};

/**
 * Places whose significance to this subject is not their population. Every
 * coordinate is the well-known site, and the name is what a headline calls it.
 */
const CURATED: [string, number, number, string, string][] = [
  ["Roswell", 33.394, -104.523, "New Mexico", "US"],
  ["Area 51", 37.235, -115.811, "Nevada", "US"],
  ["Skinwalker Ranch", 40.257, -109.888, "Utah", "US"],
  ["Point Pleasant", 38.844, -82.137, "West Virginia", "US"],
  ["Loch Ness", 57.322, -4.424, "Scotland", "GB"],
  ["Rendlesham Forest", 52.086, 1.441, "England", "GB"],
  ["Rendlesham", 52.086, 1.441, "England", "GB"],
  ["Exeter", 42.981, -70.947, "New Hampshire", "US"],
  ["Marfa", 30.309, -104.021, "Texas", "US"],
  ["Kecksburg", 40.183, -79.464, "Pennsylvania", "US"],
  ["Flatwoods", 38.721, -80.653, "West Virginia", "US"],
  ["Fouke", 33.262, -93.887, "Arkansas", "US"],
  ["Willow Creek", 40.939, -123.632, "California", "US"],
  ["Bluff Creek", 41.351, -123.703, "California", "US"],
  ["Gulf Breeze", 30.357, -87.163, "Florida", "US"],
  ["Stephenville", 32.221, -98.202, "Texas", "US"],
  ["Socorro", 34.058, -106.891, "New Mexico", "US"],
  ["Levelland", 33.587, -102.378, "Texas", "US"],
  ["Rachel", 37.646, -115.745, "Nevada", "US"],
  ["Dulce", 36.936, -106.998, "New Mexico", "US"],
  ["Hopkinsville", 36.865, -87.492, "Kentucky", "US"],
  ["Pascagoula", 30.365, -88.556, "Mississippi", "US"],
  ["Lake Champlain", 44.533, -73.333, "Vermont", "US"],
  ["Okanagan Lake", 49.883, -119.6, "British Columbia", "CA"],
  ["Bray Road", 42.6, -88.433, "Wisconsin", "US"],
  ["Mount Shasta", 41.409, -122.195, "California", "US"],
  ["Maury Island", 47.4, -122.433, "Washington", "US"],
  ["Mount Rainier", 46.853, -121.76, "Washington", "US"],
  ["Bermuda Triangle", 25.0, -71.0, "", ""],
  ["Warminster", 51.204, -2.181, "England", "GB"],
  ["Bonnybridge", 56.0, -3.888, "Scotland", "GB"],
  ["Todmorden", 53.714, -2.096, "England", "GB"],
  ["Broad Haven", 51.78, -5.11, "Wales", "GB"],
  ["Berwyn Mountains", 52.87, -3.4, "Wales", "GB"],
  ["Varginha", -21.551, -45.43, "Minas Gerais", "BR"],
  ["Westall", -37.94, 145.12, "Victoria", "AU"],
  ["Nazca", -14.7, -75.133, "Ica", "PE"],
  ["Göbekli Tepe", 37.223, 38.922, "Şanlıurfa", "TR"],
  ["Gobekli Tepe", 37.223, 38.922, "Şanlıurfa", "TR"],
  ["Stonehenge", 51.179, -1.826, "England", "GB"],
  ["Yonaguni", 24.455, 123.011, "Okinawa", "JP"],
  ["Puma Punku", -16.562, -68.681, "La Paz", "BO"],
  ["Nan Madol", 6.845, 158.334, "Pohnpei", "FM"],
  ["Machu Picchu", -13.163, -72.545, "Cusco", "PE"],
  ["Damariscotta", 44.033, -69.518, "Maine", "US"],
];

/** Minimum population for a city to enter the gazetteer; smaller ones are noise. */
const MIN_POPULATION = 40_000;
/** Countries whose smaller towns still matter, because the beats are concentrated there. */
const DENSE = new Set(["US", "GB", "CA", "AU", "IE", "NZ"]);
const DENSE_MIN_POPULATION = 12_000;

let index: Map<string, Place> | undefined;

function add(map: Map<string, Place>, place: Place): void {
  const key = place.name.toLowerCase();
  const seen = map.get(key);
  // A curated place always wins; otherwise the more specific kind wins.
  if (!seen || KIND_RANK[place.kind] < KIND_RANK[seen.kind]) map.set(key, place);
}

export function gazetteer(): Map<string, Place> {
  if (index) return index;
  const map = new Map<string, Place>();

  for (const c of countries) {
    const [lat, lon] = c.latlng;
    add(map, { name: c.name.common, lat, lon, kind: "country", country: c.cca2 });
    if (c.name.common !== c.cca3) add(map, { name: c.cca3, lat, lon, kind: "country", country: c.cca2 });
  }
  add(map, { name: "Britain", lat: 54.0, lon: -2.0, kind: "country", country: "GB" });
  add(map, { name: "UK", lat: 54.0, lon: -2.0, kind: "country", country: "GB" });
  add(map, { name: "America", lat: 39.5, lon: -98.35, kind: "country", country: "US" });

  // Region centroids, weighted by the population of the cities inside them.
  const regions = new Map<string, { name: string; country: string; lat: number; lon: number; w: number }>();
  const regionName = (country: string, admin: string): string | undefined =>
    country === "US" ? US_STATES[admin] : country === "CA" ? CA_PROVINCES[admin] : country === "GB" ? GB_NATIONS[admin] : country === "AU" ? AU_STATES[admin] : undefined;

  for (const c of cities) {
    const min = DENSE.has(c.country) ? DENSE_MIN_POPULATION : MIN_POPULATION;
    const [lon, lat] = c.loc.coordinates;
    const region = regionName(c.country, c.adminCode ?? "");
    if (region) {
      const key = `${c.country}:${region}`;
      const acc = regions.get(key) ?? { name: region, country: c.country, lat: 0, lon: 0, w: 0 };
      acc.lat += lat * c.population;
      acc.lon += lon * c.population;
      acc.w += c.population;
      regions.set(key, acc);
    }
    if (c.population < min) continue;
    add(map, { name: c.name, lat, lon, kind: "city", admin: region, country: c.country });
  }
  for (const r of regions.values()) {
    if (r.w === 0) continue;
    add(map, { name: r.name, lat: r.lat / r.w, lon: r.lon / r.w, kind: "region", country: r.country });
  }

  for (const [name, lat, lon, admin, country] of CURATED) {
    map.set(name.toLowerCase(), { name, lat, lon, kind: "landmark", admin: admin || undefined, country: country || undefined });
  }

  index = map;
  return map;
}

/** Test seam. */
export function resetGazetteer(): void {
  index = undefined;
}

export function lookup(name: string): Place | undefined {
  return gazetteer().get(name.trim().toLowerCase());
}
