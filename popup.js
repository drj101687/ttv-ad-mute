class PopupMonitor {
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

    async getActiveTabId() {
        const tab = await this.getActiveTab();
        if (tab) {
            // Send message to the first active tab
            return tab.id;
        }
        return null;
    }

    async getActiveTab(){
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
            return null;
        }
        return tabs[0];
    }


    toggleDebug() {
        this.getActiveTabId().then((tabId) =>{
            this._backgroundMessage({task: 'toggleDebug', tabId}, (success) => {
                if (success) {
                    // update local debugMode
                    this.debugMode = !this.debugMode;
                    alert(`Debug mode is now ${this.debugMode ? 'on' : 'off'}`);
                }
            });
        }).catch((error)=>{
            console.error('PopupMonitor.toggleMute() Error toggling mute:', error);
        });
    }

    toggleMute() {
        this.getActiveTabId().then((tabId) =>{
            this._backgroundMessage({task: 'toggleMute', tabId});
        }).catch((error)=>{
            console.error('PopupMonitor.toggleMute() Error toggling mute:', error);
        });
    }

    togglePlayer() {
        this.getActiveTabId().then((tabId) =>{
            this._backgroundMessage({task: 'togglePlayer', tabId});
        }).catch((error)=>{
            console.error('PopupMonitor.togglePlayer() Error toggling player:', error);
        });
    }

    _backgroundMessage(params, callback = () => {}) {
        browser.runtime.sendMessage(params).then((success) => {
            if (callback) {
                callback(success);
            } else if (this.debugMode) {
                console.debug("PopupMonitor._backgroundMessage() message was received: ", success);
            }
        }).catch((error) => {
            console.error('PopupMonitor._backgroundMessage() Error sending message to background:', error);
        });
    }
}

new PopupMonitor();
