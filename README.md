# Live Show Flat Queue System

A real-time queue management system for distributing walk-in customers to real estate agents using a hybrid **Round-Robin across Agencies** + **FIFO within Agency** algorithm.

## 🏗️ Tech Stack

- **Backend:** Node.js + Express + Socket.io
- **Database:** MySQL + Prisma ORM
- **Frontend:** React (Vite) + Tailwind CSS

## 📁 Project Structure

```
QueueSys/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.js          # Sample data
│   ├── src/
│   │   ├── services/        # Core business logic
│   │   ├── routes/          # API endpoints
│   │   └── socket/          # Socket.io handlers
│   ├── server.js            # Express server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── views/           # React views
│   │   ├── App.jsx          # Main app
│   │   └── socket.js        # Socket client
│   └── package.json
└── database/
    └── init.sql             # MySQL setup script
```

## 🚀 Setup Instructions

### Step 1: Database Setup

1. Open MySQL Workbench or your MySQL client
2. Run the SQL script: `database/init.sql`
3. This creates the `queue_system` database with sample data

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# (Optional) Push schema to database
npx prisma db push

# Start server
npm run dev
```

The backend runs on `http://localhost:3001`

### Step 3: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend runs on `http://localhost:5173`

## 🖥️ Usage

### Views

1. **Dashboard** (`/`) - Front desk interface
   - Shows agency columns with queued agents
   - "New Walk-In" button triggers allocation
   - Live call status updates

2. **Agent View** (`/agent`) - Individual agent interface
   - Select your agent profile
   - Toggle Online/Offline status
   - Accept incoming customer calls

3. **Public Display** (`/display`) - TV screen
   - Shows last assigned agent
   - Large, readable format

### Testing the Flow

1. Open Dashboard in one browser tab
2. Open Agent View in another tab (select an agent)
3. Click "Go Online" as the agent
4. Go to Dashboard and click "New Walk-In"
5. Watch the agent receive a call notification
6. Click "Accept" to complete the assignment

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/join` | Agent goes online |
| POST | `/api/agent/leave` | Agent goes offline |
| POST | `/api/agent/accept` | Accept walk-in |
| POST | `/api/agent/decline` | Decline walk-in |
| POST | `/api/walkin/new` | Create new walk-in |
| GET | `/api/dashboard` | Get queue state |
| GET | `/api/public-display` | Get display data |
| GET | `/api/agents` | List all agents |

## 🔄 Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `QUEUE_UPDATED` | Server → All | Queue changed |
| `AGENT_CALLED` | Server → Agent | Incoming call |
| `AGENT_ACCEPTED` | Server → All | Call accepted |
| `TIMEOUT` | Server → All | Call failed |

## ⚙️ Configuration

Edit `backend/.env`:

```env
DATABASE_URL="mysql://root:password@localhost:3306/queue_system"
PORT=3001
```

## 📝 Database Schema

- **ShowFlat** - Venue with rotation order config
- **Agency** - Real estate agencies (A, B, C)
- **Agent** - Individual agents with status
- **AgentQueue** - FIFO queue (unique agent constraint)
- **WalkIn** - Customer records
- **CallAttempt** - Audit log

## 🔒 Concurrency Handling

Uses Prisma transactions with **Serializable** isolation level to prevent race conditions when:
- Two front desk staff click "New Walk-In" simultaneously
- Pointer index updates during allocation
