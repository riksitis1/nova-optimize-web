Option Explicit
Dim fso, shell, baseDir, targetVbs
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
targetVbs = fso.BuildPath(baseDir, "NexaOptimize.vbs")
If fso.FileExists(targetVbs) Then
  shell.Run "wscript.exe """ & targetVbs & """", 0, False
Else
  MsgBox "NexaOptimize.vbs was not found.", vbCritical, "Nexa Optimize"
End If
