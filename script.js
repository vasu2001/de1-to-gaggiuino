document
  .getElementById("fileInput")
  .addEventListener("change", handleFileSelect, false);

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = e.target.result;
      processFile(data);
    };
    reader.readAsText(file);
  }
}

function processFile(data) {
  const errorBox = document.getElementById("errorBox");
  errorBox.style.display = "none"; // Hide error box initially

  const steps = extractAdvancedShot(data);
  if (!steps) return;

  const title = extractTitle(data);
  if (!title) return;

  const profile = convertToGaggiuinoSchema(title, steps);
  downloadJSON(profile, title);
}

function showError(message) {
  const errorBox = document.getElementById("errorBox");
  errorBox.textContent = message;
  errorBox.style.display = "block";
}

function downloadJSON(profile, title) {
  const json = JSON.stringify(profile, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.getElementById("downloadLink");
  downloadLink.href = url;
  downloadLink.download = `${sanitizeFileName(title)}.json`;
  downloadLink.style.display = "block";
}

// Include the functions from index.js here
// For example, extractAdvancedShot, extractTitle, convertToGaggiuinoSchema, sanitizeFileName, etc.

function extractAdvancedShot(data) {
  const match = data.match(/advanced_shot.*$/m);
  const steps = match && match[0].slice(16, -2);
  if (!steps) {
    console.error("No advanced_shot section found.");
    showError("No advanced_shot section found.");
    return null;
  }
  return steps.split("} {").map(parseStringToObject);
}

function extractTitle(data) {
  const match = data.match(/profile_title.*$/m);
  if (!match) {
    console.error("No title found");
    showError("No title found");
    return null;
  }
  return getTitle(match[0]);
}

function convertToGaggiuinoSchema(title, decentSteps) {
  return {
    id: null,
    name: title,
    globalStopConditions: {
      time: 0,
      weight: 40,
      waterPumped: 0,
    },
    waterTemperature: 93,
    recipe: [],
    phases: decentSteps.map((step) => {
      const isFlow = step.pump === "flow";
      const gaggiuinoStep = {
        skip: false,
        type: isFlow ? "FLOW" : "PRESSURE",
        target: {
          end: isFlow ? step.flow : step.pressure,
          curve: step.transition === "fast" ? "INSTANT" : "EASE_IN_OUT",
        },
        restriction: isFlow ? step.pressure : step.flow,
        stopConditions: {
          time: step.seconds * 1000,
        },
      };

      if (step.exit_if) {
        Object.assign(gaggiuinoStep.stopConditions, {
          pressureAbove: step.exit_pressure_over,
          pressureBelow: step.exit_pressure_under,
          flowAbove: step.exit_flow_over,
          flowBelow: step.exit_flow_under,
        });
      }

      return gaggiuinoStep;
    }),
  };
}

function parseStringToObject(str) {
  const result = {};
  let key = "";
  let value = "";
  let inBlock = false;
  let blockContent = "";

  const tokens = str.split(" ");

  tokens.forEach((token) => {
    if (token.includes("{") && token.includes("}")) {
      const startIndex = token.indexOf("{");
      const endIndex = token.indexOf("}");
      value = token.slice(startIndex + 1, endIndex);
      result[key] = value;
      key = "";
    } else if (token.startsWith("{")) {
      inBlock = true;
      blockContent = token.slice(1);
    } else if (inBlock) {
      blockContent += " " + token.slice(0, -1);
      if (token.endsWith("}")) {
        inBlock = false;
        result[key] = blockContent;
        key = "";
        blockContent = "";
      }
    } else if (!key) {
      key = token;
    } else {
      value = token;
      result[key] = isNaN(value) ? value : parseFloat(value);
      key = "";
    }
  });

  return result;
}

function getTitle(titleLine) {
  let title = titleLine.slice(14).trim();
  if (title.startsWith("{") && title.endsWith("}")) {
    title = title.slice(1, -1).trim();
  }
  return title;
}

function sanitizeFileName(title) {
  return title.replace(/[^a-zA-Z0-9._-]/g, " ").trim();
}
