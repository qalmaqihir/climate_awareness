-- Enforce canonical ordering: always insert with lower event ID as source.
-- Prevents (A→B) and (B→A) from both existing as separate rows.
ALTER TABLE "incident_relations"
  ADD CONSTRAINT "incident_relations_canonical_order"
  CHECK ("source_event_id" < "target_event_id");
