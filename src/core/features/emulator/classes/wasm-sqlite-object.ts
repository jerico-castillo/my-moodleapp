// (C) Copyright 2015 Moodle Pty Ltd.
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

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { CorePromisedValue } from '@classes/promised-value';
import { Sqlite3Worker1Promiser, sqlite3Worker1Promiser } from '@sqlite.org/sqlite-wasm';

/**
 * Throw an error indicating that the given method hasn't been implemented.
 *
 * @param method Method name.
 */
function notImplemented(method: string): any {
    throw new Error(`${method} method not implemented.`);
}

/**
 * SQLiteObject adapter implemented using the sqlite-wasm package.
 */
export class WasmSQLiteObject implements SQLiteObject {

    private name: string;
    private promisedPromiser: CorePromisedValue<Sqlite3Worker1Promiser>;
    private promiser: Sqlite3Worker1Promiser;

    constructor(name: string) {
        this.name = name;
        this.promisedPromiser = new CorePromisedValue();
        this.promiser = async (...args) => {
            const promiser = await this.promisedPromiser;

            return promiser.call(promiser, ...args);
        };
    }

    /**
     * Delete the database.
     */
    async delete(): Promise<any> {
        if (!this.promisedPromiser.isResolved()) {
            await this.open();
        }

        await this.promiser('close', { unlink: true });
    }

    /**
     * @inheritdoc
     */
    async open(): Promise<any> {
        const promiser = await new Promise<Sqlite3Worker1Promiser>((resolve) => {
            const _promiser = sqlite3Worker1Promiser(() => resolve(_promiser));
        });

        await promiser('open', { filename: `file:${this.name}.sqlite3`, vfs: 'opfs' });

        this.promisedPromiser.resolve(promiser);
    }

    /**
     * @inheritdoc
     */
    async close(): Promise<any> {
        await this.promiser('close', {});
    }

    /**
     * @inheritdoc
     */
    async executeSql(statement: string, params?: any[] | undefined): Promise<any> {
        const rows = [] as unknown[];

        await this.promiser('exec', {
            sql: statement,
            bind: params,
            callback({ row, columnNames }) {
                if (!row) {
                    return;
                }

                rows.push(columnNames.reduce((record, column, index) => {
                    record[column] = row[index];

                    return record;
                }, {}));
            },
        });

        return {
            rows: {
                item: (i: number) => rows[i],
                length: rows.length,
            },
            rowsAffected: rows.length,
        };
    }

    /**
     * @inheritdoc
     */
    async sqlBatch(sqlStatements: any[]): Promise<any> {
        await Promise.all(sqlStatements.map(sql => this.executeSql(sql)));
    }

    // These methods and properties are not used in our app,
    // but still need to be declared to conform with the SQLiteObject interface.
    _objectInstance = null; // eslint-disable-line @typescript-eslint/naming-convention
    databaseFeatures = { isSQLitePluginDatabase: false };
    openDBs = null;
    addTransaction = () => notImplemented('SQLiteObject.addTransaction');
    transaction = () => notImplemented('SQLiteObject.transaction');
    readTransaction = () => notImplemented('SQLiteObject.readTransaction');
    startNextTransaction = () => notImplemented('SQLiteObject.startNextTransaction');
    abortallPendingTransactions = () => notImplemented('SQLiteObject.abortallPendingTransactions');

}
