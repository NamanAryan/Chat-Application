const messageSchema = new mongoose.Schema({
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: [true, 'Message content is required']
    },
    readAt: {
      type: Date,
      default: null
    },

  }, {
    timestamps: true
  });

  messageSchema.index({ sender: 1, receiver: 1 });
  messageSchema.index({ createdAt: -1 });
  
  const Message = mongoose.model('Message', messageSchema);
  
  export { User, Message };