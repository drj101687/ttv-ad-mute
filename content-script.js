class TwitchtvAdPlayerManager {
    constructor({debugMode = false}) {
        this.player = null; // Cached player element
        this.debugMode = debugMode;
        this.initialize();
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
    togglePlayer(hide, sendResponse) {
        if (this.debugMode) {
            console.log(`togglePlayer(${hide})`);
        }
        try {
            if (!this.player) {
                this.player = this.getPlayer();
            }
            if (hide) {
                this.showAdNotice();
                this.player.style.visibility = "hidden";
            } else {
                this.player.style.visibility = "";
                this.removeAdNotice();
            }
            sendResponse(true);
        } catch (e) {
            console.error("Error in togglePlayer:", e);
            sendResponse({ e: e.message });
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

    addToggleListener() {
        browser.runtime.onMessage.addListener((hide, sender, sendResponse) => {
            if (this.debugMode) {
                console.debug("Toggle Listener called: ", hide);
            }
            this.togglePlayer(hide, sendResponse);
            return true; // Indicates that the response will be asynchronous if needed
        });
    }

    /**
     * Sets up an element that confirms initialization.
     */
    initialize() {

        this.addToggleListener();
        if (this.debugMode) {
            console.debug("Initializing TwitchtvAdPlayerManager");
            const togglePlayerButton = document.createElement('button');
            togglePlayerButton.innerText = "Click Here to toggle Player";
            togglePlayerButton.classList.add('toggle-player-button');
            togglePlayerButton.addEventListener('click', () => {
                console.debug("Test Player Button clicked");
                this.backgroundMessage("testTogglePlayer");
            });
            document.body.append(togglePlayerButton);
            const toggleMuteButton = document.createElement('button');
            toggleMuteButton.innerText = "Click Here to toggle Mute";
            toggleMuteButton.classList.add('toggle-mute-button');
            toggleMuteButton.addEventListener('click', () => {
                console.debug("Test Mute Button clicked");
                this.backgroundMessage("testToggleMute");
            });
            document.body.append(toggleMuteButton);
            console.debug("setup finished");
        }
    }

    backgroundMessage(message) {
        browser.runtime.sendMessage({message: message}).then((success) => {
            if (this.debugMode) {
                console.debug("message was received: ", success);
            }
        }).catch((error) => {
            console.error('Error sending message to background:', error);
        });
    }
}

// Instantiate the content script class
new TwitchtvAdPlayerManager({debugMode: false});

