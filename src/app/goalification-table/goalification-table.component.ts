import { Component, Input } from '@angular/core';
import { AppState, Goal, GoalType } from '../../util/types';
import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-goalification-table',
  imports: [TableModule, ProgressBarModule, TooltipModule],
  templateUrl: './goalification-table.component.html',
  styleUrl: './goalification-table.component.scss'
})
export class GoalificationTableComponent {
  @Input() driver: any;
  @Input() user: string = '';
  @Input() state!: AppState;
  @Input() userGoals: Goal[] = [];

  getProgressBarStatus(progress: number, target: number): number {
    if (target === 0) {
        return 0; // Avoid division by zero
    }

    return Math.round((progress / target) * 100);
}
}
