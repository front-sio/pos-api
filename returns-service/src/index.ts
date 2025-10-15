import express from "express";
import returnRoutes from "./routes/returns";

const app = express();
app.use(express.json());

app.use("/returns", returnRoutes);

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Returns Service running on port ${PORT}`);
});