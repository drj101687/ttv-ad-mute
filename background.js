class TwitchtvAdMonitor {
    AD_OPERATION_EVENT = 'RecordAdEvent';
    constructor({debugMode = false}) {
        // Map to track which tabs were muted by the extension
        this.mutedTabs = new Map();
        this.isHidden = false;
        this.debugMode = debugMode;
        this.playerManagerInitialized = true;

        if (this.debugMode) {
            console.debug("TwitchtvAdMonitor initialized with debugMode:", this.debugMode);
        }

        // Initialize listeners
        this.initializeListeners();
    }

    /**
     * Initializes necessary listeners for the extension.
     */
    initializeListeners() {
        browser.webRequest.onBeforeRequest.addListener(
            this.handleRequest.bind(this),
            { urls: ["*://gql.twitch.tv/*"] },
            ["requestBody"]
        );
        if (this.debugMode) {
            browser.runtime.onMessage.addListener((data, sender, sendResponse) => {
                const { message } = data || {};
                console.log("Received Message: ", message);
                browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
                    console.log("query tabs");
                    if (tabs.length > 0) {
                        // Send message to the first active tab
                        const activeTab = tabs[0];
                        console.log("found active tab", activeTab);
                        if (message === 'testTogglePlayer') {
                            this.togglePlayer(activeTab.id);
                        } else if (message === 'testToggleMute') {
                            this.toggleMute(activeTab.id);
                        }
                    }
                });
                sendResponse(true);
                return true; // Indicates that the response will be asynchronous if needed
            });
        }
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
     * This function sends a message to the targeted tab indicating
     * whether it should hide the player. Updates the isHidden status
     * when message has a successful response.
     * @param tabId
     */
    togglePlayer(tabId) {
        console.debug("togglePlayer() called");
        if (!this.playerManagerInitialized) {
            console.warn('The player manager is not initialized yet. Please try again later.');
            return;
        }
        if (this.debugMode) {
            console.debug("Toggling Player");
        }
        browser.tabs.sendMessage(tabId, !this.isHidden).then((success) => {
            if (success) {
                this.isHidden = !this.isHidden;
            }
        }).catch((error) => {
            console.error('Error toggling the player:', error);
        });
    }

    /**
     * This function handles toggling mute for the targeted tab.
     * @param tabId
     */
    toggleMute(tabId) {
        if (this.debugMode) {
            console.debug("Toggling Mute");
        }
        const currentMuteState = this.mutedTabs.get(tabId) || false;
        // mute/unmute the tab where ads are started/stopped
        browser.tabs.update(tabId, { muted: !currentMuteState });
        if (!currentMuteState) {
            this.mutedTabs.set(tabId, true);
        } else {
            this.mutedTabs.delete(tabId);
        }
    }

    /**
     * Makes Browser and Content adjustments according to the adStatus
     * @param {string} adStatus
     * @param {number} tabId
     */
    handleAdStatus(adStatus, tabId) {
        // only mute/hide if not already muted || if it was muted by the add-on
        if ((adStatus === 'ad-started' && !this.mutedTabs.has(tabId)) || (adStatus === 'ad-completed' && this.mutedTabs.has(tabId))) {
            this.toggleMute(tabId);
            this.togglePlayer(tabId);
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
                    if (this.debugMode) {
                        console.debug(`Event Status [${adStatus}] request body:`, jsonBody[0]);
                    }
                    const { tabId } = details || {};
                    if (tabId) {
                        this.handleAdStatus(adStatus, tabId);
                    } else {
                        console.warn("Tab ID is missing from the details object:", details);
                    }
                } catch (error) {
                    console.error("Failed to parse JSON body:", error, details);
                }
            } else {
                console.warn("No JSON body found in request: ", details);
            }
        }
    }

}


new TwitchtvAdMonitor({ debugMode: false });
