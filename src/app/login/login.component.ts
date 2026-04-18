import { Component, EventEmitter, Output, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { AppState } from '../../util/types';

const API = 'http://localhost:3000/api';

export interface AddressResult {
  id: string;
  label: string;
  street: string;
  number: string;
  city: string;
  postcode: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-login',
  imports: [ButtonModule, DialogModule, FormsModule, PasswordModule, AutoCompleteModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnDestroy {
  visible = true;
  @Output() loginEvent = new EventEmitter<AppState>();
  @Output() userEvent = new EventEmitter<string>();

  // Form fields
  username = '';
  password = '';
  errorMessage = '';

  // Registration flow
  mode: 'login' | 'register' = 'login';
  step: 1 | 2 = 1;

  // Address search
  addressQuery = '';
  addressSuggestions: AddressResult[] = [];
  selectedAddress: AddressResult | null = null;
  private search$ = new Subject<string>();
  private searchSub = this.search$.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(q => this.http.get<AddressResult[]>(`${API}/addresses/search?q=${encodeURIComponent(q)}`))
  ).subscribe(results => this.addressSuggestions = results);

  // Map preview
  private previewMap: L.Map | null = null;
  private previewMarker: L.Marker | null = null;

  constructor(private http: HttpClient) {}

  ngOnDestroy() {
    this.searchSub.unsubscribe();
    this.destroyMap();
  }

  switchMode(mode: 'login' | 'register') {
    this.mode = mode;
    this.step = 1;
    this.errorMessage = '';
    this.selectedAddress = null;
    this.addressQuery = '';
  }

  handleLogin() {
    this.errorMessage = '';
    this.http.post<{ success: boolean; username: string; message?: string }>(
      `${API}/auth/login`,
      { username: this.username, password: this.password }
    ).subscribe({
      next: (res) => {
        this.loginEvent.emit({ state: 'activity' });
        this.userEvent.emit(res.username);
        this.visible = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message ?? 'Login failed';
      }
    });
  }

  goToLocationStep() {
    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter a username and password';
      return;
    }
    this.errorMessage = '';
    this.step = 2;
    setTimeout(() => this.initPreviewMap(), 150);
  }

  onAddressSearch(event: { query: string }) {
    this.search$.next(event.query);
  }

  onAddressSelect(address: AddressResult) {
    this.selectedAddress = address;
    if (this.previewMap) {
      const latlng = L.latLng(address.lat, address.lng);
      const icon = L.icon({
        iconUrl:       'assets/marker-icon.png',
        iconRetinaUrl: 'assets/marker-icon-2x.png',
        shadowUrl:     'leaflet/marker-shadow.png',
        iconSize:    [25, 41],
        iconAnchor:  [12, 41],
        popupAnchor: [1, -34],
        shadowSize:  [41, 41]
      });
      if (this.previewMarker) {
        this.previewMarker.setLatLng(latlng);
      } else {
        this.previewMarker = L.marker(latlng, { icon }).addTo(this.previewMap);
      }
      this.previewMap.setView(latlng, 15);
    }
  }

  handleRegister() {
    if (!this.selectedAddress) return;
    this.errorMessage = '';
    this.http.post<{ success: boolean; username: string; message?: string }>(
      `${API}/auth/register`,
      { username: this.username, password: this.password, addressId: this.selectedAddress.id }
    ).subscribe({
      next: (res) => {
        this.loginEvent.emit({ state: 'activity' });
        this.userEvent.emit(res.username);
        this.visible = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message ?? 'Registration failed';
      }
    });
  }

  private initPreviewMap() {
    this.destroyMap();
    this.previewMap = L.map('address-preview-map').setView([47.5162, 14.5501], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.previewMap);
  }

  private destroyMap() {
    if (this.previewMap) {
      this.previewMap.remove();
      this.previewMap = null;
      this.previewMarker = null;
    }
  }
}
