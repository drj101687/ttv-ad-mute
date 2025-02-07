console.debug('Content Script Loaded');
/**
 * This class handles the Video Player on the Twitch Tab.
 * It listens for events from the background.js that indicate
 * if the Player should be hidden or displayed.
 */
class PlayerMonitor {
    constructor({debugMode}) {
        this.player = null; // Cached player element
        this.isHidden = false;
        this.debugMode = debugMode;
        console.debug('PlayerMonitor initialized');
    }

    /**
     * Retrieves the player video element.
     * @returns {HTMLElement|null} - The video element if found, otherwise null.
     */
    getPlayer() {
        return document.querySelector(".video-render-surface > video");
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
                console.debug(`PlayerMonitor.togglePlayer() hide: ${hide}, player:`, this.player);
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
            console.error("PlayerMonitor.togglePlayer() Error in togglePlayer:", e);
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

    handleMessage(data, sender, sendResponse) {
        const { task, hide } = data;
        if (typeof task === 'string') {
            if (this.debugMode) {
                console.debug("PlayerMonitor.onMessage() Received task:  " + task);
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
    }
}

// Instantiate the content script class
const popup = new PlayerMonitor({debugMode: true});

browser.runtime.onMessage.addListener(popup.handleMessage.bind(popup));

