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

import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AddonCalendarEventRoute, AddonCalendarEditRoute } from '@addons/calendar/calendar-lazy.module';
import { conditionalRoutes } from '@/app/app-routing.module';
import { CoreScreen } from '@services/screen';

import { CoreSharedModule } from '@/core/shared.module';

import { AddonCalendarListPage } from './list.page';

const splitviewRoutes = [AddonCalendarEditRoute, AddonCalendarEventRoute];

const mobileRoutes: Routes = [
    {
        path: '',
        component: AddonCalendarListPage,
    },
    ...splitviewRoutes,
];

const tabletRoutes: Routes = [
    {
        path: '',
        component: AddonCalendarListPage,
        children: [
            ...splitviewRoutes,
        ],
    },
];

const routes: Routes = [
    ...conditionalRoutes(mobileRoutes, () => CoreScreen.instance.isMobile),
    ...conditionalRoutes(tabletRoutes, () => CoreScreen.instance.isTablet),
];


@NgModule({
    imports: [
        RouterModule.forChild(routes),
        CommonModule,
        IonicModule,
        TranslateModule.forChild(),
        CoreSharedModule,
    ],
    declarations: [
        AddonCalendarListPage,
    ],
    exports: [RouterModule],
})
export class AddonCalendarListPageModule {}
