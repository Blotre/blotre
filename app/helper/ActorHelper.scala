package helper

object ActorHelper
{
  /**
   * Translate some actor name that may contain path symbols into a
   * name using a whitelist. Replaces all unsupported characters with '+',
   * so there may be collisions between names.
   */
  def normalizeName(name: String): Option[String] = {
    if (name == null)
      return None
    val normalized = name.replaceAll( """[^a-zA-Z0-9\-_$]""", "+")
    if (normalized.isEmpty) None else Some(normalized)
  }
}
