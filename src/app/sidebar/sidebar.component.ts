import { Component, Input } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import {ListboxModule} from 'primeng/listbox';
import { FormsModule } from '@angular/forms';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-sidebar',
  imports: [DrawerModule, ButtonModule, ListboxModule, FormsModule, BadgeModule, TooltipModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  visible: boolean = false;
  @Input() driver: any;
  @Input() user: string = '';
  friendsVisible: boolean = false;
  friends : { name: string, count: number }[] = [
    { name: 'Alice', count: 1 },
    { name: 'Bob', count: 2 },
    { name: 'Charlie', count: 3 }];
    
  selectedFriend: string | null = null;


  public async displayUserlist(){
    const query = 'MATCH p = (me:User{username:$username})-[*1..2]-(other:User) WHERE me <> other RETURN other.username AS otherName, COUNT(DISTINCT p) AS connections ORDER BY connections DESC LIMIT 10';
    this.driver.session().run(query, { username: this.user })
      .then((result: any) => {
        this.friends = result.records.map((record: { get: (arg0: string) => any; }) => ({
          name: record.get('otherName'),
          count: record.get('connections')
        }));
      })
      .catch((error: any) => {
        console.error('Error fetching friends:', error);
      });
      console.log("Friends:", this.friends);

    this.friendsVisible = !this.friendsVisible;
  }

  public async addFriend() {
    if (!this.selectedFriend) {
      console.warn("No friend selected to add.");
      return;
    }
    const session = this.driver.session();
    console.log("Adding friend:", this.selectedFriend);
    const query = 'MATCH (me:User{username:$username}), (other:User{username:$friend}) MERGE (me)-[:FRIEND_WITH]->(other)';
    try {
      await session.run(query, { username: this.user, friend: this.selectedFriend });
      console.log(`Friend ${this.selectedFriend} added successfully.`);
      // Optionally, you can refresh the friend list after adding a new friend
      
    }
    catch (error) {
      console.error('Error adding friend:', error);
    } finally {
      await session.close();
    }
    
  }

}
