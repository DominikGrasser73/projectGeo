import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { on } from 'events';
import neo4j, { QueryResult } from 'neo4j-driver';
import * as bcrypt from 'bcryptjs';
import { get } from 'http';
import states from '../../assets/states.json';
import { runQuery } from '../../util/utilFunctions';


@Component({
  selector: 'app-neo4j',
  imports: [],
  templateUrl: './neo4j.component.html',
  styleUrl: './neo4j.component.scss'
})
export class Neo4jComponent implements OnInit, OnDestroy {

   @Input() driver: any;
  
  
  ngOnInit() {
    this.driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'projectgeo'));

  }

  

  login() {
    const myPlaintextPassword : string = 's0/\/\P4$$w0rD';
    const saltRounds = 10;
    bcrypt.genSalt(saltRounds, (err, salt) => {
      if (err) {
        console.error('Error generating salt:', err);
        return;
      }
   
    bcrypt.hash(myPlaintextPassword, saltRounds, (err, hash) => {
      if (err) {
        console.error('Error hashing password:', err);
        return;
      }
      console.log('Hashed password:', hash);
      this.getData(hash);
    });
    }
    );
  
  };

 public getData(hash: string | undefined) {
  const session = this.driver.session();
  const query = 'CREATE (n:User {name: "Richard Lugner", password: $password}) RETURN n';
  
  session.run(query , { password: hash })
    
    .then((result: QueryResult) => {
      result.records.forEach((record) => {
        console.log(record.get('n'));
      });
    })
    .catch((error: any) => {
      console.error('Error running query:', error);
    })
    .finally(() => {
      session.close();
    });
}

  ngOnDestroy() {
    if (this.driver) {
      this.driver.close();
      console.log('Neo4j driver closed');
    }
  }
  
  async createStates(){
    const session = this.driver.session();
    for (const state of states.features) {
  const session = this.driver.session();
  const query = 'CREATE (s:State {name: $name}) RETURN s';
  const properties = { name: state.properties.name };
  await runQuery(this.driver, query, properties);
}
   
  console.log('States created successfully');
}


}







