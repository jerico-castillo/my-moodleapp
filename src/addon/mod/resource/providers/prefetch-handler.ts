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

import { Injectable, Injector } from '@angular/core';
import { CoreCourseModulePrefetchHandlerBase } from '@core/course/classes/module-prefetch-handler';
import { AddonModResourceProvider } from './resource';
import { AddonModResourceHelperProvider } from './helper';
import { CoreFilepoolProvider } from '@providers/filepool';

/**
 * Handler to prefetch resources.
 */
@Injectable()
export class AddonModResourcePrefetchHandler extends CoreCourseModulePrefetchHandlerBase {
    name = 'resource';
    component = AddonModResourceProvider.COMPONENT;
    isResource = true;

    constructor(injector: Injector, protected resourceProvider: AddonModResourceProvider,
            protected filepoolProvider: CoreFilepoolProvider, protected resourceHelper: AddonModResourceHelperProvider) {
        super(injector);
    }

    /**
     * Download or prefetch the content.
     *
     * @param {any} module The module object returned by WS.
     * @param {number} courseId Course ID.
     * @param {boolean} [prefetch] True to prefetch, false to download right away.
     * @param {string} [dirPath] Path of the directory where to store all the content files. This is to keep the files
     *                           relative paths and make the package work in an iframe. Undefined to download the files
     *                           in the filepool root folder.
     * @return {Promise<any>} Promise resolved when all content is downloaded. Data returned is not reliable.
     */
    downloadOrPrefetch(module: any, courseId: number, prefetch?: boolean, dirPath?: string): Promise<any> {
        let promise;

        if (this.resourceHelper.isDisplayedInIframe(module)) {
            promise = this.filepoolProvider.getPackageDirPathByUrl(this.sitesProvider.getCurrentSiteId(), module.url);
        } else {
            promise = Promise.resolve();
        }

        return promise.then((dirPath) => {
            const promises = [];

            promises.push(super.downloadOrPrefetch(module, courseId, prefetch, dirPath));

            if (this.resourceProvider.isGetResourceWSAvailable()) {
                promises.push(this.resourceProvider.getResourceData(courseId, module.id));
            }

            return Promise.all(promises);
        });
    }

    /**
     * Invalidate the prefetched content.
     *
     * @param {number} moduleId The module ID.
     * @param {number} courseId Course ID the module belongs to.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateContent(moduleId: number, courseId: number): Promise<any> {
        return this.resourceProvider.invalidateContent(moduleId, courseId);
    }

    /**
     * Invalidate WS calls needed to determine module status.
     *
     * @param {any} module Module.
     * @param {number} courseId Course ID the module belongs to.
     * @return {Promise<any>} Promise resolved when invalidated.
     */
    invalidateModule(module: any, courseId: number): Promise<any> {
        const promises = [];

        promises.push(this.resourceProvider.invalidateResourceData(courseId));
        promises.push(this.courseProvider.invalidateModule(module.id));

        return Promise.all(promises);
    }

    /**
     * Whether or not the handler is enabled on a site level.
     *
     * @return {boolean|Promise<boolean>} A boolean, or a promise resolved with a boolean, indicating if the handler is enabled.
     */
    isEnabled(): boolean | Promise<boolean> {
        return this.resourceProvider.isPluginEnabled();
    }
}
