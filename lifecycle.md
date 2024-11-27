# The Lifecycle of a Firefox Extension

This is intended as a guide and breakdown to how Firefox plugins will work in `manifest_version` "3". 


## Installation 

#### 1. Extension is installed by the user

## Initialization

#### 2. Extension is enabled by the user
#### 3. Background script is registered as a service worker
    "background": {
        "scripts": ["background.js"]
    }
#### 4. Message, Alarm, and Runtime API listeners are registered as activation signals
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log(`Message received: ${message}`);
        sendResponse({ status: "ok" });
    });

## Activation

#### 5.A User clicks on extension toolbar button
or
#### 5.B API based listener receives an event signal

#### 6. Service worker is activated and the background script is initialized
#### 7. Permission based Event listeners are registered in the service worker
    function requestHandler(requestDetails) {}
    browser.webRequest.onBeforeRequest.addListener(
        requestHandler,
        { urls: ["*://*.domain.com/*"] },
        ["requestBody"]
    );

## Event Handling

#### 8. Event driven listener in background script calls handler as events occur and are filtered based on permission and filtering rules.

## Termination

#### 9. Idle service workers are automatically shutdown to preserve resources, but remain registered for future activation.

## Re-Activation

#### 10. Service worker is re-activated when an activation event occurs.

## Updates and Reloads

#### 11. When a new version of the extension or browser is updated, the background script is reloaded, and the service worker is re-registered.

## Deletion

#### 12. The extension can be uninstalled, which will remove all associated data and unregister the service worker.

