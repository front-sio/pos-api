import 'dotenv/config';
import express from 'express';

import customersRouter from './routes/customers';

const app = express();


app.use(express.json());


// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Customers API
app.use('/customers', customersRouter);

const PORT = Number(process.env.PORT || 3002);
app.listen(PORT, () => {
  console.log(`Customers Service running on port ${PORT}`);
});