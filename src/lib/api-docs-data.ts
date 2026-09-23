export interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  /** Stable i18n key (`apiDocs.endpoints.<slug>.*`) — derived from method + path. */
  slug: string;
  /** English source copy; locale files under `apiDocs.endpoints.<slug>` override it. */
  description: string;
  group: string; // e.g., "Orders", "Products", "Customers"
  requestBody?: Record<string, string>; // field: description
  queryParams?: Record<string, string>; // param: description
  responseExample?: string; // JSON string
  requiresAuth: boolean;
  /** True for the sandboxed /v1 surface — authenticated by API key, not session cookie. */
  sandbox?: boolean;
}

export const API_ENDPOINTS: ApiEndpoint[] = [
  // Orders
  {
    slug: "orders-get",
    method: "GET",
    path: "/api/orders",
    description: "List all orders with customer and channel details",
    group: "Orders",
    queryParams: { status: "Filter by order status", limit: "Max results (default 100)" },
    requiresAuth: true,
  },
  {
    slug: "orders-post",
    method: "POST",
    path: "/api/orders",
    description: "Create a new order",
    group: "Orders",
    requestBody: {
      customerId: "Customer ID",
      items: "Array of { productId, quantity, price }",
      channel: "Sales channel name",
    },
    requiresAuth: true,
  },
  {
    slug: "orders-put",
    method: "PUT",
    path: "/api/orders",
    description: "Update order status",
    group: "Orders",
    requestBody: {
      id: "Order ID",
      status: "New status (PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED)",
    },
    requiresAuth: true,
  },
  // Products
  {
    slug: "products-get",
    method: "GET",
    path: "/api/products",
    description: "List all products with category info",
    group: "Products",
    queryParams: { includeCategories: "Include category list (true/false)" },
    requiresAuth: true,
  },
  {
    slug: "products-post",
    method: "POST",
    path: "/api/products",
    description: "Create a new product",
    group: "Products",
    requestBody: {
      name: "Product name",
      price: "Price in cents",
      costPrice: "Cost price",
      stock: "Initial stock",
      sku: "SKU code",
      categoryId: "Category ID",
    },
    requiresAuth: true,
  },
  {
    slug: "products-put",
    method: "PUT",
    path: "/api/products",
    description: "Update an existing product",
    group: "Products",
    requestBody: { id: "Product ID", name: "Updated name", price: "Updated price" },
    requiresAuth: true,
  },
  {
    slug: "products-delete",
    method: "DELETE",
    path: "/api/products",
    description: "Delete a product",
    group: "Products",
    requestBody: { id: "Product ID to delete" },
    requiresAuth: true,
  },
  // Customers
  {
    slug: "customers-get",
    method: "GET",
    path: "/api/customers",
    description: "List all customers with order counts and spending",
    group: "Customers",
    requiresAuth: true,
  },
  {
    slug: "customers-post",
    method: "POST",
    path: "/api/customers",
    description: "Create a new customer",
    group: "Customers",
    requestBody: {
      name: "Customer name",
      email: "Email address",
      phone: "Phone number",
      city: "City",
      segment: "Customer segment",
    },
    requiresAuth: true,
  },
  // Dashboard
  {
    slug: "dashboard-get",
    method: "GET",
    path: "/api/dashboard",
    description:
      "Get dashboard stats, revenue data, sales channels, recent orders, and top products",
    group: "Dashboard",
    requiresAuth: true,
  },
  // Search
  {
    slug: "search-get",
    method: "GET",
    path: "/api/search",
    description: "Global search across orders, customers, and products",
    group: "Search",
    queryParams: { q: "Search query (min 2 chars)" },
    requiresAuth: true,
  },
  // Notifications
  {
    slug: "notifications-get",
    method: "GET",
    path: "/api/notifications",
    description: "List notifications with unread counts",
    group: "Notifications",
    queryParams: {
      type: "Filter by type",
      read: "Filter by read status (true/false)",
      limit: "Max results",
    },
    requiresAuth: true,
  },
  {
    slug: "notifications-put",
    method: "PUT",
    path: "/api/notifications",
    description: "Mark notification as read/unread",
    group: "Notifications",
    requestBody: { id: "Notification ID", action: "mark-read or mark-unread" },
    requiresAuth: true,
  },
  // Analytics
  {
    slug: "analytics-get",
    method: "GET",
    path: "/api/analytics",
    description: "Get analytics data including trends and breakdowns",
    group: "Analytics",
    requiresAuth: true,
  },
  // Auth
  {
    slug: "auth-login-post",
    method: "POST",
    path: "/api/auth/login",
    description: "Authenticate user and create session",
    group: "Authentication",
    requestBody: { email: "User email", password: "User password" },
    requiresAuth: false,
  },
  {
    slug: "auth-register-post",
    method: "POST",
    path: "/api/auth/register",
    description: "Create a new user account",
    group: "Authentication",
    requestBody: { name: "Full name", email: "Email", password: "Password (min 8 chars)" },
    requiresAuth: false,
  },
  // Team
  {
    slug: "team-get",
    method: "GET",
    path: "/api/team",
    description: "List team members and pending invitations",
    group: "Team",
    requiresAuth: true,
  },
  {
    slug: "team-post",
    method: "POST",
    path: "/api/team",
    description: "Invite a new team member",
    group: "Team",
    requestBody: { email: "Invitee email", role: "Role (ADMIN, MANAGER, STAFF, VIEWER)" },
    requiresAuth: true,
  },
  // Billing
  {
    slug: "billing-get",
    method: "GET",
    path: "/api/billing",
    description: "Get current subscription plan and billing info",
    group: "Billing",
    requiresAuth: true,
  },
  // Reports
  {
    slug: "reports-get",
    method: "GET",
    path: "/api/reports",
    description: "Get report data with date range filtering",
    group: "Reports",
    queryParams: {
      from: "Start date (YYYY-MM-DD)",
      to: "End date (YYYY-MM-DD)",
      period: "daily, weekly, or monthly",
    },
    requiresAuth: true,
  },
  // Health
  {
    slug: "health-get",
    method: "GET",
    path: "/api/health",
    description: "Health check endpoint",
    group: "System",
    requiresAuth: false,
  },
  // Inventory
  {
    slug: "inventory-get",
    method: "GET",
    path: "/api/inventory",
    description: "Get inventory levels and stock alerts",
    group: "Inventory",
    requiresAuth: true,
  },
  // ═══ API Sandbox (/v1) — key-authenticated, read-only ═══
  {
    slug: "v1-ping-get",
    method: "GET",
    path: "/api/v1/ping",
    description:
      "Smoke-test an API key — verifies it exists, is active, unexpired, and within the sandbox rate limit",
    group: "API Sandbox",
    requiresAuth: true,
    sandbox: true,
    responseExample:
      '{\n  "pong": true,\n  "key": { "name": "Docs testing", "scopes": ["read"] },\n  "timestamp": "2026-09-13T10:00:00.000Z"\n}',
  },
  {
    slug: "v1-me-get",
    method: "GET",
    path: "/api/v1/me",
    description: "Key metadata plus the user and workspace the key acts for",
    group: "API Sandbox",
    requiresAuth: true,
    sandbox: true,
  },
  {
    slug: "v1-products-get",
    method: "GET",
    path: "/api/v1/products",
    description: "List products in the key's workspace (paginated)",
    group: "API Sandbox",
    queryParams: {
      limit: "Results per page, 1–100 (default 20)",
      page: "Page number (default 1)",
      active: "Filter by active state (true/false)",
    },
    requiresAuth: true,
    sandbox: true,
  },
  {
    slug: "v1-products-id-get",
    method: "GET",
    path: "/api/v1/products/:id",
    description: "A single product from the key's workspace",
    group: "API Sandbox",
    requiresAuth: true,
    sandbox: true,
  },
  {
    slug: "v1-orders-get",
    method: "GET",
    path: "/api/v1/orders",
    description: "List orders in the key's workspace with customer and channel info (paginated)",
    group: "API Sandbox",
    queryParams: {
      status: "PENDING, PROCESSING, SHIPPED, DELIVERED or CANCELLED",
      paymentStatus: "UNPAID, PAID or REFUNDED",
      limit: "Results per page, 1–100 (default 20)",
      page: "Page number (default 1)",
    },
    requiresAuth: true,
    sandbox: true,
  },
  {
    slug: "v1-orders-id-get",
    method: "GET",
    path: "/api/v1/orders/:id",
    description: "A single order with line items, from the key's workspace",
    group: "API Sandbox",
    requiresAuth: true,
    sandbox: true,
  },
  {
    slug: "v1-customers-get",
    method: "GET",
    path: "/api/v1/customers",
    description: "List customers in the key's workspace with spending totals (paginated)",
    group: "API Sandbox",
    queryParams: {
      segment: "Filter by segment (VIP, REGULAR, NEW)",
      limit: "Results per page, 1–100 (default 20)",
      page: "Page number (default 1)",
    },
    requiresAuth: true,
    sandbox: true,
  },
  {
    slug: "v1-customers-id-get",
    method: "GET",
    path: "/api/v1/customers/:id",
    description: "A single customer from the key's workspace",
    group: "API Sandbox",
    requiresAuth: true,
    sandbox: true,
  },
];

export const API_GROUPS = [...new Set(API_ENDPOINTS.map((e) => e.group))].sort();
