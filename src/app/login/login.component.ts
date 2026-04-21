import { Component, EventEmitter, Output, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { SelectModule } from 'primeng/select';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { AppState } from '../../util/types';

const API = 'http://localhost:3000/api';

export interface StreetResult {
  street: string;
  city: string;
  postcode: string;
  label: string;
}

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
  imports: [ButtonModule, DialogModule, FormsModule, PasswordModule, AutoCompleteModule, SelectModule, CommonModule],
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

  // Step 2a — street search
  streetQuery = '';
  streetSuggestions: StreetResult[] = [];
  selectedStreet: StreetResult | null = null;

  // Step 2b — number picker
  numberOptions: AddressResult[] = [];
  selectedAddress: AddressResult | null = null;

  private search$ = new Subject<string>();
  private searchSub = this.search$.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(q => this.http.get<StreetResult[]>(`${API}/addresses/streets?q=${encodeURIComponent(q)}`))
  ).subscribe(results => this.streetSuggestions = results);

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
    this.selectedStreet = null;
    this.streetQuery = '';
    this.numberOptions = [];
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

  onStreetSearch(event: { query: string }) {
    this.search$.next(event.query);
  }

  onStreetSelect(street: StreetResult) {
    this.selectedStreet = street;
    this.selectedAddress = null;
    this.numberOptions = [];
    this.http.get<AddressResult[]>(
      `${API}/addresses/numbers?street=${encodeURIComponent(street.street)}&city=${encodeURIComponent(street.city)}`
    ).subscribe(nums => {
      this.numberOptions = nums;
      if (this.previewMap && nums.length > 0) {
        const bounds = L.latLngBounds(nums.map(n => L.latLng(n.lat, n.lng)));
        this.previewMap.fitBounds(bounds, { padding: [40, 40] });
      }
    });
  }

  onNumberSelect(address: AddressResult) {
    if (!this.previewMap) return;
    const latlng = L.latLng(address.lat, address.lng);
    this.placeMarker(latlng, address);
    this.previewMap.setView(latlng, 15);
  }

  private houseIcon(): L.DivIcon {
    return L.divIcon({
      html: `<i class="pi pi-home" style="font-size:1.6rem; color:#3b82f6; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));"></i>`,
      className: '',
      iconSize:    [26, 26],
      iconAnchor:  [13, 26],
      popupAnchor: [0, -26]
    });
  }

  handleRegister() {
    if (!this.selectedAddress) return;
    this.errorMessage = '';
    const body = this.selectedAddress.id
      ? { username: this.username, password: this.password, addressId: this.selectedAddress.id }
      : { username: this.username, password: this.password, location: { lat: this.selectedAddress.lat, lng: this.selectedAddress.lng } };
    this.http.post<{ success: boolean; username: string; message?: string }>(
      `${API}/auth/register`, body
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

    this.previewMap.on('click', (e: L.LeafletMouseEvent) => {
      this.placeMarker(e.latlng, null);
    });
  }

  private placeMarker(latlng: L.LatLng, address: AddressResult | null) {
    if (this.previewMarker) {
      this.previewMarker.setLatLng(latlng);
    } else {
      this.previewMarker = L.marker(latlng, {
        icon:      this.houseIcon(),
        draggable: true
      }).addTo(this.previewMap!);

      this.previewMarker.on('dragend', () => {
        const pos = this.previewMarker!.getLatLng();
        this.selectedAddress = {
          ...this.selectedAddress!,
          lat: pos.lat,
          lng: pos.lng,
          id: '',
          label: `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
        };
      });
    }

    this.selectedAddress = address ?? {
      id: '',
      label: `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`,
      street: '', number: '', city: '', postcode: '',
      lat: latlng.lat,
      lng: latlng.lng
    };
  }

  private destroyMap() {
    if (this.previewMap) {
      this.previewMap.remove();
      this.previewMap = null;
      this.previewMarker = null;
    }
  }
}
