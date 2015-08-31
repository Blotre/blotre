package models

import play.api.data.validation.ValidationError
import play.api.libs.json.Reads

/**
 * Validated stream color.
 */
case class Color private(value: String)

object Color {
  val pattern = """#[0-9a-fA-F]{6}""".r

  val default = Color("#aaaaaa")
  val none = Color("#000000")

  def readColor =
    Reads.StringReads
      .filter(ValidationError("Color is not valid."))(_.matches(Color.pattern.toString))
      .map(Color(_))

  /**
   * Try to create a color from a string.
   */
  def fromString(value: String): Option[Color] =
    if (value.matches(pattern.toString))
      Some(Color(value.toLowerCase))
    else
      None
}
