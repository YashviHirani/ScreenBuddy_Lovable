const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getSources: () => ipcRenderer.invoke("GET_SOURCES"),
  showOverlay: () => ipcRenderer.send("SHOW_OVERLAY"),
  hideOverlay: () => ipcRenderer.send("HIDE_OVERLAY"),
  onOverlayStop: (callback) => {
    ipcRenderer.on("OVERLAY_STOP", callback);
  },

  getRecentScreenshots: () => ipcRenderer.invoke("GET_RECENT_SCREENSHOTS"),
  requestPushCheck: () => ipcRenderer.invoke("REQUEST_PUSH_CHECK"),

});

contextBridge.exposeInMainWorld("electronAPI", {
  saveScreenshot: (image) => ipcRenderer.send("SAVE_SCREENSHOT", image),

  // ✅ SESSION CONTROL (ADDED)
  startSession: () => ipcRenderer.send("START_SESSION"),
  stopSession: () => ipcRenderer.send("STOP_SESSION")
});

contextBridge.exposeInMainWorld("analysisAPI", {
  analyzeSession: () => ipcRenderer.invoke("ANALYZE_SESSION")
});

contextBridge.exposeInMainWorld("goalApi", {
  startGoal: (goalText) => ipcRenderer.invoke("START_GOAL", goalText),
  getCurrentGoal: () => ipcRenderer.invoke("GET_CURRENT_GOAL"),
  
  // This function bridges the 'GOAL_FEEDBACK' event to your renderer.js
  onGoalFeedback: (callback) => {
    ipcRenderer.on("GOAL_FEEDBACK", (event, message) => callback(message));
  }
});
