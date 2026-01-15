import { useState, useEffect, useCallback } from 'react';
import socket from '../socket';
import API_URL from '../api';

/**
 * Agent View - Individual agent interface
 * Features:
 * - Online/Offline toggle
 * - Full-screen call modal with countdown
 * - Accept button
 */
export default function AgentView() {
    const [agents, setAgents] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [isOnline, setIsOnline] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [incomingCall, setIncomingCall] = useState(null);
    const [countdown, setCountdown] = useState(0);
    const [isAccepting, setIsAccepting] = useState(false);

    // Fetch agents list
    useEffect(() => {
        fetch(`${API_URL}/api/agents`)
            .then(res => res.json())
            .then(data => {
                setAgents(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch agents:', err);
                setIsLoading(false);
            });
    }, []);

    // Socket connection and event handlers
    useEffect(() => {
        socket.connect();

        socket.on('AGENT_JOINED', (data) => {
            console.log('Agent joined:', data);
            setIsOnline(true);
        });

        socket.on('AGENT_LEFT', (data) => {
            console.log('Agent left:', data);
            setIsOnline(false);
        });

        socket.on('AGENT_CALLED', (data) => {
            console.log('Agent called:', data);
            setIncomingCall(data);
            setCountdown(data.timeoutSeconds);
        });

        socket.on('AGENT_ACCEPTED', (data) => {
            console.log('Call accepted:', data);
            setIncomingCall(null);
            setCountdown(0);
        });

        socket.on('TIMEOUT', (data) => {
            console.log('Call timeout:', data);
            if (incomingCall?.walkInId === data.walkInId) {
                setIncomingCall(null);
                setCountdown(0);
            }
        });

        return () => {
            socket.off('AGENT_JOINED');
            socket.off('AGENT_LEFT');
            socket.off('AGENT_CALLED');
            socket.off('AGENT_ACCEPTED');
            socket.off('TIMEOUT');
        };
    }, [incomingCall]);

    // Countdown timer
    useEffect(() => {
        if (countdown > 0 && incomingCall) {
            const timer = setTimeout(() => {
                setCountdown(c => c - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0 && incomingCall) {
            // Timer expired
            setIncomingCall(null);
        }
    }, [countdown, incomingCall]);

    // Handle agent selection
    const handleSelectAgent = (agent) => {
        setSelectedAgent(agent);
        setIsOnline(agent.status === 'AVAILABLE');
    };

    // Toggle online status
    const handleToggleOnline = async () => {
        if (!selectedAgent) return;

        try {
            if (isOnline) {
                // Go offline
                socket.emit('AGENT_LEAVE', { agentId: selectedAgent.id });
                await fetch(`${API_URL}/api/agent/leave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agentId: selectedAgent.id }),
                });
            } else {
                // Go online
                socket.emit('AGENT_JOIN', { agentId: selectedAgent.id });
                await fetch(`${API_URL}/api/agent/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agentId: selectedAgent.id, socketId: socket.id }),
                });
            }
        } catch (err) {
            console.error('Failed to toggle status:', err);
        }
    };

    // Accept call
    const handleAccept = async () => {
        if (!incomingCall || !selectedAgent) return;

        setIsAccepting(true);
        try {
            await fetch(`${API_URL}/api/agent/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walkInId: incomingCall.walkInId,
                    agentId: selectedAgent.id,
                }),
            });
            setIncomingCall(null);
            setCountdown(0);
            setIsOnline(false);
        } catch (err) {
            console.error('Failed to accept:', err);
        } finally {
            setIsAccepting(false);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    // Agent selection screen
    if (!selectedAgent) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="glass-card p-8">
                    <h2 className="text-2xl font-bold text-center mb-6">Select Your Profile</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {agents.map((agent) => (
                            <button
                                key={agent.id}
                                onClick={() => handleSelectAgent(agent)}
                                className="p-6 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600 hover:border-primary-500 transition-all group"
                            >
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-2xl font-bold">
                                    {agent.name.charAt(0)}
                                </div>
                                <div className="text-lg font-semibold text-white">{agent.name}</div>
                                <div className="text-sm text-slate-400">Agency {agent.agency?.code}</div>
                                <div className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-medium ${agent.status === 'AVAILABLE' ? 'bg-green-500/20 text-green-400' :
                                    agent.status === 'UNAVAILABLE' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-slate-500/20 text-slate-400'
                                    }`}>
                                    {agent.status}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Main agent interface
    return (
        <>
            {/* Incoming Call Modal */}
            {incomingCall && (
                <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center">
                    <div className="text-center">
                        <div className="mb-8">
                            <div className="relative inline-block">
                                <svg className="w-48 h-48" viewBox="0 0 100 100">
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="45"
                                        fill="none"
                                        stroke="#1e293b"
                                        strokeWidth="8"
                                    />
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="45"
                                        fill="none"
                                        stroke="#0ea5e9"
                                        strokeWidth="8"
                                        strokeLinecap="round"
                                        className="countdown-ring"
                                        style={{
                                            strokeDashoffset: 283 - (283 * countdown) / (incomingCall.timeoutSeconds || 30),
                                        }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-6xl font-bold text-white">{countdown}</span>
                                </div>
                            </div>
                        </div>

                        <h2 className="text-4xl font-bold text-white mb-4 animate-pulse">
                            INCOMING CUSTOMER
                        </h2>
                        <p className="text-xl text-slate-300 mb-12">
                            A walk-in customer is waiting for you!
                        </p>

                        <button
                            onClick={handleAccept}
                            disabled={isAccepting}
                            className="btn-glow px-16 py-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-3xl font-bold text-white shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all transform hover:scale-105 disabled:opacity-50"
                        >
                            {isAccepting ? 'ACCEPTING...' : 'ACCEPT'}
                        </button>
                    </div>
                </div>
            )}

            {/* Main UI */}
            <div className="max-w-lg mx-auto">
                <div className="glass-card p-8">
                    {/* Agent Info */}
                    <div className="text-center mb-8">
                        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-4xl font-bold text-white">
                            {selectedAgent.name.charAt(0)}
                        </div>
                        <h2 className="text-2xl font-bold text-white">{selectedAgent.name}</h2>
                        <p className="text-slate-400">
                            {selectedAgent.agency?.name} (Agency {selectedAgent.agency?.code})
                        </p>
                    </div>

                    {/* Status Badge */}
                    <div className="flex justify-center mb-8">
                        <div className={`px-6 py-3 rounded-full font-semibold text-lg ${isOnline ? 'status-online text-white' : 'status-offline text-slate-300'
                            }`}>
                            {isOnline ? '🟢 ONLINE' : '⚫ OFFLINE'}
                        </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                        onClick={handleToggleOnline}
                        className={`w-full py-5 rounded-xl font-bold text-xl transition-all transform hover:scale-[1.02] ${isOnline
                            ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30'
                            : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30'
                            }`}
                    >
                        {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
                    </button>

                    {/* Change Agent */}
                    <button
                        onClick={() => setSelectedAgent(null)}
                        className="w-full mt-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
                    >
                        Switch Agent
                    </button>
                </div>
            </div>
        </>
    );
}
