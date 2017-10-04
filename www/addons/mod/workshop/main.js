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

angular.module('mm.addons.mod_workshop', ['mm.core'])

.constant('mmaModWorkshopComponent', 'mmaModWorkshop')
.constant('mmaModWorkshopSubmissionChangedEvent', 'mma-mod_workshop_submission_changed')
.constant('mmaModWorkshopPerPage', 10)

.config(function($stateProvider) {

    $stateProvider

    .state('site.mod_workshop', {
        url: '/mod_workshop',
        params: {
            module: null,
            moduleid: null, // Redundant parameter to fix a problem passing object as parameters. To be fixed in MOBILE-1370.
            courseid: null,
            group: null
        },
        views: {
            'site': {
                controller: 'mmaModWorkshopIndexCtrl',
                templateUrl: 'addons/mod/workshop/templates/index.html'
            }
        }
    })

    .state('site.mod_workshop-submission', {
        url: '/mod_workshop-submission',
        params: {
            module: null,
            access: null,
            courseid: null,
            profile: null,
            submission: null,
            submissionid: null // Redundant parameter to fix a problem passing object as parameters. To be fixed in MOBILE-1370.
        },
        views: {
            'site': {
                controller: 'mmaModWorkshopSubmissionCtrl',
                templateUrl: 'addons/mod/workshop/templates/viewsubmission.html'
            }
        }
    })

    .state('site.mod_workshop-edit-submission', {
        url: '/mod_workshop-edit-submission',
        params: {
            module: null,
            access: null,
            courseid: null,
            submission: null,
            submissionid: null // Redundant parameter to fix a problem passing object as parameters. To be fixed in MOBILE-1370.
        },
        views: {
            'site': {
                controller: 'mmaModWorkshopEditSubmissionCtrl',
                templateUrl: 'addons/mod/workshop/templates/editsubmission.html'
            }
        }
    });
})

.config(function($mmCourseDelegateProvider, $mmContentLinksDelegateProvider, $mmCoursePrefetchDelegateProvider) {
    $mmCourseDelegateProvider.registerContentHandler('mmaModWorkshop', 'workshop', '$mmaModWorkshopHandlers.courseContent');
    $mmCoursePrefetchDelegateProvider.registerPrefetchHandler('mmaModWorkshop', 'workshop', '$mmaModWorkshopPrefetchHandler');
    $mmContentLinksDelegateProvider.registerLinkHandler('mmaModWorkshop:index', '$mmaModWorkshopHandlers.indexLinksHandler');
});
