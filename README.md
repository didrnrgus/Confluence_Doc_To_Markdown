# DocToMarkdownApp

`.doc` / `.docx` 파일을 `.md` Markdown 파일로 변환하는 .NET 8 콘솔 앱입니다.

## 필요 조건

- .NET 8 SDK
- LibreOffice 설치

Windows 기본 LibreOffice 경로:

```powershell
C:\Program Files\LibreOffice\program\soffice.exe
```

## 실행

인자 없이 실행하면 문서 파일의 절대경로를 입력받습니다.

```powershell
dotnet run --project .\DocToMarkdownApp
```

실행 후 아래처럼 입력합니다.

```text
문서 파일 절대경로(.doc/.docx): C:\docs\sample.doc
```

그러면 같은 위치에 아래 파일이 생성됩니다.

```text
C:\docs\sample.md
```

명령어에서 바로 입력해도 됩니다.

```powershell
dotnet run --project .\DocToMarkdownApp -- "C:\docs\sample.doc"
```

출력 경로를 직접 지정하려면 `--out` 옵션을 사용합니다.

```powershell
dotnet run --project .\DocToMarkdownApp -- "C:\docs\sample.doc" --out "C:\docs\output.md"
```

LibreOffice 경로를 직접 지정해야 할 때는 `--libreoffice` 옵션을 사용합니다.

```powershell
dotnet run --project .\DocToMarkdownApp -- "C:\docs\sample.doc" --libreoffice "C:\Program Files\LibreOffice\program\soffice.exe"
```

## 배포

Windows 단일 실행 파일로 배포:

```powershell
dotnet publish .\DocToMarkdownApp -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true
```

결과 위치:

```text
DocToMarkdownApp\bin\Release\net8.0\win-x64\publish\doc2md.exe
```

배포된 exe 사용 예:

```powershell
.\doc2md.exe
```
