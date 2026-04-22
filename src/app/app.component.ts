import { Component } from '@angular/core';
import { LeafletMapComponent } from './leaflet-map/leaflet-map.component';
import { LoginComponent } from './login/login.component';
import { AppState } from '../util/types';
import { SidebarComponent } from './sidebar/sidebar.component';
import { GoalificationDialogComponent } from './goalification-dialog/goalification-dialog.component';

@Component({
  selector: 'app-root',
  imports: [LeafletMapComponent, LoginComponent, SidebarComponent, GoalificationDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'projectGeo';
  state: AppState = { state: 'login' };
  user = '';

  loginChange(event: AppState) { this.state = event; }
  userChange(event: string)    { this.user  = event; }
}


