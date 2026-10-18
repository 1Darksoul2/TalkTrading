@echo off
@REM Maven Wrapper CMD script
set MAVEN_PORTABLE=C:\Users\Admin\.mvn-portable\apache-maven-3.9.9\bin\mvn.cmd
if exist "%MAVEN_PORTABLE%" (
    "%MAVEN_PORTABLE%" %*
) else (
    mvn %*
)
