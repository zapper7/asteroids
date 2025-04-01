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

// Game Constants (can be defined globally)
const PLAYER_SPEED = 0.08;
const PLAYER_ROTATION_SPEED = 0.05;
const BULLET_SPEED = 0.5;
const BULLET_LIFETIME = 60; // Frames
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

    // Check if BABYLON is loaded NOW
    if (typeof BABYLON === 'undefined') {
        console.error("Fatal Error: BABYLON library is not loaded when initializeGame() runs!");
        alert("Error: Babylon.js library failed to load. Check internet connection and script tags in index.html.");
        return;
    }
     console.log("BABYLON object confirmed loaded.");

    // Initialize engine here
    engine = new BABYLON.Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true }, true);
    console.log("Babylon Engine created:", engine);
    lives = INITIAL_LIVES; // Set initial lives
    playerVelocity = new BABYLON.Vector3(0, 0, 0); // Initialize vector

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

    const scene = new BABYLON.Scene(engine); // Use the global engine
    console.log("Scene object created:", scene);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.8;

    // --- DEEPER LOGGING FOR MeshBuilder ---
    console.log("Checking BABYLON object:", typeof BABYLON);
    console.log("Checking BABYLON.MeshBuilder:", typeof BABYLON.MeshBuilder);
    if (BABYLON.MeshBuilder) {
        console.log("Inspecting BABYLON.MeshBuilder object:", BABYLON.MeshBuilder);
        try {
            // Attempt to list keys - might fail if it's not a standard object
            console.log("Keys/Functions in BABYLON.MeshBuilder:", Object.keys(BABYLON.MeshBuilder));
        } catch (e) {
            console.warn("Could not get keys from MeshBuilder (maybe not a plain object):", e);
        }
         console.log("Checking BABYLON.MeshBuilder.createCone:", typeof BABYLON.MeshBuilder.createCone);
         console.log("Checking BABYLON.MeshBuilder.CreateBox (uppercase test):", typeof BABYLON.MeshBuilder.CreateBox); // Does uppercase exist?
         console.log("Checking BABYLON.MeshBuilder.createBox (lowercase test):", typeof BABYLON.MeshBuilder.createBox); // Does lowercase exist?

    } else {
        console.error("BABYLON.MeshBuilder is undefined! Cannot create meshes.");
        alert("Critical Error: Babylon.js MeshBuilder module not loaded correctly.");
        return null; // Stop scene creation
    }
    // --- END DEEPER LOGGING ---


    // Player Ship Mesh
    try {
        if (typeof BABYLON.MeshBuilder?.createCone !== 'function') {
             console.error('Validation Check Failed: BABYLON.MeshBuilder.createCone is not a function.');
             // Try creating a box as a fallback test
             if (typeof BABYLON.MeshBuilder?.createBox === 'function') {
                 console.log("createCone failed, but createBox exists. Attempting to create a box instead.");
                 playerShip = BABYLON.MeshBuilder.createBox("playerFallback", { size: 0.8 }, scene);
                 console.log("Fallback box created as player ship.");
             } else {
                 // If even createBox fails, throw the original error
                  throw new Error('BABYLON.MeshBuilder.createCone is not available (and createBox is also missing).');
             }
        } else {
             // Proceed with creating the cone
             playerShip = BABYLON.MeshBuilder.createCone("playerShip", { height: 0.8, diameterBottom: 0.5, diameterTop: 0, tessellation: 16 }, scene);
             console.log("Player ship mesh (Cone) created successfully.");
             playerShip.rotation.x = Math.PI / 2; // Point forward along Z
        }

        // Common setup regardless of shape
        playerShip.position = new BABYLON.Vector3(0, 0, 0);
        playerShip.metadata = { type: "player" };
        playerShip.isVisible = true;
        playerShip.setEnabled(true);

    } catch (meshError) {
        console.error("!!! CRITICAL ERROR creating playerShip mesh:", meshError);
        alert("Failed to create player ship mesh. Check console for details. Error: " + meshError.message);
        playerShip = null; // Ensure playerShip is null
        // Do not proceed with XR attachment if ship failed
    }

    // Camera (Placeholder)
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());

    // --- WebXR Setup ---
    let xrExperience = null;
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
        } else {
            console.log("WebXR baseExperience available.");
             // Attach camera ONLY if playerShip was created successfully
            if (playerShip) {
                xrExperience.baseExperience.camera.position = new BABYLON.Vector3(0, 1.5, -3);
                // Detach camera from scene first if it was previously attached
                // scene.activeCamera.detachControl(); // May not be needed with default setup
                playerShip.addChild(xrExperience.baseExperience.camera);
                xrExperience.baseExperience.camera.parent = playerShip;
                console.log("WebXR camera attached to player ship.");
            } else {
                 console.warn("Player ship failed to create, WebXR camera not attached.");
                 xrExperience.baseExperience.camera.position = new BABYLON.Vector3(0, 1.6, 0);
            }
            setupXRInput(xrExperience); // Call input setup function
        }
    } catch (e) {
        console.error("!!! Error during WebXR initialization:", e);
        alert("Failed to initialize WebXR. Error: " + e.message);
    }

    // --- GUI Setup ---
    setupGUI(scene); // Call GUI setup function

    // --- Game Logic ---
    scene.onBeforeRenderObservable.add(updateGameLogic); // Call game logic update function

    console.log("--- createScene finished ---");
    return scene;
}; // --- End of createScene async function ---


// --- Input Setup Function ---
function setupXRInput(xr) { // Pass XR experience object
     if (!xr || !xr.input) {
         console.error("Cannot setup XR input: Invalid XR experience object passed.");
         return;
     }
    xr.input.onControllerAddedObservable.add((controller) => {
        console.log("Controller Added:", controller.uniqueId);
        controller.onMotionControllerInitObservable.add((motionController) => {
            console.log("Motion Controller Initialized:", motionController.id, motionController.handedness);
            if (motionController.handedness === 'right' || motionController.handedness === 'left') {
                const thumbstick = motionController.getComponentOfType('thumbstick');
                const trigger = motionController.getComponentOfType('trigger');

                if (thumbstick) {
                    console.log("Thumbstick found on", motionController.handedness);
                    thumbstick.onAxisValueChangedObservable.add((axes) => {
                        if (isGameOver || !playerShip || !playerShip.isEnabled()) return;
                        if (axes.x < -0.1) playerShip.rotation.y -= PLAYER_ROTATION_SPEED;
                        else if (axes.x > 0.1) playerShip.rotation.y += PLAYER_ROTATION_SPEED;
                        if (axes.y < -0.1) {
                            const forward = playerShip.forward.scale(-PLAYER_SPEED);
                            playerVelocity.addInPlace(forward);
                            playerVelocity.scaleInPlace(0.98);
                        }
                    });
                } else console.warn("Thumbstick component not found on controller:", motionController.id);

                if (trigger) {
                    console.log("Trigger found on", motionController.handedness);
                    trigger.onButtonStateChangedObservable.add((component) => {
                        if (component.pressed && !isGameOver && playerShip && playerShip.isEnabled()) {
                            fireBullet();
                        }
                    });
                } else console.warn("Trigger component not found on controller:", motionController.id);
            }
        });
    });
    xr.input.onControllerRemovedObservable.add((controller) => {
        console.log("Controller Removed:", controller.uniqueId);
    });
     console.log("XR Input Handling Setup Complete.");
}


// --- GUI Setup Function ---
function setupGUI(scene) {
     if (typeof BABYLON.GUI === 'undefined') {
        console.error("BABYLON.GUI is not loaded! Cannot create UI elements.");
        alert("Error: Babylon GUI library not loaded.");
        return;
    }
    const guiTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
    console.log("GUI Texture created.");

    const panel = new BABYLON.GUI.StackPanel();
    panel.width = "200px";
    panel.isVertical = true;
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    panel.paddingTop = "20px";
    panel.paddingRight = "20px";
    guiTexture.addControl(panel);

    scoreText = new BABYLON.GUI.TextBlock("scoreText", "Score: 0");
    scoreText.color = "white"; scoreText.fontSize = 24; scoreText.height = "30px";
    panel.addControl(scoreText);

    livesText = new BABYLON.GUI.TextBlock("livesText", `Lives: ${INITIAL_LIVES}`);
    livesText.color = "white"; livesText.fontSize = 24; livesText.height = "30px";
    panel.addControl(livesText);

    gameOverText = new BABYLON.GUI.TextBlock("gameOverText", "GAME OVER");
    gameOverText.color = "red"; gameOverText.fontSize = 48; gameOverText.fontWeight = "bold";
    gameOverText.isVisible = false;
    gameOverText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    gameOverText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    guiTexture.addControl(gameOverText);
    console.log("UI Elements created.");
}


// --- Game Logic Update Function ---
function updateGameLogic() {
    if (isGameOver) return;
    const deltaTime = engine.getDeltaTime() / 1000.0;

    if (playerShip && playerShip.isEnabled()) {
        playerShip.position.addInPlace(playerVelocity);
        wrapAround(playerShip);
    }

    updateBullets(deltaTime);
    updateAsteroids(deltaTime);
    spawnAsteroidsIfNeeded();
    checkCollisions();

    if (lives <= 0 && !isGameOver) {
        endGame();
    }

    if (playerInvincible && playerShip) {
        if (Date.now() > playerRespawnTime + RESPAWN_INVINCIBILITY_TIME) {
            playerInvincible = false;
            playerShip.isVisible = true;
            playerShip.setEnabled(true); // Re-enable ship and collisions
            console.log("Player no longer invincible");
        } else {
            playerShip.isVisible = Math.floor(Date.now() / 150) % 2 === 0;
        }
    }
}


// --- Helper Functions (Keep these as they are, adding safety checks) ---

function fireBullet() {
    if (!playerShip || !playerShip.isEnabled() || !playerShip.getScene()) { return; }
    const scene = playerShip.getScene();
    if (typeof BABYLON.MeshBuilder?.createSphere !== 'function') { console.error("Cannot fire bullet: createSphere missing."); return; }

    const bullet = BABYLON.MeshBuilder.createSphere("bullet", { diameter: 0.2 }, scene);
    bullet.position = playerShip.position.clone();
    const forwardDirection = playerShip.forward.scale(-1).normalize();
    bullet.metadata = { velocity: forwardDirection.scale(BULLET_SPEED), life: BULLET_LIFETIME, type: "bullet" };

    if (typeof BABYLON.StandardMaterial === 'function') {
        bullet.material = new BABYLON.StandardMaterial("bulletMat", scene);
        bullet.material.diffuseColor = new BABYLON.Color3(1, 1, 0);
        bullet.material.emissiveColor = new BABYLON.Color3(0.8, 0.8, 0);
    }
    bullets.push(bullet);
}

function updateBullets(deltaTime) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (!bullet || !bullet.metadata) { bullets.splice(i, 1); continue; }
        bullet.position.addInPlace(bullet.metadata.velocity);
        bullet.metadata.life--;
        if (bullet.metadata.life <= 0 || isOutOfBounds(bullet.position)) {
            bullet.dispose(); bullets.splice(i, 1);
        }
    }
}

function createAsteroid() {
    const scene = engine.scenes[0];
    if (!scene) { console.error("Cannot create asteroid: Scene not found."); return; }
    if (typeof BABYLON.MeshBuilder?.createIcosahedron !== 'function') { console.error("Cannot create asteroid: createIcosahedron missing."); return; }

    const size = 1 + Math.random() * 2;
    const asteroid = BABYLON.MeshBuilder.createIcosahedron("asteroid", { radius: size, subdivisions: 2 }, scene);

    const edge = Math.floor(Math.random() * 6);
    const spawnPos = new BABYLON.Vector3( (Math.random()*2-1)*PLAY_AREA_SIZE, (Math.random()*2-1)*PLAY_AREA_SIZE, (Math.random()*2-1)*PLAY_AREA_SIZE );
    switch(edge){ case 0: spawnPos.x=PLAY_AREA_SIZE; break; case 1: spawnPos.x=-PLAY_AREA_SIZE; break; case 2: spawnPos.y=PLAY_AREA_SIZE; break; case 3: spawnPos.y=-PLAY_AREA_SIZE; break; case 4: spawnPos.z=PLAY_AREA_SIZE; break; case 5: spawnPos.z=-PLAY_AREA_SIZE; break; }
    asteroid.position = spawnPos;

    const speed = ASTEROID_MIN_SPEED + Math.random() * (ASTEROID_MAX_SPEED - ASTEROID_MIN_SPEED);
    const velocity = (new BABYLON.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5)).normalize().scale(speed);
    asteroid.metadata = { velocity: velocity, type: "asteroid", size: size };

    if (typeof BABYLON.StandardMaterial === 'function') {
        asteroid.material = new BABYLON.StandardMaterial("asteroidMat", scene);
        asteroid.material.diffuseColor = new BABYLON.Color3(0.6, 0.4, 0.2);
    }
    asteroids.push(asteroid);
}

function spawnAsteroidsIfNeeded() {
    const now = Date.now();
    if (now > lastAsteroidSpawnTime + ASTEROID_SPAWN_INTERVAL && asteroids.length < ASTEROID_MAX_COUNT) {
        createAsteroid(); lastAsteroidSpawnTime = now;
    }
}

function updateAsteroids(deltaTime) {
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        if (!asteroid || !asteroid.metadata) { asteroids.splice(i, 1); continue; }
        asteroid.position.addInPlace(asteroid.metadata.velocity);
        asteroid.rotation.x += asteroid.metadata.velocity.z * 0.1;
        asteroid.rotation.y += asteroid.metadata.velocity.x * 0.1;
        wrapAround(asteroid);
    }
}

function wrapAround(mesh) {
    if (!mesh || !mesh.position) return;
    if (mesh.position.x > PLAY_AREA_SIZE) mesh.position.x = -PLAY_AREA_SIZE; else if (mesh.position.x < -PLAY_AREA_SIZE) mesh.position.x = PLAY_AREA_SIZE;
    if (mesh.position.y > PLAY_AREA_SIZE) mesh.position.y = -PLAY_AREA_SIZE; else if (mesh.position.y < -PLAY_AREA_SIZE) mesh.position.y = PLAY_AREA_SIZE;
    if (mesh.position.z > PLAY_AREA_SIZE) mesh.position.z = -PLAY_AREA_SIZE; else if (mesh.position.z < -PLAY_AREA_SIZE) mesh.position.z = PLAY_AREA_SIZE;
}

function isOutOfBounds(position) {
    if (!position) return true;
    return Math.abs(position.x) > PLAY_AREA_SIZE + 5 || Math.abs(position.y) > PLAY_AREA_SIZE + 5 || Math.abs(position.z) > PLAY_AREA_SIZE + 5;
}

function checkCollisions() {
    // Bullet vs Asteroid
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i]; if (!bullet) continue;
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j]; if (!asteroid) continue;
            if (bullet.intersectsMesh && asteroid.intersectsMesh && bullet.intersectsMesh(asteroid, false)) {
                // console.log("Bullet hit asteroid"); // Less noisy log
                asteroid.dispose(); asteroids.splice(j, 1);
                bullet.dispose(); bullets.splice(i, 1);
                score += 100; if (scoreText) scoreText.text = `Score: ${score}`;
                break;
            }
        }
    }
    // Player vs Asteroid
    if (playerShip && playerShip.isEnabled() && !playerInvincible && playerShip.intersectsMesh) {
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j]; if (!asteroid || !asteroid.intersectsMesh) continue;
            if (playerShip.intersectsMesh(asteroid, false)) {
                console.log("Player hit by asteroid!");
                playerHit();
                asteroid.dispose(); asteroids.splice(j, 1);
                break;
            }
        }
    }
}

function playerHit() {
    lives--;
    if (livesText) livesText.text = `Lives: ${lives}`;
    if (playerVelocity) playerVelocity.setAll(0); // Reset velocity

    if (lives > 0) {
        if (playerShip) {
            playerShip.position.set(0, 0, 0);
            playerShip.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0); // Re-check if Y needs reset
             // Ensure velocity is zeroed AFTER potentially moving the ship
             if(playerVelocity) playerVelocity.setAll(0);
            playerShip.isVisible = false;
            playerShip.setEnabled(false); // Disable collisions etc.
            playerInvincible = true;
            playerRespawnTime = Date.now();
            console.log("Player respawned, invincible for", RESPAWN_INVINCIBILITY_TIME / 1000, "sec");
        }
    } else {
         if (playerShip) { playerShip.isVisible = false; playerShip.setEnabled(false); }
    }
}

function endGame() {
    console.log("Game Over!");
    isGameOver = true;
    if (gameOverText) gameOverText.isVisible = true;
    if (playerShip) { playerShip.dispose(); playerShip = null; }
    asteroids.forEach(a => a?.dispose()); asteroids = []; // Add null check just in case
    bullets.forEach(b => b?.dispose()); bullets = [];
    console.log("Cleaned up game objects.");
}


// --- Wait for DOM Ready, then Initialize ---
function runGame() {
    // This function now just calls initializeGame
    initializeGame().catch(error => {
         console.error("!!! Unhandled error during game initialization:", error);
         alert("A critical error occurred: " + error.message);
    });
}

// Listener ensures HTML/scripts are loaded before 'initializeGame' runs
if (document.readyState === 'loading') {
    console.log("DOM not ready, adding listener for DOMContentLoaded.");
    document.addEventListener('DOMContentLoaded', runGame);
} else {
    // DOM already loaded, or script is deferred and runs after DOM load
    console.log("DOM already ready or script deferred, calling runGame directly.");
    runGame();
}

console.log("--- End of game.js script parsing ---");