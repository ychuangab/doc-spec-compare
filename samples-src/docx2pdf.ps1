param([string]$src, [string]$dst)
$w = New-Object -ComObject Word.Application
$w.Visible = $false
try {
  $d = $w.Documents.Open($src, $false, $true)
  $d.ExportAsFixedFormat($dst, 17)
  $d.Close($false)
} finally { $w.Quit() }
