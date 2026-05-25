# 🚀 AaplaKart Backend

> **FastAPI Python Backend** — Handles auth, products, orders, payments, delivery, admin APIs
> 
> **Last Updated: May 25, 2026**

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI (uvicorn) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | Firebase Admin SDK + REST API fallback |
| Cache | Redis (optional) |
| Payments | Razorpay (test mode) |
| File Storage | JSON files (products, categories, promos) |

---

## 📁 Current Structure

```
aaplakart-backend/
├── run.py                    # Dev server (uvicorn --reload)
├── requirements.txt          # Python deps
├── .env                      # Firebase, Razorpay, DB config
├── aaplakart.db              # SQLite database (auto-created)
└── app/
    ├── main.py               # FastAPI app + CORS + lifespan
    ├── config/               # firebase.py, settings.py
    ├── db/                   # database.py, models.py (SQLAlchemy)
    ├── middleware/            # auth_middleware.py
    ├── models/               # Pydantic schemas
    ├── routes/               # 11 route modules
    ├── services/             # Firebase, Redis, Product, Category services
    ├── scripts/              # setup_admin.py
    ├── data/                 # products.json, categories.json, promos.json
    └── static/images/        # Product images
```

---

## 🚀 Quick Start

```bash
cd aaplakart-backend
pip install -r requirements.txt
python run.py
```

→ **API:** http://localhost:8000  
→ **Docs:** http://localhost:8000/docs

---

## 🔐 Authentication Tokens

| Token Prefix | Login Method | Role |
|-------------|-------------|------|
| `admin-dev-*` | `admin` / `admin@123` | `admin` |
| `delivery-dev-*` | Phone + OTP | `delivery` |
| `mock-dev-*` | Mock OTP (123456) | `user` |
| Firebase ID Token | Firebase phone auth | `user` (from DB) |

---

## 📡 API Endpoints

### Auth — `/api/auth`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | — | Normal login |
| POST | `/simple-login` | — | Dev login (any phone) |
| POST | `/mock-login` | — | Mock token generation |
| POST | `/admin-login` | — | Admin login |
| POST | `/send-otp` | — | Send SMS OTP |
| POST | `/verify-otp` | — | Verify OTP |
| POST | `/verify-token` | — | Verify Firebase ID token |
| POST | `/google` | — | Google sign-in |
| GET | `/me` | 🔒 | Current user profile |

### Orders — `/api/orders`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | 🔒 | Place new order |
| GET | `/` | 🔒 | List my orders |
| GET | `/{id}` | 🔒 | Get single order |

### Products — `/api/products`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | List (filters: type, category, search) |
| POST | `/` | 🔒 admin | Create product |
| PUT | `/{id}` | 🔒 admin | Update product |
| DELETE | `/{id}` | 🔒 admin | Delete product |

### Admin — `/api/admin`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | System health (cached 30s) |
| GET | `/stats` | Dashboard stats |
| GET | `/orders` | All orders (filtered) |
| PATCH | `/orders/{id}/status` | Update order status |
| GET/POST/PUT/DELETE | `/shops/` | Shop CRUD |
| GET/POST/PUT/DELETE | `/promos` | Promo CRUD |
| GET/PUT | `/config` | App configuration |
| GET | `/users` | User list |

### Delivery — `/api/delivery`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/orders` | Active orders (with lat/lon radius filter) |
| PATCH | `/orders/{id}/status` | Update order status |

### Payments — `/api/payments`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/create-order` | Create Razorpay order |
| POST | `/verify-payment` | Verify payment signature |

---

## 📊 Current DB State

| Entity | Count |
|--------|-------|
| Products | 56 (Kart + Waffle) |
| Categories | 4 sections |
| Orders | 44+ |
| Shops | 1 active |
| Users | Multiple |

---

## 🧪 Test Scripts

```bash
python create_demo_order.py       # Create 1 demo order
python create_test_orders.py      # Create multiple test orders
python test_delivery_flow.py      # Full E2E delivery flow
python quick_test.py              # Quick delivery check
python check_all_statuses.py      # View all order statuses
```

---

## ⚠️ Order Status Format

**MUST use HYPHENS:** `out-for-delivery` (NOT `out_for_delivery`)

```
pending → confirmed → preparing → out-for-delivery → delivered / cancelled
```

---

## 🔗 Related Docs

- [Main App README](../aaplakart-app/README.md)
- [Architecture Overview](../ARCHITECTURE_OVERVIEW.md)
- [Backend Analysis](../ANALYSIS_BACKEND.md)

Because the backend lives in its own folder with its own `requirements.txt` and no dependency on the React Native codebase, you can:

1. Deploy the backend to any cloud (Cloud Run, Firebase Functions, Railway, etc.)
2. Update the frontend's API base URL in a `.env` variable
3. The frontend continues using Firebase client SDK for phone-auth, then sends the resulting ID token to this backend for verification

No code changes needed in the frontend — only the API endpoint URL.
