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

import { NgModule } from '@angular/core';
import { CoreCronDelegate } from '@providers/cron';
import { CoreCourseModuleDelegate } from '@core/course/providers/module-delegate';
import { CoreCourseModulePrefetchDelegate } from '@core/course/providers/module-prefetch-delegate';
import { AddonModAssignProvider } from './providers/assign';
import { AddonModAssignOfflineProvider } from './providers/assign-offline';
import { AddonModAssignSyncProvider } from './providers/assign-sync';
import { AddonModAssignHelperProvider } from './providers/helper';
import { AddonModAssignFeedbackDelegate } from './providers/feedback-delegate';
import { AddonModAssignSubmissionDelegate } from './providers/submission-delegate';
import { AddonModAssignDefaultFeedbackHandler } from './providers/default-feedback-handler';
import { AddonModAssignDefaultSubmissionHandler } from './providers/default-submission-handler';
import { AddonModAssignModuleHandler } from './providers/module-handler';
import { AddonModAssignPrefetchHandler } from './providers/prefetch-handler';
import { AddonModAssignSyncCronHandler } from './providers/sync-cron-handler';
import { AddonModAssignSubmissionModule } from './submission/submission.module';
import { AddonModAssignFeedbackModule } from './feedback/feedback.module';
import { CoreUpdateManagerProvider } from '@providers/update-manager';

// List of providers (without handlers).
export const ADDON_MOD_ASSIGN_PROVIDERS: any[] = [
    AddonModAssignProvider,
    AddonModAssignOfflineProvider,
    AddonModAssignSyncProvider,
    AddonModAssignHelperProvider,
    AddonModAssignFeedbackDelegate,
    AddonModAssignSubmissionDelegate
];

@NgModule({
    declarations: [
    ],
    imports: [
        AddonModAssignSubmissionModule,
        AddonModAssignFeedbackModule
    ],
    providers: ADDON_MOD_ASSIGN_PROVIDERS.concat([
        AddonModAssignDefaultFeedbackHandler,
        AddonModAssignDefaultSubmissionHandler,
        AddonModAssignModuleHandler,
        AddonModAssignPrefetchHandler,
        AddonModAssignSyncCronHandler
    ])
})
export class AddonModAssignModule {
    constructor(moduleDelegate: CoreCourseModuleDelegate, moduleHandler: AddonModAssignModuleHandler,
            prefetchDelegate: CoreCourseModulePrefetchDelegate, prefetchHandler: AddonModAssignPrefetchHandler,
            cronDelegate: CoreCronDelegate, syncHandler: AddonModAssignSyncCronHandler, updateManager: CoreUpdateManagerProvider) {
        moduleDelegate.registerHandler(moduleHandler);
        prefetchDelegate.registerHandler(prefetchHandler);
        cronDelegate.register(syncHandler);

        // Allow migrating the tables from the old app to the new schema.
        updateManager.registerSiteTablesMigration([
            {
                name: 'mma_mod_assign_submissions',
                newName: AddonModAssignOfflineProvider.SUBMISSIONS_TABLE,
                fields: [
                    {
                        name: 'assignmentid',
                        newName: 'assignid'
                    },
                    {
                        name: 'submitted',
                        type: 'boolean'
                    },
                    {
                        name: 'submissionstatement',
                        type: 'boolean'
                    },
                    {
                        name: 'plugindata',
                        type: 'object'
                    }
                ]
            },
            {
                name: 'mma_mod_assign_submissions_grading',
                newName: AddonModAssignOfflineProvider.SUBMISSIONS_GRADES_TABLE,
                fields: [
                    {
                        name: 'assignmentid',
                        newName: 'assignid'
                    },
                    {
                        name: 'addattempt',
                        type: 'boolean'
                    },
                    {
                        name: 'applytoall',
                        type: 'boolean'
                    },
                    {
                        name: 'outcomes',
                        type: 'object'
                    },
                    {
                        name: 'plugindata',
                        type: 'object'
                    }
                ]
            }
        ]);
    }
}
