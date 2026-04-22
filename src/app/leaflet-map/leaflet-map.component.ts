import { Component, OnInit, AfterViewInit, Input } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-easybutton';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { FormsModule } from '@angular/forms';
import { UpdateGoalsService } from '../update-goals.service';
import 'leaflet-routing-machine';
import 'leaflet-control-geocoder';

import states   from '../../assets/bundesland2.json';
import bezirke  from '../../assets/bezirke.json';
import gemeinden from '../../assets/gemeinden.json';
import { GeoJsonObject } from 'geojson';
import * as turf from '@turf/turf';

import { createMarker, isMarkerInsidePolygon } from '../../util/utilFunctions';
import { Activity, AppState } from '../../util/types';
import { ApiService, ActivityDTO } from '../api.service';

@Component({
  selector: 'app-leaflet-map',
  templateUrl: './leaflet-map.component.html',
  styleUrls: ['./leaflet-map.component.scss'],
  imports: [ButtonModule, DialogModule, DatePickerModule, FormsModule],
})
export class LeafletMapComponent implements OnInit, AfterViewInit {

  private map!: L.Map;
  geojson: any;
  @Input() user: string = '';
  @Input() state!: AppState;
  visible = false;
  districtsArray: string[] = [];
  statesArray: string[] = [];
  mapMode = 'states';
  activityOrRoutingMode = 'activity';
  userLocation: L.LatLng | null = null;

  // Activity form
  datetime24h: Date = new Date(2025, 6, 6, 12, 0, 0);
  name        = 'Test';
  description = 'Test';
  coords      = L.latLng(0, 0);
  layerName   = 'Test Layer';

  constructor(
    private updateGoalsService: UpdateGoalsService,
    private api: ApiService
  ) {}

  async ngOnInit() {
    navigator.geolocation.getCurrentPosition(pos => {
      this.userLocation = L.latLng(pos.coords.latitude, pos.coords.longitude);
    });
  }

  async ngAfterViewInit() {
    this.statesArray    = await this.api.getUserStates(this.user);
    this.districtsArray = await this.api.getUserDistricts(this.user);
    this.initMap();
    this.centerMap();
    this.changeMapState(this.mapMode);

    L.Marker.prototype.options.icon = L.icon({
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      iconUrl:       'assets/marker-icon.png',
      shadowUrl:     'leaflet/marker-shadow.png',
      iconSize:    [25, 41],
      iconAnchor:  [12, 41],
      popupAnchor: [1, -34],
      shadowSize:  [41, 41]
    });

    L.easyButton('fa-tree', () => this.currentLocation(), 'Current Location').addTo(this.map);
    this.loadActivities();
  }

  private initMap() {
    this.map = L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
  }

  private centerMap() {
    this.map.setView([47.9771, 14.2894], 9);
  }

  private selectArea(areaName: string, areaType: string) {
    const areas = areaType === 'districts' ? this.districtsArray : this.statesArray;
    const idx   = areas.indexOf(areaName);
    idx === -1 ? areas.push(areaName) : areas.splice(idx, 1);
  }

  changeActivityOrRoutingMode() {
    this.activityOrRoutingMode = this.activityOrRoutingMode === 'activity' ? 'routing' : 'activity';
  }

  async createActivity() {
    const marker = createMarker(this.coords).addTo(this.map);
    const popupContent = `
      <div><span>${this.name}</span><br>
      <button id="join-btn">Join Activity</button></div>`;
    marker.bindPopup(popupContent);
    marker.on('popupopen', () => {
      document.getElementById('join-btn')?.addEventListener('click', () => {
        this.joinActivity(marker.getLatLng(), marker);
      });
    });

    // Determine district when in states mode
    let districtName = this.layerName;
    if (this.mapMode === 'states') {
      const found = (bezirke as any).features.find((f: any) =>
        turf.booleanPointInPolygon([this.coords.lng, this.coords.lat], f)
      );
      districtName = found?.properties?.name ?? 'ERROR';
    }
    await this.api.saveActivity(this.name, this.description, this.datetime24h, this.coords.lat, this.coords.lng, districtName);
    this.visible = false;
  }

  changeMapState(state: string) {
    if (this.geojson) this.map.removeLayer(this.geojson);
    let data: GeoJsonObject;
    if (state === 'states') {
      data = states as GeoJsonObject; this.mapMode = 'states';
    } else if (state === 'districts') {
      data = bezirke as GeoJsonObject; this.mapMode = 'districts';
    } else {
      data = gemeinden as GeoJsonObject;
    }
    this.geojson = L.geoJSON(data, {
      style: (feature: any) => {
        const list = this.mapMode === 'states' ? this.statesArray : this.districtsArray;
        const active = feature?.properties && list.includes(feature.properties.name);
        return { color: active ? '#00ff00' : '#ff0000', weight: 2, fillOpacity: 0.2 };
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(feature.properties.name);
        layer.on('click', (e) => {
          if (this.state.state === 'activity' && this.activityOrRoutingMode === 'activity') {
            this.coords    = e.latlng;
            this.layerName = feature.properties.name;
            this.visible   = true;
          } else if (this.activityOrRoutingMode === 'routing') {
            this.routeToClick(this.map, e.latlng);
          } else {
            this.map.setView(e.latlng, 10);
            (layer as L.Path).setStyle({
              color: (layer as L.Path).options.color === '#ff0000' ? '#00ff00' : '#ff0000'
            });
            this.selectArea(feature.properties.name, this.mapMode);
          }
        });
      }
    }).addTo(this.map);
  }

  routeToClick(map: L.Map, latlng: L.LatLng) {
    if (!this.userLocation) { console.error('User location not set'); return; }
    (L as any).Routing.control({
      waypoints: [this.userLocation, latlng],
      show: true, collapsible: true, routeWhileDragging: true,
      router: (L as any).Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' })
    }).addTo(this.map);
  }

  saveSelectedAreas() {
    this.api.saveAreas(this.user, this.statesArray, this.districtsArray);
  }

  currentLocation() {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      L.circle([lat, lng], { color: 'blue', fillColor: '#30f', fillOpacity: 0.1, radius: 10000 }).addTo(this.map);
      this.map.setView([lat, lng], 13);
    }, err => console.error('Geolocation error', err));
  }

  async loadActivities() {
    const activities = await this.api.getActivities(this.statesArray, this.districtsArray);
    for (const a of activities) {
      const marker = createMarker(L.latLng(a.lat, a.lng));
      marker.bindPopup(`
        <div><span>${a.name}</span><br>${a.description}<br>${a.datetime}<br>
        <button id="join-btn-${a.lat}">Join Activity</button></div>`);
      marker.on('popupopen', () => {
        document.getElementById(`join-btn-${a.lat}`)?.addEventListener('click', () => {
          this.joinActivity(marker.getLatLng(), marker);
        });
      });
      marker.addTo(this.map);
    }
  }

  async joinActivity(coords: L.LatLng, marker: L.Marker) {
    await this.api.joinActivity(this.user, coords.lat, coords.lng);
    marker.setIcon(L.icon({
      iconSize: [25, 41], iconAnchor: [13, 41],
      iconUrl:       'assets/marker-icon-green.png',
      iconRetinaUrl: 'assets/marker-icon-2x-green.png',
      shadowUrl:     'leaflet/marker-shadow.png'
    }));
    const popup = `<div><button id="confirm-btn">Confirm Participation</button></div>`;
    marker.bindPopup(popup);
    marker.on('popupopen', () => {
      document.getElementById('confirm-btn')?.addEventListener('click', () => {
        this.confirmParticipation(coords, marker);
      });
    });
  }

  async confirmParticipation(coords: L.LatLng, marker: L.Marker) {
    const { valid } = await this.api.isValidActivity(this.user, coords.lat, coords.lng);
    if (!valid) { console.error('User is not participating in this activity'); return; }

    const [activityDetails, participants] = await Promise.all([
      this.api.getActivityByCoords(coords.lat, coords.lng),
      this.api.getActivityParticipants(coords.lat, coords.lng, this.user)
    ]);

    marker.setIcon(L.icon({
      iconSize: [25, 41], iconAnchor: [13, 41],
      iconUrl:       'assets/marker-icon-orange.png',
      iconRetinaUrl: 'assets/marker-icon-2x-orange.png',
      shadowUrl:     'leaflet/marker-shadow.png'
    }));

    const activity: Activity = { ...activityDetails, participants };
    this.updateGoalsService.updateData(activity);
  }

  async visitedLocations() {
    this.map.eachLayer(async (layer: L.Layer) => {
      const name = (layer as any).feature?.properties?.name;
      if (!name) return;
      const { count } = await this.api.getVisitedCount(this.user, name, this.mapMode);
      const color = count > 5 ? 'purple' : count > 2 ? 'orange' : count > 0 ? 'yellow' : 'black';
      const path  = layer as unknown as L.Path & { setStyle?: (s: any) => void };
      path.setStyle?.({ color });
    });
  }
}
