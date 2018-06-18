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

import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterContentInit, OnDestroy, Optional }
    from '@angular/core';
import { TextInput, Content } from 'ionic-angular';
import { CoreSitesProvider } from '@providers/sites';
import { CoreFilepoolProvider } from '@providers/filepool';
import { CoreDomUtilsProvider } from '@providers/utils/dom';
import { CoreUrlUtilsProvider } from '@providers/utils/url';
import { FormControl } from '@angular/forms';
import { Keyboard } from '@ionic-native/keyboard';
import { Subscription } from 'rxjs';

/**
 * Directive to display a rich text editor if enabled.
 *
 * If enabled, this directive will show a rich text editor. Otherwise it'll show a regular textarea.
 *
 * This directive requires an OBJECT model. The text written in the editor or textarea will be stored inside
 * a "text" property in that object. This is to ensure 2-way data-binding, since using a string as a model
 * could be easily broken.
 *
 * Example:
 * <core-rich-text-editor item-content [control]="control" [placeholder]="field.name"></core-rich-text-editor>
 *
 * In the example above, the text written in the editor will be stored in newpost.text.
 */
@Component({
    selector: 'core-rich-text-editor',
    templateUrl: 'core-rich-text-editor.html'
})
export class CoreRichTextEditorComponent implements AfterContentInit, OnDestroy {
    // Based on: https://github.com/judgewest2000/Ionic3RichText/
    // @todo: Anchor button, fullscreen...

    @Input() placeholder = ''; // Placeholder to set in textarea.
    @Input() control: FormControl; // Form control.
    @Input() name = 'core-rich-text-editor'; // Name to set to the textarea.
    @Input() component?: string; // The component to link the files to.
    @Input() componentId?: number; // An ID to use in conjunction with the component.
    @Output() contentChanged: EventEmitter<string>;

    @ViewChild('editor') editor: ElementRef; // WYSIWYG editor.
    @ViewChild('textarea') textarea: TextInput; // Textarea editor.
    @ViewChild('decorate') decorate: ElementRef; // Buttons.

    protected element: HTMLDivElement;
    protected editorElement: HTMLDivElement;
    protected resizeFunction;

    protected valueChangeSubscription: Subscription;

    rteEnabled = false;
    editorSupported = true;

    constructor(private domUtils: CoreDomUtilsProvider, private keyboard: Keyboard, private urlUtils: CoreUrlUtilsProvider,
            private sitesProvider: CoreSitesProvider, private filepoolProvider: CoreFilepoolProvider,
            @Optional() private content: Content, elementRef: ElementRef) {
        this.contentChanged = new EventEmitter<string>();
        this.element = elementRef.nativeElement as HTMLDivElement;
    }

    /**
     * Init editor
     */
    ngAfterContentInit(): void {
        this.domUtils.isRichTextEditorEnabled().then((enabled) => {
            this.rteEnabled = !!enabled;
        });

        this.editorSupported = this.domUtils.isRichTextEditorSupported();

        // Setup the editor.
        this.editorElement = this.editor.nativeElement as HTMLDivElement;
        this.editorElement.innerHTML = this.control.value;
        this.textarea.value = this.control.value;

        this.editorElement.onchange = this.onChange.bind(this);
        this.editorElement.onkeyup = this.onChange.bind(this);
        this.editorElement.onpaste = this.onChange.bind(this);
        this.editorElement.oninput = this.onChange.bind(this);
        this.editorElement.onkeydown = this.moveCursor.bind(this);

        // Listen for changes on the control to update the editor (if it is updated from outside of this component).
        this.valueChangeSubscription = this.control.valueChanges.subscribe((param) => {
            this.editorElement.innerHTML = param;
        });

        // Setup button actions.
        const buttons = (this.decorate.nativeElement as HTMLDivElement).getElementsByTagName('button');
        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            let command = button.getAttribute('data-command');

            if (command) {
                if (command.includes('|')) {
                    const parameter = command.split('|')[1];
                    command = command.split('|')[0];

                    button.addEventListener('click', ($event) => {
                        this.buttonAction($event, command, parameter);
                    });
                } else {
                    button.addEventListener('click', ($event) => {
                        this.buttonAction($event, command);
                    });
                }
            }
        }

        // Use paragraph on enter.
        document.execCommand('DefaultParagraphSeparator', false, 'p');

        this.treatExternalContent();

        this.resizeFunction = this.maximizeEditorSize.bind(this);
        window.addEventListener('resize', this.resizeFunction);

        let i = 0;
        const interval = setInterval(() => {
            const height = this.maximizeEditorSize();
            if (i >= 5 || height != 0) {
                clearInterval(interval);
            }
            i++;
        }, 750);
    }

    /**
     * Resize editor to maximize the space occupied.
     */
    protected maximizeEditorSize(): number {
        this.content.resize();
        const contentVisibleHeight = this.content.contentHeight;

        // Editor is ready, adjust Height if needed.
        if (contentVisibleHeight > 0) {
            const height = this.getSurroundingHeight(this.element);
            if (contentVisibleHeight > height) {
                this.element.style.height = this.domUtils.formatPixelsSize(contentVisibleHeight - height);
            } else {
                this.element.style.height = '';
            }

            return contentVisibleHeight - height;
        }

        return 0;
    }

    /**
     * Get the height of the surrounding elements from the current to the top element.
     *
     * @param  {any} element Directive DOM element to get surroundings elements from.
     * @return {number}      Surrounding height in px.
     */
    protected getSurroundingHeight(element: any): number {
        let height = 0;

        while (element.parentNode && element.parentNode.tagName != 'ION-CONTENT') {
            const parent = element.parentNode;
            if (element.tagName && element.tagName != 'CORE-LOADING') {
                for (let x = 0; x < parent.childNodes.length; x++) {
                    const child = parent.childNodes[x];
                    if (child.tagName && child != element) {
                        height += this.domUtils.getElementHeight(child, false, true, true);
                    }
                }
            }
            element = parent;
        }

        const cs = getComputedStyle(element);
        height += this.domUtils.getComputedStyleMeasure(cs, 'paddingTop') +
            this.domUtils.getComputedStyleMeasure(cs, 'paddingBottom');

        return height;
    }

    /**
     * On change function to sync with form data.
     *
     * @param {Event} $event The event.
     */
    onChange($event: Event): void {
        if (this.rteEnabled) {
            if (this.isNullOrWhiteSpace(this.editorElement.innerText)) {
                this.clearText();
            } else {
                // Don't emit event so our valueChanges doesn't get notified by this change.
                this.control.setValue(this.editorElement.innerHTML, {emitEvent: false});
                this.control.markAsDirty();
                this.textarea.value = this.editorElement.innerHTML;
            }
        } else {
            if (this.isNullOrWhiteSpace(this.textarea.value)) {
                this.clearText();
            } else {
                // Don't emit event so our valueChanges doesn't get notified by this change.
                this.control.setValue(this.textarea.value, {emitEvent: false});
                this.control.markAsDirty();
            }
        }

        this.contentChanged.emit(this.control.value);
    }

    /**
     * On key down function to move the cursor.
     * https://stackoverflow.com/questions/6249095/how-to-set-caretcursor-position-in-contenteditable-element-div
     *
     * @param {Event} $event The event.
     */
    moveCursor($event: Event): void {
        if (!this.rteEnabled) {
            return;
        }

        if ($event['key'] != 'ArrowLeft' && $event['key'] != 'ArrowRight') {
            return;
        }

        $event.preventDefault();
        $event.stopPropagation();

        const move = $event['key'] == 'ArrowLeft' ? -1 : +1,
            cursor = this.getCurrentCursorPosition(this.editorElement);

        this.setCurrentCursorPosition(this.editorElement, cursor + move);
    }

    /**
     * Returns the number of chars from the beggining where is placed the cursor.
     *
     * @param  {Node}   parent Parent where to get the position from.
     * @return {number}        Position in chars.
     */
    protected getCurrentCursorPosition(parent: Node): number {
        const selection = window.getSelection();

        let charCount = -1,
            node;

        if (selection.focusNode) {
            if (parent.contains(selection.focusNode)) {
                node = selection.focusNode;
                charCount = selection.focusOffset;

                while (node) {
                    if (node.isSameNode(parent)) {
                        break;
                    }

                    if (node.previousSibling) {
                        node = node.previousSibling;
                        charCount += node.textContent.length;
                    } else {
                        node = node.parentNode;
                        if (node === null) {
                            break;
                        }
                    }
                }
            }
        }

        return charCount;
    }

    /**
     * Set the caret position on the character number.
     *
     * @param {Node}   parent   Parent where to set the position.
     * @param {number} [chars]  Number of chars where to place the caret. If not defined it will go to the end.
     */
    protected setCurrentCursorPosition(parent: Node, chars?: number): void {
        /**
         * Loops round all the child text nodes within the supplied node and sets a range from the start of the initial node to
         * the characters.
         *
         * @param  {Node}  node  Node where to start.
         * @param  {Range} range Previous calculated range.
         * @param  {any}   chars Object with counting of characters (input-output param).
         * @return {Range}       Selection range.
         */
        const setRange = (node: Node, range: Range, chars: any): Range => {
            if (chars.count === 0) {
                range.setEnd(node, 0);
            } else if (node && chars.count > 0) {
                if (node.hasChildNodes()) {
                    // Navigate through children.
                    for (let lp = 0; lp < node.childNodes.length; lp++) {
                        range = setRange(node.childNodes[lp], range, chars);

                        if (chars.count === 0) {
                            break;
                        }
                    }
                } else if (node.textContent.length < chars.count) {
                    // Jump this node.
                    // @todo: empty nodes will be omitted.
                    chars.count -= node.textContent.length;
                } else {
                    // The cursor will be placed in this element.
                    range.setEnd(node, chars.count);
                    chars.count = 0;
                }
            }

            return range;
        };

        let range = document.createRange();
        if (typeof chars === 'undefined') {
            // Select all so it will go to the end.
            range.selectNode(parent);
            range.selectNodeContents(parent);
        } else if (chars < 0 || chars > parent.textContent.length) {
            return;
        } else {
            range.selectNode(parent);
            range.setStart(parent, 0);
            range = setRange(parent, range, {count: chars});
        }

        if (range) {
            const selection = window.getSelection();
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    /**
     * Toggle from rte editor to textarea syncing values.
     *
     * @param {Event} $event The event.
     */
    toggleEditor($event: Event): void {
        $event.preventDefault();
        $event.stopPropagation();

        const isNull = this.isNullOrWhiteSpace(this.control.value);
        if (isNull) {
            this.clearText();
        } else {
            this.editorElement.innerHTML = this.control.value;
            this.textarea.value = this.control.value;
        }

        this.rteEnabled = !this.rteEnabled;

        // Set focus and cursor at the end.
        setTimeout(() => {
            if (this.rteEnabled) {
                this.editorElement.focus();
                this.setCurrentCursorPosition(this.editorElement.firstChild);
            } else {
                this.textarea.setFocus();
            }
            setTimeout(() => {
                this.keyboard.show();
            });
        });
    }

    /**
     * Treat elements that can contain external content.
     * We only search for images because the editor should receive unfiltered text, so the multimedia filter won't be applied.
     * Treating videos and audios in here is complex, so if a user manually adds one he won't be able to play it in the editor.
     */
    protected treatExternalContent(): void {
        if (!this.sitesProvider.isLoggedIn()) {
            // Only treat external content if the user is logged in.
            return;
        }

        const elements = Array.from(this.editorElement.querySelectorAll('img')),
            siteId = this.sitesProvider.getCurrentSiteId(),
            canDownloadFiles = this.sitesProvider.getCurrentSite().canDownloadFiles();
        elements.forEach((el) => {
            const url = el.src;

            if (!url || !this.urlUtils.isDownloadableUrl(url) || (!canDownloadFiles && this.urlUtils.isPluginFileUrl(url))) {
                // Nothing to treat.
                return;
            }

            // Check if it's downloaded.
            return this.filepoolProvider.getSrcByUrl(siteId, url, this.component, this.componentId).then((finalUrl) => {
                el.setAttribute('src', finalUrl);
            });
        });
    }

    /**
     * Check if text is empty.
     * @param {string} value text
     */
    protected isNullOrWhiteSpace(value: string): boolean {
        if (value == null || typeof value == 'undefined') {
            return true;
        }

        value = value.replace(/[\n\r]/g, '');
        value = value.split(' ').join('');

        return value.length === 0;
    }

    /**
     * Clear the text.
     */
    clearText(): void {
        this.editorElement.innerHTML = '<p></p>';
        this.textarea.value = '';

        // Don't emit event so our valueChanges doesn't get notified by this change.
        this.control.setValue(null, {emitEvent: false});

        setTimeout(() => {
            if (this.rteEnabled) {
                this.setCurrentCursorPosition(this.editorElement);
            }
        }, 1);
    }

    /**
     * Execute an action over the selected text.
     *  API docs: https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand
     *
     * @param {any} $event       Event data
     * @param {string} command   Command to execute.
     * @param {any} [parameters] Parameters of the command.
     */
    protected buttonAction($event: any, command: string, parameters: any = null): void {
        $event.preventDefault();
        $event.stopPropagation();
        document.execCommand(command, false, parameters);

        setTimeout(() => {
            if (this.rteEnabled) {
                this.editorElement.focus();
            } else {
                this.textarea.setFocus();
            }
            setTimeout(() => {
                this.keyboard.show();
            });
        });
    }

    /**
     * Component being destroyed.
     */
    ngOnDestroy(): void {
        this.valueChangeSubscription && this.valueChangeSubscription.unsubscribe();
        window.removeEventListener('resize', this.resizeFunction);
    }
}
