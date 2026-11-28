Add-Type -Namespace W -Name K -MemberDefinition '[DllImport("kernel32.dll")] public static extern IntPtr OpenThread(uint a, bool b, uint id); [DllImport("kernel32.dll")] public static extern int GetThreadDescription(IntPtr h, out IntPtr s); [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);'
function Name($id) { $h = [W.K]::OpenThread(0x0800, $false, $id); if ($h -eq [IntPtr]::Zero) { return '?' }; $p = [IntPtr]::Zero; [void][W.K]::GetThreadDescription($h, [ref]$p); $n = [Runtime.InteropServices.Marshal]::PtrToStringUni($p); [void][W.K]::CloseHandle($h); if ($n) { $n } else { '(ohne Namen)' } }
$procs = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like '*Wall*' -and ($_.CommandLine -match '--type=(renderer|gpu-process)') }
foreach ($pr in $procs) {
  $typ = if ($pr.CommandLine -match '--type=([a-z-]+)') { $Matches[1] }
  $a = @{}; (Get-Process -Id $pr.ProcessId).Threads | ForEach-Object { $a[$_.Id] = $_.TotalProcessorTime.TotalSeconds }
  Start-Sleep -Seconds 12
  $zeilen = (Get-Process -Id $pr.ProcessId).Threads | ForEach-Object { if ($a.ContainsKey($_.Id)) { [pscustomobject]@{ Id = $_.Id; Proz = [math]::Round(($_.TotalProcessorTime.TotalSeconds - $a[$_.Id]) / 12 * 100, 1) } } } | Sort-Object Proz -Descending | Select-Object -First 6
  "== $typ"
  foreach ($z in $zeilen) { if ($z.Proz -ge 0.5) { "  {0,5:N1} %  {1}" -f $z.Proz, (Name $z.Id) } }
}
