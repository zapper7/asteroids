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
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

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
        // !!! Use CreateCone (PascalCase) !!!
        if (typeof BABYLON.MeshBuilder?.CreateCone !== 'function') {
             throw new Error('BABYLON.MeshBuilder.CreateCone is not available.'); // Updated error message
        }

        playerShip = BABYLON.MeshBuilder.CreateCone("playerShip", { height: 0.8, diameterBottom: 0.5, diameterTop: 0, tessellation: 16 }, scene);
        console.log("Player ship mesh (Cone) created successfully using CreateCone.");
        playerShip.rotation.x = Math.PI / 2; // Point forward along Z

        // Common setup
        playerShip.position = new BABYLON.Vector3(0, 0, 0);
        playerShip.metadata = { type: "player" };
        playerShip.isVisible = true;
        playerShip.setEnabled(true);

    } catch (meshError) {
        console.error("!!! CRITICAL ERROR creating playerShip mesh:", meshError);
        alert("Failed to create player ship mesh. Check console for details. Error: " + meshError.message);
        playerShip = null; // Ensure playerShip is null
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
             if (playerShip) { // Attach camera ONLY if playerShip was created successfully
                xrExperience.baseExperience.camera.position = new BABYLON.Vector3(0, 1.5, -3);
                playerShip.addChild(xrExperience.baseExperience.camera);
                xrExperience.baseExperience.camera.parent = playerShip;
                console.log("WebXR camera attached to player ship.");
            } else {
                 console.warn("Player ship failed to create, WebXR camera not attached.");
                 xrExperience.baseExperience.camera.position = new BABYLON.Vector3(0, 1.6, 0);
            }
            setupXRInput(xrExperience);
        }
    } catch (e) {
        console.error("!!! Error during WebXR initialization:", e);
        alert("Failed to initialize WebXR. Error: " + e.message);
    }

    // --- GUI Setup ---
    setupGUI(scene);

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
    xr.input.onControllerRemovedObservable.add((controller) => { console.log("Controller Removed:", controller.uniqueId); });
     console.log("XR Input Handling Setup Complete.");
}


// --- GUI Setup Function ---
function setupGUI(scene) {
     if (typeof BABYLON.GUI === 'undefined') { console.error("BABYLON.GUI is not loaded!"); alert("Error: Babylon GUI library not loaded."); return; }
    const guiTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
    console.log("GUI Texture created.");

    const panel = new BABYLON.GUI.StackPanel();
    panel.width = "200px"; panel.isVertical = true; panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT; panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    panel.paddingTop = "20px"; panel.paddingRight = "20px";
    guiTexture.addControl(panel);

    scoreText = new BABYLON.GUI.TextBlock("scoreText", "Score: 0");
    scoreText.color = "white"; scoreText.fontSize = 24; scoreText.height = "30px";
    panel.addControl(scoreText);

    livesText = new BABYLON.GUI.TextBlock("livesText", `Lives: ${INITIAL_LIVES}`);
    livesText.color = "white"; livesText.fontSize = 24; livesText.height = "30px";
    panel.addControl(livesText);

    gameOverText = new BABYLON.GUI.TextBlock("gameOverText", "GAME OVER");
    gameOverText.color = "red"; gameOverText.fontSize = 48; gameOverText.fontWeight = "bold"; gameOverText.isVisible = false;
    gameOverText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER; gameOverText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
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
            playerShip.setEnabled(true);
            console.log("Player no longer invincible");
        } else {
            playerShip.isVisible = Math.floor(Date.now() / 150) % 2 === 0;
        }
    }
}


// --- Helper Functions (Using PascalCase for MeshBuilder) ---

function fireBullet() {
    if (!playerShip || !playerShip.isEnabled() || !playerShip.getScene()) { return; }
    const scene = playerShip.getScene();
    // !!! Use CreateSphere (PascalCase) !!!
    if (typeof BABYLON.MeshBuilder?.CreateSphere !== 'function') { console.error("Cannot fire bullet: CreateSphere missing."); return; }

    const bullet = BABYLON.MeshBuilder.CreateSphere("bullet", { diameter: 0.2 }, scene);
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
    // !!! Use CreateIcosahedron (PascalCase) - Assuming this follows the pattern !!!
    // If this fails later, we might need CreateIcoSphere depending on the exact old version
    if (typeof BABYLON.MeshBuilder?.CreateIcosahedron !== 'function') {
        // Fallback check for CreateIcoSphere
         if (typeof BABYLON.MeshBuilder?.CreateIcoSphere !== 'function') {
             console.error("Cannot create asteroid: CreateIcosahedron and CreateIcoSphere missing.");
             return;
         }
         console.warn("CreateIcosahedron missing, using CreateIcoSphere as fallback.");
         const size = 1 + Math.random() * 2;
         const asteroid = BABYLON.MeshBuilder.CreateIcoSphere("asteroid", { radius: size, subdivisions: 2 }, scene); // Use CreateIcoSphere
         setupAsteroid(asteroid, size, scene); // Call common setup
    } else {
        const size = 1 + Math.random() * 2;
        const asteroid = BABYLON.MeshBuilder.CreateIcosahedron("asteroid", { radius: size, subdivisions: 2 }, scene);
        setupAsteroid(asteroid, size, scene); // Call common setup
    }
}

// Helper to set up asteroid properties after creation
function setupAsteroid(asteroid, size, scene) {
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
    if (playerVelocity) playerVelocity.setAll(0);

    if (lives > 0) {
        if (playerShip) {
            playerShip.position.set(0, 0, 0);
            playerShip.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
             if(playerVelocity) playerVelocity.setAll(0);
            playerShip.isVisible = false;
            playerShip.setEnabled(false);
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
    asteroids.forEach(a => a?.dispose()); asteroids = [];
    bullets.forEach(b => b?.dispose()); bullets = [];
    console.log("Cleaned up game objects.");
}


// --- Wait for DOM Ready, then Initialize ---
function runGame() {
    initializeGame().catch(error => {
         console.error("!!! Unhandled error during game initialization:", error);
         alert("A critical error occurred: " + error.message);
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