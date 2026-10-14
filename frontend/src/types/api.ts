export type Role = 'admin' | 'staff';

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

export type QuoteStatus = 'new' | 'in_review' | 'quoted' | 'closed';

export type ServiceType =
  | 'web_development'
  | 'mobile_app'
  | 'crm'
  | 'ecommerce'
  | 'custom_software';

export type QuoteRequest = {
  id: number;
  client_name: string;
  email: string;
  company: string | null;
  service_type: ServiceType;
  budget_range: string | null;
  message: string;
  status: QuoteStatus;
  assigned_user_id: number | null;
  assigned_user?: User | null;
  created_at: string;
  updated_at: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type CurrentUserResponse = {
  user: User;
};

export type PaginationLink = {
  url: string | null;
  label: string;
  active: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    links: PaginationLink[];
    path: string;
    per_page: number;
    to: number | null;
    total: number;
  };
};

export type ValidationErrorResponse = {
  message: string;
  errors?: Record<string, string[]>;
};
