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

import { ApplicationRef } from '@angular/core';
import { CoreApp, CoreAppProvider } from '@services/app';
import { CoreCron, CoreCronDelegate } from '@services/cron';
import { Application } from '@singletons';

type AutomatedTestsWindow = Window & {
    appRef?: ApplicationRef;
    appProvider?: CoreAppProvider;
    cronProvider?: CoreCronDelegate;
};

function initializeAutomatedTestsWindow(window: AutomatedTestsWindow) {
    window.appRef = Application.instance;
    window.appProvider = CoreApp.instance;
    window.cronProvider = CoreCron.instance;
}

export default function(): void {
    if (!CoreAppProvider.isAutomated()) {
        return;
    }

    initializeAutomatedTestsWindow(window);
}
