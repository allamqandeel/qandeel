# I-08B3.1-B4R - packager.
#
# ASCII-ONLY BY RULE. Windows PowerShell 5.1 reads a BOM-less script as ANSI, so a single non-ASCII
# byte anywhere in this file changes what the parser sees. The check at the end of this script
# verifies its own encoding rather than trusting that rule to be remembered.
#
# Three jobs:
#   1. verify every predecessor archive is byte-unchanged - they are the reference set that every
#      "nothing changed" claim in this package is measured against. B4 IS NOW ONE OF THEM: this
#      package corrects B4, and a correction that quietly rewrote the thing it corrects would make
#      every comparison in B4R_REVISION_RECORD.md unverifiable;
#   2. run content guards over the shipped files, and PROVE each guard fires by running it against
#      violating content - and, where a guard is scoped, prove the scope is narrow by running it
#      against content it must ALLOW;
#   3. build the archive with forward-slash entry names, then verify the archive by reading it back.
#
# Needles are assembled from halves at runtime so that this file does not itself contain the values
# it scans for. A scan with an exemption is exactly where a real leak hides.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Project = Split-Path -Parent $Root
$Name = 'I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL'
$Zip = Join-Path $Project ($Name + '.zip')

function Line($s) { Write-Host $s }

Line ''
Line 'I-08B3.1-B4R PACKAGER'
Line ('  package root : ' + $Root)
Line ''

# ---------------------------------------------------------------- 1. predecessors ------

$Predecessors = @(
  @{ n = 'I-08B3.1-B0-SURFACE-CONTENT-HIERARCHY-CONTRACT.zip';            h = '80E66EEE81C9364B3CCB3D203A740A6C295B1A03E99B8A8FA86A6688423CC978' },
  @{ n = 'I-08B3.1-B0R-SURFACE-CONTENT-HIERARCHY-CONTRACT.zip';           h = '530D37197F1A403AF23C7C715EA3EDD3B1E4E27B33EACF9CD7878CF07B6401F9' },
  @{ n = 'I-08B3.1-B1-CONTROLLED-SURFACE-TONE-EDGE-CALIBRATION.zip';      h = '63CD1E943BE208704265A56AD36CAA5DEA9B00225C2FAB18EAD5594510B6B5CA' },
  @{ n = 'I-08B3.1-B1R-TARGETED-MATERIAL-EVIDENCE-REVISION.zip';          h = 'C0CD16682499B520824814916CEF2311F0B1C1269B3EA38691F272EC33A1A37B' },
  @{ n = 'I-08B3.1-B2-CONTENT-HIERARCHY-SURFACE-CANDIDATE-PROOF.zip';     h = '9122DD1A579620842A89D684E08C123082BCC8EE41BC66B25B6E17550999D5D8' },
  @{ n = 'I-08B3.1-B2R-CONTRACT-EVIDENCE-RECONCILIATION.zip';             h = 'E189F11764D7EC5D4ED7156F2941E77789BCD3F8E3CEBB0ADCC3E04DF8827313' },
  @{ n = 'I-08B3.1-B3-FUNCTIONAL-OVERLAY-STRESS-PROOF.zip';               h = 'F40233BC2757FF6FF6D518EB7C4D533FA656BBFB5643D3B37319349D03382770' },
  @{ n = 'I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION.zip'; h = '1666F370091353E3C267512B0A808DAB02E14C2CFE06193A04EC9B5FED163094' },
  @{ n = 'I-08B3.1-B4-SURFACE-PRODUCTION-SPEC-FREEZE.zip';                h = '9CB72FD3ECC81D18E7C2C7721FB90DB07E81D058B153626D8D65DF33FD81A3E3' }
)

Line 'PREDECESSOR ARCHIVES - must be byte-unchanged (B4 included: this package corrects it)'
$predBad = 0
foreach ($p in $Predecessors) {
  $path = Join-Path $Project $p.n
  if (-not (Test-Path $path)) { Line ('  MISSING  ' + $p.n); $predBad++; continue }
  $got = (Get-FileHash $path -Algorithm SHA256).Hash
  if ($got -ne $p.h) {
    Line ('  CHANGED  ' + $p.n)
    Line ('           expected ' + $p.h)
    Line ('           actual   ' + $got)
    $predBad++
  } else {
    Line ('  ok       ' + $p.n)
  }
}
if ($predBad -gt 0) { throw "$predBad predecessor archive(s) missing or changed - refusing to package" }
Line ''

# ------------------------------------------------------------------- 2. guards ---------

# Needles, assembled so this file contains none of them literally.
$retired1 = '#' + '1b1' + 'b1b'      # the B2 challenger
$retired2 = '#' + '161' + '616'      # the B2 lower-bound control
$canon    = '#' + '181' + '818'      # the canonical Surface value
$elevWord = 'elev' + 'ation'
$frozenClaim = 'NOT YET ' + 'FROZEN'

$Guards = @(
  @{
    id = 'G1'
    what = 'a retired Surface value may appear only in a file that also says "retired"'
    # positive requirement + absence, never a bare blacklist: the proof-to-production map names both
    # retired values on purpose, and naming them is exactly what that document is for.
    test = {
      param($rel, $text)
      $low = $text.ToLower()
      if ($low.Contains($retired1) -or $low.Contains($retired2)) {
        if (-not $low.Contains('retired')) { return "contains a retired Surface value without the word 'retired'" }
      }
      return $null
    }
  },
  @{
    id = 'G2'
    what = 'no token file may carry the canonical Surface value more than once'
    test = {
      param($rel, $text)
      if (-not $rel.StartsWith('tokens/')) { return $null }
      $n = ([regex]::Matches($text.ToLower(), [regex]::Escape($canon))).Count
      if ($n -gt 1) { return "carries the canonical Surface value $n times; the one-tone architecture allows one" }
      return $null
    }
  },
  @{
    id = 'G3'
    what = 'an unresolved appearance set must contain no colour and must say it is empty'
    test = {
      param($rel, $text)
      if (-not ($rel -eq 'tokens/appearance/light.tokens.json' -or $rel.StartsWith('tokens/contrast/'))) { return $null }
      if ($text -match '#[0-9a-fA-F]{6}') { return 'contains a colour value; no Light or increased-contrast value has been designed' }
      if ($text.ToLower().Contains('empty') -eq $false) { return 'does not state that it is deliberately empty' }
      return $null
    }
  },
  @{
    id = 'G4'
    what = 'no token NAME or VALUE may contain elevation vocabulary'
    # SCOPED TO KEYS AND VALUES, and the scoping is a correction.
    #
    # The first version scanned the whole file and fired on this package's own token files, because
    # the semantic layer's root description says there is "no elevation level". The guard was right
    # that the word must not appear in a token name; it was wrong that a description mentioning it
    # is a violation. A rule that cannot tell a prohibition from a breach forces the documentation
    # to get worse in order to keep the guard quiet, which is the wrong trade every time.
    #
    # $description strings are stripped before the scan. The allowed-probe below proves the
    # exemption is scoped rather than blanket: the word is still rejected everywhere else.
    test = {
      param($rel, $text)
      if (-not $rel.StartsWith('tokens/')) { return $null }
      $stripped = [regex]::Replace($text, '"\$description"\s*:\s*"(\\.|[^"\\])*"', '')
      if ($stripped.ToLower().Contains($elevWord)) { return "contains '$elevWord' in a token name or value; QANDEEL derives no Surface from z-order" }
      return $null
    }
  },
  @{
    id = 'G5'
    what = 'the README must state the package is not yet frozen'
    test = {
      param($rel, $text)
      if ($rel -ne 'docs/B4_README.md') { return $null }
      if (-not $text.Contains($frozenClaim)) { return "does not contain the status line '$frozenClaim'" }
      return $null
    }
  },
  @{
    id = 'G6'
    what = 'the resolver document must use the published 2025.10 map shape'
    # ADDED IN I-08B3.1-B4R, for the defect this package exists to correct.
    #
    # SCOPED TO THE RESOLVER DOCUMENT ITSELF, and the scope is the whole point: B4R_REVISION_RECORD.md
    # QUOTES the wrong shape in order to explain it, and a guard that fired on the document explaining
    # the defect would be the G4 mistake made a second time. Positive requirement plus absence, so it
    # cannot pass by the members merely being missing.
    test = {
      param($rel, $text)
      if (-not $rel.EndsWith('.resolver.json')) { return $null }
      $flat = [regex]::Replace($text, '\s+', '')
      if ($flat.Contains('"sets":[')) { return 'declares `sets` as an array; 2025.10 declares Map[string, Set]' }
      if ($flat.Contains('"modifiers":[')) { return 'declares `modifiers` as an array; 2025.10 declares Map[string, Modifier]' }
      if (-not $flat.Contains('"sets":{')) { return 'does not declare `sets` as a map' }
      if (-not $flat.Contains('"modifiers":{')) { return 'does not declare `modifiers` as a map' }
      if (-not $flat.Contains('"$ref":"#/sets/')) { return 'resolutionOrder does not reference a root-declared set by reference object' }
      return $null
    }
  }
)

# Every guard is fired at content built to violate it. A guard nobody has seen fire is not a guard.
Line 'GUARD SELF-TEST - each guard must reject content built to violate it'
$probes = @(
  @{ g = 'G1'; rel = 'docs/probe.md';                          text = ('the surface value ' + $retired1 + ' is fine') },
  @{ g = 'G2'; rel = 'tokens/probe.json';                      text = ('{"a":"' + $canon + '","b":"' + $canon + '"}') },
  @{ g = 'G3'; rel = 'tokens/appearance/light.tokens.json';    text = '{"surface":"#f7f7f7"}' },
  @{ g = 'G4'; rel = 'tokens/probe.json';                      text = ('{"' + $elevWord + '":1}') },
  @{ g = 'G5'; rel = 'docs/B4_README.md';                      text = 'this package is done' },
  @{ g = 'G6'; rel = 'tokens/probe.resolver.json';             text = '{"sets":[{"name":"semantic"}],"modifiers":{"a":{}}}' }
)
$selfBad = 0
foreach ($p in $probes) {
  $guard = $Guards | Where-Object { $_.id -eq $p.g }
  $r = & $guard.test $p.rel $p.text
  if ($r -eq $null) { Line ('  FAIL  ' + $p.g + ' did not reject its violating probe'); $selfBad++ }
  else { Line ('  ok    ' + $p.g + ' rejected its probe - ' + $r) }
}
if ($selfBad -gt 0) { throw "$selfBad guard(s) failed to fire on violating content - refusing to package" }

# And the other direction: content a guard must NOT reject. A guard proved only by what it rejects
# can be a guard that rejects everything, and the scoping on G4 and G6 is exactly the kind of
# exemption that needs to be shown to be narrow rather than asserted to be.
$allowed = @(
  @{ g = 'G4'; rel = 'tokens/base/semantic.tokens.json'; text = ('{"$description":"there is no ' + $elevWord + ' level here","fill":{"$value":"{a.b}"}}');
     why = 'a description that FORBIDS the word is not a breach' },
  @{ g = 'G1'; rel = 'docs/probe.md';                    text = ('the value ' + $retired1 + ' was retired after B2');
     why = 'a retired value named in a document that says so is the point of that document' },
  @{ g = 'G6'; rel = 'docs/B4R_REVISION_RECORD.md';      text = '"sets": [ { "name": "semantic" } ] was the wrong shape';
     why = 'the document explaining the defect must be allowed to quote it' }
)
foreach ($p in $allowed) {
  $guard = $Guards | Where-Object { $_.id -eq $p.g }
  $r = & $guard.test $p.rel $p.text
  if ($r -ne $null) { Line ('  FAIL  ' + $p.g + ' rejected content it must allow - ' + $p.why); $selfBad++ }
  else { Line ('  ok    ' + $p.g + ' allowed what it must allow - ' + $p.why) }
}
if ($selfBad -gt 0) { throw "$selfBad guard(s) are scoped too widely - refusing to package" }
Line ''

Line 'GUARDS OVER THE SHIPPED FILES'
$textFiles = Get-ChildItem -Path $Root -Recurse -File | Where-Object { $_.Extension -match '^\.(md|json|mjs|ps1|csv|txt)$' }
$violations = 0
foreach ($f in $textFiles) {
  $rel = $f.FullName.Substring($Root.Length + 1).Replace('\', '/')
  $text = [System.IO.File]::ReadAllText($f.FullName)
  foreach ($g in $Guards) {
    $r = & $g.test $rel $text
    if ($r -ne $null) { Line ('  VIOLATION ' + $g.id + '  ' + $rel + ' - ' + $r); $violations++ }
  }
}
if ($violations -gt 0) { throw "$violations guard violation(s) - refusing to package" }
Line ('  clean - ' + $textFiles.Count + ' text files checked against ' + $Guards.Count + ' guards')
Line ''

# ------------------------------------------------ 2b. the vendored authority ------------

# The official schemas are re-hashed against their own provenance record here as well as in
# tools/b4r-schema.mjs, because the packager is the last thing that touches these bytes before they
# leave the machine. A vendored authority that can be edited is not an authority.
Line 'VENDORED OFFICIAL SCHEMAS - re-hashed against schemas/2025.10/PROVENANCE.json'
$provPath = Join-Path $Root 'schemas\2025.10\PROVENANCE.json'
if (-not (Test-Path $provPath)) { throw 'schemas/2025.10/PROVENANCE.json is missing - refusing to package' }
$prov = Get-Content $provPath -Raw | ConvertFrom-Json
$schemaBad = 0
foreach ($e in $prov.files) {
  $sp = Join-Path (Join-Path $Root 'schemas\2025.10') ($e.published -replace '/', '\')
  if (-not (Test-Path $sp)) { Line ('  MISSING  ' + $e.published); $schemaBad++; continue }
  $got = (Get-FileHash $sp -Algorithm SHA256).Hash
  if ($got -ne $e.sha256) { Line ('  CHANGED  ' + $e.published); $schemaBad++ }
}
if ($schemaBad -gt 0) { throw "$schemaBad vendored schema file(s) missing or altered - refusing to package" }
Line ('  ok - ' + $prov.files.Count + ' official schema files unaltered, dialect ' + $prov.jsonSchemaDialect)
Line ''

# ---------------------------------------------------------- 3. this file's encoding ----

$selfBytes = [System.IO.File]::ReadAllBytes($PSCommandPath)
$nonAscii = 0
foreach ($b in $selfBytes) { if ($b -gt 127) { $nonAscii++ } }
Line ('SELF-CHECK - non-ASCII bytes in this script: ' + $nonAscii)
if ($nonAscii -gt 0) { throw 'this packager contains non-ASCII bytes; PowerShell 5.1 would misread it' }
Line ''

# ------------------------------------------------------------------- 4. archive --------

if (Test-Path $Zip) { Remove-Item $Zip -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$all = Get-ChildItem -Path $Root -Recurse -File | Sort-Object FullName
$fs = [System.IO.File]::Open($Zip, [System.IO.FileMode]::CreateNew)
$archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($f in $all) {
    # Forward slashes: the ZIP format says so, and a backslash entry name unpacks as a single
    # file with a backslash in its name on anything that is not Windows.
    $entryName = $Name + '/' + $f.FullName.Substring($Root.Length + 1).Replace('\', '/')
    $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $es = $entry.Open()
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $es.Write($bytes, 0, $bytes.Length)
    $es.Close()
  }
} finally {
  $archive.Dispose()
  $fs.Dispose()
}

# --------------------------------------------------------------- 5. verify -------------

$verify = [System.IO.Compression.ZipFile]::OpenRead($Zip)
$entries = $verify.Entries
$back = 0
$mismatch = 0
foreach ($e in $entries) {
  if ($e.FullName.Contains('\')) { $back++ }
  $rel = $e.FullName.Substring($Name.Length + 1).Replace('/', '\')
  $src = Join-Path $Root $rel
  if (-not (Test-Path $src)) { $mismatch++; continue }
  $srcLen = (Get-Item $src).Length
  if ($e.Length -ne $srcLen) { $mismatch++ }
}
$count = $entries.Count
$verify.Dispose()

$zipHash = (Get-FileHash $Zip -Algorithm SHA256).Hash
$zipLen = (Get-Item $Zip).Length

Line 'ARCHIVE'
Line ('  path            : ' + $Zip)
Line ('  entries         : ' + $count)
Line ('  bytes           : ' + $zipLen)
Line ('  backslash names : ' + $back)
Line ('  round-trip bad  : ' + $mismatch)
Line ('  SHA-256         : ' + $zipHash)
Line ''
if ($back -gt 0) { throw 'archive contains backslash entry names' }
if ($mismatch -gt 0) { throw 'archive round-trip mismatch' }
if ($count -ne $all.Count) { throw ('archive has ' + $count + ' entries for ' + $all.Count + ' files') }

Line 'PACKAGED.'
