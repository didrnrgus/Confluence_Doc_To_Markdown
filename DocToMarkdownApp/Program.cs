using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using ReverseMarkdown;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;

        if (args.Contains("--help") || args.Contains("-h"))
        {
            PrintHelp();
            return 0;
        }

        string inputPath;
        string? outputPath;
        bool keepTemp;
        string? libreOfficePath;

        try
        {
            inputPath = args.Length == 0 ? PromptForInputPath() : NormalizeConsolePath(args[0]);
            outputPath = GetOption(args, "--out", "-o");
            keepTemp = HasFlag(args, "--keep-temp");
            libreOfficePath = GetOption(args, "--libreoffice", "-l") ?? FindLibreOfficeExecutable();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }

        if (string.IsNullOrWhiteSpace(inputPath))
        {
            Console.Error.WriteLine("입력 파일 경로가 비어 있습니다.");
            return 1;
        }

        if (!File.Exists(inputPath))
        {
            Console.Error.WriteLine($"입력 파일을 찾을 수 없습니다: {inputPath}");
            return 1;
        }

        var extension = Path.GetExtension(inputPath).ToLowerInvariant();
        if (extension is not ".doc" and not ".docx")
        {
            Console.Error.WriteLine("지원하는 확장자는 .doc, .docx 입니다.");
            return 1;
        }

        if (string.IsNullOrWhiteSpace(libreOfficePath) || !File.Exists(libreOfficePath))
        {
            Console.Error.WriteLine("LibreOffice 실행 파일을 찾을 수 없습니다.");
            Console.Error.WriteLine(@"LibreOffice를 설치하거나 --libreoffice 옵션으로 soffice.exe 경로를 지정하세요.");
            return 1;
        }

        outputPath = string.IsNullOrWhiteSpace(outputPath)
            ? Path.ChangeExtension(Path.GetFullPath(inputPath), ".md")
            : NormalizeConsolePath(outputPath);

        var tempDir = Path.Combine(Path.GetTempPath(), "doc2md_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            var html = IsMhtmlFile(inputPath)
                ? await ExtractHtmlFromMhtmlAsync(inputPath)
                : await ConvertDocumentToHtmlFileAsync(libreOfficePath, inputPath, tempDir);
            var markdown = ConvertHtmlToMarkdown(html);

            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath))!);
            await File.WriteAllTextAsync(outputPath, markdown, new UTF8Encoding(false));

            Console.WriteLine($"완료: {Path.GetFullPath(outputPath)}");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("변환 실패");
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
        finally
        {
            if (!keepTemp && Directory.Exists(tempDir))
                Directory.Delete(tempDir, recursive: true);
        }
    }

    private static void PrintHelp()
    {
        Console.WriteLine("""
        doc2md - .doc/.docx 파일을 Markdown(.md)으로 변환합니다.

        사용법:
          doc2md
          doc2md input.doc
          doc2md input.docx --out output.md
          doc2md input.doc --libreoffice "C:\Program Files\LibreOffice\program\soffice.exe"

        옵션:
          -o, --out           출력 md 파일 경로
          -l, --libreoffice   LibreOffice soffice 실행 파일 경로
          --keep-temp         중간 HTML 파일 보존
          -h, --help          도움말

        인자 없이 실행하면 문서 파일 절대경로를 입력받습니다.
        출력 경로를 지정하지 않으면 입력 파일과 같은 위치에 같은 이름의 .md 파일을 만듭니다.
        """);
    }

    private static string PromptForInputPath()
    {
        Console.Write("문서 파일 절대경로(.doc/.docx): ");
        return NormalizeConsolePath(Console.ReadLine() ?? "");
    }

    private static string NormalizeConsolePath(string path)
        => path.Trim().Trim('"');

    private static bool IsMhtmlFile(string inputPath)
    {
        var sampleLength = (int)Math.Min(new FileInfo(inputPath).Length, 8192);
        var buffer = new byte[sampleLength];

        using var stream = File.OpenRead(inputPath);
        var read = stream.Read(buffer, 0, buffer.Length);
        var sample = Encoding.Latin1.GetString(buffer, 0, read);

        return sample.Contains("MIME-Version:", StringComparison.OrdinalIgnoreCase)
            && sample.Contains("Content-Type: multipart/", StringComparison.OrdinalIgnoreCase)
            && sample.Contains("Content-Type: text/html", StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<string> ExtractHtmlFromMhtmlAsync(string inputPath)
    {
        var content = await File.ReadAllTextAsync(inputPath, Encoding.Latin1);
        var htmlHeaderIndex = content.IndexOf("Content-Type: text/html", StringComparison.OrdinalIgnoreCase);
        if (htmlHeaderIndex < 0)
            throw new InvalidOperationException("MHTML 안에서 HTML 본문을 찾지 못했습니다.");

        var bodyStart = FindHeaderBodyStart(content, htmlHeaderIndex);
        if (bodyStart < 0)
            throw new InvalidOperationException("MHTML HTML 파트의 본문 시작 위치를 찾지 못했습니다.");

        var boundary = GetMhtmlBoundary(content);
        var bodyEnd = boundary is null
            ? content.Length
            : content.IndexOf("\n--" + boundary, bodyStart, StringComparison.Ordinal);

        if (bodyEnd < 0)
            bodyEnd = content.Length;

        var headers = content[htmlHeaderIndex..bodyStart];
        var body = content[bodyStart..bodyEnd];

        if (headers.Contains("quoted-printable", StringComparison.OrdinalIgnoreCase))
            return DecodeQuotedPrintable(body, Encoding.UTF8);

        return body;
    }

    private static int FindHeaderBodyStart(string content, int startIndex)
    {
        var crlf = content.IndexOf("\r\n\r\n", startIndex, StringComparison.Ordinal);
        if (crlf >= 0)
            return crlf + 4;

        var lf = content.IndexOf("\n\n", startIndex, StringComparison.Ordinal);
        return lf >= 0 ? lf + 2 : -1;
    }

    private static string? GetMhtmlBoundary(string content)
    {
        var match = Regex.Match(
            content,
            @"boundary\s*=\s*""?(?<boundary>[^""\r\n;]+)",
            RegexOptions.IgnoreCase);

        return match.Success ? match.Groups["boundary"].Value.Trim() : null;
    }

    private static string DecodeQuotedPrintable(string value, Encoding encoding)
    {
        value = value.Replace("=\r\n", "").Replace("=\n", "");

        using var output = new MemoryStream();
        for (var i = 0; i < value.Length; i++)
        {
            if (value[i] == '='
                && i + 2 < value.Length
                && IsHex(value[i + 1])
                && IsHex(value[i + 2]))
            {
                output.WriteByte(Convert.ToByte(value.Substring(i + 1, 2), 16));
                i += 2;
                continue;
            }

            output.WriteByte((byte)value[i]);
        }

        return encoding.GetString(output.ToArray());
    }

    private static bool IsHex(char value)
        => (value >= '0' && value <= '9')
            || (value >= 'a' && value <= 'f')
            || (value >= 'A' && value <= 'F');

    private static async Task<string> ConvertDocumentToHtmlFileAsync(string sofficePath, string inputPath, string tempDir)
    {
        var psi = new ProcessStartInfo
        {
            FileName = sofficePath,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };

        psi.ArgumentList.Add("--headless");
        psi.ArgumentList.Add("--convert-to");
        psi.ArgumentList.Add("html:XHTML Writer File:UTF8");
        psi.ArgumentList.Add("--outdir");
        psi.ArgumentList.Add(tempDir);
        psi.ArgumentList.Add(Path.GetFullPath(inputPath));

        using var process = Process.Start(psi) ?? throw new InvalidOperationException("LibreOffice 프로세스를 시작하지 못했습니다.");
        var stdoutTask = process.StandardOutput.ReadToEndAsync();
        var stderrTask = process.StandardError.ReadToEndAsync();

        await process.WaitForExitAsync();
        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException($"LibreOffice 변환 오류: {stderr}\n{stdout}");
        }

        var expectedHtml = Path.Combine(tempDir, Path.GetFileNameWithoutExtension(inputPath) + ".html");
        if (File.Exists(expectedHtml))
            return await File.ReadAllTextAsync(expectedHtml, Encoding.UTF8);

        var htmlFiles = Directory.GetFiles(tempDir, "*.html");
        if (htmlFiles.Length == 0)
            throw new FileNotFoundException("LibreOffice 변환 결과 HTML 파일을 찾지 못했습니다.");

        return await File.ReadAllTextAsync(htmlFiles[0], Encoding.UTF8);
    }

    private static string ConvertHtmlToMarkdown(string html)
    {
        html = PreCleanHtml(html);

        var config = new Config
        {
            GithubFlavored = true,
            RemoveComments = true,
            SmartHrefHandling = true,
            UnknownTags = Config.UnknownTagsOption.Drop
        };

        var converter = new Converter(config);
        var markdown = converter.Convert(html);

        return PostCleanMarkdown(markdown);
    }

    private static string PreCleanHtml(string html)
    {
        html = Regex.Replace(html, @"<style[\s\S]*?</style>", "", RegexOptions.IgnoreCase);
        html = Regex.Replace(html, @"<script[\s\S]*?</script>", "", RegexOptions.IgnoreCase);
        html = Regex.Replace(html, @"\sclass=""[^""]*""", "", RegexOptions.IgnoreCase);
        html = Regex.Replace(html, @"\sstyle=""[^""]*""", "", RegexOptions.IgnoreCase);
        return html;
    }

    private static string PostCleanMarkdown(string markdown)
    {
        markdown = markdown.Replace("\r\n", "\n");
        markdown = markdown.Replace(@"\_", "_");
        markdown = markdown.Replace("&nbsp;", " ");
        markdown = Regex.Replace(markdown, @"[ \t]+\n", "\n");
        markdown = Regex.Replace(markdown, @"\n{3,}", "\n\n");
        markdown = Regex.Replace(markdown, @"(?m)^\s+([-*+]\s)", "$1");
        markdown = Regex.Replace(markdown, @"(?m)^\s+(#{1,6}\s)", "$1");
        markdown = RemoveConsecutiveDuplicateHeadings(markdown);
        return markdown.Trim() + "\n";
    }

    private static string RemoveConsecutiveDuplicateHeadings(string markdown)
    {
        var lines = markdown.Split('\n');
        var result = new List<string>(lines.Length);
        string? previousHeading = null;

        foreach (var line in lines)
        {
            var heading = Regex.Match(line, @"^(#{1,6})\s+(.+)$");
            if (heading.Success)
            {
                var currentHeading = heading.Groups[2].Value.Trim();
                if (string.Equals(previousHeading, currentHeading, StringComparison.Ordinal))
                    continue;

                previousHeading = currentHeading;
            }
            else if (!string.IsNullOrWhiteSpace(line))
            {
                previousHeading = null;
            }

            result.Add(line);
        }

        return string.Join('\n', result);
    }

    private static string? GetOption(string[] args, string longName, string shortName)
    {
        for (var i = 0; i < args.Length; i++)
        {
            if (args[i] == longName || args[i] == shortName)
            {
                if (i + 1 >= args.Length)
                    throw new ArgumentException($"{args[i]} 옵션 값이 없습니다.");

                return NormalizeConsolePath(args[i + 1]);
            }

            if (args[i].StartsWith(longName + "=", StringComparison.Ordinal))
                return NormalizeConsolePath(args[i][(longName.Length + 1)..]);
        }

        return null;
    }

    private static bool HasFlag(string[] args, string flag)
        => args.Any(x => string.Equals(x, flag, StringComparison.OrdinalIgnoreCase));

    private static string? FindLibreOfficeExecutable()
    {
        var candidates = new List<string>();

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            candidates.Add(@"C:\Program Files\LibreOffice\program\soffice.exe");
            candidates.Add(@"C:\Program Files (x86)\LibreOffice\program\soffice.exe");
        }
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
        {
            candidates.Add("/Applications/LibreOffice.app/Contents/MacOS/soffice");
        }
        else
        {
            candidates.Add("/usr/bin/libreoffice");
            candidates.Add("/usr/bin/soffice");
            candidates.Add("/snap/bin/libreoffice");
        }

        candidates.AddRange((Environment.GetEnvironmentVariable("PATH") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .SelectMany(dir => new[]
            {
                Path.Combine(dir, RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "soffice.exe" : "soffice"),
                Path.Combine(dir, RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "libreoffice.exe" : "libreoffice")
            }));

        return candidates.FirstOrDefault(File.Exists);
    }
}
