// Map to track which tabs were muted by the extension
const mutedTabs = new Map();

const AD_OPERATION_EVENT = 'RecordAdEvent';

// setup the content variable
const initHideScript = `document._$TtvAM_vPlayer = document.querySelector(".video-ref.Layout-sc-1xcs6mc-0 > video");`

// hides the video player
const hideScript = `
    document._$TtvAM_vPlayer.insertAdjacentHTML("beforebegin", \`
        <p id="TtvAM_ad-notice" style="font-size: 15px; margin-top: 8rem; text-align: center;">
            (Ads playing)
        </p>
    \`);
    document._$TtvAM_vPlayer.style.visibility = "hidden";
`;

// restores the video player
const clearHideScript = `
    document._$TtvAM_vPlayer.style.visibility = "";
    document.querySelector("#TtvAM_ad-notice").remove();
`;

// Set this to true after adHideScript has ran the first time.
let isInitialized = false;
let isMuted = false;

/**
 * This method parses the JSON requestBody to determine if the
 * GraphQL payload contains metrics for starting video ads
 * and for ending video ads.
 * @param {string} json
 * @returns {string}
 */
function getAdStatus(json) {
    if (!json || !json.length) return 'invalid';
    let { operationName, variables } = json[0];
    // Only process
    if (!operationName || !operationName.includes(AD_OPERATION_EVENT)) {
        console.debug("Non-ad event caught in request body:", json[0]);
        return 'non-ad';
    }
    const { input } = variables || {};
    const { eventName } = input || {};
    switch (eventName) {
        case 'video_ad_impression': 
            console.debug("Ad started event found in request body:", json[0]);
            return 'ad-started';
        case 'video_ad_quartile_complete':
            console.debug("Ad quartile complete event found in request body:", json[0]);
            return 'ad-started';
        case 'video_ad_pod_complete':
            console.debug("Ad completed event found in request body:", json[0]);
            return 'ad-completed';
        case 'ad_impression':
            console.debug("Non-video Ad impression event found in request body:", json[0]);
            return 'ad-rendered';
        default:
            console.debug("Invlaid ad event found in request body:", json[0]);
        return 'invalid';
    }
}

/**
 * Makes Browser and Content adjustments according to the adStatus
 * @param {string} adStatus 
 * @param {*} details 
 */
function handleAdStatus(adStatus, details) {
    if (adStatus === 'ad-started') {
        // only mute/hide if not already muted
        if (!isMuted){
            // Mute the tab where ads are started
            browser.tabs.update(details.tabId, { muted: true });
            browser.tabs.executeScript(details.tabId, { code: hideScript });
            mutedTabs.set(details.tabId, true);
            isMuted = true;
        }
    } else if (adStatus === 'ad-completed') {
        // Unmute the tab where the ads are stopped,
        // only if it was muted by the add-on
        if (mutedTabs.get(details.tabId)) {
            browser.tabs.update(details.tabId, { muted: false });
            browser.tabs.executeScript(details.tabId, { code: clearHideScript });
            mutedTabs.delete(details.tabId);
            isMuted = false;
        }
    }
}

// Request Listener
function handleRequest(details) {
    if (!isInitialized) {
        // setup content variable on first request
        browser.tabs.executeScript(details.tabId, { code: initHideScript });
        isInitialized = true;
        console.debug("Extension initialized.");
    }
    // Filter out non-POST requests
    if (details.method !== "POST") {
        return;
    }

    if (details.requestBody && details.requestBody.raw) {
        let decoder = new TextDecoder("utf-8");
        let bodyString = decoder.decode(details.requestBody.raw[0].bytes);
        if (bodyString) {
            console.debug("Using bodyString: ", bodyString);
            try {
                const jsonBody = JSON.parse(bodyString);
                const adStatus = getAdStatus(jsonBody);
                handleAdStatus(adStatus, details);
            } catch (error) {
                console.error("Failed to parse JSON body:", error, details);
            }
        } else {
            console.debug("No JSON body found in request: ", details);
        }
    }
}

browser.webRequest.onBeforeRequest.addListener(
    handleRequest,
    { urls: ["*://gql.twitch.tv/*"]},
    ["requestBody"]
);
