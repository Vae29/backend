import express from 'express';
import cors from 'cors';

import pool, { testConnection } from './config/db.js';

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

testConnection();

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});