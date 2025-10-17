import dotenv from 'dotenv';
import express from "express";
import authRouter from "./routes/auth";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/auth", authRouter);

app.get("/", (req, res) => {
  res.send("Auth Service Running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});