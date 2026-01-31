require("dotenv").config();
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log("GEMINI KEY:", process.env.GEMINI_KEY);


const { GoogleGenerativeAI } = require("@google/generative-ai");
// At the top of your main.js
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

// ✅ USE THE MODEL THAT WE JUST PROVED WORKS
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash" 
});
     // 3. Keep your test block, but add a .catch to prevent the "Unhandled Rejection"
(async () => {
  try {
    const r = await model.generateContent("Say OK");
    console.log("✅ Gemini Connection Successful:", r.response.text());
  } catch (e) {
    console.error("❌ Gemini Connection Failed. Check your API Key and Internet.");
    // Detailed log to see if it's a versioning or permission issue
    console.error(e.message);
  }
})();
async function verifyGoalProgress(imageData, currentGoal) {
 // 1. Comprehensive Safety Check - MUST BE AT THE TOP
  if (!currentGoal || !currentGoal.steps || !currentGoal.steps[currentGoal.currentStepIndex]) {
    console.log("Goal verification skipped: No active step found.");
    return "COMPLETED"; 
  }

  try {
    const currentStep = currentGoal.steps[currentGoal.currentStepIndex];
    
    // 2. Data Validation
    if (!imageData || !imageData.includes(",")) {
      console.error("Invalid image data received");
      return "Error: Image capture failed.";
    }
    const base64Data = imageData.split(",")[1];

    const prompt = `
      You are ScreenBuddy, a helpful coding assistant. 
      The user's overall goal is: "${currentGoal.text}".
      The specific step they should be on is: "${currentStep.name}: ${currentStep.description}".
      
      Look at the attached screenshot of their screen:
      1. Is the user on the right track to complete this specific step? (Respond starting with YES or NO)
      2. If NO, give one short, helpful tip to guide them back to this step.
      3. If they have clearly finished this specific step or are already on the next one, respond ONLY with the word "COMPLETED".
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/png" } }
    ]);

    return result.response.text();
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return "ScreenBuddy is having trouble seeing the screen.";
  }
}

// ---------------- VISUAL SIGNAL STATE ----------------
let visualSignalHistory = [];
const MAX_SIGNAL_HISTORY = 10;

// ---------------- GOAL STATE ----------------
let currentGoal = null;


const { app, BrowserWindow, desktopCapturer, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");


// ---------------- ROLLING SCREENSHOT BUFFER ----------------
const MAX_RECENT_SCREENSHOTS = 5;
let recentScreenshots = [];

let mainWindow;
let overlayWindow;

// ---------------- SESSION STATE ----------------
let lastSessionPath = null;
let currentSessionPath = null;
let screenshotCount = 0;

// ===== MAIN WINDOW =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  mainWindow.loadFile("index.html");

  // DEVTOOLS OPEN BY DEFAULT
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

// ===== SCREEN SOURCES =====
ipcMain.handle("GET_SOURCES", async () => {
  return await desktopCapturer.getSources({
    types: ["screen", "window"]
  });
});

// ===== OVERLAY WINDOW (UNCHANGED) =====
ipcMain.on("SHOW_OVERLAY", () => {
  if (!overlayWindow) {
    overlayWindow = new BrowserWindow({
      width: 220,
      height: 60,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    overlayWindow.loadFile("overlay.html");

    overlayWindow.on("close", (e) => {
      e.preventDefault();
      overlayWindow.hide();
    });
  }

  overlayWindow.show();
});

ipcMain.on("HIDE_OVERLAY", () => {
  if (overlayWindow) {
    overlayWindow.hide();
  }
});

// ===== GLOBAL SCREENSHOT STORAGE (UNCHANGED) =====
const screenshotsDir = path.join(
  app.getPath("documents"),
  "ScreenBuddy",
  "screenshots"
);

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// ---------------- SESSION CREATION ----------------
function createNewSession() {
  const baseDir = path.join(app.getPath("documents"), "ScreenBuddy", "sessions");

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(".", "-");

  const sessionDir = path.join(baseDir, `session_${timestamp}`);
  const sessionScreenshotsDir = path.join(sessionDir, "screenshots");

  fs.mkdirSync(sessionDir);
  fs.mkdirSync(sessionScreenshotsDir);

  const sessionData = {
    startTime: new Date().toISOString(),
    endTime: null,
    screenshotInterval: null,
    totalScreenshots: 0
  };

  fs.writeFileSync(
    path.join(sessionDir, "session.json"),
    JSON.stringify(sessionData, null, 2)
  );

  currentSessionPath = sessionDir;
  screenshotCount = 0;
}

// ---------------- SCREENSHOT SAVE (EXTENDED, NOT CHANGED) ----------------
// ipcMain.on("SAVE_SCREENSHOT",async (event, payload) => {
//   // 🔹 NEW (Step 2B): unpack payload
//   const { imageData, windowTitle } = payload;

//   // 🔹 EXISTING LOGIC (UNCHANGED)
//   const base64Data = imageData.replace(/^data:image\/png;base64,/, "");

//   // ORIGINAL SAVE (DO NOT TOUCH)
//   const globalFilePath = path.join(
//     screenshotsDir,
//     `screen_${Date.now()}.png`
//   );

//   fs.writeFile(globalFilePath, base64Data, "base64", (err) => {
//     if (err) {
//       console.error("Screenshot save failed:", err);
//     }
//   });

//   // ---------- ROLLING BUFFER UPDATE (UNCHANGED) ----------
//   recentScreenshots.push(globalFilePath);

//   if (recentScreenshots.length > MAX_RECENT_SCREENSHOTS) {
//     recentScreenshots.shift(); // remove oldest
//   }
//   // ------------------------------------------------------

//   // 🔹 NEW (Step 2C): detect visual signal
// const prevScreenshot =
//   recentScreenshots.length > 1
//     ? recentScreenshots[recentScreenshots.length - 2]
//     : null;

// const activityRatio = computeActivityRatioFromImages(
//   prevScreenshot,
//   globalFilePath
// );

//   const visualSignal = detectVisualSignal({
//     windowTitle,
//     activityRatio
//   });

//   // 🔹 NEW: store visual signal history
//   visualSignalHistory.push({
//     signal: visualSignal,
//     time: new Date().toISOString()
//   });

//   if (visualSignalHistory.length > MAX_SIGNAL_HISTORY) {
//     visualSignalHistory.shift();
//   }
//   // 🔹 NEW (Step 3): update goal progress
//   updateGoalProgress(visualSignal);

//   // ✅ PERSIST GOAL PROGRESS (CRITICAL)
// if (currentSessionPath && currentGoal) {
//   const sessionFile = path.join(currentSessionPath, "session.json");
//   const data = JSON.parse(fs.readFileSync(sessionFile));

//   data.goal = currentGoal;

//   fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
// }

//   const issue = detectStuckOrDeviation();
// if (
//   issue &&
//   currentGoal &&
//   currentGoal.status === "active" &&
//   (!currentGoal.lastFeedbackAt ||
//     Date.now() - currentGoal.lastFeedbackAt > 60_000) // 1 min cooldown
// ) {
//   currentGoal.lastFeedbackAt = Date.now();

//   verifyGoalProgress(imageData, currentGoal).then(feedback => {
   
//     mainWindow.webContents.send("GOAL_FEEDBACK", feedback);

//     // Step completion handling
//     if (feedback.startsWith("COMPLETED") && currentGoal.currentStepIndex < currentGoal.steps.length - 1) {
//       currentGoal.currentStepIndex++;

//       if (currentGoal.currentStepIndex >= currentGoal.steps.length) {
//         currentGoal.status = "completed";
//         currentGoal.completedAt = new Date().toISOString();
//         mainWindow.webContents.send(
//           "GOAL_FEEDBACK",
//           "🎉 Goal completed! Excellent work."
//         );
//       }
//     }
//   });
// }
// if (issue && currentGoal) {
//   currentGoal.issue = issue;
//   currentGoal.lastIssueAt = new Date().toISOString();

//   console.log("⚠️ Goal issue detected:", issue.message);
// }


//   // 🔹 EXISTING SESSION SAVE (UNCHANGED)
//   if (currentSessionPath) {
//     screenshotCount++;

//     const sessionShotPath = path.join(
//       currentSessionPath,
//       "screenshots",
//       `img_${String(screenshotCount).padStart(3, "0")}.png`
//     );

//     fs.writeFileSync(sessionShotPath, base64Data, "base64");

//     const sessionFile = path.join(currentSessionPath, "session.json");
//     const data = JSON.parse(fs.readFileSync(sessionFile));

//     data.totalScreenshots = screenshotCount;

//     fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
//   }


// });
ipcMain.on("SAVE_SCREENSHOT", async (event, payload) => {
  try {
    const { imageData, windowTitle } = payload;
    const base64Data = imageData.replace(/^data:image\/png;base64,/, "");

    // 1. SAVE GLOBALLY (Ensures screenshots are actually taken)
    const globalFilePath = path.join(screenshotsDir, `screen_${Date.now()}.png`);
    fs.writeFileSync(globalFilePath, base64Data, "base64");

    // 2. UPDATE ROLLING BUFFER
    recentScreenshots.push(globalFilePath);
    if (recentScreenshots.length > MAX_RECENT_SCREENSHOTS) {
      recentScreenshots.shift();
    }

    // 3. COMPUTE ACTIVITY RATIO
    const prevScreenshot = recentScreenshots.length > 1 
      ? recentScreenshots[recentScreenshots.length - 2] 
      : null;

    const activityRatio = computeActivityRatioFromImages(prevScreenshot, globalFilePath);

    // 4. DETECT VISUAL SIGNAL
    const visualSignal = detectVisualSignal({ windowTitle, activityRatio });
    visualSignalHistory.push({ signal: visualSignal, time: new Date().toISOString() });
    if (visualSignalHistory.length > MAX_SIGNAL_HISTORY) visualSignalHistory.shift();

    // --- 🔹 SAFETY GATEKEEPER 🔹 ---
    if (!currentGoal) {
        if (currentSessionPath) {
          saveToSessionFolder(base64Data); 
        }
        return; 
    }

    // 5. UPDATE PROGRESS & GOAL PERSISTENCE
    const timeSinceLastFeedback = Date.now() - (currentGoal.lastFeedbackAt || 0);
    
    if (timeSinceLastFeedback > 15000) {
      updateGoalProgress(visualSignal);
    }
    
    if (currentSessionPath) {
      const sessionFile = path.join(currentSessionPath, "session.json");
      const data = JSON.parse(fs.readFileSync(sessionFile));
      data.goal = currentGoal;
      fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
    }

    // 6. TRIGGER VISION AI (Checking progress)
    const issue = detectStuckOrDeviation();
    if (currentGoal.status === "active") {

      // --- 🔹 NEW GATEKEEPER LOGIC 🔹 ---
      const currentStep = currentGoal.steps[currentGoal.currentStepIndex];
      
      // Check if user is in the correct app type for the current step
      const isCorrectApp = currentStep.visual_signals.includes(visualSignal);

      if (!isCorrectApp && visualSignal !== "idle") {
        // ❌ WRONG APP: Instant notification, skip AI call
        const appNeeded = currentStep.visual_signals.join(" or ");
        mainWindow.webContents.send("GOAL_FEEDBACK", `⚠️ Wrong App! You should be in your ${appNeeded} for this step.`);
      } 
      else {
        // ✅ CORRECT APP: Now we allow the AI to check the details
        const timeSinceLastFeedback = Date.now() - (currentGoal.lastFeedbackAt || 0);

        // Call Gemini if stuck OR interval reached (every 5th shot + 30s cooldown)
        if (issue || (screenshotCount % 5 === 0 && timeSinceLastFeedback > 30000)) {
          verifyGoalProgress(imageData, currentGoal).then(feedback => {
            currentGoal.lastFeedbackAt = Date.now();
            if (!feedback) return;
            mainWindow.webContents.send("GOAL_FEEDBACK", feedback);
            
            if (feedback.toUpperCase().includes("COMPLETED")) {
              if (currentGoal.currentStepIndex < currentGoal.steps.length - 1) {
                currentGoal.currentStepIndex++;
                mainWindow.webContents.send("GOAL_FEEDBACK", `Step Done! Next: ${currentGoal.steps[currentGoal.currentStepIndex].name}`);
              } else {
                currentGoal.status = "completed";
                currentGoal.completedAt = new Date().toISOString();
                mainWindow.webContents.send("GOAL_FEEDBACK", "🎉 Goal completed! Excellent work.");
              }
            }
          }).catch(err => {
            console.error("AI Progress Check Failed:", err.message);
            mainWindow.webContents.send("GOAL_FEEDBACK", "ScreenBuddy is retrying analysis...");
          });
        }
      }
    }

    // 7. SAVE TO SESSION FOLDER (Using a helper to keep it clean)
    function saveToSessionFolder(b64) {
      screenshotCount++;
      const sessionShotPath = path.join(currentSessionPath, "screenshots", `img_${String(screenshotCount).padStart(3, "0")}.png`);
      fs.writeFileSync(sessionShotPath, b64, "base64");

      const sessionFile = path.join(currentSessionPath, "session.json");
      const data = JSON.parse(fs.readFileSync(sessionFile));
      data.totalScreenshots = screenshotCount;
      fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
    }
    
    if (currentSessionPath) {
      saveToSessionFolder(base64Data);
    }

  } catch (error) {
    console.error("CRITICAL ERROR IN SAVE_SCREENSHOT:", error);
  }
});
// ---------------- SESSION START / STOP HOOKS ----------------

// Call this when monitoring starts
ipcMain.on("START_SESSION", () => {
  recentScreenshots = []; // ✅ reset buffer
  createNewSession();
});


// Call this when monitoring stops
ipcMain.on("STOP_SESSION", () => {
  if (!currentSessionPath) return;

  const sessionFile = path.join(currentSessionPath, "session.json");
  const data = JSON.parse(fs.readFileSync(sessionFile));

  data.endTime = new Date().toISOString();

  fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));

  lastSessionPath = currentSessionPath;
  currentSessionPath = null;

});
ipcMain.handle("GET_RECENT_SCREENSHOTS", () => {
  return recentScreenshots;
});

// ------------------ step 2 checknig user is active or idle --------------------
const { nativeImage } = require("electron");

function analyzeSessionActivity(sessionPath) {
  const screenshotsPath = path.join(sessionPath, "screenshots");
  const files = fs.readdirSync(screenshotsPath).sort();

  if (files.length < 2) {
  return {
    activeFrames: 0,
    idleFrames: 0,
    message: "Not enough screenshots to analyze activity"
  };
}
// ------- for seeing which type of user activity it is ----------



  let activeFrames = 0;
  let idleFrames = 0;

  for (let i = 0; i < files.length - 1; i++) {
    const img1 = nativeImage.createFromPath(
      path.join(screenshotsPath, files[i])
    ).resize({ width: 64, height: 36 });

    const img2 = nativeImage.createFromPath(
      path.join(screenshotsPath, files[i + 1])
    ).resize({ width: 64, height: 36 });

    const buf1 = img1.toBitmap();
    const buf2 = img2.toBitmap();

    let diffPixels = 0;

    for (let p = 0; p < buf1.length; p += 4) {
      const rDiff = Math.abs(buf1[p] - buf2[p]);
      const gDiff = Math.abs(buf1[p + 1] - buf2[p + 1]);
      const bDiff = Math.abs(buf1[p + 2] - buf2[p + 2]);

      if (rDiff + gDiff + bDiff > 30) {
        diffPixels++;
      }
    }

    const totalPixels = buf1.length / 4;
    const diffRatio = diffPixels / totalPixels;

    if (diffRatio > 0.05) {
      activeFrames++;
    } else {
      idleFrames++;
    }
  }

  return {
    activeFrames,
    idleFrames,
    activityRatio:
      activeFrames / (activeFrames + idleFrames)
  };
}
function formatSessionSummary({ activeFrames, idleFrames, activityRatio }) {
  let level = "Low";
  if (activityRatio >= 0.7) level = "High";
  else if (activityRatio >= 0.4) level = "Moderate";

  return {
    activityLevel: level,
    engagementPercent: Math.round(activityRatio * 100),
    summary:
      level === "High"
        ? "The user remained actively engaged for most of the session."
        : level === "Moderate"
        ? "The session shows moderate activity with occasional idle periods."
        : "The session shows limited activity with long idle periods."
  };
}

ipcMain.handle("ANALYZE_SESSION", () => {
  if (!lastSessionPath) return null;

  const raw = analyzeSessionActivity(lastSessionPath);
  const formatted = formatSessionSummary(raw);

  // ✅ SAVE RESULT INTO session.json
  const sessionFile = path.join(lastSessionPath, "session.json");
  const sessionData = JSON.parse(fs.readFileSync(sessionFile));

  sessionData.analysis = {
    analyzedAt: new Date().toISOString(),
    ...formatted
  };

  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));

  return formatted;
});

async function generateGoalSteps(goalText) {
  const prompt = `Convert this goal: "${goalText}" into a valid JSON object.
  Break it into 4-6 high-level steps. 
  For "visual_signals", ONLY use these words: ["editor", "terminal", "browser"].
  
  Format: {"steps": [{"name": "Step Name", "description": "What they are doing", "visual_signals": ["editor"]}]}`;

  try {
    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    // Clean up markdown if the AI adds it
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("AI Step Generation Failed:", e);
    // Safety fallback so Step 3 doesn't crash your app
    return { steps: [{ name: "Start", description: goalText, visual_signals: ["other"] }] };
  }
}
// ----------------------------- Storing goal of user to currentGoal --------------------------------

ipcMain.handle("START_GOAL",  async (event, goalText) => {
  if (!goalText) {
    return { status: "error", message: "Goal text is empty" };
  }

    // 🧠 STEP 1: Generate steps ONCE
  const plan = await generateGoalSteps(goalText);

  const normalizedSteps = plan.steps.map(step => ({
  ...step,
  visual_signals: normalizeVisualSignals(step.visual_signals)
  }));

  currentGoal = {
    text: goalText,
    status: "active",
    startedAt: new Date().toISOString(),
    steps: normalizedSteps,
    currentStepIndex: 0,
    lastSignal: null,
    lastSignalTime: null, 
    lastFeedbackAt: null
  };

  // 🔗 attach goal to session if exists
  const sessionPath = currentSessionPath || lastSessionPath;
  if (sessionPath) {
    const sessionFile = path.join(sessionPath, "session.json");
    const data = JSON.parse(fs.readFileSync(sessionFile));

    data.goal = currentGoal;

    fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
  }

  return {
    status: "ok",
    goal: currentGoal
  };
});

ipcMain.handle("GET_CURRENT_GOAL", () => {
  return currentGoal;
});


function detectVisualSignal({ windowTitle, activityRatio }) {
  if (activityRatio !== undefined && activityRatio < 0.02) {
    return "idle";
  }

  if (!windowTitle) return "other";

  const title = windowTitle.toLowerCase();

  if (title.includes("code") || title.includes("studio")) return "editor";
  if (title.includes("terminal") || title.includes("shell")) return "terminal";
  if (
    title.includes("chrome") ||
    title.includes("edge") ||
    title.includes("firefox") ||
    title.includes("safari")  
  ) return "browser";

  return "other";
}

function updateGoalProgress(latestSignal) {
  if (!currentGoal || currentGoal.status !== "active") return;

  let currentStep = currentGoal.steps[currentGoal.currentStepIndex];
  if (!currentStep) return;

  const now = Date.now();
  const STEP_ADVANCE_COOLDOWN = 5000;

  const hasSignals =
    Array.isArray(currentStep.visual_signals) &&
    currentStep.visual_signals.length > 0;

  // 🟢 Auto-advance implicit steps
  if (!hasSignals) {
    currentGoal.currentStepIndex++;
    return;
  }

  // 🟢 Cooldown for repeated signal
  if (
    currentGoal.lastSignal === latestSignal &&
    currentGoal.lastSignalTime &&
    now - currentGoal.lastSignalTime < STEP_ADVANCE_COOLDOWN
  ) {
    return;
  }

  if (currentStep.visual_signals.includes(latestSignal)) {
    currentGoal.currentStepIndex++;
    currentGoal.lastSignal = latestSignal;
    currentGoal.lastSignalTime = now;

    if (currentGoal.currentStepIndex >= currentGoal.steps.length) {
      currentGoal.status = "completed";
      currentGoal.completedAt = new Date().toISOString();
      console.log("🎉 Goal completed:", currentGoal.text);
    }
  }
}


function detectStuckOrDeviation() {
  if (!currentGoal || currentGoal.status !== "active") return null;
  if (visualSignalHistory.length < 5) return null;

  const recentSignals = visualSignalHistory.map(s => s.signal);

  // 🟠 STUCK: idle repeated
  const idleCount = recentSignals.filter(s => s === "idle").length;
  if (idleCount >= 4) {
    return {
      type: "stuck",
      message: "You seem inactive for a while."
    };
  }

  // 🔴 DEVIATION: unrelated activity
  const unrelatedCount = recentSignals.filter(
    s => s === "other"
  ).length;

  if (unrelatedCount >= 4) {
    return {
      type: "deviation",
      message: "You may be drifting away from your goal."
    };
  }

  return null;
}

function normalizeVisualSignals(signals = []) {
  const normalized = [];

  for (const s of signals) {
    const text = s.toLowerCase();

    // Browser keywords
    if (text.includes("browser") || text.includes("web") || text.includes("chrome") || text.includes("edge")) {
      normalized.push("browser");
    } 
    // Terminal keywords
    else if (text.includes("terminal") || text.includes("command") || text.includes("shell") || text.includes("console")) {
      normalized.push("terminal");
    } 
    // Editor keywords
    else if (text.includes("code") || text.includes("editor") || text.includes("studio") || text.includes("text")) {
      normalized.push("editor");
    }
  }

  // If the AI gave something weird, default to "other" so it's not empty
  if (normalized.length === 0) normalized.push("other");

  return [...new Set(normalized)];
}


// async function analyzeIntentAndProgress(imageData, currentGoal) {
//   try {
//     const currentStep = currentGoal.steps[currentGoal.currentStepIndex];
    
//     // Convert base64 for the Gemini SDK
//     const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");

//     const prompt = `
//       CONTEXT: You are ScreenBuddy, a helpful coding assistant. 
//       USER GOAL: "${currentGoal.text}"
//       CURRENT STEP: "${currentStep.name}: ${currentStep.description}"

//       TASK: Look at the screenshot of the user's screen.
//       1. Is the user correctly performing the current step? (Respond starting with YES or NO)
//       2. If they are wrong or distracted, give a one-sentence instruction to help them.
//       3. If the step is clearly finished (e.g. command ran successfully), respond "COMPLETED".
//     `;

//     const result = await model.generateContent([
//       prompt,
//       {
//         inlineData: {
//           data: base64Data,
//           mimeType: "image/png",
//         },
//       },
//     ]);

//     return result.response.text();
//   } catch (err) {
//     console.error("Gemini 2.0 Flash Error:", err);
//     return "ScreenBuddy is having trouble seeing the screen right now.";
//   }
// }

function computeActivityRatioFromImages(prevPath, currPath) {
  if (!prevPath || !currPath) return 1; // assume active

  const img1 = nativeImage.createFromPath(prevPath).resize({
    width: 64,
    height: 36
  });
  const img2 = nativeImage.createFromPath(currPath).resize({
    width: 64,
    height: 36
  });

  const buf1 = img1.toBitmap();
  const buf2 = img2.toBitmap();

  let diffPixels = 0;

  for (let i = 0; i < buf1.length; i += 4) {
    const diff =
      Math.abs(buf1[i] - buf2[i]) +
      Math.abs(buf1[i + 1] - buf2[i + 1]) +
      Math.abs(buf1[i + 2] - buf2[i + 2]);

    if (diff > 30) diffPixels++;
  }

  const totalPixels = buf1.length / 4;
  return diffPixels / totalPixels;
}
