class PopupHandler {
    constructor() {
        this._initialize();
    }

    _initialize() {
        browser.storage.local.get({ debugMode: false }).then((result) => {
            this.debugMode = result.debugMode;
        });
        document.getElementById('toggleDebug').addEventListener('click', () => this.toggleDebug());
        document.getElementById('toggleMute').addEventListener('click', () => this.toggleMute());
        document.getElementById('togglePlayer').addEventListener('click', () => this.togglePlayer());
    }

    toggleDebug() {
        this._backgroundMessage({task: 'toggleDebug'}, (success) => {
            if (success) {
                // update local debugMode
                this.debugMode = !this.debugMode;
                alert(`Debug mode is now ${this.debugMode ? 'on' : 'off'}`);
            }
        });
    }

    toggleMute() {
        this._backgroundMessage({task: 'toggleMute'});
    }

    togglePlayer() {
        this._backgroundMessage({task: 'togglePlayer'});
    }

    _backgroundMessage(params, callback = () => {}) {
        browser.runtime.sendMessage(params).then((success) => {
            if (callback) {
                callback(success);
            } else if (this.debugMode) {
                console.debug("PopupHandler._backgroundMessage() message was received: ", success);
            }
        }).catch((error) => {
            console.error('PopupHandler._backgroundMessage() Error sending message to background:', error);
        });
    }
}

new PopupHandler();