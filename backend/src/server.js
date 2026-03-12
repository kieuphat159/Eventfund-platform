import "./config/env.js";
import app from './app.js';
import { connectDB } from './config/mongoDB.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});

// connectDB().then(() => {
//   app.listen(PORT, () => {
//     console.log(`Backend running at http://localhost:${PORT}`);
//   });
// });