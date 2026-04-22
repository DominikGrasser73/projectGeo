import { Component, Input } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { ListboxModule } from 'primeng/listbox';
import { FormsModule } from '@angular/forms';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-sidebar',
  imports: [DrawerModule, ButtonModule, ListboxModule, FormsModule, BadgeModule, TooltipModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  visible = false;
  @Input() user: string = '';
  friendsVisible = false;
  friends: { name: string; count: number }[] = [];
  selectedFriend: string | null = null;

  constructor(private api: ApiService) {}

  async displayUserlist() {
    this.friends = await this.api.getUserNetwork(this.user);
    this.friendsVisible = !this.friendsVisible;
  }

  async addFriend() {
    if (!this.selectedFriend) { console.warn('No friend selected'); return; }
    await this.api.addFriend(this.user, this.selectedFriend);
    console.log(`Friend ${this.selectedFriend} added`);
  }
}
