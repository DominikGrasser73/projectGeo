import { Component, OnInit, AfterViewInit, Input, } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-easybutton';
import {ButtonModule} from 'primeng/button';
import {DialogModule} from 'primeng/dialog';
import {DatePickerModule} from 'primeng/datepicker';
import { FormsModule } from '@angular/forms';
import { UpdateGoalsService } from '../update-goals.service';
import 'leaflet-routing-machine';
import 'leaflet-control-geocoder';

import states from '../../assets/bundesland2.json';
import bezirke from '../../assets/bezirke.json';
import gemeinden from '../../assets/gemeinden.json';
import { Neo4jComponent } from '../neo4j/neo4j.component';
import districtPoints from '../../assets/districtPoints.json';
import { GeoJsonObject } from 'geojson';
import { createDistrictsUtil, createMarker, getActivityByCoords, getActivityParticipants, getVisitedCount, loadUserDistricts, loadUserStates, runQuery, saveActivity, saveAreas, validActivity } from '../../util/utilFunctions';
import { Activity, AppState } from '../../util/types';
import { get } from 'node:http';

@Component({
  selector: 'app-leaflet-map',
  templateUrl: './leaflet-map.component.html',
  styleUrls: ['./leaflet-map.component.scss'],
  imports: [ButtonModule, DialogModule,DatePickerModule, FormsModule, ],
})
export class LeafletMapComponent implements OnInit, AfterViewInit {


  
  private map!: L.Map
  geojson: any;
  @Input() driver: any;
  @Input() user: string = '';
  visible: boolean = false;
  @Input() state!: AppState;
  districtsArray: string[] = [];
  statesArray: string[] = [];
  mapMode : string = 'states'; // Default map mode
  activityOrRoutingMode : string = 'activity';
  userLocation: L.LatLng | null = null;
  
  // Acivity properties
  datetime24h: Date = new Date(2025, 6, 6, 12, 0, 0); 
  name : string = 'Test';
  description : string = 'Test';
  coords = L.latLng(0, 0);
  layerName : string = 'Test Layer';
  


  constructor(private updateGoalsService: UpdateGoalsService) { }

  async ngOnInit() {  
    navigator.geolocation.getCurrentPosition((position) => {
      this.userLocation = L.latLng(position.coords.latitude, position.coords.longitude);
    });
  }
 


  async ngAfterViewInit() {
    const session = this.driver.session();
    this.statesArray = await loadUserStates(this.driver, this.user);
    this.districtsArray = await loadUserDistricts(this.driver, this.user);
    console.log('States:', this.statesArray);
    console.log('Districts:', this.districtsArray);
    this.initMap();
    this.centerMap();
    this.changeMapState(this.mapMode);
    const iconRetinaUrl = 'assets/marker-icon-2x.png';
    const iconUrl = 'assets/marker-icon.png';
    const shadowUrl = 'leaflet/marker-shadow.png';
    L.Marker.prototype.options.icon = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    //this.addRouting();

    L.easyButton('fa-tree', () => {
      this.currentLocation();
    }, 'Current Location').addTo(this.map);

      this.loadActivities(this.driver,this.user, this.map, this.statesArray,this.districtsArray)
      
  }


  private initMap() {
    const baseMapURl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    this.map = L.map('map');
    L.tileLayer(baseMapURl).addTo(this.map);
  }

  private centerMap() {
    // Create a boundary based on the markers
   
    
    // Fit the map into the boundary
    this.map.setView([47.9771, 14.2894 ], 9);
  }

  private selectArea(areaName: string, areaType: string) {
    var areas = this.statesArray;
    if (areaType === 'districts') {
      areas = this.districtsArray;
    }
    if (areas.includes(areaName)) {
        areas.splice(areas.indexOf(areaName), 1);
  }
      else {
        areas.push(areaName);
      }
    console.log(areas);
  }

  changeActivityOrRoutingMode() {
    this.activityOrRoutingMode = this.activityOrRoutingMode === 'activity' ? 'routing' : 'activity';
    console.log('Map state changed to:', this.activityOrRoutingMode);
  }

  public createActivity(){
    var marker = createMarker(this.coords).addTo(this.map);
    
    const popupContent = `
    <div>
      <span>${this.name}</span><br>
      <button id="join-btn">Join Activity</button>
    </div>
  `;
    marker.bindPopup(popupContent);
    marker.on('popupopen', () => {
      const joinButton = document.getElementById('join-btn');
      if (joinButton) {
        
        joinButton.addEventListener('click', () => {
          this.joinActivity(this.driver,this.user,marker.getLatLng(),marker);
        });
      }
    });
    saveActivity(this.driver, this.datetime24h, this.name, this.description, this.coords, this.layerName, this.mapMode);
    this.visible = false;
  }


  
  changeMapState(state: string){
    console.log('Change Map Mode to: ' + state);
    if (this.geojson) {
      this.map.removeLayer(this.geojson);
    }
    
    console.log('Change Map State to: ' + state);
    if (state === 'states') {
      var data = states as GeoJsonObject;
        this.mapMode = 'states';
      }
      else if (state ==='districts') {
        data = bezirke as GeoJsonObject;
        this.mapMode = 'districts';
      }else {
        data = gemeinden as GeoJsonObject;
      }
      this.geojson = L.geoJSON(data,
      {
        style: (feature: any) => {
          if (this.mapMode === 'states') {
            if (feature && feature.properties && this.statesArray.includes(feature.properties.name)) {
              return { color: '#00ff00', weight: 2, fillOpacity: 0.2 };
            } else {
              return { color: '#ff0000', weight: 2, fillOpacity: 0.2 };
            }
          } else if (this.mapMode === 'districts') {
            if (feature && feature.properties && this.districtsArray.includes(feature.properties.name)) {
              return { color: '#00ff00', weight: 2, fillOpacity: 0.2 };
            } else {
              return { color: '#ff0000', weight: 2, fillOpacity: 0.2 };
            }
          } else {
            return { color: '#3388ff', weight: 2, fillOpacity: 0.2 };
          }
        },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(feature.properties.name);
          
          layer.on('click', (e) => {
            if (this.state.state === 'activity' && this.activityOrRoutingMode === 'activity') {
              this.coords = e.latlng;
              this.layerName = feature.properties.name;
              this.visible = true;
              console.log('clicked on feature:', feature.properties.name);
              console.log('Coordinates:', e.latlng);
            } else if (this.activityOrRoutingMode === 'routing') {
            
              this.routeToClick(this.map, e.latlng);
            } else {
              this.map.setView(e.latlng, 10); // Zoom in on the clicked feature
              (layer as L.Path).setStyle({ color: ((layer as L.Path).options.color == '#ff0000' ? '#00ff00' : '#ff0000') }); // Change the color of the clicked feature
              this.selectArea(feature.properties.name,this.mapMode); // Add or remove the district from the list
            }
            
            // Handle the click event here
            
            
          });
        },
        
        
        
      }).addTo(this.map);
      
    }

    routeToClick(map: L.Map, latlng: L.LatLng) {

      if (!this.userLocation) {
        console.error('User location is not set');
        return;
      }

      (L as any).Routing.control({
        waypoints: [this.userLocation, latlng],
        show: true,
        collapsible: true,
          routeWhileDragging: true,
          router: (L as any).Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1'
          })
        }).addTo(this.map);
   

    }

    saveSelectedAreas() {
      saveAreas(this.driver, this.user, this.statesArray, this.districtsArray);
    }
    createDistricts() {
      createDistrictsUtil(this.driver, this.map);
}
public currentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      createMarker(L.latLng(lat, lng));
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



  async loadActivities(driver: any, user:string, map: L.Map, statesArray: string[], districtsArray: string[]) {
   const session = driver.session();
   for (const state of statesArray) {
     const query = 'MATCH (a:Activity)-[:TAKES_PLACE_IN]->(s:State {name: $state}) RETURN a';
     try {
       await session.run(query, { state: state })
         .then((result: any) => {
           result.records.forEach((record: { get: (arg0: string) => any; }) => {
             const activity = record.get('a');
             const coords = activity.properties.coords
             const marker = createMarker(L.latLng(coords.y, coords.x));
                 const popupContent = `
     <div>
       <span>${activity.properties.name}</span><br>${activity.properties.description}<br>${activity.properties.datetime24h}<br>
       <button id="join-btn">Join Activity</button>
     </div>
   `;
     marker.bindPopup(popupContent);
     marker.on('popupopen', () => {
       const joinButton = document.getElementById('join-btn');
       if (joinButton) {
        
         joinButton.addEventListener('click', () => {
           this.joinActivity(driver,user,marker.getLatLng(),marker);
         });
       }
     });
             marker.addTo(map);
           });
         });
     } catch (error) {
       console.error('Error running query:', error);
     }
 
   }
   for (const district of districtsArray) {
     const query = 'MATCH (a:Activity)-[:TAKES_PLACE_IN]->(d:District {name: $district}) RETURN a';
     try {
       await session.run(query, { district: district })
         .then((result: any) => {
           result.records.forEach((record: { get: (arg0: string) => any; }) => {
             const activity = record.get('a');
             const coords = activity.properties.coords;
             const marker = createMarker(L.latLng(coords.y, coords.x));
             const popupContent = `
     <div>
       <span>${activity.properties.name}</span><br>${activity.properties.description}<br>${activity.properties.datetime24h}<br>
       <button id="join-btn">Join Activity</button>
     </div>
   `;
     marker.bindPopup(popupContent);
     marker.on('popupopen', () => {
       const joinButton = document.getElementById('join-btn');
       if (joinButton) {
         joinButton.addEventListener('click', () => {
           this.joinActivity(driver,user,marker.getLatLng(),marker);
         });
       }
     });
             marker.addTo(map);
           });
         });
     } catch (error) {
       console.error('Error running query:', error);
     }
   }
 }

 async joinActivity(driver:any, user:string, coords: L.LatLng, marker: L.Marker) {
   const session = driver.session();
   marker.setIcon(L.icon({
     iconSize: [ 25, 41 ],
     iconAnchor: [ 13, 41 ],
     iconUrl: 'assets/marker-icon-green.png',
     iconRetinaUrl: 'assets/marker-icon-2x-green.png',
     shadowUrl: 'leaflet/marker-shadow.png'
   }));
   const popupContent = `<div>
       <button id="join-btn">Confirm Participation</button>
     </div>`;
   marker.bindPopup(popupContent);
   marker.on('popupopen', () => {
     const joinButton = document.getElementById('join-btn');
     if (joinButton) {
       joinButton.addEventListener('click', () => {
         this.confirmParticipation(driver, user, coords, marker);
       });
     }
   });
 
   const query = 'MATCH (a:Activity) WHERE a.coords = point({latitude: $lat, longitude: $lon}) MATCH (u:User {username: $username}) MERGE (u)-[:PARTICIPATES_IN]->(a) RETURN a';
   try {
     await session.run(query, { lat: coords.lat, lon: coords.lng, username: user })
       .then((result: any) => {
         result.records.forEach((record: { get: (arg0: string) => any; }) => {
                
         });
       });
   } catch (error) {
     console.error('Error running query:', error);
   } finally {
     session.close();
   }
 
 }


async confirmParticipation(driver: any, user: string, coords: L.LatLng, marker: L.Marker) {
  var valid =  await validActivity(driver, user, coords);
  console.log('Valid Activity Participation:', valid[0]);
  if (!valid[0]) {
    console.error('User is not participating in this activity.');
    return;
  }
  var activityDetails: Activity | null = await getActivityByCoords(driver, coords);
  var participants: any[] = await getActivityParticipants(driver,user,coords);
  
  marker.setIcon(L.icon({
     iconSize: [ 25, 41 ],
     iconAnchor: [ 13, 41 ],
     iconUrl: 'assets/marker-icon-orange.png',
     iconRetinaUrl: 'assets/marker-icon-2x-orange.png',
     shadowUrl: 'leaflet/marker-shadow.png'
   }));
 
  if (!activityDetails) {
    console.error('Activity not found for the given coordinates.');
    return;
  }
  var activity: Activity = {
    id: activityDetails.id,
    name: activityDetails.name,
    description: activityDetails.description,
    participants: participants,
    location: activityDetails.location,
    date: activityDetails.date,
    state: activityDetails.state,
    district: activityDetails.district
  };
  this.updateGoalsService.updateData(activity);
}

  visitedLocations() {
    this.map.eachLayer(async (layer: L.Layer) => {
      // Only proceed if the layer has GeoJSON feature properties with a name
      const feature = (layer as any).feature;
      var color = 'black';
      const name = feature && feature.properties && feature.properties.name;
      if (!name) {
        return;
      }
      try {
        var count = await getVisitedCount(this.driver, this.user, name, this.mapMode);
        console.log(`Visited count for ${name}: ${count}`);
        if (count > 5){
          color = 'purple';
        } else if (count > 2){
          color = 'orange';
        } else if (count > 0){
          color = 'yellow';
        }
        // use count if needed
      } catch (err) {
        console.error('Error getting visited count', err);
      }

      const path = layer as unknown as L.Path & { setStyle?: (style: any) => void };
      if (typeof path.setStyle === 'function') {
        path.setStyle({ color: color });
      }
    });
  }




}

