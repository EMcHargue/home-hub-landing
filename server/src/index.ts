import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import usersRouter from "./routes/users";
import categoriesRouter from "./routes/categories";
import pantryRouter from "./routes/pantry";
import pantryGroupsRouter from "./routes/pantry-groups";
import shoppingRouter from "./routes/shopping";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/api/users", usersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/pantry", pantryRouter);
app.use("/api/pantry-groups", pantryGroupsRouter);
app.use("/api/shopping", shoppingRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
