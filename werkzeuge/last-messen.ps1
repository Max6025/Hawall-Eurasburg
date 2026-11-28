# Misst auf dem Panel, was die App kostet: CPU, Arbeitsspeicher und Grafikeinheit ueber 20 Sekunden.
# Aufruf per SSH:  powershell -NoProfile -ExecutionPolicy Bypass -File last-messen.ps1
# Anlass: 1.0.41 lief mit 198 % eines Kerns -- gemeldet als Ruckeln. Nachmessen statt behaupten.
$p1 = Get-Process | Where-Object { $_.Path -like '*Wall*' } | Select-Object Id, CPU, WorkingSet64
$t1 = Get-Date
Start-Sleep -Seconds 20
$p2 = Get-Process | Where-Object { $_.Path -like '*Wall*' } | Select-Object Id, CPU, WorkingSet64
$sek = ((Get-Date) - $t1).TotalSeconds
$kerne = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
$summe = 0
foreach ($b in $p2) { $a = $p1 | Where-Object { $_.Id -eq $b.Id }; if ($a) { $summe += ($b.CPU - $a.CPU) } }
$ram = [math]::Round((($p2 | Measure-Object WorkingSet64 -Sum).Sum) / 1MB)
$frei = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1KB)
"Prozesse: $($p2.Count)  Kerne: $kerne"
"CPU der App: $([math]::Round($summe / $sek * 100, 1)) % eines Kerns  ($([math]::Round($summe / $sek / $kerne * 100, 1)) % des Geraets)"
"Arbeitsspeicher der App: $ram MB   frei im System: $frei MB"
try {
  $g = (Get-Counter '\GPU Engine(*engtype_3D)\Utilization Percentage' -SampleInterval 2 -MaxSamples 5 -ErrorAction Stop).CounterSamples | Where-Object { $_.CookedValue -gt 0 }
  $ids = $p2.Id
  $app = ($g | Where-Object { $n = $_.InstanceName; ($ids | Where-Object { $n -like "pid_$($_)_*" }) } | Measure-Object CookedValue -Sum).Sum / 5
  "GPU (3D) der App: $([math]::Round($app, 1)) %"
} catch { "GPU: nicht messbar ($($_.Exception.Message))" }
