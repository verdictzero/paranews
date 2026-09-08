declare module "all-the-cities" {
  /** One populated place from the bundled GeoNames extract. */
  export interface City {
    cityId: number;
    name: string;
    altName: string;
    /** ISO 3166-1 alpha-2. */
    country: string;
    featureCode: string;
    /** GeoNames admin1 code: a US state abbreviation, a numeric province code, and so on. */
    adminCode?: string;
    population: number;
    loc: { type: "Point"; coordinates: [number, number] };
  }
  const cities: City[];
  export default cities;
}
