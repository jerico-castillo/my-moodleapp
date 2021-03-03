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
import { CoreCreateLinksPipe } from './create-links';
import { CoreFormatDatePipe } from './format-date';
import { CoreNoTagsPipe } from './no-tags';
import { CoreSecondsToHMSPipe } from './seconds-to-hms';
import { CoreTimeAgoPipe } from './time-ago';
import { CoreBytesToSizePipe } from './bytes-to-size';
import { CoreDurationPipe } from './duration';
import { CoreDateDayOrTimePipe } from './date-day-or-time';
import { CoreToLocaleStringPipe } from './to-locale-string';

@NgModule({
    declarations: [
        CoreCreateLinksPipe,
        CoreNoTagsPipe,
        CoreTimeAgoPipe,
        CoreFormatDatePipe,
        CoreBytesToSizePipe,
        CoreSecondsToHMSPipe,
        CoreDurationPipe,
        CoreDateDayOrTimePipe,
        CoreToLocaleStringPipe,
    ],
    imports: [],
    exports: [
        CoreCreateLinksPipe,
        CoreNoTagsPipe,
        CoreTimeAgoPipe,
        CoreFormatDatePipe,
        CoreBytesToSizePipe,
        CoreSecondsToHMSPipe,
        CoreDurationPipe,
        CoreDateDayOrTimePipe,
        CoreToLocaleStringPipe,
    ],
})
export class CorePipesModule {}
