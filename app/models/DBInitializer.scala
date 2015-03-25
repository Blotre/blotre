package models

import scalikejdbc._
import SQLInterpolation._

object DBInitializer {

  def run() {
    DB readOnly { implicit s =>
      try {
        sql"select 1 from programmer limit 1".map(_.long(1)).single.apply()
      } catch {
        case e: java.sql.SQLException =>
          DB autoCommit { implicit s =>
            sql"""
create table favorite (
  streamId bigint,
  ownerId bigint,
  created timestamp not null,
  primary key(programmer_id, skill_id)
);

create table company (
  id bigint not null auto_increment primary key,
  name varchar(255) not null,
  url varchar(255),
  created_at timestamp not null,
  deleted_at timestamp
);

create sequence skill_id_seq start with 1;
create table skill (
  id bigint not null default nextval('skill_id_seq') primary key,
  name varchar(255) not null,
  created_at timestamp not null,
  deleted_at timestamp
);

create table programmer_skill (
  programmer_id bigint not null,
  skill_id bigint not null,
  primary key(programmer_id, skill_id)
);
""".execute.apply()
          }
      }
    }
  }

}
