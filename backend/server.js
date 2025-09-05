const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000", "file://", "*"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000", "file://", "*"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// In-memory storage
let farmers = new Map();
let queries = [];

// Enhanced Malayalam knowledge base
const knowledgeBase = {
  malayalam: {
    pest: {
      keywords: ['കീടങ്ങൾ', 'പുഴു', 'രോഗം', 'കീടനാശിനി', 'ഇലപ്പുഴു', 'തണ്ടുപുഴു'],
      response: 'കീടങ്ങളെ നിയന്ത്രിക്കാൻ: 1. നീം എണ്ണ (10ml/ലിറ്റർ വെള്ളം) തളിക്കുക 2. ട്രൈക്കോഡെർമ വിരിഡി ഉപയോഗിക്കുക 3. വൃത്തിയുള്ള കൃഷിയിടം പരിപാലിക്കുക 4. രാസകീടനാശിനി അവസാന ആശ്രയമായി മാത്രം. കൂടുതൽ വിവരങ്ങൾക്ക്: 0471-2305670'
    },
    weather: {
      keywords: ['കാലാവസ്ഥ', 'മഴ', 'വരൾച്ച', 'കാറ്റ്', 'ചൂട്', 'തണുപ്പ്'],
      response: 'കാലാവസ്ഥാ വ്യതിയാനങ്ങൾക്ക്: 1. IMD കേരള മുന്നറിയിപ്പുകൾ ശ്രദ്ധിക്കുക 2. മഴക്കാലത്ത് ഡ്രെയിനേജ് ഉറപ്പാക്കുക 3. വരൾച്ചയിൽ മൾച്ചിംഗ് നടത്തുക 4. ഡ്രിപ്പ് ജലസേചനം ഉപയോഗിക്കുക. Weather Alert: 1077'
    },
    fertilizer: {
      keywords: ['വളം', 'രാസവളം', 'ജൈവവളം', 'കമ്പോസ്റ്റ്', 'NPK', 'യൂറിയ'],
      response: 'ശരിയായ വളപ്രയോഗം: 1. മണ്ണ് പരിശോധന നിർബന്ധം (pH 6.0-7.0) 2. വിളയുടെ വളർച്ചാ ഘട്ടം അനുസരിച്ച് NPK അനുപാതം 3. ജൈവവളം മുൻഗണന (കമ്പോസ്റ്റ്, വേർമി കമ്പോസ്റ്റ്) 4. സമയബന്ധിതമായ പ്രയോഗം. സൗജന്യ മണ്ണ് പരിശോധന: 181'
    },
    irrigation: {
      keywords: ['ജലസേചനം', 'വെള്ളം', 'നനയ്ക്കൽ', 'ഡ്രിപ്പ്', 'സ്പ്രിംക്ലർ'],
      response: 'കാര്യക്ഷമമായ ജലസേചനം: 1. പുലർച്ചെ (6-8 AM) അല്ലെങ്കിൽ വൈകുന്നേരം (6-8 PM) 2. ഡ്രിപ്പ്/മൈക്രോ സ്പ്രിംക്ലർ സിസ്റ്റം 3. മണ്ണിന്റെ ഈർപ്പം പരിശോധിച്ച് (30% ഈർപ്പം കുറയുമ്പോൾ) 4. മൾച്ചിംഗ് ചെയ്ത് ജലനഷ്ടം കുറയ്ക്കുക'
    },
    crops: {
      rice: {
        keywords: ['നെല്ല്', 'അരി', 'പാടം', 'നെല്ലു'],
        response: 'നെല്ല് കൃഷി മാർഗ്ഗനിർദ്ദേശങ്ങൾ: 1. വിത്ത് സംസ്കരണം (24 മണിക്കൂർ കുതിർത്ത് 48 മണിക്കൂർ മൂടിവെച്ച്) 2. 20-25 ദിവസം പഴക്കമുള്ള തൈകൾ നടുക 3. വരി-വരി 20cm, ചെടി-ചെടി 15cm അകലം 4. 5-10cm ജലനിരപ്പ് നിലനിർത്തുക 5. 110-140 ദിവസം കൊണ്ട് വിളവെടുപ്പ്'
      },
      coconut: {
        keywords: ['തേങ്ങ്', 'കോക്കനട്', 'തെങ്ങ്', 'നാരികേളം'],
        response: 'തെങ്ങ് പരിപാലനം: 1. പ്രതിമാസം 200-250 ലിറ്റർ വെള്ളം (വരൾക്കാലത്ത്) 2. വർഷത്തിൽ രണ്ടുതവണ വളം (മെയ്-ജൂൺ, സെപ്റ്റംബർ-ഒക്ടോബർ) 3. റൂട്ട് ഫീഡിംഗ് (500gm യൂറിയ + 2kg ഉപ്പ് ദ്രാവണം) 4. റൈനോ ബീറ്റിൽ കെണി സ്ഥാപിക്കുക. CDB ഹെൽപ്പ്ലൈൻ: 0484-2376265'
      },
      pepper: {
        keywords: ['കുരുമുളക്', 'മിളക്', 'പെപ്പർ'],
        response: 'കുരുമുളക് കൃഷി: 1. ജൂൺ-ജൂലൈയിൽ നടൽ (മഴക്കാലത്തിന് മുമ്പ്) 2. വേപ്പ് തൈകൾ സപ്പോർട്ടായി 3. ബോർഡോ മിശ്രിതം ഫംഗൽ രോഗങ്ങൾക്കെതിരെ 4. പ്രതിവർഷം 2-3 തവണ വളം 5. ശരിയായ വെള്ളം നിയന്ത്രണം (കുമിഞ്ഞു നിൽക്കരുത്). സ്പൈസസ് ബോർഡ്: 0484-2333610'
      }
    },
    government: {
      keywords: ['സർക്കാർ പദ്ധതി', 'സബ്സിഡി', 'ലോൺ', 'സഹായം', 'പിഎം കിസാൻ', 'KCC'],
      response: 'കാർഷിക സഹായ പദ്ധതികൾ: 1. PM-KISAN: വർഷം ₹6000 (₹2000 x 3 ക്വാർട്ടർ) 2. കിസാൻ ക്രെഡിറ്റ് കാർഡ് (KCC): 4% പലിശ 3. PMFBY: വിള ഇൻഷുറൻസ് സ്കീം 4. MIDH: ഹോർട്ടികൾച്ചർ വികസനം 5. കേരള കാർഷിക ബാങ്ക് ലോൺ. അപേക്ഷിക്കാൻ: https://pmkisan.gov.in, സ്ഥানീയ കൃഷി ഓഫീസ്'
    },
    soil: {
      keywords: ['മണ്ണ് പരിശോധന', 'മണ്ണ്', 'pH', 'പരിശോധന', 'മൺപാത്രം'],
      response: 'മണ്ണ് പരിശോധന പ്രക്രിയ: 1. കാർഷിക ഓഫീസിൽ സൗജന്യ പരിശോധന (500gm സാമ്പിൾ) 2. ആവശ്യമായ pH: 6.0-7.0 (നെല്ലിന് 5.5-6.8) 3. NPK, ഓർഗാനിക് കാർബൺ അളവുകൾ 4. സിങ്ക്, ബോറോൺ പോലെയുള്ള മൈക്രോ ന്യൂട്രിയന്റ്സ് 5. ശുപാർശകൾ അനുസരിച്ച് വളപ്രയോഗം. സൗജന്യ ഹെൽപ്പ്ലൈൻ: 181, Soil Health Card'
    },
    organic: {
      keywords: ['ജൈവകൃഷി', 'ഓർഗാനിക്', 'രാസവളം ഇല്ലാതെ', 'പ്രകൃതിദത്തം'],
      response: 'ജൈവകൃഷി മാർഗ്ഗങ്ങൾ: 1. കമ്പോസ്റ്റ്, വേർമി കമ്പോസ്റ്റ്, ഗ്രീൻ മനുർ 2. ബയോ-ഫെർട്ടിലൈസറുകൾ (റൈസോബിയം, അസോട്ടോബാക്ടർ) 3. നീം കേക്, പോംഗാമിയ കേക് 4. ജീവാമൃതം, പഞ്ചഗവ്യം 5. ഇന്റർക്രോപ്പിംഗ്, ക്രോപ് റൊട്ടേഷൻ 6. ജൈവ കീടനാശിനികൾ. OFAI സർട്ടിഫിക്കേഷൻ: 0471-2700537'
    }
  },
  english: {
    pest: {
      keywords: ['pest', 'insect', 'disease', 'bug', 'worm'],
      response: 'Pest Management: 1. Use neem oil spray (10ml/liter water) 2. Apply Trichoderma viride for soil health 3. Maintain field sanitation 4. Use chemical pesticides as last resort. Contact: 0471-2305670'
    },
    weather: {
      keywords: ['weather', 'rain', 'drought', 'temperature', 'climate'],
      response: 'Weather Management: 1. Follow IMD Kerala alerts 2. Ensure proper drainage during monsoon 3. Mulching during drought 4. Use drip irrigation system. Weather Alert: 1077'
    },
    fertilizer: {
      keywords: ['fertilizer', 'nutrients', 'NPK', 'urea', 'compost'],
      response: 'Proper Fertilization: 1. Mandatory soil testing (pH 6.0-7.0) 2. NPK ratio based on crop growth stage 3. Prefer organic fertilizers 4. Timely application. Free soil testing: 181'
    },
    irrigation: {
      keywords: ['irrigation', 'water', 'watering', 'drip'],
      response: 'Efficient Irrigation: 1. Water during early morning (6-8 AM) or evening (6-8 PM) 2. Use drip/micro sprinkler systems 3. Monitor soil moisture 4. Mulching to reduce water loss'
    }
  }
};

// AI Response Generator
function generateAIResponse(query, language = 'malayalam') {
  const lang = knowledgeBase[language] || knowledgeBase['malayalam'];
  const queryLower = query.toLowerCase();
  
  // Check main categories first
  for (const [category, data] of Object.entries(lang)) {
    if (typeof data === 'object' && data.keywords) {
      if (data.keywords.some(keyword => queryLower.includes(keyword.toLowerCase()))) {
        return {
          response: data.response,
          category: category,
          confidence: 0.95
        };
      }
    }
  }
  
  // Check crop-specific queries
  if (lang.crops) {
    for (const [crop, data] of Object.entries(lang.crops)) {
      if (data.keywords && data.keywords.some(keyword => queryLower.includes(keyword.toLowerCase()))) {
        return {
          response: data.response,
          category: `crops_${crop}`,
          confidence: 0.95
        };
      }
    }
  }
  
  // Default response
  const defaultResponse = language === 'malayalam' 
    ? 'നിങ്ങളുടെ ചോദ്യം മനസ്സിലായില്ല. കൂടുതൽ വ്യക്തമായി ചോദിക്കുക അല്ലെങ്കിൽ കാർഷിക ഓഫീസറുമായി ബന്ധപ്പെടുക: 0471-2305670'
    : 'Could not understand your query. Please ask more clearly or contact agricultural officer: 0471-2305670';
  
  return {
    response: defaultResponse,
    category: 'general',
    confidence: 0.3
  };
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Farmer Advisory System is running!',
    features: ['Malayalam Support', 'Voice Input', 'Real-time Chat', 'Smart Responses']
  });
});

app.post('/api/farmers/register', (req, res) => {
  try {
    const { name, phone, location, cropType, preferredLanguage } = req.body;
    
    if (!name || !phone || !location) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, phone and location are required' 
      });
    }
    
    const farmer = {
      _id: phone,
      name,
      phone,
      location,
      cropType: cropType ? [cropType] : [],
      preferredLanguage: preferredLanguage || 'malayalam',
      registeredAt: new Date()
    };
    
    farmers.set(phone, farmer);
    
    res.json({ 
      success: true, 
      farmer,
      message: preferredLanguage === 'malayalam' ? 'വിജയകരമായി രജിസ്റ്റർ ചെയ്തു!' : 'Successfully registered!'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/farmers/:phone', (req, res) => {
  try {
    const farmer = farmers.get(req.params.phone);
    if (!farmer) {
      return res.status(404).json({ success: false, message: 'Farmer not found' });
    }
    res.json({ success: true, farmer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/query', (req, res) => {
  try {
    const { farmerId, query, language } = req.body;
    
    if (!farmerId || !query) {
      return res.status(400).json({ 
        success: false, 
        message: 'Farmer ID and query are required' 
      });
    }
    
    // Generate AI response
    const aiResult = generateAIResponse(query, language);
    
    // Save query
    const queryRecord = {
      id: Date.now() + Math.random(),
      farmerId,
      query,
      language: language || 'malayalam',
      response: aiResult.response,
      category: aiResult.category,
      confidence: aiResult.confidence,
      timestamp: new Date()
    };
    
    queries.push(queryRecord);
    
    // Keep only last 1000 queries to prevent memory issues
    if (queries.length > 1000) {
      queries = queries.slice(-1000);
    }
    
    // Emit to socket for real-time
    io.emit('new_response', {
      queryId: queryRecord.id,
      response: aiResult.response,
      category: aiResult.category,
      confidence: aiResult.confidence
    });
    
    res.json({
      success: true,
      queryId: queryRecord.id,
      response: aiResult.response,
      category: aiResult.category,
      confidence: aiResult.confidence,
      timestamp: queryRecord.timestamp
    });
    
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get query history
app.get('/api/queries/:farmerId', (req, res) => {
  try {
    const farmerQueries = queries
      .filter(q => q.farmerId === req.params.farmerId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);
    
    res.json({ success: true, queries: farmerQueries });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Weather data with Kerala-specific locations
app.get('/api/weather/:location', (req, res) => {
  const location = req.params.location.toLowerCase();
  
  const keralaWeather = {
    'thiruvananthapuram': {
      temperature: '29°C', humidity: '78%', rainfall: '12mm today',
      advisory: 'Good for rice transplanting. Avoid fertilizer application if heavy rain expected.'
    },
    'kochi': {
      temperature: '31°C', humidity: '82%', rainfall: '8mm expected',
      advisory: 'High humidity good for coconut. Monitor pepper plants for fungal diseases.'
    },
    'kozhikode': {
      temperature: '28°C', humidity: '85%', rainfall: '15mm expected',
      advisory: 'Perfect conditions for spices cultivation. Good day for organic spraying.'
    },
    'kottayam': {
      temperature: '27°C', humidity: '88%', rainfall: '20mm expected',
      advisory: 'Excellent for rubber tapping. Ensure proper drainage for vegetable crops.'
    },
    'thrissur': {
      temperature: '30°C', humidity: '75%', rainfall: '5mm expected',
      advisory: 'Good conditions for paddy. Apply organic manure before evening rain.'
    }
  };
  
  const weatherData = keralaWeather[location] || {
    temperature: '28°C',
    humidity: '75%',
    rainfall: '5mm expected',
    advisory: 'Check local weather station for specific conditions. Contact: 1077'
  };
  
  res.json({ 
    success: true, 
    weather: {
      location: req.params.location,
      ...weatherData,
      lastUpdated: new Date().toISOString()
    }
  });
});

// Market prices with Kerala-specific markets
app.get('/api/market-prices/:crop', (req, res) => {
  const crop = req.params.crop.toLowerCase();
  
  const keralaMarkets = {
    'rice': { 
      price: '₹28/kg', market: 'Thiruvananthapuram Vegetable Market', 
      trend: 'stable', quality: 'IR64', lastUpdated: '2 hours ago' 
    },
    'coconut': { 
      price: '₹15/piece', market: 'Pollachi Coconut Market (via Ernakulam)', 
      trend: 'rising', quality: 'Medium size', lastUpdated: '1 hour ago' 
    },
    'pepper': { 
      price: '₹520/kg', market: 'Kottayam Spice Market', 
      trend: 'rising', quality: 'Black pepper 500GL', lastUpdated: '30 minutes ago' 
    },
    'rubber': { 
      price: '₹185/kg', market: 'Kottayam Rubber Market', 
      trend: 'stable', quality: 'RSS4', lastUpdated: '1 hour ago' 
    },
    'cardamom': { 
      price: '₹1350/kg', market: 'Kumily Spice Market (Idukki)', 
      trend: 'falling', quality: '7mm bold', lastUpdated: '45 minutes ago' 
    },
    'banana': { 
      price: '₹25/dozen', market: 'Ernakulam Vegetable Market', 
      trend: 'stable', quality: 'Robusta variety', lastUpdated: '2 hours ago' 
    },
    'vegetables': { 
      price: '₹15-45/kg', market: 'Pazhavangadi Market (TVM)', 
      trend: 'stable', quality: 'Mixed vegetables', lastUpdated: '3 hours ago' 
    }
  };
  
  const priceInfo = keralaMarkets[crop] || { 
    price: 'Data not available', 
    market: 'Contact local market committee', 
    trend: 'unknown',
    quality: 'Check with local traders',
    lastUpdated: 'N/A'
  };
  
  res.json({ 
    success: true, 
    crop: req.params.crop,
    priceInfo: priceInfo
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('👤 New client connected:', socket.id);
  
  socket.on('join_farmer', (farmerId) => {
    socket.join(`farmer_${farmerId}`);
    console.log(`🌾 Farmer ${farmerId} joined room`);
  });
  
  socket.on('user_typing', (data) => {
    socket.broadcast.to(`farmer_${data.farmerId}`).emit('farmer_typing', {
      isTyping: data.isTyping
    });
  });
  
  socket.on('disconnect', () => {
    console.log('👤 Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io enabled for real-time communication`);
  console.log(`🌾 Enhanced Farmer Advisory System Ready`);
  console.log(`💾 Using in-memory storage with ${Object.keys(knowledgeBase.malayalam).length} categories`);
  console.log(`🌐 Frontend should connect to: http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Test endpoint: http://localhost:${PORT}/`);
});

module.exports = app;