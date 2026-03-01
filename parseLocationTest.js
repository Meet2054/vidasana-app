const parseLocation = (loc) => {
  if (!loc) return { lat: null, lng: null };
  // Supabase returns PostGIS points often as strings like 'POINT(-118.24368 34.05223)'
  if (typeof loc === 'string' && loc.startsWith('POINT(')) {
    const coords = loc.replace('POINT(', '').replace(')', '').split(' ');
    return { lng: parseFloat(coords[0]), lat: parseFloat(coords[1]) };
  }
  if (loc.coordinates && Array.isArray(loc.coordinates)) {
    return { lng: loc.coordinates[0], lat: loc.coordinates[1] };
  }
  return { lat: null, lng: null };
};
console.log(parseLocation('POINT(-118.24368 34.05223)'));
console.log(parseLocation({coordinates: [-118.24368, 34.05223]}));
