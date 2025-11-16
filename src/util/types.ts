export type AppState = {
    state: 'login' | 'eliciting' | 'goalification' | 'activity'
}

export type Goal = {
    type: GoalType;
    subType: string;
    subSubType?: string ;
    status: 'Active' | 'Completed';
    progress: number; 
    target: number; 
    startDate: Date;
    single?: string;

}

export enum GoalType {
    'Activity' = 'Activity',
    'AcivitiesPerWeek' = 'AcivitiesPerWeek',
    'Activities with Friends' = 'Activities with Friends',
    'New People' = 'New People',
    'Districts' = 'Districts',
    'States' = 'States',
    'SelectedFriend' = 'SelectedFriend',
    'SelectedDistrict' = 'SelectedDistrict',
    'SelectedState' = 'SelectedState',
    'Social' = 'Social',
    'States and Districts' = 'States and Districts'
}

export type Activity = {
    id: number;
    name: string;
    description: string;
    participants: string[];
    location: {
        lat: number;
        lng: number;
    };
    date: Date;
    state: string;
    district: string;
  };