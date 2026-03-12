# Home Hub API

This simple Express + TypeScript backend provides CRUD endpoints for the
pantry application. It uses SQL Server as the database and the `mssql` driver.

## Setup

1. Install dependencies from the `server` directory:
   ```bash
   cd server
   npm install
   ```

2. Create a `.env` file with your database connection values:
   ```env
   DB_USER=sa
   DB_PASSWORD=YourPassword
   DB_SERVER=localhost
   DB_NAME=home_hub
   PORT=4000
   ```

3. Build or run in development:
   ```bash
   npm run dev   # watch mode
   npm run build && npm start  # production
   ```

4. The API will listen on port `4000` by default.  Example routes:
   - `GET /api/categories` – list static category lookup
   - `GET /api/pantry?user_id=<uuid>` – get items for a user
   - `POST /api/pantry` – create an item (body must contain user_id, name, quantity, unit, min_quantity, etc.)
   - `PUT /api/pantry/:id` – update an item
   - `DELETE /api/pantry/:id` – delete an item
   - `GET /api/shopping?user_id=<uuid>` – shopping list
   - `POST /api/shopping` – add shopping entry
   - `DELETE /api/shopping/:id` – remove entry
   - `POST /api/users` – register
   - `GET /api/users/:id` – look up user

You can adapt and extend the routes to include authentication, validation,
more complex queries, etc.
