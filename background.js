// Map to track which tabs were muted by the extension
const mutedTabs = new Map();

const AD_OPERATION_EVENT = 'RecordAdEvent';

/**
 * This method parses the JSON requestBody to determine if the
 * GraphQL payload contains metrics for starting video ads
 * and for ending video ads.
 * @param json
 * @returns {string}
 */
function getAdStatus(json) {
    if (!json || !json.length) return 'invalid';
    let { operationName, variables } = json[0];
    // Only process
    if (!operationName || !operationName.includes(AD_OPERATION_EVENT)) {
        return 'invalid';
    }
    const { input } = variables || {};
    const { eventName } = input || {};
    if (eventName && eventName.includes('video_ad_impression')) {
        return 'ad-started';
    } else if (eventName === 'video_ad_pod_complete') {
        return 'ad-completed';
    } else {
        return 'invalid';
    }
}

const adHideScript = shouldHide => `
    const video = document.querySelector(".video-ref.Layout-sc-1xcs6mc-0 > video");
    video.style.visibility = "${shouldHide ? 'hidden' : ''}";
    ${shouldHide ? `
        video.insertAdjacentHTML("beforebegin", \`
            <p id="ad-notice" style="font-size: 15px; margin-top: 8rem; text-align: center;">
                (Ads playing)
            </p>
        \`);
    ` : `
        document.querySelector("#ad-notice").remove();
    `}
`;

// Request Listener
function handleRequest(details) {
    // Filter out non-POST requests
    if (details.method !== "POST") {
        return;
    }

    if (details.requestBody && details.requestBody.raw) {
        let decoder = new TextDecoder("utf-8");
        let bodyString = decoder.decode(details.requestBody.raw[0].bytes);
        try {
            const jsonBody = JSON.parse(bodyString);
            const adStatus = getAdStatus(jsonBody);
            if (adStatus === 'ad-started') {
                // Mute the tab where ads are started
                browser.tabs.update(details.tabId, { muted: true });
                browser.tabs.executeScript(details.tabId, { code: adHideScript(true) });
                mutedTabs.set(details.tabId, true);
            } else if (adStatus === 'ad-completed') {
                // Unmute the tab where the ads are stopped,
                // only if it was muted by the add-on
                if (mutedTabs.get(details.tabId)) {
                    browser.tabs.update(details.tabId, { muted: false });
                    browser.tabs.executeScript(details.tabId, { code: adHideScript(false) });
                    mutedTabs.delete(details.tabId);
                }
            }
        } catch (error) {
            console.error("Failed to parse JSON body:", error);
        }
    }
}

browser.webRequest.onBeforeRequest.addListener(
    handleRequest,
    { urls: ["*://gql.twitch.tv/*"]},
    ["requestBody"]
);
