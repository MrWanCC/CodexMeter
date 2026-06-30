Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$publicDir = Join-Path $root 'public'
$buildDir = Join-Path $root 'build'
$rendererAssetDir = Join-Path $root 'src\renderer\assets'
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
New-Item -ItemType Directory -Force -Path $rendererAssetDir | Out-Null

function New-IconBitmap {
  param([int] $Size)

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $scale = $Size / 1024.0
  $roundRect = New-Object System.Drawing.RectangleF 0, 0, $Size, $Size
  $radius = 236 * $scale
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($roundRect.X, $roundRect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($roundRect.Right - $diameter, $roundRect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($roundRect.Right - $diameter, $roundRect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($roundRect.X, $roundRect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $roundRect, ([System.Drawing.Color]::FromArgb(15, 63, 184)), ([System.Drawing.Color]::FromArgb(111, 212, 255)), 135
  $graphics.FillPath($bg, $path)

  $arcPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(245, 252, 255)), (108 * $scale)
  $arcPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $arcPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawArc($arcPen, 238 * $scale, 240 * $scale, 548 * $scale, 548 * $scale, 134, 268)

  $needlePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (76 * $scale)
  $needlePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $needlePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($needlePen, 512 * $scale, 514 * $scale, 646 * $scale, 372 * $scale)

  $centerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(236, 254, 255))
  $graphics.FillEllipse($centerBrush, (512 - 66) * $scale, (514 - 66) * $scale, 132 * $scale, 132 * $scale)

  $greenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34, 197, 94))
  $greenPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(217, 249, 157)), (28 * $scale)
  $graphics.FillEllipse($greenBrush, (712 - 82) * $scale, (646 - 82) * $scale, 164 * $scale, 164 * $scale)
  $graphics.DrawEllipse($greenPen, (712 - 82) * $scale, (646 - 82) * $scale, 164 * $scale, 164 * $scale)

  $graphics.Dispose()
  $path.Dispose()
  $bg.Dispose()
  $arcPen.Dispose()
  $needlePen.Dispose()
  $centerBrush.Dispose()
  $greenBrush.Dispose()
  $greenPen.Dispose()

  return $bitmap
}

$png = New-IconBitmap 1024
$png.Save((Join-Path $publicDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$png.Save((Join-Path $buildDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$png.Save((Join-Path $rendererAssetDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$png.Dispose()

$icoPath = Join-Path $buildDir 'icon.ico'
$sizes = @(256, 128, 64, 48, 32, 16)
$images = @()
$memoryStreams = @()

try {
  foreach ($size in $sizes) {
    $bitmap = New-IconBitmap $size
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $images += [PSCustomObject]@{ Size = $size; Bytes = $stream.ToArray() }
    $memoryStreams += $stream
    $bitmap.Dispose()
  }

  $file = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  $writer = New-Object System.IO.BinaryWriter $file
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$images.Count)
  $offset = 6 + ($images.Count * 16)

  foreach ($image in $images) {
    $entrySize = if ($image.Size -eq 256) { 0 } else { $image.Size }
    $writer.Write([Byte]$entrySize)
    $writer.Write([Byte]$entrySize)
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$image.Bytes.Length)
    $writer.Write([UInt32]$offset)
    $offset += $image.Bytes.Length
  }

  foreach ($image in $images) {
    $writer.Write($image.Bytes)
  }
} finally {
  if ($writer) { $writer.Dispose() }
  if ($file) { $file.Dispose() }
  foreach ($stream in $memoryStreams) { $stream.Dispose() }
}
