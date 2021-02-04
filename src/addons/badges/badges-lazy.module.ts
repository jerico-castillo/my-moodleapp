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
import { Route, RouterModule, Routes } from '@angular/router';


export const AddonBadgesIssueRoute: Route = {
    path: 'issue',
    loadChildren: () => import('./pages/issued-badge/issued-badge.module').then( m => m.AddonBadgesIssuedBadgePageModule),
};

const routes: Routes = [
    {
        path: '',
        redirectTo: 'user',
        pathMatch: 'full',
    },
    AddonBadgesIssueRoute,
    {
        path: 'user',
        loadChildren: () => import('./pages/user-badges/user-badges.module').then( m => m.AddonBadgesUserBadgesPageModule),
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
})
export class AddonBadgesLazyModule {}
