import React, { useState, useRef, useEffect } from 'react';

const CareGuideBot = () => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: "Hello! I'm your Orchid Care Assistant 🌸 How can I help you today?",
            sender: 'bot',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    ]);

    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    // Scroll to bottom when new messages are added
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Pre-defined orchid knowledge base
    const orchidKnowledge = {
        general: [
            "Most orchids need bright, indirect light. Avoid direct sunlight which can burn leaves.",
            "Water your orchid when the potting mix is almost dry. Overwatering is the most common mistake.",
            "Orchids prefer temperatures between 15-25°C (60-77°F) during the day.",
            "Humidity of 50-70% is ideal for most orchids. Use a humidity tray if needed.",
            "Fertilize with a balanced orchid fertilizer every 2 weeks during active growth."
        ],

        species: {
            phalaenopsis: {
                name: "Phalaenopsis (Moth Orchid)",
                tips: [
                    "Most common houseplant orchid",
                    "Water every 7-10 days",
                    "Bright indirect light, no direct sun",
                    "Temperature: 18-25°C",
                    "Flowers last 2-3 months",
                    "Cut spike above node after flowering"
                ]
            },
            cattleya: {
                name: "Cattleya",
                tips: [
                    "Needs bright light, some direct morning sun",
                    "Water when potting mix is dry",
                    "Requires good air circulation",
                    "Night temperature drop encourages blooming",
                    "Large, fragrant flowers"
                ]
            },
            dendrobium: {
                name: "Dendrobium",
                tips: [
                    "Two main types: nobile and phalaenopsis-type",
                    "Needs bright light",
                    "Water regularly during growth",
                    "Reduce watering in winter",
                    "Some lose leaves seasonally (normal)"
                ]
            },
            oncidium: {
                name: "Oncidium (Dancing Lady)",
                tips: [
                    "Likes bright light",
                    "Keep evenly moist during growth",
                    "Requires good drainage",
                    "Sprays of small, colorful flowers",
                    "Divide when pot becomes crowded"
                ]
            },
            vanda: {
                name: "Vanda",
                tips: [
                    "Often grown without potting medium",
                    "Needs daily watering/misting",
                    "Very high light requirements",
                    "Warm temperatures (20-30°C)",
                    "Large, spectacular flowers"
                ]
            }
        },

        problems: {
            yellowLeaves: "Yellow leaves can mean overwatering, too much sun, or natural aging. Check if it's just old leaves at the bottom.",
            noFlowers: "No flowers? Ensure adequate light, proper temperature drop at night, and regular fertilizing during growth season.",
            rootRot: "Mushy, brown roots indicate overwatering. Remove affected roots, repot in fresh medium, and reduce watering.",
            budDrop: "Bud drop often caused by sudden temperature changes, low humidity, or underwatering. Maintain consistent conditions.",
            spotsOnLeaves: "Leaf spots can be fungal/bacterial. Improve air circulation, avoid water on leaves, and use fungicide if needed."
        },

        watering: [
            "Water in the morning so leaves dry by evening",
            "Use room temperature water",
            "Water thoroughly until it drains from the bottom",
            "Never let orchids sit in water",
            "Reduce watering in winter and during dormancy"
        ],

        fertilizing: [
            "Use orchid-specific fertilizer",
            "Dilute to 1/4-1/2 recommended strength",
            "'Weekly, weakly' approach works well",
            "Fertilize during active growth (spring/summer)",
            "Flush with plain water monthly to prevent salt buildup"
        ]
    };

    const getBotResponse = (userMessage) => {
        const message = userMessage.toLowerCase();
        let response = "";

        // Check for species inquiries
        for (const species in orchidKnowledge.species) {
            if (message.includes(species) || message.includes(orchidKnowledge.species[species].name.toLowerCase())) {
                const tips = orchidKnowledge.species[species].tips;
                response = `${orchidKnowledge.species[species].name} Care Tips:\n${tips.map((tip, i) => `${i + 1}. ${tip}`).join('\n')}`;
                return response;
            }
        }

        // Check for specific questions
        if (message.includes('water') || message.includes('watering')) {
            response = orchidKnowledge.watering.join('\n• ');
            return `Watering Guidelines:\n• ${response}`;
        }

        if (message.includes('fertilize') || message.includes('fertilizer')) {
            response = orchidKnowledge.fertilizing.join('\n• ');
            return `Fertilizing Tips:\n• ${response}`;
        }

        if (message.includes('light') || message.includes('sun')) {
            return "Light Requirements:\n• Bright, indirect light is ideal\n• East or west-facing windows work well\n• 6-8 hours daily\n• Avoid direct afternoon sun\n• Use sheer curtains for south-facing windows";
        }

        if (message.includes('temperature') || message.includes('cold') || message.includes('hot')) {
            return "Temperature Guidelines:\n• Day: 18-25°C (65-77°F)\n• Night: 15-20°C (60-68°F)\n• 5-10°C drop at night encourages blooming\n• Protect from drafts and sudden changes";
        }

        if (message.includes('humidity') || message.includes('moist')) {
            return "Humidity Management:\n• Ideal: 50-70% humidity\n• Use humidity trays with pebbles\n• Group plants together\n• Room humidifier helps\n• Mist leaves in dry conditions";
        }

        if (message.includes('report') || message.includes('repotting')) {
            return "Repotting Guidelines:\n• Repot every 1-2 years\n• Use fresh orchid bark mix\n• Best done after flowering\n• Choose pot with good drainage\n• Trim dead roots carefully";
        }

        if (message.includes('problem') || message.includes('issue') || message.includes('help')) {
            const problems = orchidKnowledge.problems;
            response = "Common Problems & Solutions:\n";
            for (const problem in problems) {
                response += `• ${problems[problem]}\n`;
            }
            return response;
        }

        if (message.includes('species') || message.includes('type') || message.includes('variety')) {
            response = "Common Orchid Species:\n";
            for (const species in orchidKnowledge.species) {
                response += `• ${orchidKnowledge.species[species].name}\n`;
            }
            response += "\nAsk me about any specific species for detailed care tips!";
            return response;
        }

        // Default responses
        const defaultResponses = [
            "I'd be happy to help! Could you tell me what type of orchid you have?",
            "For more specific advice, please tell me about your orchid species or the specific issue you're facing.",
            "Orchid care varies by species. Common types include Phalaenopsis, Cattleya, Dendrobium, Oncidium, and Vanda.",
            "I can help with watering, lighting, fertilizing, repotting, or specific problems. What would you like to know?",
            orchidKnowledge.general.join(' ')
        ];

        return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        // Add user message
        const userMessage = {
            id: messages.length + 1,
            text: inputText,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsTyping(true);

        // Simulate bot thinking and respond
        setTimeout(() => {
            const botResponse = {
                id: messages.length + 2,
                text: getBotResponse(inputText),
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            setMessages(prev => [...prev, botResponse]);
            setIsTyping(false);
        }, 1000);
    };

    const handleQuickQuestion = (question) => {
        setInputText(question);
        // Auto-send after a brief delay
        setTimeout(() => {
            const submitEvent = new Event('submit', { cancelable: true });
            handleSendMessage(submitEvent);
        }, 100);
    };

    const quickQuestions = [
        "How often to water?",
        "Best light conditions?",
        "Why no flowers?",
        "How to repot?",
        "Phalaenopsis care tips"
    ];

    return (
        <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto bg-white/90 backdrop-blur-xl rounded-3xl shadow-glow overflow-hidden border border-fuchsia-100">
            <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 p-4 flex items-center gap-4 text-white shadow-md z-10">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-2xl border border-white/30 shadow-inner">
                    <span role="img" aria-label="bot">🤖</span>
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-lg leading-tight">Orchid AI Assistant</h3>
                    <p className="text-fuchsia-100 text-xs">Ask me anything about orchid care!</p>
                </div>
                <div className="flex items-center gap-2 bg-black/10 px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                    <span className="text-xs font-medium tracking-wide">Online</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 scroll-smooth">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex gap-3 max-w-[85%] md:max-w-[75%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {message.sender === 'bot' && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-sm shadow-sm flex-shrink-0 text-white border border-fuchsia-200">
                                    <span>🤖</span>
                                </div>
                            )}

                            <div className={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                                <div
                                    className={`p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed ${message.sender === 'user'
                                            ? 'bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white rounded-tr-sm'
                                            : 'bg-white border border-fuchsia-50 text-slate-700 rounded-tl-sm'
                                        }`}
                                >
                                    <div className="whitespace-pre-wrap">
                                        {message.text.split('\n').map((line, i) => (
                                            <React.Fragment key={i}>
                                                {line}
                                                {i < message.text.split('\n').length - 1 && <br />}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1.5 px-1 font-medium">{message.timestamp}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="flex gap-3 max-w-[85%]">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-sm shadow-sm flex-shrink-0 text-white border border-fuchsia-200">
                                <span>🤖</span>
                            </div>
                            <div className="bg-white border border-fuchsia-50 p-4 rounded-2xl rounded-tl-sm shadow-sm">
                                <div className="flex gap-1.5 h-full items-center">
                                    <span className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="bg-white border-t border-fuchsia-100 p-4 space-y-4">
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Quick questions:</p>
                    <div className="flex flex-wrap gap-2">
                        {quickQuestions.map((question, index) => (
                            <button
                                key={index}
                                className="px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100 hover:bg-purple-100 hover:border-purple-200 hover:shadow-sm transition-all active:scale-95"
                                onClick={() => handleQuickQuestion(question)}
                            >
                                {question}
                            </button>
                        ))}
                    </div>
                </div>

                <form className="flex gap-2" onSubmit={handleSendMessage}>
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type your orchid care question here..."
                        className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400 transition-all placeholder:text-slate-400"
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white rounded-xl px-5 py-3 font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-purple-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <span>Send</span>
                        <span className="text-lg leading-none">📤</span>
                    </button>
                </form>
            </div>

            <div className="bg-slate-50 p-3 border-t border-slate-100 text-[10px] text-slate-400 text-center flex justify-center gap-4 flex-wrap">
                <span className="flex items-center gap-1"><span className="text-xs">💧</span> Watering</span>
                <span className="flex items-center gap-1"><span className="text-xs">☀️</span> Light</span>
                <span className="flex items-center gap-1"><span className="text-xs">🌡️</span> Temperature</span>
                <span className="flex items-center gap-1"><span className="text-xs">🌸</span> Species Care</span>
                <span className="flex items-center gap-1"><span className="text-xs">⚠️</span> Diagnosis</span>
            </div>
        </div>
    );
};

export default CareGuideBot;
