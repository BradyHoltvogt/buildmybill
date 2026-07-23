@echo off
REM Serves BuildMyBill at http://localhost:8321/ and opens it.
REM Only needed for browser extensions/tools that refuse to run on file:// URLs.
REM Close this window to stop the server.
start "" "http://localhost:8321/"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0serve.ps1"
