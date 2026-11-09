Option Explicit

' Nexa Optimize silent launcher.
' Starts the local server without a console window, then Nexa opens its own
' app window. Use "Start Nexa.bat" instead when you want to see server errors.

Dim fso, shell, baseDir, serverPath, nodePath, command
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
serverPath = fso.BuildPath(baseDir, "server\server.js")

If Not fso.FileExists(serverPath) Then
  MsgBox "Nexa could not find server\server.js." & vbCrLf & vbCrLf & _
    "Keep NexaOptimize.vbs inside the Nexa Optimize folder.", _
    vbCritical, "Nexa Optimize"
  WScript.Quit 1
End If

nodePath = FindNode()
If nodePath = "" Then
  MsgBox "Nexa needs Node.js 18 or newer." & vbCrLf & vbCrLf & _
    "Install the LTS version from https://nodejs.org/ and run this file again.", _
    vbCritical, "Nexa Optimize"
  WScript.Quit 1
End If

shell.CurrentDirectory = baseDir
EnsureDesktopShortcut baseDir
command = """" & nodePath & """ --max-old-space-size=96 """ & serverPath & """"
shell.Run command, 0, False

Sub EnsureDesktopShortcut(rootDir)
  On Error Resume Next
  Dim desktopDir, lnkPath, legacyPath, iconPath, sc
  desktopDir = shell.SpecialFolders("Desktop")
  If Len(desktopDir) = 0 Then Exit Sub
  If fso.FileExists(fso.BuildPath(desktopDir, "Nova Optimize.lnk")) Then fso.DeleteFile fso.BuildPath(desktopDir, "Nova Optimize.lnk"), True
  If fso.FileExists(fso.BuildPath(desktopDir, "NOVA.lnk")) Then fso.DeleteFile fso.BuildPath(desktopDir, "NOVA.lnk"), True
  If fso.FileExists(fso.BuildPath(desktopDir, "Nexa Optimize.lnk")) Then fso.DeleteFile fso.BuildPath(desktopDir, "Nexa Optimize.lnk"), True
  lnkPath = fso.BuildPath(desktopDir, "NEXA.lnk")
  iconPath = fso.BuildPath(rootDir, "public\assets\nova.ico")
  Set sc = shell.CreateShortcut(lnkPath)
  sc.TargetPath = fso.BuildPath(shell.ExpandEnvironmentStrings("%SystemRoot%"), "System32\wscript.exe")
  sc.Arguments = """" & fso.BuildPath(rootDir, "NexaOptimize.vbs") & """"
  sc.WorkingDirectory = rootDir
  sc.WindowStyle = 1
  sc.Description = "NEXA - Free, local-first Windows gaming performance suite"
  If fso.FileExists(iconPath) Then
    sc.IconLocation = iconPath & ",0"
  End If
  sc.Save
  On Error GoTo 0
End Sub

Function FindNode()
  Dim exec, line, candidates, candidate
  On Error Resume Next
  Set exec = shell.Exec("cmd /c where node.exe")
  If Err.Number = 0 Then
    Do While Not exec.StdOut.AtEndOfStream
      line = Trim(exec.StdOut.ReadLine())
      If Len(line) > 0 And fso.FileExists(line) Then
        FindNode = line
        Exit Function
      End If
    Loop
  End If
  Err.Clear
  On Error GoTo 0

  candidates = Array( _
    shell.ExpandEnvironmentStrings("%ProgramFiles%\nodejs\node.exe"), _
    shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\nodejs\node.exe"), _
    shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\nodejs\node.exe"))
  For Each candidate In candidates
    If fso.FileExists(candidate) Then
      FindNode = candidate
      Exit Function
    End If
  Next
  FindNode = ""
End Function
