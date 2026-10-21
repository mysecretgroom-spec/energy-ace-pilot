"""Exercise the actual migration predicates with concrete ownership cases."""
import pathlib
import re
import sqlite3
import unittest

SQL = (pathlib.Path(__file__).parents[2] / "drizzle/migrations/0008_scope_reference_data_access.sql").read_text()


def predicate(policy, clause="USING"):
    statement = next(part for part in SQL.split(";") if '"' + policy + '"' in part)
    tail = statement.split(clause + " (", 1)[1]
    expression = tail.split(") WITH CHECK", 1)[0] if ") WITH CHECK" in tail else tail.rsplit(")", 1)[0]
    return expression.replace("(SELECT auth.uid())", "'caller-a'")


def permits(expression, owner):
    connection = sqlite3.connect(":memory:")
    try:
        return bool(connection.execute("SELECT " + expression + " FROM (SELECT ? AS user_id)", (owner,)).fetchone()[0])
    finally:
        connection.close()


class ReferenceAccess(unittest.TestCase):
    def test_climate_reads_shared_and_own_but_not_other_users(self):
        rule = predicate("Users can view shared or own climate zones")
        self.assertTrue(permits(rule, None))
        self.assertTrue(permits(rule, "caller-a"))
        self.assertFalse(permits(rule, "caller-b"))

    def test_climate_update_cannot_transfer_ownership_or_publish(self):
        rule = predicate("Users can update own zones climatiques", "WITH CHECK")
        self.assertTrue(permits(rule, "caller-a"))
        self.assertFalse(permits(rule, "caller-b"))
        self.assertFalse(permits(rule, None))

    def test_psh_update_cannot_transfer_ownership_or_publish(self):
        rule = predicate("Users can update own PSH data", "WITH CHECK")
        self.assertTrue(permits(rule, "caller-a"))
        self.assertFalse(permits(rule, "caller-b"))
        self.assertFalse(permits(rule, None))


if __name__ == "__main__":
    unittest.main()