# Renders the app icon, the Android adaptive-icon foreground and the splash image from the Archivo
# Black font file that ships in @expo-google-fonts/archivo: "Ọjà" in ink on paper.
# Run from the mobile folder:  powershell -ExecutionPolicy Bypass -File scripts\make-icons.ps1
Add-Type -AssemblyName System.Drawing

$ink = [System.Drawing.ColorTranslator]::FromHtml('#121110')
$paper = [System.Drawing.ColorTranslator]::FromHtml('#F4F1EA')
$fontFile = Join-Path (Get-Location) 'node_modules\@expo-google-fonts\archivo\900Black\Archivo_900Black.ttf'
$text = 'O' + [char]0x0323 # placeholder, replaced below
# "Ọjà" built from code points so the file does not depend on its own encoding: U+1ECC, j, U+00E0
$text = ([string][char]0x1ECC) + 'j' + ([string][char]0x00E0)

$fonts = New-Object System.Drawing.Text.PrivateFontCollection
$fonts.AddFontFile($fontFile)
$family = $fonts.Families[0]

# The text as a vector outline, so it can be measured exactly and centred by its ink, not its font box.
function New-TextPath {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $format = New-Object System.Drawing.StringFormat
  $path.AddString($text, $family, [int][System.Drawing.FontStyle]::Regular, 1000.0, (New-Object System.Drawing.PointF 0, 0), $format)
  return $path
}

# Draws the text so its width is `$widthFraction` of the canvas, or smaller if it would leave the
# circle of radius `$maxRadius` pixels around the centre (the Android adaptive-icon safe zone).
function Save-Icon($file, $size, $background, $widthFraction, $maxRadius) {
  $path = New-TextPath
  $bounds = $path.GetBounds()
  $scale = ($size * $widthFraction) / $bounds.Width
  if ($maxRadius -gt 0) {
    $halfDiagonal = [Math]::Sqrt([Math]::Pow($bounds.Width * $scale / 2, 2) + [Math]::Pow($bounds.Height * $scale / 2, 2))
    if ($halfDiagonal -gt $maxRadius) { $scale = $scale * ($maxRadius / $halfDiagonal) }
  }
  $matrix = New-Object System.Drawing.Drawing2D.Matrix
  $matrix.Translate([single](-($bounds.X + $bounds.Width / 2)), [single](-($bounds.Y + $bounds.Height / 2)))
  $matrix.Scale([single]$scale, [single]$scale, [System.Drawing.Drawing2D.MatrixOrder]::Append)
  $matrix.Translate([single]($size / 2), [single]($size / 2), [System.Drawing.Drawing2D.MatrixOrder]::Append)
  $path.Transform($matrix)

  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = 'AntiAlias'
  if ($background -ne $null) { $graphics.Clear($background) } else { $graphics.Clear([System.Drawing.Color]::Transparent) }
  $graphics.FillPath((New-Object System.Drawing.SolidBrush $ink), $path)
  $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
  $final = $path.GetBounds()
  Write-Output ("{0}: text {1:N0} x {2:N0} px, left {3:N0}, top {4:N0}, farthest corner {5:N0} px from centre" -f (Split-Path $file -Leaf), $final.Width, $final.Height, $final.X, $final.Y, [Math]::Sqrt([Math]::Pow($final.Width / 2, 2) + [Math]::Pow($final.Height / 2, 2)))
}

$assets = Join-Path (Get-Location) 'assets'
# Launcher icon: ink on paper, text about 64% of the width.
Save-Icon (Join-Path $assets 'icon.png') 1024 $paper 0.64 0
# Adaptive icon: Android masks it to a circle, squircle or rounded square. Only the centre 66%
# (a circle of radius 341 px on this 1024 canvas) is guaranteed visible, so stay inside 300 px.
Save-Icon (Join-Path $assets 'adaptive-foreground.png') 1024 $null 0.56 300
# Splash: ink on transparent, shown on the paper-coloured splash background.
Save-Icon (Join-Path $assets 'splash-icon.png') 1024 $null 0.6 0
