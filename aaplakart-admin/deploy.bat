@echo off
REM ── AaplaKart Admin Panel - FTP Deploy Script ──
REM Isse use karne ke liye pehle edit karo:
REM   SET FTP_HOST=ftp.aaplakart.com
REM   SET FTP_USER=your_username
REM   SET FTP_PASS=your_password
REM   SET FTP_DIR=/public_html/admin/

SET FTP_HOST=CHANGE_ME
SET FTP_USER=CHANGE_ME
SET FTP_PASS=CHANGE_ME
SET FTP_DIR=/public_html/admin/

echo ============================================
echo  Deploying Admin Panel to Hostinger...
echo  Host: %FTP_HOST%
echo  Dir:  %FTP_DIR%
echo ============================================

echo open %FTP_HOST% > ftp_commands.txt
echo %FTP_USER% >> ftp_commands.txt
echo %FTP_PASS% >> ftp_commands.txt
echo binary >> ftp_commands.txt
echo cd %FTP_DIR% >> ftp_commands.txt
echo put index.html >> ftp_commands.txt
echo put styles.css >> ftp_commands.txt
echo put api.js >> ftp_commands.txt
echo put logo.png >> ftp_commands.txt
echo quit >> ftp_commands.txt

ftp -s:ftp_commands.txt
del ftp_commands.txt

echo ============================================
echo  ✅ Deploy Complete!
echo ============================================
pause
