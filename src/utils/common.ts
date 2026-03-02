export const stringHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash += str.charCodeAt(i);
  }
  return hash;
};

/**
 * Parses a PostGIS location value into {lat, lng}.
 * Supports: PostGIS POINT string ("POINT(lng lat)") and GeoJSON ({coordinates: [lng, lat]}).
 */
export const parseLocation = (loc: any): {lat: number | null; lng: number | null} => {
  if (!loc) return {lat: null, lng: null};
  // PostGIS POINT string format: "POINT(lng lat)"
  if (typeof loc === 'string' && loc.startsWith('POINT(')) {
    const coords = loc.replace('POINT(', '').replace(')', '').split(' ');
    return {lng: parseFloat(coords[0]), lat: parseFloat(coords[1])};
  }
  // WKB / EWKB hex format returned by Supabase: "0101000020E610000..."
  if (typeof loc === 'string' && /^[0-9A-Fa-f]{42,}$/.test(loc)) {
    try {
      const bytes = new Uint8Array(loc.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
      const view = new DataView(bytes.buffer);
      const isLE = bytes[0] === 1; // 01 = little-endian
      const type = view.getUint32(1, isLE);
      const hasEWKBSrid = (type & 0x20000000) !== 0;
      const coordOffset = 5 + (hasEWKBSrid ? 4 : 0); // skip byte-order(1) + type(4) [+ srid(4)]
      const lng = view.getFloat64(coordOffset, isLE);
      const lat = view.getFloat64(coordOffset + 8, isLE);
      if (isFinite(lat) && isFinite(lng)) return {lat, lng};
    } catch {}
  }
  // GeoJSON format: { coordinates: [lng, lat] }
  if (loc.coordinates && Array.isArray(loc.coordinates)) {
    return {lng: loc.coordinates[0], lat: loc.coordinates[1]};
  }
  return {lat: null, lng: null};
};
