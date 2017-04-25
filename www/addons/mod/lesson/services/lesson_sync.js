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

angular.module('mm.addons.mod_lesson')

.constant('mmaModLessonAttemptsFinishedSyncStore', 'mma_mod_lesson_attempts_finished_sync')

.config(function($mmSitesFactoryProvider, mmaModLessonAttemptsFinishedSyncStore) {
    var stores = [
        {
            name: mmaModLessonAttemptsFinishedSyncStore,
            keyPath: 'lessonid', // Only 1 attempt per lesson.
            indexes: [
                {
                    name: 'attempt'
                },
                {
                    name: 'timefinished'
                }
            ]
        }
    ];
    $mmSitesFactoryProvider.registerStores(stores);
})

/**
 * Lesson synchronization service.
 *
 * @module mm.addons.mod_lesson
 * @ngdoc service
 * @name $mmaModLessonSync
 */
.factory('$mmaModLessonSync', function($log, $mmaModLesson, $mmSite, $mmSitesManager, $q, $mmaModLessonOffline, $mmUtil,
            $mmLang, $mmApp, $mmEvents, $translate, mmaModLessonSyncTime, $mmSync, mmaModLessonAutomSyncedEvent,
            mmaModLessonComponent, $mmaModLessonPrefetchHandler, $mmCourse, $mmSyncBlock, mmaModLessonAttemptsFinishedSyncStore) {

    $log = $log.getInstance('$mmaModLessonSync');

    // Inherit self from $mmSync.
    var self = $mmSync.createChild(mmaModLessonComponent, mmaModLessonSyncTime);

    /**
     * Unmark an attempt as finished in a synchronization.
     *
     * @module mm.addons.mod_lesson
     * @ngdoc method
     * @name $mmaModLessonSync#deleteAttemptFinishedInSync
     * @param  {Number} lessonId Lesson ID.
     * @param  {String} [siteId] Site ID. If not defined, current site.
     * @return {Promise}         Promise resolved when done.
     */
    self.deleteAttemptFinishedInSync = function(lessonId, siteId) {
        return $mmSitesManager.getSite(siteId).then(function(site) {
            return site.getDb().remove(mmaModLessonAttemptsFinishedSyncStore, lessonId);
        }).catch(function() {
            // Ignore errors, maybe there is none.
        });
    };

    /**
     * Get the number of an attempt finished in a synchronization for a certain lesson (if any).
     *
     * @module mm.addons.mod_lesson
     * @ngdoc method
     * @name $mmaModLessonSync#getAttemptFinishedInSync
     * @param  {Number} lessonId Lesson ID.
     * @param  {String} [siteId] Site ID. If not defined, current site.
     * @return {Promise}         Promise resolved with the attempt entry (undefined if no attempt).
     */
    self.getAttemptFinishedInSync = function(lessonId, siteId) {
        return $mmSitesManager.getSite(siteId).then(function(site) {
            return site.getDb().get(mmaModLessonAttemptsFinishedSyncStore, lessonId);
        }).catch(function() {
            // Ignore errors, return undefined.
        });
    };

    /**
     * Check if a lesson has data to synchronize.
     *
     * @module mm.addons.mod_lesson
     * @ngdoc method
     * @name $mmaModLessonSync#hasDataToSync
     * @param  {Number} lessonId Lesson ID.
     * @param  {Number} attempt  Attempt number.
     * @param  {String} [siteId] Site ID. If not defined, current site.
     * @return {Promise}         Promise resolved with boolean: true if has data to sync, false otherwise.
     */
    self.hasDataToSync = function(lessonId, attempt, siteId) {
        var promises = [],
            hasDataToSync = false;

        promises.push($mmaModLessonOffline.hasAttemptAnswers(lessonId, attempt, siteId).then(function(hasAnswers) {
            hasDataToSync = hasDataToSync || hasAnswers;
        }).catch(function() {
            // Ignore errors.
        }));

        promises.push($mmaModLessonOffline.hasFinishedAttempt(lessonId, siteId).then(function(hasFinished) {
            hasDataToSync = hasDataToSync || hasFinished;
        }));

        return $q.all(promises).then(function() {
            return hasDataToSync;
        });
    };

    /**
     * Mark an attempt as finished in a synchronization.
     *
     * @module mm.addons.mod_lesson
     * @ngdoc method
     * @name $mmaModLessonSync#setAttemptFinishedInSync
     * @param  {Number} lessonId Lesson ID.
     * @param  {Number} attempt  The attempt number.
     * @param  {Number} pageId   The page ID to start reviewing from.
     * @param  {String} [siteId] Site ID. If not defined, current site.
     * @return {Promise}         Promise resolved when done.
     */
    self.setAttemptFinishedInSync = function(lessonId, attempt, pageId, siteId) {
        return $mmSitesManager.getSite(siteId).then(function(site) {
            return site.getDb().insert(mmaModLessonAttemptsFinishedSyncStore, {
                lessonid: lessonId,
                attempt: parseInt(attempt, 10),
                pageid: parseInt(pageId, 10),
                timefinished: $mmUtil.timestamp()
            });
        });
    };

    /**
     * Try to synchronize all lessons that need it and haven't been synchronized in a while.
     *
     * @module mm.addons.mod_lesson
     * @ngdoc method
     * @name $mmaModLessonSync#syncAllLessons
     * @param {String} [siteId] Site ID to sync. If not defined, sync all sites.
     * @return {Promise}        Promise resolved when the sync is done.
     */
    self.syncAllLessons = function(siteId) {
        if (!$mmApp.isOnline()) {
            $log.debug('Cannot sync all lessons because device is offline.');
            return $q.reject();
        }

        var promise;
        if (!siteId) {
            // No site ID defined, sync all sites.
            $log.debug('Try to sync lessons in all sites.');
            promise = $mmSitesManager.getSitesIds();
        } else {
            $log.debug('Try to sync lessons in site ' + siteId);
            promise = $q.when([siteId]);
        }

        return promise.then(function(siteIds) {
            var sitePromises = [];

            angular.forEach(siteIds, function(siteId) {
                sitePromises.push($mmaModLessonOffline.getAllLessonsWithData(siteId).then(function(lessons) {
                    // Sync all lessons that haven't been synced for a while.
                    var promises = [];

                    angular.forEach(lessons, function(lesson) {
                        promises.push(self.syncLessonIfNeeded(lesson.id, false, siteId).then(function(result) {
                            if (result && result.updated) {
                                // Sync successful, send event.
                                $mmEvents.trigger(mmaModLessonAutomSyncedEvent, {
                                    siteid: siteId,
                                    lessonid: lesson.id,
                                    warnings: result.warnings
                                });
                            }
                        }));
                    });

                    return $q.all(promises);
                }));
            });

            return $q.all(sitePromises);
        });
    };

    /**
     * Sync a lesson only if a certain time has passed since the last time.
     *
     * @module mm.addons.mod_lesson
     * @ngdoc method
     * @name $mmaModLessonSync#syncLessonIfNeeded
     * @param  {Number} lessonId     Lesson ID.
     * @param  {Boolean} askPassword True if we should ask for password if needed, false otherwise.
     * @param  {String} [siteId]     Site ID. If not defined, current site.
     * @return {Promise}             Promise resolved when the lesson is synced or if it doesn't need to be synced.
     */
    self.syncLessonIfNeeded = function(lessonId, askPassword, siteId) {
        return self.isSyncNeeded(lessonId, siteId).then(function(needed) {
            if (needed) {
                return self.syncLesson(lessonId, askPassword, false, siteId);
            }
        });
    };

    /**
     * Try to synchronize a lesson.
     *
     * @module mm.addons.mod_lesson
     * @ngdoc method
     * @name $mmaModLessonSync#syncLesson
     * @param  {Number} lessonId     Lesson ID.
     * @param  {Boolean} askPassword True if we should ask for password if needed, false otherwise.
     * @param  {Boolean} ignoreBlock True to ignore the sync block setting.
     * @param  {String} [siteId]     Site ID. If not defined, current site.
     * @return {Promise}             Promise rejected in failure, resolved in success with an object containing:
     *                                       -warnings Array of warnings.
     *                                       -updated  True if some data was sent to the server.
     */
    self.syncLesson = function(lessonId, askPassword, ignoreBlock, siteId) {
        siteId = siteId || $mmSite.getId();

        var syncPromise,
            lesson,
            courseId,
            password,
            accessInfo,
            result = {
                warnings: [],
                updated: false
            };

        if (self.isSyncing(lessonId, siteId)) {
            // There's already a sync ongoing for this lesson, return the promise.
            return self.getOngoingSync(lessonId, siteId);
        }

        // Verify that lesson isn't blocked.
        if (!ignoreBlock && $mmSyncBlock.isBlocked(mmaModLessonComponent, lessonId, siteId)) {
            $log.debug('Cannot sync lesson ' + lessonId + ' because it is blocked.');
            var moduleName = $mmCourse.translateModuleName('lesson');
            return $mmLang.translateAndReject('mm.core.errorsyncblocked', {$a: moduleName});
        }

        $log.debug('Try to sync lesson ' + lessonId + ' in site ' + siteId);

        // Try to synchronize the answers first.
        syncPromise = $mmaModLessonOffline.getLessonAnswers(lessonId, siteId).then(function(answers) {
            if (!answers.length) {
                return;
            } else if (!$mmApp.isOnline()) {
                // Cannot sync in offline.
                return $q.reject();
            }

            courseId = answers[0].courseid;

            // Get the info, access info and the lesson password if needed.
            return $mmaModLesson.getLessonById(courseId, lessonId).then(function(lessonData) {
                lesson = lessonData;

                return $mmaModLessonPrefetchHandler.gatherLessonPassword(lessonId, false, true, askPassword, siteId);
            }).then(function(data) {
                var answersLength = answers.length;

                accessInfo = data.accessinfo;
                password = data.password;
                lesson = data.lesson || lesson;

                var promises = [];

                // Filter the answers, get only the ones that belong to the current attempt.
                answers = answers.filter(function(answer) {
                    if (answer.attempt != accessInfo.attemptscount) {
                        promises.push($mmaModLessonOffline.deleteAnswer(lesson.id, answer.attempt, answer.pageid,
                                answer.timemodified, siteId).catch(function() {
                            // Ignore errors.
                        }));
                        return false;
                    }
                    return true;
                });

                if (answers.length != answersLength) {
                    // Some answers won't be sent, add a warning.
                    result.warnings.push($translate.instant('mm.core.warningofflinedatadeleted', {
                        component: $mmCourse.translateModuleName('lesson'),
                        name: lesson.name,
                        error: $translate.instant('mma.mod_lesson.warningattemptfinished')
                    }));
                }

                return $q.all(promises);
            }).then(function() {
                if (!answers.length) {
                    return;
                }

                // Send the answers in the same order they were answered.
                answers.sort(function(a, b) {
                    return a.timemodified - b.timemodified;
                });

                answers = answers.map(function(answer) {
                    return {
                        func: sendAnswer,
                        params: [lesson, password, answer, result, siteId],
                        blocking: true
                    };
                });

                return $mmUtil.executeOrderedPromises(answers);
            });
        }).then(function() {
            // Answers sent or there was none. If there is a finished attempt, send it.
            return $mmaModLessonOffline.getAttempt(lessonId, siteId).then(function(attempt) {
                if (!attempt.finished) {
                    // The attempt isn't marked as finished, nothing to send. Delete the attempt.
                    return $mmaModLessonOffline.deleteAttempt(lessonId, siteId);
                } else if (!$mmApp.isOnline()) {
                    // Cannot sync in offline.
                    return $q.reject();
                }

                var promise;

                courseId = attempt.courseid;

                if (lesson) {
                    // Data already retrieved when syncing answers.
                    promise = $q.when();
                } else {
                    promise = $mmaModLesson.getLessonById(courseId, lessonId).then(function(lessonData) {
                        lesson = lessonData;

                        return $mmaModLessonPrefetchHandler.gatherLessonPassword(lessonId, false, true, askPassword, siteId);
                    }).then(function(data) {
                        accessInfo = data.accessinfo;
                        password = data.password;
                        lesson = data.lesson || lesson;
                    });
                }

                return promise.then(function() {
                    if (attempt.attempt != accessInfo.attemptscount) {
                        // The attempt changed, add a warning if it isn't there already.
                        if (!result.warnings.length) {
                            result.warnings.push($translate.instant('mm.core.warningofflinedatadeleted', {
                                component: $mmCourse.translateModuleName('lesson'),
                                name: lesson.name,
                                error: $translate.instant('mma.mod_lesson.warningattemptfinished')
                            }));
                        }

                        return $mmaModLessonOffline.deleteAttempt(lessonId, siteId);
                    }

                    // All good, finish the attempt.
                    return $mmaModLesson.finishAttemptOnline(lessonId, password, false, false, siteId).then(function(response) {
                        result.updated = true;

                        if (!ignoreBlock) {
                            // Mark the attempt as finished in a sync if it can be reviewed.
                            if (response.data && response.data.reviewlesson) {
                                var params = $mmUtil.extractUrlParams(response.data.reviewlesson.value);
                                if (params && params.pageid) {
                                    // The attempt can be reviewed, mark it as finished. Don't block the user for this.
                                    self.setAttemptFinishedInSync(lessonId, attempt.attempt, params.pageid, siteId);
                                }
                            }
                        }

                        return $mmaModLessonOffline.deleteAttempt(lessonId, siteId);
                    }).catch(function(error) {
                        if (error && $mmUtil.isWebServiceError(error)) {
                            // The WebService has thrown an error, this means that responses cannot be submitted. Delete them.
                            result.updated = true;
                            return $mmaModLessonOffline.deleteAttempt(lessonId, siteId).then(function() {
                                // Attempt deleted, add a warning.
                                result.warnings.push($translate.instant('mm.core.warningofflinedatadeleted', {
                                    component: $mmCourse.translateModuleName('lesson'),
                                    name: lesson.name,
                                    error: error
                                }));
                            });
                        } else {
                            // Couldn't connect to server, reject.
                            return $q.reject(error);
                        }
                    });
                });
            }, function() {
                // No attempt stored, nothing to do.
            });
        }).then(function() {
            if (result.updated && courseId) {
                // Data has been sent to server. Now invalidate the WS calls.
                var promises = [];
                promises.push($mmaModLesson.invalidateAccessInformation(lessonId, siteId));
                promises.push($mmaModLesson.invalidateContentPagesViewed(lessonId, siteId));
                promises.push($mmaModLesson.invalidateQuestionsAttempts(lessonId, siteId));
                promises.push($mmaModLesson.invalidatePagesPossibleJumps(lessonId, siteId));
                promises.push($mmaModLesson.invalidateTimers(lessonId, siteId));

                return $mmUtil.allPromises(promises).catch(function() {
                    // Ignore errors.
                }).then(function() {
                    // Sync successful, update some data that might have been modified.
                    return $mmaModLesson.getAccessInformation(lessonId, false, false, siteId).then(function(info) {
                        var promises = [],
                            attempt = info.attemptscount;

                        promises.push($mmaModLesson.getContentPagesViewedOnline(lessonId, attempt, false, false, siteId));
                        promises.push($mmaModLesson.getQuestionsAttemptsOnline(
                                    lessonId, attempt, false, undefined, false, false, siteId));

                        return $q.all(promises);
                    }).catch(function() {
                        // Ignore errors.
                    });

                });
            }
        }).then(function() {
            // Sync finished, set sync time.
            return self.setSyncTime(lessonId, siteId).catch(function() {
                // Ignore errors.
            });
        }).then(function() {
            // All done, return the warnings.
            return result;
        });

        return self.addOngoingSync(lessonId, syncPromise, siteId);
    };

    /**
     * Send an answer to the site and delete it afterwards.
     *
     * @param  {Object} lesson   Lesson.
     * @param  {String} password Password (if any).
     * @param  {Object} answer   Answer to send.
     * @param  {Object} result   Result where to store the data.
     * @param  {String} [siteId] Site ID. If not defined, current site.
     * @return {Promise}         Promise resolved when done.
     */
    function sendAnswer(lesson, password, answer, result, siteId) {
        return $mmaModLesson.processPageOnline(lesson.id, answer.pageid, answer.data, password, false, siteId).then(function() {
            result.updated = true;

            return $mmaModLessonOffline.deleteAnswer(lesson.id, answer.attempt, answer.pageid, answer.timemodified, siteId);
        }).catch(function(error) {
            if (error && $mmUtil.isWebServiceError(error)) {
                // The WebService has thrown an error, this means that the answer cannot be submitted. Delete it.
                result.updated = true;
                return $mmaModLessonOffline.deleteAnswer(lesson.id, answer.attempt, answer.pageid, answer.timemodified, siteId)
                        .then(function() {
                    // Answer deleted, add a warning.
                    result.warnings.push($translate.instant('mm.core.warningofflinedatadeleted', {
                        component: $mmCourse.translateModuleName('lesson'),
                        name: lesson.name,
                        error: error
                    }));
                });
            } else {
                // Couldn't connect to server, reject.
                return $q.reject(error);
            }
        });
    }

    return self;
});
