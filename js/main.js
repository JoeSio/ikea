import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import TWEEN from './tween.js';

// --- CONFIGURATION ---
const SNAP_THRESHOLD = 0.8; // Distance to snap
const DESK_COLOR = 0xd1bfa7; // Wood color
const LEG_COLOR = 0x333333;  // Metal leg color
const GHOST_COLOR = 0x4CAF50; // Green hint

// --- GLOBALS ---
let scene, camera, renderer, controls;
let raycaster, pointer;
let draggingObject = null;
let plane; // Invisible plane for dragging
let dragOffset = new THREE.Vector3();
let legs = [];
let sockets = [];
let tableGroup; // Holds the table top + sockets
let assembledCount = 0;
let isGameFinished = false;

init();
animate();

function init() {
    // 1. SCENE SETUP
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Fog for depth
    scene.fog = new THREE.Fog(0xf0f0f0, 10, 50);

    // 2. CAMERA
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 8, 10);
    camera.lookAt(0, 0, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // 5. ENVIRONMENT (Floor)
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0.0
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid Helper
    const grid = new THREE.GridHelper(50, 50, 0xcccccc, 0xe5e5e5);
    scene.add(grid);

    // 6. OBJECT CREATION (The Desk)
    createDeskComponents();

    // 7. INTERACTION SETUP
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    // Drag Plane (Math plane for raycasting against)
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Don't go below floor

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    // Remove loader
    document.getElementById('loader').style.opacity = 0;
    setTimeout(() => document.getElementById('loader').style.display = 'none', 500);
}

function createDeskComponents() {
    tableGroup = new THREE.Group();

    // -- TABLE TOP --
    // We place it upside down for assembly!
    // Y position = 1.0 (legs are height 2.0, so upside down top is at roughly y=0.1 if sitting on floor)
    // Let's float it slightly to make it easy to see sockets.
    const topGeo = new THREE.BoxGeometry(4, 0.2, 2.5);
    const topMat = new THREE.MeshStandardMaterial({ color: DESK_COLOR, roughness: 0.5 });
    const tableTop = new THREE.Mesh(topGeo, topMat);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    tableTop.userData.isTable = true;
    tableGroup.add(tableTop);

    // Position the Group (Upside down, hovering slightly)
    tableGroup.position.set(0, 1.5, 0);
    // Rotate 180 on Z to be upside down
    tableGroup.rotation.z = Math.PI;
    scene.add(tableGroup);

    // -- SOCKETS (Ghosts) --
    // Where the legs should go relative to the table center
    const positions = [
        { x: -1.5, z: -0.8 },
        { x: 1.5, z: -0.8 },
        { x: -1.5, z: 0.8 },
        { x: 1.5, z: 0.8 }
    ];

    const socketGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 16);
    const socketMat = new THREE.MeshBasicMaterial({
        color: GHOST_COLOR,
        transparent: true,
        opacity: 0.4,
        wireframe: false
    });

    // Pulse animation helper
    const ringGeo = new THREE.RingGeometry(0.15, 0.2, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: GHOST_COLOR, side: THREE.DoubleSide, transparent:true, opacity: 0.8 });

    positions.forEach((pos, i) => {
        // The socket mesh
        const socket = new THREE.Mesh(socketGeo, socketMat.clone());

        // Position relative to TableTop (which is 0,0,0 inside the group)
        // Table is 0.2 thick, so bottom (which is visually top when upside down) is at y = -0.1 relative to center
        // Actually, since we rotated the group, 'up' relative to the mesh is 'down' in world.
        // Let's attach them to the "bottom" face.
        socket.position.set(pos.x, -0.1, pos.z);
        socket.userData = { isSocket: true, id: i, filled: false };

        // Add a visual ring
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.11; // Slightly above socket
        socket.add(ring);

        tableGroup.add(socket);
        sockets.push(socket);
    });

    // -- LEGS (Draggables) --
    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.8, 16);
    const legMat = new THREE.MeshStandardMaterial({ color: LEG_COLOR, roughness: 0.3, metalness: 0.5 });

    for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(legGeo, legMat);

        // Scatter them on the floor
        // Random position within a radius, ensuring not too close to center
        let angle = Math.random() * Math.PI * 2;
        let radius = 3 + Math.random() * 2;
        leg.position.set(
            Math.cos(angle) * radius,
            0.1, // Lying flat-ish? Let's stand them up for easier grabbing, or lay them down
            Math.sin(angle) * radius
        );

        // Let's lay them down initially
        leg.rotation.x = Math.PI / 2;
        leg.rotation.z = Math.random() * Math.PI;

        leg.castShadow = true;
        leg.receiveShadow = true;
        leg.userData = { isDraggable: true, id: i, snapped: false };

        scene.add(leg);
        legs.push(leg);
    }
}

// --- INTERACTION LOGIC ---

function onPointerMove(event) {
    // Update raycaster
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    // DRAGGING LOGIC
    if (draggingObject) {
        // Raycast against the invisible math plane to get world position
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersectPoint);

        if (intersectPoint) {
            // Move object, maintaining offset
            // We drag on the XZ plane at specific height
            const newPos = intersectPoint.sub(dragOffset);

            // Simple springy follow or direct set
            draggingObject.position.set(newPos.x, 2, newPos.z); // Lift leg to height 2 while dragging

            // Visual check for snapping
            checkSnapPreview();
        }
        return; // Skip hover logic if dragging
    }

    // HOVER LOGIC (Cursor change)
    const intersects = raycaster.intersectObjects(legs);
    if (intersects.length > 0 && !intersects[0].object.userData.snapped) {
        document.body.style.cursor = 'grab';
        // Highlight
        intersects[0].object.material.emissive.setHex(0x333333);
    } else {
        document.body.style.cursor = 'default';
        // Reset emission
        legs.forEach(l => {
            if(!l.userData.snapped) l.material.emissive.setHex(0x000000);
        });
    }
}

function onPointerDown(event) {
    if (isGameFinished) return;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(legs);

    if (intersects.length > 0) {
        const obj = intersects[0].object;

        if (!obj.userData.snapped) {
            // Disable controls while dragging
            controls.enabled = false;

            draggingObject = obj;

            // Set plane constant to intersect at object's center height for smooth grab
            // But we want to drag on a fixed Y plane mostly
            plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), obj.position);

            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, intersectPoint);

            if (intersectPoint) {
                dragOffset.copy(intersectPoint).sub(obj.position);
            }

            document.body.style.cursor = 'grabbing';

            // Right the leg up while dragging
            new TWEEN.Tween(draggingObject.rotation)
                .to({ x: 0, z: 0 }, 200)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();
        }
    }
}

function onPointerUp() {
    if (draggingObject) {
        // Check snapping
        const snapped = attemptSnap(draggingObject);

        if (!snapped) {
            // Drop to floor
            new TWEEN.Tween(draggingObject.position)
                .to({ y: 0.1 }, 400)
                .easing(TWEEN.Easing.Bounce.Out)
                .start();
            new TWEEN.Tween(draggingObject.rotation)
                .to({ x: Math.PI/2, z: Math.random() * Math.PI }, 400)
                .start();
        }

        draggingObject = null;
        controls.enabled = true;
        document.body.style.cursor = 'default';
    }
}

function checkSnapPreview() {
    // Find closest empty socket
    let closestDist = Infinity;
    let closestSocket = null;

    // Calculate world position of sockets
    sockets.forEach(socket => {
        if (socket.userData.filled) return;

        const worldPos = new THREE.Vector3();
        socket.getWorldPosition(worldPos);

        // We only care about XZ distance for snapping guide
        const dist = Math.sqrt(
            Math.pow(draggingObject.position.x - worldPos.x, 2) +
            Math.pow(draggingObject.position.z - worldPos.z, 2)
        );

        if (dist < closestDist) {
            closestDist = dist;
            closestSocket = socket;
        }
    });

    // If near a socket, highlight that socket
    sockets.forEach(s => s.material.color.setHex(GHOST_COLOR)); // Reset
    if (closestSocket && closestDist < SNAP_THRESHOLD) {
        closestSocket.material.color.setHex(0xFFFF00); // Yellow highlight
    }
}

function attemptSnap(obj) {
    let closestDist = Infinity;
    let targetSocket = null;

    sockets.forEach(socket => {
        if (socket.userData.filled) return;

        const worldPos = new THREE.Vector3();
        socket.getWorldPosition(worldPos);

        const dist = new THREE.Vector2(obj.position.x - worldPos.x, obj.position.z - worldPos.z).length();

        if (dist < SNAP_THRESHOLD) {
            closestDist = dist;
            targetSocket = socket;
        }
    });

    if (targetSocket) {
        // SNAP ACTION
        targetSocket.userData.filled = true;
        obj.userData.snapped = true;
        obj.material.emissive.setHex(0x000000);

        // Attach leg to the table group so it moves with it
        // We need to convert leg world position/rotation to group local space?
        // Actually easier: just parent it to the socket

        // 1. Move leg to exact world position of socket first
        const socketWorldPos = new THREE.Vector3();
        targetSocket.getWorldPosition(socketWorldPos);

        // Animate into place
        new TWEEN.Tween(obj.position)
            .to({ x: socketWorldPos.x, y: socketWorldPos.y - 0.9, z: socketWorldPos.z }, 200) // -0.9 because cylinder origin is center
            .easing(TWEEN.Easing.Back.Out)
            .onComplete(() => {
                // Logic to strictly attach it to the parent group
                scene.remove(obj);
                tableGroup.add(obj); // Child of tableGroup
                obj.position.copy(targetSocket.position);
                obj.position.y -= 0.9;
                obj.rotation.set(0, 0, 0);

                // Hide the ghost helper
                targetSocket.visible = false;

                assembledCount++;
                checkWinCondition();
            })
            .start();

        // Play snap sound (optional, simulated visually for now)
        return true;
    }
    return false;
}

function checkWinCondition() {
    if (assembledCount === 4) {
        isGameFinished = true;
        setTimeout(celebrateAndFlip, 500);
    }
}

function celebrateAndFlip() {
    // Animate Table Flip
    // 1. Lift up
    new TWEEN.Tween(tableGroup.position)
        .to({ y: 3 }, 500)
        .easing(TWEEN.Easing.Cubic.Out)
        .chain(
            // 2. Rotate to upright (Z from PI to 0)
            new TWEEN.Tween(tableGroup.rotation)
                .to({ z: 0 }, 1000)
                .easing(TWEEN.Easing.Bounce.Out)
                .onUpdate(() => {
                    // Keep updating light/shadows
                })
                .chain(
                    // 3. Drop to floor
                    new TWEEN.Tween(tableGroup.position)
                        .to({ y: 1.9 }, 500) // Legs are 1.8 + top is 0.2/2... math: Leg height 1.8. Table y needs to be at 1.8 + half thickness 0.1 = 1.9
                        .easing(TWEEN.Easing.Bounce.Out)
                        .onComplete(() => {
                            // Show UI
                            document.getElementById('success-msg').style.display = 'block';
                            createConfetti();
                        })
                )
        )
        .start();
}

// --- UTILS & ANIMATION LOOP ---

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);

    // Subtle pulse for ghost sockets
    const pulse = 1 + Math.sin(time * 0.005) * 0.1;
    sockets.forEach(s => {
        if(s.visible) s.scale.set(pulse, pulse, pulse);
    });

    controls.update();
    renderer.render(scene, camera);
}

function createConfetti() {
    const colors = [0xFFC107, 0x2196F3, 0x4CAF50, 0xE91E63];
    const geometry = new THREE.PlaneGeometry(0.1, 0.1);

    for(let i=0; i<100; i++) {
        const material = new THREE.MeshBasicMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            side: THREE.DoubleSide
        });
        const confetti = new THREE.Mesh(geometry, material);

        confetti.position.set(
            (Math.random() - 0.5) * 4,
            4 + Math.random() * 2,
            (Math.random() - 0.5) * 4
        );

        confetti.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
        scene.add(confetti);

        // Fall animation
        new TWEEN.Tween(confetti.position)
            .to({ y: 0 }, 2000 + Math.random() * 1000)
            .easing(TWEEN.Easing.Linear.None)
            .start();

        new TWEEN.Tween(confetti.rotation)
            .to({ x: Math.random()*10, y: Math.random()*10 }, 2000)
            .start();
    }
}
