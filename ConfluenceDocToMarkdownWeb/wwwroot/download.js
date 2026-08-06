window.docToMarkdown = {
  enableDropZone(dropZoneId, inputId) {
    const dropZone = document.getElementById(dropZoneId);
    const input = document.getElementById(inputId);

    if (!dropZone || !input || dropZone.dataset.dropReady === "true") {
      return;
    }

    dropZone.dataset.dropReady = "true";

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add("dragging");
      });
    });

    ["dragleave", "dragend"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove("dragging");
      });
    });

    dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.remove("dragging");

      if (!event.dataTransfer || event.dataTransfer.files.length === 0) {
        return;
      }

      input.files = event.dataTransfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  },

  downloadText(fileName, text, contentType) {
    const blob = new Blob([text], { type: contentType });
    downloadBlob(fileName, blob);
  },

  downloadBytes(fileName, base64, contentType) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    downloadBlob(fileName, new Blob([bytes], { type: contentType }));
  },
};

function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
