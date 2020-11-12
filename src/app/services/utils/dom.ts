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

import { Injectable, SimpleChange, ElementRef, KeyValueChanges } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { IonContent } from '@ionic/angular';
import { AlertOptions, AlertButton, TextFieldTypes } from '@ionic/core';
import { Md5 } from 'ts-md5';

import { CoreApp } from '@services/app';
import { CoreConfig } from '@services/config';
import { CoreEvents } from '@singletons/events';
import { CoreFile } from '@services/file';
import { CoreWSExternalWarning } from '@services/ws';
import { CoreTextUtils, CoreTextErrorObject } from '@services/utils/text';
import { CoreUrlUtils } from '@services/utils/url';
import { CoreUtils } from '@services/utils/utils';
import { CoreConstants } from '@core/constants';
import { CoreIonLoadingElement } from '@classes/ion-loading';
import { CoreCanceledError } from '@classes/errors/cancelederror';
import { CoreError } from '@classes/errors/error';
import { CoreSilentError } from '@classes/errors/silenterror';

import { makeSingleton, Translate, AlertController, LoadingController, ToastController } from '@singletons/core.singletons';
import { CoreLogger } from '@singletons/logger';

/*
 * "Utils" service with helper functions for UI, DOM elements and HTML code.
 */
@Injectable()
export class CoreDomUtilsProvider {

    protected readonly INSTANCE_ID_ATTR_NAME = 'core-instance-id';

    // List of input types that support keyboard.
    protected readonly INPUT_SUPPORT_KEYBOARD: string[] = ['date', 'datetime', 'datetime-local', 'email', 'month', 'number',
        'password', 'search', 'tel', 'text', 'time', 'url', 'week'];

    protected template: HTMLTemplateElement = document.createElement('template'); // A template element to convert HTML to element.

    protected matchesFunctionName?: string; // Name of the "matches" function to use when simulating a closest call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected instances: {[id: string]: any} = {}; // Store component/directive instances by id.
    protected lastInstanceId = 0;
    protected debugDisplay = false; // Whether to display debug messages. Store it in a variable to make it synchronous.
    protected displayedAlerts: Record<string, HTMLIonAlertElement> = {}; // To prevent duplicated alerts.
    protected logger: CoreLogger;

    constructor(protected domSanitizer: DomSanitizer) {
        this.logger = CoreLogger.getInstance('CoreDomUtilsProvider');

        this.init();
    }

    /**
     * Init some properties.
     */
    protected async init(): Promise<void> {
        // Check if debug messages should be displayed.
        const debugDisplay = await CoreConfig.instance.get<number>(CoreConstants.SETTINGS_DEBUG_DISPLAY, 0);

        this.debugDisplay = debugDisplay != 0;
    }

    /**
     * Equivalent to element.closest(). If the browser doesn't support element.closest, it will
     * traverse the parents to achieve the same functionality.
     * Returns the closest ancestor of the current element (or the current element itself) which matches the selector.
     *
     * @param element DOM Element.
     * @param selector Selector to search.
     * @return Closest ancestor.
     */
    closest(element: Element | undefined | null, selector: string): Element | null {
        if (!element) {
            return null;
        }

        // Try to use closest if the browser supports it.
        if (typeof element.closest == 'function') {
            return element.closest(selector);
        }

        if (!this.matchesFunctionName) {
            // Find the matches function supported by the browser.
            ['matches', 'webkitMatchesSelector', 'mozMatchesSelector', 'msMatchesSelector', 'oMatchesSelector'].some((fn) => {
                if (typeof document.body[fn] == 'function') {
                    this.matchesFunctionName = fn;

                    return true;
                }

                return false;
            });

            if (!this.matchesFunctionName) {
                return null;
            }
        }

        // Traverse parents.
        let elementToTreat: Element | null = element;

        while (elementToTreat) {
            if (elementToTreat[this.matchesFunctionName](selector)) {
                return elementToTreat;
            }
            elementToTreat = elementToTreat.parentElement;
        }

        return null;
    }

    /**
     * If the download size is higher than a certain threshold shows a confirm dialog.
     *
     * @param size Object containing size to download and a boolean to indicate if its totally or partialy calculated.
     * @param message Code of the message to show. Default: 'core.course.confirmdownload'.
     * @param unknownMessage ID of the message to show if size is unknown.
     * @param wifiThreshold Threshold to show confirm in WiFi connection. Default: CoreWifiDownloadThreshold.
     * @param limitedThreshold Threshold to show confirm in limited connection. Default: CoreDownloadThreshold.
     * @param alwaysConfirm True to show a confirm even if the size isn't high, false otherwise.
     * @return Promise resolved when the user confirms or if no confirm needed.
     */
    async confirmDownloadSize(
        size: {size: number; total: boolean},
        message?: string,
        unknownMessage?: string,
        wifiThreshold?: number,
        limitedThreshold?: number,
        alwaysConfirm?: boolean,
    ): Promise<void> {
        const readableSize = CoreTextUtils.instance.bytesToSize(size.size, 2);

        const getAvailableBytes = async (): Promise<number | null> => {
            const availableBytes = await CoreFile.instance.calculateFreeSpace();

            if (CoreApp.instance.isAndroid()) {
                return availableBytes;
            } else {
                // Space calculation is not accurate on iOS, but it gets more accurate when space is lower.
                // We'll only use it when space is <500MB, or we're downloading more than twice the reported space.
                if (availableBytes < CoreConstants.IOS_FREE_SPACE_THRESHOLD || size.size > availableBytes / 2) {
                    return availableBytes;
                } else {
                    return null;
                }
            }
        };

        const getAvailableSpace = (availableBytes: number | null): string => {
            if (availableBytes === null) {
                return '';
            } else {
                const availableSize = CoreTextUtils.instance.bytesToSize(availableBytes, 2);

                if (CoreApp.instance.isAndroid() && size.size > availableBytes - CoreConstants.MINIMUM_FREE_SPACE) {
                    throw new CoreError(
                        Translate.instance.instant(
                            'core.course.insufficientavailablespace',
                            { size: readableSize },
                        ),
                    );
                }

                return Translate.instance.instant('core.course.availablespace', { available: availableSize });
            }
        };

        const availableBytes = await getAvailableBytes();

        const availableSpace = getAvailableSpace(availableBytes);

        wifiThreshold = typeof wifiThreshold == 'undefined' ? CoreConstants.WIFI_DOWNLOAD_THRESHOLD : wifiThreshold;
        limitedThreshold = typeof limitedThreshold == 'undefined' ? CoreConstants.DOWNLOAD_THRESHOLD : limitedThreshold;

        let wifiPrefix = '';
        if (CoreApp.instance.isNetworkAccessLimited()) {
            wifiPrefix = Translate.instance.instant('core.course.confirmlimiteddownload');
        }

        if (size.size < 0 || (size.size == 0 && !size.total)) {
            // Seems size was unable to be calculated. Show a warning.
            unknownMessage = unknownMessage || 'core.course.confirmdownloadunknownsize';

            return this.showConfirm(
                wifiPrefix + Translate.instance.instant(
                    unknownMessage,
                    { availableSpace: availableSpace },
                ),
            );
        } else if (!size.total) {
            // Filesize is only partial.

            return this.showConfirm(
                wifiPrefix + Translate.instance.instant(
                    'core.course.confirmpartialdownloadsize',
                    { size: readableSize, availableSpace: availableSpace },
                ),
            );
        } else if (alwaysConfirm || size.size >= wifiThreshold ||
                (CoreApp.instance.isNetworkAccessLimited() && size.size >= limitedThreshold)) {
            message = message || (size.size === 0 ? 'core.course.confirmdownloadzerosize' : 'core.course.confirmdownload');

            return this.showConfirm(
                wifiPrefix + Translate.instance.instant(
                    message,
                    { size: readableSize, availableSpace: availableSpace },
                ),
            );
        }
    }

    /**
     * Convert some HTML as text into an HTMLElement. This HTML is put inside a div or a body.
     *
     * @param html Text to convert.
     * @return Element.
     */
    convertToElement(html: string): HTMLElement {
        // Add a div to hold the content, that's the element that will be returned.
        this.template.innerHTML = '<div>' + html + '</div>';

        return <HTMLElement> this.template.content.children[0];
    }

    /**
     * Create a "cancelled" error. These errors won't display an error message in showErrorModal functions.
     *
     * @return The error object.
     * @deprecated since 3.9.5. Just create the error directly.
     */
    createCanceledError(): CoreCanceledError {
        return new CoreCanceledError('');
    }

    /**
     * Given a list of changes for a component input detected by a KeyValueDiffers, create an object similar to the one
     * passed to the ngOnChanges functions.
     *
     * @param changes Changes detected by KeyValueDiffer.
     * @return Changes in a format like ngOnChanges.
     */
    createChangesFromKeyValueDiff(changes: KeyValueChanges<string, unknown>): { [name: string]: SimpleChange } {
        const newChanges: { [name: string]: SimpleChange } = {};

        // Added items are considered first change.
        changes.forEachAddedItem((item) => {
            newChanges[item.key] = new SimpleChange(item.previousValue, item.currentValue, true);
        });

        // Changed or removed items aren't first change.
        changes.forEachChangedItem((item) => {
            newChanges[item.key] = new SimpleChange(item.previousValue, item.currentValue, false);
        });
        changes.forEachRemovedItem((item) => {
            newChanges[item.key] = new SimpleChange(item.previousValue, item.currentValue, true);
        });

        return newChanges;
    }

    /**
     * Extract the downloadable URLs from an HTML code.
     *
     * @param html HTML code.
     * @return List of file urls.
     * @deprecated since 3.8. Use CoreFilepoolProvider.extractDownloadableFilesFromHtml instead.
     */
    extractDownloadableFilesFromHtml(html: string): string[] {
        this.logger.error('The function extractDownloadableFilesFromHtml has been moved to CoreFilepoolProvider.' +
                ' Please use that function instead of this one.');

        const urls: string[] = [];

        const element = this.convertToElement(html);
        const elements: AnchorOrMediaElement[] = Array.from(element.querySelectorAll('a, img, audio, video, source, track'));

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            let url = 'href' in element ? element.href : element.src;

            if (url && CoreUrlUtils.instance.isDownloadableUrl(url) && urls.indexOf(url) == -1) {
                urls.push(url);
            }

            // Treat video poster.
            if (element.tagName == 'VIDEO' && element.getAttribute('poster')) {
                url = element.getAttribute('poster') || '';
                if (url && CoreUrlUtils.instance.isDownloadableUrl(url) && urls.indexOf(url) == -1) {
                    urls.push(url);
                }
            }
        }

        return urls;
    }

    /**
     * Extract the downloadable URLs from an HTML code and returns them in fake file objects.
     *
     * @param html HTML code.
     * @return List of fake file objects with file URLs.
     * @deprecated since 3.8. Use CoreFilepoolProvider.extractDownloadableFilesFromHtmlAsFakeFileObjects instead.
     */
    extractDownloadableFilesFromHtmlAsFakeFileObjects(html: string): {fileurl: string}[] {
        const urls = this.extractDownloadableFilesFromHtml(html);

        // Convert them to fake file objects.
        return urls.map((url) => ({
            fileurl: url,
        }));
    }

    /**
     * Search all the URLs in a CSS file content.
     *
     * @param code CSS code.
     * @return List of URLs.
     */
    extractUrlsFromCSS(code: string): string[] {
        // First of all, search all the url(...) occurrences that don't include "data:".
        const urls: string[] = [];
        const matches = code.match(/url\(\s*["']?(?!data:)([^)]+)\)/igm);

        if (!matches) {
            return urls;
        }

        // Extract the URL form each match.
        matches.forEach((match) => {
            const submatches = match.match(/url\(\s*['"]?([^'"]*)['"]?\s*\)/im);
            if (submatches?.[1]) {
                urls.push(submatches[1]);
            }
        });

        return urls;
    }

    /**
     * Fix syntax errors in HTML.
     *
     * @param html HTML text.
     * @return Fixed HTML text.
     */
    fixHtml(html: string): string {
        this.template.innerHTML = html;

        // eslint-disable-next-line no-control-regex
        const attrNameRegExp = /[^\x00-\x20\x7F-\x9F"'>/=]+/;
        const fixElement = (element: Element): void => {
            // Remove attributes with an invalid name.
            Array.from(element.attributes).forEach((attr) => {
                if (!attrNameRegExp.test(attr.name)) {
                    element.removeAttributeNode(attr);
                }
            });

            Array.from(element.children).forEach(fixElement);
        };

        Array.from(this.template.content.children).forEach(fixElement);

        return this.template.innerHTML;
    }

    /**
     * Focus an element and open keyboard.
     *
     * @param el HTML element to focus.
     */
    focusElement(el: HTMLElement): void {
        if (el?.focus) {
            el.focus();
            if (CoreApp.instance.isAndroid() && this.supportsInputKeyboard(el)) {
                // On some Android versions the keyboard doesn't open automatically.
                CoreApp.instance.openKeyboard();
            }
        }
    }

    /**
     * Formats a size to be used as width/height of an element.
     * If the size is already valid (like '500px' or '50%') it won't be modified.
     * Returned size will have a format like '500px'.
     *
     * @param size Size to format.
     * @return Formatted size. If size is not valid, returns an empty string.
     */
    formatPixelsSize(size: string | number): string {
        if (typeof size == 'string' && (size.indexOf('px') > -1 || size.indexOf('%') > -1 || size == 'auto' || size == 'initial')) {
            // It seems to be a valid size.
            return size;
        }

        size = Number(size);
        if (!isNaN(size)) {
            return size + 'px';
        }

        return '';
    }

    /**
     * Returns the contents of a certain selection in a DOM element.
     *
     * @param element DOM element to search in.
     * @param selector Selector to search.
     * @return Selection contents. Undefined if not found.
     */
    getContentsOfElement(element: HTMLElement, selector: string): string | undefined {
        if (element) {
            const selected = element.querySelector(selector);
            if (selected) {
                return selected.innerHTML;
            }
        }
    }

    /**
     * Get the data from a form. It will only collect elements that have a name.
     *
     * @param form The form to get the data from.
     * @return Object with the data. The keys are the names of the inputs.
     */
    getDataFromForm(form: HTMLFormElement): Record<string, unknown> {
        if (!form || !form.elements) {
            return {};
        }

        const data = {};

        for (let i = 0; i < form.elements.length; i++) {
            const element = <HTMLInputElement> form.elements[i];
            const name = element.name || '';

            // Ignore submit inputs.
            if (!name || element.type == 'submit' || element.tagName == 'BUTTON') {
                continue;
            }

            // Get the value.
            if (element.type == 'checkbox') {
                data[name] = !!element.checked;
            } else if (element.type == 'radio') {
                if (element.checked) {
                    data[name] = element.value;
                }
            } else {
                data[name] = element.value;
            }
        }

        return data;
    }

    /**
     * Returns the attribute value of a string element. Only the first element will be selected.
     *
     * @param html HTML element in string.
     * @param attribute Attribute to get.
     * @return Attribute value.
     */
    getHTMLElementAttribute(html: string, attribute: string): string | null {
        return this.convertToElement(html).children[0].getAttribute(attribute);
    }

    /**
     * Returns height of an element.
     *
     * @param element DOM element to measure.
     * @param usePadding Whether to use padding to calculate the measure.
     * @param useMargin Whether to use margin to calculate the measure.
     * @param useBorder Whether to use borders to calculate the measure.
     * @param innerMeasure If inner measure is needed: padding, margin or borders will be substracted.
     * @return Height in pixels.
     */
    getElementHeight(
        element: HTMLElement,
        usePadding?: boolean,
        useMargin?: boolean,
        useBorder?: boolean,
        innerMeasure?: boolean,
    ): number {
        return this.getElementMeasure(element, false, usePadding, useMargin, useBorder, innerMeasure);
    }

    /**
     * Returns height or width of an element.
     *
     * @param element DOM element to measure.
     * @param getWidth Whether to get width or height.
     * @param usePadding Whether to use padding to calculate the measure.
     * @param useMargin Whether to use margin to calculate the measure.
     * @param useBorder Whether to use borders to calculate the measure.
     * @param innerMeasure If inner measure is needed: padding, margin or borders will be substracted.
     * @return Measure in pixels.
     */
    getElementMeasure(
        element: HTMLElement,
        getWidth?: boolean,
        usePadding?: boolean,
        useMargin?: boolean,
        useBorder?: boolean,
        innerMeasure?: boolean,
    ): number {
        const offsetMeasure = getWidth ? 'offsetWidth' : 'offsetHeight';
        const measureName = getWidth ? 'width' : 'height';
        const clientMeasure = getWidth ? 'clientWidth' : 'clientHeight';
        const priorSide = getWidth ? 'Left' : 'Top';
        const afterSide = getWidth ? 'Right' : 'Bottom';
        let measure = element[offsetMeasure] || element[measureName] || element[clientMeasure] || 0;

        // Measure not correctly taken.
        if (measure <= 0) {
            const style = getComputedStyle(element);
            if (style?.display == '') {
                element.style.display = 'inline-block';
                measure = element[offsetMeasure] || element[measureName] || element[clientMeasure] || 0;
                element.style.display = '';
            }
        }

        if (usePadding || useMargin || useBorder) {
            const computedStyle = getComputedStyle(element);
            let surround = 0;

            if (usePadding) {
                surround += this.getComputedStyleMeasure(computedStyle, 'padding' + priorSide) +
                    this.getComputedStyleMeasure(computedStyle, 'padding' + afterSide);
            }
            if (useMargin) {
                surround += this.getComputedStyleMeasure(computedStyle, 'margin' + priorSide) +
                    this.getComputedStyleMeasure(computedStyle, 'margin' + afterSide);
            }
            if (useBorder) {
                surround += this.getComputedStyleMeasure(computedStyle, 'border' + priorSide + 'Width') +
                    this.getComputedStyleMeasure(computedStyle, 'border' + afterSide + 'Width');
            }
            if (innerMeasure) {
                measure = measure > surround ? measure - surround : 0;
            } else {
                measure += surround;
            }
        }

        return measure;
    }

    /**
     * Returns the computed style measure or 0 if not found or NaN.
     *
     * @param style Style from getComputedStyle.
     * @param measure Measure to get.
     * @return Result of the measure.
     */
    getComputedStyleMeasure(style: CSSStyleDeclaration, measure: string): number {
        return parseInt(style[measure], 10) || 0;
    }

    /**
     * Returns width of an element.
     *
     * @param element DOM element to measure.
     * @param usePadding Whether to use padding to calculate the measure.
     * @param useMargin Whether to use margin to calculate the measure.
     * @param useBorder Whether to use borders to calculate the measure.
     * @param innerMeasure If inner measure is needed: padding, margin or borders will be substracted.
     * @return Width in pixels.
     */
    getElementWidth(
        element: HTMLElement,
        usePadding?: boolean,
        useMargin?: boolean,
        useBorder?: boolean,
        innerMeasure?: boolean,
    ): number {
        return this.getElementMeasure(element, true, usePadding, useMargin, useBorder, innerMeasure);
    }

    /**
     * Retrieve the position of a element relative to another element.
     *
     * @param container Element to search in.
     * @param selector Selector to find the element to gets the position.
     * @param positionParentClass Parent Class where to stop calculating the position. Default inner-scroll.
     * @return positionLeft, positionTop of the element relative to.
     */
    getElementXY(container: HTMLElement, selector?: string, positionParentClass?: string): number[] | null {
        let element: HTMLElement | null = <HTMLElement> (selector ? container.querySelector(selector) : container);
        let positionTop = 0;
        let positionLeft = 0;

        if (!positionParentClass) {
            positionParentClass = 'inner-scroll';
        }

        if (!element) {
            return null;
        }

        while (element) {
            positionLeft += (element.offsetLeft - element.scrollLeft + element.clientLeft);
            positionTop += (element.offsetTop - element.scrollTop + element.clientTop);

            const offsetElement = element.offsetParent;
            element = element.parentElement;

            // Every parent class has to be checked but the position has to be got form offsetParent.
            while (offsetElement != element && element) {
                // If positionParentClass element is reached, stop adding tops.
                if (element.className.indexOf(positionParentClass) != -1) {
                    element = null;
                } else {
                    element = element.parentElement;
                }
            }

            // Finally, check again.
            if (element?.className.indexOf(positionParentClass) != -1) {
                element = null;
            }
        }

        return [positionLeft, positionTop];
    }

    /**
     * Given a message, it deduce if it's a network error.
     *
     * @param message Message text.
     * @return True if the message error is a network error, false otherwise.
     */
    protected isNetworkError(message: string): boolean {
        return message == Translate.instance.instant('core.networkerrormsg') ||
            message == Translate.instance.instant('core.fileuploader.errormustbeonlinetoupload');
    }

    /**
     * Get the error message from an error, including debug data if needed.
     *
     * @param error Message to show.
     * @param needsTranslate Whether the error needs to be translated.
     * @return Error message, null if no error should be displayed.
     */
    getErrorMessage(error: CoreError | CoreTextErrorObject | string, needsTranslate?: boolean): string | null {
        let extraInfo = '';
        let errorMessage: string | undefined;

        if (typeof error == 'object') {
            if (this.debugDisplay) {
                // Get the debug info. Escape the HTML so it is displayed as it is in the view.
                if ('debuginfo' in error && error.debuginfo) {
                    extraInfo = '<br><br>' + CoreTextUtils.instance.escapeHTML(error.debuginfo, false);
                }
                if ('backtrace' in error && error.backtrace) {
                    extraInfo += '<br><br>' + CoreTextUtils.instance.replaceNewLines(
                        CoreTextUtils.instance.escapeHTML(error.backtrace, false),
                        '<br>',
                    );
                }

                // eslint-disable-next-line no-console
                console.error(error);
            }

            if (this.isSilentError(error)) {
                // It's a silent error, don't display an error.
                return null;
            }

            // We received an object instead of a string. Search for common properties.
            errorMessage = CoreTextUtils.instance.getErrorMessageFromError(error);
            if (!errorMessage) {
                // No common properties found, just stringify it.
                errorMessage = JSON.stringify(error);
                extraInfo = ''; // No need to add extra info because it's already in the error.
            }

            // Try to remove tokens from the contents.
            const matches = errorMessage.match(/token"?[=|:]"?(\w*)/);
            if (matches?.[1]) {
                errorMessage = errorMessage.replace(new RegExp(matches[1], 'g'), 'secret');
            }
        } else {
            errorMessage = error;
        }

        if (errorMessage == CoreConstants.DONT_SHOW_ERROR) {
            // The error shouldn't be shown, stop.
            return null;
        }

        let message = CoreTextUtils.instance.decodeHTML(needsTranslate ? Translate.instance.instant(errorMessage) : errorMessage);

        if (extraInfo) {
            message += extraInfo;
        }

        return message;
    }

    /**
     * Retrieve component/directive instance.
     * Please use this function only if you cannot retrieve the instance using parent/child methods: ViewChild (or similar)
     * or Angular's injection.
     *
     * @param element The root element of the component/directive.
     * @return The instance, undefined if not found.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getInstanceByElement(element: Element): any {
        const id = element.getAttribute(this.INSTANCE_ID_ATTR_NAME);

        return id && this.instances[id];
    }

    /**
     * Check whether an error is an error caused because the user canceled a showConfirm.
     *
     * @param error Error to check.
     * @return Whether it's a canceled error.
     */
    isCanceledError(error: CoreError | CoreTextErrorObject | string): boolean {
        return error instanceof CoreCanceledError;
    }

    /**
     * Check whether an error is an error caused because the user canceled a showConfirm.
     *
     * @param error Error to check.
     * @return Whether it's a canceled error.
     */
    isSilentError(error: CoreError | CoreTextErrorObject | string): boolean {
        return error instanceof CoreSilentError;
    }

    /**
     * Wait an element to exists using the findFunction.
     *
     * @param findFunction The function used to find the element.
     * @return Resolved if found, rejected if too many tries.
     */
    waitElementToExist(findFunction: () => HTMLElement | null): Promise<HTMLElement> {
        const promiseInterval = CoreUtils.instance.promiseDefer<HTMLElement>();
        let tries = 100;

        const clear = setInterval(() => {
            const element: HTMLElement | null = findFunction();

            if (element) {
                clearInterval(clear);
                promiseInterval.resolve(element);
            } else {
                tries--;

                if (tries <= 0) {
                    clearInterval(clear);
                    promiseInterval.reject();
                }
            }
        }, 100);

        return promiseInterval.promise;
    }

    /**
     * Handle bootstrap tooltips in a certain element.
     *
     * @param element Element to check.
     */
    handleBootstrapTooltips(element: HTMLElement): void {
        const els = Array.from(element.querySelectorAll('[data-toggle="tooltip"]'));

        els.forEach((el) => {
            const content = el.getAttribute('title') || el.getAttribute('data-original-title');
            const trigger = el.getAttribute('data-trigger') || 'hover focus';
            const treated = el.getAttribute('data-bstooltip-treated');

            if (!content || treated === 'true' ||
                    (trigger.indexOf('hover') == -1 && trigger.indexOf('focus') == -1 && trigger.indexOf('click') == -1)) {
                return;
            }

            el.setAttribute('data-bstooltip-treated', 'true'); // Mark it as treated.

            // Store the title in data-original-title instead of title, like BS does.
            el.setAttribute('data-original-title', content);
            el.setAttribute('title', '');

            el.addEventListener('click', () => {
                // @todo
            });
        });
    }

    /**
     * Check if an element is outside of screen (viewport).
     *
     * @param scrollEl The element that must be scrolled.
     * @param element DOM element to check.
     * @return Whether the element is outside of the viewport.
     */
    isElementOutsideOfScreen(scrollEl: HTMLElement, element: HTMLElement): boolean {
        const elementRect = element.getBoundingClientRect();

        if (!elementRect) {
            return false;
        }

        const elementMidPoint = Math.round((elementRect.bottom + elementRect.top) / 2);

        const scrollElRect = scrollEl.getBoundingClientRect();
        const scrollTopPos = scrollElRect?.top || 0;

        return elementMidPoint > window.innerHeight || elementMidPoint < scrollTopPos;
    }

    /**
     * Check if rich text editor is enabled.
     *
     * @return Promise resolved with boolean: true if enabled, false otherwise.
     */
    isRichTextEditorEnabled(): Promise<boolean> {
        return CoreConfig.instance.get(CoreConstants.SETTINGS_RICH_TEXT_EDITOR, true).then((enabled) => !!enabled);
    }

    /**
     * Check if rich text editor is supported in the platform.
     *
     * @return Whether it's supported.
     * @deprecated since 3.9.5
     */
    isRichTextEditorSupported(): boolean {
        return true;
    }

    /**
     * Move children from one HTMLElement to another.
     *
     * @param oldParent The old parent.
     * @param newParent The new parent.
     * @param prepend If true, adds the children to the beginning of the new parent.
     * @return List of moved children.
     */
    moveChildren(oldParent: HTMLElement, newParent: HTMLElement, prepend?: boolean): Node[] {
        const movedChildren: Node[] = [];
        const referenceNode = prepend ? newParent.firstChild : null;

        while (oldParent.childNodes.length > 0) {
            const child = oldParent.childNodes[0];
            movedChildren.push(child);

            newParent.insertBefore(child, referenceNode);
        }

        return movedChildren;
    }

    /**
     * Search and remove a certain element from inside another element.
     *
     * @param element DOM element to search in.
     * @param selector Selector to search.
     */
    removeElement(element: HTMLElement, selector: string): void {
        if (element) {
            const selected = element.querySelector(selector);
            if (selected) {
                selected.remove();
            }
        }
    }

    /**
     * Search and remove a certain element from an HTML code.
     *
     * @param html HTML code to change.
     * @param selector Selector to search.
     * @param removeAll True if it should remove all matches found, false if it should only remove the first one.
     * @return HTML without the element.
     */
    removeElementFromHtml(html: string, selector: string, removeAll?: boolean): string {
        const element = this.convertToElement(html);

        if (removeAll) {
            const selected = element.querySelectorAll(selector);
            for (let i = 0; i < selected.length; i++) {
                selected[i].remove();
            }
        } else {
            const selected = element.querySelector(selector);
            if (selected) {
                selected.remove();
            }
        }

        return element.innerHTML;
    }

    /**
     * Remove a component/directive instance using the DOM Element.
     *
     * @param element The root element of the component/directive.
     */
    removeInstanceByElement(element: Element): void {
        const id = element.getAttribute(this.INSTANCE_ID_ATTR_NAME);
        id && delete this.instances[id];
    }

    /**
     * Remove a component/directive instance using the ID.
     *
     * @param id The ID to remove.
     */
    removeInstanceById(id: string): void {
        delete this.instances[id];
    }

    /**
     * Search for certain classes in an element contents and replace them with the specified new values.
     *
     * @param element DOM element.
     * @param map Mapping of the classes to replace. Keys must be the value to replace, values must be
     *            the new class name. Example: {'correct': 'core-question-answer-correct'}.
     */
    replaceClassesInElement(element: HTMLElement, map: {[currentValue: string]: string}): void {
        for (const key in map) {
            const foundElements = element.querySelectorAll('.' + key);

            for (let i = 0; i < foundElements.length; i++) {
                const foundElement = foundElements[i];
                foundElement.className = foundElement.className.replace(key, map[key]);
            }
        }
    }

    /**
     * Given an HTML, search all links and media and tries to restore original sources using the paths object.
     *
     * @param html HTML code.
     * @param paths Object linking URLs in the html code with the real URLs to use.
     * @param anchorFn Function to call with each anchor. Optional.
     * @return Treated HTML code.
     */
    restoreSourcesInHtml(
        html: string,
        paths: {[url: string]: string},
        anchorFn?: (anchor: HTMLElement, href: string) => void,
    ): string {
        const element = this.convertToElement(html);

        // Treat elements with src (img, audio, video, ...).
        const media = Array.from(element.querySelectorAll('img, video, audio, source, track'));
        media.forEach((media: HTMLElement) => {
            const currentSrc = media.getAttribute('src');
            const newSrc = currentSrc ? paths[CoreTextUtils.instance.decodeURIComponent(currentSrc)] : undefined;

            if (typeof newSrc != 'undefined') {
                media.setAttribute('src', newSrc);
            }

            // Treat video posters.
            if (media.tagName == 'VIDEO' && media.getAttribute('poster')) {
                const currentPoster = media.getAttribute('poster');
                const newPoster = paths[CoreTextUtils.instance.decodeURIComponent(currentPoster!)];
                if (typeof newPoster !== 'undefined') {
                    media.setAttribute('poster', newPoster);
                }
            }
        });

        // Now treat links.
        const anchors = Array.from(element.querySelectorAll('a'));
        anchors.forEach((anchor: HTMLElement) => {
            const currentHref = anchor.getAttribute('href');
            const newHref = currentHref ? paths[CoreTextUtils.instance.decodeURIComponent(currentHref)] : undefined;

            if (typeof newHref != 'undefined') {
                anchor.setAttribute('href', newHref);

                if (typeof anchorFn == 'function') {
                    anchorFn(anchor, newHref);
                }
            }
        });

        return element.innerHTML;
    }

    /**
     * Scroll to somehere in the content.
     *
     * @param content Content to scroll.
     * @param x The x-value to scroll to.
     * @param y The y-value to scroll to.
     * @param duration Duration of the scroll animation in milliseconds.
     * @return Returns a promise which is resolved when the scroll has completed.
     * @deprecated since 3.9.5. Use directly the IonContent class.
     */
    scrollTo(content: IonContent, x: number, y: number, duration?: number): Promise<void> {
        return content?.scrollToPoint(x, y, duration || 0);
    }

    /**
     * Scroll to Bottom of the content.
     *
     * @param content Content to scroll.
     * @param duration Duration of the scroll animation in milliseconds.
     * @return Returns a promise which is resolved when the scroll has completed.
     * @deprecated since 3.9.5. Use directly the IonContent class.
     */
    scrollToBottom(content: IonContent, duration?: number): Promise<void> {
        return content?.scrollToBottom(duration);
    }

    /**
     * Scroll to Top of the content.
     *
     * @param content Content to scroll.
     * @param duration Duration of the scroll animation in milliseconds.
     * @return Returns a promise which is resolved when the scroll has completed.
     * @deprecated since 3.9.5. Use directly the IonContent class.
     */
    scrollToTop(content: IonContent, duration?: number): Promise<void> {
        return content?.scrollToTop(duration);
    }

    /**
     * Returns height of the content.
     *
     * @param content Content where to execute the function.
     * @return Promise resolved with content height.
     */
    async getContentHeight(content: IonContent): Promise<number> {
        try {
            const scrollElement = await content?.getScrollElement();

            return scrollElement?.clientHeight || 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Returns scroll height of the content.
     *
     * @param content Content where to execute the function.
     * @return Promise resolved with scroll height.
     */
    async getScrollHeight(content: IonContent): Promise<number> {
        try {
            const scrollElement = await content?.getScrollElement();

            return scrollElement?.scrollHeight || 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Returns scrollTop of the content.
     *
     * @param content Content where to execute the function.
     * @return Promise resolved with scroll top.
     */
    async getScrollTop(content: IonContent): Promise<number> {
        try {
            const scrollElement = await content?.getScrollElement();

            return scrollElement?.scrollTop || 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Scroll to a certain element.
     *
     * @param content The content that must be scrolled.
     * @param element The element to scroll to.
     * @param scrollParentClass Parent class where to stop calculating the position. Default inner-scroll.
     * @param duration Duration of the scroll animation in milliseconds.
     * @return True if the element is found, false otherwise.
     */
    scrollToElement(content: IonContent, element: HTMLElement, scrollParentClass?: string, duration?: number): boolean {
        const position = this.getElementXY(element, undefined, scrollParentClass);
        if (!position) {
            return false;
        }

        content?.scrollToPoint(position[0], position[1], duration || 0);

        return true;
    }

    /**
     * Scroll to a certain element using a selector to find it.
     *
     * @param content The content that must be scrolled.
     * @param selector Selector to find the element to scroll to.
     * @param scrollParentClass Parent class where to stop calculating the position. Default inner-scroll.
     * @param duration Duration of the scroll animation in milliseconds.
     * @return True if the element is found, false otherwise.
     */
    async scrollToElementBySelector(
        content: IonContent,
        selector: string,
        scrollParentClass?: string,
        duration?: number,
    ): Promise<boolean> {
        // @todo: This function is broken. Scroll element cannot be used because it uses shadow DOM so querySelector returns null.
        // Also, traversing using parentElement doesn't work either, offsetParent isn't part of the parentElement tree.
        try {
            const scrollElement = await content.getScrollElement();

            const position = this.getElementXY(scrollElement, selector, scrollParentClass);
            if (!position) {
                return false;
            }

            content?.scrollToPoint(position[0], position[1], duration || 0);

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Search for an input with error (core-input-error directive) and scrolls to it if found.
     *
     * @param content The content that must be scrolled.
     * @param scrollParentClass Parent class where to stop calculating the position. Default inner-scroll.
     * @return True if the element is found, false otherwise.
     */
    async scrollToInputError(content?: IonContent, scrollParentClass?: string): Promise<boolean> {
        if (!content) {
            return false;
        }

        return this.scrollToElementBySelector(content, '.core-input-error', scrollParentClass);
    }

    /**
     * Set whether debug messages should be displayed.
     *
     * @param value Whether to display or not.
     */
    setDebugDisplay(value: boolean): void {
        this.debugDisplay = value;
    }

    /**
     * Show an alert modal with a button to close it.
     *
     * @param title Title to show.
     * @param message Message to show.
     * @param buttonText Text of the button.
     * @param autocloseTime Number of milliseconds to wait to close the modal. If not defined, modal won't be closed.
     * @return Promise resolved with the alert modal.
     */
    async showAlert(
        header: string,
        message: string,
        buttonText?: string,
        autocloseTime?: number,
    ): Promise<HTMLIonAlertElement> {
        return this.showAlertWithOptions({
            header,
            message,
            buttons: [buttonText || Translate.instance.instant('core.ok')],
        }, autocloseTime);
    }

    /**
     * General show an alert modal.
     *
     * @param options Alert options to pass to the alert.
     * @param autocloseTime Number of milliseconds to wait to close the modal. If not defined, modal won't be closed.
     * @return Promise resolved with the alert modal.
     */
    async showAlertWithOptions(options: AlertOptions = {}, autocloseTime?: number): Promise<HTMLIonAlertElement> {
        const hasHTMLTags = CoreTextUtils.instance.hasHTMLTags(<string> options.message || '');

        if (hasHTMLTags) {
            // Format the text.
            options.message = await CoreTextUtils.instance.formatText(<string> options.message);
        }

        const alertId = <string> Md5.hashAsciiStr((options.header || '') + '#' + (options.message || ''));

        if (this.displayedAlerts[alertId]) {
            // There's already an alert with the same message and title. Return it.
            return this.displayedAlerts[alertId];
        }

        const alert = await AlertController.instance.create(options);

        // eslint-disable-next-line promise/catch-or-return
        alert.present().then(() => {
            if (hasHTMLTags) {
                // Treat all anchors so they don't override the app.
                const alertMessageEl: HTMLElement | null = alert.querySelector('.alert-message');
                alertMessageEl && this.treatAnchors(alertMessageEl);
            }

            return;
        });

        // Store the alert and remove it when dismissed.
        this.displayedAlerts[alertId] = alert;

        // Set the callbacks to trigger an observable event.
        // eslint-disable-next-line promise/catch-or-return, promise/always-return
        alert.onDidDismiss().then(() => {
            delete this.displayedAlerts[alertId];
        });

        if (autocloseTime && autocloseTime > 0) {
            setTimeout(async () => {
                await alert.dismiss();

                if (options.buttons) {
                    // Execute dismiss function if any.
                    const cancelButton = <AlertButton> options.buttons.find(
                        (button) => typeof button != 'string' && typeof button.handler != 'undefined' && button.role == 'cancel',
                    );
                    cancelButton.handler?.(null);
                }
            }, autocloseTime);
        }

        return alert;
    }

    /**
     * Show an alert modal with a button to close it, translating the values supplied.
     *
     * @param title Title to show.
     * @param message Message to show.
     * @param buttonText Text of the button.
     * @param autocloseTime Number of milliseconds to wait to close the modal. If not defined, modal won't be closed.
     * @return Promise resolved with the alert modal.
     */
    showAlertTranslated(title: string, message: string, buttonText?: string, autocloseTime?: number): Promise<HTMLIonAlertElement> {
        title = title ? Translate.instance.instant(title) : title;
        message = message ? Translate.instance.instant(message) : message;
        buttonText = buttonText ? Translate.instance.instant(buttonText) : buttonText;

        return this.showAlert(title, message, buttonText, autocloseTime);
    }

    /**
     * Shortcut for a delete confirmation modal.
     *
     * @param translateMessage String key to show in the modal body translated. Default: 'core.areyousure'.
     * @param translateArgs Arguments to pass to translate if necessary.
     * @param options More options. See https://ionicframework.com/docs/v3/api/components/alert/AlertController/
     * @return Promise resolved if the user confirms and rejected with a canceled error if he cancels.
     */
    showDeleteConfirm(
        translateMessage: string = 'core.areyousure',
        translateArgs: Record<string, string> = {},
        options?: AlertOptions,
    ): Promise<void> {
        return this.showConfirm(
            Translate.instance.instant(translateMessage, translateArgs),
            undefined,
            Translate.instance.instant('core.delete'),
            undefined,
            options,
        );
    }

    /**
     * Show a confirm modal.
     *
     * @param message Message to show in the modal body.
     * @param header Header of the modal.
     * @param okText Text of the OK button.
     * @param cancelText Text of the Cancel button.
     * @param options More options.
     * @return Promise resolved if the user confirms and rejected with a canceled error if he cancels.
     */
    showConfirm(message: string, header?: string, okText?: string, cancelText?: string, options: AlertOptions = {}): Promise<void> {
        return new Promise<void>((resolve, reject): void => {
            options.header = header;
            options.message = message;

            options.buttons = [
                {
                    text: cancelText || Translate.instance.instant('core.cancel'),
                    role: 'cancel',
                    handler: () => {
                        reject(new CoreCanceledError(''));
                    },
                },
                {
                    text: okText || Translate.instance.instant('core.ok'),
                    handler: () => {
                        resolve();
                    },
                },
            ];

            if (!header) {
                options.cssClass = (options.cssClass || '') + ' core-nohead';
            }

            this.showAlertWithOptions(options, 0);
        });
    }

    /**
     * Show an alert modal with an error message.
     *
     * @param error Message to show.
     * @param needsTranslate Whether the error needs to be translated.
     * @param autocloseTime Number of milliseconds to wait to close the modal. If not defined, modal won't be closed.
     * @return Promise resolved with the alert modal.
     */
    showErrorModal(
        error: CoreError | CoreTextErrorObject | string,
        needsTranslate?: boolean,
        autocloseTime?: number,
    ): Promise<HTMLIonAlertElement | null> {
        if (this.isCanceledError(error)) {
            // It's a canceled error, don't display an error.
            return Promise.resolve(null);
        }

        const message = this.getErrorMessage(error, needsTranslate);

        if (message === null) {
            // Message doesn't need to be displayed, stop.
            return Promise.resolve(null);
        }

        const alertOptions: AlertOptions = {
            message: message,
            buttons: [Translate.instance.instant('core.ok')],
        };

        if (this.isNetworkError(message)) {
            alertOptions.cssClass = 'core-alert-network-error';
        } else {
            alertOptions.header = Translate.instance.instant('core.error');
        }

        return this.showAlertWithOptions(alertOptions, autocloseTime);
    }

    /**
     * Show an alert modal with an error message. It uses a default message if error is not a string.
     *
     * @param error Message to show.
     * @param defaultError Message to show if the error is not a string.
     * @param needsTranslate Whether the error needs to be translated.
     * @param autocloseTime Number of milliseconds to wait to close the modal. If not defined, modal won't be closed.
     * @return Promise resolved with the alert modal.
     */
    async showErrorModalDefault(
        error: CoreError | CoreTextErrorObject | string,
        defaultError: string,
        needsTranslate?: boolean,
        autocloseTime?: number,
    ): Promise<HTMLIonAlertElement | null> {
        if (this.isCanceledError(error)) {
            // It's a canceled error, don't display an error.
            return null;
        }

        let errorMessage = error || undefined;

        if (error && typeof error != 'string') {
            errorMessage = CoreTextUtils.instance.getErrorMessageFromError(error);
        }

        return this.showErrorModal(typeof errorMessage == 'string' ? error : defaultError, needsTranslate, autocloseTime);
    }

    /**
     * Show an alert modal with the first warning error message. It uses a default message if error is not a string.
     *
     * @param warnings Warnings returned.
     * @param defaultError Message to show if the error is not a string.
     * @param needsTranslate Whether the error needs to be translated.
     * @param autocloseTime Number of milliseconds to wait to close the modal. If not defined, modal won't be closed.
     * @return Promise resolved with the alert modal.
     */
    showErrorModalFirstWarning(
        warnings: CoreWSExternalWarning[],
        defaultError: string,
        needsTranslate?: boolean,
        autocloseTime?: number,
    ): Promise<HTMLIonAlertElement | null> {
        return this.showErrorModalDefault(warnings?.[0], defaultError, needsTranslate, autocloseTime);
    }

    /**
     * Displays a loading modal window.
     *
     * @param text The text of the modal window. Default: core.loading.
     * @param needsTranslate Whether the 'text' needs to be translated.
     * @return Loading element instance.
     * @description
     * Usage:
     *     let modal = await domUtils.showModalLoading(myText);
     *     ...
     *     modal.dismiss();
     */
    async showModalLoading(text?: string, needsTranslate?: boolean): Promise<CoreIonLoadingElement> {
        if (!text) {
            text = Translate.instance.instant('core.loading');
        } else if (needsTranslate) {
            text = Translate.instance.instant(text);
        }

        const loadingElement = await LoadingController.instance.create({
            message: text,
        });

        const loading = new CoreIonLoadingElement(loadingElement);

        loading.present();

        return loading;
    }

    /**
     * Show a modal warning the user that he should use a different app.
     *
     * @param message The warning message.
     * @param link Link to the app to download if any.
     * @return Promise resolved when done.
     */
    async showDownloadAppNoticeModal(message: string, link?: string): Promise<void> {
        const buttons: AlertButton[] = [{
            text: Translate.instance.instant('core.ok'),
            role: 'cancel',
        }];

        if (link) {
            buttons.push({
                text: Translate.instance.instant('core.download'),
                handler: (): void => {
                    CoreUtils.instance.openInBrowser(link);
                },
            });
        }

        const alert = await AlertController.instance.create({
            message: message,
            buttons: buttons,
        });

        await alert.present();

        const isDevice = CoreApp.instance.isAndroid() || CoreApp.instance.isIOS();
        if (!isDevice) {
            // Treat all anchors so they don't override the app.
            const alertMessageEl: HTMLElement | null = alert.querySelector('.alert-message');
            alertMessageEl && this.treatAnchors(alertMessageEl);
        }
    }

    /**
     * Show a prompt modal to input some data.
     *
     * @param message Modal message.
     * @param header Modal header.
     * @param placeholder Placeholder of the input element. By default, "Password".
     * @param type Type of the input element. By default, password.
     * @param options More options to pass to the alert.
     * @return Promise resolved with the input data if the user clicks OK, rejected if cancels.
     */
    showPrompt(
        message: string,
        header?: string,
        placeholder?: string,
        type: TextFieldTypes | 'checkbox' | 'radio' | 'textarea' = 'password',
    ): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
        return new Promise((resolve, reject) => {
            placeholder = placeholder ?? Translate.instance.instant('core.login.password');

            const options: AlertOptions = {
                header,
                message,
                inputs: [
                    {
                        name: 'promptinput',
                        placeholder: placeholder,
                        type,
                    },
                ],
                buttons: [
                    {
                        text: Translate.instance.instant('core.cancel'),
                        role: 'cancel',
                        handler: () => {
                            reject();
                        },
                    },
                    {
                        text: Translate.instance.instant('core.ok'),
                        handler: (data) => {
                            resolve(data.promptinput);
                        },
                    },
                ],
            };

            this.showAlertWithOptions(options);
        });
    }

    /**
     * Show a prompt modal to input a textarea.
     *
     * @param title Modal title.
     * @param message Modal message.
     * @param buttons Buttons to pass to the modal.
     * @param placeholder Placeholder of the input element if any.
     * @return Promise resolved when modal presented.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    showTextareaPrompt(title: string, message: string, buttons: (string | any)[], placeholder?: string): Promise<any> {
        // @todo
        return Promise.resolve();
    }

    /**
     * Displays an autodimissable toast modal window.
     *
     * @param text The text of the toast.
     * @param needsTranslate Whether the 'text' needs to be translated.
     * @param duration Duration in ms of the dimissable toast.
     * @param cssClass Class to add to the toast.
     * @param dismissOnPageChange Dismiss the Toast on page change.
     * @return Toast instance.
     */
    async showToast(
        text: string,
        needsTranslate?: boolean,
        duration: number = 2000,
        cssClass: string = '',
    ): Promise<HTMLIonToastElement> {
        if (needsTranslate) {
            text = Translate.instance.instant(text);
        }

        const loader = await ToastController.instance.create({
            message: text,
            duration: duration,
            position: 'bottom',
            cssClass: cssClass,
        });

        loader.present();

        return loader;
    }

    /**
     * Stores a component/directive instance.
     *
     * @param element The root element of the component/directive.
     * @param instance The instance to store.
     * @return ID to identify the instance.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storeInstanceByElement(element: Element, instance: any): string {
        const id = String(this.lastInstanceId++);

        element.setAttribute(this.INSTANCE_ID_ATTR_NAME, id);
        this.instances[id] = instance;

        return id;
    }

    /**
     * Check if an element supports input via keyboard.
     *
     * @param el HTML element to check.
     * @return Whether it supports input using keyboard.
     */
    supportsInputKeyboard(el: HTMLElement): boolean {
        return el &&
            !(<HTMLInputElement> el).disabled &&
            (el.tagName.toLowerCase() == 'textarea' ||
                (el.tagName.toLowerCase() == 'input' && this.INPUT_SUPPORT_KEYBOARD.indexOf((<HTMLInputElement> el).type) != -1));
    }

    /**
     * Converts HTML formatted text to DOM element(s).
     *
     * @param text HTML text.
     * @return Same text converted to HTMLCollection.
     */
    toDom(text: string): HTMLCollection {
        const element = this.convertToElement(text);

        return element.children;
    }

    /**
     * Treat anchors inside alert/modals.
     *
     * @param container The HTMLElement that can contain anchors.
     */
    treatAnchors(container: HTMLElement): void {
        const anchors = Array.from(container.querySelectorAll('a'));

        anchors.forEach((anchor) => {
            anchor.addEventListener('click', (event) => {
                if (event.defaultPrevented) {
                    // Stop.
                    return;
                }

                const href = anchor.getAttribute('href');
                if (href) {
                    event.preventDefault();
                    event.stopPropagation();

                    CoreUtils.instance.openInBrowser(href);
                }
            });
        });
    }

    /**
     * View an image in a modal.
     *
     * @param image URL of the image.
     * @param title Title of the page or modal.
     * @param component Component to link the image to if needed.
     * @param componentId An ID to use in conjunction with the component.
     * @param fullScreen Whether the modal should be full screen.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    viewImage(image: string, title?: string | null, component?: string, componentId?: string | number, fullScreen?: boolean): void {
        // @todo
    }

    /**
     * Wait for images to load.
     *
     * @param element The element to search in.
     * @return Promise resolved with a boolean: whether there was any image to load.
     */
    waitForImages(element: HTMLElement): Promise<boolean> {
        const imgs = Array.from(element.querySelectorAll('img'));
        const promises: Promise<void>[] = [];
        let hasImgToLoad = false;

        imgs.forEach((img) => {
            if (img && !img.complete) {
                hasImgToLoad = true;

                // Wait for image to load or fail.
                promises.push(new Promise((resolve) => {
                    const imgLoaded = (): void => {
                        resolve();
                        img.removeEventListener('load', imgLoaded);
                        img.removeEventListener('error', imgLoaded);
                    };

                    img.addEventListener('load', imgLoaded);
                    img.addEventListener('error', imgLoaded);
                }));
            }
        });

        return Promise.all(promises).then(() => hasImgToLoad);
    }

    /**
     * Wrap an HTMLElement with another element.
     *
     * @param el The element to wrap.
     * @param wrapper Wrapper.
     */
    wrapElement(el: HTMLElement, wrapper: HTMLElement): void {
        // Insert the wrapper before the element.
        el.parentNode?.insertBefore(wrapper, el);
        // Now move the element into the wrapper.
        wrapper.appendChild(el);
    }

    /**
     * Trigger form cancelled event.
     *
     * @param form Form element.
     * @param siteId The site affected. If not provided, no site affected.
     */
    triggerFormCancelledEvent(formRef: ElementRef, siteId?: string): void {
        if (!formRef) {
            return;
        }

        CoreEvents.trigger(CoreEvents.FORM_ACTION, {
            action: 'cancel',
            form: formRef.nativeElement,
        }, siteId);
    }

    /**
     * Trigger form submitted event.
     *
     * @param form Form element.
     * @param online Whether the action was done in offline or not.
     * @param siteId The site affected. If not provided, no site affected.
     */
    triggerFormSubmittedEvent(formRef: ElementRef | HTMLFormElement | undefined, online?: boolean, siteId?: string): void {
        if (!formRef) {
            return;
        }

        CoreEvents.trigger(CoreEvents.FORM_ACTION, {
            action: 'submit',
            form: formRef.nativeElement || formRef,
            online: !!online,
        }, siteId);
    }

}

export class CoreDomUtils extends makeSingleton(CoreDomUtilsProvider) {}

type AnchorOrMediaElement =
    HTMLAnchorElement | HTMLImageElement | HTMLAudioElement | HTMLVideoElement | HTMLSourceElement | HTMLTrackElement;
