# Virtual Desk Assembly

A specialized 3D web application where you assemble a desk in virtual space! Drag the legs to the sockets to build your own furniture.

## Features
*   **Interactive 3D Assembly**: Drag and drop mechanic to assemble the desk.
*   **Physics-like Interaction**: Legs snap to sockets when close enough.
*   **Animations**: Smooth transitions for snapping, dragging, and the final desk flip.
*   **Responsive**: Works in modern web browsers.

## How to Run
This project uses standard web technologies (HTML, CSS, JS) with ES Modules. Because of module security policies, you need to serve it via a local web server rather than opening `index.html` directly.

### Using Python (Pre-installed on macOS/Linux)
1.  Open a terminal in the project directory.
2.  Run the following command:
    ```bash
    python3 -m http.server
    ```
3.  Open your browser and navigate to `http://localhost:8000`.

### Using other servers
You can use any static file server like `live-server`, `http-server` (Node.js), or the VS Code Live Server extension.

## Project Structure
```
.
├── css/
│   └── style.css       # UI Styles
├── js/
│   ├── main.js         # Main 3D logic and interaction
│   └── tween.js        # Animation library
├── index.html          # Entry point
└── README.md           # This file
```

## Technologies
*   **Three.js**: For 3D rendering and scene management.
*   **TWEEN.js**: For smooth animations.
*   **Vanilla JS**: No build tools required!

## License
MIT
