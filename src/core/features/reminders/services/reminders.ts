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

import { AddonCalendar, AddonCalendarProvider } from '@addons/calendar/services/calendar';
import { Injectable } from '@angular/core';
import { CoreLocalNotifications } from '@services/local-notifications';
import { CoreSites } from '@services/sites';
import { CoreTimeUtils } from '@services/utils/time';
import { makeSingleton } from '@singletons';
import { CoreReminderDBRecord, REMINDERS_TABLE } from './database/reminders';
import { ILocalNotification } from '@ionic-native/local-notifications';
import { CorePlatform } from '@services/platform';

/**
 * Service to handle reminders.
 */
@Injectable({ providedIn: 'root' })
export class CoreRemindersService {

    static readonly DEFAULT_REMINDER_TIMEBEFORE = -1;

    /**
     * Returns if Reminders are enabled.
     *
     * @return True if reminders are enabled and available, false otherwise.
     */
    isEnabled(): boolean {
        return CoreLocalNotifications.isAvailable();
    }

    /**
     * Save reminder to Database.
     *
     * @param reminder Reminder to set.
     * @param siteId Site ID. If not defined, current site.
     * @return Resolved when done. Rejected on failure.
     */
    async addReminder(reminder: CoreReminderData, siteId?: string): Promise<void> {
        const site = await CoreSites.getSite(siteId);

        const reminderId = await site.getDb().insertRecord(REMINDERS_TABLE, reminder);

        const reminderRecord: CoreReminderDBRecord = Object.assign(reminder, { id: reminderId });

        await this.scheduleNotification(reminderRecord, site.getId());
    }

    /**
     * Update a reminder from local Db.
     *
     * @param reminder Fields to update.
     * @param siteId ID of the site the reminder belongs to. If not defined, use current site.
     * @return Promise resolved when the reminder data is updated.
     */
    async updateReminder(
        reminder: CoreReminderDBRecord,
        siteId?: string,
    ): Promise<void> {
        const site = await CoreSites.getSite(siteId);

        await site.getDb().updateRecords(REMINDERS_TABLE, reminder, { id: reminder.id });

        // Reschedule.
        await this.scheduleNotification(reminder, siteId);
    }

    /**
     * Update all reminders of a component and instance from local Db.
     *
     * @param newFields Fields to update.
     * @param selector Reminder selector.
     * @param siteId ID of the site the reminder belongs to. If not defined, use current site.
     * @return Promise resolved when the reminder data is updated.
     */
    async updateReminders(
        newFields: Partial<CoreReminderData>,
        selector: CoreReminderSelector,
        siteId?: string,
    ): Promise<void> {
        const site = await CoreSites.getSite(siteId);

        const reminders = await this.getReminders(selector, site.getId());

        await Promise.all(reminders.map((reminder) => {
            reminder = Object.assign(reminder, newFields);

            return this.updateReminder(reminder, site.getId());
        }));
    }

    /**
     * Get all reminders from local Db.
     *
     * @param siteId ID of the site the reminder belongs to. If not defined, use current site.
     * @return Promise resolved when the reminder data is retrieved.
     */
    async getAllReminders( siteId?: string): Promise<CoreReminderDBRecord[]> {
        const site = await CoreSites.getSite(siteId);

        return site.getDb().getRecords(REMINDERS_TABLE, undefined, 'time ASC');
    }

    /**
     * Get all reminders of a component and instance from local Db.
     *
     * @param selector Reminder selector.
     * @param siteId ID of the site the reminder belongs to. If not defined, use current site.
     * @return Promise resolved when the reminder data is retrieved.
     */
    async getReminders(selector: CoreReminderSelector, siteId?: string): Promise<CoreReminderDBRecord[]> {
        const site = await CoreSites.getSite(siteId);

        return site.getDb().getRecords(REMINDERS_TABLE, selector, 'time ASC');
    }

    /**
     * Get all reminders of a component with default time.
     *
     * @param component Component.
     * @param siteId ID of the site the reminder belongs to. If not defined, use current site.
     * @return Promise resolved when the reminder data is retrieved.
     */
    async getRemindersWithDefaultTime(component: string, siteId?: string): Promise<CoreReminderDBRecord[]> {
        const site = await CoreSites.getSite(siteId);

        return site.getDb().getRecords<CoreReminderDBRecord>(
            REMINDERS_TABLE,
            { component, timebefore: CoreRemindersService.DEFAULT_REMINDER_TIMEBEFORE },
            'time ASC',
        );
    }

    /**
     * Remove a reminder and cancel the notification.
     *
     * @param id Reminder ID.
     * @param siteId ID of the site the reminder belongs to. If not defined, use current site.
     * @return Promise resolved when the notification is updated.
     */
    async removeReminder(id: number, siteId?: string): Promise<void> {
        const site = await CoreSites.getSite(siteId);

        const reminder = await site.getDb().getRecord<CoreReminderDBRecord>(REMINDERS_TABLE, { id });

        if (this.isEnabled()) {
            this.cancelReminder(id, reminder.component, site.getId());
        }

        await site.getDb().deleteRecords(REMINDERS_TABLE, { id });
    }

    /**
     * Remove all reminders of the same element.
     *
     * @param selector Reminder selector.
     * @param siteId ID of the site the reminder belongs to. If not defined, use current site.
     * @return Promise resolved when the notification is updated.
     */
    async removeReminders(selector: CoreReminderSelector, siteId?: string): Promise<void> {
        const site = await CoreSites.getSite(siteId);
        siteId = site.getId();

        if (this.isEnabled()) {
            const reminders = await this.getReminders(selector, siteId);

            reminders.forEach((reminder) => {
                this.cancelReminder(reminder.id, reminder.component, siteId);
            });
        }

        await site.getDb().deleteRecords(REMINDERS_TABLE, selector);
    }

    /**
     * Cancel a notification for a reminder.
     *
     * @param reminderId Reminder Id to cancel.
     * @param component Reminder component.
     * @param siteId ID of the site the reminder belongs to. If not defined, use current site.
     * @returns
     */
    async cancelReminder(reminderId: number, component: string, siteId?: string): Promise<void> {
        siteId = siteId || CoreSites.getCurrentSiteId();

        return CoreLocalNotifications.cancel(reminderId, component, siteId);
    }

    /**
     * Schedules a notification. If local notification plugin is not enabled, resolve the promise.
     *
     * @param reminder Reminder to schedule.
     * @param siteId Site ID the reminder belongs to. If not defined, use current site.
     * @return Promise resolved when the notification is scheduled.
     */
    async scheduleNotification(
        reminder: CoreReminderDBRecord,
        siteId?: string,
    ): Promise<void> {

        if (!this.isEnabled()) {
            return;
        }

        siteId = siteId || CoreSites.getCurrentSiteId();

        const timebefore = reminder.timebefore === CoreRemindersService.DEFAULT_REMINDER_TIMEBEFORE
            ? await AddonCalendar.getDefaultNotificationTime(siteId)
            : reminder.timebefore;

        if (timebefore === AddonCalendarProvider.DEFAULT_NOTIFICATION_DISABLED) {
            // Notification disabled. Cancel.
            return this.cancelReminder(reminder.id, reminder.component, siteId);
        }

        const notificationTime = (reminder.time - timebefore) * 1000;

        if (notificationTime <= Date.now()) { // @TODO Add a threshold.
            // This reminder is over, don't schedule. Cancel if it was scheduled.
            return this.cancelReminder(reminder.id, reminder.component, siteId);
        }

        const notificationData: CoreRemindersPushNotificationData = {
            reminderId: reminder.id,
            instanceId: reminder.instanceId,
            siteId: siteId,
        };

        const notification: ILocalNotification = {
            id: reminder.id,
            title: reminder.title,
            text: CoreTimeUtils.userDate(reminder.time * 1000, 'core.strftimedaydatetime', true),
            icon: 'file://assets/img/icons/calendar.png',
            trigger: {
                at: new Date(notificationTime),
            },
            data: notificationData,
        };

        return CoreLocalNotifications.schedule(notification, reminder.component, siteId);
    }

    /**
     * Get the all saved reminders and schedule the notification.
     * If local notification plugin is not enabled, resolve the promise.
     *
     * @return Promise resolved when all the notifications have been scheduled.
     */
    async scheduleAllNotifications(): Promise<void> {
        await CorePlatform.ready();

        if (!this.isEnabled()) {
            return;
        }

        const siteIds = await CoreSites.getSitesIds();

        await Promise.all(siteIds.map((siteId: string) => async () => {
            const reminders = await this.getAllReminders(siteId);

            reminders.forEach((reminder) => {
                this.scheduleNotification(reminder, siteId);
            });
        }));
    }

}

export const CoreReminders = makeSingleton(CoreRemindersService);

export type CoreReminderData = Omit<CoreReminderDBRecord, 'id'>;

/**
 * Additional data sent in push notifications, with some calculated data.
 */
export type CoreRemindersPushNotificationData = {
    reminderId: number;
    instanceId: number;
    siteId: string;
};

export type CoreReminderNotificationOptions = {
    title: string;
};

export type CoreReminderSelector = {
    instanceId: number;
    component: string;
    type?: string;
};
