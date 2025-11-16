import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalificationTableComponent } from './goalification-table.component';

describe('GoalificationTableComponent', () => {
  let component: GoalificationTableComponent;
  let fixture: ComponentFixture<GoalificationTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalificationTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GoalificationTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
