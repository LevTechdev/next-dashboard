export interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  group: string; // e.g., "Orders", "Products", "Customers"
  requestBody?: Record<string, string>; // field: description
  queryParams?: Record<string, string>; // param: description
  responseExample?: string; // JSON string
  requiresAuth: boolean;
}

export const API_ENDPOINTS: ApiEndpoint[] = [
  // Orders
  {
    method: "GET",
    path: "/api/orders",
    description: "List all orders with customer and channel details",
    group: "Orders",
    queryParams: { status: "Filter by order status", limit: "Max results (default 100)" },
    requiresAuth: true,
  },
  {
    method: "POST",
    path: "/api/orders",
    description: "Create a new order",
    group: "Orders",
    requestBody: { customerId: "Customer ID", items: "Array of { productId, quantity, price }", channel: "Sales channel name" },
    requiresAuth: true,
  },
  {
    method: "PUT",
    path: "/api/orders",
    description: "Update order status",
    group: "Orders",
    requestBody: { id: "Order ID", status: "New status (PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED)" },
    requiresAuth: true,
  },
  // Products
  {
    method: "GET",
    path: "/api/products",
    description: "List all products with category info",
    group: "Products",
    queryParams: { includeCategories: "Include category list (true/false)" },
    requiresAuth: true,
  },
  {
    method: "POST",
    path: "/api/products",
    description: "Create a new product",
    group: "Products",
    requestBody: { name: "Product name", price: "Price in cents", costPrice: "Cost price", stock: "Initial stock", sku: "SKU code", categoryId: "Category ID" },
    requiresAuth: true,
  },
  {
    method: "PUT",
    path: "/api/products",
    description: "Update an existing product",
    group: "Products",
    requestBody: { id: "Product ID", name: "Updated name", price: "Updated price" },
    requiresAuth: true,
  },
  {
    method: "DELETE",
    path: "/api/products",
    description: "Delete a product",
    group: "Products",
    requestBody: { id: "Product ID to delete" },
    requiresAuth: true,
  },
  // Customers
  {
    method: "GET",
    path: "/api/customers",
    description: "List all customers with order counts and spending",
    group: "Customers",
    requiresAuth: true,
  },
  {
    method: "POST",
    path: "/api/customers",
    description: "Create a new customer",
    group: "Customers",
    requestBody: { name: "Customer name", email: "Email address", phone: "Phone number", city: "City", segment: "Customer segment" },
    requiresAuth: true,
  },
  // Dashboard
  {
    method: "GET",
    path: "/api/dashboard",
    description: "Get dashboard stats, revenue data, sales channels, recent orders, and top products",
    group: "Dashboard",
    requiresAuth: true,
  },
  // Search
  {
    method: "GET",
    path: "/api/search",
    description: "Global search across orders, customers, and products",
    group: "Search",
    queryParams: { q: "Search query (min 2 chars)" },
    requiresAuth: true,
  },
  // Notifications
  {
    method: "GET",
    path: "/api/notifications",
    description: "List notifications with unread counts",
    group: "Notifications",
    queryParams: { type: "Filter by type", read: "Filter by read status (true/false)", limit: "Max results" },
    requiresAuth: true,
  },
  {
    method: "PUT",
    path: "/api/notifications",
    description: "Mark notification as read/unread",
    group: "Notifications",
    requestBody: { id: "Notification ID", action: "mark-read or mark-unread" },
    requiresAuth: true,
  },
  // Analytics
  {
    method: "GET",
    path: "/api/analytics",
    description: "Get analytics data including trends and breakdowns",
    group: "Analytics",
    requiresAuth: true,
  },
  // Auth
  {
    method: "POST",
    path: "/api/auth/login",
    description: "Authenticate user and create session",
    group: "Authentication",
    requestBody: { email: "User email", password: "User password" },
    requiresAuth: false,
  },
  {
    method: "POST",
    path: "/api/auth/register",
    description: "Create a new user account",
    group: "Authentication",
    requestBody: { name: "Full name", email: "Email", password: "Password (min 8 chars)" },
    requiresAuth: false,
  },
  // Team
  {
    method: "GET",
    path: "/api/team",
    description: "List team members and pending invitations",
    group: "Team",
    requiresAuth: true,
  },
  {
    method: "POST",
    path: "/api/team",
    description: "Invite a new team member",
    group: "Team",
    requestBody: { email: "Invitee email", role: "Role (ADMIN, MANAGER, STAFF, VIEWER)" },
    requiresAuth: true,
  },
  // Billing
  {
    method: "GET",
    path: "/api/billing",
    description: "Get current subscription plan and billing info",
    group: "Billing",
    requiresAuth: true,
  },
  // Reports
  {
    method: "GET",
    path: "/api/reports",
    description: "Get report data with date range filtering",
    group: "Reports",
    queryParams: { from: "Start date (YYYY-MM-DD)", to: "End date (YYYY-MM-DD)", period: "daily, weekly, or monthly" },
    requiresAuth: true,
  },
  // Health
  {
    method: "GET",
    path: "/api/health",
    description: "Health check endpoint",
    group: "System",
    requiresAuth: false,
  },
  // Inventory
  {
    method: "GET",
    path: "/api/inventory",
    description: "Get inventory levels and stock alerts",
    group: "Inventory",
    requiresAuth: true,
  },
];

export const API_GROUPS = [...new Set(API_ENDPOINTS.map(e => e.group))].sort();
