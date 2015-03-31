name := """blotre"""

version := "0.0.0"

lazy val root = (project in file(".")).enablePlugins(PlayScala, PlayJava)

scalaVersion := "2.11.1"

libraryDependencies ++= Seq(
  "be.objectify"  %% "deadbolt-java"     % "2.3.0-RC1",
  "com.feth"      %% "play-authenticate" % "0.6.5-SNAPSHOT",
  "org.mongodb" % "mongo-java-driver" % "2.13.0",
  "org.mongodb.morphia" % "morphia" % "0.109",
  "org.mongodb.morphia" % "morphia-logging-slf4j" % "0.109",
  "org.mongodb.morphia" % "morphia-validation" % "0.109",
  "com.nulab-inc" %% "play2-oauth2-provider" % "0.13.2",
  javaJdbc,
  javaEbean,
  cache,
  javaWs,
  "org.webjars" %% "webjars-play" % "2.3.0",
  "org.webjars" % "bootstrap" % "3.2.0",
  "org.webjars" % "knockout" % "3.3.0",
  "com.typesafe.akka" %% "akka-contrib" % "2.3.4"
)

libraryDependencies += filters

resolvers ++= Seq(
  "Apache" at "http://repo1.maven.org/maven2/",
  "jBCrypt Repository" at "http://repo1.maven.org/maven2/org/",
  "play-easymail (release)" at "http://joscha.github.io/play-easymail/repo/releases/",
  "play-easymail (snapshot)" at "http://joscha.github.io/play-easymail/repo/snapshots/",
  Resolver.url("Objectify Play Repository", url("http://schaloner.github.io/releases/"))(Resolver.ivyStylePatterns),
  "play-authenticate (release)" at "http://joscha.github.io/play-authenticate/repo/releases/",
  "play-authenticate (snapshot)" at "http://joscha.github.io/play-authenticate/repo/snapshots/"
)
