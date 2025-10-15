import express from "express";
import salesRoutes from "./routes/sales";

const app = express();
app.use(express.json());

app.use("/sales", salesRoutes);

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Sales Service running on port ${PORT}`);
});