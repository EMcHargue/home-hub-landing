CREATE TABLE dbo.recipes (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    name         NVARCHAR(255)  NOT NULL,
    ingredients  NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
    instructions NVARCHAR(MAX)  NULL,
    servings     INT            NOT NULL DEFAULT 4,
    tags         NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
    created_at   DATETIME2      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE dbo.planned_meals (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    plan_date    DATE           NOT NULL,
    slot         NVARCHAR(20)   NOT NULL,
    recipe_id    INT            NULL REFERENCES dbo.recipes(id) ON DELETE SET NULL,
    custom_name  NVARCHAR(255)  NULL,
    created_at   DATETIME2      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_planned_meals_date_slot UNIQUE (plan_date, slot)
);
