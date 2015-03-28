package helper

object ActorHelper
{
  /**
   * Translate some actor name that may contain path symbols into a
   * name using a whitelist. Replaces all unsupported characters with '+',
   * so there may be collisions between names.
   */
  def normalizeName(name: String) =
    name.split("""[a-zA-Z0-9-_$]+""").mkString("+")
}
