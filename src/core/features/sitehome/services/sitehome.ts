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

import { CoreSites } from '@services/sites';
import { CoreSite, CoreSiteWSPreSets } from '@classes/site';
import { makeSingleton } from '@singletons';
import { CoreCourse, CoreCourseSection } from '../../course/services/course';
import { CoreCourses } from '../../courses/services/courses';

/**
 * Items with index 1 and 3 were removed on 2.5 and not being supported in the app.
 */
export enum FrontPageItemNames {
    NEWS_ITEMS = 0,
    LIST_OF_CATEGORIES = 2,
    COMBO_LIST = 3,
    ENROLLED_COURSES = 5,
    LIST_OF_COURSE = 6,
    COURSE_SEARCH_BOX = 7,
}

/**
 * Service that provides some features regarding site home.
 */
@Injectable({ providedIn: 'root' })
export class CoreSiteHomeProvider {

    /**
     * Get the news forum for the Site Home.
     *
     * @param siteHomeId Site Home ID.
     * @return Promise resolved with the forum if found, rejected otherwise.
     */
    getNewsForum(): void {
        // @todo params and logic.
    }

    /**
     * Invalidate the WS call to get the news forum for the Site Home.
     *
     * @param siteHomeId Site Home ID.
     * @return Promise resolved when invalidated.
     */
    invalidateNewsForum(): void {
        // @todo params and logic.
    }

    /**
     * Returns whether or not the frontpage is available for the current site.
     *
     * @param siteId The site ID. If not defined, current site.
     * @return Promise resolved with boolean: whether it's available.
     */
    async isAvailable(siteId?: string): Promise<boolean> {
        try {
            const site = await CoreSites.instance.getSite(siteId);

            // First check if it's disabled.
            if (this.isDisabledInSite(site)) {
                return false;
            }

            // Use a WS call to check if there's content in the site home.
            const siteHomeId = site.getSiteHomeId();
            const preSets: CoreSiteWSPreSets = { emergencyCache: false };

            try {
                const sections: CoreCourseSection[] =
                    await CoreCourse.instance.getSections(siteHomeId, false, true, preSets, site.id);

                if (!sections || !sections.length) {
                    throw Error('No sections found');
                }

                const hasContent = sections.some((section) => section.summary || (section.modules && section.modules.length));

                if (hasContent) {
                    // There's a section with content.
                    return true;
                }
            } catch {
                // Ignore errors.
            }

            const config = site.getStoredConfig();
            if (config && config.frontpageloggedin) {
                const items = await this.getFrontPageItems(config.frontpageloggedin);

                // There are items to show.
                return items.length > 0;
            }
        } catch {
            // Ignore errors.
        }

        return false;
    }

    /**
     * Check if Site Home is disabled in a certain site.
     *
     * @param siteId Site Id. If not defined, use current site.
     * @return Promise resolved with true if disabled, rejected or resolved with false otherwise.
     */
    async isDisabled(siteId?: string): Promise<boolean> {
        const site = await CoreSites.instance.getSite(siteId);

        return this.isDisabledInSite(site);
    }

    /**
     * Check if Site Home is disabled in a certain site.
     *
     * @param site Site. If not defined, use current site.
     * @return Whether it's disabled.
     */
    isDisabledInSite(site: CoreSite): boolean {
        site = site || CoreSites.instance.getCurrentSite();

        return site.isFeatureDisabled('CoreMainMenuDelegate_CoreSiteHome');
    }

    /**
     * Get the nams of the valid frontpage items.
     *
     * @param frontpageItemIds CSV string with indexes of site home components.
     * @return Valid names for each item.
     */
    async getFrontPageItems(frontpageItemIds?: string): Promise<string[]> {
        if (!frontpageItemIds) {
            return [];
        }

        const items = frontpageItemIds.split(',');

        const filteredItems: string[] = [];

        for (const item of items) {
            let itemNumber = parseInt(item, 10);

            let add = false;
            switch (itemNumber) {
                case FrontPageItemNames['NEWS_ITEMS']:
                    // @todo
                    add = true;
                    break;
                case FrontPageItemNames['LIST_OF_CATEGORIES']:
                case FrontPageItemNames['COMBO_LIST']:
                case FrontPageItemNames['LIST_OF_COURSE']:
                    add = CoreCourses.instance.isGetCoursesByFieldAvailable();
                    if (add && itemNumber == FrontPageItemNames['COMBO_LIST']) {
                        itemNumber = FrontPageItemNames['LIST_OF_CATEGORIES'];
                    }
                    break;
                case FrontPageItemNames['ENROLLED_COURSES']:
                    if (!CoreCourses.instance.isMyCoursesDisabledInSite()) {
                        const courses = await CoreCourses.instance.getUserCourses();

                        add = courses.length > 0;
                    }
                    break;
                case FrontPageItemNames['COURSE_SEARCH_BOX']:
                    add = !CoreCourses.instance.isSearchCoursesDisabledInSite();
                    break;
                default:
                    break;
            }

            // Do not add an item twice.
            if (add && filteredItems.indexOf(FrontPageItemNames[itemNumber]) < 0) {
                filteredItems.push(FrontPageItemNames[itemNumber]);
            }
        }

        return filteredItems;
    }

}

export class CoreSiteHome extends makeSingleton(CoreSiteHomeProvider) {}
