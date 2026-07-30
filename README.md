# Smart School Management System

MERN school ERP: JWT-RBAC, dual-slot attendance, teacher punctuality, gradebook, finance, and exports.

## Stack

- **Client:** React (Vite) + TypeScript + Tailwind CSS + shadcn-style UI
- **Server:** Node.js + Express + Mongoose
- **DB:** MongoDB

## Quick start

### 1. MongoDB

```bash
docker compose up -d
```

Or point `server/.env` `MONGODB_URI` at your own Mongo instance.

### 2. Install

```bash
npm install
```

### 3. Seed admin

```bash
npm run seed
```

Default login: `admin` / `Admin@12345`

### 4. Run

```bash
# terminal 1
npm run dev:server

# terminal 2
npm run dev:client
```

- App: http://localhost:5173  
- API: http://localhost:5050/api/health  

## Phases

| Phase | Status |
|-------|--------|
| 0 Foundation (monorepo, theme, Docker) | Done |
| 1 Auth, users, settings | Done |
| 2 Students, classes, subjects | Next |
| 3 Dual-slot attendance + teacher check-in + KPIs | Planned |
| 4 Gradebook lock/release | Planned |
| 5 Finance | Planned |
| 6 Reports & polish | Planned |

## Roles

`super_admin` · `staff` · `teacher` · `cashier` · `student`

## License

Private / school project.
