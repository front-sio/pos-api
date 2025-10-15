import "dotenv/config";
import express from "express";
import cors from "cors";
import invoiceRouter from "./routes/invoices";
import { pool } from "./db/db";

const app = express();
const PORT = Number(process.env.PORT || 3004);

app.use(cors());
app.use(express.json({ type: ["application/json", "application/*+json"], limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Basic DB connectivity check on startup
async function verifyDb() {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    // eslint-disable-next-line no-console
    console.log("invoices-service: database connection OK");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("invoices-service: database connection FAILED", err);
  }
}

app.get("/health", (_req, res) => res.json({ status: "ok", service: "invoices-service" }));
app.use("/invoices", invoiceRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, async () => {
  // eslint-disable-next-line no-console
  console.log(`Invoices Service running on port ${PORT}`);
  await verifyDb();
});