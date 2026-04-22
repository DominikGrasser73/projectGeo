import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Goal, Activity } from '../util/types';

const API = 'http://localhost:3000/api';

export interface ActivityDTO {
  id: number;
  name: string;
  description: string;
  datetime: string;
  lat: number;
  lng: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // ── Users ──────────────────────────────────────────────────────────────────

  getUserStates(username: string): Promise<string[]> {
    return lastValueFrom(this.http.get<string[]>(`${API}/users/${username}/states`));
  }

  getUserDistricts(username: string): Promise<string[]> {
    return lastValueFrom(this.http.get<string[]>(`${API}/users/${username}/districts`));
  }

  getUserFriends(username: string): Promise<string[]> {
    return lastValueFrom(this.http.get<string[]>(`${API}/users/${username}/friends`));
  }

  getUserNetwork(username: string): Promise<{ name: string; count: number }[]> {
    return lastValueFrom(this.http.get<{ name: string; count: number }[]>(`${API}/users/${username}/network`));
  }

  saveAreas(username: string, states: string[], districts: string[]): Promise<any> {
    return lastValueFrom(this.http.post(`${API}/users/${username}/areas`, { states, districts }));
  }

  addFriend(username: string, friend: string): Promise<any> {
    return lastValueFrom(this.http.post(`${API}/users/${username}/friends`, { friend }));
  }

  // ── Activities ─────────────────────────────────────────────────────────────

  getActivities(states: string[], districts: string[]): Promise<ActivityDTO[]> {
    const params = `states=${states.join(',')}&districts=${districts.join(',')}`;
    return lastValueFrom(this.http.get<ActivityDTO[]>(`${API}/activities?${params}`));
  }

  saveActivity(name: string, description: string, datetime: Date, lat: number, lng: number, districtName: string): Promise<any> {
    return lastValueFrom(this.http.post(`${API}/activities`, {
      name, description, datetime: datetime.toISOString(), lat, lng, districtName
    }));
  }

  joinActivity(username: string, lat: number, lng: number): Promise<any> {
    return lastValueFrom(this.http.post(`${API}/activities/join`, { username, lat, lng }));
  }

  confirmParticipation(username: string, lat: number, lng: number): Promise<any> {
    return lastValueFrom(this.http.post(`${API}/activities/participated`, { username, lat, lng }));
  }

  getActivityByCoords(lat: number, lng: number): Promise<Activity> {
    return lastValueFrom(this.http.get<Activity>(`${API}/activities/by-coords?lat=${lat}&lng=${lng}`));
  }

  getActivityParticipants(lat: number, lng: number, username: string): Promise<string[]> {
    return lastValueFrom(this.http.get<string[]>(`${API}/activities/participants?lat=${lat}&lng=${lng}&username=${username}`));
  }

  isValidActivity(username: string, lat: number, lng: number): Promise<{ valid: boolean }> {
    return lastValueFrom(this.http.get<{ valid: boolean }>(`${API}/activities/valid?lat=${lat}&lng=${lng}&username=${username}`));
  }

  getVisitedCount(username: string, name: string, type: string): Promise<{ count: number }> {
    return lastValueFrom(this.http.get<{ count: number }>(`${API}/visited?username=${username}&name=${encodeURIComponent(name)}&type=${type}`));
  }

  // ── Goals ──────────────────────────────────────────────────────────────────

  getActiveGoals(username: string): Promise<Goal[]> {
    return lastValueFrom(this.http.get<Goal[]>(`${API}/goals/${username}`));
  }

  saveGoal(username: string, goal: Goal): Promise<any> {
    return lastValueFrom(this.http.post(`${API}/goals`, {
      username, goal: { ...goal, startDate: goal.startDate.toISOString() }
    }));
  }

  updateGoal(username: string, goal: Goal): Promise<any> {
    return lastValueFrom(this.http.put(`${API}/goals`, {
      username, goal: { ...goal, startDate: goal.startDate.toISOString() }
    }));
  }

  trackNewPeople(username: string, goalStartDate: Date, participants: string[]): Promise<{ count: number }> {
    return lastValueFrom(this.http.post<{ count: number }>(`${API}/goals/track-new-people`, {
      username, goalStartDate: goalStartDate.toISOString(), participants
    }));
  }

  trackVisited(goalStartDate: Date, location: string, locationType: string): Promise<{ count: number }> {
    return lastValueFrom(this.http.post<{ count: number }>(`${API}/goals/track-visited`, {
      goalStartDate: goalStartDate.toISOString(), location, locationType
    }));
  }

  isNewLocation(username: string, location: string, locationType: string): Promise<{ isNew: boolean }> {
    return lastValueFrom(this.http.get<{ isNew: boolean }>(
      `${API}/goals/is-new-location?username=${username}&location=${encodeURIComponent(location)}&locationType=${locationType}`
    ));
  }

  // ── Friends ────────────────────────────────────────────────────────────────

  getFriendsCount(username: string, participants: string[]): Promise<{ count: number }> {
    return lastValueFrom(this.http.post<{ count: number }>(`${API}/friends/count`, { username, participants }));
  }
}
