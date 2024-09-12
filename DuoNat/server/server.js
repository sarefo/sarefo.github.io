const express = require('express');
   const mongoose = require('mongoose');
   require('dotenv').config();

   const app = express();
   const PORT = process.env.PORT || 3000;

   // MongoDB connection
   mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
     .then(() => console.log('Connected to MongoDB'))
     .catch(err => console.error('Could not connect to MongoDB:', err));

   app.get('/', (req, res) => {
     res.send('Hello World! MongoDB is connected.');
   });

   app.listen(PORT, () => {
     console.log(`Server is running on port ${PORT}`);
   });

