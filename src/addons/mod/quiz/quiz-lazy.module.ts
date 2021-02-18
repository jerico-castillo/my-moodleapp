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
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
    {
        path: ':courseId/:cmdId',
        loadChildren: () => import('./pages/index/index.module').then( m => m.AddonModQuizIndexPageModule),
    },
    {
        path: 'player/:courseId/:quizId',
        loadChildren: () => import('./pages/player/player.module').then( m => m.AddonModQuizPlayerPageModule),
    },
    {
        path: 'attempt/:courseId/:quizId/:attemptId',
        loadChildren: () => import('./pages/attempt/attempt.module').then( m => m.AddonModQuizAttemptPageModule),
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
})
export class AddonModQuizLazyModule {}
