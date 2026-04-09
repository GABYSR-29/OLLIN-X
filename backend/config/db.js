const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = (process.env.MONGO_URI || '').trim();
  if (!uri || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
    console.error('Error: MONGO_URI inválida o vacía en .env. Debe ser: mongodb://... o mongodb+srv://...');
    process.exit(1);
  }
  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error conectando a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
