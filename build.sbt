name := """blotre"""

version := "0.0.0"

scalaVersion := "2.11.6"

val appDependencies = Seq(
  "be.objectify"  %% "deadbolt-java"     % "2.4.0",
  "com.feth"      %% "play-authenticate" % "0.7.1",
  "com.typesafe.akka" %% "akka-contrib" % "2.3.4",
  "org.mongodb" % "mongo-java-driver" % "2.13.0",
  "org.mongodb.morphia" % "morphia" % "0.109",
  "org.mongodb.morphia" % "morphia-logging-slf4j" % "0.109",
  "org.mongodb.morphia" % "morphia-validation" % "0.109",
  javaJdbc,
  cache,
  filters,
  javaWs
)

resolvers += Resolver.sonatypeRepo("snapshots")

resolvers ++= Seq(
  "Apache" at "http://repo1.maven.org/maven2/",
  "jBCrypt Repository" at "http://repo1.maven.org/maven2/org/",
  "play-easymail (release)" at "http://joscha.github.io/play-easymail/repo/releases/",
  "play-easymail (snapshot)" at "http://joscha.github.io/play-easymail/repo/snapshots/",
  Resolver.url("Objectify Play Repository", url("http://schaloner.github.io/releases/"))(Resolver.ivyStylePatterns)
)

lazy val root = (project in file("."))
  .enablePlugins(PlayScala)
  .settings(
    libraryDependencies ++= appDependencies
  )

// Scala Compiler Options
scalacOptions in ThisBuild ++= Seq(
  "-target:jvm-1.8",
  "-encoding", "UTF-8",
  "-deprecation", // warning and location for usages of deprecated APIs
  "-feature", // warning and location for usages of features that should be imported explicitly
  "-unchecked", // additional warnings where generated code depends on assumptions
  "-Xlint", // recommended additional warnings
  "-Xcheckinit", // runtime error when a val is not initialized due to trait hierarchies (instead of NPE somewhere else)
  "-Ywarn-adapted-args", // Warn if an argument list is modified to match the receiver
  "-Ywarn-inaccessible",
  "-Ywarn-dead-code"
)

// Run `make build` before `activator dist`
lazy val webpackBuild = taskKey[Unit]("Build production js bundle.")

webpackBuild := {
  "webpack" !
}

(packageBin in Universal) <<= (packageBin in Universal) dependsOn webpackBuild

// Disable documentation
sources in (Compile, doc) := Seq.empty

publishArtifact in (Compile, packageDoc) := false
