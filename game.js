// --- Start of game.js ---
console.log("--- game.js script started parsing ---");

// Declare global variables needed before DOMContentLoaded
const canvas = document.getElementById("renderCanvas");
let engine = null; // Initialize engine later
let score = 0;
let lives = 3; // Use constant later if needed
let isGameOver = false;
let playerShip = null;
let bullets = [];
let asteroids = [];
let lastAsteroidSpawnTime = 0;
let playerVelocity = null; // Initialize later
let playerInvincible = false;
let playerRespawnTime = 0;
let scoreText, livesText, gameOverText;
let guiPlane = null; // For placing GUI in 3D space

// Game Constants (can be defined globally)
const PLAYER_SPEED = 0.08; // Acceleration factor per input
const PLAYER_MAX_SPEED = 1.5; // Max speed limit
const PLAYER_DAMPING = 0.98; // Velocity decay factor per frame
const PLAYER_ROTATION_SPEED = 0.05;
const BULLET_SPEED = 0.7; // Increased bullet speed slightly
const BULLET_LIFETIME = 80; // Frames (a bit longer range)
const ASTEROID_MIN_SPEED = 0.01;
const ASTEROID_MAX_SPEED = 0.04;
const ASTEROID_SPAWN_INTERVAL = 1000; // Milliseconds
const ASTEROID_MAX_COUNT = 15;
const PLAY_AREA_SIZE = 30; // Half-width/height/depth
const INITIAL_LIVES = 3; // Use this for consistency
const RESPAWN_INVINCIBILITY_TIME = 3000; // Milliseconds


// --- Function to Initialize and Run the Game ---
async function initializeGame() {
    console.log("--- initializeGame() called (after DOMContentLoaded) ---");

    if (!canvas) {
        console.error("Fatal Error: Canvas element not found during initialization.");
        alert("Fatal Error: Canvas not found!");
        return;
    }

    if (typeof BABYLON === 'undefined') {
        console.error("Fatal Error: BABYLON library is not loaded when initializeGame() runs!");
        alert("Error: Babylon.js library failed to load. Check internet connection and script tags in index.html.");
        return;
    }
     console.log("BABYLON object confirmed loaded.");

    engine = new BABYLON.Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true }, true);
    console.log("Babylon Engine created:", engine);
    lives = INITIAL_LIVES;
    playerVelocity = new BABYLON.Vector3(0, 0, 0);

    // Create Scene
    const scene = await createScene(); // createScene now needs engine access

    // Start Render Loop if Scene was created
    if (scene) {
         console.log("Scene created successfully, starting render loop.");
        engine.runRenderLoop(function () {
            if (scene.isReady()) {
                 scene.render();
            }
        });

        window.addEventListener("resize", function () {
            console.log("Window resized");
            engine.resize();
        });
    } else {
        console.error("Scene creation failed. Render loop not started.");
        alert("Failed to create the game scene. Check the console for errors.");
    }
}

// --- Scene Creation (needs engine access) ---
const createScene = async function () {
    console.log("--- createScene called ---");

    const scene = new BABYLON.Scene(engine);
    console.log("Scene object created:", scene);
    scene.clearColor = new BABYLON.Color4(0, 0, 0.05, 1); // Slightly blue-black space

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.8;

    // --- Logging ---
    console.log("Checking BABYLON.MeshBuilder:", typeof BABYLON.MeshBuilder);
    if(!BABYLON.MeshBuilder){
         console.error("BABYLON.MeshBuilder is undefined! Cannot create meshes.");
         alert("Critical Error: Babylon.js MeshBuilder module not loaded correctly.");
         return null;
    }
     console.log("Using PascalCase (CreateCone) based on previous test results.");

    // Player Ship Mesh
    try {
        if (typeof BABYLON.MeshBuilder?.CreateCone !== 'function') {
             throw new Error('BABYLON.MeshBuilder.CreateCone is not available.');
        }

        playerShip = BABYLON.MeshBuilder.CreateCone("playerShip", { height: 0.8, diameterBottom: 0.5, diameterTop: 0, tessellation: 16 }, scene);
        console.log("Player ship mesh (Cone) created successfully using CreateCone.");

        // Rotate the cone so its tip points forward along the positive Z axis in world space
        playerShip.rotation.x = Math.PI / 2;

        playerShip.position = new BABYLON.Vector3(0, 0, 0);
        playerShip.metadata = { type: "player" };
        playerShip.isVisible = true;
        playerShip.setEnabled(true);

    } catch (meshError) {
        console.error("!!! CRITICAL ERROR creating playerShip mesh:", meshError);
        alert("Failed to create player ship mesh. Check console for details. Error: " + meshError.message);
        playerShip = null; // Ensure playerShip is null
    }

    // --- WebXR Setup ---
    let xrExperience = null;
    let xrCamera = null; // Keep track of the XR camera specifically
    try {
        console.log("Attempting WebXR initialization...");
        xrExperience = await scene.createDefaultXRExperienceAsync({
            floorMeshes: [],
            disableTeleportation: true
        });
        console.log("WebXR Experience Result:", xrExperience);

        if (!xrExperience || !xrExperience.baseExperience) {
            console.error("WebXR not supported or failed to initialize base experience.");
            alert("WebXR not supported or failed to initialize.");
            // Fallback Camera if XR fails
            const camera = new BABYLON.FreeCamera("fallbackCamera", new BABYLON.Vector3(0, 5, -10), scene);
            camera.setTarget(BABYLON.Vector3.Zero());
        } else {
            console.log("WebXR baseExperience available.");
            xrCamera = xrExperience.baseExperience.camera; // Get the XR camera

             if (playerShip) {
                // Set the camera position relative to the ship (cockpit view)
                xrCamera.position = new BABYLON.Vector3(0, 0.2, -0.5); // Slightly above and behind the ship's origin
                // Parent the camera to the ship
                xrCamera.parent = playerShip;
                console.log("WebXR camera attached to player ship.");
            } else {
                 console.warn("Player ship failed to create, WebXR camera not attached.");
                 xrCamera.position = new BABYLON.Vector3(0, 1.6, 0); // Default world position if no ship
            }
            setupXRInput(xrExperience); // Setup controller input
        }
    } catch (e) {
        console.error("!!! Error during WebXR initialization:", e);
        alert("Failed to initialize WebXR. Error: " + e.message);
         // Fallback Camera if XR init throws error
        const camera = new BABYLON.FreeCamera("fallbackCameraOnError", new BABYLON.Vector3(0, 5, -10), scene);
        camera.setTarget(BABYLON.Vector3.Zero());
    }

    // --- GUI Setup (Now uses a 3D plane parented to the camera/ship) ---
    // We need the xrCamera, so setup GUI *after* attempting XR init
    setupGUI(scene, playerShip); // Pass playerShip reference

    // --- Game Logic ---
    scene.onBeforeRenderObservable.add(updateGameLogic);

    console.log("--- createScene finished ---");
    return scene;
}; // --- End of createScene async function ---


// --- Input Setup Function ---
function setupXRInput(xr) {
     if (!xr || !xr.input) { console.error("Cannot setup XR input: Invalid XR experience."); return; }
    xr.input.onControllerAddedObservable.add((controller) => {
        console.log("Controller Added:", controller.uniqueId);
        controller.onMotionControllerInitObservable.add((motionController) => {
            console.log("Motion Controller Initialized:", motionController.id, motionController.handedness);

            // --- Common input handling for either controller ---
            const trigger = motionController.getComponentOfType('trigger');
            if (trigger) {
                console.log("Trigger found on", motionController.handedness);
                trigger.onButtonStateChangedObservable.add((component) => {
                    // Fire only on press down (changed.value goes from 0 to 1)
                    if (component.changes.pressed?.current === true && !isGameOver && playerShip && playerShip.isEnabled()) {
                        fireBullet();
                    }
                });
            } else console.warn("Trigger component not found on controller:", motionController.id);

            // --- Movement controls (typically on left controller) ---
             if (motionController.handedness === 'left') {
                 const thumbstick = motionController.getComponentOfType('thumbstick');
                 if (thumbstick) {
                    console.log("Thumbstick found on left controller");
                    thumbstick.onAxisValueChangedObservable.add((axes) => {
                        if (isGameOver || !playerShip || !playerShip.isEnabled()) return;

                        // Rotation (Yaw) based on X-axis
                        if (axes.x < -0.1) playerShip.rotation.y -= PLAYER_ROTATION_SPEED;
                        else if (axes.x > 0.1) playerShip.rotation.y += PLAYER_ROTATION_SPEED;

                        // Thrust (Forward/Backward) based on Y-axis
                        if (axes.y < -0.1) { // Pushed forward
                            // Calculate forward thrust vector based on ship's current orientation
                            // playerShip.forward points along the local -Z axis. Since our cone points along world +Z,
                            // we need the inverse direction for forward thrust.
                             const forwardDirection = playerShip.forward.scale(-1).normalize(); // Direction cone points
                            const thrust = forwardDirection.scale(-axes.y * PLAYER_SPEED); // Scale by thumbstick amount and speed factor
                            playerVelocity.addInPlace(thrust);
                        }
                         // Optional: Add backward thrust if needed
                         /* else if (axes.y > 0.1) { // Pulled backward
                             const backwardDirection = playerShip.forward.normalize(); // Direction opposite cone points
                             const thrust = backwardDirection.scale(axes.y * PLAYER_SPEED); // Scale by thumbstick amount
                             playerVelocity.addInPlace(thrust);
                         } */
                    });
                } else console.warn("Thumbstick component not found on left controller:", motionController.id);
             }

              // --- Optional: Use right thumbstick for something else? (e.g., Roll) ---
              /*
              if (motionController.handedness === 'right') {
                  const thumbstick = motionController.getComponentOfType('thumbstick');
                   if (thumbstick) {
                       thumbstick.onAxisValueChangedObservable.add((axes) => {
                           if (isGameOver || !playerShip || !playerShip.isEnabled()) return;
                           // Example: Roll control
                           //if (axes.x < -0.1) playerShip.rotation.z += PLAYER_ROTATION_SPEED;
                           //else if (axes.x > 0.1) playerShip.rotation.z -= PLAYER_ROTATION_SPEED;
                       });
                   }
              }
              */
        });
    });
    xr.input.onControllerRemovedObservable.add((controller) => { console.log("Controller Removed:", controller.uniqueId); });
     console.log("XR Input Handling Setup Complete.");
}


// --- GUI Setup Function (Modified for 3D Plane in VR) ---
function setupGUI(scene, anchorMesh) { // Pass the mesh to anchor the GUI (e.g., playerShip)
     if (typeof BABYLON.GUI === 'undefined') { console.error("BABYLON.GUI is not loaded!"); alert("Error: Babylon GUI library not loaded."); return; }
     if (!anchorMesh) { console.warn("Cannot create 3D GUI without an anchor mesh (playerShip)."); return;}

    // Create a plane mesh for the GUI texture
    guiPlane = BABYLON.MeshBuilder.CreatePlane("guiPlane", { width: 1, height: 0.5 }, scene);
    guiPlane.parent = anchorMesh; // Attach to the player ship
    // Position the plane in front of the ship's cockpit view
    guiPlane.position = new BABYLON.Vector3(0, 0.3, 1.5); // Adjust X, Y, Z as needed for visibility
    guiPlane.rotation.y = Math.PI; // Make it face the camera inside the ship

    // Make the plane itself invisible, only show the GUI texture
    const transparentMat = new BABYLON.StandardMaterial("guiPlaneMat", scene);
    transparentMat.alpha = 0; // Fully transparent
    guiPlane.material = transparentMat;

    // Create GUI texture attached to the plane
    const guiTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(guiPlane, 1024, 512, false); // Higher resolution for clarity
    // guiTexture.scaleTo(1, 1); // Adjust scaling if needed

    console.log("3D GUI Texture created for mesh.");

    const panel = new BABYLON.GUI.StackPanel();
    panel.width = "95%"; // Use percentage of the texture width
    panel.isVertical = true;
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    panel.paddingTop = "20px";
    guiTexture.addControl(panel);

    scoreText = new BABYLON.GUI.TextBlock("scoreText", "Score: 0");
    scoreText.color = "white";
    scoreText.fontSize = 48; // Larger font for VR readability
    scoreText.height = "80px"; // Adjust height
    panel.addControl(scoreText);

    livesText = new BABYLON.GUI.TextBlock("livesText", `Lives: ${INITIAL_LIVES}`);
    livesText.color = "white";
    livesText.fontSize = 48; // Larger font
    livesText.height = "80px"; // Adjust height
    panel.addControl(livesText);

    // Game Over Text - Position it centrally on the GUI texture
    gameOverText = new BABYLON.GUI.TextBlock("gameOverText", "GAME OVER");
    gameOverText.color = "red";
    gameOverText.fontSize = 96; // Much larger
    gameOverText.fontWeight = "bold";
    gameOverText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    gameOverText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    gameOverText.isVisible = false;
    // Add directly to the texture, not the panel, for centering
    guiTexture.addControl(gameOverText);

    console.log("3D UI Elements created.");
}


// --- Game Logic Update Function ---
function updateGameLogic() {
    if (isGameOver) return;
    //const deltaTime = engine.getDeltaTime() / 1000.0; // Use deltaTime if needed for frame-rate independence

    if (playerShip && playerShip.isEnabled()) {
        // Apply damping to velocity
        playerVelocity.scaleInPlace(PLAYER_DAMPING);

        // Clamp velocity to max speed
        if (playerVelocity.lengthSquared() > PLAYER_MAX_SPEED * PLAYER_MAX_SPEED) {
            playerVelocity.normalize().scaleInPlace(PLAYER_MAX_SPEED);
        }

        // Update position based on velocity
        playerShip.position.addInPlace(playerVelocity);

        // Keep player within bounds
        wrapAround(playerShip);
    }

    updateBullets(); // Pass deltaTime if bullet logic needs it
    updateAsteroids(); // Pass deltaTime if asteroid logic needs it
    spawnAsteroidsIfNeeded();
    checkCollisions();

    if (lives <= 0 && !isGameOver) {
        endGame();
    }

    // Handle player invincibility flashing
    if (playerInvincible && playerShip) {
        const now = Date.now();
        if (now > playerRespawnTime + RESPAWN_INVINCIBILITY_TIME) {
            playerInvincible = false;
            // Ensure ship is visible and enabled when invincibility ends
            playerShip.isVisible = true;
            playerShip.setEnabled(true);
            // Make sure children (like the camera and GUI plane) are also handled correctly if they were hidden
            playerShip.getChildMeshes().forEach(m => m.isVisible = true); // Show child meshes like GUI plane if needed
            console.log("Player no longer invincible");
        } else {
            // Flash the ship mesh itself
            const isVisible = Math.floor((now - playerRespawnTime) / 150) % 2 === 0;
            playerShip.isVisible = isVisible;
             // Optionally flash child meshes too if desired
             // playerShip.getChildMeshes().forEach(m => m.isVisible = isVisible);
        }
    }
}


// --- Helper Functions (Using PascalCase for MeshBuilder) ---

function fireBullet() {
    if (!playerShip || !playerShip.isEnabled() || !playerShip.getScene()) { return; }
    const scene = playerShip.getScene();

    if (typeof BABYLON.MeshBuilder?.CreateSphere !== 'function') { console.error("Cannot fire bullet: CreateSphere missing."); return; }

    const bullet = BABYLON.MeshBuilder.CreateSphere("bullet", { diameter: 0.2 }, scene);

    // Start bullet slightly in front of the ship's nose
    const forwardDirection = playerShip.forward.scale(-1).normalize(); // Direction cone points
    const bulletOffset = forwardDirection.scale(0.6); // Start ahead of ship origin
    bullet.position = playerShip.position.add(bulletOffset);

    // Set bullet velocity
    bullet.metadata = {
        velocity: forwardDirection.scale(BULLET_SPEED),
        life: BULLET_LIFETIME,
        type: "bullet"
    };

    if (typeof BABYLON.StandardMaterial === 'function') {
        const bulletMat = new BABYLON.StandardMaterial("bulletMat", scene);
        bulletMat.diffuseColor = new BABYLON.Color3(1, 1, 0); // Yellow
        bulletMat.emissiveColor = new BABYLON.Color3(0.8, 0.8, 0); // Glowing yellow
        bullet.material = bulletMat;
    }
    bullets.push(bullet);
}

function updateBullets() { // Removed deltaTime unless needed
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (!bullet || !bullet.metadata) { bullets.splice(i, 1); continue; }

        bullet.position.addInPlace(bullet.metadata.velocity);
        bullet.metadata.life--;

        if (bullet.metadata.life <= 0 || isOutOfBounds(bullet.position)) {
            bullet.dispose();
            bullets.splice(i, 1);
        }
    }
}

function createAsteroid() {
    const scene = engine.scenes[0];
    if (!scene) { console.error("Cannot create asteroid: Scene not found."); return; }

    const size = 1 + Math.random() * 2; // Random size between 1 and 3
    let asteroid = null;

    try {
        if (typeof BABYLON.MeshBuilder?.CreateIcosahedron === 'function') {
             asteroid = BABYLON.MeshBuilder.CreateIcosahedron("asteroid", { radius: size, subdivisions: 1 }, scene); // Less subdivisions for performance
        } else if (typeof BABYLON.MeshBuilder?.CreateIcoSphere === 'function') {
             console.warn("CreateIcosahedron missing, using CreateIcoSphere as fallback.");
             asteroid = BABYLON.MeshBuilder.CreateIcoSphere("asteroid", { radius: size, subdivisions: 1 }, scene);
        } else {
             console.error("Cannot create asteroid: CreateIcosahedron and CreateIcoSphere missing.");
             return; // Exit if no suitable mesh creation function found
        }
        setupAsteroid(asteroid, size, scene); // Call common setup
    } catch (e) {
        console.error("Error creating asteroid mesh:", e);
    }

}

// Helper to set up asteroid properties after creation
function setupAsteroid(asteroid, size, scene) {
    // Spawn position logic (ensure it's far enough from the center initially)
    let spawnPos;
    do {
        const edgeDist = PLAY_AREA_SIZE * 0.8; // Spawn closer to the edge
        const x = (Math.random() * 2 - 1) * edgeDist;
        const y = (Math.random() * 2 - 1) * edgeDist;
        const z = (Math.random() * 2 - 1) * edgeDist;
        spawnPos = new BABYLON.Vector3(x, y, z);
        // Ensure spawning on one of the 'faces' of the cube boundary
        const axis = Math.floor(Math.random()*3);
        const side = Math.random() < 0.5 ? -1 : 1;
        if(axis === 0) spawnPos.x = PLAY_AREA_SIZE * side;
        else if(axis === 1) spawnPos.y = PLAY_AREA_SIZE * side;
        else spawnPos.z = PLAY_AREA_SIZE * side;

    } while (playerShip && spawnPos.subtract(playerShip.position).lengthSquared() < 100); // Don't spawn right on top of player

    asteroid.position = spawnPos;


    const speed = ASTEROID_MIN_SPEED + Math.random() * (ASTEROID_MAX_SPEED - ASTEROID_MIN_SPEED);
    // Aim velocity somewhat towards the center area for more engagement
    const targetPoint = new BABYLON.Vector3(
        (Math.random() - 0.5) * PLAY_AREA_SIZE * 0.5,
        (Math.random() - 0.5) * PLAY_AREA_SIZE * 0.5,
        (Math.random() - 0.5) * PLAY_AREA_SIZE * 0.5
    );
    const velocity = targetPoint.subtract(asteroid.position).normalize().scale(speed);

    // Add random rotation speed
    const rotationSpeed = (Math.random() - 0.5) * 0.1;
    asteroid.metadata = { velocity: velocity, type: "asteroid", size: size, rotationSpeed: rotationSpeed };

    if (typeof BABYLON.StandardMaterial === 'function') {
        const asteroidMat = new BABYLON.StandardMaterial("asteroidMat", scene);
        asteroidMat.diffuseColor = new BABYLON.Color3(0.6, 0.4, 0.2); // Brownish
        // Add variation
        asteroidMat.diffuseColor.r += (Math.random() - 0.5) * 0.2;
        asteroidMat.diffuseColor.g += (Math.random() - 0.5) * 0.2;
        asteroidMat.diffuseColor.b += (Math.random() - 0.5) * 0.2;
        asteroidMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1); // Less shiny
        asteroid.material = asteroidMat;
    }
    asteroids.push(asteroid);
}


function spawnAsteroidsIfNeeded() {
    const now = Date.now();
    if (now > lastAsteroidSpawnTime + ASTEROID_SPAWN_INTERVAL && asteroids.length < ASTEROID_MAX_COUNT && !isGameOver) {
        createAsteroid();
        lastAsteroidSpawnTime = now;
    }
}

function updateAsteroids() { // Removed deltaTime unless needed
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        if (!asteroid || !asteroid.metadata) { asteroids.splice(i, 1); continue; }

        asteroid.position.addInPlace(asteroid.metadata.velocity);
        // Apply continuous random rotation
        asteroid.rotation.x += asteroid.metadata.rotationSpeed * asteroid.metadata.velocity.y; // Link rotation axis to velocity components
        asteroid.rotation.y += asteroid.metadata.rotationSpeed * asteroid.metadata.velocity.z;
        asteroid.rotation.z += asteroid.metadata.rotationSpeed * asteroid.metadata.velocity.x;

        wrapAround(asteroid);
    }
}

function wrapAround(mesh) {
    if (!mesh || !mesh.position) return;
    const buffer = 2; // Add a small buffer to prevent visual pop-in/out exactly at the edge
    const limit = PLAY_AREA_SIZE + buffer;
    if (mesh.position.x > limit) mesh.position.x = -limit; else if (mesh.position.x < -limit) mesh.position.x = limit;
    if (mesh.position.y > limit) mesh.position.y = -limit; else if (mesh.position.y < -limit) mesh.position.y = limit;
    if (mesh.position.z > limit) mesh.position.z = -limit; else if (mesh.position.z < -limit) mesh.position.z = limit;
}

function isOutOfBounds(position) {
    if (!position) return true;
    const limit = PLAY_AREA_SIZE + 10; // Increased boundary for bullet disposal
    return Math.abs(position.x) > limit || Math.abs(position.y) > limit || Math.abs(position.z) > limit;
}

function checkCollisions() {
    // Bullet vs Asteroid
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i]; if (!bullet || !bullet.isDisposed()) continue; // Check if disposed
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j]; if (!asteroid || asteroid.isDisposed()) continue; // Check if disposed

            // Use bounding spheres for simpler/faster check first
            if (bullet.getBoundingInfo().boundingSphere.intersectsSphere(asteroid.getBoundingInfo().boundingSphere)) {
                // Optional: More precise check if needed: if (bullet.intersectsMesh(asteroid, true)) { // Precise check
                asteroid.dispose();
                asteroids.splice(j, 1);
                bullet.dispose();
                bullets.splice(i, 1);
                score += 100; // Add score
                if (scoreText) scoreText.text = `Score: ${score}`; // Update GUI
                // TODO: Add explosion effect here
                break; // Bullet hit one asteroid, move to next bullet
                //}
            }
        }
    }

    // Player vs Asteroid
    if (playerShip && playerShip.isEnabled() && !playerInvincible) {
         const playerSphere = playerShip.getBoundingInfo().boundingSphere;
         // Adjust player sphere radius slightly if needed for better collision feel
         // playerSphere.radius *= 0.8;

        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j]; if (!asteroid || asteroid.isDisposed()) continue;

            if (playerSphere.intersectsSphere(asteroid.getBoundingInfo().boundingSphere)) {
                // Optional: More precise check: if (playerShip.intersectsMesh(asteroid, true)) {
                    console.log("Player hit by asteroid!");
                    asteroid.dispose(); // Destroy asteroid that hit player
                    asteroids.splice(j, 1);
                    playerHit(); // Handle player being hit
                    break; // Player hit, no need to check other asteroids this frame
               // }
            }
        }
    }
}


function playerHit() {
    lives--;
    if (livesText) livesText.text = `Lives: ${lives}`;
    if (playerVelocity) playerVelocity.setAll(0); // Stop player movement immediately

    if (lives > 0) {
        if (playerShip) {
            // Reset position and orientation
            playerShip.position.set(0, 0, 0);
            playerShip.rotationQuaternion = null; // Reset quaternion if used
            playerShip.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0); // Reset initial orientation

            // Make ship temporarily invisible and disabled for invincibility
            playerShip.isVisible = false;
            playerShip.setEnabled(false); // Disables collisions and rendering
             // Hide child meshes too (like GUI plane if attached)
            playerShip.getChildMeshes().forEach(m => m.isVisible = false);

            playerInvincible = true;
            playerRespawnTime = Date.now();
            console.log("Player respawned, invincible for", RESPAWN_INVINCIBILITY_TIME / 1000, "sec");
        }
    } else {
         // Game Over - Ship might already be hidden/disabled or needs final disposal
         if (playerShip && !playerShip.isDisposed()) {
             playerShip.dispose();
             playerShip = null;
         }
         endGame(); // Trigger game over sequence
    }
}

function endGame() {
    if (isGameOver) return; // Prevent running multiple times

    console.log("Game Over!");
    isGameOver = true;
    if (gameOverText) gameOverText.isVisible = true; // Show GAME OVER text

    // Stop spawning asteroids
    lastAsteroidSpawnTime = Infinity;

    // Dispose remaining objects
    if (playerShip && !playerShip.isDisposed()) {
        playerShip.dispose();
        playerShip = null;
    }
    asteroids.forEach(a => { if (a && !a.isDisposed()) a.dispose(); });
    asteroids = [];
    bullets.forEach(b => { if (b && !b.isDisposed()) b.dispose(); });
    bullets = [];

    console.log("Cleaned up game objects.");
    // Optional: Add a "Restart" button or prompt in VR
}


// --- Wait for DOM Ready, then Initialize ---
function runGame() {
    initializeGame().catch(error => {
         console.error("!!! Unhandled error during game initialization:", error);
         alert("A critical error occurred: " + error.message + "\nCheck console for details.");
    });
}

if (document.readyState === 'loading') {
    console.log("DOM not ready, adding listener for DOMContentLoaded.");
    document.addEventListener('DOMContentLoaded', runGame);
} else {
    console.log("DOM already ready or script deferred, calling runGame directly.");
    runGame();
}

console.log("--- End of game.js script parsing ---");