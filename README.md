# Doc To Markdown App

컨플루언스에서 내려받은 문서를 Markdown 파일로 변환하기 위한 프로젝트입니다.

현재 구현은 두 가지로 구성되어 있습니다.

- `ConfluenceDocToMarkdownWeb`: GitHub Pages에서 제공하는 브라우저 기반 웹앱
- `DocToMarkdownApp`: LibreOffice를 사용하는 .NET 8 콘솔 변환기

## 배포 사이트

GitHub Pages 배포 주소:

```text
https://didrnrgus.github.io/Confluence_Doc_To_Markdown/
```

## 웹앱

웹앱은 `ConfluenceDocToMarkdownWeb` 프로젝트에 구현되어 있습니다. Blazor WebAssembly 기반이라 별도 서버 없이 GitHub Pages 같은 정적 호스팅에서 실행됩니다.

### 주요 기능

- 컨플루언스에서 내려받은 HTML/MHTML 기반 `.doc` 파일 업로드
- 여러 파일 동시 선택
- 업로드 영역으로 파일 드래그 앤 드롭
- `변환` 버튼으로 선택된 파일 일괄 Markdown 변환
- 변환된 `.md` 파일 개별 다운로드
- 변환된 파일 전체 ZIP 다운로드
- 모든 변환을 브라우저 안에서 처리

파일은 서버로 업로드되지 않습니다. 사용자가 선택하거나 드롭한 파일은 브라우저 메모리에서 읽고 변환한 뒤, 다운로드용 Blob으로 생성됩니다.

### 사용 기술

- .NET 8
- Blazor WebAssembly
- `Microsoft.AspNetCore.Components.WebAssembly` 8.0.18
- `ReverseMarkdown` 4.6.0
- JavaScript interop
- GitHub Actions
- GitHub Pages

### 변환 방식

웹앱은 초기 콘솔 앱의 Markdown 출력과 최대한 같게 만들기 위해 같은 `ReverseMarkdown` 4.6.0 라이브러리를 사용합니다.

처리 흐름은 다음과 같습니다.

1. 사용자가 `.doc`, `.mhtml`, `.html`, `.htm` 파일을 선택하거나 드롭합니다.
2. Blazor `InputFile`이 파일 목록을 받고, 각 파일을 브라우저 메모리의 `byte[]`로 읽습니다.
3. 파일 확장자와 내용은 업로드 목록에 표시됩니다.
4. 사용자가 `변환` 버튼을 누르면 파일을 순서대로 처리합니다.
5. MHTML 문서라면 `Content-Type: text/html` 파트를 찾아 HTML 본문만 추출합니다.
6. quoted-printable 인코딩이면 UTF-8 기준으로 디코딩합니다.
7. HTML에서 `style`, `script`, `class`, `style` 속성을 제거합니다.
8. `ReverseMarkdown`으로 Markdown을 생성합니다.
9. 공백, 줄바꿈, 이스케이프된 `_`, 연속 중복 heading 등을 정리합니다.
10. 결과를 개별 `.md` 또는 ZIP 파일로 다운로드합니다.

### 초기 콘솔 앱과 맞춘 부분

웹앱의 변환 로직은 초기 커밋의 콘솔 앱 로직을 기준으로 맞췄습니다.

- MHTML 판별 조건
- MHTML HTML 파트 추출 방식
- quoted-printable 디코딩 방식
- `ReverseMarkdown.Config` 설정
- Markdown 후처리 규칙

`ReverseMarkdown` 설정:

```csharp
var config = new Config
{
    GithubFlavored = true,
    RemoveComments = true,
    SmartHrefHandling = true,
    UnknownTags = Config.UnknownTagsOption.Drop
};
```

후처리 규칙:

- CRLF를 LF로 통일
- `\_`를 `_`로 정리
- `&nbsp;`를 일반 공백으로 정리
- 줄 끝 공백 제거
- 3개 이상 연속 줄바꿈을 2개로 축소
- 들여쓰기된 목록과 heading 정렬
- 같은 heading이 연속으로 반복되면 중복 제거
- 파일 끝에 LF 하나 추가

### 드래그 앤 드롭 동작

Blazor `InputFile`은 기본적으로 드롭 영역 전체를 자동 처리하지 않기 때문에 JavaScript interop을 사용합니다.

`ConfluenceDocToMarkdownWeb/wwwroot/download.js`의 `enableDropZone` 함수가 다음을 수행합니다.

- 드롭존의 `dragenter`, `dragover`, `dragleave`, `dragend`, `drop` 이벤트 처리
- 드래그 중 `.dragging` CSS 클래스 적용
- 드롭된 `DataTransfer.files`를 실제 file input의 `files`에 연결
- `change` 이벤트를 발생시켜 Blazor의 `AddFiles`가 실행되도록 처리

### 제한 사항

웹앱은 컨플루언스에서 내려받은 HTML/MHTML 기반 `.doc` 파일을 대상으로 합니다.

구형 바이너리 Word `.doc` 파일은 브라우저 안에서 직접 LibreOffice처럼 열어 HTML로 변환할 수 없기 때문에 웹앱에서 지원하지 않습니다. 그런 파일은 컨플루언스에서 다시 내려받거나, Word/LibreOffice에서 `.docx` 또는 HTML 기반 문서로 변환해야 합니다.

## 로컬 실행

웹앱 실행:

```powershell
dotnet run --project .\ConfluenceDocToMarkdownWeb
```

전체 솔루션 빌드:

```powershell
dotnet build
```

웹앱 배포 산출물 생성:

```powershell
dotnet publish .\ConfluenceDocToMarkdownWeb -c Release -o publish
```

## GitHub Pages 배포

GitHub Pages 배포는 `.github/workflows/pages.yml`에서 처리합니다.

워크플로 흐름:

1. `main` 또는 `master` 브랜치에 push
2. 저장소 checkout
3. GitHub Pages 설정
4. .NET 8 설치
5. Blazor WebAssembly 앱 publish
6. GitHub Pages 경로에 맞게 `<base href>`를 `/Confluence_Doc_To_Markdown/`로 변경
7. SPA fallback을 위해 `404.html` 생성
8. `_framework` 폴더가 정상 제공되도록 `.nojekyll` 생성
9. `publish/wwwroot`를 GitHub Pages artifact로 업로드
10. GitHub Pages에 배포

## 콘솔 앱

`DocToMarkdownApp`은 기존 .NET 8 콘솔 변환기입니다. LibreOffice를 사용해 `.doc` 또는 `.docx` 파일을 HTML로 변환한 뒤, `ReverseMarkdown`으로 Markdown을 생성합니다.

웹앱과 달리 로컬 PC에 설치된 LibreOffice를 사용할 수 있으므로 일반 Word 문서 변환에도 사용할 수 있습니다.

### 필요 조건

- .NET 8 SDK
- LibreOffice

Windows 기본 LibreOffice 경로:

```powershell
C:\Program Files\LibreOffice\program\soffice.exe
```

### 실행

인자 없이 실행:

```powershell
dotnet run --project .\DocToMarkdownApp
```

파일 경로를 직접 전달:

```powershell
dotnet run --project .\DocToMarkdownApp -- "C:\docs\sample.docx"
```

출력 경로 지정:

```powershell
dotnet run --project .\DocToMarkdownApp -- "C:\docs\sample.docx" --out "C:\docs\output.md"
```

LibreOffice 경로 지정:

```powershell
dotnet run --project .\DocToMarkdownApp -- "C:\docs\sample.doc" --libreoffice "C:\Program Files\LibreOffice\program\soffice.exe"
```

### exe 생성

```powershell
dotnet publish .\DocToMarkdownApp -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true
```

결과 위치:

```text
DocToMarkdownApp\bin\Release\net8.0\win-x64\publish\doc2md.exe
```
