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

import { Component, OnInit } from '@angular/core';
import { IonRefresher } from '@ionic/angular';
import { AddonBadges, AddonBadgesUserBadge } from '../../services/badges';
import { CoreTimeUtils } from '@services/utils/time';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreSites } from '@services/sites';
import { CoreUtils } from '@services/utils/utils';
import { CoreNavigator } from '@services/navigator';
import { CoreScreen } from '@services/screen';

/**
 * Page that displays the list of calendar events.
 */
@Component({
    selector: 'page-addon-badges-user-badges',
    templateUrl: 'user-badges.html',
})
export class AddonBadgesUserBadgesPage implements OnInit {

    courseId = 0;
    userId!: number;

    badgesLoaded = false;
    badges: AddonBadgesUserBadge[] = [];
    currentTime = 0;
    badgeHash!: string;

    /**
     * View loaded.
     */
    ngOnInit(): void {

        this.courseId = CoreNavigator.instance.getRouteNumberParam('courseId') || this.courseId; // Use 0 for site badges.
        this.userId = CoreNavigator.instance.getRouteNumberParam('userId') || CoreSites.instance.getCurrentSite()!.getUserId();

        this.fetchBadges().finally(() => {
            if (!this.badgeHash && CoreScreen.instance.isTablet && this.badges.length > 0) {
                // Take first and load it.
                this.loadIssuedBadge(this.badges[0].uniquehash);
            }
            this.badgesLoaded = true;
        });
    }

    /**
     * Fetch all the badges required for the view.
     *
     * @return Promise resolved when done.
     */
    async fetchBadges(): Promise<void> {
        this.currentTime = CoreTimeUtils.instance.timestamp();

        try {
            this.badges = await AddonBadges.instance.getUserBadges(this.courseId, this.userId);
        } catch (message) {
            CoreDomUtils.instance.showErrorModalDefault(message, 'Error getting badges data.');
        }
    }

    /**
     * Refresh the badges.
     *
     * @param refresher Refresher.
     */
    async refreshBadges(refresher?: CustomEvent<IonRefresher>): Promise<void> {
        await CoreUtils.instance.ignoreErrors(Promise.all([
            AddonBadges.instance.invalidateUserBadges(this.courseId, this.userId),
        ]));

        await CoreUtils.instance.ignoreErrors(Promise.all([
            this.fetchBadges(),
        ]));

        refresher?.detail.complete();
    }

    /**
     * Navigate to a particular badge.
     *
     * @param badgeHash Badge to load.
     */
    loadIssuedBadge(badgeHash: string): void {
        this.badgeHash = badgeHash;
        const params = { courseId: this.courseId, userId: this.userId, badgeHash: badgeHash };

        const splitViewLoaded = CoreNavigator.instance.isCurrentPathInTablet('**/badges/user/issue');
        const path = (splitViewLoaded ? '../' : '') + 'issue';

        CoreNavigator.instance.navigate(path, { params });
    }

}
