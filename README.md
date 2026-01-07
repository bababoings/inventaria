# InventarIA - AI-Powered Inventory Management System

A modern, full-featured inventory management system with AI-powered insights, built with React, TypeScript, and Supabase.

## 🚀 Features

- **📦 Product Management**: Create, edit, and manage products with SKUs, pricing, and reorder points
- **📊 Inventory Tracking**: Real-time inventory levels with low-stock alerts
- **🛒 Sales Management**: Process sales, track transactions, and manage shifts
- **📋 Purchase Orders**: Create and manage purchase orders with suppliers
- **👥 Supplier Management**: Maintain supplier information and relationships
- **🤖 AI Ask**: Get AI-powered insights about inventory, reorder suggestions, and sales analysis using OpenAI
- **👤 Team Management**: Invite staff members with role-based access control (Admin/Staff)
- **📈 Dashboard**: Overview of key metrics, low-stock items, and recent sales
- **📥 CSV Import**: Bulk import inventory adjustments via CSV

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **shadcn/ui** - UI component library
- **Tailwind CSS** - Styling
- **TanStack Query** - Data fetching and caching
- **React Hook Form** + **Zod** - Form handling and validation
- **Sonner** - Toast notifications
- **Recharts** - Data visualization

### Backend
- **Supabase** - Backend as a Service
  - PostgreSQL database
  - Row Level Security (RLS)
  - Authentication
  - Edge Functions (for AI integration)

### AI Integration
- **OpenAI API** (gpt-4o-mini) - AI-powered inventory insights
- **Supabase Edge Functions** - Serverless functions for secure API calls

## 📋 Prerequisites

- **Node.js** 18+ and npm (or use [nvm](https://github.com/nvm-sh/nvm))
- **Supabase account** - [Sign up here](https://supabase.com)
- **OpenAI API key** (optional, for AI Ask feature) - [Get one here](https://platform.openai.com/api-keys)
- **Supabase CLI** (for deploying Edge Functions) - Install with `npm install -g supabase`

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd simple-stock-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

You can find these values in your Supabase project settings under **API**.

### 4. Run Database Migrations

The database schema is defined in `supabase/migrations/`. If you're using Supabase locally or need to apply migrations:

```bash
# Link your project (if using Supabase CLI)
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

Or apply migrations through the Supabase dashboard.

### 5. Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:8080`

## 🤖 AI Ask Feature Setup

The AI Ask feature requires a Supabase Edge Function to be deployed. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

**Quick setup:**

1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref your-project-ref`
4. Set OpenAI API key: `supabase secrets set OPENAI_API_KEY=your-key`
5. Deploy function: `supabase functions deploy ai-ask`

For more details, troubleshooting, and alternative deployment methods, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## 📁 Project Structure

```
simple-stock-ai/
├── src/
│   ├── components/       # React components
│   │   ├── layout/       # Layout components (sidebar, header)
│   │   ├── ui/           # shadcn/ui components
│   │   └── csv/          # CSV import components
│   ├── contexts/         # React contexts (Auth)
│   ├── hooks/            # Custom React hooks
│   ├── integrations/     # External service integrations
│   │   └── supabase/     # Supabase client and types
│   ├── lib/              # Utility functions
│   ├── pages/            # Page components
│   └── main.tsx          # App entry point
├── supabase/
│   ├── functions/        # Edge Functions
│   │   └── ai-ask/       # AI Ask Edge Function
│   ├── migrations/       # Database migrations
│   └── config.toml       # Supabase config
├── public/                # Static assets
└── docs/                  # Documentation
```

## 🎯 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔐 Authentication & Authorization

The app uses Supabase Auth with role-based access control:

- **ADMIN**: Full access to all features
- **STAFF**: Limited access (can process sales, view inventory, but cannot manage products)

New users automatically get ADMIN role and their own organization.

## 📊 Key Features Explained

### Inventory Management
- Track stock levels in real-time
- Set reorder points and quantities
- Bulk adjustments via CSV import
- Low-stock alerts

### Sales Processing
- Shift-based sales tracking
- Real-time inventory updates
- Sales history and analytics
- Shift summaries

### AI Ask
- Natural language queries about inventory
- Reorder suggestions based on stock levels and sales data
- Sales analysis and insights
- Product performance recommendations

### Purchase Orders
- Create purchase orders with line items
- Track order status (PENDING, RECEIVED, CANCELLED)
- Supplier integration

## 🚢 Deployment

### Frontend Deployment

The frontend can be deployed to any static hosting service:
- **Vercel** (recommended)
- **Netlify**
- **GitHub Pages**
- **Supabase Hosting**

Build the project:
```bash
npm run build
```

The `dist/` folder contains the production build.

### Backend (Supabase)

The backend is hosted on Supabase. Make sure:
1. All migrations are applied
2. RLS policies are enabled
3. Edge Functions are deployed (for AI Ask)

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key | Yes |

### Supabase Secrets (for Edge Functions)

| Secret | Description | Required for AI Ask |
|--------|-------------|-------------------|
| `OPENAI_API_KEY` | OpenAI API key | Yes |

## 📝 Database Schema

The database includes tables for:
- `organizations` - Multi-tenant organization support
- `profiles` - User profiles with roles
- `products` - Product catalog
- `inventory_items` - Stock levels
- `inventory_movements` - Inventory change history
- `sales` - Sales transactions
- `sale_line_items` - Sales line items
- `suppliers` - Supplier information
- `purchase_orders` - Purchase orders
- `purchase_order_line_items` - PO line items
- `shifts` - Sales shifts
- `staff_invitations` - Staff invitation system

All tables use Row Level Security (RLS) for data isolation between organizations.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🆘 Support

For issues and questions:
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment issues
- Review Supabase logs for backend errors
- Check browser console for frontend errors

## 🎨 UI Components

This project uses [shadcn/ui](https://ui.shadcn.com/) components built on Radix UI and Tailwind CSS. Components are located in `src/components/ui/`.

## 📚 Additional Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Detailed deployment instructions for AI Ask feature
- [PRD](./docs/prd.md) - Product Requirements Document
- [User Stories](./docs/us.md) - User stories and requirements

---

Built with ❤️ using React, TypeScript, and Supabase
