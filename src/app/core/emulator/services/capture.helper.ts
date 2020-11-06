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

import { CoreCanceledError } from '@/app/classes/errors/cancelederror';
import { Injectable } from '@angular/core';
import { CameraOptions } from '@ionic-native/camera/ngx';
import { CaptureAudioOptions, CaptureImageOptions, CaptureVideoOptions, MediaFile } from '@ionic-native/media-capture/ngx';

import { CoreMimetypeUtils } from '@services/utils/mimetype';
import { makeSingleton, ModalController } from '@singletons/core.singletons';
import { CaptureMediaComponentInputs, CoreEmulatorCaptureMediaComponent } from '../components/capture-media/capture-media';

/**
 * Helper service with some features to capture media (image, audio, video).
 */
@Injectable()
export class CoreEmulatorCaptureHelperProvider {

    protected possibleAudioMimeTypes = {
        'audio/webm': 'weba',
        'audio/ogg': 'ogg',
    };

    protected possibleVideoMimeTypes = {
        'video/webm;codecs=vp9': 'webm',
        'video/webm;codecs=vp8': 'webm',
        'video/ogg': 'ogv',
    };

    videoMimeType?: string;
    audioMimeType?: string;

    /**
     * Capture media (image, audio, video).
     *
     * @param type Type of media: image, audio, video.
     * @param options Optional options.
     * @return Promise resolved when captured, rejected if error.
     */
    captureMedia(type: 'image', options?: MockCameraOptions): Promise<string>;
    captureMedia(type: 'captureimage', options?: MockCaptureImageOptions): Promise<MediaFile[]>;
    captureMedia(type: 'audio', options?: MockCaptureAudioOptions): Promise<MediaFile[]>;
    captureMedia(type: 'video', options?: MockCaptureVideoOptions): Promise<MediaFile[]>;
    async captureMedia(
        type: 'image' | 'captureimage' | 'audio' | 'video',
        options?: MockCameraOptions | MockCaptureImageOptions | MockCaptureAudioOptions | MockCaptureVideoOptions,
    ): Promise<MediaFile[] | string> {
        options = options || {};

        // Build the params to send to the modal.
        const params: CaptureMediaComponentInputs = {
            type: type,
        };

        // Initialize some data based on the type of media to capture.
        if (type == 'video') {
            const mimeAndExt = this.getMimeTypeAndExtension(type, options.mimetypes);
            params.mimetype = mimeAndExt.mimetype;
            params.extension = mimeAndExt.extension;
        } else if (type == 'audio') {
            const mimeAndExt = this.getMimeTypeAndExtension(type, options.mimetypes);
            params.mimetype = mimeAndExt.mimetype;
            params.extension = mimeAndExt.extension;
        } else if (type == 'image') {
            if ('sourceType' in options && options.sourceType !== undefined && options.sourceType != 1) {
                return Promise.reject('This source type is not supported in browser.');
            }

            if ('cameraDirection' in options && options.cameraDirection == 1) {
                params.facingMode = 'user';
            }

            if ('encodingType' in options && options.encodingType == 1) {
                params.mimetype = 'image/png';
                params.extension = 'png';
            } else {
                params.mimetype = 'image/jpeg';
                params.extension = 'jpeg';
            }

            if ('quality' in options && options.quality !== undefined && options.quality >= 0 && options.quality <= 100) {
                params.quality = options.quality / 100;
            }

            if ('destinationType' in options && options.destinationType == 0) {
                params.returnDataUrl = true;
            }
        }

        if ('duration' in options && options.duration) {
            params.maxTime = options.duration * 1000;
        }

        const modal = await ModalController.instance.create({
            component: CoreEmulatorCaptureMediaComponent,
            cssClass: 'core-modal-fullscreen',
            componentProps: params,
        });

        modal.present();

        const result = await modal.onDidDismiss();

        if (result.role == 'success') {
            return result.data;
        } else {
            throw result.data;
        }
    }

    /**
     * Get the mimetype and extension to capture media.
     *
     * @param type Type of media: image, audio, video.
     * @param mimetypes List of supported mimetypes. If undefined, all mimetypes supported.
     * @return An object with mimetype and extension to use.
     */
    protected getMimeTypeAndExtension(type: string, mimetypes?: string[]): { extension?: string; mimetype?: string } {
        const result: { extension?: string; mimetype?: string } = {};

        if (mimetypes?.length) {
            // Search for a supported mimetype.
            for (let i = 0; i < mimetypes.length; i++) {
                const mimetype = mimetypes[i];
                const matches = mimetype.match(new RegExp('^' + type + '/'));

                if (matches?.length && window.MediaRecorder.isTypeSupported(mimetype)) {
                    result.mimetype = mimetype;
                    break;
                }
            }
        }

        if (result.mimetype) {
            // Found a supported mimetype in the mimetypes array, get the extension.
            result.extension = CoreMimetypeUtils.instance.getExtension(result.mimetype);
        } else if (type == 'video') {
            // No mimetype found, use default extension.
            result.mimetype = this.videoMimeType;
            result.extension = this.possibleVideoMimeTypes[result.mimetype!];
        } else if (type == 'audio') {
            // No mimetype found, use default extension.
            result.mimetype = this.audioMimeType;
            result.extension = this.possibleAudioMimeTypes[result.mimetype!];
        }

        return result;
    }

    /**
     * Init the getUserMedia function, using a deprecated function as fallback if the new one doesn't exist.
     *
     * @return Whether the function is supported.
     */
    protected initGetUserMedia(): boolean {
        return !!navigator.mediaDevices.getUserMedia;
    }

    /**
     * Initialize the mimetypes to use when capturing.
     */
    protected initMimeTypes(): void {
        // Determine video and audio mimetype to use.
        for (const mimeType in this.possibleVideoMimeTypes) {
            if (window.MediaRecorder.isTypeSupported(mimeType)) {
                this.videoMimeType = mimeType;
                break;
            }
        }

        for (const mimeType in this.possibleAudioMimeTypes) {
            if (window.MediaRecorder.isTypeSupported(mimeType)) {
                this.audioMimeType = mimeType;
                break;
            }
        }
    }

    /**
     * Load the Mocks that need it.
     *
     * @return Promise resolved when loaded.
     */
    load(): Promise<void> {
        if (typeof window.MediaRecorder != 'undefined' && this.initGetUserMedia()) {
            this.initMimeTypes();
        }

        return Promise.resolve();
    }

}

export class CoreEmulatorCaptureHelper extends makeSingleton(CoreEmulatorCaptureHelperProvider) {}

export interface MockCameraOptions extends CameraOptions {
    mimetypes?: string[]; // Allowed mimetypes.
}
export interface MockCaptureImageOptions extends CaptureImageOptions {
    mimetypes?: string[]; // Allowed mimetypes.
}
export interface MockCaptureAudioOptions extends CaptureAudioOptions {
    mimetypes?: string[]; // Allowed mimetypes.
}
export interface MockCaptureVideoOptions extends CaptureVideoOptions {
    mimetypes?: string[]; // Allowed mimetypes.
}
