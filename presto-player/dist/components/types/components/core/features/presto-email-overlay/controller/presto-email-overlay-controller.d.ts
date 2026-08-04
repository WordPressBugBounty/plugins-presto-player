import { EventEmitter } from '../../../../../stencil-public-runtime';
import { i18nConfig, EmailCollection } from '../../../../../interfaces';
export declare class PrestoEmailOverlayController {
    ended: boolean;
    currentTime: number;
    duration: number;
    direction?: 'rtl';
    emailCollection?: EmailCollection;
    i18n: i18nConfig;
    videoId: number;
    presetId: number;
    provider: string;
    enabled: boolean;
    show: boolean;
    loading: boolean;
    error: string;
    percentagePassed: number;
    playVideo: EventEmitter<void>;
    pauseVideo: EventEmitter<true>;
    restartVideo: EventEmitter<void>;
    emailStateChange: EventEmitter<boolean>;
    /**
     * Set email collection in local storage
     * @param status string
     */
    setStorage(status: any): void;
    /**
     * Get email collection in local storage
     * @returns status string
     */
    getStorage(): string;
    componentWillLoad(): void;
    /**
     * Wait for duration to start before checking time
     * @returns void
     */
    handleDuration(): void;
    /**
     * When current time changes, check to see if we should
     * enable the overlay
     * @returns void
     */
    handleTimeCheck(): void;
    handleShowChange(): void;
    /**
     * Set enabled/disabled based on time that has passed
     */
    checkTime(): void;
    /**
     * Post the submission to the email collection handler
     * @param e Event
     * @param nonce string
     * @returns Response
     */
    post(e: any, nonce: any): Promise<Response>;
    /**
     * Get a fresh nonce.
     *
     * The nonce we send is baked into the page markup, so a full page cache that
     * outlives it hands every visitor a dead one. This endpoint is open to logged
     * out visitors and always registered, even when analytics is off.
     * @returns string
     */
    refreshNonce(): Promise<string>;
    /**
     * Pull a message out of an error payload.
     *
     * Validation failures come back as an array of messages, everything else as a
     * plain string, so this can't just index into it.
     * @param data any
     * @returns string
     */
    getErrorMessage(data: any): string;
    /**
     * Submit email collection
     * @param e Event
     */
    submit(e: any): Promise<void>;
    /**
     * Skip email collection
     */
    skip(): void;
    /**
     * Maybe render
     * @returns JSX
     */
    handleEmailStateChange(val: any): void;
    render(): any;
}
