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

angular.module('mm.addons.mod_data')

/**
 * Directive to render data picture field.
 *
 * @module mm.addons.mod_data
 * @ngdoc directive
 * @name mmaModDataFieldPicture
 */
.directive('mmaModDataFieldPicture', function(mmaModDataComponent, $mmFileSession) {
    return {
        restrict: 'A',
        priority: 100,
        templateUrl: 'addons/mod/data/fields/picture/template.html',
        link: function(scope) {
            if (scope.mode != 'search') {
                var files = angular.copy(scope.value && scope.value.files) || [];

                scope.component = mmaModDataComponent;
                scope.componentId = scope.database.coursemodule;
                scope.image = false;

                // Get image or thumb.
                if (files.length > 0) {
                    var filenameSeek = scope.mode == 'list' ? 'thumb_' + scope.value.content : scope.value.content;
                    for (var x in files) {
                        if (files[x].filename == filenameSeek) {
                            scope.image = angular.copy(files[x]);
                            break;
                        }
                    }
                    scope.files = [scope.image];
                } else {
                    scope.files = [];
                }

                if (scope.mode == 'edit') {
                    scope.maxSizeBytes = parseInt(scope.field.param3, 10);
                    $mmFileSession.setFiles(mmaModDataComponent, scope.database.id + '_' + scope.field.id, scope.files);
                    scope.alttext = (scope.value && scope.value.content1) || "";
                } else {
                    scope.entryId = (scope.value && scope.value.recordid) || false;
                    scope.title = (scope.value && scope.value.content1) || "";
                    scope.imageUrl = (scope.image && scope.image.fileurl) || false;
                    scope.width  = scope.field.param1 || "";
                    scope.height = scope.field.param2 || "";
                }
            }
        }
    };
});
