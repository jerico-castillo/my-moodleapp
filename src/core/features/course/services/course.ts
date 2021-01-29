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

import { Injectable } from '@angular/core';
import { Params } from '@angular/router';

import { CoreApp } from '@services/app';
import { CoreEvents } from '@singletons/events';
import { CoreLogger } from '@singletons/logger';
import { CoreSitesCommonWSOptions, CoreSites } from '@services/sites';
import { CoreTimeUtils } from '@services/utils/time';
import { CoreUtils } from '@services/utils/utils';
import { CoreSiteWSPreSets, CoreSite } from '@classes/site';
import { CoreConstants } from '@/core/constants';
import { makeSingleton, Translate } from '@singletons';
import { CoreStatusWithWarningsWSResponse, CoreWSExternalFile } from '@services/ws';

import { CoreCourseStatusDBRecord, COURSE_STATUS_TABLE } from './database/course';
import { CoreCourseOffline } from './course-offline';
import { CoreError } from '@classes/errors/error';
import {
    CoreCourses,
    CoreCoursesProvider,
} from '../../courses/services/courses';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreWSError } from '@classes/errors/wserror';
import { CorePushNotifications } from '@features/pushnotifications/services/pushnotifications';

const ROOT_CACHE_KEY = 'mmCourse:';

/**
 * Service that provides some features regarding a course.
 */
@Injectable({ providedIn: 'root' })
export class CoreCourseProvider {

    static readonly ALL_SECTIONS_ID = -2;
    static readonly STEALTH_MODULES_SECTION_ID = -1;
    static readonly ACCESS_GUEST = 'courses_access_guest';
    static readonly ACCESS_DEFAULT = 'courses_access_default';
    static readonly ALL_COURSES_CLEARED = -1;

    static readonly COMPLETION_TRACKING_NONE = 0;
    static readonly COMPLETION_TRACKING_MANUAL = 1;
    static readonly COMPLETION_TRACKING_AUTOMATIC = 2;

    static readonly COMPLETION_INCOMPLETE = 0;
    static readonly COMPLETION_COMPLETE = 1;
    static readonly COMPLETION_COMPLETE_PASS = 2;
    static readonly COMPLETION_COMPLETE_FAIL = 3;

    static readonly COMPONENT = 'CoreCourse';

    protected readonly CORE_MODULES = [
        'assign', 'assignment', 'book', 'chat', 'choice', 'data', 'database', 'date', 'external-tool',
        'feedback', 'file', 'folder', 'forum', 'glossary', 'ims', 'imscp', 'label', 'lesson', 'lti', 'page', 'quiz',
        'resource', 'scorm', 'survey', 'url', 'wiki', 'workshop', 'h5pactivity',
    ];

    protected logger: CoreLogger;

    constructor() {
        // @todo
        // protected courseFormatDelegate: CoreCourseFormatDelegate,
        // protected sitePluginsProvider: CoreSitePluginsProvider,
        this.logger = CoreLogger.getInstance('CoreCourseProvider');
    }

    /**
     * Check if the get course blocks WS is available in current site.
     *
     * @param site Site to check. If not defined, current site.
     * @return Whether it's available.
     * @since 3.7
     */
    canGetCourseBlocks(site?: CoreSite): boolean {
        site = site || CoreSites.instance.getCurrentSite();

        return !!site && site.isVersionGreaterEqualThan('3.7') && site.wsAvailable('core_block_get_course_blocks');
    }

    /**
     * Check whether the site supports requesting stealth modules.
     *
     * @param site Site. If not defined, current site.
     * @return Whether the site supports requesting stealth modules.
     * @since 3.4.6, 3.5.3, 3.6
     */
    canRequestStealthModules(site?: CoreSite): boolean {
        site = site || CoreSites.instance.getCurrentSite();

        return !!site && site.isVersionGreaterEqualThan(['3.4.6', '3.5.3']);
    }

    /**
     * Check if module completion could have changed. If it could have, trigger event. This function must be used,
     * for example, after calling a "module_view" WS since it can change the module completion.
     *
     * @param courseId Course ID.
     * @param completion Completion status of the module.
     * @todo Add completion type.
     */
    checkModuleCompletion(courseId: number, completion: any): void {
        if (completion && completion.tracking === 2 && completion.state === 0) {
            this.invalidateSections(courseId).finally(() => {
                CoreEvents.trigger(CoreEvents.COMPLETION_MODULE_VIEWED, { courseId: courseId });
            });
        }
    }

    /**
     * Clear all courses status in a site.
     *
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when all status are cleared.
     */
    async clearAllCoursesStatus(siteId?: string): Promise<void> {
        const site = await CoreSites.instance.getSite(siteId);
        this.logger.debug('Clear all course status for site ' + site.id);

        await site.getDb().deleteRecords(COURSE_STATUS_TABLE);
        this.triggerCourseStatusChanged(CoreCourseProvider.ALL_COURSES_CLEARED, CoreConstants.NOT_DOWNLOADED, site.id);
    }

    /**
     * Check if the current view in a NavController is a certain course initial page.
     *
     * @param navCtrl NavController.
     * @param courseId Course ID.
     * @return Whether the current view is a certain course.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentViewIsCourse(navCtrl: any, courseId: number): boolean {
        // @todo implement
        return false;
    }

    /**
     * Get completion status of all the activities in a course for a certain user.
     *
     * @param courseId Course ID.
     * @param siteId Site ID. If not defined, current site.
     * @param userId User ID. If not defined, current user.
     * @param forceCache True if it should return cached data. Has priority over ignoreCache.
     * @param ignoreCache True if it should ignore cached data (it will always fail in offline or server down).
     * @param includeOffline True if it should load offline data in the completion status.
     * @return Promise resolved with the completion statuses: object where the key is module ID.
     */
    async getActivitiesCompletionStatus(
        courseId: number,
        siteId?: string,
        userId?: number,
        forceCache: boolean = false,
        ignoreCache: boolean = false,
        includeOffline: boolean = true,
    ): Promise<Record<string, CoreCourseCompletionActivityStatus>> {

        const site = await CoreSites.instance.getSite(siteId);
        userId = userId || site.getUserId();

        this.logger.debug(`Getting completion status for user ${userId} in course ${courseId}`);

        const params: CoreCompletionGetActivitiesCompletionStatusWSParams = {
            courseid: courseId,
            userid: userId,
        };
        const preSets: CoreSiteWSPreSets = {
            cacheKey: this.getActivitiesCompletionCacheKey(courseId, userId),
        };

        if (forceCache) {
            preSets.omitExpires = true;
        } else if (ignoreCache) {
            preSets.getFromCache = false;
            preSets.emergencyCache = false;
        }


        const data = await site.read<CoreCourseCompletionActivityStatusWSResponse>(
            'core_completion_get_activities_completion_status',
            params,
            preSets,
        );

        if (!data || !data.statuses) {
            throw Error('WS core_completion_get_activities_completion_status failed');
        }

        const completionStatus = CoreUtils.instance.arrayToObject(data.statuses, 'cmid');
        if (!includeOffline) {
            return completionStatus;
        }

        try {
            // Now get the offline completion (if any).
            const offlineCompletions = await CoreCourseOffline.instance.getCourseManualCompletions(courseId, site.id);

            offlineCompletions.forEach((offlineCompletion) => {

                if (offlineCompletion && typeof completionStatus[offlineCompletion.cmid] != 'undefined') {
                    const onlineCompletion = completionStatus[offlineCompletion.cmid];

                    // If the activity uses manual completion, override the value with the offline one.
                    if (onlineCompletion.tracking === 1) {
                        onlineCompletion.state = offlineCompletion.completed;
                        onlineCompletion.offline = true;
                    }
                }
            });

            return completionStatus;
        } catch {
            // Ignore errors.
            return completionStatus;
        }
    }

    /**
     * Get cache key for activities completion WS calls.
     *
     * @param courseId Course ID.
     * @param userId User ID.
     * @return Cache key.
     */
    protected getActivitiesCompletionCacheKey(courseId: number, userId: number): string {
        return ROOT_CACHE_KEY + 'activitiescompletion:' + courseId + ':' + userId;
    }

    /**
     * Get course blocks.
     *
     * @param courseId Course ID.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with the list of blocks.
     * @since 3.7
     */
    async getCourseBlocks(courseId: number, siteId?: string): Promise<CoreCourseBlock[]> {
        const site = await CoreSites.instance.getSite(siteId);
        const params: CoreBlockGetCourseBlocksWSParams = {
            courseid: courseId,
            returncontents: true,
        };
        const preSets: CoreSiteWSPreSets = {
            cacheKey: this.getCourseBlocksCacheKey(courseId),
            updateFrequency: CoreSite.FREQUENCY_RARELY,
        };
        const result = await site.read<CoreCourseBlocksWSResponse>('core_block_get_course_blocks', params, preSets);

        return result.blocks || [];
    }

    /**
     * Get cache key for course blocks WS calls.
     *
     * @param courseId Course ID.
     * @return Cache key.
     */
    protected getCourseBlocksCacheKey(courseId: number): string {
        return ROOT_CACHE_KEY + 'courseblocks:' + courseId;
    }

    /**
     * Get the data stored for a course.
     *
     * @param courseId Course ID.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with the data.
     */
    async getCourseStatusData(courseId: number, siteId?: string): Promise<CoreCourseStatusDBRecord> {
        const site = await CoreSites.instance.getSite(siteId);
        const entry: CoreCourseStatusDBRecord = await site.getDb().getRecord(COURSE_STATUS_TABLE, { id: courseId });
        if (!entry) {
            throw Error('No entry found on course status table');
        }

        return entry;
    }

    /**
     * Get a course status.
     *
     * @param courseId Course ID.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with the status.
     */
    async getCourseStatus(courseId: number, siteId?: string): Promise<string> {
        try {
            const entry = await this.getCourseStatusData(courseId, siteId);

            return entry.status || CoreConstants.NOT_DOWNLOADED;
        } catch {
            return CoreConstants.NOT_DOWNLOADED;
        }
    }

    /**
     * Obtain ids of downloaded courses.
     *
     * @param siteId Site id.
     * @return Resolves with an array containing downloaded course ids.
     */
    async getDownloadedCourseIds(siteId?: string): Promise<number[]> {
        const site = await CoreSites.instance.getSite(siteId);
        const entries: CoreCourseStatusDBRecord[] = await site.getDb().getRecordsList(
            COURSE_STATUS_TABLE,
            'status',
            [
                CoreConstants.DOWNLOADED,
                CoreConstants.DOWNLOADING,
                CoreConstants.OUTDATED,
            ],
        );

        return entries.map((entry) => entry.id);
    }

    /**
     * Get a module from Moodle.
     *
     * @param moduleId The module ID.
     * @param courseId The course ID. Recommended to speed up the process and minimize data usage.
     * @param sectionId The section ID.
     * @param preferCache True if shouldn't call WS if data is cached, false otherwise.
     * @param ignoreCache True if it should ignore cached data (it will always fail in offline or server down).
     * @param siteId Site ID. If not defined, current site.
     * @param modName If set, the app will retrieve all modules of this type with a single WS call. This reduces the
     *                number of WS calls, but it isn't recommended for modules that can return a lot of contents.
     * @return Promise resolved with the module.
     */
    async getModule(
        moduleId: number,
        courseId?: number,
        sectionId?: number,
        preferCache: boolean = false,
        ignoreCache: boolean = false,
        siteId?: string,
        modName?: string,
    ): Promise<CoreCourseModuleData> {
        siteId = siteId || CoreSites.instance.getCurrentSiteId();

        // Helper function to do the WS request without processing the result.
        const doRequest = async (
            site: CoreSite,
            moduleId: number,
            modName: string | undefined,
            includeStealth: boolean,
            preferCache: boolean,
        ): Promise<CoreCourseSection[]> => {
            const params: CoreCourseGetContentsParams = {
                courseid: courseId!,
                options: [],
            };
            const preSets: CoreSiteWSPreSets = {
                omitExpires: preferCache,
                updateFrequency: CoreSite.FREQUENCY_RARELY,
            };

            if (includeStealth) {
                params.options!.push({
                    name: 'includestealthmodules',
                    value: true,
                });
            }

            // If modName is set, retrieve all modules of that type. Otherwise get only the module.
            if (modName) {
                params.options!.push({
                    name: 'modname',
                    value: modName,
                });
                preSets.cacheKey = this.getModuleByModNameCacheKey(modName);
            } else {
                params.options!.push({
                    name: 'cmid',
                    value: moduleId,
                });
                preSets.cacheKey = this.getModuleCacheKey(moduleId);
            }

            if (!preferCache && ignoreCache) {
                preSets.getFromCache = false;
                preSets.emergencyCache = false;
            }

            try {
                const sections: CoreCourseSection[] = await site.read('core_course_get_contents', params, preSets);

                return sections;
            } catch {
                // The module might still be cached by a request with different parameters.
                if (!ignoreCache && !CoreApp.instance.isOnline()) {
                    if (includeStealth) {
                        // Older versions didn't include the includestealthmodules option.
                        return doRequest(site, moduleId, modName, false, true);
                    } else if (modName) {
                        // Falback to the request for the given moduleId only.
                        return doRequest(site, moduleId, undefined, this.canRequestStealthModules(site), true);
                    }
                }

                throw Error('WS core_course_get_contents failed, cache ignored');
            }
        };

        if (!courseId) {
            // No courseId passed, try to retrieve it.
            const module = await this.getModuleBasicInfo(moduleId, siteId);
            courseId = module.course;
        }

        let sections: CoreCourseSection[];
        try {
            const site = await CoreSites.instance.getSite(siteId);
            // We have courseId, we can use core_course_get_contents for compatibility.
            this.logger.debug(`Getting module ${moduleId} in course ${courseId}`);

            sections = await doRequest(site, moduleId, modName, this.canRequestStealthModules(site), preferCache);
        } catch {
            // Error getting the module. Try to get all contents (without filtering by module).
            const preSets: CoreSiteWSPreSets = {
                omitExpires: preferCache,
            };

            if (!preferCache && ignoreCache) {
                preSets.getFromCache = false;
                preSets.emergencyCache = false;
            }

            sections = await this.getSections(courseId, false, false, preSets, siteId);
        }

        let foundModule: CoreCourseModuleData | undefined;

        const foundSection = sections.some((section) => {
            if (sectionId != null &&
                !isNaN(sectionId) &&
                section.id != CoreCourseProvider.STEALTH_MODULES_SECTION_ID &&
                sectionId != section.id
            ) {
                return false;
            }

            foundModule = section.modules.find((module) => module.id == moduleId);

            return !!foundModule;
        });

        if (foundSection && foundModule) {
            foundModule.course = courseId;

            return foundModule;
        }

        throw Error('Module not found');
    }

    /**
     * Gets a module basic info by module ID.
     *
     * @param moduleId Module ID.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with the module's info.
     */
    async getModuleBasicInfo(moduleId: number, siteId?: string): Promise<CoreCourseModuleBasicInfo> {
        const site = await CoreSites.instance.getSite(siteId);
        const params: CoreCourseGetCourseModuleWSParams = {
            cmid: moduleId,
        };
        const preSets = {
            cacheKey: this.getModuleCacheKey(moduleId),
            updateFrequency: CoreSite.FREQUENCY_RARELY,
        };
        const response = await site.read<CoreCourseGetCourseModuleWSResponse>('core_course_get_course_module', params, preSets);

        if (response.warnings && response.warnings.length) {
            throw new CoreWSError(response.warnings[0]);
        } else if (response.cm) {
            return response.cm;
        }

        throw Error('WS core_course_get_course_module failed.');
    }

    /**
     * Gets a module basic grade info by module ID.
     *
     * If the user does not have permision to manage the activity false is returned.
     *
     * @param moduleId Module ID.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with the module's grade info.
     */
    async getModuleBasicGradeInfo(moduleId: number, siteId?: string): Promise<CoreCourseModuleGradeInfo | false> {
        const info = await this.getModuleBasicInfo(moduleId, siteId);

        const grade: CoreCourseModuleGradeInfo = {
            advancedgrading: info.advancedgrading,
            grade: info.grade,
            gradecat: info.gradecat,
            gradepass: info.gradepass,
            outcomes: info.outcomes,
            scale: info.scale,
        };

        if (
            typeof grade.grade != 'undefined' ||
            typeof grade.advancedgrading != 'undefined' ||
            typeof grade.outcomes != 'undefined'
        ) {
            return grade;
        }

        return false;
    }

    /**
     * Gets a module basic info by instance.
     *
     * @param id Instance ID.
     * @param module Name of the module. E.g. 'glossary'.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with the module's info.
     */
    async getModuleBasicInfoByInstance(id: number, module: string, siteId?: string): Promise<CoreCourseModuleBasicInfo> {
        const site = await CoreSites.instance.getSite(siteId);
        const params: CoreCourseGetCourseModuleByInstanceWSParams = {
            instance: id,
            module: module,
        };
        const preSets = {
            cacheKey: this.getModuleBasicInfoByInstanceCacheKey(id, module),
            updateFrequency: CoreSite.FREQUENCY_RARELY,
        };
        const response: CoreCourseGetCourseModuleWSResponse =
            await site.read('core_course_get_course_module_by_instance', params, preSets);

        if (response.warnings && response.warnings.length) {
            throw new CoreWSError(response.warnings[0]);
        } else if (response.cm) {
            return response.cm;
        }

        throw Error('WS core_course_get_course_module_by_instance failed');
    }

    /**
     * Get cache key for get module by instance WS calls.
     *
     * @param id Instance ID.
     * @param module Name of the module. E.g. 'glossary'.
     * @return Cache key.
     */
    protected getModuleBasicInfoByInstanceCacheKey(id: number, module: string): string {
        return ROOT_CACHE_KEY + 'moduleByInstance:' + module + ':' + id;
    }

    /**
     * Get cache key for module WS calls.
     *
     * @param moduleId Module ID.
     * @return Cache key.
     */
    protected getModuleCacheKey(moduleId: number): string {
        return ROOT_CACHE_KEY + 'module:' + moduleId;
    }

    /**
     * Get cache key for module by modname WS calls.
     *
     * @param modName Name of the module.
     * @return Cache key.
     */
    protected getModuleByModNameCacheKey(modName: string): string {
        return ROOT_CACHE_KEY + 'module:modName:' + modName;
    }

    /**
     * Returns the source to a module icon.
     *
     * @param moduleName The module name.
     * @param modicon The mod icon string to use in case we are not using a core activity.
     * @return The IMG src.
     */
    getModuleIconSrc(moduleName: string, modicon?: string): string {
        // @TODO: Check modicon url theme to apply other theme icons.

        // Use default icon on core themes.
        if (this.CORE_MODULES.indexOf(moduleName) < 0) {
            if (modicon) {
                return modicon;
            }

            moduleName = 'external-tool';
        }

        return 'assets/img/mod/' + moduleName + '.svg';
    }

    /**
     * Get the section ID a module belongs to.
     *
     * @param moduleId The module ID.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with the section ID.
     */
    async getModuleSectionId(moduleId: number, siteId?: string): Promise<number> {
        // Try to get the section using getModuleBasicInfo.
        const module = await this.getModuleBasicInfo(moduleId, siteId);

        return module.section;
    }

    /**
     * Return a specific section.
     *
     * @param courseId The course ID.
     * @param sectionId The section ID.
     * @param excludeModules Do not return modules, return only the sections structure.
     * @param excludeContents Do not return module contents (i.e: files inside a resource).
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with the section.
     */
    async getSection(
        courseId: number,
        sectionId: number,
        excludeModules?: boolean,
        excludeContents?: boolean,
        siteId?: string,
    ): Promise<CoreCourseSection> {

        if (sectionId < 0) {
            throw new CoreError('Invalid section ID');
        }

        const sections = await this.getSections(courseId, excludeModules, excludeContents, undefined, siteId);
        const section = sections.find((section) => section.id == sectionId);

        if (section) {
            return section;
        }

        throw new CoreError('Unknown section');
    }

    /**
     * Get the course sections.
     *
     * @param courseId The course ID.
     * @param excludeModules Do not return modules, return only the sections structure.
     * @param excludeContents Do not return module contents (i.e: files inside a resource).
     * @param preSets Presets to use.
     * @param siteId Site ID. If not defined, current site.
     * @param includeStealthModules Whether to include stealth modules. Defaults to true.
     * @return The reject contains the error message, else contains the sections.
     */
    async getSections(
        courseId: number,
        excludeModules: boolean = false,
        excludeContents: boolean = false,
        preSets?: CoreSiteWSPreSets,
        siteId?: string,
        includeStealthModules: boolean = true,
    ): Promise<CoreCourseSection[]> {

        const site = await CoreSites.instance.getSite(siteId);
        preSets = preSets || {};
        preSets.cacheKey = this.getSectionsCacheKey(courseId);
        preSets.updateFrequency = preSets.updateFrequency || CoreSite.FREQUENCY_RARELY;

        const params: CoreCourseGetContentsParams = {
            courseid: courseId,
            options: [
                {
                    name: 'excludemodules',
                    value: excludeModules,
                },
                {
                    name: 'excludecontents',
                    value: excludeContents,
                },
            ],
        };
        if (this.canRequestStealthModules(site)) {
            params.options!.push({
                name: 'includestealthmodules',
                value: includeStealthModules,
            });
        }

        let sections: CoreCourseSection[];
        try {
            sections = await site.read('core_course_get_contents', params, preSets);
        } catch {
            // Error getting the data, it could fail because we added a new parameter and the call isn't cached.
            // Retry without the new parameter and forcing cache.
            preSets.omitExpires = true;
            params.options!.splice(-1, 1);
            sections = await site.read('core_course_get_contents', params, preSets);
        }

        const siteHomeId = site.getSiteHomeId();
        let showSections = true;
        if (courseId == siteHomeId) {
            const storedNumSections = site.getStoredConfig('numsections');
            showSections = typeof storedNumSections != 'undefined' && !!storedNumSections;
        }

        if (typeof showSections != 'undefined' && !showSections && sections.length > 0) {
            // Get only the last section (Main menu block section).
            sections.pop();
        }

        return sections;
    }

    /**
     * Get cache key for section WS call.
     *
     * @param courseId Course ID.
     * @return Cache key.
     */
    protected getSectionsCacheKey(courseId: number): string {
        return ROOT_CACHE_KEY + 'sections:' + courseId;
    }

    /**
     * Given a list of sections, returns the list of modules in the sections.
     *
     * @param sections Sections.
     * @return Modules.
     */
    getSectionsModules(sections: CoreCourseSection[]): CoreCourseModuleData[] {
        if (!sections || !sections.length) {
            return [];
        }

        return sections.reduce((previous: CoreCourseModuleData[], section) =>  previous.concat(section.modules || []), []);
    }

    /**
     * Invalidates course blocks WS call.
     *
     * @param courseId Course ID.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when the data is invalidated.
     */
    async invalidateCourseBlocks(courseId: number, siteId?: string): Promise<void> {
        const site = await CoreSites.instance.getSite(siteId);

        await site.invalidateWsCacheForKey(this.getCourseBlocksCacheKey(courseId));
    }

    /**
     * Invalidates module WS call.
     *
     * @param moduleId Module ID.
     * @param siteId Site ID. If not defined, current site.
     * @param modName Module name. E.g. 'label', 'url', ...
     * @return Promise resolved when the data is invalidated.
     */
    async invalidateModule(moduleId: number, siteId?: string, modName?: string): Promise<void> {
        const site = await CoreSites.instance.getSite(siteId);
        const promises: Promise<void>[] = [];
        if (modName) {
            promises.push(site.invalidateWsCacheForKey(this.getModuleByModNameCacheKey(modName)));
        }
        promises.push(site.invalidateWsCacheForKey(this.getModuleCacheKey(moduleId)));

        await Promise.all(promises);
    }

    /**
     * Invalidates module WS call.
     *
     * @param id Instance ID.
     * @param module Name of the module. E.g. 'glossary'.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when the data is invalidated.
     */
    async invalidateModuleByInstance(id: number, module: string, siteId?: string): Promise<void> {
        const site = await CoreSites.instance.getSite(siteId);

        await site.invalidateWsCacheForKey(this.getModuleBasicInfoByInstanceCacheKey(id, module));
    }

    /**
     * Invalidates sections WS call.
     *
     * @param courseId Course ID.
     * @param siteId Site ID. If not defined, current site.
     * @param userId User ID. If not defined, current user.
     * @return Promise resolved when the data is invalidated.
     */
    async invalidateSections(courseId: number, siteId?: string, userId?: number): Promise<void> {
        const site = await CoreSites.instance.getSite(siteId);
        const promises: Promise<void>[] = [];
        const siteHomeId = site.getSiteHomeId();
        userId = userId || site.getUserId();
        promises.push(site.invalidateWsCacheForKey(this.getSectionsCacheKey(courseId)));
        promises.push(site.invalidateWsCacheForKey(this.getActivitiesCompletionCacheKey(courseId, userId)));
        if (courseId == siteHomeId) {
            promises.push(site.invalidateConfig());
        }

        await Promise.all(promises);
    }

    /**
     * Load module contents into module.contents if they aren't loaded already.
     *
     * @param module Module to load the contents.
     * @param courseId The course ID. Recommended to speed up the process and minimize data usage.
     * @param sectionId The section ID.
     * @param preferCache True if shouldn't call WS if data is cached, false otherwise.
     * @param ignoreCache True if it should ignore cached data (it will always fail in offline or server down).
     * @param siteId Site ID. If not defined, current site.
     * @param modName If set, the app will retrieve all modules of this type with a single WS call. This reduces the
     *                number of WS calls, but it isn't recommended for modules that can return a lot of contents.
     * @return Promise resolved when loaded.
     */
    async loadModuleContents(
        module: CoreCourseModuleData & CoreCourseModuleBasicInfo,
        courseId?: number,
        sectionId?: number,
        preferCache?: boolean,
        ignoreCache?: boolean,
        siteId?: string,
        modName?: string,
    ): Promise<void> {

        if (!ignoreCache && module.contents && module.contents.length) {
            // Already loaded.
            return;
        }

        const mod = await this.getModule(module.id, courseId, sectionId, preferCache, ignoreCache, siteId, modName);
        module.contents = mod.contents;
    }

    /**
     * Report a course and section as being viewed.
     *
     * @param courseId Course ID.
     * @param sectionNumber Section number.
     * @param siteId Site ID. If not defined, current site.
     * @param name Name of the course.
     * @return Promise resolved when the WS call is successful.
     * @todo use logHelper. Remove eslint disable when done.
     */
    async logView(courseId: number, sectionNumber?: number, siteId?: string, name?: string): Promise<void> {
        const params: CoreCourseViewCourseWSParams = {
            courseid: courseId,
        };
        const wsName = 'core_course_view_course';

        if (typeof sectionNumber != 'undefined') {
            params.sectionnumber = sectionNumber;
        }

        const site = await CoreSites.instance.getSite(siteId);
        CorePushNotifications.instance.logViewEvent(courseId, name, 'course', wsName, { sectionnumber: sectionNumber }, siteId);
        const response: CoreStatusWithWarningsWSResponse = await site.write(wsName, params);

        if (!response.status) {
            throw Error('WS core_course_view_course failed.');
        } else {
            CoreEvents.trigger(CoreCoursesProvider.EVENT_MY_COURSES_UPDATED, {
                courseId: courseId,
                action: CoreCoursesProvider.ACTION_VIEW,
            }, site.getId());
        }
    }

    /**
     * Offline version for manually marking a module as completed.
     *
     * @param cmId The module ID.
     * @param completed Whether the module is completed or not.
     * @param courseId Course ID the module belongs to.
     * @param courseName Course name. Recommended, it is used to display a better warning message.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when completion is successfully sent or stored.
     */
    async markCompletedManually(
        cmId: number,
        completed: boolean,
        courseId: number,
        courseName?: string,
        siteId?: string,
    ): Promise<CoreStatusWithWarningsWSResponse> {

        siteId = siteId || CoreSites.instance.getCurrentSiteId();

        // Convenience function to store a completion to be synchronized later.
        const storeOffline = (): Promise<CoreStatusWithWarningsWSResponse> =>
            CoreCourseOffline.instance.markCompletedManually(cmId, completed, courseId, courseName, siteId);

        // The offline function requires a courseId and it could be missing because it's a calculated field.
        if (!CoreApp.instance.isOnline() && courseId) {
            // App is offline, store the action.
            return storeOffline();
        }

        // Try to send it to server.
        try {
            const result = await this.markCompletedManuallyOnline(cmId, completed, siteId);

            // Data sent to server, if there is some offline data delete it now.
            try {
                await CoreCourseOffline.instance.deleteManualCompletion(cmId, siteId);
            } catch {
                // Ignore errors, shouldn't happen.
            }

            return result;
        } catch (error) {
            if (CoreUtils.instance.isWebServiceError(error) || !courseId) {
                // The WebService has thrown an error, this means that responses cannot be submitted.
                throw error;
            } else {
                // Couldn't connect to server, store it offline.
                return storeOffline();
            }
        }
    }

    /**
     * Offline version for manually marking a module as completed.
     *
     * @param cmId The module ID.
     * @param completed Whether the module is completed or not.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when completion is successfully sent.
     */
    async markCompletedManuallyOnline(
        cmId: number,
        completed: boolean,
        siteId?: string,
    ): Promise<CoreStatusWithWarningsWSResponse> {
        const site = await CoreSites.instance.getSite(siteId);
        const params: CoreCompletionUpdateActivityCompletionStatusManuallyWSParams = {
            cmid: cmId,
            completed: completed,
        };

        return site.write('core_completion_update_activity_completion_status_manually', params);
    }

    /**
     * Check if a module has a view page. E.g. labels don't have a view page.
     *
     * @param module The module object.
     * @return Whether the module has a view page.
     */
    moduleHasView(module: CoreCourseModuleSummary | CoreCourseModuleData): boolean {
        return !!module.url;
    }

    /**
     * Wait for any course format plugin to load, and open the course page.
     *
     * If the plugin's promise is resolved, the course page will be opened.  If it is rejected, they will see an error.
     * If the promise for the plugin is still in progress when the user tries to open the course, a loader
     * will be displayed until it is complete, before the course page is opened.  If the promise is already complete,
     * they will see the result immediately.
     *
     * This function must be in here instead of course helper to prevent circular dependencies.
     *
     * @param course Course to open
     * @param params Other params to pass to the course page.
     * @return Promise resolved when done.
     */
    async openCourse(
        course: { id: number ; format?: string },
        params?: Params, // eslint-disable-line @typescript-eslint/no-unused-vars
    ): Promise<void> {
        // @todo const loading = await CoreDomUtils.instance.showModalLoading();

        // Wait for site plugins to be fetched.
        // @todo await this.sitePluginsProvider.waitFetchPlugins();

        if (typeof course.format == 'undefined') {
            // This block can be replaced by a call to CourseHelper.getCourse(), but it is circular dependant.
            const coursesProvider = CoreCourses.instance;
            try {
                course = await coursesProvider.getUserCourse(course.id, true);
            } catch (error) {
                // Not enrolled or an error happened. Try to use another WebService.
                const available = coursesProvider.isGetCoursesByFieldAvailableInSite();
                try {
                    if (available) {
                        course = await coursesProvider.getCourseByField('id', course.id);
                    } else {
                        course = await coursesProvider.getCourse(course.id);
                    }
                } catch (error) {
                    // Ignore errors.
                }
            }
        }

        /* @todo
        if (!this.sitePluginsProvider.sitePluginPromiseExists('format_' + course.format)) {
            // No custom format plugin. We don't need to wait for anything.
            await this.courseFormatDelegate.openCourse(course, params);
            loading.dismiss();

            return;
        } */

        // This course uses a custom format plugin, wait for the format plugin to finish loading.
        try {
            /* @todo await this.sitePluginsProvider.sitePluginLoaded('format_' + course.format);
            // The format loaded successfully, but the handlers wont be registered until all site plugins have loaded.
            if (this.sitePluginsProvider.sitePluginsFinishedLoading) {
                return this.courseFormatDelegate.openCourse(course, params);
            }*/

            // Wait for plugins to be loaded.
            const deferred = CoreUtils.instance.promiseDefer<void>();

            const observer = CoreEvents.on(CoreEvents.SITE_PLUGINS_LOADED, () => {
                observer && observer.off();

                /* @todo this.courseFormatDelegate.openCourse(course, params).then((response) => {
                    deferred.resolve(response);
                }).catch((error) => {
                    deferred.reject(error);
                });*/
            });

            return deferred.promise;
        } catch (error) {
            // The site plugin failed to load. The user needs to restart the app to try loading it again.
            const message = Translate.instance.instant('core.courses.errorloadplugins');
            const reload = Translate.instance.instant('core.courses.reload');
            const ignore = Translate.instance.instant('core.courses.ignore');

            await CoreDomUtils.instance.showConfirm(message, '', reload, ignore);
            window.location.reload();
        }
    }

    /**
     * Select a certain tab in the course. Please use currentViewIsCourse() first to verify user is viewing the course.
     *
     * @param name Name of the tab. If not provided, course contents.
     * @param params Other params.
     */
    selectCourseTab(name?: string, params?: Params): void {
        params = params || {};
        params.name = name || '';

        CoreEvents.trigger(CoreEvents.SELECT_COURSE_TAB, params);
    }

    /**
     * Change the course status, setting it to the previous status.
     *
     * @param courseId Course ID.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when the status is changed. Resolve param: new status.
     */
    async setCoursePreviousStatus(courseId: number, siteId?: string): Promise<string> {
        siteId = siteId || CoreSites.instance.getCurrentSiteId();

        this.logger.debug(`Set previous status for course ${courseId} in site ${siteId}`);

        const site = await CoreSites.instance.getSite(siteId);
        const db = site.getDb();
        const entry = await this.getCourseStatusData(courseId, siteId);

        this.logger.debug(`Set previous status '${entry.status}' for course ${courseId}`);

        const newData = {
            id: courseId,
            status: entry.previous || CoreConstants.NOT_DOWNLOADED,
            updated: Date.now(),
            // Going back from downloading to previous status, restore previous download time.
            downloadTime: entry.status == CoreConstants.DOWNLOADING ? entry.previousDownloadTime : entry.downloadTime,
        };

        await db.updateRecords(COURSE_STATUS_TABLE, newData, { id: courseId });
        // Success updating, trigger event.
        this.triggerCourseStatusChanged(courseId, newData.status, siteId);

        return newData.status;
    }

    /**
     * Store course status.
     *
     * @param courseId Course ID.
     * @param status New course status.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when the status is stored.
     */
    async setCourseStatus(courseId: number, status: string, siteId?: string): Promise<void> {
        siteId = siteId || CoreSites.instance.getCurrentSiteId();

        this.logger.debug(`Set status '${status}' for course ${courseId} in site ${siteId}`);

        const site = await CoreSites.instance.getSite(siteId);
        let downloadTime = 0;
        let previousDownloadTime = 0;
        let previousStatus = '';

        if (status == CoreConstants.DOWNLOADING) {
            // Set download time if course is now downloading.
            downloadTime = CoreTimeUtils.instance.timestamp();
        }

        try {
            const entry = await this.getCourseStatusData(courseId, siteId);
            if (typeof downloadTime == 'undefined') {
                // Keep previous download time.
                downloadTime = entry.downloadTime;
                previousDownloadTime = entry.previousDownloadTime;
            } else {
                // The downloadTime will be updated, store current time as previous.
                previousDownloadTime = entry.downloadTime;
            }
            previousStatus = entry.status;
        } catch {
            // New entry.
        }

        if (previousStatus != status) {
            // Status has changed, update it.
            const data: CoreCourseStatusDBRecord = {
                id: courseId,
                status: status,
                previous: previousStatus,
                updated: new Date().getTime(),
                downloadTime: downloadTime,
                previousDownloadTime: previousDownloadTime,
            };

            await site.getDb().insertRecord(COURSE_STATUS_TABLE, data);
        }

        // Success inserting, trigger event.
        this.triggerCourseStatusChanged(courseId, status, siteId);
    }

    /**
     * Translate a module name to current language.
     *
     * @param moduleName The module name.
     * @return Translated name.
     */
    translateModuleName(moduleName: string): string {
        if (this.CORE_MODULES.indexOf(moduleName) < 0) {
            moduleName = 'external-tool';
        }

        const langKey = 'core.mod_' + moduleName;
        const translated = Translate.instance.instant(langKey);

        return translated !== langKey ? translated : moduleName;
    }

    /**
     * Trigger COURSE_STATUS_CHANGED with the right data.
     *
     * @param courseId Course ID.
     * @param status New course status.
     * @param siteId Site ID. If not defined, current site.
     */
    protected triggerCourseStatusChanged(courseId: number, status: string, siteId?: string): void {
        CoreEvents.trigger(CoreEvents.COURSE_STATUS_CHANGED, {
            courseId: courseId,
            status: status,
        }, siteId);
    }

}

/**
 * Common options used by modules when calling a WS through CoreSite.
 */
export type CoreCourseCommonModWSOptions = CoreSitesCommonWSOptions & {
    cmId?: number; // Module ID.
};

/**
 * Data returned by course_summary_exporter.
 */
export type CoreCourseSummary = {
    id: number; // Id.
    fullname: string; // Fullname.
    shortname: string; // Shortname.
    idnumber: string; // Idnumber.
    summary: string; // @since 3.3. Summary.
    summaryformat: number; // @since 3.3. Summary format (1 = HTML, 0 = MOODLE, 2 = PLAIN or 4 = MARKDOWN).
    startdate: number; // @since 3.3. Startdate.
    enddate: number; // @since 3.3. Enddate.
    visible: boolean; // @since 3.8. Visible.
    fullnamedisplay: string; // @since 3.3. Fullnamedisplay.
    viewurl: string; // Viewurl.
    courseimage: string; // @since 3.6. Courseimage.
    progress?: number; // @since 3.6. Progress.
    hasprogress: boolean; // @since 3.6. Hasprogress.
    isfavourite: boolean; // @since 3.6. Isfavourite.
    hidden: boolean; // @since 3.6. Hidden.
    timeaccess?: number; // @since 3.6. Timeaccess.
    showshortname: boolean; // @since 3.6. Showshortname.
    coursecategory: string; // @since 3.7. Coursecategory.
};

/**
 * Data returned by course_module_summary_exporter.
 */
export type CoreCourseModuleSummary = {
    id: number; // Id.
    name: string; // Name.
    url?: string; // Url.
    iconurl: string; // Iconurl.
};

/**
 * Params of core_completion_get_activities_completion_status WS.
 */
type CoreCompletionGetActivitiesCompletionStatusWSParams = {
    courseid: number; // Course ID.
    userid: number; // User ID.
};

/**
 * Data returned by core_completion_get_activities_completion_status WS.
 */
export type CoreCourseCompletionActivityStatusWSResponse = {
    statuses: CoreCourseCompletionActivityStatus[]; // List of activities status.
    warnings?: CoreStatusWithWarningsWSResponse[];
};

/**
 * Activity status.
 */
export type CoreCourseCompletionActivityStatus = {
    cmid: number; // Comment ID.
    modname: string; // Activity module name.
    instance: number; // Instance ID.
    state: number; // Completion state value: 0 means incomplete, 1 complete, 2 complete pass, 3 complete fail.
    timecompleted: number; // Timestamp for completed activity.
    tracking: number; // Type of tracking: 0 means none, 1 manual, 2 automatic.
    overrideby?: number; // The user id who has overriden the status, or null.
    valueused?: boolean; // Whether the completion status affects the availability of another activity.
    offline?: boolean; // Whether the completions is offline and not yet synced.
};

/**
 * Params of core_block_get_course_blocks WS.
 */
type CoreBlockGetCourseBlocksWSParams = {
    courseid: number; // Course id.
    returncontents?: boolean; // Whether to return the block contents.
};

/**
 * Data returned by core_block_get_course_blocks WS.
 */
export type CoreCourseBlocksWSResponse = {
    blocks: CoreCourseBlock[]; // List of blocks in the course.
    warnings?: CoreStatusWithWarningsWSResponse[];
};

/**
 * Block data type.
 */
export type CoreCourseBlock = {
    instanceid: number; // Block instance id.
    name: string; // Block name.
    region: string; // Block region.
    positionid: number; // Position id.
    collapsible: boolean; // Whether the block is collapsible.
    dockable: boolean; // Whether the block is dockable.
    weight?: number; // Used to order blocks within a region.
    visible?: boolean; // Whether the block is visible.
    contents?: {
        title: string; // Block title.
        content: string; // Block contents.
        contentformat: number; // Content format (1 = HTML, 0 = MOODLE, 2 = PLAIN or 4 = MARKDOWN).
        footer: string; // Block footer.
        files: CoreWSExternalFile[];
    }; // Block contents (if required).
    configs?: { // Block instance and plugin configuration settings.
        name: string; // Name.
        value: string; // JSON encoded representation of the config value.
        type: string; // Type (instance or plugin).
    }[];
    configsRecord?: Record<string, { // Block instance and plugin configuration settings.
        name: string; // Name.
        value: string; // JSON encoded representation of the config value.
        type: string; // Type (instance or plugin).
    }>;
};

/**
 * Params of core_course_get_contents WS.
 */
export type CoreCourseGetContentsParams = {
    courseid: number; // Course id.
    options?: { // Options, used since Moodle 2.9.
        /**
         * The expected keys (value format) are:
         *
         * excludemodules (bool) Do not return modules, return only the sections structure
         * excludecontents (bool) Do not return module contents (i.e: files inside a resource)
         * includestealthmodules (bool) Return stealth modules for students in a special
         * section (with id -1)
         * sectionid (int) Return only this section
         * sectionnumber (int) Return only this section with number (order)
         * cmid (int) Return only this module information (among the whole sections structure)
         * modname (string) Return only modules with this name "label, forum, etc..."
         * modid (int) Return only the module with this id (to be used with modname.
         */
        name: string;
        value: string | number | boolean; // The value of the option, this param is personaly validated in the external function.
    }[];
};

/**
 * Data returned by core_course_get_contents WS.
 */
export type CoreCourseSection = {
    id: number; // Section ID.
    name: string; // Section name.
    visible?: number; // Is the section visible.
    summary: string; // Section description.
    summaryformat: number; // Summary format (1 = HTML, 0 = MOODLE, 2 = PLAIN or 4 = MARKDOWN).
    section?: number; // Section number inside the course.
    hiddenbynumsections?: number; // Whether is a section hidden in the course format.
    uservisible?: boolean; // Is the section visible for the user?.
    availabilityinfo?: string; // Availability information.
    modules: CoreCourseModuleData[];
};

/**
 * Params of core_course_get_course_module WS.
 */
type CoreCourseGetCourseModuleWSParams = {
    cmid: number; // The course module id.
};

/**
 * Params of core_course_get_course_module_by_instance WS.
 */
type CoreCourseGetCourseModuleByInstanceWSParams = {
    module: string; // The module name.
    instance: number; // The module instance id.
};

/**
 * Data returned by core_course_get_course_module and core_course_get_course_module_by_instance WS.
 */
export type CoreCourseGetCourseModuleWSResponse = {
    cm: CoreCourseModuleBasicInfo;
    warnings?: CoreStatusWithWarningsWSResponse[];
};

/**
 * Course module type.
 */
export type CoreCourseModuleData = { // List of module.
    id: number; // Activity id.
    course?: number; // The course id.
    url?: string; // Activity url.
    name: string; // Activity module name.
    instance?: number; // Instance id.
    contextid?: number; // Activity context id.
    description?: string; // Activity description.
    visible?: number; // Is the module visible.
    uservisible?: boolean; // Is the module visible for the user?.
    availabilityinfo?: string; // Availability information.
    visibleoncoursepage?: number; // Is the module visible on course page.
    modicon: string; // Activity icon url.
    modname: string; // Activity module type.
    modplural: string; // Activity module plural name.
    availability?: string; // Module availability settings.
    indent: number; // Number of identation in the site.
    onclick?: string; // Onclick action.
    afterlink?: string; // After link info to be displayed.
    customdata?: string; // Custom data (JSON encoded).
    noviewlink?: boolean; // Whether the module has no view page.
    completion?: number; // Type of completion tracking: 0 means none, 1 manual, 2 automatic.
    completiondata?: { // Module completion data.
        state: number; // Completion state value: 0 means incomplete, 1 complete, 2 complete pass, 3 complete fail.
        timecompleted: number; // Timestamp for completion status.
        overrideby: number; // The user id who has overriden the status.
        valueused?: boolean; // Whether the completion status affects the availability of another activity.
    };
    contents: CoreCourseModuleContentFile[];
    contentsinfo?: { // Contents summary information.
        filescount: number; // Total number of files.
        filessize: number; // Total files size.
        lastmodified: number; // Last time files were modified.
        mimetypes: string[]; // Files mime types.
        repositorytype?: string; // The repository type for the main file.
    };
};

export type CoreCourseModuleContentFile = {
    type: string; // A file or a folder or external link.
    filename: string; // Filename.
    filepath: string; // Filepath.
    filesize: number; // Filesize.
    fileurl?: string; // Downloadable file url.
    url?: string; // @deprecated. Use fileurl instead.
    content?: string; // Raw content, will be used when type is content.
    timecreated: number; // Time created.
    timemodified: number; // Time modified.
    sortorder: number; // Content sort order.
    mimetype?: string; // File mime type.
    isexternalfile?: boolean; // Whether is an external file.
    repositorytype?: string; // The repository type for external files.
    userid: number; // User who added this content to moodle.
    author: string; // Content owner.
    license: string; // Content license.
    tags?: { // Tags.
        id: number; // Tag id.
        name: string; // Tag name.
        rawname: string; // The raw, unnormalised name for the tag as entered by users.
        isstandard: boolean; // Whether this tag is standard.
        tagcollid: number; // Tag collection id.
        taginstanceid: number; // Tag instance id.
        taginstancecontextid: number; // Context the tag instance belongs to.
        itemid: number; // Id of the record tagged.
        ordering: number; // Tag ordering.
        flag: number; // Whether the tag is flagged as inappropriate.
    }[];
};

/**
 * Course module basic info type.
 */
export type CoreCourseModuleGradeInfo = {
    grade?: number; // Grade (max value or scale id).
    scale?: string; // Scale items (if used).
    gradepass?: string; // Grade to pass (float).
    gradecat?: number; // Grade category.
    advancedgrading?: { // Advanced grading settings.
        area: string; // Gradable area name.
        method: string; // Grading method.
    }[];
    outcomes?: { // Outcomes information.
        id: string; // Outcome id.
        name: string; // Outcome full name.
        scale: string; // Scale items.
    }[];
};

/**
 * Course module basic info type.
 */
export type CoreCourseModuleBasicInfo = CoreCourseModuleGradeInfo & {
    id: number; // The course module id.
    course: number; // The course id.
    module: number; // The module type id.
    name: string; // The activity name.
    modname: string; // The module component name (forum, assign, etc..).
    instance: number; // The activity instance id.
    section: number; // The module section id.
    sectionnum: number; // The module section number.
    groupmode: number; // Group mode.
    groupingid: number; // Grouping id.
    completion: number; // If completion is enabled.
    idnumber?: string; // Module id number.
    added?: number; // Time added.
    score?: number; // Score.
    indent?: number; // Indentation.
    visible?: number; // If visible.
    visibleoncoursepage?: number; // If visible on course page.
    visibleold?: number; // Visible old.
    completiongradeitemnumber?: number; // Completion grade item.
    completionview?: number; // Completion view setting.
    completionexpected?: number; // Completion time expected.
    showdescription?: number; // If the description is showed.
    availability?: string; // Availability settings.
};

/**
 * Params of core_course_view_course WS.
 */
type CoreCourseViewCourseWSParams = {
    courseid: number; // Id of the course.
    sectionnumber?: number; // Section number.
};

/**
 * Params of core_completion_update_activity_completion_status_manually WS.
 */
type CoreCompletionUpdateActivityCompletionStatusManuallyWSParams = {
    cmid: number; // Course module id.
    completed: boolean; // Activity completed or not.
};

export class CoreCourse extends makeSingleton(CoreCourseProvider) {}
