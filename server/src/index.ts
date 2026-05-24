import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import usersRouter from "./routes/users";
import categoriesRouter from "./routes/categories";
import pantryRouter from "./routes/pantry";
import pantryGroupsRouter from "./routes/pantry-groups";
import shoppingRouter from "./routes/shopping";
import membersRouter from "./routes/members";
import recipesRouter from "./routes/recipes";
import plannedMealsRouter from "./routes/planned-meals";
import shoppingListLinksRouter from "./routes/shopping-list-links";
import choresRouter from "./routes/chores";
import tasksRouter from "./routes/tasks";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/api/users", usersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/pantry", pantryRouter);
app.use("/api/pantry-groups", pantryGroupsRouter);
app.use("/api/shopping", shoppingRouter);
app.use("/api/members", membersRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/planned-meals", plannedMealsRouter);
app.use("/api/shopping-list-links", shoppingListLinksRouter);
app.use("/api/chores", choresRouter);
app.use("/api/tasks", tasksRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
