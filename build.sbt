name := """blotre"""

version := "0.0.0"

scalaVersion := "2.11.6"

val appDependencies = Seq(
  "be.objectify"  %% "deadbolt-java"     % "2.4.0",
  "com.feth"      %% "play-authenticate" % "0.7.1",
  "org.mongodb" % "mongo-java-driver" % "2.13.0",
  "org.mongodb.morphia" % "morphia" % "0.109",
  "org.mongodb.morphia" % "morphia-logging-slf4j" % "0.109",
  "org.mongodb.morphia" % "morphia-validation" % "0.109",
  javaJdbc,
  cache,
  filters,
  javaWs,
  "org.webjars" %% "webjars-play" % "2.4.0",
  "org.webjars" % "bootstrap" % "3.2.0",
  "org.webjars" % "knockout" % "3.3.0",
  "com.typesafe.akka" %% "akka-contrib" % "2.3.4"
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
