// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6 
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

connectDB();

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected! Attempting to reconnect...');
  connectDB();
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.use('/api/auth', authRoutes);

const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);

  socket.on('authenticate', async (userId) => {
    try {

      connectedUsers.set(socket.id, userId);
      
      // Broadcast user online status
      io.emit('userOnline', {
        userId,
        socketId: socket.id
      });

      // Get and send online users list
      const onlineUsers = Array.from(connectedUsers.values());
      socket.emit('onlineUsers', onlineUsers);
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('error', 'Authentication failed');
    }
  });

  socket.on('message', async (data) => {
    try {
      const userId = connectedUsers.get(socket.id);
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      io.emit('message', {
        ...data,
        userId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Message error:', error);
      socket.emit('error', 'Failed to send message');
    }
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('userTyping', {
      userId: connectedUsers.get(socket.id),
      ...data
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const userId = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);
    
    if (userId) {
      io.emit('userOffline', {
        userId,
        socketId: socket.id
      });
    }
    
    console.log('👋 User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 8001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  
});