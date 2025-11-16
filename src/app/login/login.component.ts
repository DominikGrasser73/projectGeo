import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule, NgModel } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { emit } from 'process';
import * as bcrypt from 'bcryptjs';
import neo4j, { QueryResult } from 'neo4j-driver';
import { AppState } from '../../util/types';

@Component({
  selector: 'app-login',
  imports: [ButtonModule, DialogModule, FormsModule, PasswordModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  visible: any = true;
  @Output ()
  loginEvent = new EventEmitter<AppState>();
  @Output()
  userEvent = new EventEmitter<string>();
  name: any;
  password: any;
  state : AppState = { state: 'eliciting' };
  @Input() driver: any;
  
  emitEvent() {
    this.loginEvent.emit(this.state);
    this.userEvent.emit(this.name);
    this.visible = false;
    
  }
  
  handleLogin() {
    console.log('Login button clicked');
    console.log('Name:', this.name);
    console.log('Password', this.password);
    this.login(this.name, this.password);

    //this.emitEvent();
  }
  handleRegister() {
    console.log('Register button clicked');
    console.log('Name:', this.name);
    console.log('Password', this.password);
    this.register();
  }

  login( name: string, password: string) {
      
      const query = 'MATCH (n:User {username: $name}) RETURN n';
     this.driver.session().run(query, { name: this.name})
      .then((result: QueryResult) => {
        result.records.forEach((record) => {
          bcrypt.compare(password, record.get('n').properties.password, (err, res) => {
            if (res) {
              console.log('Login successful:', record.get('n').properties.username);
              this.state = { state:'activity'}
              this.emitEvent();
            } else {
              console.log('Login failed: Incorrect password');
            }
          });
        });
      })
      .catch((error: any) => {
        console.error('Error running query:', error);
      })
      .finally(() => {
        this.driver.session().close();
      });

     
    
    };

    register() {
      bcrypt.hash(this.password, 10, (err, hashedPassword) => {

          const query = 'CREATE (n:User {username: $name, password: $password}) RETURN n';
     this.driver.session().run(query, { name: this.name, password: hashedPassword })
      .then((result: QueryResult) => {
        result.records.forEach((record) => {
          console.log(record.get('n'));
          this.emitEvent();
          
        });
      })
      .catch((error: any) => {
        console.error('Error running query:', error);
      })
      .finally(() => {
        this.driver.session().close();
      });

      });
      
   
  }
  
  

 

 

}
