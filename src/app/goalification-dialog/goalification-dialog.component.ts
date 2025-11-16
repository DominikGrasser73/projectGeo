import { AfterViewInit, Component, Input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import {ToastModule} from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DatePickerModule } from 'primeng/datepicker';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { Activity, Goal, GoalType } from '../../util/types';
import { SliderModule } from 'primeng/slider';
import { GoalificationTableComponent } from "../goalification-table/goalification-table.component";
import { getFriendsNumber, loadActiveGoals, loadUserDistricts, loadUserFriends, loadUserStates, runQuery, saveGoal, updateGoal } from '../../util/utilFunctions';
import { SelectButtonModule } from 'primeng/selectbutton';
import { UpdateGoalsService } from '../update-goals.service';
import { run } from 'node:test';
import { point } from 'leaflet';


@Component({
  selector: 'app-goalification-dialog',
  imports: [ButtonModule, DialogModule, DatePickerModule, FormsModule, SelectModule, SliderModule, GoalificationTableComponent, SelectButtonModule, ToastModule],
  templateUrl: './goalification-dialog.component.html',
  styleUrl: './goalification-dialog.component.scss',
  providers: [MessageService]
})
export class GoalificationDialogComponent implements AfterViewInit {

  @Input() driver: any;
  @Input() user: string = '';
  userGoals: Goal[] = [];

  visible: boolean = false;
  goalTypeOptions = Object.values(GoalType);
  goalTarget: number = 0;

  selectedGoalType: GoalType = GoalType.Activity; 
  goalTypes = [
    GoalType.Activity,
    GoalType.Social,
    GoalType['States and Districts']
  ];

  sadOptions = ['States', 'Districts'];
  sadSubOptions = ['Different', 'New', 'Single'];
  selectedSadOption: string = 'States';
  selectedSadSubOption: string = 'Different';

  activityOptions = ['Basic', 'Activities per Time'];
  selectedActivityOption: string = 'Basic';

  socialOptions = ['Activities with Friends', 'New People', 'Selected Friend' ];
  selectedSocialOption: string = 'Activities with Friends';


  


// Loaded from the database
  districtsArray: string[] = [];
  selectedDistrict: string | null = null;
  statesArray: string[] = [];
  selectedState: string | null = null;
  friendsArray: string[] = [];
  selectedFriend: string | null = null;

  constructor(private updateGoalsService: UpdateGoalsService, private messageService: MessageService) { }

  async ngAfterViewInit(): Promise<void> {
    this.districtsArray = await loadUserDistricts(this.driver, this.user);
    this.statesArray = await loadUserStates(this.driver, this.user);
    this.friendsArray = await loadUserFriends(this.driver, this.user);
    this.userGoals = await loadActiveGoals(this.driver, this.user);
    console.log('User Goals:', this.userGoals);
    this.updateGoalsService.currentData.subscribe(data => {
      if (data) {
        console.log('Received activity for goal update:', data);
        this.updateGoals(data);
       
      }
    });

  }

  

  showDialog() {
    this.visible = true;
    console.log(this.goalTypeOptions);
  }

  createGoal() {
    if (this.selectedGoalType) {
      var subType = this.selectedActivityOption;
      var subSubType = undefined;
      var single = undefined;
      if (this.selectedGoalType === GoalType['States and Districts']) {
        subType = this.selectedSadOption;
        subSubType = this.selectedSadSubOption;
        if (this.selectedSadOption === 'States' && this.selectedSadSubOption === 'Single') {
          single = this.selectedState;
        }
        else if (this.selectedSadOption === 'Districts' && this.selectedSadSubOption === 'Single') {
          single = this.selectedDistrict;
        }
      }else if (this.selectedGoalType === GoalType.Social) {
        subType = this.selectedSocialOption;
        if (this.selectedSocialOption === 'Selected Friend' && this.selectedFriend) {
          single = this.selectedFriend;
        }
      }

      const newGoal: Goal = {
        type: this.selectedGoalType,
        subType: subType,
        subSubType: subSubType ?? 'none',
        single: single ?? 'none',
        target: this.goalTarget,
        progress: 0,
        status: "Active",
        startDate: new Date(),

      };
      this.userGoals.push(newGoal);
      

      
      console.log('Creating goal:', newGoal);
      saveGoal(this.driver, this.user, newGoal);
      
      // Reset 
      this.selectedGoalType = GoalType.Activity;
      this.goalTarget = 0;
      this.selectedActivityOption = 'Basic';
      this.selectedSadOption = 'States';
      this.selectedSadSubOption = 'Different';
      this.selectedSocialOption = 'Activities with Friends';
      this.selectedDistrict = null;
      this.selectedState = null;
      this.selectedFriend = null;

    }
    this.visible = false; 
  }

  async updateGoals(activity: Activity) {
    
    for (let goal of this.userGoals) {
      if (goal.status === "Active"){
        if (goal.type === 'Activity') {
          goal.progress += 1;
          updateGoal(this.driver, this.user, goal);
        }else if (goal.type === 'Social') {
          if (goal.subType === 'Activities with Friends') {
            const friendsCount = await getFriendsNumber(this.driver,this.user,activity.participants)
            if (friendsCount > 0) {
              goal.progress += friendsCount;
              updateGoal(this.driver, this.user, goal);
            }

          } else if (goal.subType === 'New People') {
            let query = 'MERGE (g:Goal)-[:NEW_PEOPLE]->(u:User) WHERE u.username = $username AND g.startDate = $startDate RETURN COUNT(u)';
            let params = {
              username: this.user,
              startDate: goal.startDate
            };
            await runQuery(this.driver, query, params);
            query = 'MATCH (g:Goal)-[:NEW_PEOPLE]->(u:User) WHERE g.startdate = $startDate RETURN COUNT(u)';
            const newPeopleCount = await runQuery(this.driver, query, {
              startDate: goal.startDate
            });
            if (newPeopleCount > 0) {
              goal.progress = newPeopleCount;
              updateGoal(this.driver, this.user, goal);
            }

          } else if (goal.subType === 'Selected Friend' && goal.single) {
            if (activity.participants.includes(goal.single)) {
              goal.progress += 1;
              updateGoal(this.driver, this.user, goal);
            }
          }

        }
        else if (goal.type === 'States and Districts') {
          
          if (goal.subSubType === 'Single'){
            if (goal.subType === 'Districts' && goal.single === activity.district) {
              goal.progress += 1;
              updateGoal(this.driver, this.user, goal);
            }
            else if (goal.subType === 'States' && goal.single === activity.state) {
              goal.progress += 1;
              updateGoal(this.driver, this.user, goal);
            }
          }else if (goal.subSubType === 'Different') {
            console.log('Updating Different goal:', goal, 'with activity:', activity);
            let query = '';
            let params = {};
            if (goal.subType === 'States') {
              query = 'MATCH(g:Goal {startDate: $startDate}) MERGE (g)-[:VISITED]->(s:State {name: $location}) RETURN COUNT(s)';
              params = {
                startDate: goal.startDate,
                location: activity.state
              };
            } else if (goal.subType === 'Districts') {
              query = 'MATCH(g:Goal {startDate: $startDate}) MERGE (g)-[:VISITED]->(d:District {name: $location}) RETURN COUNT(d)';
              params = {
                startDate: goal.startDate,
                location: activity.district
              };
            }
            await runQuery(this.driver, query, params);
            if (goal.subType === 'States') {
              query = 'MATCH (g:Goal)-[:VISITED]->(s:State) WHERE g.startDate = $startDate RETURN COUNT(s)';
            } else if (goal.subType === 'Districts') {
              query = 'MATCH (g:Goal)-[:VISITED]->(d:District) WHERE g.startDate = $startDate RETURN COUNT(d)';
            }
            params = {
              startDate: goal.startDate
            };
            const differentCount = await runQuery(this.driver, query, params);
            console.log('Different count for goal:', differentCount.records);
            if (differentCount.records.length > 0) {
              goal.progress = differentCount.records.length;
              updateGoal(this.driver, this.user, goal);
            }

        }else if (goal.subSubType === 'New') {
          let query = '';
          let params = {};
          if (goal.subType === 'States') {
            query = 'MATCH (u:User)-[:PARTICIPATED_IN]->(a:Activity)-[:TAKES_PLACE_IN]->(d:District)-[:LOCATED_IN]->(s:State) WHERE u.username = $username AND s.name = $location RETURN COUNT(s)';
            params = {
              username: this.user,
              location: activity.state
            };
          }
          else if (goal.subType === 'Districts') {
            query = 'MATCH (u:User)-[:PARTICIPATED_IN]->(a:Activity)-[:LOCATED_IN]->(d:District) WHERE u.username = $username AND d.name = $location RETURN COUNT(d)';
            params = {
              username: this.user,
              location: activity.district
            };
          }
          let newCount = await runQuery(this.driver, query, params);
          if (newCount.records == 0) {
            goal.progress += 1;
            updateGoal(this.driver, this.user, goal);
          }

          
          
        }
      }
        
        

        if (goal.progress >= goal.target) {
          goal.status = "Completed";
          updateGoal(this.driver, this.user, goal);
          this.goalCompleted(goal);
        }
      }
    }
    
    await runQuery(this.driver, 'MATCH (u:User{username: $username}), (a:Activity{coords: point({latitude:$lat, longitude:$lon})}) MERGE (u)-[:PARTICIPATED_IN]->(a)', {
      username: this.user,
      lat: activity.location.lat,
      lon: activity.location.lng
    });
    await runQuery(this.driver, 'MATCH (u:User {username: $username})-[p:PARTICIPATES_IN]->(a:Activity {coords: point({latitude:$lat, longitude:$lon})}) DELETE p RETURN count(p)', {
      username: this.user,
      lat: activity.location.lat,
      lon: activity.location.lng
    });
  }



  goalCompleted(goal: Goal) {
    this.messageService.add({ severity: 'success', summary: 'Goal Completed', detail: `Goal "${goal.type}" has been completed!` });
    console.log('Goal completed:', goal);
  }


  }
