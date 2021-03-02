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

import { Component, OnDestroy, OnInit } from '@angular/core';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import { CoreSites } from '@services/sites';
import {
    AddonMessages,
    AddonMessagesDiscussion,
    AddonMessagesMessageAreaContact,
    AddonMessagesNewMessagedEventData,
    AddonMessagesProvider,
    AddonMessagesReadChangedEventData,
} from '../../services/messages';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreUtils } from '@services/utils/utils';
import { CoreApp } from '@services/app';
import { ActivatedRoute, Params } from '@angular/router';
import { CorePushNotificationsNotificationBasicData } from '@features/pushnotifications/services/pushnotifications';
import { CorePushNotificationsDelegate } from '@features/pushnotifications/services/push-delegate';
import { Subscription } from 'rxjs';
import { Translate, Platform } from '@singletons';
import { IonRefresher } from '@ionic/angular';
import { CoreNavigator } from '@services/navigator';
import { CoreScreen } from '@services/screen';

/**
 * Page that displays the list of discussions.
 */
@Component({
    selector: 'addon-messages-discussions',
    templateUrl: 'discussions.html',
    styleUrls: ['../../messages-common.scss'],
})
export class AddonMessagesDiscussions35Page implements OnInit, OnDestroy {

    protected newMessagesObserver: CoreEventObserver;
    protected readChangedObserver: CoreEventObserver;
    protected appResumeSubscription: Subscription;
    protected pushObserver: Subscription;
    protected loadingMessages: string;
    protected siteId: string;

    loaded = false;
    loadingMessage = '';
    discussions: AddonMessagesDiscussion[] = [];
    discussionUserId?: number;

    search = {
        enabled: false,
        showResults: false,
        results: <AddonMessagesMessageAreaContact[]> [],
        loading: '',
        text: '',
    };

    constructor(
        protected route: ActivatedRoute,
    ) {

        this.search.loading =  Translate.instant('core.searching');
        this.loadingMessages = Translate.instant('core.loading');
        this.siteId = CoreSites.getCurrentSiteId();

        // Update discussions when new message is received.
        this.newMessagesObserver = CoreEvents.on<AddonMessagesNewMessagedEventData>(
            AddonMessagesProvider.NEW_MESSAGE_EVENT,
            (data) => {
                if (data.userId && this.discussions) {
                    const discussion = this.discussions.find((disc) => disc.message!.user == data.userId);

                    if (typeof discussion == 'undefined') {
                        this.loaded = false;
                        this.refreshData().finally(() => {
                            this.loaded = true;
                        });
                    } else {
                    // An existing discussion has a new message, update the last message.
                        discussion.message!.message = data.message;
                        discussion.message!.timecreated = data.timecreated;
                    }
                }
            },
            this.siteId,
        );

        // Update discussions when a message is read.
        this.readChangedObserver = CoreEvents.on<AddonMessagesReadChangedEventData>(
            AddonMessagesProvider.READ_CHANGED_EVENT,
            (data) => {
                if (data.userId && this.discussions) {
                    const discussion = this.discussions.find((disc) => disc.message!.user == data.userId);

                    if (typeof discussion != 'undefined') {
                    // A discussion has been read reset counter.
                        discussion.unread = false;

                        // Conversations changed, invalidate them and refresh unread counts.
                        AddonMessages.invalidateConversations(this.siteId);
                        AddonMessages.refreshUnreadConversationCounts(this.siteId);
                    }
                }
            },
            this.siteId,
        );

        // Refresh the view when the app is resumed.
        this.appResumeSubscription = Platform.resume.subscribe(() => {
            if (!this.loaded) {
                return;
            }
            this.loaded = false;
            this.refreshData();
        });


        // If a message push notification is received, refresh the view.
        this.pushObserver = CorePushNotificationsDelegate.on<CorePushNotificationsNotificationBasicData>('receive')
            .subscribe((notification) => {
                // New message received. If it's from current site, refresh the data.
                if (CoreUtils.isFalseOrZero(notification.notif) && notification.site == this.siteId) {
                // Don't refresh unread counts, it's refreshed from the main menu handler in this case.
                    this.refreshData(undefined, false);
                }
            });
    }

    /**
     * Component loaded.
     */
    ngOnInit(): void {
        this.route.queryParams.subscribe(async (params) => {
            const discussionUserId = CoreNavigator.getRouteNumberParam('discussionUserId', params) ||
                CoreNavigator.getRouteNumberParam('userId', params) || undefined;

            if (this.loaded && this.discussionUserId == discussionUserId) {
                return;
            }

            this.discussionUserId = discussionUserId;

            if (this.discussionUserId) {
                // There is a discussion to load, open the discussion in a new state.
                this.gotoDiscussion(this.discussionUserId);
            }

            await this.fetchData();

            if (!this.discussionUserId && this.discussions.length > 0 && CoreScreen.isTablet) {
                // Take first and load it.
                this.gotoDiscussion(this.discussions[0].message!.user);
            }
        });
    }

    /**
     * Refresh the data.
     *
     * @param refresher Refresher.
     * @param refreshUnreadCounts Whteher to refresh unread counts.
     * @return Promise resolved when done.
     */
    async refreshData(refresher?: CustomEvent<IonRefresher>, refreshUnreadCounts: boolean = true): Promise<void> {
        const promises: Promise<void>[] = [];
        promises.push(AddonMessages.invalidateDiscussionsCache(this.siteId));

        if (refreshUnreadCounts) {
            promises.push(AddonMessages.invalidateUnreadConversationCounts(this.siteId));
        }

        await CoreUtils.allPromises(promises).finally(() => this.fetchData().finally(() => {
            if (refresher) {
                refresher?.detail.complete();
            }
        }));
    }

    /**
     * Fetch discussions.
     *
     * @return Promise resolved when done.
     */
    protected async fetchData(): Promise<void> {
        this.loadingMessage = this.loadingMessages;
        this.search.enabled = AddonMessages.isSearchMessagesEnabled();

        const promises: Promise<unknown>[] = [];

        promises.push(AddonMessages.getDiscussions(this.siteId).then((discussions) => {
            // Convert to an array for sorting.
            const discussionsSorted: AddonMessagesDiscussion[] = [];
            for (const userId in discussions) {
                discussions[userId].unread = !!discussions[userId].unread;

                discussionsSorted.push(discussions[userId]);
            }

            this.discussions = discussionsSorted.sort((a, b) => (b.message?.timecreated || 0) - (a.message?.timecreated || 0));

            return;
        }));

        promises.push(AddonMessages.getUnreadConversationCounts(this.siteId));

        try {
            await Promise.all(promises);
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'addon.messages.errorwhileretrievingdiscussions', true);
        }

        this.loaded = true;
    }

    /**
     * Clear search and show discussions again.
     */
    clearSearch(): void {
        this.loaded = false;
        this.search.showResults = false;
        this.search.text = ''; // Reset searched string.
        this.fetchData().finally(() => {
            this.loaded = true;
        });
    }

    /**
     * Search messages cotaining text.
     *
     * @param query Text to search for.
     * @return Resolved when done.
     */
    async searchMessage(query: string): Promise<void> {
        CoreApp.closeKeyboard();
        this.loaded = false;
        this.loadingMessage = this.search.loading;

        try {
            const searchResults = await AddonMessages.searchMessages(query, undefined, undefined, undefined, this.siteId);
            this.search.showResults = true;
            this.search.results = searchResults.messages;
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'addon.messages.errorwhileretrievingmessages', true);
        }

        this.loaded = true;
    }

    /**
     * Navigate to a particular discussion.
     *
     * @param discussionUserId Discussion Id to load.
     * @param messageId Message to scroll after loading the discussion. Used when searching.
     * @param onlyWithSplitView Only go to Discussion if split view is on.
     */
    gotoDiscussion(discussionUserId: number, messageId?: number): void {
        this.discussionUserId = discussionUserId;

        const params: Params = {
            userId: discussionUserId,
        };

        if (messageId) {
            params.message = messageId;
        }

        const splitViewLoaded = CoreNavigator.isCurrentPathInTablet('**/messages/index/discussion');
        const path = (splitViewLoaded ? '../' : '') + 'discussion';

        CoreNavigator.navigate(path, { params });
    }

    /**
     * Navigate to contacts view.
     */
    gotoContacts(): void {
        const params: Params = {};

        if (CoreScreen.isTablet && this.discussionUserId) {
            params.discussionUserId = this.discussionUserId;
        }

        CoreNavigator.navigateToSitePath('contacts-35', { params });
    }

    /**
     * Component destroyed.
     */
    ngOnDestroy(): void {
        this.newMessagesObserver?.off();
        this.readChangedObserver?.off();
        this.appResumeSubscription?.unsubscribe();
        this.pushObserver?.unsubscribe();
    }

}
