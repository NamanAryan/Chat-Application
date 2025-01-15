import express from 'express';
import { Message } from '../models/message.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const messages = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userId] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' }
        }
      }
    ]);

    await Message.populate(messages, {
      path: 'lastMessage.sender lastMessage.receiver',
      select: 'username avatar isOnline lastSeen'
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:userId', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('sender receiver', 'username avatar isOnline');

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { receiverId, content, messageType = 'text', fileUrl = '' } = req.body;

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      content,
      messageType,
      fileUrl
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender receiver', 'username avatar isOnline');

    req.app.get('io').to(receiverId).emit('newMessage', populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:messageId/read', protect, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      {
        _id: req.params.messageId,
        receiver: req.user._id,
        readAt: null
      },
      {
        readAt: new Date()
      },
      { new: true }
    ).populate('sender receiver', 'username avatar isOnline');

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    req.app.get('io').to(message.sender._id).emit('messageRead', message);

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;