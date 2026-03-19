-- Allow multiple pantry items with the same name per user (e.g. different lots, groups, or expiration dates)
ALTER TABLE dbo.pantry_items DROP CONSTRAINT UQ_pantry_user_name;
