# S8B-01 CP2 — local audio conversion for the ASR recordings, with Windows' own Media Foundation transcoder (WinRT
# Windows.Media.Transcoding): no download, no installed tool, nothing sent. Converts a phone recording (m4a / aac / mp3 /
# wav / wma / flac / 3gp, whatever the installed Windows decoders read) to 16 kHz mono 16-bit PCM WAV, or, with -ToM4a,
# a WAV to AAC m4a (only for the harness's own round-trip check). Operator-only; never production code.
#   powershell -NoProfile -ExecutionPolicy Bypass -File convert-audio.ps1 -Source <in> -Target <out.wav> [-ToM4a]
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Target,
  [switch]$ToM4a
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Transcoding.MediaTranscoder, Windows.Media.Transcoding, ContentType = WindowsRuntime]
$null = [Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media.MediaProperties, ContentType = WindowsRuntime]

$ext = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTaskOp = $ext | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$asTaskProgress = $ext | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1' } | Select-Object -First 1
function Await($op, [Type]$type) { $t = $asTaskOp.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; return $t.Result }
function AwaitProgress($op) { $t = $asTaskProgress.MakeGenericMethod([double]).Invoke($null, @($op)); $t.Wait(-1) | Out-Null }

$src = (Resolve-Path -LiteralPath $Source).Path
$dir = Split-Path -Parent ([System.IO.Path]::GetFullPath($Target))
$name = Split-Path -Leaf $Target
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$in = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($src)) ([Windows.Storage.StorageFile])
$folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($dir)) ([Windows.Storage.StorageFolder])
$out = Await ($folder.CreateFileAsync($name, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
if ($ToM4a) {
  $profile = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateM4a([Windows.Media.MediaProperties.AudioEncodingQuality]::Medium)
} else {
  $profile = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateWav([Windows.Media.MediaProperties.AudioEncodingQuality]::Medium)
  $profile.Audio = [Windows.Media.MediaProperties.AudioEncodingProperties]::CreatePcm(16000, 1, 16)
}
$transcoder = New-Object Windows.Media.Transcoding.MediaTranscoder
$prepared = Await ($transcoder.PrepareFileTranscodeAsync($in, $out, $profile)) ([Windows.Media.Transcoding.PrepareTranscodeResult])
if (-not $prepared.CanTranscode) { throw "S8B_01_ASR: cannot convert $(Split-Path -Leaf $src): $($prepared.FailureReason)" }
AwaitProgress ($prepared.TranscodeAsync())
Write-Output "converted $(Split-Path -Leaf $src) -> $name"
