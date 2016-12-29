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

angular.module('mm.addons.mod_page')

/**
 * Page index controller.
 *
 * @module mm.addons.mod_page
 * @ngdoc controller
 * @name mmaModPageIndexCtrl
 */
.controller('mmaModPageIndexCtrl', function($scope, $stateParams, $translate, $mmUtil, $mmaModPage, $mmCourse, $q, $log, $mmApp,
            mmaModPageComponent, $mmText, $mmaModPagePrefetchHandler, $mmCourseHelper, $mmCoursePrefetchDelegate) {
    $log = $log.getInstance('mmaModPageIndexCtrl');

    var module = $stateParams.module || {},
        courseId = $stateParams.courseid;

    $scope.title = module.name;
    $scope.description = module.description;
    $scope.component = mmaModPageComponent;
    $scope.componentId = module.id;
    $scope.externalUrl = module.url;
    $scope.loaded = false;
    $scope.refreshIcon = 'spinner';

    function fetchContent() {
        // Load module contents if needed.
        return $mmCourse.loadModuleContents(module, courseId).then(function() {
            var downloadFailed = false;
            // Prefetch the content so ALL files are downloaded, not just the ones shown in the page.
            return $mmaModPagePrefetchHandler.download(module).catch(function() {
                // Mark download as failed but go on since the main files could have been downloaded.
                downloadFailed = true;
            }).then(function() {
                return $mmaModPage.getPageHtml(module.contents, module.id).then(function(content) {
                    $scope.content = content;

                    if (downloadFailed && $mmApp.isOnline()) {
                        // We could load the main file but the download failed. Show error message.
                        $mmUtil.showErrorModal('mm.core.errordownloadingsomefiles', true);
                    }
                });
            });
        }).catch(function() {
            $mmUtil.showErrorModal('mma.mod_page.errorwhileloadingthepage', true);
            return $q.reject();
        }).finally(function() {
            $scope.loaded = true;
            $scope.refreshIcon = 'ion-refresh';
            fillContextMenu(module, courseId);
        });
    }

    // Function to fill Context Menu
    function fillContextMenu(module, courseId, invalidateCache) {
        $mmCourseHelper.getModulePrefetchInfo(module, courseId, invalidateCache).then(function(moduleInfo) {
            $scope.size = moduleInfo.size > 0 ? moduleInfo.sizeReadable : 0;
            $scope.prefetchStatusIcon = moduleInfo.statusIcon;
            $scope.timemodified = moduleInfo.timemodified > 0 ? $translate.instant('mm.core.lastmodified') + ': ' + moduleInfo.timemodifiedReadable : "";
        });
    }

    $scope.removeFiles = function() {
        $mmCourseHelper.confirmAndRemove(module, courseId);
    };

    // Context Menu Prefetch action.
    $scope.prefetch = function() {
        var icon = $scope.prefetchStatusIcon;

        $scope.prefetchStatusIcon = 'spinner'; // Show spinner since this operation might take a while.

        // We need to call getDownloadSize, the package might have been updated.
        $mmCoursePrefetchDelegate.getModuleDownloadSize(module, courseId).then(function(size) {
            $mmUtil.confirmDownloadSize(size).then(function() {
                $mmCoursePrefetchDelegate.prefetchModule(module, courseId).catch(function() {
                    if (!$scope.$$destroyed) {
                        $mmUtil.showErrorModal('mm.core.errordownloading', true);
                    }
                });
            }).catch(function() {
                // User hasn't confirmed, stop spinner.
                $scope.prefetchStatusIcon = icon;
            });
        }).catch(function(error) {
            $scope.prefetchStatusIcon = icon;
            if (error) {
                $mmUtil.showErrorModal(error);
            } else {
                $mmUtil.showErrorModal('mm.core.errordownloading', true);
            }
        });
    };

    // Context Menu Description action.
    $scope.expandDescription = function() {
        $mmText.expandText($translate.instant('mm.core.description'), $scope.description, false, mmaModPageComponent, module.id);
    };

    $scope.doRefresh = function() {
        if ($scope.loaded) {
            $scope.refreshIcon = 'spinner';
            return $mmaModPagePrefetchHandler.invalidateContent(module.id).then(function() {
                return fetchContent();
            }).finally(function() {
                $scope.$broadcast('scroll.refreshComplete');
            });
        }
    };

    fetchContent().then(function() {
        $mmaModPage.logView(module.instance).then(function() {
            $mmCourse.checkModuleCompletion(courseId, module.completionstatus);
        });
    });
});
