import L from 'leaflet';
import { Marker } from 'leaflet';
import neo4j, { session } from 'neo4j-driver';
import districtPoints from '../assets/districtPoints.json';
import { Activity, Goal } from './types';
import bezirke from '../assets/bezirke.json';
import { GeoJsonObject } from 'geojson';
import * as turf from '@turf/turf';


export async function  createDistrictsUtil(driver: any, map: L.Map) {

      const session = driver.session();
      for (const district of districtPoints.features) {
        const session = driver.session();
        const query = 'CREATE (d:District {name: $name, coordinates: $coordinates}) RETURN d';
        try {
          const result = await session.run(query, { 
            name: district.properties.name, 
            coordinates: JSON.stringify(district.geometry.coordinates) 
          });
          result.records.forEach((record: { get: (arg0: string) => any; }) => {
            console.log(record.get('d'));
          });
        } catch (error) {
          console.error('Error running query:', error);
        }
      
      map.eachLayer(async (layer) => {
        // Check if the layer is a Polygon or Polyline and if the district point is inside its bounds
        
        if ((layer instanceof L.Polygon || layer instanceof L.Polyline) && 
            layer.getBounds().contains(L.latLng(district.geometry.coordinates[1], district.geometry.coordinates[0]))) {
              if (layer.feature && layer.feature.properties && layer.feature.properties.name) {
                console.log(layer.feature.properties.name, layer);
              }
              if (isMarkerInsidePolygon(L.latLng(district.geometry.coordinates[1], district.geometry.coordinates[0]), layer)) {
          if (layer.feature && layer.feature.properties && layer.feature.properties.name) {
            console.log('District Point:', district.properties.name, 'is inside the layer:', layer.feature.properties.name);
            const session = driver.session();
            const relationshipQuery = 'MATCH (d:District {name: $districtName}), (s:State {name: $stateName}) CREATE (d)-[:LOCATED_IN]->(s)';
            try {
          const result = await session.run(relationshipQuery, { 
            districtName: district.properties.name, 
            stateName: layer.feature.properties.name
            
          });
          result.records.forEach((record: { get: (arg0: string) => any; }) => {
            console.log(record.get('d'));
          });
        } catch (error) {
          console.error('Error running query:', error);
        }
          }
        }
        }
      });
    }
    await session.close();
  }




export function createMarker(coords: L.LatLng): Marker {
    return L.marker(coords, {
      icon: L.icon({
        iconSize: [ 25, 41 ],
        iconAnchor: [ 13, 41 ],
        iconUrl: 'leaflet/marker-icon.png',
        iconRetinaUrl: 'leaflet/marker-icon-2x.png',
        shadowUrl: 'leaflet/marker-shadow.png'
      })
    });
  }

export async function saveAreas(driver: any, user: string, statesArray: string[], districtsArray: string[]) {
        
      for (const state of statesArray) {
        const session = driver.session();
        const query = 'MATCH (s:State {name: $state}), (u:User {username: $username} ) MERGE (u)-[int:INTERESTED_IN]->(s)';
        const properties = { state: state, username: user };
        await runQuery(driver, query, properties);
      }
       
      for (const district of districtsArray) {
        const query = 'MATCH (d:District {name: $district}), (u:User {username: $username} ) MERGE (u)-[int:INTERESTED_IN]->(d)';
        const session = driver.session();
        const properties = { district: district, username: user };
        await runQuery(driver, query, properties);
      }
    }

    export async function saveActivity(driver: any, datetime24h: Date, name: string, description: string, coords: L.LatLng, layerName: string, mapMode: string) {
      const session = driver.session();
      var query = ''
      var districtName = layerName;
      if (mapMode === 'states') {
        const foundFeature = bezirke.features.find((feature: any) => {
          const point = [coords.lng, coords.lat]; 
          return turf.booleanPointInPolygon(point, feature);
        });
        districtName = foundFeature?.properties.name ?? 'ERROR';
        console.log('District Name:', districtName);
         query = 'MATCH (d:District {name: $districtName}) CREATE (a:Activity {name: $name, description: $description, datetime24h: $datetime24h, coords: point({latitude:$lat, longitude:$lon})})-[:TAKES_PLACE_IN]->(d) RETURN a';
    }else if (mapMode === 'districts') {
         query = 'MATCH (d:District {name: $districtName}) CREATE (a:Activity {name: $name, description: $description, datetime24h: $datetime24h, coords: point({latitude:$lat, longitude:$lon})})-[:TAKES_PLACE_IN]->(d) RETURN a';
      }
      try {
        const result = await session.run(query, { 
          name: name, 
          description: description, 
          datetime24h: neo4j.types.DateTime.fromStandardDate(datetime24h), 
          lat: coords.lat, 
          lon: coords.lng, 
          districtName: districtName
        })
          .then((result: any) => {
            result.records.forEach((record: { get: (arg0: string) => any; }) => {
              console.log(record.get('a'));
            });
          });
      } catch (error) {
        console.error('Error running query:', error);
      } finally {
        session.close();
      }
  }

  export async function loadActivities(driver: any, user:string, map: L.Map, statesArray: string[], districtsArray: string[]) {
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
          joinActivity(driver,user,marker.getLatLng(),marker);
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
          joinActivity(driver,user,marker.getLatLng(),marker);
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

export async function joinActivity(driver:any, user:string, coords: L.LatLng, marker: Marker) {
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
        
      });
    }
  });

  const query = 'MATCH (a:Activity) WHERE a.coords = point({latitude: $lat, longitude: $lon}) MATCH (u:User {username: $username}) MERGE (u)-[:PARTICIPATES_IN]->(a) RETURN a';
  try {
    await session.run(query, { lat: coords.lat, lon: coords.lng, username: user })
      .then((result: any) => {
        result.records.forEach((record: { get: (arg0: string) => any; }) => {
          console.log('Joined activity:', record.get('a'));         
        });
      });
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }

}

    export function isMarkerInsidePolygon(marker: L.LatLng, poly: L.Polygon): boolean {
                  const x = marker.lat, y = marker.lng;

  
  const latLngs = poly.getLatLngs();

  const flatten = (rings: any): L.LatLng[][] => {
    if (!Array.isArray(rings[0])) return [rings as L.LatLng[]]; // single polygon
    if (!Array.isArray(rings[0][0])) return rings as L.LatLng[][]; // simple multipolygon
    return rings.flat() as L.LatLng[][]; // complex multipolygon
  };

  const points = flatten(latLngs);

  for (const ring of points) {
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].lat, yi = ring[i].lng;
      const xj = ring[j].lat, yj = ring[j].lng;

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi) / (yj - yi) + xi));

      if (intersect) inside = !inside;
    }

    if (inside) return true;
  }

  return false;

  

}

export async function loadUserStates(driver: any, user:string) {
  const session = driver.session();
  let statesArray: string[] = [];
  const query = 'MATCH (u:User {username: $username})-[:INTERESTED_IN]->(s:State) RETURN s';
    try {
    await session.run(query, { username: user })
      .then((result: any) => {
        result.records.forEach((record: { get: (arg0: string) => any; }) => {
          const state = record.get('s');
          statesArray.push(state.properties.name);
        });
      });
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
  return statesArray;
    
}

export async function loadUserDistricts(driver: any, user:string) {
  const session = driver.session();
  let districtsArray: string[] = [];
  const query = 'MATCH (u:User {username: $username})-[:INTERESTED_IN]->(d:District) RETURN d';
  try {
    await session.run(query, { username: user })
      .then((result: any) => {
        result.records.forEach((record: { get: (arg0: string) => any; }) => {
          const district = record.get('d');
          districtsArray.push(district.properties.name);
        });
      });
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
  return districtsArray;
}

export async function loadUserFriends(driver: any, user: string) {
  const session = driver.session();
  let friendsArray: string[] = [];
  const query = 'MATCH (u:User {username: $username})-[:FRIEND_WITH]->(f:User) RETURN f';
  try {
    await session.run(query, { username: user })
      .then((result: any) => {
        result.records.forEach((record: { get: (arg0: string) => any; }) => {
          const friend = record.get('f');
          friendsArray.push(friend.properties.username);
        });
      });
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
  return friendsArray;
}

export async function saveGoal(driver: any, user: string, goal: Goal) {
  const session = driver.session();
  const query = 'MATCH (u:User {username: $username}) MERGE (u)-[:HAS_GOAL]->(g:Goal {type: $type, subType: $subType, subSubType: $subSubType, single: $single, status: $status, progress: $progress, target: $target, startDate: $startDate}) RETURN g';
  try {
    await session.run(query, {
      username: user,
      type: goal.type,
      subType: goal.subType,
      subSubType: goal.subSubType,
      single: goal.single,
      status: goal.status,
      progress: goal.progress,
      target: goal.target,
      startDate: neo4j.types.DateTime.fromStandardDate(goal.startDate)
    }).then((result: any) => {
      result.records.forEach((record: { get: (arg0: string) => any; }) => {
        console.log('Goal created:', record.get('g'));
      });
    });
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
}

export async function loadActiveGoals(driver: any, user: string): Promise<Goal[]> {
  const session = driver.session();
  let goals: Goal[] = [];
  const query = 'MATCH (u:User {username: $username})-[:HAS_GOAL]->(g:Goal) RETURN g';
  try {
    await session.run(query, { username: user })
      .then((result: any) => {
        result.records.forEach((record: { get: (arg0: string) => any; }) => {
          const goal = record.get('g');
          if (goal.properties.status === 'Active'){
          goals.push({
            type: goal.properties.type,
            subType: goal.properties.subType,
            subSubType: goal.properties.subSubType,
            single: goal.properties.single,
            status: goal.properties.status,
            progress: goal.properties.progress,
            target: goal.properties.target,
            startDate: goal.properties.startDate.toStandardDate(),
          });
        }
        });
      });
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
  return goals;
 
}

export async function getActivityByCoords(driver: any, coords: L.LatLng): Promise<Activity | null> {
  const session = driver.session();
  let activity: Activity | null = null;
  const query = 'MATCH (a:Activity)-[:TAKES_PLACE_IN]->(d:District)-[:LOCATED_IN]->(s:State) WHERE a.coords = point({latitude: $lat, longitude: $lon}) RETURN a, d, s';
  try {
    await session.run(query, { lat: coords.lat, lon: coords.lng })
        .then((result: any) => {
        if (result.records.length > 0) {
          const record = result.records[0];
          const a = record.get('a');
          const d = record.get('d');
          const s = record.get('s');
          activity = {
            id: a.properties.id,
            name: a.properties.name,
            description: a.properties.description,
            date: a.properties.datetime24h.toStandardDate(),
            district: d.properties.name,
            state: s.properties.name,
            participants: [],
            location: { lat: a.properties.coords.y, lng: a.properties.coords.x }
          };
        }
      });
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
  return activity;
}

export async function getActivityParticipants(driver: any, user: string, coords: L.LatLng) {
  const session = driver.session();
  let participants: string[] = [];
  const query = 'MATCH (u:User)-[:PARTICIPATES_IN]->(a:Activity) WHERE a.coords = point({latitude: $lat, longitude: $lon}) AND u.username <> $username RETURN u';
  try {
    await session.run(query, { lat: coords.lat, lon: coords.lng, username: user })
      .then((result: any) => {
        result.records.forEach((record: { get: (arg0: string) => any; }) => {
          const participant = record.get('u');
          participants.push(participant.properties.username);
        });
      });
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
  return participants;
}

export async function getActivityState(driver: any, coords: L.LatLng) {
  const session = driver.session();
  let state: string | null = null;
  const query = 'MATCH (a:Activity) WHERE a.coords = point({latitude: $lat, longitude: $lon}) MATCH (s:State)<-[:TAKES_PLACE_IN]-(a) RETURN s';
  try {
    await session.run(query, { lat: coords.lat, lon: coords.lng })
      .then((result: any) => {
        if (result.records.length > 0) {
          state = result.records[0].get('s').properties.name;
        }else {
          
        }

      });
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
  return state;
}

export async function getFriendsNumber(driver: any, user: string, participants: string[]): Promise<number> {
  const session = driver.session();
  let friendsCount = 0;
  const query = 'MATCH (u:User)-[:FRIENDS_WITH]->(f:User) WHERE u.username = $username AND f.username IN $participants RETURN COUNT(f) AS friendsCount';
  try {
    await session.run(query, { username: user, participants: participants })
      .then((result: any) => {
        if (result.records.length > 0) {
          friendsCount = result.records[0].get('friendsCount');
        }
      });
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
  console.log('Friends Count:', friendsCount);
  return friendsCount;
}

export async function runQuery(driver: any, query: string, params: any) {
  const session = driver.session();
  let result: any = null;
  try {
    result = await session.run(query, params);
    
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
  return result;
}

export async function changeParticipatedIn(driver: any, user: string, activity: any) {
  await runQuery(driver, `MATCH (u:User)-[r:PARTICIPATED_IN]->(a:Activity) WHERE u.username = $username AND a.id = $activityId CREATE (u)-[r2:PARTICIPATED_IN]->(a) DELETE r`, {
    username: user,
    activityId: activity.id
  });
}

export async function updateGoal(driver: any, user: string, goal: Goal) {
  console.log(neo4j.types.DateTime.fromStandardDate(goal.startDate),"Goal to update");
  const query = 'MATCH (u:User {username: $username})-[:HAS_GOAL]->(g:Goal { startDate: $startDate}) SET g.status = $status, g.progress = $progress RETURN g';
  const params = {
    username: user,
    startDate: neo4j.types.DateTime.fromStandardDate(goal.startDate),
    status: goal.status,
    progress: goal.progress
  };
   const result = await runQuery(driver, query, params);
  
  return result;
}

export async function validActivity (driver: any, user: string, coords: L.LatLng) {
  const session = driver.session();
  let result: any = null;
  const query = 'MATCH (u:User{username: $username})-[:PARTICIPATES_IN]->(a:Activity{coords: point({latitude: $lat, longitude: $lon})}) RETURN count(a)';
  const params = {
    username: user,
    lat: coords.lat,
    lon: coords.lng
  };
  try {
    await session.run(query, params)
      .then((res: any) => {
        result = res.records.map((record: { get: (arg0: string) => any; }) => record.get('count(a)').toNumber());
        console.log('Valid Activity Query Result:', result);

      });
    
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
  return result
  ;
}

export async function getVisitedCount(driver: any, user: string, name: string, type: string) {
  const session = driver.session();
  let count: number = 0;
  let query: string;

  if (type === 'states') {
    query = 'MATCH (u:User{username: $username})-[:PARTICIPATED_IN]->(a:Activity)-[:TAKES_PLACE_IN]->(d:District)-[:LOCATED_IN]->(s:State {name: $name}) RETURN COUNT(s) AS visitedCount';
  } else if (type === 'districts') {
    query = 'MATCH (u:User{username: $username})-[:PARTICIPATED_IN]->(a:Activity)-[:TAKES_PLACE_IN]->(d:District {name: $name}) RETURN COUNT(d) AS visitedCount';
  } else {
    throw new Error('Invalid type');
  }

  try {
    await session.run(query, { username: user, name: name })
      .then((result: any) => {
        if (result.records.length > 0) {
          count = result.records[0].get('visitedCount');
        }
      });
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    session.close();
  }
  return count;
}


