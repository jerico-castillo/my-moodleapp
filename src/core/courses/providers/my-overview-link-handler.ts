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
import { CoreContentLinksHandlerBase } from '../../contentlinks/classes/base-handler';
import { CoreContentLinksAction } from '../../contentlinks/providers/delegate';
import { CoreLoginHelperProvider } from '../../login/providers/helper';
import { CoreCoursesProvider } from './courses';

/**
 * Handler to treat links to my overview.
 */
@Injectable()
export class CoreCoursesMyOverviewLinkHandler extends CoreContentLinksHandlerBase {
    name = 'CoreCoursesMyOverviewLinkHandler';
    featureName = '$mmSideMenuDelegate_mmCourses';
    pattern = /\/my\/?$/;

    constructor(private coursesProvider: CoreCoursesProvider, private loginHelper: CoreLoginHelperProvider) {
        super();
    }

    /**
     * Get the list of actions for a link (url).
     *
     * @param {string[]} siteIds List of sites the URL belongs to.
     * @param {string} url The URL to treat.
     * @param {any} params The params of the URL. E.g. 'mysite.com?id=1' -> {id: 1}
     * @param {number} [courseId] Course ID related to the URL. Optional but recommended.
     * @return {CoreContentLinksAction[]|Promise<CoreContentLinksAction[]>} List of (or promise resolved with list of) actions.
     */
    getActions(siteIds: string[], url: string, params: any, courseId?: number) :
            CoreContentLinksAction[]|Promise<CoreContentLinksAction[]> {
        return [{
            action: (siteId, navCtrl?) => {
                // Always use redirect to make it the new history root (to avoid "loops" in history).
                this.loginHelper.redirect('CoreCoursesMyOverviewPage', undefined, siteId);
            }
        }];
    }
}
