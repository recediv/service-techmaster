import city from '../data/default-city.json' with { type: 'json' };

// The default MODX city (resource 344, TV city-sklonenie), not a Host resolver.
export const defaultCity = Object.freeze(city);
export const cityLocation = 'в ' + defaultCity.prepositional;

export function resolveCityText(value = '') {
  return String(value)
    // Reviewed public Contacts conditional. Resolve it before the generic MODX
    // tag pass, otherwise it silently removes the Tomsk telephone branch.
    .replace(/\[\[\s*!?city:is=`tomsk`:then=`([^`]*)`:else=`([^`]*)`\s*\]\]/gi, (_, tomsk) => tomsk)
    .replace(/\[\[\s*!?\$?city2\s*\]\]/gi, defaultCity.prepositional);
}

export function withCityLocation(value = '') {
  const text = String(value).trim();
  return text.endsWith(cityLocation) ? text : text + ' ' + cityLocation;
}
