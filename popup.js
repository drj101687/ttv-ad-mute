document.getElementById('toggleDebug').addEventListener('click', () => {
    chrome.storage.local.get({ debugMode: false }, (result) => {
        const newDebugMode = !result.debugMode;
        chrome.storage.local.set({ debugMode: newDebugMode }, () => {
            alert(`Debug mode is now ${newDebugMode ? 'on' : 'off'}`);
        });
    });
});
