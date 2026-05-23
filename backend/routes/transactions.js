const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/authMiddleware');

// GET all transactions for logged in user
router.get('/', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST add new transaction
router.post('/', auth, async (req, res) => {
  try {
    const { type, amount, date, category, desc } = req.body;

    const transaction = new Transaction({
      userId: req.user.id,
      type,
      amount,
      date,
      category,
      desc
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE transaction
router.delete('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    await transaction.deleteOne();
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET summary
router.get('/summary', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id });

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
      if (t.type === 'income') totalIncome += t.amount;
      else totalExpense += t.amount;
    });

    res.json({
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST chat
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, context } = req.body;

    const systemPrompt = `You are a personal finance assistant for Expense Manager Lite.
The user's current financial data:
${typeof context === 'object' ? JSON.stringify(context) : (context || 'None')}

Give concise, practical, friendly financial advice based on this data.
Keep responses under 100 words unless detailed analysis is requested.`;

    let messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (Array.isArray(message)) {
      messages = messages.concat(message);
    } else {
      messages.push({ role: 'user', content: message });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Groq API Error:', errorData);
      return res.status(500).json({ message: 'Error from AI service' });
    }

    const data = await response.json();
    res.json({ response: data.choices[0].message.content });
  } catch (err) {
    console.error('Chat endpoint error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST scan receipt
router.post('/scan', auth, async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ message: 'No image provided' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this receipt image and extract:
1. Total amount (just the final amount paid)
2. Store/vendor name or type of purchase
3. Best category from this list: Food, Travel, Shopping, Bills, Health, Education, Entertainment, Other
4. Date if visible (format YYYY-MM-DD), otherwise leave empty

Respond ONLY in this exact JSON format, nothing else:
{
  "amount": 250.00,
  "description": "Swiggy food order",
  "category": "Food",
  "date": "2026-05-15"
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image}`
                }
              }
            ]
          }
        ],
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Groq API Error:', errorData);
      return res.status(500).json({ message: 'Error from AI service' });
    }

    const data = await response.json();
    res.json({ content: data.choices[0].message.content });
  } catch (err) {
    console.error('Scan endpoint error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
