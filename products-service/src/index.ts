import express from "express";
import cors from "cors";
import productRoutes from "./routes/products";

const app = express();
app.use(express.json());
app.use(cors());

app.use("/products", productRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Products Service running on port ${PORT}`);
});