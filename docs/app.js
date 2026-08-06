(function () {
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const convertButton = document.getElementById("convertButton");
  const downloadZipButton = document.getElementById("downloadZipButton");
  const clearButton = document.getElementById("clearButton");
  const statusLabel = document.getElementById("statusLabel");
  const noticeBox = document.getElementById("noticeBox");
  const fileRows = document.getElementById("fileRows");
  const summaryText = document.getElementById("summaryText");

  let items = [];

  function setStatus(text) {
    statusLabel.textContent = text;
  }

  function setNotice(text, isWarning) {
    noticeBox.textContent = text;
    noticeBox.classList.toggle("warning", Boolean(isWarning));
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function markdownFileName(name) {
    return name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_") + ".md";
  }

  function renderRows() {
    fileRows.innerHTML = "";

    if (!items.length) {
      fileRows.innerHTML = '<tr class="empty-row"><td colspan="4">파일을 추가하면 여기에 표시됩니다.</td></tr>';
      summaryText.textContent = "선택된 파일 없음";
      convertButton.disabled = true;
      downloadZipButton.disabled = true;
      return;
    }

    const completeCount = items.filter((item) => item.status === "done").length;
    summaryText.textContent = `${items.length}개 선택됨, ${completeCount}개 변환 완료`;
    convertButton.disabled = false;
    downloadZipButton.disabled = completeCount === 0;

    for (const item of items) {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = item.file.name;

      const sizeCell = document.createElement("td");
      sizeCell.textContent = formatBytes(item.file.size);

      const statusCell = document.createElement("td");
      statusCell.textContent = item.message || statusText(item.status);
      statusCell.className = "status-cell " + item.status;

      const actionCell = document.createElement("td");
      if (item.status === "done") {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "MD";
        button.title = markdownFileName(item.file.name) + " 다운로드";
        button.addEventListener("click", () => downloadMarkdown(item));
        actionCell.appendChild(button);
      } else {
        actionCell.textContent = "-";
      }

      row.append(nameCell, sizeCell, statusCell, actionCell);
      fileRows.appendChild(row);
    }
  }

  function statusText(status) {
    if (status === "ready") return "대기";
    if (status === "working") return "변환 중";
    if (status === "done") return "완료";
    if (status === "failed") return "실패";
    return status;
  }

  function addFiles(fileList) {
    const files = Array.from(fileList).filter((file) => /\.(doc|docx|mhtml|html?)$/i.test(file.name));
    const existingKeys = new Set(items.map((item) => item.file.name + ":" + item.file.size));

    for (const file of files) {
      const key = file.name + ":" + file.size;
      if (!existingKeys.has(key)) {
        items.push({ file, status: "ready", markdown: "", message: "" });
        existingKeys.add(key);
      }
    }

    if (!files.length) {
      setNotice(".doc, .docx, .mhtml, .html 파일만 선택할 수 있습니다.", true);
    } else {
      setNotice("파일이 추가되었습니다. 변환 버튼을 누르면 Markdown으로 바뀝니다.", false);
      setStatus("준비됨");
    }

    renderRows();
  }

  function createTurndown() {
    const service = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });

    service.addRule("strikethrough", {
      filter: ["del", "s", "strike"],
      replacement: (content) => content ? "~~" + content + "~~" : "",
    });

    return service;
  }

  function cleanMarkdown(markdown) {
    return markdown
      .replace(/\r\n/g, "\n")
      .replace(/\\_/g, "_")
      .replace(/&nbsp;/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+([-*+]\s)/gm, "$1")
      .replace(/^\s+(#{1,6}\s)/gm, "$1")
      .trim() + "\n";
  }

  function stripNoise(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("style, script, meta, link, xml").forEach((node) => node.remove());
    doc.querySelectorAll("[class], [style], [lang]").forEach((node) => {
      node.removeAttribute("class");
      node.removeAttribute("style");
      node.removeAttribute("lang");
    });
    return doc.body.innerHTML || html;
  }

  function htmlToMarkdown(html) {
    return cleanMarkdown(createTurndown().turndown(stripNoise(html)));
  }

  function detectCharset(text) {
    const match = /charset\s*=\s*"?([^"\s;]+)/i.exec(text);
    return match ? match[1].toLowerCase() : "utf-8";
  }

  function decodeBuffer(buffer, charset) {
    try {
      return new TextDecoder(charset || "utf-8").decode(buffer);
    } catch {
      return new TextDecoder("utf-8").decode(buffer);
    }
  }

  function decodeQuotedPrintable(value, charset) {
    const compact = value.replace(/=\r?\n/g, "");
    const bytes = [];

    for (let index = 0; index < compact.length; index += 1) {
      if (compact[index] === "=" && /^[0-9a-f]{2}$/i.test(compact.slice(index + 1, index + 3))) {
        bytes.push(parseInt(compact.slice(index + 1, index + 3), 16));
        index += 2;
      } else {
        bytes.push(compact.charCodeAt(index) & 0xff);
      }
    }

    return decodeBuffer(new Uint8Array(bytes), charset);
  }

  function extractHtmlFromMhtml(text) {
    const htmlHeaderIndex = text.search(/Content-Type:\s*text\/html/i);
    if (htmlHeaderIndex < 0) {
      throw new Error("MHTML 안에서 HTML 본문을 찾지 못했습니다.");
    }

    const headerEndMatch = /\r?\n\r?\n/.exec(text.slice(htmlHeaderIndex));
    if (!headerEndMatch) {
      throw new Error("MHTML HTML 파트의 본문 시작 위치를 찾지 못했습니다.");
    }

    const bodyStart = htmlHeaderIndex + headerEndMatch.index + headerEndMatch[0].length;
    const boundaryMatch = /boundary\s*=\s*"?([^"\r\n;]+)/i.exec(text);
    const boundary = boundaryMatch ? boundaryMatch[1].trim() : null;
    const bodyEnd = boundary ? text.indexOf("\n--" + boundary, bodyStart) : -1;
    const headers = text.slice(htmlHeaderIndex, bodyStart);
    const body = text.slice(bodyStart, bodyEnd > -1 ? bodyEnd : text.length);
    const charset = detectCharset(headers);

    if (/quoted-printable/i.test(headers)) {
      return decodeQuotedPrintable(body, charset);
    }

    return body;
  }

  async function convertFile(file) {
    if (!window.mammoth || !window.TurndownService || !window.JSZip) {
      throw new Error("변환 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침하세요.");
    }

    const extension = "." + file.name.split(".").pop().toLowerCase();

    if (extension === ".docx") {
      const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      return htmlToMarkdown(result.value);
    }

    const buffer = await file.arrayBuffer();
    const latinText = decodeBuffer(buffer, "latin1");
    const charset = detectCharset(latinText.slice(0, 8192));
    const text = decodeBuffer(buffer, charset);
    const looksLikeMhtml = /MIME-Version:/i.test(latinText) && /Content-Type:\s*multipart\//i.test(latinText);
    const looksLikeHtml = /<html|<body|<!doctype html/i.test(text) || /<html|<body|<!doctype html/i.test(latinText);

    if (looksLikeMhtml) {
      return htmlToMarkdown(extractHtmlFromMhtml(latinText));
    }

    if (looksLikeHtml) {
      return htmlToMarkdown(text);
    }

    if (extension === ".doc") {
      throw new Error("이 .doc 파일은 구형 바이너리 형식입니다. 컨플루언스 HTML 기반 .doc가 아니면 브라우저에서 직접 변환할 수 없습니다.");
    }

    throw new Error("지원하지 않는 파일 형식입니다.");
  }

  async function convertAll() {
    if (!items.length) return;

    setStatus("변환 중");
    setNotice("파일을 순서대로 변환하고 있습니다.", false);
    convertButton.disabled = true;
    downloadZipButton.disabled = true;

    for (const item of items) {
      item.status = "working";
      item.message = "";
      renderRows();

      try {
        item.markdown = await convertFile(item.file);
        item.status = "done";
        item.message = "완료";
      } catch (error) {
        item.status = "failed";
        item.markdown = "";
        item.message = error.message || "변환 실패";
      }
    }

    const successCount = items.filter((item) => item.status === "done").length;
    const failedCount = items.filter((item) => item.status === "failed").length;
    setStatus(failedCount ? "일부 실패" : "완료");
    setNotice(`${successCount}개 변환 완료, ${failedCount}개 실패`, failedCount > 0);
    renderRows();
  }

  function downloadMarkdown(item) {
    const blob = new Blob([item.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = markdownFileName(item.file.name);
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadZip() {
    const zip = new JSZip();
    for (const item of items.filter((entry) => entry.status === "done")) {
      zip.file(markdownFileName(item.file.name), item.markdown);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "converted-markdown.zip";
    link.click();
    URL.revokeObjectURL(url);
  }

  fileInput.addEventListener("change", () => addFiles(fileInput.files));

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    addFiles(event.dataTransfer.files);
  });

  convertButton.addEventListener("click", convertAll);
  downloadZipButton.addEventListener("click", downloadZip);

  clearButton.addEventListener("click", () => {
    items = [];
    fileInput.value = "";
    setStatus("대기 중");
    setNotice("모든 변환은 브라우저 안에서만 실행됩니다. 파일은 서버로 업로드되지 않습니다.", false);
    renderRows();
  });

  renderRows();
})();
