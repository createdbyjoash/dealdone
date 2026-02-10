@echo off
echo Syncing with GitHub...
"C:\Program Files\Git\cmd\git.exe" add .
"C:\Program Files\Git\cmd\git.exe" commit -m "Manual sync: %date% %time%"
"C:\Program Files\Git\cmd\git.exe" push
echo Done!
pause
