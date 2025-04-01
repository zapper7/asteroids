console.log("--- test.js script started parsing ---");

function runTest() {
    console.log("--- runTest() called (after DOMContentLoaded) ---");
    const messageDiv = document.getElementById('message');
    let output = "Test Results:<br>";

    output += `Timestamp: ${Date.now()}<br>`;

    // 1. Check if BABYLON exists
    if (typeof BABYLON !== 'undefined') {
        output += "BABYLON object: Found (Type: " + typeof BABYLON + ")<br>";
        console.log("BABYLON object found:", BABYLON);

        // 2. Check if BABYLON.Engine exists
        if (typeof BABYLON.Engine === 'function') {
             output += "BABYLON.Engine: Found (Type: " + typeof BABYLON.Engine + ")<br>";
             console.log("BABYLON.Engine found");
        } else {
             output += "<strong style='color:red;'>BABYLON.Engine: NOT FOUND or not a function! (Type: " + typeof BABYLON.Engine + ")</strong><br>";
             console.error("BABYLON.Engine check failed");
        }

        // 3. Check if BABYLON.MeshBuilder exists
        if (typeof BABYLON.MeshBuilder === 'object' && BABYLON.MeshBuilder !== null) {
            output += "BABYLON.MeshBuilder: Found (Type: " + typeof BABYLON.MeshBuilder + ")<br>";
            console.log("BABYLON.MeshBuilder found:", BABYLON.MeshBuilder);

            // 4. Check specific MeshBuilder functions
            const functionsToCheck = ['createCone', 'CreateCone', 'createBox', 'CreateBox', 'createSphere', 'CreateSphere'];
            let functionsFound = [];
            let functionsMissing = [];

            functionsToCheck.forEach(funcName => {
                if (typeof BABYLON.MeshBuilder[funcName] === 'function') {
                    output += `&nbsp;&nbsp;- BABYLON.MeshBuilder.${funcName}: <strong style='color:lightgreen;'>Found</strong> (Type: function)<br>`;
                    functionsFound.push(funcName);
                } else {
                    output += `&nbsp;&nbsp;- BABYLON.MeshBuilder.${funcName}: <strong style='color:orange;'>MISSING or not a function</strong> (Type: ${typeof BABYLON.MeshBuilder[funcName]})<br>`;
                    functionsMissing.push(funcName);
                }
            });
             console.log("MeshBuilder functions found:", functionsFound);
             console.log("MeshBuilder functions missing/invalid:", functionsMissing);

             // 5. Attempt to list keys if possible
             try {
                 const keys = Object.keys(BABYLON.MeshBuilder);
                 output += `&nbsp;&nbsp;- Object.keys(MeshBuilder): [${keys.join(', ')}]<br>`;
                 console.log("Object.keys(BABYLON.MeshBuilder):", keys);
             } catch(e) {
                 output += "&nbsp;&nbsp;- Object.keys(MeshBuilder): Failed to get keys.<br>";
                 console.warn("Could not get keys from MeshBuilder", e);
             }

        } else {
            output += "<strong style='color:red;'>BABYLON.MeshBuilder: NOT FOUND or not an object! (Type: " + typeof BABYLON.MeshBuilder + ")</strong><br>";
            console.error("BABYLON.MeshBuilder check failed");
        }

    } else {
        output += "<strong style='color:red;'>BABYLON object: NOT FOUND!</strong><br>";
        console.error("BABYLON object check failed");
    }

    // Display results on the page
    messageDiv.innerHTML = output;
}


// --- Wait for DOM Ready, then Initialize ---
if (document.readyState === 'loading') {
    console.log("DOM not ready, adding listener for DOMContentLoaded.");
    document.addEventListener('DOMContentLoaded', runTest);
} else {
    console.log("DOM already ready, calling runTest directly.");
    runTest();
}

console.log("--- End of test.js script parsing ---");