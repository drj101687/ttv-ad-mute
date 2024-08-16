# Twitch.tv Ad Mute

This is a simple Firefox Extension that listens for request to Twitch's GraphQL API, and automatically mutes appropriate Twitch tabs when the tab starts playing ads. 

The Tab will automatically be un-muted when the ads stop playing.


## Why mute tabs instead of video player?

Twitch captures analytics about the mute status of their video player, and it can negatively impact metrics for the Streamer you are watching or disable twitch-drop collections. This extension avoids those negative impacts by directly muting the Firefox tab.
