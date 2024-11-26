/**
 * This class handles the Video Player on the Twitch Tab.
 * It listens for events from the background.js that indicate
 * if the Player should be hidden or displayed.
 */
class TwitchtvAdPlayerManager {
    constructor() {
        this.player = null; // Cached player element
        this.isHidden = false;
        this._initialize();
    }

    /**
     * Sets up an element that confirms initialization.
     */
    _initialize() {
        browser.storage.local.get({ debugMode: false }).then((result) => {
            this.debugMode = result.debugMode;
        });
        browser.runtime.onMessage.addListener((data, sender, sendResponse) => {
            const { task, hide } = data;
            if (typeof task === 'string') {
                if (this.debugMode) {
                    console.debug("TwitchtvAdPlayerManager.onMessage() Received task:  " + task);
                }
                switch (task) {
                    case "toggleDebug":
                        this.debugMode = !this.debugMode;
                        sendResponse( { success: true });
                        break;
                    case "togglePlayer":
                        this.togglePlayer(hide, sendResponse);
                        break;
                    default:
                        sendResponse({ success: false, message: `Unknown task ${task}` });
                }
            }
            return true;
        });
    }

    /**
     * Retrieves the player video element.
     * @returns {HTMLElement|null} - The video element if found, otherwise null.
     */
    getPlayer() {
        return document.querySelector(".video-ref.Layout-sc-1xcs6mc-0 > video");
    }

    /**
     * Toggles the visibility of the player and handles ad notices.
     * @param {boolean} hide - Whether to hide the player.
     * @param {Function} sendResponse - Callback to send a response back to the sender.
     */
    togglePlayer(hide = !this.isHidden, sendResponse) {

        try {
            // ensure fresh player is acquired every time we toggle for ads
            this.player = this.getPlayer();
            if (this.debugMode) {
                console.debug(`TwitchtvAdPlayerManager.togglePlayer() hide: ${hide}, player:`, this.player);
            }
            if (hide) {
                this.showAdNotice();
                this.player.style.visibility = "hidden";
            } else {
                this.player.style.visibility = "";
                this.removeAdNotice();
            }
            this.isHidden = hide;
            sendResponse({ success: true });
        } catch (e) {
            console.error("TwitchtvAdPlayerManager.togglePlayer() Error in togglePlayer:", e);
            sendResponse({ success: false, message: e.message });
        }
    }

    /**
     * Displays an ad notice above the player.
     */
    showAdNotice() {
        if (!document.querySelector("#TtvAM_ad-notice")) {
            this.player.insertAdjacentHTML(
                "beforebegin",
                `
                    <p id="TtvAM_ad-notice" style="font-size: 15px; margin-top: 8rem; text-align: center;">
                        (Ads playing)
                    </p>
                `
            );
        }
    }

    /**
     * Removes the ad notice from above the player.
     */
    removeAdNotice() {
        const adNotice = document.querySelector("#TtvAM_ad-notice");
        if (adNotice) {
            adNotice.remove();
        }
    }
}

// Instantiate the content script class
new TwitchtvAdPlayerManager({debugMode: false});

