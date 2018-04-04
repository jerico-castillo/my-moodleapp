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

import { Component, OnInit, OnDestroy, Injector, ElementRef } from '@angular/core';
import { CoreLoggerProvider } from '@providers/logger';
import { CoreQuestionBaseComponent } from '@core/question/classes/base-question-component';
import { AddonQtypeDdMarkerQuestion } from '../classes/ddmarker';

/**
 * Component to render a drag-and-drop markers question.
 */
@Component({
    selector: 'addon-qtype-ddmarker',
    templateUrl: 'ddmarker.html'
})
export class AddonQtypeDdMarkerComponent extends CoreQuestionBaseComponent implements OnInit, OnDestroy {

    protected element: HTMLElement;
    protected questionInstance: AddonQtypeDdMarkerQuestion;
    protected dropZones: any[]; // The drop zones received in the init object of the question.
    protected destroyed = false;

    constructor(protected loggerProvider: CoreLoggerProvider, injector: Injector, element: ElementRef) {
        super(loggerProvider, 'AddonQtypeDdMarkerComponent', injector);

        this.element = element.nativeElement;
    }

    /**
     * Component being initialized.
     */
    ngOnInit(): void {
        if (!this.question) {
            this.logger.warn('Aborting because of no question received.');

            return this.questionHelper.showComponentError(this.onAbort);
        }

        const div = document.createElement('div');
        div.innerHTML = this.question.html;

        // Get D&D area, form and question text.
        const ddArea = div.querySelector('.ddarea'),
            ddForm = div.querySelector('.ddform');

        this.question.text = this.domUtils.getContentsOfElement(div, '.qtext');
        if (!ddArea || !ddForm || typeof this.question.text == 'undefined') {
            this.logger.warn('Aborting because of an error parsing question.', this.question.name);

            return this.questionHelper.showComponentError(this.onAbort);
        }

        // Build the D&D area HTML.
        this.question.ddArea = ddArea.outerHTML;

        const wrongParts = div.querySelector('.wrongparts');
        if (wrongParts) {
            this.question.ddArea += wrongParts.outerHTML;
        }
        this.question.ddArea += ddForm.outerHTML;
        this.question.readOnly = false;

        if (this.question.initObjects) {
            if (typeof this.question.initObjects.dropzones != 'undefined') {
                this.dropZones = this.question.initObjects.dropzones;
            }
            if (typeof this.question.initObjects.readonly != 'undefined') {
                this.question.readOnly = this.question.initObjects.readonly;
            }
        }

        this.question.loaded = false;
    }

    /**
     * The question has been rendered.
     */
    questionRendered(): void {
        if (!this.destroyed) {
            // Create the instance.
            this.questionInstance = new AddonQtypeDdMarkerQuestion(this.loggerProvider, this.domUtils, this.textUtils, this.element,
                    this.question, this.question.readOnly, this.dropZones);
        }
    }

    /**
     * Component being destroyed.
     */
    ngOnDestroy(): void {
        this.destroyed = true;
        this.questionInstance && this.questionInstance.destroy();
    }
}
