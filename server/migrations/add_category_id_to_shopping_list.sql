-- Add category_id to shopping_list so items processed back to the pantry
-- can be created with the correct category when no existing pantry item is found.

ALTER TABLE dbo.shopping_list
    ADD category_id INT NULL;
