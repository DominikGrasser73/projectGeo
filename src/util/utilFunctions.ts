import L, { Marker } from 'leaflet';

export function createMarker(coords: L.LatLng): Marker {
  return L.marker(coords, {
    icon: L.icon({
      iconSize:    [25, 41],
      iconAnchor:  [13, 41],
      iconUrl:       'leaflet/marker-icon.png',
      iconRetinaUrl: 'leaflet/marker-icon-2x.png',
      shadowUrl:     'leaflet/marker-shadow.png'
    })
  });
}

export function isMarkerInsidePolygon(marker: L.LatLng, poly: L.Polygon): boolean {
  const x = marker.lat, y = marker.lng;
  const latLngs = poly.getLatLngs();

  const flatten = (rings: any): L.LatLng[][] => {
    if (!Array.isArray(rings[0]))       return [rings as L.LatLng[]];
    if (!Array.isArray(rings[0][0]))    return rings as L.LatLng[][];
    return rings.flat() as L.LatLng[][];
  };

  for (const ring of flatten(latLngs)) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].lat, yi = ring[i].lng;
      const xj = ring[j].lat, yj = ring[j].lng;
      if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi) / (yj - yi) + xi))) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}
