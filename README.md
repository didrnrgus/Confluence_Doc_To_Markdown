# Doc To Markdown App

`.docx` 문서를 Markdown으로 변환하는 웹앱과, LibreOffice를 사용하는 .NET 8 콘솔 변환기를 함께 담은 프로젝트입니다.

## 웹앱

GitHub Pages에서 정적 웹앱으로 제공합니다.

- 위치: `docs/index.html`
- 변환 방식: 사용자의 브라우저 안에서만 처리
- 지원: `.docx`, HTML/MHTML 기반 `.doc`
- 제한: 구형 바이너리 `.doc`는 브라우저 단독 변환이 어렵기 때문에 `.docx`로 저장한 뒤 변환해야 합니다.

로컬에서 확인하려면 `docs/index.html`을 브라우저로 열면 됩니다.

GitHub Pages 배포는 `.github/workflows/pages.yml` 워크플로가 처리합니다.

## 콘솔 앱

LibreOffice를 사용해 `.doc` / `.docx` 파일을 Markdown 파일로 변환하는 .NET 8 콘솔 앱입니다.

### 필요 조건

- .NET 8 SDK
- LibreOffice 설치

Windows 기본 LibreOffice 경로:

```powershell
C:\Program Files\LibreOffice\program\soffice.exe
```

### 실행

```powershell
dotnet run --project .\DocToMarkdownApp
```

명령줄에서 바로 입력할 수도 있습니다.

```powershell
dotnet run --project .\DocToMarkdownApp -- "C:\docs\sample.docx"
```

출력 경로를 직접 지정하려면 `--out` 옵션을 사용합니다.

```powershell
dotnet run --project .\DocToMarkdownApp -- "C:\docs\sample.docx" --out "C:\docs\output.md"
```

LibreOffice 경로를 직접 지정하려면 `--libreoffice` 옵션을 사용합니다.

```powershell
dotnet run --project .\DocToMarkdownApp -- "C:\docs\sample.doc" --libreoffice "C:\Program Files\LibreOffice\program\soffice.exe"
```

### 배포용 exe 만들기

```powershell
dotnet publish .\DocToMarkdownApp -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true
```

결과 위치:

```text
DocToMarkdownApp\bin\Release\net8.0\win-x64\publish\doc2md.exe
```
