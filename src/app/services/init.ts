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

import { Injectable } from '@angular/core';

import { CoreUtils, PromiseDefer } from '@services/utils/utils';
import { CoreLogger } from '@singletons/logger';
import { makeSingleton } from '@singletons/core.singletons';

/**
 * Interface that all init handlers must implement.
 */
export type CoreInitHandler = {
    /**
     * A name to identify the handler.
     */
    name: string;

    /**
     * The highest priority is executed first. You should use values lower than MAX_RECOMMENDED_PRIORITY.
     */
    priority?: number;

    /**
     * Set this to true when this process should be resolved before any following one.
     */
    blocking?: boolean;

    /**
     * Function to execute during the init process.
     *
     * @return Promise resolved when done.
     */
    load(): Promise<void>;
};

/*
 * Provider for initialisation mechanisms.
 */
@Injectable()
export class CoreInitDelegate {

    static readonly DEFAULT_PRIORITY = 100; // Default priority for init processes.
    static readonly MAX_RECOMMENDED_PRIORITY = 600;

    protected initProcesses: { [s: string]: CoreInitHandler } = {};
    protected logger: CoreLogger;
    protected readiness: CoreInitReadinessPromiseDefer<void>;

    constructor() {
        this.logger = CoreLogger.getInstance('CoreInitDelegate');
    }

    /**
     * Executes the registered init processes.
     *
     * Reserved for core use, do not call directly.
     */
    executeInitProcesses(): void {
        let ordered = [];

        if (typeof this.readiness == 'undefined') {
            this.initReadiness();
        }

        // Re-ordering by priority.
        for (const name in this.initProcesses) {
            ordered.push(this.initProcesses[name]);
        }
        ordered.sort((a, b) => b.priority - a.priority);

        ordered = ordered.map((data: CoreInitHandler) => ({
            func: this.prepareProcess.bind(this, data),
            blocking: !!data.blocking,
        }));

        // Execute all the processes in order to solve dependencies.
        CoreUtils.instance.executeOrderedPromises(ordered).finally(this.readiness.resolve);
    }

    /**
     * Init the readiness promise.
     */
    protected initReadiness(): void {
        this.readiness = CoreUtils.instance.promiseDefer();
        this.readiness.promise.then(() => this.readiness.resolved = true);
    }

    /**
     * Instantly returns if the app is ready.
     *
     * @return Whether it's ready.
     */
    isReady(): boolean {
        return this.readiness.resolved;
    }

    /**
     * Convenience function to return a function that executes the process.
     *
     * @param data The data of the process.
     * @return Promise of the process.
     */
    protected async prepareProcess(data: CoreInitHandler): Promise<void> {
        this.logger.debug(`Executing init process '${data.name}'`);

        try {
            await data.load();
        } catch (e) {
            this.logger.error('Error while calling the init process \'' + data.name + '\'. ' + e);
        }
    }

    /**
     * Notifies when the app is ready. This returns a promise that is resolved when the app is initialised.
     *
     * @return Resolved when the app is initialised. Never rejected.
     */
    async ready(): Promise<void> {
        if (typeof this.readiness == 'undefined') {
            // Prevent race conditions if this is called before executeInitProcesses.
            this.initReadiness();
        }

        await this.readiness.promise;
    }

    /**
     * Registers an initialisation process.
     *
     * @description
     * Init processes can be used to add initialisation logic to the app. Anything that should block the user interface while
     * some processes are done should be an init process. It is recommended to use a priority lower than MAX_RECOMMENDED_PRIORITY
     * to make sure that your process does not happen before some essential other core processes.
     *
     * An init process should never change state or prompt user interaction.
     *
     * This delegate cannot be used by site plugins.
     *
     * @param instance The instance of the handler.
     */
    registerProcess(handler: CoreInitHandler): void {
        if (typeof handler.priority == 'undefined') {
            handler.priority = CoreInitDelegate.DEFAULT_PRIORITY;
        }

        if (typeof this.initProcesses[handler.name] != 'undefined') {
            this.logger.log(`Process '${handler.name}' already registered.`);

            return;
        }

        this.logger.log(`Registering process '${handler.name}'.`);
        this.initProcesses[handler.name] = handler;
    }

}

export class CoreInit extends makeSingleton(CoreInitDelegate) {}

/**
 * Deferred promise for init readiness.
 */
type CoreInitReadinessPromiseDefer<T> = PromiseDefer<T> & {
    resolved?: boolean; // If true, readiness have been resolved.
};
