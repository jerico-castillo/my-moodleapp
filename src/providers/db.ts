// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Injectable } from '@angular/core';
import { SQLite } from '@ionic-native/sqlite';
import { Platform } from 'ionic-angular';
import { SQLiteDB } from '../classes/sqlitedb';

/**
 * This service allows interacting with the local database to store and retrieve data.
 */
@Injectable()
export class CoreDbProvider {

    dbInstances = {};

    constructor(private sqlite: SQLite, private platform: Platform) {}

    /**
     * Get or create a database object.
     *
     * The database objects are cached statically.
     *
     * @param {string} name DB name.
     * @param {boolean} forceNew True if it should always create a new instance.
     * @return {SQLiteDB} DB.
     */
    getDB(name: string, forceNew?: boolean) : SQLiteDB {
        if (typeof this.dbInstances[name] === 'undefined' || forceNew) {
            this.dbInstances[name] = new SQLiteDB(name, this.sqlite, this.platform);
        }
        return this.dbInstances[name];
    }

    /**
     * Delete a DB.
     *
     * @param {string} name DB name.
     * @return {Promise<any>} Promise resolved when the DB is deleted.
     */
    deleteDB(name: string) : Promise<any> {
        let promise;

        if (typeof this.dbInstances[name] != 'undefined') {
            // Close the database first.
            promise = this.dbInstances[name].close();
        } else {
            promise = Promise.resolve();
        }

        return promise.then(() => {
            delete this.dbInstances[name];

            return this.sqlite.deleteDatabase({
                name: name,
                location: 'default'
            });
        });
    }
}



