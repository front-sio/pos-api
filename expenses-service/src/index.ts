import express from 'express';
import routes from './routes/expenses';

const app = express();
app.use(express.json());
app.use('/expenses', routes);

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Products Service running on port ${PORT}`);
});