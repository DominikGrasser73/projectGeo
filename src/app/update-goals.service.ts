import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Activity } from '../util/types';

@Injectable({
  providedIn: 'root'
})
export class UpdateGoalsService {
  private dataSource = new BehaviorSubject<Activity | null>(null);
  currentData = this.dataSource.asObservable();

  constructor() { }


  updateData(data: Activity) {
    this.dataSource.next(data);
  }
}


