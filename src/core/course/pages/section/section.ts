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

import { Component, ViewChild, OnDestroy } from '@angular/core';
import { IonicPage, NavParams, Content, NavController } from 'ionic-angular';
import { TranslateService } from '@ngx-translate/core';
import { CoreEventsProvider } from '../../../../providers/events';
import { CoreSitesProvider } from '../../../../providers/sites';
import { CoreDomUtilsProvider } from '../../../../providers/utils/dom';
import { CoreTextUtilsProvider } from '../../../../providers/utils/text';
import { CoreCourseProvider } from '../../providers/course';
import { CoreCourseHelperProvider } from '../../providers/helper';
import { CoreCourseFormatDelegate } from '../../providers/format-delegate';
import { CoreCoursesDelegate, CoreCoursesHandlerToDisplay } from '../../../courses/providers/delegate';
import { CoreCoursesProvider } from '../../../courses/providers/courses';

/**
 * Page that displays the list of courses the user is enrolled in.
 */
@IonicPage({segment: 'core-course-section'})
@Component({
    selector: 'page-core-course-section',
    templateUrl: 'section.html',
})
export class CoreCourseSectionPage implements OnDestroy {
    @ViewChild(Content) content: Content;

    title: string;
    course: any;
    sections: any[];
    sectionId: number;
    sectionNumber: number;
    courseHandlers: CoreCoursesHandlerToDisplay[];
    dataLoaded: boolean;
    downloadEnabled: boolean;
    downloadEnabledIcon: string = 'square-outline'; // Disabled by default.
    prefetchCourseData = {
        prefetchCourseIcon: 'spinner'
    };

    protected completionObserver;
    protected courseStatusObserver;
    protected isDestroyed = false;

    constructor(private navParams: NavParams, private courseProvider: CoreCourseProvider, private domUtils: CoreDomUtilsProvider,
            private courseFormatDelegate: CoreCourseFormatDelegate, private coursesDelegate: CoreCoursesDelegate,
            private translate: TranslateService, private courseHelper: CoreCourseHelperProvider, eventsProvider: CoreEventsProvider,
            private textUtils: CoreTextUtilsProvider, private coursesProvider: CoreCoursesProvider,
            sitesProvider: CoreSitesProvider, private navCtrl: NavController) {
        this.course = navParams.get('course');
        this.sectionId = navParams.get('sectionId');
        this.sectionNumber = navParams.get('sectionNumber');

        // Get the title to display. We dont't have sections yet.
        this.title = courseFormatDelegate.getCourseTitle(this.course);

        this.completionObserver = eventsProvider.on(CoreEventsProvider.COMPLETION_MODULE_VIEWED, (data) => {
            if (data && data.courseId == this.course.id) {
                this.refreshAfterCompletionChange();
            }
        });

        // Listen for changes in course status.
        this.courseStatusObserver = eventsProvider.on(CoreEventsProvider.COURSE_STATUS_CHANGED, (data) => {
            if (data.courseId == this.course.id) {
                this.prefetchCourseData.prefetchCourseIcon = this.courseHelper.getCourseStatusIconFromStatus(data.status);
            }
        }, sitesProvider.getCurrentSiteId());
    }

    /**
     * View loaded.
     */
    ionViewDidLoad() {

        let module = this.navParams.get('module');
        if (module) {
            this.courseHelper.openModule(this.navCtrl, module, this.course.id, this.sectionId);
        }

        this.loadData().finally(() => {
            this.dataLoaded = true;

            // Determine the course prefetch status.
            this.determineCoursePrefetchIcon().then(() => {
                if (this.prefetchCourseData.prefetchCourseIcon == 'spinner') {
                    // Course is being downloaded. Get the download promise.
                    const promise = this.courseHelper.getCourseDownloadPromise(this.course.id);
                    if (promise) {
                        // There is a download promise. Show an error if it fails.
                        promise.catch((error) => {
                            if (!this.isDestroyed) {
                                this.domUtils.showErrorModalDefault(error, 'core.course.errordownloadingcourse', true);
                            }
                        });
                    } else {
                        // No download, this probably means that the app was closed while downloading. Set previous status.
                        this.courseProvider.setCoursePreviousStatus(this.course.id).then((status) => {
                            this.prefetchCourseData.prefetchCourseIcon = this.courseHelper.getCourseStatusIconFromStatus(status);
                        });
                    }
                }
            });
        });
    }

    /**
     * Fetch and load all the data required for the view.
     */
    protected loadData(refresh?: boolean) {
        // First of all, get the course because the data might have changed.
        return this.coursesProvider.getUserCourse(this.course.id).then((course) => {
            let promises = [],
                promise;

            this.course = course;

            // Get the completion status.
            if (this.course.enablecompletion === false) {
                // Completion not enabled.
                promise = Promise.resolve({});
            } else {
                promise = this.courseProvider.getActivitiesCompletionStatus(this.course.id).catch(() => {
                    // It failed, don't use completion.
                    return {};
                });
            }

            promises.push(promise.then((completionStatus) => {
                // Get all the sections.
                promises.push(this.courseProvider.getSections(this.course.id, false, true).then((sections) => {
                    this.courseHelper.addHandlerDataForModules(sections, this.course.id, completionStatus);

                    // Format the name of each section and check if it has content.
                    this.sections = sections.map((section) => {
                        this.textUtils.formatText(section.name.trim(), true, true).then((name) => {
                            section.formattedName = name;
                        });
                        section.hasContent = this.courseHelper.sectionHasContent(section);
                        return section;
                    });


                    if (this.courseFormatDelegate.canViewAllSections(this.course)) {
                        // Add a fake first section (all sections).
                        this.sections.unshift({
                            name: this.translate.instant('core.course.allsections'),
                            id: CoreCourseProvider.ALL_SECTIONS_ID
                        });
                    }

                    // Get the title again now that we have sections.
                    this.title = this.courseFormatDelegate.getCourseTitle(this.course, this.sections);
                }));
            }));

            // Load the course handlers.
            promises.push(this.coursesDelegate.getHandlersToDisplay(this.course, refresh, false).then((handlers) => {
                this.courseHandlers = handlers;
            }));

            return Promise.all(promises).catch((error) => {
                this.domUtils.showErrorModalDefault(error, 'core.course.couldnotloadsectioncontent', true);
            });
        });
    }

    /**
     * Refresh the data.
     *
     * @param {any} refresher Refresher.
     */
    doRefresh(refresher: any) {
        this.invalidateData().finally(() => {
            this.loadData(true).finally(() => {
                refresher.complete();
            });
        });
    }

    /**
     * The completion of any of the modules have changed.
     */
    onCompletionChange() {
        this.invalidateData().finally(() => {
            this.refreshAfterCompletionChange();
        });
    }

    /**
     * Invalidate the data.
     */
    protected invalidateData() {
        let promises = [];

        promises.push(this.courseProvider.invalidateSections(this.course.id));
        promises.push(this.coursesProvider.invalidateUserCourses());
        promises.push(this.courseFormatDelegate.invalidateData(this.course, this.sections));

        // if ($scope.sections) {
        //     promises.push($mmCoursePrefetchDelegate.invalidateCourseUpdates(courseId));
        // }

        return Promise.all(promises);
    }

    /**
     * Refresh list after a completion change since there could be new activities.
     */
    protected refreshAfterCompletionChange() {
        // Save scroll position to restore it once done.
        let scrollElement = this.content.getScrollElement(),
            scrollTop = scrollElement.scrollTop || 0,
            scrollLeft = scrollElement.scrollLeft || 0;

        this.dataLoaded = false;
        this.content.scrollToTop(); // Scroll top so the spinner is seen.

        this.loadData().finally(() => {
            this.dataLoaded = true;
            this.content.scrollTo(scrollLeft, scrollTop);
        });
    }

    /**
     * Determines the prefetch icon of the course.
     */
    protected determineCoursePrefetchIcon() {
        return this.courseHelper.getCourseStatusIcon(this.course.id).then((icon) => {
            this.prefetchCourseData.prefetchCourseIcon = icon;
        });
    }

    /**
     * Prefetch the whole course.
     */
    prefetchCourse() {
        this.courseHelper.confirmAndPrefetchCourse(this.prefetchCourseData, this.course, this.sections, this.courseHandlers)
                .then((downloaded) => {
            if (downloaded && this.downloadEnabled) {
                // Recalculate the status.
                this.courseHelper.calculateSectionsStatus(this.sections, this.course.id).catch(() => {
                    // Ignore errors (shouldn't happen).
                });
            }
        }).catch((error) => {
            if (!this.isDestroyed) {
                this.domUtils.showErrorModalDefault(error, 'core.course.errordownloadingcourse', true);
            }
        });
    }

    /**
     * Toggle download enabled.
     */
    toggleDownload() {
        this.downloadEnabled = !this.downloadEnabled;
        this.downloadEnabledIcon = this.downloadEnabled ? 'checkbox-outline' : 'square-outline';
    }

    /**
     * Page destroyed.
     */
    ngOnDestroy() {
        this.isDestroyed = true;
        if (this.completionObserver) {
            this.completionObserver.off();
        }
    }
}
