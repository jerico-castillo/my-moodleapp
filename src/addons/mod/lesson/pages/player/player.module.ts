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
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { CoreSharedModule } from '@/core/shared.module';
import { AddonModLessonPlayerPage } from './player';
import { CoreEditorComponentsModule } from '@features/editor/components/components.module';
import { CanLeaveGuard } from '@guards/can-leave';

const routes: Routes = [
    {
        path: '',
        component: AddonModLessonPlayerPage,
        canDeactivate: [CanLeaveGuard],
    },
];

@NgModule({
    imports: [
        RouterModule.forChild(routes),
        CommonModule,
        IonicModule,
        TranslateModule.forChild(),
        FormsModule,
        ReactiveFormsModule,
        CoreSharedModule,
        CoreEditorComponentsModule,
    ],
    declarations: [
        AddonModLessonPlayerPage,
    ],
    exports: [RouterModule],
})
export class AddonModLessonPlayerPageModule {}
