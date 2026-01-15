import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import AgentView from './views/AgentView';
import DashboardView from './views/DashboardView';
import PublicDisplay from './views/PublicDisplay';

function Navigation() {
    const location = useLocation();

    // Hide navigation on public display
    if (location.pathname === '/display') {
        return null;
    }

    return (
        <nav className="glass-card px-6 py-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">Queue System</h1>
                    <p className="text-xs text-slate-400">Live Show Flat Management</p>
                </div>
            </div>

            <div className="flex gap-2">
                <Link
                    to="/"
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${location.pathname === '/'
                            ? 'bg-primary-500 text-white'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                >
                    Dashboard
                </Link>
                <Link
                    to="/agent"
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${location.pathname === '/agent'
                            ? 'bg-primary-500 text-white'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                >
                    Agent View
                </Link>
                <Link
                    to="/display"
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${location.pathname === '/display'
                            ? 'bg-primary-500 text-white'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                >
                    Public Display
                </Link>
            </div>
        </nav>
    );
}

function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen p-6">
                <Navigation />
                <Routes>
                    <Route path="/" element={<DashboardView />} />
                    <Route path="/agent" element={<AgentView />} />
                    <Route path="/display" element={<PublicDisplay />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
