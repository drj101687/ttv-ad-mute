# Twitch.tv Ad Mute

This is a simple Firefox Extension that listens for request to Twitch's GraphQL API, and automatically mutes appropriate Twitch tabs when the tab starts playing ads. Additionally, when the extension mutes the Firefox Tab, the Twitch video player will be visually hidden and helper text will be displayed in it's place. 

The Tab will automatically be un-muted when the ads stop playing and the Twitch video player will be re-appear with the streamer's broadcast playing.


## Why mute tabs instead of video player?

Twitch captures analytics about the mute status of their video player, and it can negatively impact metrics for the Streamer you are watching or disable twitch-drop collections. This extension avoids those negative impacts by directly muting the Firefox tab.


# Installation

Install in the Firefox Addons store [https://addons.mozilla.org/en-US/firefox/addon/twitch-tv-ad-mute/](https://addons.mozilla.org/en-US/firefox/addon/twitch-ad-mute/)