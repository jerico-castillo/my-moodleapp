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
import { NavController } from 'ionic-angular';
import { CoreCourseOptionsHandler, CoreCourseOptionsHandlerData } from '../../course/providers/options-delegate';
import { CoreCourseProvider } from '../../course/providers/course';
import { CoreGradesProvider } from './grades';
import { CoreCoursesProvider } from '../../courses/providers/courses';
import { CoreGradesCourseComponent } from '../components/course/course';

/**
 * Course nav handler.
 */
@Injectable()
export class CoreGradesCourseOptionHandler implements CoreCourseOptionsHandler {
    name = 'CoreGrades';
    priority = 400;

    constructor(private gradesProvider: CoreGradesProvider, private coursesProvider: CoreCoursesProvider) {}

    /**
     * Should invalidate the data to determine if the handler is enabled for a certain course.
     *
     * @param {number} courseId The course ID.
     * @param {any} [navOptions] Course navigation options for current user. See CoreCoursesProvider.getUserNavigationOptions.
     * @param {any} [admOptions] Course admin options for current user. See CoreCoursesProvider.getUserAdministrationOptions.
     * @return {Promise<any>} Promise resolved when done.
     */
    invalidateEnabledForCourse(courseId: number, navOptions?: any, admOptions?: any): Promise<any> {
        if (navOptions && typeof navOptions.grades != 'undefined') {
            // No need to invalidate anything.
            return Promise.resolve();
        }

        return this.coursesProvider.invalidateUserCourses();
    }

    /**
     * Check if the handler is enabled on a site level.
     *
     * @return {boolean} Whether or not the handler is enabled on a site level.
     */
    isEnabled(): boolean | Promise<boolean> {
        return true;
    }

    /**
     * Whether or not the handler is enabled for a certain course.
     *
     * @param {number} courseId The course ID.
     * @param {any} accessData Access type and data. Default, guest, ...
     * @param {any} [navOptions] Course navigation options for current user. See CoreCoursesProvider.getUserNavigationOptions.
     * @param {any} [admOptions] Course admin options for current user. See CoreCoursesProvider.getUserAdministrationOptions.
     * @return {boolean|Promise<boolean>} True or promise resolved with true if enabled.
     */
    isEnabledForCourse(courseId: number, accessData: any, navOptions?: any, admOptions?: any): boolean | Promise<boolean> {
        if (accessData && accessData.type == CoreCourseProvider.ACCESS_GUEST) {
            return false; // Not enabled for guests.
        }

        if (navOptions && typeof navOptions.grades != 'undefined') {
            return navOptions.grades;
        }

        return this.gradesProvider.isPluginEnabledForCourse(courseId);
    }

    /**
     * Returns the data needed to render the handler.
     *
     * @return {CoreCourseOptionsHandlerData} Data needed to render the handler.
     */
    getDisplayData(): CoreCourseOptionsHandlerData {
        return {
            title: 'core.grades.grades',
            class: 'core-grades-course-handler',
            component: CoreGradesCourseComponent
        };
    }
}
