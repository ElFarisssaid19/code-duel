#!/bin/bash
# Runs once, on first container start (empty volume).
# `prisma migrate dev` creates and drops a temporary "shadow" database, so the
# app user needs CREATE/DROP on all schemas. Development only — never in prod.
set -euo pipefail

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
GRANT CREATE, DROP, ALTER, INDEX, REFERENCES, SELECT, INSERT, UPDATE, DELETE,
      CREATE TEMPORARY TABLES, LOCK TABLES, CREATE VIEW, SHOW VIEW
  ON *.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
SQL
