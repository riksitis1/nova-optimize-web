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

Dim shellApp
Set shellApp = CreateObject("Shell.Application")
If Not IsAdmin() Then
  On Error Resume Next
  shellApp.ShellExecute nodePath, """" & serverPath & """", baseDir, "runas", 0
  If Err.Number = 0 Then
    WScript.Quit 0
  End If
  On Error GoTo 0
End If

command = """" & nodePath & """ """ & serverPath & """"
shell.Run command, 0, False

Function IsAdmin()
  On Error Resume Next
  shell.RegRead "HKEY_USERS\S-1-5-19\Environment\TEMP"
  IsAdmin = (Err.Number = 0)
  Err.Clear
  On Error GoTo 0
End Function

Sub EnsureDesktopShortcut(rootDir)
  On Error Resume Next
  Dim desktopDir, lnkPath, iconPath, sc
  desktopDir = shell.SpecialFolders("Desktop")
  If Len(desktopDir) = 0 Then Exit Sub
  If fso.FileExists(fso.BuildPath(desktopDir, "Nova Optimize.lnk")) Then fso.DeleteFile fso.BuildPath(desktopDir, "Nova Optimize.lnk"), True
  If fso.FileExists(fso.BuildPath(desktopDir, "NOVA.lnk")) Then fso.DeleteFile fso.BuildPath(desktopDir, "NOVA.lnk"), True
  If fso.FileExists(fso.BuildPath(desktopDir, "Nexa Optimize.lnk")) Then fso.DeleteFile fso.BuildPath(desktopDir, "Nexa Optimize.lnk"), True
  lnkPath = fso.BuildPath(desktopDir, "NEXA.lnk")
  iconPath = fso.BuildPath(rootDir, "public\assets\nexa.ico")
  If Not fso.FileExists(iconPath) Then
    iconPath = fso.BuildPath(rootDir, "public\assets\nova.ico")
  End If
  If Not fso.FileExists(lnkPath) Then
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
  End If
  On Error GoTo 0
End Sub

Function FindNode()
  Dim candidates, candidate, tempFile, line, f
  On Error Resume Next

  ' Check common installation paths first (completely silent, zero window flash)
  candidates = Array( _
    "C:\Program Files\nodejs\node.exe", _
    shell.ExpandEnvironmentStrings("%ProgramW6432%\nodejs\node.exe"), _
    shell.ExpandEnvironmentStrings("%ProgramFiles%\nodejs\node.exe"), _
    shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\nodejs\node.exe"), _
    shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\nodejs\node.exe"))
  For Each candidate In candidates
    If Len(candidate) > 0 And fso.FileExists(candidate) Then
      FindNode = candidate
      Exit Function
    End If
  Next

  ' Fallback to searching PATH via hidden shell command (0 = hidden, zero console flash)
  tempFile = shell.ExpandEnvironmentStrings("%TEMP%\nexa_node_where.tmp")
  shell.Run "cmd.exe /c where node.exe > """ & tempFile & """ 2>nul", 0, True
  If fso.FileExists(tempFile) Then
    Set f = fso.OpenTextFile(tempFile, 1)
    If Not f.AtEndOfStream Then
      line = Trim(f.ReadLine())
      If Len(line) > 0 And fso.FileExists(line) Then
        FindNode = line
      End If
    End If
    f.Close
    fso.DeleteFile tempFile, True
    If Len(FindNode) > 0 Then Exit Function
  End If

  FindNode = ""
End Function
