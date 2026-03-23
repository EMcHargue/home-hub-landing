CREATE TABLE dbo.shopping_list_links (
  id            INT IDENTITY(1,1) PRIMARY KEY,
  week_start    DATE          NOT NULL,
  ingredient_name NVARCHAR(255) NOT NULL,
  pantry_item_id  INT           NOT NULL,
  CONSTRAINT UQ_shopping_list_links UNIQUE (week_start, ingredient_name)
);
