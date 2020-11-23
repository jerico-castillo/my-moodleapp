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
import { NavParams, PopoverController } from '@ionic/angular';
import { CoreContextMenuItemComponent } from './context-menu-item';

/**
 * Component to display a list of items received by param in a popover.
 */
@Component({
    selector: 'core-context-menu-popover',
    templateUrl: 'core-context-menu-popover.html',
    styleUrls: ['context-menu-popover.scss'],
})
export class CoreContextMenuPopoverComponent {

    title: string;
    uniqueId: string;
    items: CoreContextMenuItemComponent[];

    constructor(
        navParams: NavParams,
        protected popoverCtrl: PopoverController,
    ) {
        this.title = navParams.get('title');
        this.items = navParams.get('items') || [];
        this.uniqueId = navParams.get('id');
    }

    /**
     * Close the popover.
     */
    closeMenu(item?: CoreContextMenuItemComponent): void {
        this.popoverCtrl.dismiss(item);
    }

    /**
     * Function called when an item is clicked.
     *
     * @param event Click event.
     * @param item Item clicked.
     * @return Return true if success, false if error.
     */
    itemClicked(event: Event, item: CoreContextMenuItemComponent): boolean {
        if (!!item.action && item.action.observers.length > 0) {
            event.preventDefault();
            event.stopPropagation();

            if (item.iconAction == 'spinner') {
                return false;
            }

            if (item.closeOnClick) {
                this.closeMenu(item);
            }

            item.action.emit(this.closeMenu.bind(this, item));
        } else if (item.closeOnClick && (item.href || (!!item.onClosed && item.onClosed.observers.length > 0))) {
            this.closeMenu(item);
        }

        return true;
    }

}
