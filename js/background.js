const timeInSeconds = () => {
    return Math.floor(Date.now() / 1000);
}

/**
 * This class manages the state of the extension, including debug mode,
 * muted tabs, hidden players, playing ads, and start times.
 */
class ExtensionState {
    /**
     * A Boolean indicating that the Extension has been initialized.
     */
    initialized = false;

    constructor() {
        this._debugMode = false;
        this._mutedTabs = new Map();
        this._hiddenPlayers = new Map();
        this._playingAds = new Map();
        this._startTime = new Map();
    }

    /**
     * Initializes the extension state by retrieving stored values or using defaults.
     * @returns {Promise<void>}
     */
    async initialize() {
        // retrieve stored values or return defaults
        this._debugMode = (await this._get({debugMode: this._debugMode})).debugMode;
        this._mutedTabs = (await this._get({mutedTabs: this._mutedTabs})).mutedTabs;
        this._hiddenPlayers = (await this._get({hiddenPlayers: this._hiddenPlayers})).hiddenPlayers;
        this._playingAds = (await this._get({playingAds: this._playingAds})).playingAds;
        this._startTime = (await this._get({startTime: this._startTime})).startTime;
        this.logger = new BackgroundLogger({debugMode: this._debugMode});
        console.debug("ExtensionState initialized with debug mode: ", this._debugMode);
        this.initialized = true;
    }

    /**
     * Retrieves a value from session storage with a default if not found.
     * @param {Object} defaultValue - The default value to return if not found in storage.
     * @returns {Promise<Object>}
     */
    async _get(defaultValue) {
        return await browser.storage.session.get(defaultValue);
    }

    /**
     * Sets a value in session storage.
     * @param {Object} value - The value to set in storage.
     * @returns {Promise<void>}
     */
    async _set(value) {
        await browser.storage.session.set(value);
    }

    /**
     * Checks if debug mode is enabled.
     * @returns {boolean}
     */
    isDebug() {
        return this._debugMode;
    }

    /**
     * Checks if a tab is muted.
     * @param {number} tabId - The ID of the tab to check.
     * @returns {boolean}
     */
    isMuted(tabId) {
        return this._mutedTabs.get(tabId) || false;
    }

    /**
     * Checks if a player in a tab is hidden.
     * @param {number} tabId - The ID of the tab to check.
     * @returns {boolean}
     */
    isHidden(tabId) {
        return this._hiddenPlayers.get(tabId) || false;
    }

    /**
     * Checks if ads are playing in a tab and have been detected.
     * @param {number} tabId - The ID of the tab to check.
     * @returns {boolean}
     */
    isPlayingAds(tabId) {
        return this._playingAds.get(tabId) || false;
    }

    /**
     * Gets the start time for ads in a tab.
     * @param {number} tabId - The ID of the tab to check.
     * @returns {number|null}
     */
    getStartTime(tabId) {
        return this._startTime.get(tabId) || null;
    }

    /**
     * Marks that ads have started in a tab and records the start time.
     * @param {number} tabId - The ID of the tab where ads started.
     * @returns {Promise<boolean>}
     */
    async tabAdsStarted(tabId) {
        const start = timeInSeconds();
        this._startTime.set(tabId, start);
        await this._set({ startTime: this._startTime });
        this._playingAds.set(tabId, true);
        await this._set({ playingAds: this._playingAds });
        return true;
    }

    /**
     * Marks that ads have stopped in a tab and clears the start time.
     * @param {number} tabId - The ID of the tab where ads stopped.
     * @returns {Promise<boolean>}
     */
    async tabAdsStopped(tabId) {
        this._startTime.delete(tabId);
        await this._set({ startTime: this._startTime});
        this._playingAds.delete(tabId);
        await this._set({ playingAds: this._playingAds });
        return true;
    }

    /**
     * Toggles debug mode for the extension.
     * @param {number} tabId - The ID of the tab to send the toggle request from.
     * @returns {Promise<boolean>}
     */
    async toggleDebugMode(tabId) {
        console.debug(`ExtensionState.toggleDebugMode(${tabId})`);
        const response = await browser.tabs.sendMessage(tabId, {task: 'toggleDebug'});
        console.debug(`ExtensionState.toggleDebugMode(${tabId}): response: `, response);
        if (!response?.success) {
            this.logger.error(`ExtensionState.togglePlayerHide() Failed to toggle DebugMode for tabId: ${tabId}`,  response?.error);
            return false;
        }
        this._debugMode = !this._debugMode;
        await this._set({ debugMode: this._debugMode }).catch((error) => console.error("Error saving debugMode state:", error));
        return true;
    }

    /**
     * Toggles the visibility of the player in a tab.
     * @param {number} tabId - The ID of the tab where the player should be toggled.
     * @returns {Promise<boolean>}
     */
    async togglePlayer(tabId) {
        console.debug(`ExtensionState.togglePlayer(${tabId})`);
        const currentMuteState = this._hiddenPlayers.get(tabId) || false;
        // mute/unmute the tab where ads are started/stopped
        const response = await browser.tabs.sendMessage(tabId, {task: 'togglePlayer'});
        if (!response?.success) {
            this.logger.error(`ExtensionState.togglePlayerHide() Failed to toggle Player Hide for tabId: ${tabId}`,  response?.error);
            return false;
        }
        if (!currentMuteState) {
            this._hiddenPlayers.set(tabId, true);
        } else {
            this._hiddenPlayers.delete(tabId);
        }
        await this._set({ hiddenPlayers: this._hiddenPlayers }).catch((error) => console.error("Error saving hiddenPlayers state:", error));
        return true;
    }

    /**
     * Toggles the mute state of a tab.
     * @param {number} tabId - The ID of the tab to toggle mute for.
     * @returns {Promise<boolean>}
     */
    async toggleMute(tabId) {
        this.logger.debug(`ExtensionState.toggleMute(${tabId})`);
         // proceed with toggling the mute
        if (await this._isMutedByPlayer(tabId)) {
            this.logger.debug(`ExtensionState.togglePlayerHide() Refusing to toggle Mute for a tab that the user muted: ${tabId}`);
            return false;
        }
        const currentMuteState = this._mutedTabs.get(tabId) || false;
        // mute/unmute the tab where ads are started/stopped
        const response = await browser.tabs.update(tabId, {muted: !currentMuteState});
        if (response.error) {
            this.logger.error(`ExtensionState.togglePlayerHide() Failed to toggle Mute for tabId: ${tabId}`,  response?.error);
            return false;
        }
        if (!currentMuteState) {
            this._mutedTabs.set(tabId, true);
        } else {
            this._mutedTabs.delete(tabId);
        }
        await this._set({ mutedTabs: this._mutedTabs }).catch((error) => console.error("Error saving mutedTabs state:", error));
        return true;
    }

    /**
     * Checks if a tab is muted by the user.
     * @param {number} tabId - The ID of the tab to check.
     * @returns {Promise<boolean>}
     */
    async _isMutedByPlayer(tabId) {
        // capture current tab muted state and see if the User is the reason why it's muted.
        const { mutedInfo } = await browser.tabs.get(tabId) || {};
        const { muted, reason } = mutedInfo || {};
        return (muted && reason === "user");
    }
}

/**
 * This class processes web requests to determine if they are related to ad events
 * and extracts relevant information from them.
 */
class RequestWrapper {
    AD_OPERATION_EVENT = 'RecordAdEvent';
    requestTypes = [];

    /**
     * Initializes a new instance of the RequestWrapper class.
     * @param {Object} details - Details about the request, including method, requestBody, and tabId.
     * @param {Object} options - Additional options, including logger and state.
     */
    constructor({method, requestBody, tabId}, {logger, state}) {
        // Filter out non-POST requests
        if (method !== "POST") {
            return;
        }
        this.logger = logger || new BackgroundLogger({debugMode: state.debugMode});
        if (!tabId) {
            console.debug("RequestWrapper() Tab ID is missing from the details object.");
            return;
        }
        this.tabId = tabId;
        this._processRequest(requestBody);
    }

    /**
     * Processes the request body to determine if it contains ad-related events.
     * @param {Object} requestBody - The body of the request.
     */
    _processRequest( requestBody = {} ) {
        const bytes = requestBody?.raw?.[0]?.bytes;

        if (bytes) {
            let decoder = new TextDecoder("utf-8");
            let bodyString = decoder.decode(bytes);
            if (bodyString) {
                try {
                    const jsonBody = JSON.parse(bodyString);
                    this._processJson(jsonBody);
                    console.debug(`RequestWrapper._processRequest() Event Status [${this.requestTypes}]`, jsonBody);
                } catch (error) {
                    this.logger.error("Failed to parse JSON body:", error, requestBody);
                }
            } else {
                console.debug("RequestWrapper._processRequest() No JSON body found in request: ", requestBody);
            }
        }
    }

    /**
     * This method parses the JSON requestBody to determine if the
     * GraphQL payload contains metrics for starting video ads
     * and for ending video ads.
     * @param {Object} json - The JSON payload to parse.
     * @returns {string}
     */
    _processJson(json = '') {
        if (!Array.isArray(json) || json.length === 0) return 'invalid';
        json.forEach( event => {
            const { operationName, variables } = event || {};
            // Only process
            if (!operationName || !operationName.includes(this.AD_OPERATION_EVENT)) {
                this.requestTypes.push('non-ad');
                return; // continue forEach looping
            }
            const { eventName } = variables?.input || {};
            switch (eventName) {
                case 'video_ad_impression':
                case 'video_ad_quartile_complete':
                    this.requestTypes.push('ad-started');
                    break;
                case 'video_ad_pod_complete':
                    this.requestTypes.push('ad-completed');
                    break;
                case 'ad_impression':
                    this.requestTypes.push('ad-rendered');
                    break;
                default:
                    this.requestTypes.push('invalid');
            }
        });
    }
}


/**
 * This is a simple Logger class that interfaces the browser's console logging
 * abilities. It has the ability to disable/enable default and debug logging levels.
 * It also checks browser storage for a debugMode flag.
 */
class BackgroundLogger {

    /**
     * Initializes a new instance of the BackgroundLogger class.
     * @param {Object} options - Options for the logger, including debugMode.
     */
    constructor({debugMode}) {
        this._debugMode = debugMode;
    }

    /**
     * Logs a message with optional parameters and level.
     * @param {Object|string} params - The message or an object containing message, level, and additional arguments.
     */
    log(params) {
        if (typeof params === 'string') {
            // default fallback
            this.logMessage(params);
        }
        const { message, level, ...args } = params;
        // call with {message: 'Some Message', level: 'debug', objectToPrint...}
        switch (level) {
            case 'debug':
                this.debug(message, args);
                break;
            case 'warn':
                this.warn(message, args);
                break;
            case 'error':
                this.error(message, args);
                break;
            case 'log':
            default:
                this.logMessage(message, args);
        }
    }

    /**
     * Logs a general message.
     * @param {string} message - The message to log.
     * @param {...*} args - Additional arguments to log.
     */
    logMessage(message, ...args) {
        if (this._debugMode) {
            if (Object.keys(args).length === 0) {
                console.log(message);
            } else {
                console.log(message, args)
            }
        }
    }

    /**
     * Logs a debug message.
     * @param {string} message - The message to log.
     * @param {...*} args - Additional arguments to log.
     */
    debug(message, ...args) {
        if (this._debugMode) {
            if (Object.keys(args).length === 0) {
                console.debug(message);
            } else {
                console.debug(message, args)
            }
        }
    }

    /**
     * Logs a warning message.
     * @param {string} message - The message to log.
     * @param {...*} args - Additional arguments to log.
     */
    warn(message, ...args) {
        if (Object.keys(args).length === 0) {
            console.warn(message);
        } else {
            console.warn(message, args)
        }
    }

    /**
     * Logs an error message.
     * @param {string} message - The message to log.
     * @param {...*} args - Additional arguments to log.
     */
    error(message, ...args) {
        if (Object.keys(args).length === 0) {
            console.error(message);
        } else {
            console.error(message, args)
        }
    }
}

/**
 * This class handles the web request to Twitch's GQL API, and determines
 * if the request is for handling ad impressions, and toggling the tab mute,
 * and hide video features.
 * It's also the top-level class that is instantiated in the background script.
 */
class AdMonitor {

    STATE_TIMEOUT_LIMIT= 60;

    /**
     * Initializes a new instance of the AdMonitor class.
     */
    constructor() {
        // Map to track which tabs were muted by the extension
        this.state = new ExtensionState();
        this.state.initialize().then(()=>{
            this.logger = new BackgroundLogger({debugMode: this.state.isDebug()});
        });
    }

    /**
     * Handles the start of ads in a tab.
     * @param {number} tabId - The ID of the tab where ads started.
     */
    handleAdStart(tabId) {
        this.logger.debug(`handleAdStart(tabId: ${tabId})`);
        // always update
        this.state.tabAdsStarted(tabId).then();

        if (!this.state.isMuted(tabId)) {
            this.state.toggleMute(tabId).then();
        }

        if (!this.state.isHidden(tabId)) {
            this.state.togglePlayer(tabId).then();
        }
    }

    /**
     * Handles the stop of ads in a tab.
     * @param {number} tabId - The ID of the tab where ads stopped.
     */
    handleAdStop(tabId) {
        this.logger.debug(`handleAdStop(tabId: ${tabId})`);
        if (this.state.isMuted(tabId)) {
            this.state.toggleMute(tabId).then();
        }

        if (this.state.isHidden(tabId)) {
            this.state.togglePlayer(tabId).then();
        }

        // always update
        this.state.tabAdsStopped(tabId).then();
    }

    /**
     * Handles ad status changes based on detected events.
     * @param {string[]} adStatus - An array of ad-related event statuses.
     * @param {number} tabId - The ID of the tab to handle.
     */
    handleAdStatus(adStatus, tabId) {
        this.logger.debug(`AdMonitor.handleAdStatus(adStatus: ${adStatus}, tabId: ${tabId})`);
        // only mute/hide if not already muted || if it was muted by the add-on
        if (this.state.initialized) {
            // Check for completion first, in case start and completed events are captured in the same request.
            if (adStatus.includes('ad-completed')) {
                this.handleAdStop(tabId);
            } else if (adStatus.includes('ad-started')) {
                this.handleAdStart(tabId);
            } else {
                // non-ad status, handle edge case that we may be out of sync
                if (this.state.isPlayingAds(tabId)) {
                    let start = this.state.getStartTime(tabId);
                    if (!start) {
                        // bad state, ads were tracked as playing, but no start time found
                        this.handleAdStop(tabId);
                        this.logger.debug(`AdMonitor entered a bad state while tracking Ads. Resuming Normal Playing behavior on tabId: [${tabId}].`);
                    } else {
                        const current = timeInSeconds();
                        const timeDiff = current - start;
                        if (timeDiff > this.STATE_TIMEOUT_LIMIT) {
                            // last ad event started over STATE_TIMEOUT_LIMIT seconds ago.
                            this.handleAdStop(tabId);
                            this.logger.debug(`Tracked Ad lifecycle exceeded time limit. Resuming Normal Playing behavior on tabId: [${tabId}].`);
                        }
                    }
                }
            }
        } else {
            this.logger.debug("AdMinotor not handling Ad, ExtentionState not initialized");
        }
    }

    /**
     * Processes a web request to determine if it contains ad-related events and handles them accordingly.
     * @param {Object} details - Details about the request.
     */
    handleRequest(details) {
        this.logger.debug("AdMonitor.handleRequest()", details);
        const { requestTypes, tabId } = new RequestWrapper(details, this);
        if (requestTypes && tabId) {
            this.handleAdStatus(requestTypes, tabId);
        } else {
            this.logger.debug("AdMonitor not handling request, no tabId or requestTypes detected.");
        }
    }

    /**
     * Handles messages sent from content scripts or other parts of the extension.
     * @param {Object} data - The message data.
     * @param {Object} sender - Information about the sender of the message.
     * @param {Function} sendResponse - A function to send a response back to the sender.
     * @returns {boolean}
     */
    handleMessage(data, sender, sendResponse) {
        const { task, tabId, ...params } = data;
        this.logger.debug("AdMonitor.handleMessage()", task, tabId);
        if (typeof task === 'string') {
            this.logger.debug(`AdMonitor.onMessage() Received task: ${task} for tabId: [${tabId}] from sender:`, sender);
            switch (task) {
                case "log":
                    this.logger.log(params);
                    sendResponse(true);
                    break;
                case "toggleDebug":
                    this.state.toggleDebugMode(tabId).then((success) => {
                        this.logger.debug(`AdMonitor.onMessage() toggleDebugMode success:`, success);
                        sendResponse(success);
                    });
                    break;
                case "toggleMute":
                    this.state.toggleMute(tabId).then((success) => {
                        this.logger.debug(`AdMonitor.onMessage() toggleMute success:`, success);
                        sendResponse(success);
                    });
                    break;
                case "togglePlayer":
                    this.state.togglePlayer(tabId).then((success) => {
                        this.logger.debug(`AdMonitor.onMessage() togglePlayer success:`, success);
                        sendResponse(success);
                    });
                    break;
                default:
                    this.logger.error(`Unknown task: ${task}`);
                    sendResponse(false);
            }
        } else {
            this.logger.error('AdMonitor.onMessage() Error: task was provided as a non-string value');
            sendResponse(false);
        }
        return true; // enables async handling?
    }

}

// Instantiate the main class for the background script and set up event listeners.
const adMonitor = new AdMonitor();

/**
 * Listens for web requests to Twitch's GQL API and processes them to handle ad events.
 */
browser.webRequest.onBeforeRequest.addListener(
    adMonitor.handleRequest.bind(adMonitor),
    { urls: ["*://gql.twitch.tv/*"] },
    ["requestBody"]
);

/**
 * Listens for messages from content scripts or other parts of the extension.
 */
browser.runtime.onMessage.addListener(
    adMonitor.handleMessage.bind(adMonitor),
);

