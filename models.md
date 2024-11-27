# Extension States

## Background Service worker
* idle
* active

## Content Script
* playerHidden
* playerVisible

## Tab
* muted
* unmuted

## Popup
* open
* closed

# Background Script Models

## Extension State
#### State Properties
* debugMode: boolean
* playerHidden: boolean
* mutedTabs: number

## Request Wrapper
#### Tasks
* Process a request object and determine the requestType

#### Request Types
* invalid
* non-ad
* ad-started
* ad-completed
* ad-rendered

## Ad Monitor
#### Tasks
* Handle filtered Twitch GQL API requests
* Handle communication to other scripts
* Handle session storage variables for state tracking

#### Stages
1. Idle and listening for activation events
2. Active and listening for ad events


## Background Logger

#### Tasks
* Wrap console logging with debug mode toggle

#### Stages
1. Instantiated by Ad Monitor

# Content Script Models

## Player Monitor

#### Tasks
* Handle Dom changes and player visibility
* Handle communication from the background script
* ?? TBD: should we have an activation signal that can be sent to activate the backend?

#### Stages
1. Unloaded
2. Loaded and listening for background messages

# Popup Models

## Popup Monitor

#### Tasks
* Handle Debug Mode Toggling
* Handle Manual Tab Mute Toggling
* Handle Manual Player show/hide Toggling
* Handle communication with the background script to update settings

#### Stages
1. Closed and inactive
2. Open and activating the background service worker
