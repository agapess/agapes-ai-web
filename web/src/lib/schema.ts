import { sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
} from 'drizzle-orm/sqlite-core'
import { randomUUID } from 'crypto'

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'timestamp' }),
  image: text('image'),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  credits: integer('credits').notNull().default(0),
  plan: text('plan', { enum: ['free', 'pro', 'enterprise'] }).notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  passwordHash: text('password_hash'),
  settings: text('settings', { mode: 'json' }).notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  sessionToken: text('session_token').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
})

export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
})

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  theme: text('theme', { mode: 'json' }).notNull().default('{}'),
  settings: text('settings', { mode: 'json' }).notNull().default('{}'),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const pages = sqliteTable('pages', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  order: integer('order').notNull().default(0),
  content: text('content', { mode: 'json' }).notNull().default('[]'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  isHomePage: integer('is_home_page', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const projectHistory = sqliteTable('project_history', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  snapshot: text('snapshot', { mode: 'json' }).notNull(),
  description: text('description').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messages: text('messages', { mode: 'json' }).notNull().default('[]'),
  provider: text('provider'),
  model: text('model'),
  creditsUsed: integer('credits_used').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const aiProviderConfigs = sqliteTable('ai_provider_configs', {
  id: text('id').primaryKey(),
  scope: text('scope', { enum: ['platform', 'user'] }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom'] }).notNull(),
  displayName: text('display_name').notNull(),
  baseUrl: text('base_url'),
  apiKey: text('api_key'),
  model: text('model'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  allowedPlans: text('allowed_plans', { mode: 'json' }).notNull().default('["free","pro","enterprise"]'),
  creditCostPerRequest: integer('credit_cost_per_request').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const creditTransactions = sqliteTable('credit_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  type: text('type', { enum: ['purchase', 'admin', 'usage', 'refund'] }).notNull(),
  description: text('description').notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  stripePriceId: text('stripe_price_id').notNull(),
  status: text('status', { enum: ['active', 'canceled', 'past_due', 'trialing'] }).notNull().default('active'),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }).notNull(),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const formSubmissions = sqliteTable('form_submissions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  pageId: text('page_id'),
  data: text('data', { mode: 'json' }).notNull().default('{}'),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category', { enum: ['landing', 'saas', 'portfolio', 'ecommerce', 'dashboard', 'other'] }).notNull().default('other'),
  previewCode: text('preview_code').notNull().default(''),
  pagesSnapshot: text('pages_snapshot', { mode: 'json' }).notNull().default('[]'),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})
