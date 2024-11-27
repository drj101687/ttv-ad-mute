class ExtensionState {
    initialized = false;
    constructor() {
        this._debugMode = true;
        this._mutedTabs = new Map();
        this._hiddenPlayers = new Map();
    }

    async initialize() {
        // retrieve stored values or return defaults
        this._debugMode = (await this._get({debugMode: this._debugMode})).debugMode;
        this._mutedTabs = (await this._get({mutedTabs: this._mutedTabs})).mutedTabs;
        this._hiddenPlayers = (await this._get({hiddenPlayers: this._hiddenPlayers})).hiddenPlayers;
        this.logger = new BackgroundLogger({debugMode: this._debugMode});
        this.logger.debug("ExtensionState initialized with debug mode: ", this._debugMode);
        this.initialized = true;
    }

    async _get(defaultValue) {
        return await browser.storage.session.get(defaultValue);
    }

    async _set(value) {
        await browser.storage.session.set(value);
    }

    isDebug() {
        return this._debugMode;
    }

    isMuted(tabId) {
        return this._mutedTabs.get(tabId) || false;
    }

    isHidden(tabId) {
        return this._hiddenPlayers.get(tabId) || false;
    }

    async toggleDebugMode(tabId) {
        const response = await browser.tabs.sendMessage(tabId, {task: 'toggleDebug'});
        if (!response?.success) {
            this.logger.error(`ExtensionState.togglePlayerHide() Failed to toggle DebugMode for tabId: ${tabId}`,  response?.error);
            return false;
        }
        this._debugMode = !this._debugMode;
        await this._set({ debugMode: this._debugMode });
        return true;
    }

    async togglePlayer(tabId) {
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
        await this._set({ hiddenPlayers: this._hiddenPlayers });
        return true;
    }

    async toggleMute(tabId) {
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
        await this._set({ mutedTabs: this._mutedTabs });
        return true;
    }
}

class RequestWrapper {
    AD_OPERATION_EVENT = 'RecordAdEvent';
    requestType = 'invalid'; // default with invalid
    constructor({method, requestBody, tabId}, {logger, state}) {
        // Filter out non-POST requests
        if (method !== "POST") {
            return;
        }
        this.logger = logger || new BackgroundLogger({debugMode: state.debugMode});
        if (!tabId) {
            this.logger.debug("RequestWrapper() Tab ID is missing from the details object.");
            return;
        }
        this.tabId = tabId;
        this._processRequest(requestBody);
    }

    _processRequest( requestBody = {} ) {
        const bytes = requestBody?.raw?.[0]?.bytes;

        if (bytes) {
            let decoder = new TextDecoder("utf-8");
            let bodyString = decoder.decode(bytes);
            if (bodyString) {
                try {
                    const jsonBody = JSON.parse(bodyString);
                    this.requestType = this._processJson(jsonBody);
                    this.logger.debug(`RequestWrapper._processRequest() Event Status [${this.requestType}]`);
                } catch (error) {
                    this.logger.error("Failed to parse JSON body:", error, requestBody);
                }
            } else {
                this.logger.debug("RequestWrapper._processRequest() No JSON body found in request: ", requestBody);
            }
        }
    }

    /**
     * This method parses the JSON requestBody to determine if the
     * GraphQL payload contains metrics for starting video ads
     * and for ending video ads.
     * @param {string} json
     * @returns {string}
     */
    _processJson(json = '') {
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
}


/**
 * This is a simple Logger class that interfaces the browser's console logging
 * abilities. It has the ability to disable/enable default and debug logging levels.
 * It also checks browser storage for a debugMode flag.
 */
class BackgroundLogger {
    constructor({debugMode}) {
        this._debugMode = debugMode;
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
        if (this._debugMode) {
            if (Object.keys(args).length === 0) {
                console.log(message);
            } else {
                console.log(message, args)
            }
        }
    }

    debug(message, ...args) {
        if (this._debugMode) {
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
 * This class handles the web request to Twitch's GQL API, and determines
 * if the request is for handling ad impressions, and toggling the tab mute,
 * and hide video features.
 * It's also the top-level class that is instantiated in the background script.
 */
class AdMonitor {

    constructor() {
        // Map to track which tabs were muted by the extension
        this.state = new ExtensionState();
        this.state.initialize().then(()=>{
            this.logger = new BackgroundLogger({debugMode: this.state.isDebug()});
        })
    }

    /**
     * Makes Browser and Content adjustments according to the adStatus
     * @param {string} adStatus
     * @param {number} tabId
     */
    handleAdStatus(adStatus, tabId) {
        // only mute/hide if not already muted || if it was muted by the add-on
        if (this.state.initialized && ((adStatus === 'ad-started' && !this.state.isMuted(tabId)) || (adStatus === 'ad-completed' && this.state.isMuted(tabId)))) {
            // empty callbacks, since this block isn't driven by message handler
            this.state.toggleMute(tabId).then();
            this.state.togglePlayer(tabId).then();
        }
    }

    // Request Listener
    handleRequest(details) {
        const { requestType, tabId } = new RequestWrapper(details);
        this.handleAdStatus(requestType, tabId);
    }

    handleMessage(data, sender, sendResponse) {
        const { task, tabId, ...params } = data;
        if (typeof task === 'string') {
            this.logger.debug(`AdMonitor.onMessage() Received task: ${task} for tabId: [${tabId}] from sender:`, sender);
            switch (task) {
                case "log":
                    this.logger.log(params);
                    sendResponse(true);
                    break;
                case "toggleDebug":
                    this.state.toggleDebugMode(tabId).then((success) => sendResponse(success));
                    break;
                case "toggleMute":
                    this.state.toggleMute(tabId).then((success) => sendResponse(success));
                    break;
                case "togglePlayer":
                    this.state.togglePlayer(tabId).then((success) => sendResponse(success));
                    break;
                default:
                    this.logger.error(`Unknown task: ${task}`);
                    sendResponse(false);
            }
        } else {
            this.logger.error('AdMonitor.onMessage() Error: task was provided as a non-string value');
            sendResponse(false);
        }
    }

}

// instantiate the main class for the background script.
const adMonitor = new AdMonitor();

browser.webRequest.onBeforeRequest.addListener(
    adMonitor.handleRequest.bind(adMonitor),
    { urls: ["*://gql.twitch.tv/*"] },
    ["requestBody"]
);

browser.runtime.onMessage.addListener(
    adMonitor.handleMessage.bind(adMonitor),
);

