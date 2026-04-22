import { AfterViewInit, Component, Input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DatePickerModule } from 'primeng/datepicker';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SliderModule } from 'primeng/slider';
import { SelectButtonModule } from 'primeng/selectbutton';
import { Activity, Goal, GoalType } from '../../util/types';
import { GoalificationTableComponent } from '../goalification-table/goalification-table.component';
import { UpdateGoalsService } from '../update-goals.service';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-goalification-dialog',
  imports: [ButtonModule, DialogModule, DatePickerModule, FormsModule, SelectModule,
            SliderModule, GoalificationTableComponent, SelectButtonModule, ToastModule],
  templateUrl: './goalification-dialog.component.html',
  styleUrl: './goalification-dialog.component.scss',
  providers: [MessageService]
})
export class GoalificationDialogComponent implements AfterViewInit {

  @Input() user: string = '';
  userGoals: Goal[] = [];
  visible = false;

  goalTarget = 0;
  selectedGoalType: GoalType = GoalType.Activity;
  goalTypes = [GoalType.Activity, GoalType.Social, GoalType['States and Districts']];

  sadOptions    = ['States', 'Districts'];
  sadSubOptions = ['Different', 'New', 'Single'];
  selectedSadOption    = 'States';
  selectedSadSubOption = 'Different';

  activityOptions        = ['Basic', 'Activities per Time'];
  selectedActivityOption = 'Basic';

  socialOptions        = ['Activities with Friends', 'New People', 'Selected Friend'];
  selectedSocialOption = 'Activities with Friends';

  districtsArray:  string[] = [];
  statesArray:     string[] = [];
  friendsArray:    string[] = [];
  selectedDistrict: string | null = null;
  selectedState:    string | null = null;
  selectedFriend:   string | null = null;

  constructor(
    private updateGoalsService: UpdateGoalsService,
    private messageService: MessageService,
    private api: ApiService
  ) {}

  async ngAfterViewInit() {
    this.districtsArray = await this.api.getUserDistricts(this.user);
    this.statesArray    = await this.api.getUserStates(this.user);
    this.friendsArray   = await this.api.getUserFriends(this.user);
    this.userGoals      = await this.api.getActiveGoals(this.user);

    this.updateGoalsService.currentData.subscribe(data => {
      if (data) this.updateGoals(data);
    });
  }

  showDialog() { this.visible = true; }

  createGoal() {
    if (!this.selectedGoalType) return;

    let subType    = this.selectedActivityOption;
    let subSubType = 'none';
    let single     = 'none';

    if (this.selectedGoalType === GoalType['States and Districts']) {
      subType    = this.selectedSadOption;
      subSubType = this.selectedSadSubOption;
      if (this.selectedSadOption === 'States'    && this.selectedSadSubOption === 'Single') single = this.selectedState    ?? 'none';
      if (this.selectedSadOption === 'Districts' && this.selectedSadSubOption === 'Single') single = this.selectedDistrict ?? 'none';
    } else if (this.selectedGoalType === GoalType.Social) {
      subType = this.selectedSocialOption;
      if (this.selectedSocialOption === 'Selected Friend') single = this.selectedFriend ?? 'none';
    }

    const newGoal: Goal = {
      type: this.selectedGoalType, subType, subSubType, single,
      target: this.goalTarget, progress: 0,
      status: 'Active', startDate: new Date()
    };
    this.userGoals.push(newGoal);
    this.api.saveGoal(this.user, newGoal);

    // Reset form
    this.selectedGoalType        = GoalType.Activity;
    this.goalTarget              = 0;
    this.selectedActivityOption  = 'Basic';
    this.selectedSadOption       = 'States';
    this.selectedSadSubOption    = 'Different';
    this.selectedSocialOption    = 'Activities with Friends';
    this.selectedDistrict        = null;
    this.selectedState           = null;
    this.selectedFriend          = null;
    this.visible = false;
  }

  async updateGoals(activity: Activity) {
    for (const goal of this.userGoals) {
      if (goal.status !== 'Active') continue;

      if (goal.type === 'Activity') {
        goal.progress += 1;
        await this.api.updateGoal(this.user, goal);

      } else if (goal.type === 'Social') {
        if (goal.subType === 'Activities with Friends') {
          const { count } = await this.api.getFriendsCount(this.user, activity.participants);
          if (count > 0) {
            goal.progress += count;
            await this.api.updateGoal(this.user, goal);
          }
        } else if (goal.subType === 'New People') {
          const { count } = await this.api.trackNewPeople(this.user, goal.startDate, activity.participants);
          if (count > 0) {
            goal.progress = count;
            await this.api.updateGoal(this.user, goal);
          }
        } else if (goal.subType === 'Selected Friend' && goal.single) {
          if (activity.participants.includes(goal.single)) {
            goal.progress += 1;
            await this.api.updateGoal(this.user, goal);
          }
        }

      } else if (goal.type === 'States and Districts') {
        if (goal.subSubType === 'Single') {
          const match =
            (goal.subType === 'Districts' && goal.single === activity.district) ||
            (goal.subType === 'States'    && goal.single === activity.state);
          if (match) { goal.progress += 1; await this.api.updateGoal(this.user, goal); }

        } else if (goal.subSubType === 'Different') {
          const location = goal.subType === 'States' ? activity.state : activity.district;
          const { count } = await this.api.trackVisited(goal.startDate, location, goal.subType!);
          if (count > 0) { goal.progress = count; await this.api.updateGoal(this.user, goal); }

        } else if (goal.subSubType === 'New') {
          const location = goal.subType === 'States' ? activity.state : activity.district;
          const { isNew } = await this.api.isNewLocation(this.user, location, goal.subType!);
          if (isNew) { goal.progress += 1; await this.api.updateGoal(this.user, goal); }
        }
      }

      if (goal.progress >= goal.target) {
        goal.status = 'Completed';
        await this.api.updateGoal(this.user, goal);
        this.goalCompleted(goal);
      }
    }

    await this.api.confirmParticipation(this.user, activity.location.lat, activity.location.lng);
  }

  goalCompleted(goal: Goal) {
    this.messageService.add({
      severity: 'success',
      summary:  'Goal Completed',
      detail:   `Goal "${goal.type}" has been completed!`
    });
  }
}
