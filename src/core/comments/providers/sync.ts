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
import { CoreLoggerProvider } from '@providers/logger';
import { CoreSitesProvider } from '@providers/sites';
import { CoreSyncBaseProvider } from '@classes/base-sync';
import { CoreAppProvider } from '@providers/app';
import { CoreCommentsOfflineProvider } from './offline';
import { CoreCommentsProvider } from './comments';
import { CoreCoursesProvider } from '@core/courses/providers/courses';
import { CoreEventsProvider } from '@providers/events';
import { CoreTextUtilsProvider } from '@providers/utils/text';
import { CoreTimeUtilsProvider } from '@providers/utils/time';
import { CoreUtilsProvider } from '@providers/utils/utils';
import { TranslateService } from '@ngx-translate/core';
import { CoreSyncProvider } from '@providers/sync';

/**
 * Service to sync omments.
 */
@Injectable()
export class CoreCommentsSyncProvider extends CoreSyncBaseProvider {

    static AUTO_SYNCED = 'core_comments_autom_synced';

    constructor(loggerProvider: CoreLoggerProvider, sitesProvider: CoreSitesProvider, appProvider: CoreAppProvider,
            syncProvider: CoreSyncProvider, textUtils: CoreTextUtilsProvider, translate: TranslateService,
            private commentsOffline: CoreCommentsOfflineProvider, private utils: CoreUtilsProvider,
            private eventsProvider: CoreEventsProvider,  private commentsProvider: CoreCommentsProvider,
            private coursesProvider: CoreCoursesProvider, timeUtils: CoreTimeUtilsProvider) {

        super('CoreCommentsSync', loggerProvider, sitesProvider, appProvider, syncProvider, textUtils, translate, timeUtils);
    }

    /**
     * Try to synchronize all the comments in a certain site or in all sites.
     *
     * @param  {string} [siteId] Site ID to sync. If not defined, sync all sites.
     * @param {boolean} [force] Wether to force sync not depending on last execution.
     * @return {Promise<any>}    Promise resolved if sync is successful, rejected if sync fails.
     */
    syncAllComments(siteId?: string, force?: boolean): Promise<any> {
        return this.syncOnSites('all comments', this.syncAllCommentsFunc.bind(this), [force], siteId);
    }

    /**
     * Synchronize all the comments in a certain site
     *
     * @param  {string} siteId Site ID to sync.
     * @param  {boolean} force Wether to force sync not depending on last execution.
     * @return {Promise<any>}  Promise resolved if sync is successful, rejected if sync fails.
     */
    private syncAllCommentsFunc(siteId: string, force: boolean): Promise<any> {
        return this.commentsOffline.getAllComments(siteId).then((comments) => {
            // Sync all courses.
            const promises = comments.map((comment) => {
                const promise = force ? this.syncComment(comment.contextlevel, comment.instanceid, comment.component,
                    comment.itemid, comment.area, siteId) : this.syncCommentIfNeeded(comment.contextlevel, comment.instanceid,
                    comment.component, comment.itemid, comment.area, siteId);

                return promise.then((warnings) => {
                    if (typeof warnings != 'undefined') {
                        // Sync successful, send event.
                        this.eventsProvider.trigger(CoreCommentsSyncProvider.AUTO_SYNCED, {
                            contextLevel: comment.contextlevel,
                            instanceId: comment.instanceid,
                            componentName: comment.component,
                            itemId: comment.itemid,
                            area: comment.area,
                            warnings: warnings
                        }, siteId);
                    }
                });
            });

            return Promise.all(promises);
        });
    }

    /**
     * Sync course notes only if a certain time has passed since the last time.
     *
     * @param  {string} contextLevel Contextlevel system, course, user...
     * @param  {number} instanceId   The Instance id of item associated with the context level.
     * @param  {string} component    Component name.
     * @param  {number} itemId       Associated id.
     * @param  {string} [area='']    String comment area. Default empty.
     * @param  {string} [siteId] Site ID. If not defined, current site.
     * @return {Promise<any>}    Promise resolved when the notes are synced or if they don't need to be synced.
     */
    private syncCommentIfNeeded(contextLevel: string, instanceId: number, component: string, itemId: number, area: string = '',
            siteId?: string): Promise<void> {
        const syncId = this.getSyncId(contextLevel, instanceId, component, itemId, area);

        return this.isSyncNeeded(syncId, siteId).then((needed) => {
            if (needed) {
                return this.syncComment(contextLevel, instanceId, component, itemId, area, siteId);
            }
        });
    }

    /**
     * Synchronize notes of a course.
     *
     * @param  {string} contextLevel Contextlevel system, course, user...
     * @param  {number} instanceId   The Instance id of item associated with the context level.
     * @param  {string} component    Component name.
     * @param  {number} itemId       Associated id.
     * @param  {string} [area='']    String comment area. Default empty.
     * @param  {string} [siteId] Site ID. If not defined, current site.
     * @return {Promise<any>}    Promise resolved if sync is successful, rejected otherwise.
     */
    syncComment(contextLevel: string, instanceId: number, component: string, itemId: number, area: string = '',
            siteId?: string): Promise<any> {
        siteId = siteId || this.sitesProvider.getCurrentSiteId();

        const syncId = this.getSyncId(contextLevel, instanceId, component, itemId, area);

        if (this.isSyncing(syncId, siteId)) {
            // There's already a sync ongoing for notes, return the promise.
            return this.getOngoingSync(syncId, siteId);
        }

        this.logger.debug('Try to sync comments ' + syncId);

        const warnings = [];

        // Get offline comments to be sent.
        const syncPromise = this.commentsOffline.getComment(contextLevel, instanceId, component, itemId, area, siteId)
                .then((comment) => {
            if (!comment) {
                // Nothing to sync.
                return;
            } else if (!this.appProvider.isOnline()) {
                // Cannot sync in offline.
                return Promise.reject(this.translate.instant('core.networkerrormsg'));
            }

            const errors = [];
            let commentsResponse = [];
            let promise;

            if (comment.action == 'add') {
                promise = this.commentsProvider.addCommentOnline(comment.content, contextLevel, instanceId, component, itemId, area,
                    siteId);
            }

            // Send the comments.
            return promise.then((response) => {
                commentsResponse = response;

                // Fetch the comments from server to be sure they're up to date.
                return this.commentsProvider.invalidateCommentsData(contextLevel, instanceId, component, itemId, area, siteId)
                        .then(() => {
                    return this.commentsProvider.getComments(contextLevel, instanceId, component, itemId, area, 0, siteId);
                }).catch(() => {
                    // Ignore errors.
                });
            }).catch((error) => {
                if (this.utils.isWebServiceError(error)) {
                    // It's a WebService error, this means the user cannot send comments.
                    errors.push(error);
                } else {
                    // Not a WebService error, reject the synchronization to try again.
                    return Promise.reject(error);
                }
            }).then(() => {
                // Notes were sent, delete them from local DB.
                const promises = commentsResponse.map((comment) => {
                    return this.commentsOffline.removeComment(contextLevel, instanceId, component, itemId, area, siteId);
                });

                return Promise.all(promises);
            }).then(() => {
                if (errors && errors.length) {
                    errors.forEach((error) => {
                        warnings.push(this.translate.instant('addon.notes.warningnotenotsent', {
                            contextLevel: contextLevel,
                            instanceId: instanceId,
                            componentName: component,
                            itemId: itemId,
                            area: area,
                            error: error
                        }));
                    });
                }
            });
        }).then(() => {
            // All done, return the warnings.
            return warnings;
        });

        return this.addOngoingSync(syncId, syncPromise, siteId);
    }

    /**
     * Get the ID of a comments sync.
     *
     * @param  {string} contextLevel Contextlevel system, course, user...
     * @param  {number} instanceId   The Instance id of item associated with the context level.
     * @param  {string} component    Component name.
     * @param  {number} itemId       Associated id.
     * @param  {string} [area='']    String comment area. Default empty.
     * @return {string} Sync ID.
     */
    protected getSyncId(contextLevel: string, instanceId: number, component: string, itemId: number, area: string = ''): string {
        return contextLevel + '#' + instanceId + '#' + component + '#' + itemId + '#' + area;
    }
}
