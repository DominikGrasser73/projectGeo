import { Component, OnInit, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-easybutton';
import {ButtonModule} from 'primeng/button';
import {DialogModule} from 'primeng/dialog';
import {DatePickerModule} from 'primeng/datepicker';
import { FormsModule } from '@angular/forms';


import states from '../../assets/bundesland2.json';
import bezirke from '../../assets/bezirke.json';
import gemeinden from '../../assets/gemeinden.json';
import { GeoJsonObject } from 'geojson';

@Component({
  selector: 'app-leaflet-map',
  templateUrl: './leaflet-map.component.html',
  styleUrls: ['./leaflet-map.component.scss'],
  imports: [ButtonModule, DialogModule,DatePickerModule, FormsModule],
})
export class LeafletMapComponent implements OnInit, AfterViewInit {

  
  private map!: L.Map
  visible: boolean = false;
  markerMode : boolean = false;
  markers: L.Marker[] = [
    L.marker([48.3771, 14.2894]) 
  ];
  districts: string[] = [];
  datetime24h: Date = new Date(2023, 10, 1, 12, 0, 0); // Example date and time
  name : string = 'Test';
  description : string = 'Test';
  coords = L.latLng(0, 0);
  constructor() { }

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.initMap();
    
    this.centerMap();
    L.geoJSON(bezirke as GeoJsonObject,
      {
        style: {
          color: '#ff0000',
          weight: 2,
          fillOpacity: 0.2
        },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(feature.properties.name);
          if (feature.properties.name == 'Bezirk Linz-Land') {
            (layer as L.Path).setStyle({ color: '#00ff00' }); // Change the color of the clicked feature
          }
          layer.on('click', (e) => {
            if (this.markerMode) {
              this.coords = e.latlng;
              this.visible = true;
              
            }
            else {
              this.map.setView(e.latlng, 10); // Zoom in on the clicked feature            
              (layer as L.Path).setStyle({ color: ((layer as L.Path).options.color == '#ff0000' ? '#00ff00' : '#ff0000') }); // Change the color of the clicked feature
              this.selectDistrict(feature.properties.name); // Add or remove the district from the list
              console.log(this.districts);
              console.log(feature);
            }

            // Handle the click event here
            
            
          });
        },
        
     

      }).addTo(this.map);
      
      L.easyButton('fa-tree', () => {
        this.currentLocation();
      }, 'Current Location').addTo(this.map);
      
  }


  private initMap() {
    const baseMapURl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    this.map = L.map('map');
    L.tileLayer(baseMapURl).addTo(this.map);
  }

  private centerMap() {
    // Create a boundary based on the markers
    const bounds = L.latLngBounds(this.markers.map(marker => marker.getLatLng()));

    
    // Fit the map into the boundary
    this.map.fitBounds(bounds);
    this.map.setView([47.9771, 14.2894 ], 9);
  }

  private selectDistrict(district: string) {
      if (this.districts.includes(district)) {
        this.districts.splice(this.districts.indexOf(district), 1);
  }
      else {
        this.districts.push(district);
      }
    console.log(this.districts);
  }

  public currentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.createMarker(L.latLng(lat, lng));
        L.circle([lat, lng], {
          color: 'blue',
          fillColor: '#30f',
          fillOpacity: 0.1,
          radius: 10000
        }).addTo(this.map);


        this.map.setView([lat, lng], 13);
      }, (error) => {
        console.error('Error getting location', error);
      });
    } else {
      console.error('Geolocation is not supported by this browser.');
    }

  }

  public createMarker(coords: L.LatLng): void {
    const marker = L.marker(coords, {
      icon: L.icon({
        iconSize: [ 25, 41 ],
        iconAnchor: [ 13, 41 ],
        iconUrl: 'leaflet/marker-icon.png',
        iconRetinaUrl: 'leaflet/marker-icon-2x.png',
        shadowUrl: 'leaflet/marker-shadow.png'
      })
    }).addTo(this.map).bindPopup('New Marker');
  }

  public createActivity(){
    const marker = L.marker(this.coords, {
      icon: L.icon({
        iconSize: [ 25, 41 ],
        iconAnchor: [ 13, 41 ],
        iconUrl: 'leaflet/marker-icon.png',
        iconRetinaUrl: 'leaflet/marker-icon-2x.png',
        shadowUrl: 'leaflet/marker-shadow.png'
      })
    }).addTo(this.map).bindPopup((this.name + ' ' + this.description + ' ' + this.datetime24h.toLocaleString()));
    this.visible = false;
  }

  changeMarkerMode() {
    this.markerMode = !this.markerMode;
    }

}



