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

import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { CoreConstants } from '../../core/constants';

/*
 * "Utils" service with helper functions for date and time.
*/
@Injectable()
export class CoreTimeUtilsProvider {

    constructor(private translate: TranslateService) {}

    /**
     * Returns hours, minutes and seconds in a human readable format
     *
     * @param {number} seconds A number of seconds
     * @return {string} Seconds in a human readable format.
     */
    formatTime(seconds: number) : string {
        let totalSecs = Math.abs(seconds),
            years     = Math.floor(totalSecs / CoreConstants.secondsYear),
            remainder = totalSecs - (years * CoreConstants.secondsYear),
            days      = Math.floor(remainder / CoreConstants.secondsDay);

        remainder = totalSecs - (days * CoreConstants.secondsDay);

        let hours = Math.floor(remainder / CoreConstants.secondsHour);
        remainder = remainder - (hours * CoreConstants.secondsHour);

        let mins = Math.floor(remainder / CoreConstants.secondsMinute),
            secs      = remainder - (mins * CoreConstants.secondsMinute),
            ss = this.translate.instant('mm.core.' + (secs == 1 ? 'sec' : 'secs')),
            sm = this.translate.instant('mm.core.' + (mins == 1 ? 'min' : 'mins')),
            sh = this.translate.instant('mm.core.' + (hours == 1 ? 'hour' : 'hours')),
            sd = this.translate.instant('mm.core.' + (days == 1 ? 'day' : 'days')),
            sy = this.translate.instant('mm.core.' + (years == 1 ? 'year' : 'years')),
            oyears = '',
            odays = '',
            ohours = '',
            omins = '',
            osecs = '';

        if (years) {
            oyears  = years + ' ' + sy;
        }
        if (days) {
            odays  = days + ' ' + sd;
        }
        if (hours) {
            ohours = hours + ' ' + sh;
        }
        if (mins) {
            omins  = mins + ' ' + sm;
        }
        if (secs) {
            osecs  = secs + ' ' + ss;
        }

        if (years) {
            return oyears + ' ' + odays;
        }
        if (days) {
            return odays + ' ' + ohours;
        }
        if (hours) {
            return ohours + ' ' + omins;
        }
        if (mins) {
            return omins + ' ' + osecs;
        }
        if (secs) {
            return osecs;
        }

        return this.translate.instant('mm.core.now');
    }

    /**
     * Returns hours, minutes and seconds in a human readable format.
     *
     * @param {number} duration Duration in seconds
     * @param {number} [precision] Number of elements to have in precission. 0 or undefined to full precission.
     * @return {string} Duration in a human readable format.
     */
    formatDuration(duration: number, precision?: number) : string {
        precision = precision || 5;

        let eventDuration = moment.duration(duration, 'seconds'),
            durationString = '';

        if (precision && eventDuration.years() > 0) {
            durationString += ' ' + moment.duration(eventDuration.years(), 'years').humanize();
            precision--;
        }
        if (precision && eventDuration.months() > 0) {
            durationString += ' ' + moment.duration(eventDuration.months(), 'months').humanize();
            precision--;
        }
        if (precision && eventDuration.days() > 0) {
            durationString += ' ' + moment.duration(eventDuration.days(), 'days').humanize();
            precision--;
        }
        if (precision && eventDuration.hours() > 0) {
            durationString += ' ' + moment.duration(eventDuration.hours(), 'hours').humanize();
            precision--;
        }
        if (precision && eventDuration.minutes() > 0) {
            durationString += ' ' + moment.duration(eventDuration.minutes(), 'minutes').humanize();
            precision--;
        }

        return durationString.trim();
    }

    /**
     * Return the current timestamp in a "readable" format: YYYYMMDDHHmmSS.
     *
     * @return {string} The readable timestamp.
     */
    readableTimestamp() : string {
        return moment(Date.now()).format('YYYYMMDDHHmmSS');
    }

    /**
     * Return the current timestamp (UNIX format, seconds).
     *
     * @return {number} The current timestamp in seconds.
     */
    timestamp() : number {
        return Math.round(Date.now() / 1000);
    }

}
