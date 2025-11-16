import { Component, OnInit, Input, OnDestroy} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LeafletMapComponent } from "./leaflet-map/leaflet-map.component";
import { Neo4jComponent } from "./neo4j/neo4j.component";
import { LoginComponent } from "./login/login.component";
import neo4j from 'neo4j-driver';
import { AppState, Goal, GoalType } from '../util/types';
import { SidebarComponent } from "./sidebar/sidebar.component";
import { GoalificationDialogComponent } from "./goalification-dialog/goalification-dialog.component";
import { GoalificationTableComponent } from "./goalification-table/goalification-table.component";


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LeafletMapComponent, Neo4jComponent, LoginComponent, SidebarComponent, GoalificationDialogComponent, GoalificationTableComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'projectGeo';
  state:AppState = { state: 'login' };
  user = '';
  driver: any;
  
  
  ngOnInit() {
    this.driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'projectgeo'));
    
  }
  
  ngOnDestroy() {
    if (this.driver) {
      this.driver.close();
      console.log('Neo4j driver closed');
    }
  }
  loginChange($event: AppState) {
    this.state = $event;
    console.log('Login state changed to:', this.state);
  }
  userChange($event: string) {
    this.user = $event;
    console.log('User changed to:', this.user);
  }
  
}


