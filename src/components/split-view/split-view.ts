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

// Code based on https://github.com/martinpritchardelevate/ionic-split-pane-demo

import { Component, ViewChild, Injectable, Input, ElementRef, OnInit } from '@angular/core';
import { NavController, Nav } from 'ionic-angular';
import { CoreSplitViewPlaceholderPage } from './placeholder/placeholder';

/**
 * Directive to create a split view layout.
 *
 * @description
 * To init/change the right pane contents (content pane), inject this component in the master page.
 * @ViewChild(CoreSplitViewComponent) splitviewCtrl: CoreSplitViewComponent;
 * Then use the push function to load.
 *
 * Accepts the following params:
 *
 * @param {string|boolean} [when] When the split-pane should be shown. Can be a CSS media query expression, or a shortcut
 * expression. Can also be a boolean expression. Check split-pane component documentation for more information.
 *
 * Example:
 *
 * <core-split-view [when]="lg">
 *     <ion-content><!-- CONTENT TO SHOW ON THE LEFT PANEL (MENU) --></ion-content>
 * </core-split-view>
 */
@Component({
    selector: 'core-split-view',
    templateUrl: 'split-view.html'
})
export class CoreSplitViewComponent implements OnInit {
    // @todo Mix both panels header buttons

    @ViewChild('detailNav') _detailNav: Nav;
    @Input() when?: string | boolean = "md"; //
    protected _isOn: boolean = false;
    protected masterPageName: string = "";
    protected loadDetailPage: any = false;
    protected element: HTMLElement; // Current element.

    // Empty placeholder for the 'detail' page.
    detailPage: any = null;

    constructor(private _masterNav: NavController, element: ElementRef) {
        this.element = element.nativeElement;
    }

    /**
     * Component being initialized.
     */
    ngOnInit() {
        // Get the master page name and set an empty page as a placeholder.
        this.masterPageName = this._masterNav.getActive().component.name;
        this.emptyDetails();
    }

    /**
     * Check if both panels are shown. It depends on screen width.
     *
     * @return {boolean} If split view is enabled.
     */
    isOn(): boolean {
        return this._isOn;
    }

    /**
     * Push a page to the navigation stack. It will decide where to load it depending on the size of the screen.
     *
     * @param {any} page   The component class or deeplink name you want to push onto the navigation stack.
     * @param {any} params Any NavParams you want to pass along to the next view.
     */
    push(page: any, params?: any, element?: HTMLElement) {
        if (this._isOn) {
            this._detailNav.setRoot(page, params);
        } else {
            this.loadDetailPage = {
                component: page,
                data: params
            };
            this._masterNav.push(page, params);
        }
    }

    /**
     * Set the details panel to default info.
     */
    emptyDetails() {
        this.loadDetailPage = false;
        this._detailNav.setRoot('CoreSplitViewPlaceholderPage');
    }

    /**
     * Splitpanel visibility has changed.
     *
     * @param {Boolean} isOn If it fits both panels at the same time.
     */
    onSplitPaneChanged(isOn) {
        this._isOn = isOn;
        if (this._masterNav && this._detailNav) {
            (isOn) ? this.activateSplitView() : this.deactivateSplitView();
        }
    }

    /**
     * Enable the split view, show both panels and do some magical navigation.
     */
    activateSplitView() {
        let currentView = this._masterNav.getActive(),
            currentPageName = currentView.component.name;
        if (currentPageName != this.masterPageName) {
            // CurrentView is a 'Detail' page remove it from the 'master' nav stack.
            this._masterNav.pop();

            // and add it to the 'detail' nav stack.
            this._detailNav.setRoot(currentView.component, currentView.data);
        } else if (this.loadDetailPage) {
            // MasterPage is shown, load the last detail page if found.
            this._detailNav.setRoot(this.loadDetailPage.component, this.loadDetailPage.data);
        }
        this.loadDetailPage = false;
    }

    /**
     * Disabled the split view, show only one panel and do some magical navigation.
     */
    deactivateSplitView() {
        let detailView = this._detailNav.getActive(),
            currentPageName = detailView.component.name;
        if (currentPageName != 'CoreSplitViewPlaceholderPage') {
            // Current detail view is a 'Detail' page so, not the placeholder page, push it on 'master' nav stack.
            this._masterNav.push(detailView.component, detailView.data);
        }
    }
}