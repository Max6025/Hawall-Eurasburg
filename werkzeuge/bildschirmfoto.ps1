param([string]$Ziel = "$env:USERPROFILE\foto.png")
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type 'using System; using System.Runtime.InteropServices; public class Dpi { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }'
[Dpi]::SetProcessDPIAware() | Out-Null
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bild = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bild)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bild.Save($Ziel, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bild.Dispose()
