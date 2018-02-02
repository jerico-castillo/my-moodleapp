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
import { NavController, NavOptions } from 'ionic-angular';
import { AddonModBookProvider } from './book';
import { CoreCourseModuleHandler, CoreCourseModuleHandlerData } from '../../../../core/course/providers/module-delegate';
import { CoreCourseProvider } from '../../../../core/course/providers/course';

/**
 * Handler to support book modules.
 */
@Injectable()
export class AddonModBookModuleHandler implements CoreCourseModuleHandler {
    name = 'book';

    constructor(protected bookProvider: AddonModBookProvider, private courseProvider: CoreCourseProvider) { }

    /**
     * Check if the handler is enabled on a site level.
     *
     * @return {boolean|Promise<boolean>} Whether or not the handler is enabled on a site level.
     */
    isEnabled(): boolean | Promise<boolean> {
        return this.bookProvider.isPluginEnabled();
    }

    /**
     * Get the data required to display the module in the course contents view.
     *
     * @param {any} module The module object.
     * @param {number} courseId The course ID.
     * @param {number} sectionId The section ID.
     * @return {CoreCourseModuleHandlerData} Data to render the module.
     */
    getData(module: any, courseId: number, sectionId: number): CoreCourseModuleHandlerData {
        return {
            icon: this.courseProvider.getModuleIconSrc('book'),
            title: module.name,
            class: 'addon-mod_book-handler',
            action(event: Event, navCtrl: NavController, module: any, courseId: number, options: NavOptions): void {
                navCtrl.push('AddonModBookIndexPage', {module: module, courseId: courseId}, options);
            }
        };
    }

    /**
     * Get the component to render the module. This is needed to support singleactivity course format.
     *
     * @param {any} course The course object.
     * @param {any} module The module object.
     * @return {any} The component to use, undefined if not found.
     */
    getMainComponent(course: any, module: any): any {
        // @todo
    }
}
