package models

import be.objectify.deadbolt.core.models.Role
import scalikejdbc._
import org.joda.time.DateTime

@SerialVersionUID(1L)
case class SecurityRole(
  id: Long,
  roleName: String) extends Role
{
  override def getName: String = roleName

  def save()(implicit session: DBSession = SecurityRole.autoSession): SecurityRole =
    SecurityRole.save(this)(session)

  def destroy()(implicit session: DBSession = SecurityRole.autoSession): Unit =
    SecurityRole.destroy(id)(session)
}

object SecurityRole extends SQLSyntaxSupport[SecurityRole]
{
  def apply(c: SyntaxProvider[SecurityRole])(rs: WrappedResultSet): SecurityRole =
    apply(c.resultName)(rs)

  def apply(c: ResultName[SecurityRole])(rs: WrappedResultSet): SecurityRole =
    new SecurityRole(
      id = rs.get(c.id),
      roleName = rs.get(c.roleName))

  def allRoles(implicit session: DBSession = autoSession): List[SecurityRole] =
    List()

  val r = SecurityRole.syntax("r")

  def findByRoleName(roleName: String)(implicit session: DBSession = autoSession): Option[SecurityRole] = withSQL {
    select
      .from(SecurityRole as r)
      .where.eq(column.roleName, roleName)
  }.map(SecurityRole(r)).single.apply()

  def save(x: SecurityRole)(implicit session: DBSession = autoSession): SecurityRole = {
    withSQL {
      update(SecurityRole)
        .set(column.roleName -> x.roleName)
        .where.eq(column.id, x.id)
    }.update.apply()
    x
  }

  def destroy(id: Long)(implicit session: DBSession = autoSession): Unit = withSQL {
    delete.from(SecurityRole)
      .where.eq(column.id, id)
  }.update.apply()
}
