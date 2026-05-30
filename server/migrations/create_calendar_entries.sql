CREATE TABLE dbo.calendar_entries (
    id           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    title        NVARCHAR(255)    NOT NULL,
    description  NVARCHAR(1000)   NULL,
    entry_date   DATE             NOT NULL,
    start_time   NVARCHAR(5)      NULL,
    end_time     NVARCHAR(5)      NULL,
    all_day      BIT              NOT NULL DEFAULT 1,
    time_of_day  NVARCHAR(20)     NOT NULL DEFAULT 'all_day',
    color        NVARCHAR(20)     NULL,
    created_at   DATETIME2        NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_calendar_entries_entry_date ON dbo.calendar_entries (entry_date);
