# Smart School Management System

MERN school ERP: JWT-RBAC, dual-slot attendance, teacher punctuality, gradebook, finance, and exports.

## Stack

- **Client:** React (Vite) + TypeScript + Tailwind CSS + shadcn-style UI (light/dark)
- **Server:** Node.js + Express + Mongoose
- **DB:** MongoDB

## Quick start

### 1. MongoDB

```bash
docker compose up -d
```

Or point `server/.env` `MONGODB_URI` at your own Mongo instance (local MongoDB works too).

### 2. Install

```bash
npm install
cp server/.env.example server/.env
```

### 3. Seed admin

```bash
npm run seed
```

Default login: `admin` / `Admin@12345`

### 4. Run

```bash
# terminal 1 — API (default port 5050)
npm run dev:server

# terminal 2 — web app
npm run dev:client
```

- App: http://localhost:5173  
- API: http://localhost:5050/api/health  

## Modules (SRS complete)

| Area | Capabilities |
|------|----------------|
| Auth / RBAC | JWT access + refresh, force password change, activate/deactivate |
| Academics | Classes, subjects, teacher assignments, students + parent contacts |
| Attendance | Dual-slot capture, truancy flags, admin excuses, teacher check-in |
| Gradebook | Draft → lock → admin release, student report card PDF |
| Finance | Monthly invoices, scholarships/discounts, cashier payments, waivers |
| Reports | Attendance, punctuality, academics, finance, audit — PDF/XLSX/CSV |
| Audit | Searchable action log with before/after payloads |

## Roles

`super_admin` · `staff` · `teacher` · `cashier` · `student`

## Phases

All planned phases (0–6) are implemented on `main`.

## License

Private / school project.
