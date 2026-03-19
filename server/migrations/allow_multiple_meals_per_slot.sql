-- Allow multiple planned meals per (date, slot) by dropping the unique constraint
ALTER TABLE dbo.planned_meals DROP CONSTRAINT UQ_planned_meals_date_slot;
