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

import { Component } from '@angular/core';

import { CoreUser } from '@features/user/services/user';
import { CoreCourseProvider } from '@features/course/services/course';
import { CoreFilterHelper } from '@features/filter/services/filter-helper';
import { Translate } from '@singletons';
import { CoreCourseModuleCompletionBaseComponent } from '@features/course/classes/module-completion';

/**
 * Component to handle activity completion in sites previous to 3.11.
 * It shows a checkbox with the current status, and allows manually changing the completion if it's allowed.
 *
 * Example usage:
 *
 * <core-course-module-completion-legacy [completion]="module.completiondata" [moduleName]="module.name"
 *     (completionChanged)="completionChanged()"></core-course-module-completion-legacy>
 */
@Component({
    selector: 'core-course-module-completion-legacy',
    templateUrl: 'core-course-module-completion-legacy.html',
    styleUrls: ['module-completion-legacy.scss'],
})
export class CoreCourseModuleCompletionLegacyComponent extends CoreCourseModuleCompletionBaseComponent {

    completionImage?: string;
    completionDescription?: string;

    /**
     * @inheritdoc
     */
    protected async calculateData(): Promise<void> {
        if (!this.completion) {
            return;
        }

        const moduleName = this.moduleName || '';
        let langKey: string | undefined;
        let image: string | undefined;

        if (this.completion.tracking === CoreCourseProvider.COMPLETION_TRACKING_MANUAL &&
                this.completion.state === CoreCourseProvider.COMPLETION_INCOMPLETE) {
            image = 'completion-manual-n';
            langKey = 'core.completion-alt-manual-n';
        } else if (this.completion.tracking === CoreCourseProvider.COMPLETION_TRACKING_MANUAL &&
                this.completion.state === CoreCourseProvider.COMPLETION_COMPLETE) {
            image = 'completion-manual-y';
            langKey = 'core.completion-alt-manual-y';
        } else if (this.completion.tracking === CoreCourseProvider.COMPLETION_TRACKING_AUTOMATIC &&
                this.completion.state === CoreCourseProvider.COMPLETION_INCOMPLETE) {
            image = 'completion-auto-n';
            langKey = 'core.completion-alt-auto-n';
        } else if (this.completion.tracking === CoreCourseProvider.COMPLETION_TRACKING_AUTOMATIC &&
                this.completion.state === CoreCourseProvider.COMPLETION_COMPLETE) {
            image = 'completion-auto-y';
            langKey = 'core.completion-alt-auto-y';
        } else if (this.completion.tracking === CoreCourseProvider.COMPLETION_TRACKING_AUTOMATIC &&
                this.completion.state === CoreCourseProvider.COMPLETION_COMPLETE_PASS) {
            image = 'completion-auto-pass';
            langKey = 'core.completion-alt-auto-pass';
        } else if (this.completion.tracking === CoreCourseProvider.COMPLETION_TRACKING_AUTOMATIC &&
                this.completion.state === CoreCourseProvider.COMPLETION_COMPLETE_FAIL) {
            image = 'completion-auto-fail';
            langKey = 'core.completion-alt-auto-fail';
        }

        if (image) {
            if (this.completion.overrideby && this.completion.overrideby > 0) {
                image += '-override';
            }
            this.completionImage = 'assets/img/completion/' + image + '.svg';
        }

        if (!moduleName || !this.moduleId || !langKey) {
            return;
        }

        const result = await CoreFilterHelper.getFiltersAndFormatText(
            moduleName,
            'module',
            this.moduleId,
            { clean: true, singleLine: true, shortenLength: 50, courseId: this.completion.courseId },
        );

        let translateParams: Record<string, unknown> = {
            $a: result.text,
        };

        if (this.completion.overrideby && this.completion.overrideby > 0) {
            langKey += '-override';

            const profile = await CoreUser.getProfile(this.completion.overrideby, this.completion.courseId, true);

            translateParams = {
                $a: {
                    overrideuser: profile.fullname,
                    modname: result.text,
                },
            };
        }

        this.completionDescription = Translate.instant(langKey, translateParams);
    }

}
