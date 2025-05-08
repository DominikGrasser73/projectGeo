import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LeafletMapComponent } from "./leaflet-map/leaflet-map.component";


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LeafletMapComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'projectGeo';
}
