import { TestBed } from '@angular/core/testing';

import { UpdateGoalsService } from './update-goals.service';

describe('UpdateGoalsService', () => {
  let service: UpdateGoalsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UpdateGoalsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
