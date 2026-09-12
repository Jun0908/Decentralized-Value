# Format conversion only: preserve the complete Playwright recording, no titles/cuts/audio.
[CmdletBinding()]
param(
    [ValidateSet('combined', 'ens', 'cre', 'bazantic')]
    [string]$Sponsor = 'combined'
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if ($Sponsor -eq 'combined') {
    $VideoDir = Join-Path $ProjectRoot '.frontier/handoff/sponsors-raw-2026-09-12'
    $FileStem = 'sponsor-demo-raw'
    $FrameSeconds = @(5, 30, 65, 95, 115)
} else {
    $VideoDir = Join-Path $ProjectRoot ".frontier/handoff/sponsors-individual-2026-09-12/$Sponsor"
    $FileStem = "$Sponsor-raw"
    $FrameSeconds = @(5, 25, 55, 70, 85)
}
$SourceVideo = Join-Path $VideoDir "$FileStem.webm"
$OutputVideo = Join-Path $VideoDir "$FileStem.mp4"
$ToolDir = 'C:/Users/j_kaw/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin'
$Encoder = Join-Path $ToolDir 'ffmpeg.exe'
$Probe = Join-Path $ToolDir 'ffprobe.exe'
if (-not (Test-Path -LiteralPath $SourceVideo -PathType Leaf)) { throw 'RAW_RECORDING_NOT_FOUND' }
if (Test-Path -LiteralPath $OutputVideo) { throw 'OUTPUT_ALREADY_EXISTS_NO_OVERWRITE' }
& $Encoder -hide_banner -loglevel error -n -i $SourceVideo -map 0:v:0 -an -c:v libx264 -preset fast -crf 17 -threads 2 -pix_fmt yuv420p -movflags +faststart $OutputVideo
if ($LASTEXITCODE -ne 0) { throw 'MP4_EXPORT_FAILED' }
$MediaInfo = (& $Probe -v error -show_entries 'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration,size' -of json $OutputVideo) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'VIDEO_PROBE_FAILED' }
if ([double]$MediaInfo.format.duration -lt 60 -or [double]$MediaInfo.format.duration -gt 120) { throw 'DURATION_OUTSIDE_1_TO_2_MINUTES' }
if ($MediaInfo.streams.Count -ne 1 -or $MediaInfo.streams[0].codec_name -ne 'h264' -or $MediaInfo.streams[0].width -ne 1920 -or $MediaInfo.streams[0].height -ne 1080) { throw 'UNEXPECTED_MEDIA_FORMAT' }
& $Encoder -hide_banner -loglevel error -threads 2 -i $OutputVideo -f null NUL
if ($LASTEXITCODE -ne 0) { throw 'FULL_VIDEO_DECODE_FAILED' }
foreach ($Second in $FrameSeconds) {
    $FramePath = Join-Path $VideoDir "verified-frame-$Second.png"
    & $Encoder -hide_banner -loglevel error -n -ss $Second -i $OutputVideo -frames:v 1 -update 1 $FramePath
    if ($LASTEXITCODE -ne 0) { throw 'FRAME_EXTRACTION_FAILED' }
}
$Report = [ordered]@{
    fullDecodeVerified = $true
    audio = $false
    addedText = $false
    cuts = $false
    source = 'Playwright recordVideo; application UI unchanged'
    media = $MediaInfo
    sha256 = (Get-FileHash -LiteralPath $OutputVideo -Algorithm SHA256).Hash.ToLowerInvariant()
}
$ReportJson = $Report | ConvertTo-Json -Depth 6
[IO.File]::WriteAllText((Join-Path $VideoDir 'video-qa.json'), $ReportJson, [Text.UTF8Encoding]::new($false))
$ReportJson
