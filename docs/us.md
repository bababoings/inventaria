Inventory & Sales System — User Stories
US-01 Authentication & Access
    As an Admin or Staff,
    I want to log into the system securely,
    so that I can access inventory and sales features according to my role.

    Acceptance Criteria

    - Users can authenticate using an email and password
    - Invalid credentials display a clear, user-friendly error message
    - Successful authentication creates a secure session
    - Users are redirected to the Dashboard page after login
    - Dashboard content is displayed according to the user’s role (Admin or Staff)
    - Unauthorized users cannot access protected pages

US-02 Product Management (Admin)
    As an Admin,
    I want to create, view, update, and search products with pricing and reorder settings,
    so that products can be tracked accurately in inventory and used in sales.

    Acceptance Criteria

    - Admins can create products with SKU, name, cost, price, and reorder point
    - SKUs must be unique across the system
    - Cost, price, and reorder values must be non-negative numbers
    - Products can be updated and changes apply immediately
    - Product list displays SKU, product name, and on-hand quantity
    - Archived products are hidden from sales workflows
    - Archived products remain visible in historical records
    - Admins can search products by SKU or product name
    - Search results update dynamically and reflect current system data

US-03 Inventory Visibility & Adjustment
    As an Admin or Staff,
    I want to view, search, and adjust inventory levels,
    so that inventory reflects real-world quantities.

    Acceptance Criteria

    - Inventory view displays product name, on-hand quantity, and low-stock indicator
    - Users can search inventory items by product name or SKU
    - Stock adjustments require a mandatory reason
    - Stock adjustments create immutable inventory movement records
    - Inventory levels update immediately after an adjustment
    - The system prevents inventory from dropping below zero under any condition

US-04 Sales Processing & Inventory Update
    As a Staff member,
    I want to record and complete sales at the end of my shift,
    so that sold items are deducted from inventory accurately and consistently.

    Acceptance Criteria

    - Staff can create a sale by searching for products
    - Staff can add products and quantities during the shift
    - Sales remain in an in-progress state until explicitly completed
    - Sales can only be completed at the end of the day or shift
    - On sale completion, the system validates sufficient inventory for all items
    - Inventory is updated atomically for all sale items
    - Inventory never drops below zero
    - If stock is insufficient, the sale is blocked
    - A clear error message is displayed when stock is insufficient
    - Only completed sales affect inventory
    - Only completed sales appear in reports and exports

US-05 Supplier Management & Purchasing
    As an Admin,
    I want to create, view, update, and search suppliers and purchase orders,
    so that I can restock inventory in a controlled and traceable way.

    Acceptance Criteria

    - Suppliers require a name to be created
    - Suppliers can be searched by name
    - Purchase orders are linked to exactly one supplier
    - Purchase orders allow multiple products with validated quantities
    - Purchase orders start in a DRAFT state
    - Admins can search purchase orders by supplier, status, or purchase order ID

US-06 Receive Purchase Orders
    As an Admin,
    I want to receive purchase orders in full,
    so that inventory is increased accurately.

    Acceptance Criteria

    - Purchase orders can only be received once
    - Receiving a purchase order creates PURCHASE_RECEIPT inventory movement records
    - Receiving a purchase order increases on-hand inventory accordingly
    - Purchase order status is updated to RECEIVED
    - Received purchase orders are visible on the Dashboard and in reports

US-07 AI-Assisted Reorder Intelligence
    As an Admin,
    I want AI-assisted reorder suggestions with explanations,
    so that I understand when and how much to reorder.

    Acceptance Criteria

    - Reorder suggestions trigger when stock is at or below the reorder point
    - AI provides a suggested reorder quantity
    - AI provides a plain-language explanation using current system data
    - AI recommendations are visible on the Dashboard
    - AI does not modify inventory, products, or purchase orders directly

US-08 AI Natural-Language Queries
    As an Admin,
    I want to ask natural-language questions about inventory and sales,
    so that I can quickly understand system data.

    Acceptance Criteria

    - Admins can submit free-text questions from the Dashboard
    - AI responses use current system data
    - AI responses are returned in plain language
    - Each response is saved as an AIInsight record
    - Stored AI insights are searchable and viewable for auditing purposes

US-09 Automation on Low Stock
    As the system,
    I want to trigger an automation workflow when stock is low,
    so that reorder processes can start automatically.

    Acceptance Criteria

    - Low-stock conditions automatically emit a webhook
    - An n8n workflow is triggered upon webhook emission
    - Each automation execution is logged with timestamp and status
    - Automation executions are viewable by Admin users from the Dashboard
    - Automation logs are searchable and filterable by status and date

US-10 Data Import & Export (CSV)
    As an Admin,
    I want to import and export inventory-related data via CSV,
    so that I can efficiently analyze and manage data in bulk.

    Acceptance Criteria

    - Admins can export CSV files for inventory snapshots
    - Admins can export CSV files for completed sales
    - Admins can export CSV files for purchase orders
    - Exported data includes only persisted system data
    - Exported data is unfiltered and read-only
    - CSV files download immediately from the UI
    - Admins can upload CSV files to create or update products
    - Admins can upload CSV files to initialize or adjust inventory quantities
    - Uploaded data is displayed in a tabular preview
    - Each row is validated for SKU existence and numeric values ≥ 0
    - Invalid rows are clearly highlighted and blocked from import
    - Only valid rows are applied upon confirmation
    - Import actions create appropriate inventory movement records
    - Import actions never allow inventory to drop below zero
    - Import actions are explicit and irreversible once confirmed

US-11 Dashboard Overview & System Summary
    As an Admin or Staff,
    I want to view a centralized dashboard when I log into the system,
    so that I can quickly understand the current state of inventory and sales.

    Acceptance Criteria

    - The Dashboard is the default landing page after successful login
    - The Dashboard displays total items in stock
    - The Dashboard displays the count of low-stock products
    - The Dashboard displays total sales for the current day
    - The Dashboard displays total revenue for the current day
    - Users can view a Low Stock Items section with product name, quantity, and reorder point
    - Users can view a Recent Sales section with sale ID, date/time, and total amount
    - Dashboard data reflects persisted system data only
    - Dashboard data updates automatically when underlying data changes
    - Admins see full sales, revenue, and inventory data
    - Staff see only permitted sales and inventory summaries
    - The Dashboard loads successfully with empty or zero-state indicators when no data exists