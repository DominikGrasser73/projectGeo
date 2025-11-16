import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalificationDialogComponent } from './goalification-dialog.component';

describe('GoalificationDialogComponent', () => {
  let component: GoalificationDialogComponent;
  let fixture: ComponentFixture<GoalificationDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalificationDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GoalificationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
