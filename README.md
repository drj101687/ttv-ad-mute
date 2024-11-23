# Twitch.tv Ad Mute

This is a simple Firefox Extension that listens for request to Twitch's GraphQL API, and automatically mutes appropriate Twitch tabs when the tab starts playing ads. Additionally, when the extension mutes the Firefox Tab, the Twitch video player will be visually hidden and helper text will be displayed in it's place.

The Tab will automatically be un-muted when the ads stop playing and the Twitch video player will be re-appear with the streamer's broadcast playing.


## Why mute tabs instead of video player?

Twitch captures analytics about the mute status of their video player, and it can negatively impact metrics for the Streamer you are watching or disable twitch-drop collections. This extension avoids those negative impacts by directly muting the Firefox tab.


# Installation

Install in the Firefox Addons store [https://addons.mozilla.org/en-US/firefox/addon/twitch-tv-ad-mute/](https://addons.mozilla.org/en-US/firefox/addon/twitch-tv-ad-mute/)

# Contributing to Twitch Ad Mute Extension

We welcome contributions from the community! Here are some guidelines to help you get started.

## Reporting Issues

If you encounter any issues or have suggestions for improvements, please open an issue on our [GitHub Issues page](https://github.com/drj101687/ttv-ad-mute/issues).

### Issue Guidelines

- Provide a clear and descriptive title.
- Include detailed information about the problem, including steps to reproduce it.
- Mention your browser version and operating system.

## Pull Requests

We welcome pull requests for bug fixes, new features, and improvements. Here are some guidelines:

1. **Fork the repository** on GitHub.
2. **Create a new branch** with a descriptive name (e.g., `fix-ad-detection`).
3. Make your changes and commit them with clear messages.
4. **Push your changes** to your forked repository.
5. Open a pull request from your branch to the main branch of this repository.

### Pull Request Guidelines

- Provide a clear and descriptive title for your pull request.
- Include a detailed description of what your changes do and why they are necessary.
- Ensure that your code follows our coding standards (if any).
- If your pull request fixes an issue, reference it in the description using `#issue-number`.

## Coding Standards

- Follow the existing code style and conventions.
- Write clear and concise comments where necessary.
- Use meaningful variable and function names.

Thank you for contributing to Twitch.tv Ad Mute Extension!