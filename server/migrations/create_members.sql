-- Run this script against your Home database to create the members table.
-- Members represent household people who can log in via PIN.

CREATE TABLE dbo.members (
    id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    name       NVARCHAR(100)    NOT NULL,
    pin        NVARCHAR(10)     NULL,
    created_at DATETIME2        NOT NULL DEFAULT GETDATE()
);
