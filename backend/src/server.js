import dotenv from 'dotenv';
import app from './app.js';
// import { connectDB } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});

// connectDB().then(() => {
//   app.listen(PORT, () => {
//     console.log(`Backend running at http://localhost:${PORT}`);
//   });
// });