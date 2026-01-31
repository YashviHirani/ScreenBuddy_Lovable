document.addEventListener("DOMContentLoaded", () => {
  const pushBtn = document.getElementById("pushBtn");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const preview = document.getElementById("preview");
  const recordIndicator = document.getElementById("recordIndicator");

  let mediaStream = null;
  let isRecording = false;

  pushBtn.onclick = async () => {
  const response = await window.api.requestPushCheck();
  console.log("Push Code Rpesponse:", response);
  };

  const adviceBox = document.getElementById("ai-advice-box");
  const adviceText = document.getElementById("ai-advice-text");

  pushBtn.addEventListener("click", async () => {
    adviceBox.style.display = "block";
    adviceText.innerText = "Analyzing your session...";

    try {
      const result = await window.api.requestPushCheck();

      if (result?.aiAdvice) {
        adviceText.innerText = result.aiAdvice;
      } else {
        adviceText.innerText = "No advice available for this session.";
      }
    } catch (err) {
      adviceText.innerText = "Error while analyzing. Please try again.";
      console.error(err);
    }
  });

  // ===== SCREENSHOT CAPTURE (NO VIOLATION) =====
  const CAPTURE_EVERY_MS = 1000 * 5;
  let captureTimeout = null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  function captureFrame(video) {
    if (!isRecording) return;
    if (!video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob || !isRecording) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        window.electronAPI.saveScreenshot({
          imageData: reader.result,
          windowTitle: document.title
      });
};

      reader.readAsDataURL(blob);
    }, "image/png");
  }

  function scheduleCapture(video) {
    if (!isRecording) return;

    captureTimeout = setTimeout(() => {
      captureFrame(video);
      scheduleCapture(video);
    }, CAPTURE_EVERY_MS);
  }

  function stopImageCapture() {
    if (captureTimeout) {
      clearTimeout(captureTimeout);
      captureTimeout = null;
    }
  }

  // ===== START RECORDING =====
  startBtn.onclick = async () => {
    if (isRecording) return;

    isRecording = true;

    // ✅ START SESSION (ADDED)
    window.electronAPI.startSession();

  const sources = await window.api.getSources();

const screenSource = sources.find(source =>
  source.id.startsWith("screen:")
);
console.log(
  "Available sources:",
  sources.map(s => `${s.name} (${s.id})`)
);

  if (!screenSource) {
    alert("No screen source found!");
    return;
  }


    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: screenSource.id
        }
      }
    });

    preview.srcObject = mediaStream;
    await preview.play();

    recordIndicator.style.display = "block";
    window.api.showOverlay();

    scheduleCapture(preview);
  };

  // ===== STOP RECORDING =====
  stopBtn.onclick = () => {
    if (!isRecording) return;

    isRecording = false;
    stopImageCapture();

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }

    preview.srcObject = null;
    recordIndicator.style.display = "none";
    window.api.hideOverlay();

    // ✅ STOP SESSION (ADDED)
    window.electronAPI.stopSession();
  };

  // ===== OVERLAY STOP =====
  window.api.onOverlayStop(() => {
    stopBtn.click();
  });

  const goalInput = document.getElementById("goalInput");
  const startGoalBtn = document.getElementById("startGoalBtn");
  const goalStatus = document.getElementById("goalStatus");
  const goalAdvice = document.getElementById("goalAdvice");

 startGoalBtn.addEventListener("click", async () => {
  const goalText = goalInput.value.trim();

  if (!goalText) {
    goalStatus.innerText = "Please enter a goal first.";
    return;
  }

  goalStatus.innerText = "Starting goal...";

  const result = await window.goalApi.startGoal(goalText);

  if (result.status === "ok") {
    goalStatus.innerText = `Monitoring goal: "${result.goal.text}"`;
    goalAdvice.innerText = "Watching your progress...";
  } else {
    goalStatus.innerText = result.message;
  }
});

window.goalApi.onGoalFeedback((message) => {
  const goalAdvice = document.getElementById("goalAdvice");
  goalAdvice.innerText = message;

  if (message.includes("🎉")) {
    goalAdvice.style.color = "#2ecc71";
  } else if (message.includes("NO")) {
    goalAdvice.style.color = "#f1c40f";
  } else {
    goalAdvice.style.color = "#ffffff";
  }
});

});
