@REM Maven Wrapper script for Windows
@REM https://maven.apache.org/wrapper/

@IF "%__MVNW_ARG0_NAME__%"=="" (SET __MVNW_ARG0_NAME__=%~nx0)
@SET __MVNW_CMD__=
@SET __MVNW_ERROR__=
@SET __MVNW_PSMODULEP_SAVE=%PSModulePath%
@SET PSModulePath=
@FOR /F "usebackq tokens=1* delims==" %%A IN (`powershell -noprofile "& {$scriptDir='%~dp0teleStaged'; $env:__MVNW_CMD__=''}"`) DO @(
  IF "%%A"=="__MVNW_CMD__" (SET __MVNW_CMD__=%%B) ELSE IF "%%A"=="__MVNW_ERROR__" (SET __MVNW_ERROR__=%%B)
)
@SET PSModulePath=%__MVNW_PSMODULEP_SAVE%
@SET __MVNW_PSMODULEP_SAVE=
@SET __MVNW_ARG0_NAME__=
@SET MVNW_USERNAME=
@SET MVNW_PASSWORD=

@REM Determine project base directory
@SET MAVEN_PROJECTBASEDIR=%~dp0

@REM Find java.exe
@SET JAVA_EXE=java.exe
@IF NOT "%JAVA_HOME%"=="" SET JAVA_EXE=%JAVA_HOME%\bin\java.exe

@REM Check for maven-wrapper.jar
@SET WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar
@SET WRAPPER_PROPERTIES=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.properties

@REM Download wrapper if missing
@IF NOT EXIST "%WRAPPER_JAR%" (
  @IF EXIST "%WRAPPER_PROPERTIES%" (
    @FOR /F "usebackq tokens=1,2 delims==" %%A IN ("%WRAPPER_PROPERTIES%") DO @(
      @IF "%%A"=="wrapperUrl" SET DOWNLOAD_URL=%%B
    )
    powershell -Command "Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%WRAPPER_JAR%'"
  )
)

@REM Execute Maven
@IF EXIST "%WRAPPER_JAR%" (
  "%JAVA_EXE%" %MAVEN_OPTS% -classpath "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
) ELSE (
  @REM Fallback to system Maven
  mvn %*
)
@IF %ERRORLEVEL% NEQ 0 goto error
goto end

:error
@SET ERROR_CODE=%ERRORLEVEL%
@EXIT /B %ERROR_CODE%

:end
