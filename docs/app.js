(function () {
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const markdownOutput = document.getElementById("markdownOutput");
  const copyButton = document.getElementById("copyButton");
  const downloadButton = document.getElementById("downloadButton");
  const clearButton = document.getElementById("clearButton");
  const statusLabel = document.getElementById("statusLabel");
  const fileMeta = document.getElementById("fileMeta");
  const noticeBox = document.getElementById("noticeBox");

  let currentFileName = "document.md";

  const turndown = () => {
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
  };

  function setStatus(text) {
    statusLabel.textContent = text;
  }

  function setNotice(text, isWarning) {
    noticeBox.textContent = text;
    noticeBox.style.borderColor = isWarning ? "#d09b55" : "#b9d3c9";
    noticeBox.style.background = isWarning ? "#fff4df" : "#eef8f3";
    noticeBox.style.color = isWarning ? "#9a5b16" : "#174f44";
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
    doc.querySelectorAll("style, script, meta, link").forEach((node) => node.remove());
    doc.querySelectorAll("[class], [style]").forEach((node) => {
      node.removeAttribute("class");
      node.removeAttribute("style");
    });
    return doc.body.innerHTML;
  }

  function htmlToMarkdown(html) {
    return cleanMarkdown(turndown().turndown(stripNoise(html)));
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
    let body = text.slice(bodyStart, bodyEnd > -1 ? bodyEnd : text.length);

    if (/quoted-printable/i.test(headers)) {
      body = body
        .replace(/=\r?\n/g, "")
        .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      try {
        const bytes = Uint8Array.from(body, (char) => char.charCodeAt(0));
        body = new TextDecoder("utf-8").decode(bytes);
      } catch {
        return body;
      }
    }

    return body;
  }

  async function convertFile(file) {
    if (!window.mammoth || !window.TurndownService) {
      throw new Error("변환 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침하세요.");
    }

    const extension = "." + file.name.split(".").pop().toLowerCase();
    currentFileName = file.name.replace(/\.[^.]+$/, "") + ".md";
    fileMeta.innerHTML = "<strong>" + file.name + "</strong><br>" + formatBytes(file.size);
    setStatus("변환 중");

    if (extension === ".docx") {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      if (result.messages && result.messages.length) {
        setNotice("일부 서식은 Markdown으로 단순화되었습니다.", true);
      } else {
        setNotice("변환이 완료되었습니다. 파일은 브라우저 밖으로 전송되지 않았습니다.", false);
      }
      return htmlToMarkdown(result.value);
    }

    if ([".html", ".htm", ".mhtml", ".doc"].includes(extension)) {
      const text = await file.text();
      const looksLikeMhtml = /MIME-Version:/i.test(text) && /Content-Type:\s*multipart\//i.test(text);
      const html = looksLikeMhtml ? extractHtmlFromMhtml(text) : text;

      if (extension === ".doc" && !/<html|<body|Content-Type:\s*text\/html/i.test(text)) {
        throw new Error("구형 바이너리 .doc 파일은 브라우저 단독 변환을 지원하지 않습니다. Word나 LibreOffice에서 .docx로 저장한 뒤 다시 시도하세요.");
      }

      setNotice("변환이 완료되었습니다. 파일은 브라우저 밖으로 전송되지 않았습니다.", false);
      return htmlToMarkdown(html);
    }

    throw new Error("지원하지 않는 파일 형식입니다. .docx 파일을 선택하세요.");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  async function handleFile(file) {
    try {
      const markdown = await convertFile(file);
      markdownOutput.value = markdown;
      copyButton.disabled = false;
      downloadButton.disabled = false;
      setStatus("완료");
    } catch (error) {
      markdownOutput.value = "";
      copyButton.disabled = true;
      downloadButton.disabled = true;
      setStatus("실패");
      setNotice(error.message || "변환 중 오류가 발생했습니다.", true);
    }
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) handleFile(file);
  });

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
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(markdownOutput.value);
    setStatus("복사됨");
  });

  downloadButton.addEventListener("click", () => {
    const blob = new Blob([markdownOutput.value], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = currentFileName;
    link.click();
    URL.revokeObjectURL(url);
  });

  clearButton.addEventListener("click", () => {
    fileInput.value = "";
    markdownOutput.value = "";
    copyButton.disabled = true;
    downloadButton.disabled = true;
    fileMeta.textContent = "선택된 파일 없음";
    setStatus("대기 중");
    setNotice("변환은 사용자의 브라우저 안에서만 실행됩니다. 파일은 서버로 업로드되지 않습니다.", false);
  });
})();
