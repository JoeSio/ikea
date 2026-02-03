# AI Agent Instructions for Virtual Desk Assembly

This document provides context and instructions for AI agents working on this codebase.

## Project Overview
This is a web-based 3D application where users assemble a virtual desk by dragging legs into sockets. It uses Three.js for rendering and interaction, and TWEEN.js for animations.

## Tech Stack
*   **HTML5/CSS3**: Basic structure and UI.
*   **JavaScript (ES6+)**: Logic using ES modules (`type="module"`).
*   **Three.js**: 3D engine (loaded via CDN import map in `index.html`).
*   **TWEEN.js**: Animation engine (local file `js/tween.js`).

## Development Environment
*   The project does not use a bundler (like Webpack or Vite). It relies on native ES modules.
*   To run the project, serve the root directory with a static file server.
    *   Example: `python3 -m http.server`
*   Open the browser at `http://localhost:8000` (or whatever port the server uses).

## Codebase Structure
*   `index.html`: Entry point. Includes the import map for Three.js.
*   `css/style.css`: Styles for the overlay UI.
*   `js/main.js`: Main application logic (Three.js setup, interaction, game loop).
*   `js/tween.js`: TWEEN library for animations.

## Coding Conventions
*   Use ES modules syntax (`import`/`export`).
*   Keep logic in `js/main.js` unless it grows significantly.
*   Three.js imports should match the import map in `index.html`.
*   Ensure the UI remains responsive and accessible.
*   Do not introduce build steps or package managers (npm/yarn) unless explicitly requested. Keep it "no-build".

## Verification
*   Use `python3 -m http.server` to serve the files.
*   Frontend verification can be done using Playwright if needed.
