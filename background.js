/**
 * Static Util functions related to Firefox Tab functionality.
 * Takes an object with an optional logger property that should have
 * a debug method.
 * {@link BackgroundLogger}
 */
class TabUtils {

    static async getActiveTabId({logger}) {
        const tab = await TabUtils.getActiveTab({logger})
        if (tab) {
            // Send message to the first active tab
            logger.logMessage("found active tab", tab);
            return tab.id;
        }
        return null;
    }

    static async getActiveTab({logger}){
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
            logger?.debug("No active tab found.");
            return null;
        }
        return tabs[0];
    }
}

/**
 * This is a simple Logger class that interfaces the browser's console logging
 * abilities. It has the ability to disable/enable default and debug logging levels.
 * It also checks browser storage for a debugMode flag.
 */
class BackgroundLogger {
    constructor() {
        browser.storage.local.get({ debugMode: false }, (result) => {
            this.debugMode = !result.debugMode;
        });
    }

    /**
     * This method updates the local storage value for debugMode and forwards
     * a message to the content-script to
     * @param tabId
     * @param success
     */
    toggleDebugMode(tabId, success) {
        browser.storage.local.get({ debugMode: false }).then((result) => {
            this.debugMode = !result.debugMode;
            browser.storage.local.set({ debugMode: this.debugMode }).then(() => {
                this.warn(`Debug Mode is now ${this.debugMode ? 'on' : 'off'}`);
            });
            // enable debug on the contentScript
            this.debug(`BackgroundLogger.toggleDebugMode() Toggling Debug Mode on tabId: [${tabId}]`);
            browser.tabs.sendMessage(tabId, {task: 'toggleDebug'}).then((response) => {
                if (!response?.success) {
                    this.error("BackgroundLogger.toggleDebugMode() Failed to toggle Debug Mode on content-script: ",  response?.error);
                    success(false);
                }
            });
            success(true);
        }).catch((error) => {
            this.error("BackgroundLogger.toggleDebugMode() Error toggling Debug Mode:", error);
            success(false);
        })
    }

    /**
     * This is a catch-all logging call, that could support logging messages sent
     * from other scripts.
     * @param params
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

    logMessage(message, ...args) {
        if (this.debugMode) {
            if (Object.keys(args).length === 0) {
                console.log(message);
            } else {
                console.log(message, args)
            }
        }
    }

    debug(message, ...args) {
        if (this.debugMode) {
            if (Object.keys(args).length === 0) {
                console.debug(message);
            } else {
                console.debug(message, args)
            }
        }
    }

    warn(message, ...args) {
        if (Object.keys(args).length === 0) {
            console.warn(message);
        } else {
            console.warn(message, args)
        }
    }

    error(message, ...args) {
        if (Object.keys(args).length === 0) {
            console.error(message);
        } else {
            console.error(message, args)
        }
    }
}

/**
 * This is a simple Messaging Class that handles and incoming messages from other parts
 * of the extension, such as the content scripts
 * Messages should be an object with the following format:
 * { "task": "log", "message": "Log message", "level": "debug":, ...otherArgs }
 */
class BackgroundMessageHandler {
    constructor(caller) {
        this.caller = caller;
        this.logger = new BackgroundLogger(this);
        this._initialize();
    }

    _initialize() {
        browser.runtime.onMessage.addListener((data, sender, sendResponse) => this.handleMessage(data, sender, sendResponse));
    }

    handleMessage(data, sender, sendResponse) {
        const { task, tabId, ...params } = data;
        if (typeof task === 'string') {
            this.logger.debug(`BackgroundMessageHandler.onMessage() Received task: ${task} from sender:`, sender);
            switch (task) {
                case "log":
                    this.logger.log(params);
                    sendResponse(true);
                    break;
                case "toggleDebug":
                    this.logger.toggleDebugMode(tabId, () => sendResponse(true));
                    break;
                case "toggleMute":
                    this.caller.toggleMute(tabId, () => sendResponse(true));
                    break;
                case "togglePlayer":
                    this.caller.togglePlayer(tabId, () => sendResponse(true));
                    break;
                default:
                    this.logger.error(`Unknown task: ${task}`);
                    sendResponse(false);
            }
        } else {
            this.logger.error('BackgroundMessageHandler.onMessage() Error: task was provided as a non-string value');
            sendResponse(false);
        }
    }
}


/**
 * This class handles the web request to Twitch's GQL API, and determines
 * if the request is for handling ad impressions, and toggling the tab mute,
 * and hide video features.
 * It's also the top-level class that is instantiated in the background script.
 */
class TwitchtvAdMonitor {
    AD_OPERATION_EVENT = 'RecordAdEvent';
    constructor() {
        // Map to track which tabs were muted by the extension
        this.mutedTabs = new Map();
        this.isHidden = false;
        this.messenger = new BackgroundMessageHandler(this);
        this.logger = this.messenger.logger;
        this.playerManagerInitialized = true;
        this.tabIdWithAd = null;

        this.logger.logMessage("TwitchtvAdMonitor.constructor() initialized with debugMode:" , this.logger.debugMode);

        // Initialize listeners
        this._initializeListeners();
    }

    /**
     * Initializes necessary listeners for the extension.
     */
    _initializeListeners() {
        browser.webRequest.onBeforeRequest.addListener(
            this.handleRequest.bind(this),
            { urls: ["*://gql.twitch.tv/*"] },
            ["requestBody"]
        );
    }

    /**
     * This method parses the JSON requestBody to determine if the
     * GraphQL payload contains metrics for starting video ads
     * and for ending video ads.
     * @param {string} json
     * @returns {string}
     */
    getAdStatus(json) {
        if (!Array.isArray(json) || json.length === 0) return 'invalid';
        const { operationName, variables } = json[0] || {};
        // Only process
        if (!operationName || !operationName.includes(this.AD_OPERATION_EVENT)) {
            return 'non-ad';
        }
        const { eventName } = variables?.input || {};
        switch (eventName) {
            case 'video_ad_impression':
            case 'video_ad_quartile_complete':
                return 'ad-started';
            case 'video_ad_pod_complete':
                return 'ad-completed';
            case 'ad_impression':
                return 'ad-rendered';
            default:
                return 'invalid';
        }
    }

    /**
     * This function handles toggling the player for the currently active tab.
     * @param tabId
     * @param success callback that will be passed a single boolean argument indicating success/failure
     */
    togglePlayer(tabId, success) {
        this.logger.debug("TwitchtvAdMonitor.togglePlayer() called");
        if (!this.playerManagerInitialized) {
            this.logger.warn('The player manager is not initialized yet. Please try again later.');
            success(false);
            return;
        }
        this.logger.debug(`TwitchtvAdMonitor.togglePlayer() Toggling Player on tabId: [${tabId}]`);
        browser.tabs.sendMessage(tabId, {task: 'togglePlayer'}).then((response) => {
            if (response?.success) {
                this.isHidden = !this.isHidden;
                success(true);
            } else {
                this.logger.error("TwitchtvAdMonitor.togglePlayer() Failed to toggle player: ",  response?.error);
                success(false);
            }
        }).catch((error) => {
            this.logger.error('TwitchtvAdMonitor.togglePlayer() Error toggling the player:', error);
            success(false);
        });
    }

    /**
     * This function handles toggling mute for the currently active tab.
     * @param tabId
     * @param success callback that will be passed a single boolean argument indicating success/failure
     */
    toggleMute(tabId, success) {
        this.logger.debug("TwitchtvAdMonitor.toggleMute() Toggling Mute");
        const currentMuteState = this.mutedTabs.get(tabId) || false;
        // mute/unmute the tab where ads are started/stopped
        browser.tabs.update(tabId, {muted: !currentMuteState});
        if (!currentMuteState) {
            this.mutedTabs.set(tabId, true);
        } else {
            this.mutedTabs.delete(tabId);
        }
        success(true);
    }

    /**
     * Makes Browser and Content adjustments according to the adStatus
     * @param {string} adStatus
     * @param {number} tabId
     */
    handleAdStatus(adStatus, tabId) {
        // only mute/hide if not already muted || if it was muted by the add-on
        if ((adStatus === 'ad-started' && !this.mutedTabs.has(tabId)) || (adStatus === 'ad-completed' && this.mutedTabs.has(tabId))) {
            // empty callbacks, since this block isn't driven by message handler
            this.toggleMute(tabId,()=>{});
            this.togglePlayer(tabId,()=>{});
        }
    }

    // Request Listener
    handleRequest(details) {
        // Filter out non-POST requests
        if (details.method !== "POST") {
            return;
        }
        const bytes = details.requestBody?.raw?.[0]?.bytes;

        if (bytes) {
            let decoder = new TextDecoder("utf-8");
            let bodyString = decoder.decode(bytes);
            if (bodyString) {
                try {
                    const jsonBody = JSON.parse(bodyString);
                    const adStatus = this.getAdStatus(jsonBody);
                    this.logger.debug(`TwitchtvAdMonitor.handleRequest() Event Status [${adStatus}]`);
                    const { tabId } = details || {};
                    if (tabId) {
                        this.tabIdWithAd = tabId;
                        this.handleAdStatus(adStatus, tabId);
                    } else {
                        this.logger.warn("Tab ID is missing from the details object:", details);
                    }
                } catch (error) {
                    this.logger.error("Failed to parse JSON body:", error, details);
                }
            } else {
                this.logger.warn("No JSON body found in request: ", details);
            }
        }
    }

}

// instantiate the main class for the background script.
new TwitchtvAdMonitor();
