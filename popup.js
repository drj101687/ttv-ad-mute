class PopupMonitor {
    constructor() {
        this._initialize();
        console.debug("PopupMonitor initialized");
    }

    _initialize() {
        document.getElementById('toggleDebug').addEventListener('click', () => this.toggleDebug());
        document.getElementById('toggleMute').addEventListener('click', () => this.toggleMute());
        document.getElementById('togglePlayer').addEventListener('click', () => this.togglePlayer());
    }

    async getActiveTabId() {
        const tab = await this.getActiveTab();
        if (tab) {
            // Send message to the first active tab
            console.debug(`Found Active Tab: ${tab.id}`);
            return tab.id;
        }
        console.debug(`No active Tab found`);
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
                console.debug("PopupMonitor.toggleDebug(), success?: ", success);
                if (!success) {
                    console.error(`Error while toggling debug mode`);
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
            } else {
                console.debug("PopupMonitor._backgroundMessage() message was received: ", success);
            }
        }).catch((error) => {
            console.error('PopupMonitor._backgroundMessage() Error sending message to background:', error);
        });
    }
}

new PopupMonitor();
