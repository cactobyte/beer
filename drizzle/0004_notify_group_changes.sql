-- Push a notification whenever a group's version moves, so open pages
-- (listening via /api/groups/[id]/events) refresh instantly.
CREATE OR REPLACE FUNCTION notify_group_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('group_changes', NEW.id::text || ':' || NEW.version::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS groups_version_notify ON groups;
--> statement-breakpoint
CREATE TRIGGER groups_version_notify
  AFTER UPDATE OF version ON groups
  FOR EACH ROW
  WHEN (OLD.version IS DISTINCT FROM NEW.version)
  EXECUTE FUNCTION notify_group_change();
