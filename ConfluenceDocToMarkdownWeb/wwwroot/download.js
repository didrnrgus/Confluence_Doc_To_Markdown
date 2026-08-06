window.docToMarkdown = {
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
