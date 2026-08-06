# Doc To Markdown App

컨플루언스에서 내려받은 `.doc` 문서를 Markdown으로 변환하는 웹앱입니다. LibreOffice를 사용하는 .NET 8 콘솔 변환기도 함께 담고 있습니다.

## 웹앱

GitHub Pages에서 정적 웹앱으로 제공합니다.

- 위치: `ConfluenceDocToMarkdownWeb`
- 변환 방식: 사용자의 브라우저 안에서만 처리
- 변환 엔진: 초기 콘솔 앱과 같은 `ReverseMarkdown` 4.6.0
- 지원: 컨플루언스 HTML/MHTML 기반 `.doc`
- 사용 흐름: 여러 파일 업로드, 변환 버튼 클릭, `.md` 파일 개별 다운로드 또는 ZIP 다운로드
- 제한: 구형 바이너리 `.doc`는 브라우저 단독 변환이 어렵기 때문에 컨플루언스에서 HTML 기반 `.doc`로 내려받아야 합니다.

로컬에서 확인하려면 아래 명령을 실행합니다.

```powershell
dotnet run --project .\ConfluenceDocToMarkdownWeb
```

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
