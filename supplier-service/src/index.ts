import dotenv from 'dotenv';
dotenv.config()
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import suppliersRouter from './routes/suppliers';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Suppliers API
app.use('/suppliers', suppliersRouter);

const PORT = Number(process.env.PORT || 3008);
app.listen(PORT, () => {
  console.log(`Supplier Service running on port ${PORT}`);
});